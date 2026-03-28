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

export function injectSidebar(sidebar: HTMLElement): void {
  document.body.appendChild(sidebar);
}

export function removeSidebar(): void {
  document.querySelector('.prn-sidebar')?.remove();
}
