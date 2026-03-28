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
  // GitHub's Files Changed tab has a toolbar/actions area at the top.
  // Look for the diff header area to inject our button.
  const diffHeader = document.querySelector(
    '#diff-header, .pr-review-tools, [data-target="diff-layout.headerContainer"]'
  );
  if (diffHeader) {
    diffHeader.appendChild(button);
    return true;
  }

  // Fallback: look for the file filter actions bar
  const actionsBar = document.querySelector('.diffbar, .diff-view > .d-flex');
  if (actionsBar) {
    actionsBar.appendChild(button);
    return true;
  }

  return false;
}

export function removeEntryButton(): void {
  const existing = document.querySelector('.prn-start-btn');
  if (existing) existing.remove();
}
