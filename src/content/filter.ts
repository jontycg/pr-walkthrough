function getAllFileElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll('.file[data-tagsearch-path]')) as HTMLElement[];
}

function fileMatchesList(filePath: string, paths: string[]): boolean {
  return paths.some(p => filePath.endsWith(p));
}

export function filterFiles(stepFiles: string[]): void {
  for (const el of getAllFileElements()) {
    const path = el.getAttribute('data-tagsearch-path') || '';
    if (fileMatchesList(path, stepFiles)) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }
}

export function showAllFiles(): void {
  for (const el of getAllFileElements()) {
    el.style.display = '';
  }
}
