export function computeOrphans(prFiles: string[], walkthroughFiles: string[]): string[] {
  return prFiles.filter(
    prFile => !walkthroughFiles.some(nf => prFile.endsWith(nf))
  );
}

export interface CompletionCallbacks {
  onBack: () => void;
  onShowAll: () => void;
}

export function createCompletionScreen(
  totalSteps: number,
  totalFiles: number,
  orphanFiles: string[],
  callbacks: CompletionCallbacks
): HTMLElement {
  const wrapper = document.createElement('div');

  const completion = document.createElement('div');
  completion.className = 'prn-completion';

  const checkmark = document.createElement('div');
  checkmark.style.fontSize = '20px';
  checkmark.style.marginBottom = '4px';
  checkmark.textContent = '\u2713';
  completion.appendChild(checkmark);

  const title = document.createElement('div');
  title.className = 'prn-completion-title';
  title.textContent = 'Walkthrough complete';
  completion.appendChild(title);

  const summary = document.createElement('p');
  summary.className = 'prn-completion-summary';
  summary.textContent = `You've reviewed all ${totalSteps} steps covering ${totalFiles} files.`;
  completion.appendChild(summary);

  const actions = document.createElement('div');
  actions.className = 'prn-completion-actions';

  const backBtn = document.createElement('button');
  backBtn.className = 'prn-nav-btn';
  backBtn.innerHTML = `&larr; Back to Step ${totalSteps}`;
  backBtn.addEventListener('click', callbacks.onBack);
  actions.appendChild(backBtn);

  const showAllBtn = document.createElement('button');
  showAllBtn.className = 'prn-nav-btn prn-nav-btn--next';
  showAllBtn.textContent = 'Show All Files';
  showAllBtn.addEventListener('click', callbacks.onShowAll);
  actions.appendChild(showAllBtn);

  completion.appendChild(actions);
  wrapper.appendChild(completion);

  if (orphanFiles.length > 0) {
    const orphans = document.createElement('div');
    orphans.className = 'prn-orphans';

    const orphanTitle = document.createElement('div');
    orphanTitle.className = 'prn-orphans-title';
    orphanTitle.textContent = `\u26A0 ${orphanFiles.length} file${orphanFiles.length !== 1 ? 's' : ''} not covered by the walkthrough`;
    orphans.appendChild(orphanTitle);

    for (const file of orphanFiles) {
      const fileEl = document.createElement('div');
      fileEl.className = 'prn-orphan-file';
      fileEl.textContent = file;
      orphans.appendChild(fileEl);
    }

    wrapper.appendChild(orphans);
  }

  return wrapper;
}

export function injectCompletionScreen(screen: HTMLElement): boolean {
  const diffsList = document.querySelector('[data-testid="progressive-diffs-list"]');
  if (diffsList) {
    diffsList.insertBefore(screen, diffsList.firstChild);
    return true;
  }

  const diffView = document.querySelector('#files.diff-view');
  if (diffView) {
    diffView.insertBefore(screen, diffView.firstChild);
    return true;
  }

  const progressive = document.querySelector('.js-diff-progressive-container');
  if (progressive) {
    progressive.parentElement?.insertBefore(screen, progressive);
    return true;
  }

  return false;
}

export function removeCompletionScreen(): void {
  document.querySelector('.prn-completion')?.parentElement?.remove();
}
