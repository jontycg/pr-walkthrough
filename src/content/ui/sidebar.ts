import { Step } from '../../types';

export interface SidebarCallbacks {
  onStepClick: (stepNumber: number) => void;
  onExit: () => void;
}

export function createSidebar(
  steps: Step[],
  activeStep: number,
  callbacks: SidebarCallbacks
): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'prn-sidebar';

  const title = document.createElement('div');
  title.className = 'prn-sidebar-title';
  title.textContent = 'PR Narrative';
  sidebar.appendChild(title);

  for (const step of steps) {
    const stepEl = document.createElement('div');
    stepEl.className = 'prn-sidebar-step';
    if (step.number === activeStep) {
      stepEl.classList.add('prn-sidebar-step--active');
    }
    stepEl.setAttribute('data-prn-step', String(step.number));

    const number = document.createElement('div');
    number.className = 'prn-sidebar-step-number';
    number.textContent = `Step ${step.number} of ${steps.length}`;
    stepEl.appendChild(number);

    const stepTitle = document.createElement('div');
    stepTitle.className = 'prn-sidebar-step-title';
    stepTitle.textContent = step.title;
    stepEl.appendChild(stepTitle);

    const fileCount = document.createElement('div');
    fileCount.className = 'prn-sidebar-step-files';
    fileCount.textContent = `${step.files.length} file${step.files.length !== 1 ? 's' : ''}`;
    stepEl.appendChild(fileCount);

    stepEl.addEventListener('click', () => callbacks.onStepClick(step.number));
    sidebar.appendChild(stepEl);
  }

  const exitSection = document.createElement('div');
  exitSection.className = 'prn-sidebar-exit';
  const exitBtn = document.createElement('button');
  exitBtn.className = 'prn-exit-btn';
  exitBtn.textContent = 'Exit Narrative';
  exitBtn.addEventListener('click', callbacks.onExit);
  exitSection.appendChild(exitBtn);
  sidebar.appendChild(exitSection);

  return sidebar;
}

export function updateSidebarActiveStep(sidebar: HTMLElement, stepNumber: number): void {
  sidebar.querySelectorAll('.prn-sidebar-step').forEach(el => {
    el.classList.remove('prn-sidebar-step--active');
    if (el.getAttribute('data-prn-step') === String(stepNumber)) {
      el.classList.add('prn-sidebar-step--active');
    }
  });
}

export function injectSidebar(sidebar: HTMLElement): boolean {
  // New GitHub React UI: inject into the PageLayoutContent alongside the file tree pane
  // This matches the same level as GitHub's own file browser
  const pageLayoutContent = document.querySelector('[class*="prc-PageLayout-PageLayoutContent"]');
  if (pageLayoutContent) {
    const contentWrapper = pageLayoutContent.querySelector('[class*="prc-PageLayout-ContentWrapper"]');
    if (contentWrapper) {
      pageLayoutContent.insertBefore(sidebar, contentWrapper);
      return true;
    }
  }

  // Legacy: inject alongside the diff area
  const diffArea =
    document.querySelector('#files.diff-view') ||
    document.querySelector('.js-diff-progressive-container');

  if (diffArea?.parentElement) {
    diffArea.parentElement.classList.add('prn-has-sidebar');
    diffArea.parentElement.insertBefore(sidebar, diffArea);
    return true;
  }

  // Fallback: append to body
  document.body.appendChild(sidebar);
  return false;
}

export function removeSidebar(): void {
  document.querySelector('.prn-has-sidebar')?.classList.remove('prn-has-sidebar');
  document.querySelector('.prn-sidebar')?.remove();
}
