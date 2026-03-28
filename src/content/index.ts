import { NarrativeData, Step } from '../types';
import { extractPRContext, fetchNarrative } from './api';
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
  narrative: NarrativeData | null;
  currentStep: number;
  active: boolean;
  sidebarEl: HTMLElement | null;
}

const state: State = {
  narrative: null,
  currentStep: 1,
  active: false,
  sidebarEl: null,
};

function enterNarrativeMode(): void {
  if (!state.narrative || state.narrative.steps.length === 0) return;

  state.active = true;
  state.currentStep = 1;
  removeEntryButton();

  // Create and inject sidebar
  state.sidebarEl = createSidebar(state.narrative.steps, state.currentStep, {
    onStepClick: goToStep,
    onPrev: () => goToStep(state.currentStep - 1),
    onNext: () => {
      if (state.currentStep === state.narrative!.steps.length) {
        showCompletion();
      } else {
        goToStep(state.currentStep + 1);
      }
    },
    onExit: exitNarrativeMode,
  });
  injectSidebar(state.sidebarEl);

  // Show first step
  showStep(state.narrative.steps[0]);
}

function exitNarrativeMode(): void {
  state.active = false;
  removeSidebar();
  removeStepper();
  removeCompletionScreen();
  showAllFiles();
  state.sidebarEl = null;

  // Re-inject entry button
  if (state.narrative) {
    const btn = createEntryButton(state.narrative.steps.length, enterNarrativeMode);
    injectEntryButton(btn);
  }
}

function goToStep(stepNumber: number): void {
  if (!state.narrative) return;

  const step = state.narrative.steps.find(s => s.number === stepNumber);
  if (!step) return;

  state.currentStep = stepNumber;
  removeCompletionScreen();
  showStep(step);

  if (state.sidebarEl && state.narrative) {
    updateSidebarActiveStep(state.sidebarEl, stepNumber, state.narrative.steps.length);
  }
}

function showStep(step: Step): void {
  if (!state.narrative) return;

  removeStepper();
  removeCompletionScreen();

  const stepper = createStepper(step, state.narrative.steps.length, {
    onPrev: () => goToStep(state.currentStep - 1),
    onNext: () => {
      if (state.currentStep === state.narrative!.steps.length) {
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
  if (!state.narrative) return;

  removeStepper();
  showAllFiles();
  // Then hide all files so completion screen is the focus
  filterFiles([]);

  const prFiles = getAllPRFilePaths();
  const orphans = computeOrphans(prFiles, state.narrative.allFiles);

  const screen = createCompletionScreen(
    state.narrative.steps.length,
    state.narrative.allFiles.length,
    orphans,
    {
      onBack: () => goToStep(state.narrative!.steps.length),
      onShowAll: exitNarrativeMode,
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
  console.log('[PR Narrative] init starting');
  const ctx = extractPRContext();
  if (!ctx) {
    console.log('[PR Narrative] no PR context found in URL:', window.location.pathname);
    return;
  }
  console.log('[PR Narrative] PR context:', ctx);

  const narrative = await fetchNarrative(ctx);
  if (!narrative) {
    console.log('[PR Narrative] no narrative comment found');
    return;
  }
  if (narrative.steps.length === 0) {
    console.log('[PR Narrative] narrative found but has 0 steps');
    return;
  }
  console.log('[PR Narrative] narrative found with', narrative.steps.length, 'steps:', narrative);

  state.narrative = narrative;

  const btn = createEntryButton(narrative.steps.length, enterNarrativeMode);
  const injected = injectEntryButton(btn);
  console.log('[PR Narrative] button injected:', injected);
  if (!injected) {
    console.log('[PR Narrative] could not find injection point, appending to body as fallback');
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
  // Clean up any active narrative mode
  if (state.active) {
    exitNarrativeMode();
  }
  state.narrative = null;
  removeEntryButton();
  init();
});
