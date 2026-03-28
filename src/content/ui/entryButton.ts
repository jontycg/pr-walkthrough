export function createEntryButton(
  stepCount: number,
  onClick: () => void
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'prn-start-btn';
  btn.innerHTML = `&#9654; Start PR Walkthrough (${stepCount} steps)`;
  btn.addEventListener('click', onClick);
  return btn;
}

export function injectEntryButton(button: HTMLElement): boolean {
  // New GitHub React UI: insert before the "Submit review" button area
  const reviewBtn = document.querySelector('[class*="ReviewMenuButton-module"]');
  if (reviewBtn) {
    reviewBtn.parentElement?.insertBefore(button, reviewBtn);
    return true;
  }

  // New GitHub React UI: fallback to toolbar
  const toolbar = document.querySelector('[class*="PullRequestFilesToolbar-module__toolbar"]');
  if (toolbar) {
    toolbar.appendChild(button);
    return true;
  }

  // Legacy: .pr-review-tools
  const reviewTools = document.querySelector('.pr-review-tools');
  if (reviewTools) {
    reviewTools.prepend(button);
    return true;
  }

  // Legacy: .diffbar
  const diffbar = document.querySelector('.diffbar');
  if (diffbar) {
    diffbar.appendChild(button);
    return true;
  }

  return false;
}

export function removeEntryButton(): void {
  const existing = document.querySelector('.prn-start-btn');
  if (existing) existing.remove();
}
