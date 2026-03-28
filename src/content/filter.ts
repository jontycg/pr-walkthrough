interface FileElement {
  element: HTMLElement;
  path: string;
}

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

export function getAllPRFilePaths(): string[] {
  return getAllFileElements().map(f => f.path).filter(Boolean);
}
