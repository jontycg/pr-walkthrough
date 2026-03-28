import { WalkthroughData, Step } from '../types';
import { extractPRContext, fetchWalkthrough } from './api';
import { filterFiles, showAllFiles, getAllPRFilePaths } from './filter';
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
  fileTreeListener: ((e: Event) => void) | null;
}

const state: State = {
  walkthrough: null,
  currentStep: 1,
  active: false,
  sidebarEl: null,
  fileTreeListener: null,
};

function enterWalkthroughMode(): void {
  if (!state.walkthrough || state.walkthrough.steps.length === 0) return;

  state.active = true;
  state.currentStep = 1;
  removeEntryButton();

  // Create and inject sidebar
  state.sidebarEl = createSidebar(state.walkthrough.steps, state.currentStep, {
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

  // Exit walkthrough if user clicks a file in GitHub's file tree
  const fileTree = document.querySelector('#pr-file-tree');
  if (fileTree) {
    state.fileTreeListener = () => exitWalkthroughMode();
    fileTree.addEventListener('click', state.fileTreeListener);
  }

  // Show first step
  showStep(state.walkthrough.steps[0]);
}

function exitWalkthroughMode(): void {
  state.active = false;
  removeSidebar();
  removeStepper();
  removeCompletionScreen();
  showAllFiles();
  state.sidebarEl = null;

  // Remove file tree click listener
  if (state.fileTreeListener) {
    const fileTree = document.querySelector('#pr-file-tree');
    if (fileTree) fileTree.removeEventListener('click', state.fileTreeListener);
    state.fileTreeListener = null;
  }

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
  window.scrollTo({ top: 0 });
}

function showCompletion(): void {
  if (!state.walkthrough) return;

  removeStepper();
  showAllFiles();
  // Then hide all files so completion screen is the focus
  filterFiles([]);

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

  const btn = createEntryButton(walkthrough.steps.length, enterWalkthroughMode);
  const injected = injectEntryButton(btn);
  console.log('[PR Walkthrough] button injected:', injected);
  if (!injected) {
    console.log('[PR Walkthrough] could not find injection point, appending to body as fallback');
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '9999';
    document.body.appendChild(btn);
  }
}

// Initialize on page load
init();

// Handle GitHub SPA navigation (Turbo)
document.addEventListener('turbo:load', () => {
  // Clean up any active walkthrough mode
  if (state.active) {
    exitWalkthroughMode();
  }
  state.walkthrough = null;
  removeEntryButton();
  init();
});
