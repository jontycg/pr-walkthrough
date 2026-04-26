import { Group, Step } from '../../types';

export interface SidebarCallbacks {
  onStepClick: (stepNumber: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
}

function createStepElement(
  step: Step,
  activeStep: number,
  totalSteps: number,
  callbacks: SidebarCallbacks,
): HTMLElement {
  const stepEl = document.createElement('div');
  stepEl.className = 'prn-sidebar-step';
  if (step.group) stepEl.classList.add('prn-sidebar-step--grouped');
  if (step.number === activeStep) stepEl.classList.add('prn-sidebar-step--active');
  stepEl.setAttribute('data-prn-step', String(step.number));

  const number = document.createElement('div');
  number.className = 'prn-sidebar-step-number';
  number.textContent = `Step ${step.number} of ${totalSteps}`;
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
  return stepEl;
}

export function createSidebar(
  steps: Step[],
  groups: Group[],
  activeStep: number,
  callbacks: SidebarCallbacks
): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'prn-sidebar';

  const title = document.createElement('div');
  title.className = 'prn-sidebar-title';
  title.textContent = 'PR Walkthrough';
  sidebar.appendChild(title);

  if (groups.length > 0) {
    // Grouped mode: render group headers with indented steps
    for (const group of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'prn-sidebar-group';

      const groupTitle = document.createElement('div');
      groupTitle.className = 'prn-sidebar-group-title';
      groupTitle.textContent = group.title;
      groupEl.appendChild(groupTitle);

      if (group.description) {
        const groupDesc = document.createElement('div');
        groupDesc.className = 'prn-sidebar-group-desc';
        groupDesc.textContent = group.description;
        groupEl.appendChild(groupDesc);
      }

      sidebar.appendChild(groupEl);

      // Render steps belonging to this group
      for (const step of steps.filter(s => s.group === group)) {
        sidebar.appendChild(createStepElement(step, activeStep, steps.length, callbacks));
      }
    }
  } else {
    // Flat mode: render steps directly
    for (const step of steps) {
      sidebar.appendChild(createStepElement(step, activeStep, steps.length, callbacks));
    }
  }

  const navSection = document.createElement('div');
  navSection.className = 'prn-sidebar-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'prn-nav-btn prn-sidebar-prev';
  prevBtn.innerHTML = '&larr; Prev';
  prevBtn.disabled = activeStep === 1;
  prevBtn.addEventListener('click', callbacks.onPrev);
  navSection.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'prn-nav-btn prn-nav-btn--next prn-sidebar-next';
  nextBtn.innerHTML = activeStep === steps.length ? 'Finish &rarr;' : 'Next &rarr;';
  nextBtn.addEventListener('click', callbacks.onNext);
  navSection.appendChild(nextBtn);

  sidebar.appendChild(navSection);

  const exitSection = document.createElement('div');
  exitSection.className = 'prn-sidebar-exit';
  const exitBtn = document.createElement('button');
  exitBtn.className = 'prn-exit-btn';
  exitBtn.textContent = 'Exit Walkthrough';
  exitBtn.addEventListener('click', callbacks.onExit);
  exitSection.appendChild(exitBtn);
  sidebar.appendChild(exitSection);

  return sidebar;
}

export function updateSidebarActiveStep(sidebar: HTMLElement, stepNumber: number, totalSteps: number): void {
  sidebar.querySelectorAll('.prn-sidebar-step').forEach(el => {
    el.classList.remove('prn-sidebar-step--active');
    if (el.getAttribute('data-prn-step') === String(stepNumber)) {
      el.classList.add('prn-sidebar-step--active');
    }
  });

  const prevBtn = sidebar.querySelector('.prn-sidebar-prev') as HTMLButtonElement | null;
  const nextBtn = sidebar.querySelector('.prn-sidebar-next') as HTMLButtonElement | null;
  if (prevBtn) prevBtn.disabled = stepNumber === 1;
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.innerHTML = stepNumber === totalSteps ? 'Finish &rarr;' : 'Next &rarr;';
  }
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
