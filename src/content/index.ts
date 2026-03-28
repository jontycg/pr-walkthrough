import { NarrativeData, Step } from '../types';
import { extractPRContext, fetchNarrative } from './api';
import { filterFiles, showAllFiles } from './filter';
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

function getAllPRFilePaths(): string[] {
  return Array.from(document.querySelectorAll('.file[data-tagsearch-path]'))
    .map(el => el.getAttribute('data-tagsearch-path') || '')
    .filter(Boolean);
}

function getLayoutContainer(): HTMLElement | null {
  // The main content area that needs to shift when sidebar opens
  return document.querySelector(
    '.repository-content, [data-target="diff-layout.layoutContainer"], .diff-view'
  );
}

function enterNarrativeMode(): void {
  if (!state.narrative || state.narrative.steps.length === 0) return;

  state.active = true;
  state.currentStep = 1;
  removeEntryButton();

  // Shift layout for sidebar
  const layout = getLayoutContainer();
  if (layout) layout.classList.add('prn-layout-shifted');

  // Create and inject sidebar
  state.sidebarEl = createSidebar(state.narrative.steps, state.currentStep, {
    onStepClick: goToStep,
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

  // Restore layout
  const layout = getLayoutContainer();
  if (layout) layout.classList.remove('prn-layout-shifted');

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

  if (state.sidebarEl) {
    updateSidebarActiveStep(state.sidebarEl, stepNumber);
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
  const ctx = extractPRContext();
  if (!ctx) return;

  const narrative = await fetchNarrative(ctx);
  if (!narrative || narrative.steps.length === 0) return;

  state.narrative = narrative;

  const btn = createEntryButton(narrative.steps.length, enterNarrativeMode);
  injectEntryButton(btn);
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
