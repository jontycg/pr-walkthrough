export function createEntryButton(
  stepCount: number,
  onClick: () => void
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'prn-start-btn';
  btn.innerHTML = `&#9654; Start PR Narrative (${stepCount} steps)`;
  btn.addEventListener('click', onClick);
  return btn;
}

export function injectEntryButton(button: HTMLElement): boolean {
  // GitHub's PR diff toolbar: .pr-review-tools is the right-side actions area
  const reviewTools = document.querySelector('.pr-review-tools');
  if (reviewTools) {
    reviewTools.prepend(button);
    return true;
  }

  // Fallback: the diffbar itself
  const diffbar = document.querySelector('.diffbar');
  if (diffbar) {
    diffbar.appendChild(button);
    return true;
  }

  // Fallback: the pr-toolbar
  const prToolbar = document.querySelector('.pr-toolbar');
  if (prToolbar) {
    prToolbar.appendChild(button);
    return true;
  }

  return false;
}

export function removeEntryButton(): void {
  const existing = document.querySelector('.prn-start-btn');
  if (existing) existing.remove();
}
