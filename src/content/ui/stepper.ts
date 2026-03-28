import { Step } from '../../types';

export interface StepperCallbacks {
  onPrev: () => void;
  onNext: () => void;
}

export function createStepper(
  step: Step,
  totalSteps: number,
  callbacks: StepperCallbacks
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'prn-step-header';

  const inner = document.createElement('div');
  inner.className = 'prn-step-header-inner';

  const info = document.createElement('div');

  const label = document.createElement('div');
  label.className = 'prn-step-label';
  label.textContent = `Step ${step.number} of ${totalSteps}`;
  info.appendChild(label);

  const title = document.createElement('h3');
  title.className = 'prn-step-title';
  title.textContent = step.title;
  info.appendChild(title);

  if (step.description) {
    const desc = document.createElement('p');
    desc.className = 'prn-step-description';
    desc.textContent = step.description;
    info.appendChild(desc);
  }

  const nav = document.createElement('div');
  nav.className = 'prn-step-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'prn-nav-btn';
  prevBtn.innerHTML = '&larr; Prev';
  prevBtn.disabled = step.number === 1;
  prevBtn.addEventListener('click', callbacks.onPrev);
  nav.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'prn-nav-btn prn-nav-btn--next';
  nextBtn.innerHTML = step.number === totalSteps ? 'Finish &rarr;' : 'Next &rarr;';
  nextBtn.addEventListener('click', callbacks.onNext);
  nav.appendChild(nextBtn);

  inner.appendChild(info);
  inner.appendChild(nav);
  header.appendChild(inner);

  return header;
}

export function injectStepper(stepper: HTMLElement): boolean {
  // Insert above the diff container
  const diffContainer = document.querySelector(
    '#diff, [data-target="diff-layout.mainContainer"], .js-diff-progressive-container'
  )?.parentElement;

  if (diffContainer) {
    diffContainer.insertBefore(stepper, diffContainer.firstChild);
    return true;
  }
  return false;
}

export function removeStepper(): void {
  document.querySelector('.prn-step-header')?.remove();
}
