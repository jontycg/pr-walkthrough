/**
 * @jest-environment jsdom
 */

import { filterFiles, showAllFiles } from '../src/content/filter';

function createFileElement(path: string): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('file');
  el.setAttribute('data-tagsearch-path', path);
  el.style.display = '';
  return el;
}

function setupDiffContainer(paths: string[]): HTMLElement {
  const container = document.createElement('div');
  container.id = 'diff-container';
  for (const path of paths) {
    container.appendChild(createFileElement(path));
  }
  document.body.innerHTML = '';
  document.body.appendChild(container);
  return container;
}

describe('filterFiles', () => {
  it('hides files not in the step file list', () => {
    setupDiffContainer(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    filterFiles(['src/a.ts']);

    const files = document.querySelectorAll('.file');
    expect((files[0] as HTMLElement).style.display).toBe('');
    expect((files[1] as HTMLElement).style.display).toBe('none');
    expect((files[2] as HTMLElement).style.display).toBe('none');
  });

  it('shows all files that match using suffix matching', () => {
    setupDiffContainer(['packages/app/src/routes/users.ts', 'packages/app/src/models/user.ts']);
    filterFiles(['src/routes/users.ts']);

    const files = document.querySelectorAll('.file');
    expect((files[0] as HTMLElement).style.display).toBe('');
    expect((files[1] as HTMLElement).style.display).toBe('none');
  });

  it('handles empty file list by hiding all files', () => {
    setupDiffContainer(['src/a.ts', 'src/b.ts']);
    filterFiles([]);

    const files = document.querySelectorAll('.file');
    expect((files[0] as HTMLElement).style.display).toBe('none');
    expect((files[1] as HTMLElement).style.display).toBe('none');
  });
});

describe('showAllFiles', () => {
  it('restores all files to visible', () => {
    setupDiffContainer(['src/a.ts', 'src/b.ts']);
    filterFiles(['src/a.ts']);
    showAllFiles();

    const files = document.querySelectorAll('.file');
    expect((files[0] as HTMLElement).style.display).toBe('');
    expect((files[1] as HTMLElement).style.display).toBe('');
  });
});
