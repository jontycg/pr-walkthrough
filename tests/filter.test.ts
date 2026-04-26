/**
 * @jest-environment jsdom
 */

import { filterFiles, showAllFiles, filterFileTree, showAllFileTree } from '../src/content/filter';

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

// --- File tree filter helpers ---

function setupFileTree(items: { id: string; isDir: boolean; children?: any[] }): HTMLElement {
  const tree = document.createElement('div');
  tree.id = 'pr-file-tree';
  const rootUl = document.createElement('ul');
  rootUl.setAttribute('role', 'group');

  for (const child of items.children || []) {
    rootUl.appendChild(buildTreeItem(child));
  }

  tree.appendChild(rootUl);
  document.body.innerHTML = '';
  document.body.appendChild(tree);
  return tree;
}

function buildTreeItem(item: { id: string; isDir: boolean; children?: any[] }): HTMLElement {
  const li = document.createElement('li');
  li.setAttribute('role', 'treeitem');
  li.id = item.id;
  if (item.isDir && item.children) {
    const ul = document.createElement('ul');
    ul.setAttribute('role', 'group');
    for (const child of item.children) {
      ul.appendChild(buildTreeItem(child));
    }
    li.appendChild(ul);
  }
  return li;
}

describe('filterFileTree', () => {
  it('hides leaf items that do not match the filter', () => {
    setupFileTree({
      id: 'root', isDir: true, children: [
        { id: 'app/a.go', isDir: false },
        { id: 'app/b.go', isDir: false },
        { id: 'app/c.go', isDir: false },
      ]
    });

    filterFileTree(['app/a.go']);

    expect(document.getElementById('app/a.go')!.style.display).not.toBe('none');
    expect(document.getElementById('app/b.go')!.style.display).toBe('none');
    expect(document.getElementById('app/c.go')!.style.display).toBe('none');
  });

  it('shows directory items that contain matching files', () => {
    setupFileTree({
      id: 'root', isDir: true, children: [
        { id: 'app', isDir: true, children: [
          { id: 'app/a.go', isDir: false },
          { id: 'app/b.go', isDir: false },
        ]},
        { id: 'tests', isDir: true, children: [
          { id: 'tests/c.go', isDir: false },
        ]},
      ]
    });

    filterFileTree(['app/a.go']);

    expect(document.getElementById('app')!.style.display).not.toBe('none');
    expect(document.getElementById('tests')!.style.display).toBe('none');
  });

  it('hides all items when filter is empty', () => {
    setupFileTree({
      id: 'root', isDir: true, children: [
        { id: 'app/a.go', isDir: false },
        { id: 'app', isDir: true, children: [
          { id: 'app/b.go', isDir: false },
        ]},
      ]
    });

    filterFileTree([]);

    const items = document.querySelectorAll('#pr-file-tree li[role="treeitem"]');
    for (const item of items) {
      expect((item as HTMLElement).style.display).toBe('none');
    }
  });

  it('shows collapsed directory whose subtree was removed if it logically contains a matching file', () => {
    // Simulate a collapsed dir: no ul[role="group"] child, but id matches a prefix
    setupFileTree({
      id: 'root', isDir: true, children: [
        { id: 'app', isDir: true, children: [] },
      ]
    });

    // 'app' has no subtree children in DOM (collapsed), but stepFiles has app/a.go
    filterFileTree(['app/a.go']);

    // 'app' should still be visible because app/a.go starts with 'app/'
    expect(document.getElementById('app')!.style.display).not.toBe('none');
  });

  it('re-applies filter when DOM is mutated (simulating folder expand)', (done) => {
    setupFileTree({
      id: 'root', isDir: true, children: [
        { id: 'app', isDir: true, children: [] },
      ]
    });

    filterFileTree(['app/a.go']);

    const appDir = document.getElementById('app')!;
    expect(appDir.style.display).not.toBe('none');

    // Simulate GitHub expanding the folder: add a child item
    const group = appDir.querySelector('ul[role="group"]')!;
    const newFile = document.createElement('li');
    newFile.setAttribute('role', 'treeitem');
    newFile.id = 'app/a.go';
    group.appendChild(newFile);

    // The MutationObserver should fire and re-apply the filter
    setTimeout(() => {
      expect(newFile.style.display).not.toBe('none');
      done();
    }, 100);
  });
});

describe('showAllFileTree', () => {
  it('restores all tree items to visible', () => {
    setupFileTree({
      id: 'root', isDir: true, children: [
        { id: 'app/a.go', isDir: false },
        { id: 'app/b.go', isDir: false },
      ]
    });

    filterFileTree(['app/a.go']);
    showAllFileTree();

    const items = document.querySelectorAll('#pr-file-tree li[role="treeitem"]');
    for (const item of items) {
      expect((item as HTMLElement).style.display).not.toBe('none');
    }
  });
});
