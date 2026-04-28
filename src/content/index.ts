import { WalkthroughData, Step } from '../types';
import { extractPRContext, fetchWalkthrough, isFilesPage } from './api';
import { filterFiles, showAllFiles, filterFileTree, showAllFileTree, getAllPRFilePaths } from './filter';
import { createEntryButton, injectEntryButton, removeEntryButton } from './ui/entryButton';
import { createSidebar, updateSidebarActiveStep, injectSidebar, removeSidebar } from './ui/sidebar';
import { createStepper, injectStepper, removeStepper } from './ui/stepper';
import {
  computeOrphans,
  createCompletionScreen,
  injectCompletionScreen,
  removeCompletionScreen,
} from './ui/orphans';

interface State {
  walkthrough: WalkthroughData | null;
  currentStep: number;
  active: boolean;
  sidebarEl: HTMLElement | null;
}

const state: State = {
  walkthrough: null,
  currentStep: 1,
  active: false,
  sidebarEl: null,
};

function enterWalkthroughMode(): void {
  if (!state.walkthrough || state.walkthrough.steps.length === 0) return;

  state.active = true;
  state.currentStep = 1;
  removeEntryButton();

  // Create and inject sidebar
  state.sidebarEl = createSidebar(state.walkthrough.steps, state.walkthrough.groups, state.currentStep, {
    onStepClick: goToStep,
    onPrev: () => goToStep(state.currentStep - 1),
    onNext: () => {
      if (state.currentStep === state.walkthrough!.steps.length) {
        showCompletion();
      } else {
        goToStep(state.currentStep + 1);
      }
    },
    onExit: exitWalkthroughMode,
  });
  injectSidebar(state.sidebarEl);

  // Show first step
  showStep(state.walkthrough.steps[0]);
}

function exitWalkthroughMode(): void {
  state.active = false;
  removeSidebar();
  removeStepper();
  removeCompletionScreen();
  showAllFiles();
  showAllFileTree();
  state.sidebarEl = null;

  // Re-inject entry button
  if (state.walkthrough) {
    const btn = createEntryButton(state.walkthrough.steps.length, enterWalkthroughMode);
    injectEntryButton(btn);
  }
}

function goToStep(stepNumber: number): void {
  if (!state.walkthrough) return;

  const step = state.walkthrough.steps.find(s => s.number === stepNumber);
  if (!step) return;

  state.currentStep = stepNumber;
  removeCompletionScreen();
  showStep(step);

  if (state.sidebarEl && state.walkthrough) {
    updateSidebarActiveStep(state.sidebarEl, stepNumber, state.walkthrough.steps.length);
  }
}

function showStep(step: Step): void {
  if (!state.walkthrough) return;

  removeStepper();
  removeCompletionScreen();

  const stepper = createStepper(step, state.walkthrough.steps.length, {
    onPrev: () => goToStep(state.currentStep - 1),
    onNext: () => {
      if (state.currentStep === state.walkthrough!.steps.length) {
        showCompletion();
      } else {
        goToStep(state.currentStep + 1);
      }
    },
  });
  injectStepper(stepper);
  filterFiles(step.files);
  filterFileTree(step.files);
  window.scrollTo({ top: 0 });
}

function showCompletion(): void {
  if (!state.walkthrough) return;

  // Guard against duplicate completion screens
  if (document.querySelector('.prn-completion')) return;

  removeStepper();
  showAllFiles();
  // Then hide all files so completion screen is the focus
  filterFiles([]);
  filterFileTree([]);

  const prFiles = getAllPRFilePaths();
  const orphans = computeOrphans(prFiles, state.walkthrough.allFiles);

  const screen = createCompletionScreen(
    state.walkthrough.steps.length,
    state.walkthrough.allFiles.length,
    orphans,
    {
      onBack: () => goToStep(state.walkthrough!.steps.length),
      onShowAll: exitWalkthroughMode,
    }
  );
  injectCompletionScreen(screen);

  if (state.sidebarEl) {
    // Deselect all steps in sidebar
    state.sidebarEl.querySelectorAll('.prn-sidebar-step').forEach(el => {
      el.classList.remove('prn-sidebar-step--active');
    });
    // Disable Next/Finish button so completion can't be triggered again
    const nextBtn = state.sidebarEl.querySelector('.prn-sidebar-next') as HTMLButtonElement | null;
    if (nextBtn) nextBtn.disabled = true;
  }
}

async function init(): Promise<void> {
  console.log('[PR Walkthrough] init starting');
  const ctx = extractPRContext();
  if (!ctx) {
    console.log('[PR Walkthrough] no PR context found in URL:', window.location.pathname);
    return;
  }
  console.log('[PR Walkthrough] PR context:', ctx);

  if (!isFilesPage()) {
    console.log('[PR Walkthrough] not on files/changes tab, waiting for navigation');
    // Don't fetch walkthrough or inject button, but navigation listeners
    // are already set up and will call init() again when we land on files/changes.
    return;
  }

  const walkthrough = await fetchWalkthrough(ctx);
  if (!walkthrough) {
    console.log('[PR Walkthrough] no walkthrough comment found');
    return;
  }
  if (walkthrough.steps.length === 0) {
    console.log('[PR Walkthrough] walkthrough found but has 0 steps');
    return;
  }
  console.log('[PR Walkthrough] walkthrough found with', walkthrough.steps.length, 'steps:', walkthrough);

  state.walkthrough = walkthrough;

  // Try injecting the button, with retries for SPA navigation where
  // GitHub's toolbar DOM may not have rendered yet.
  await injectWhenReady(walkthrough.steps.length);
}

/**
 * Try to inject the entry button, retrying if the toolbar DOM isn't ready yet.
 * This handles GitHub SPA navigation where pushState fires before React
 * has rendered the toolbar.
 */
async function injectWhenReady(stepCount: number): Promise<void> {
  const btn = createEntryButton(stepCount, enterWalkthroughMode);
  const injected = injectEntryButton(btn);
  if (injected) {
    console.log('[PR Walkthrough] button injected on first try');
    return;
  }

  // Toolbar not in DOM yet — poll with backoff, then fall back to MutationObserver
  console.log('[PR Walkthrough] toolbar not ready, waiting for DOM…');

  const MAX_POLLS = 10;
  const POLL_INTERVAL = 300;
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL);
    // Guard: if we navigated away, stop retrying
    if (!state.walkthrough) return;
    const btn2 = createEntryButton(stepCount, enterWalkthroughMode);
    if (injectEntryButton(btn2)) {
      console.log('[PR Walkthrough] button injected on poll', i + 1);
      return;
    }
  }

  // Still not found — set up a MutationObserver to catch it when it appears
  console.log('[PR Walkthrough] polling exhausted, setting up MutationObserver');
  watchForToolbar(stepCount);
}

let toolbarObserver: MutationObserver | null = null;

function watchForToolbar(stepCount: number): void {
  stopToolbarObserver();

  toolbarObserver = new MutationObserver(() => {
    if (!state.walkthrough) {
      stopToolbarObserver();
      return;
    }
    const btn = createEntryButton(stepCount, enterWalkthroughMode);
    if (injectEntryButton(btn)) {
      console.log('[PR Walkthrough] button injected via MutationObserver');
      stopToolbarObserver();
    }
  });

  toolbarObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function stopToolbarObserver(): void {
  if (toolbarObserver) {
    toolbarObserver.disconnect();
    toolbarObserver = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on page load
init();

// Handle GitHub SPA navigation
// GitHub's React UI uses History API (pushState/replaceState) rather than Turbo.
// Listen for both turbo:load (legacy) and URL changes via popstate + patched pushState.
function onNavigation(): void {
  if (state.active) {
    exitWalkthroughMode();
  }
  state.walkthrough = null;
  stopToolbarObserver();
  removeEntryButton();
  init();
}

document.addEventListener('turbo:load', onNavigation);
window.addEventListener('popstate', onNavigation);

// GitHub patches history.pushState itself and dispatches a custom "pushState" event.
// Our own patch gets overwritten by GitHub, so we listen for their event instead.
// Filter to only real navigations — GitHub fires pushState for scroll tracking too.
let lastUrl = location.href;
window.addEventListener('pushState', () => {
  // Ignore hash-only changes (clicking a file in the tree) that stay on the
  // same base URL. Only trigger onNavigation for real page changes.
  const currentBase = location.href.split('#')[0];
  const lastBase = lastUrl.split('#')[0];

  if (currentBase !== lastBase) {
    lastUrl = location.href;
    onNavigation();
  } else {
    lastUrl = location.href;
  }
});

// Also patch replaceState as a fallback
const origReplaceState = history.replaceState.bind(history);
history.replaceState = function (...args) {
  origReplaceState(...args);
  const currentBase = location.href.split('#')[0];
  const lastBase = lastUrl.split('#')[0];

  if (currentBase !== lastBase) {
    lastUrl = location.href;
    onNavigation();
  } else {
    lastUrl = location.href;
  }
};
