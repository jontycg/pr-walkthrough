interface FileElement {
  element: HTMLElement;
  path: string;
}

function getAllFileElements(): FileElement[] {
  const results: FileElement[] = [];

  // Try copilot-diff-entry elements first (newer GitHub DOM)
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

  // Fall back to div.file with data-tagsearch-path
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
