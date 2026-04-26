interface FileElement {
  element: HTMLElement;
  path: string;
}

// --- File tree filter state ---
let fileTreeObserver: MutationObserver | null = null;
let currentStepFiles: string[] | null = null;

function getAllFileElements(): FileElement[] {
  const results: FileElement[] = [];

  // New GitHub React UI: div[id^="diff-"] containers with file path in heading link
  // These are wrapped in a plain <div> inside the flex-column gap-3 list,
  // so we target the wrapper to avoid empty gaps when hiding.
  const diffContainers = document.querySelectorAll('div[id^="diff-"][role="region"]');
  if (diffContainers.length > 0) {
    for (const el of diffContainers) {
      const codeEl = el.querySelector('h3 a code');
      if (codeEl) {
        const path = (codeEl.textContent || '').replace(/[\u200E\u200F\u200B]/g, '').trim();
        if (path) {
          // Use the wrapper div (direct child of the diffs list) so hiding
          // removes it from the flex layout and eliminates gap spacing
          const wrapper = el.closest('[data-testid="progressive-diffs-list"] > div');
          results.push({ element: (wrapper || el) as HTMLElement, path });
        }
      }
    }
    return results;
  }

  // Legacy GitHub UI: copilot-diff-entry elements
  const copilotEntries = document.querySelectorAll('copilot-diff-entry[data-file-path]');
  if (copilotEntries.length > 0) {
    for (const el of copilotEntries) {
      results.push({
        element: el as HTMLElement,
        path: el.getAttribute('data-file-path') || '',
      });
    }
    return results;
  }

  // Oldest fallback: div.file with data-tagsearch-path
  const fileElements = document.querySelectorAll('.file[data-tagsearch-path]');
  for (const el of fileElements) {
    results.push({
      element: el as HTMLElement,
      path: el.getAttribute('data-tagsearch-path') || '',
    });
  }

  return results;
}

function fileMatchesList(filePath: string, paths: string[]): boolean {
  return paths.some(p => filePath.endsWith(p));
}

export function filterFiles(stepFiles: string[]): void {
  for (const { element, path } of getAllFileElements()) {
    if (fileMatchesList(path, stepFiles)) {
      element.style.display = '';
    } else {
      element.style.display = 'none';
    }
  }
}

export function showAllFiles(): void {
  for (const { element } of getAllFileElements()) {
    element.style.display = '';
  }
}

/**
 * Apply visibility to all tree items based on the current stepFiles filter.
 * Uses direct JS style manipulation instead of CSS `:has()` selectors so that
 * it survives GitHub's DOM rebuilds on folder collapse/expand.
 */
function applyFileTreeFilter(stepFiles: string[]): void {
  const tree = document.getElementById('pr-file-tree');
  if (!tree) return;

  const allItems = tree.querySelectorAll('li[role="treeitem"]');
  for (const item of allItems) {
    const li = item as HTMLElement;
    // Check if this item has a direct child ul[role="group"] (expanded directory)
    const hasSubtree = Array.from(li.children).some(
      child => child.tagName === 'UL' && child.getAttribute('role') === 'group'
    );

    // For leaf items, show only if the id matches a step file
    if (!hasSubtree) {
      // Could be a file, or a collapsed directory whose subtree was removed.
      // Check file match first, then directory-prefix match.
      const matchesFile = li.id && stepFiles.some(f => f === li.id || f.endsWith('/' + li.id));
      const matchesDir = li.id && stepFiles.some(f => f.startsWith(li.id + '/'));
      li.style.setProperty('display', (matchesFile || matchesDir) ? '' : 'none', 'important');
    } else {
      // Expanded directory — show if any step file is inside it
      const hasMatchingDescendant = li.id && stepFiles.some(f => f.startsWith(li.id + '/'));
      li.style.setProperty('display', hasMatchingDescendant ? '' : 'none', 'important');
    }
  }
}

/**
 * Set up a MutationObserver that re-applies the file tree filter
 * whenever GitHub rebuilds the tree DOM (e.g., on folder collapse/expand).
 * Uses requestAnimationFrame to debounce so we don't interfere with
 * GitHub mid-transition DOM states.
 */
function startFileTreeObserver(stepFiles: string[]): void {
  stopFileTreeObserver();

  const tree = document.getElementById('pr-file-tree');
  if (!tree) return;

  let rafId: number | null = null;

  fileTreeObserver = new MutationObserver(() => {
    if (currentStepFiles === null) return;
    // Debounce: coalesce rapid mutations into a single re-apply
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (currentStepFiles !== null) {
        applyFileTreeFilter(currentStepFiles);
      }
    });
  });

  fileTreeObserver.observe(tree, {
    childList: true,
    subtree: true,
  });
}

function stopFileTreeObserver(): void {
  if (fileTreeObserver) {
    fileTreeObserver.disconnect();
    fileTreeObserver = null;
  }
}

export function filterFileTree(stepFiles: string[]): void {
  removeFileTreeStyle();
  currentStepFiles = stepFiles;
  applyFileTreeFilter(stepFiles);
  startFileTreeObserver(stepFiles);
}

export function showAllFileTree(): void {
  currentStepFiles = null;
  stopFileTreeObserver();
  removeFileTreeStyle();

  // Clear any inline display styles we set
  const tree = document.getElementById('pr-file-tree');
  if (tree) {
    const allItems = tree.querySelectorAll('li[role="treeitem"]');
    for (const item of allItems) {
      (item as HTMLElement).style.removeProperty('display');
    }
  }
}

function removeFileTreeStyle(): void {
  document.getElementById('prn-file-tree-filter')?.remove();
}

export function getAllPRFilePaths(): string[] {
  return getAllFileElements().map(f => f.path).filter(Boolean);
}
