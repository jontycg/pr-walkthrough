# PR Narrative Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome + Firefox browser extension that transforms GitHub PR reviews into guided, step-by-step tours by filtering the native diff view based on a structured narrative comment.

**Architecture:** Content script only — no background script, no framework. Fetches the narrative comment via GitHub API using session cookies, parses it into steps, then injects a sidebar + stepper UI and filters GitHub's native file diffs by toggling `display` on `div.file` elements. All GitHub functionality (commenting, suggestions) is preserved.

**Tech Stack:** TypeScript, esbuild, Jest + jsdom for testing, WebExtension Manifest V3

**Spec:** `docs/superpowers/specs/2026-03-28-pr-narrative-extension-design.md`

---

## File Map

```
pr-narrative/
├── src/
│   ├── types.ts                  # Step, NarrativeData, PRContext types
│   ├── content/
│   │   ├── parser.ts             # Parses narrative markdown into Step[]
│   │   ├── api.ts                # Fetches PR comments, extracts narrative
│   │   ├── filter.ts             # Shows/hides div.file elements by step (no orphan logic)
│   │   ├── ui/
│   │   │   ├── sidebar.ts        # Step list sidebar component
│   │   │   ├── stepper.ts        # Step header with next/prev + description
│   │   │   ├── orphans.ts        # Completion screen with orphan detection
│   │   │   └── entryButton.ts    # "Start PR Narrative" button
│   │   ├── styles.css            # All injected styles (prn- prefixed)
│   │   └── index.ts              # Entry point — SPA handling, bootstrap
├── manifest.chrome.json
├── manifest.firefox.json
├── package.json
├── tsconfig.json
├── build.mjs                     # esbuild build script
├── tests/
│   ├── parser.test.ts
│   ├── filter.test.ts
│   └── orphans.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `build.mjs`
- Create: `manifest.chrome.json`
- Create: `manifest.firefox.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/jonty/Documents/repos/pr-narrative
npm init -y
```

Then edit `package.json` to set the project metadata and scripts:

```json
{
  "name": "pr-narrative",
  "version": "0.1.0",
  "description": "Browser extension that transforms PR reviews into guided tours",
  "private": true,
  "scripts": {
    "build": "node build.mjs",
    "dev": "node build.mjs --watch",
    "test": "jest"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install --save-dev typescript esbuild jest ts-jest @types/jest jsdom @types/jsdom
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "build",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "tests"]
}
```

- [ ] **Step 4: Create build.mjs**

This script bundles `src/content/index.ts` into a single file and copies the correct manifest + CSS into `build/chrome/` and `build/firefox/`.

```javascript
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  outfile: 'build/content.js',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
};

async function build() {
  await esbuild.build(buildOptions);

  // Copy to Chrome build
  mkdirSync('build/chrome', { recursive: true });
  cpSync('build/content.js', 'build/chrome/content.js');
  cpSync('build/content.js.map', 'build/chrome/content.js.map');
  cpSync('src/content/styles.css', 'build/chrome/styles.css');
  cpSync('manifest.chrome.json', 'build/chrome/manifest.json');

  // Copy to Firefox build
  mkdirSync('build/firefox', { recursive: true });
  cpSync('build/content.js', 'build/firefox/content.js');
  cpSync('build/content.js.map', 'build/firefox/content.js.map');
  cpSync('src/content/styles.css', 'build/firefox/styles.css');
  cpSync('manifest.firefox.json', 'build/firefox/manifest.json');

  console.log('Build complete: build/chrome/ and build/firefox/');
}

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build();
}
```

- [ ] **Step 5: Create manifest.chrome.json**

```json
{
  "manifest_version": 3,
  "name": "PR Narrative",
  "version": "0.1.0",
  "description": "Guided tours through GitHub pull requests",
  "content_scripts": [
    {
      "matches": ["https://github.com/*/pull/*/files*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": [],
  "host_permissions": ["https://github.com/*", "https://api.github.com/*"]
}
```

- [ ] **Step 6: Create manifest.firefox.json**

```json
{
  "manifest_version": 3,
  "name": "PR Narrative",
  "version": "0.1.0",
  "description": "Guided tours through GitHub pull requests",
  "content_scripts": [
    {
      "matches": ["https://github.com/*/pull/*/files*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": [],
  "host_permissions": ["https://github.com/*", "https://api.github.com/*"],
  "browser_specific_settings": {
    "gecko": {
      "id": "pr-narrative@example.com"
    }
  }
}
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
build/
.superpowers/
*.js.map
```

- [ ] **Step 8: Create Jest config**

Add to `package.json`:

```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "jsdom",
    "roots": ["<rootDir>/tests"]
  }
}
```

- [ ] **Step 9: Create placeholder entry point so build works**

Create `src/content/index.ts`:

```typescript
console.log('PR Narrative loaded');
```

Create `src/content/styles.css`:

```css
/* PR Narrative styles — all classes prefixed with prn- */
```

- [ ] **Step 10: Verify build works**

```bash
npm run build
```

Expected: `build/chrome/` and `build/firefox/` directories with `content.js`, `styles.css`, and `manifest.json` in each.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json build.mjs manifest.chrome.json manifest.firefox.json .gitignore src/content/index.ts src/content/styles.css
git commit -m "scaffold: project setup with TypeScript, esbuild, and dual browser manifests"
```

---

### Task 2: Types and Comment Parser

**Files:**
- Create: `src/types.ts`
- Create: `src/content/parser.ts`
- Create: `tests/parser.test.ts`

- [ ] **Step 1: Write the types**

Create `src/types.ts`:

```typescript
export interface Step {
  /** Display number (1-indexed, assigned from document order) */
  number: number;
  /** Step title from ### heading */
  title: string;
  /** Description lines between heading and file list */
  description: string;
  /** File paths extracted from backtick-wrapped list items */
  files: string[];
}

export interface NarrativeData {
  /** All steps in document order */
  steps: Step[];
  /** All unique file paths across all steps */
  allFiles: string[];
}

export interface PRContext {
  owner: string;
  repo: string;
  pullNumber: number;
}
```

- [ ] **Step 2: Write parser tests**

Create `tests/parser.test.ts`:

```typescript
import { parseNarrativeComment, isNarrativeComment } from '../src/content/parser';

describe('isNarrativeComment', () => {
  it('returns true for comment starting with ## PR Narrative', () => {
    expect(isNarrativeComment('## PR Narrative\n\n### Step one\n- `file.ts`')).toBe(true);
  });

  it('returns true with leading whitespace', () => {
    expect(isNarrativeComment('  ## PR Narrative\n')).toBe(true);
  });

  it('returns false for non-narrative comments', () => {
    expect(isNarrativeComment('This is a regular comment')).toBe(false);
    expect(isNarrativeComment('# PR Narrative')).toBe(false);
    expect(isNarrativeComment('### PR Narrative')).toBe(false);
  });
});

describe('parseNarrativeComment', () => {
  it('parses a single step with files', () => {
    const comment = `## PR Narrative

### API route
The entry point.
- \`src/routes/users.ts\`
- \`src/controllers/userController.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toEqual({
      number: 1,
      title: 'API route',
      description: 'The entry point.',
      files: ['src/routes/users.ts', 'src/controllers/userController.ts'],
    });
    expect(result.allFiles).toEqual(['src/routes/users.ts', 'src/controllers/userController.ts']);
  });

  it('parses multiple steps in document order', () => {
    const comment = `## PR Narrative

### Controllers
- \`src/controllers/a.ts\`

### Services
The business logic.
- \`src/services/b.ts\`

### Tests
- \`tests/a.test.ts\`
- \`tests/b.test.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].number).toBe(1);
    expect(result.steps[0].title).toBe('Controllers');
    expect(result.steps[1].number).toBe(2);
    expect(result.steps[1].title).toBe('Services');
    expect(result.steps[1].description).toBe('The business logic.');
    expect(result.steps[2].number).toBe(3);
    expect(result.steps[2].title).toBe('Tests');
    expect(result.steps[2].files).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
  });

  it('handles steps with no description', () => {
    const comment = `## PR Narrative

### Renames
- \`src/old.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps[0].description).toBe('');
    expect(result.steps[0].files).toEqual(['src/old.ts']);
  });

  it('handles multi-line descriptions', () => {
    const comment = `## PR Narrative

### Complex change
This is a longer explanation.
It spans multiple lines.
Pay attention to the error handling.
- \`src/complex.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps[0].description).toBe(
      'This is a longer explanation.\nIt spans multiple lines.\nPay attention to the error handling.'
    );
  });

  it('returns empty steps for narrative with no ### headings', () => {
    const comment = `## PR Narrative

Just some text without steps.`;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(0);
    expect(result.allFiles).toEqual([]);
  });

  it('handles steps with no files', () => {
    const comment = `## PR Narrative

### Overview
This step is just context, no files.

### Actual changes
- \`src/foo.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].files).toEqual([]);
    expect(result.steps[1].files).toEqual(['src/foo.ts']);
  });

  it('collects allFiles as unique set across steps', () => {
    const comment = `## PR Narrative

### Step A
- \`src/shared.ts\`
- \`src/a.ts\`

### Step B
- \`src/shared.ts\`
- \`src/b.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.allFiles).toEqual(['src/shared.ts', 'src/a.ts', 'src/b.ts']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest tests/parser.test.ts
```

Expected: FAIL — `parser.ts` doesn't exist yet.

- [ ] **Step 4: Implement the parser**

Create `src/content/parser.ts`:

```typescript
import { Step, NarrativeData } from '../types';

const NARRATIVE_PREFIX = /^\s*## PR Narrative\s*$/m;
const STEP_HEADING = /^### (.+)$/;
const FILE_ITEM = /^- `([^`]+)`/;

export function isNarrativeComment(body: string): boolean {
  return NARRATIVE_PREFIX.test(body);
}

export function parseNarrativeComment(body: string): NarrativeData {
  const lines = body.split('\n');
  const steps: Step[] = [];
  let currentStep: { title: string; descriptionLines: string[]; files: string[] } | null = null;
  let pastHeader = false;

  for (const line of lines) {
    // Skip until we're past the ## PR Narrative header
    if (!pastHeader) {
      if (NARRATIVE_PREFIX.test(line)) {
        pastHeader = true;
      }
      continue;
    }

    const stepMatch = line.match(STEP_HEADING);
    if (stepMatch) {
      // Save previous step
      if (currentStep) {
        steps.push(finalizeStep(currentStep, steps.length + 1));
      }
      currentStep = { title: stepMatch[1].trim(), descriptionLines: [], files: [] };
      continue;
    }

    if (!currentStep) continue;

    const fileMatch = line.match(FILE_ITEM);
    if (fileMatch) {
      currentStep.files.push(fileMatch[1]);
    } else if (line.trim() !== '') {
      // Only add to description if we haven't started the file list yet
      if (currentStep.files.length === 0) {
        currentStep.descriptionLines.push(line.trim());
      }
    }
  }

  // Save last step
  if (currentStep) {
    steps.push(finalizeStep(currentStep, steps.length + 1));
  }

  const allFilesSet = new Set<string>();
  for (const step of steps) {
    for (const file of step.files) {
      allFilesSet.add(file);
    }
  }

  return {
    steps,
    allFiles: Array.from(allFilesSet),
  };
}

function finalizeStep(
  raw: { title: string; descriptionLines: string[]; files: string[] },
  number: number
): Step {
  return {
    number,
    title: raw.title,
    description: raw.descriptionLines.join('\n'),
    files: raw.files,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/parser.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/content/parser.ts tests/parser.test.ts
git commit -m "feat: add types and narrative comment parser with tests"
```

---

### Task 3: GitHub API Client

**Files:**
- Create: `src/content/api.ts`

This module is thin — it fetches comments and finds the narrative. No unit tests here since it's a `fetch` wrapper; it will be tested via manual integration testing against real PRs.

- [ ] **Step 1: Implement the API client**

Create `src/content/api.ts`:

```typescript
import { PRContext, NarrativeData } from '../types';
import { isNarrativeComment, parseNarrativeComment } from './parser';

export function extractPRContext(): PRContext | null {
  // URL pattern: github.com/:owner/:repo/pull/:number/files
  const match = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/files/
  );
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    pullNumber: parseInt(match[3], 10),
  };
}

interface GitHubComment {
  id: number;
  body: string;
}

export async function fetchNarrative(ctx: PRContext): Promise<NarrativeData | null> {
  const url = `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.pullNumber}/comments`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) return null;

  const comments: GitHubComment[] = await response.json();

  // Find the most recent narrative comment (highest ID)
  let narrativeBody: string | null = null;
  for (const comment of comments) {
    if (isNarrativeComment(comment.body)) {
      narrativeBody = comment.body;
    }
  }

  if (!narrativeBody) return null;

  return parseNarrativeComment(narrativeBody);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/api.ts
git commit -m "feat: add GitHub API client for fetching narrative comments"
```

---

### Task 4: Diff Filter

**Files:**
- Create: `src/content/filter.ts`
- Create: `tests/filter.test.ts`

- [ ] **Step 1: Write filter tests**

Create `tests/filter.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/filter.test.ts
```

Expected: FAIL — `filter.ts` doesn't exist yet.

- [ ] **Step 3: Implement the filter**

Create `src/content/filter.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/filter.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/filter.ts tests/filter.test.ts
git commit -m "feat: add diff filter with suffix matching and orphan detection"
```

---

### Task 5: CSS Styles

**Files:**
- Modify: `src/content/styles.css`

All styles are namespaced with `prn-` to avoid collisions with GitHub's CSS.

- [ ] **Step 1: Write the styles**

Replace `src/content/styles.css` with:

```css
/* PR Narrative — all classes prefixed with prn- */

/* Entry button */
.prn-start-btn {
  background: #238636;
  color: #ffffff;
  border: none;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
}
.prn-start-btn:hover {
  background: #2ea043;
}

/* Sidebar */
.prn-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 260px;
  height: 100vh;
  background: #0d1117;
  border-right: 1px solid #30363d;
  overflow-y: auto;
  z-index: 100;
  padding: 16px 12px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
}
.prn-sidebar-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #8b949e;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.prn-sidebar-step {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  border-left: 3px solid transparent;
}
.prn-sidebar-step:hover {
  background: #161b22;
}
.prn-sidebar-step--active {
  background: rgba(31, 111, 235, 0.13);
  border-left-color: #58a6ff;
}
.prn-sidebar-step-number {
  font-size: 12px;
  color: #8b949e;
}
.prn-sidebar-step--active .prn-sidebar-step-number {
  color: #58a6ff;
  font-weight: 600;
}
.prn-sidebar-step-title {
  font-size: 13px;
  color: #c9d1d9;
  margin-top: 2px;
}
.prn-sidebar-step--active .prn-sidebar-step-title {
  color: #e6edf3;
}
.prn-sidebar-step-files {
  font-size: 11px;
  color: #8b949e;
  margin-top: 2px;
}
.prn-sidebar-exit {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #30363d;
}
.prn-exit-btn {
  background: transparent;
  color: #f85149;
  border: 1px solid rgba(248, 81, 73, 0.2);
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  width: 100%;
  font-family: inherit;
}
.prn-exit-btn:hover {
  background: rgba(248, 81, 73, 0.1);
}

/* Step header */
.prn-step-header {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
}
.prn-step-header-inner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.prn-step-label {
  font-size: 12px;
  color: #58a6ff;
  font-weight: 600;
  text-transform: uppercase;
}
.prn-step-title {
  font-size: 16px;
  color: #e6edf3;
  margin: 4px 0 0 0;
  font-weight: 600;
}
.prn-step-description {
  font-size: 13px;
  color: #8b949e;
  margin-top: 6px;
  line-height: 1.5;
}
.prn-step-nav {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}
.prn-nav-btn {
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.prn-nav-btn:hover:not(:disabled) {
  background: #30363d;
}
.prn-nav-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.prn-nav-btn--next {
  background: #238636;
  color: #ffffff;
  border-color: #238636;
}
.prn-nav-btn--next:hover:not(:disabled) {
  background: #2ea043;
}

/* Completion screen */
.prn-completion {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 24px;
  text-align: center;
  margin-bottom: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
}
.prn-completion-title {
  font-size: 16px;
  color: #e6edf3;
  font-weight: 600;
}
.prn-completion-summary {
  font-size: 13px;
  color: #8b949e;
  margin-top: 8px;
}
.prn-completion-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}

/* Orphan warning */
.prn-orphans {
  background: rgba(248, 81, 73, 0.07);
  border: 1px solid rgba(248, 81, 73, 0.2);
  border-radius: 6px;
  padding: 12px 16px;
  margin-top: 16px;
  text-align: left;
}
.prn-orphans-title {
  font-size: 13px;
  color: #f85149;
  font-weight: 600;
  margin-bottom: 8px;
}
.prn-orphan-file {
  padding: 4px 8px;
  background: #0d1117;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: #c9d1d9;
  margin-bottom: 4px;
}

/* Page layout adjustment when sidebar is open */
.prn-layout-shifted {
  margin-left: 272px !important;
}
```

- [ ] **Step 2: Verify build still works**

```bash
npm run build
```

Expected: builds without errors.

- [ ] **Step 3: Commit**

```bash
git add src/content/styles.css
git commit -m "feat: add PR Narrative CSS styles with prn- namespace"
```

---

### Task 6: Entry Button UI

**Files:**
- Create: `src/content/ui/entryButton.ts`

- [ ] **Step 1: Implement the entry button**

Create `src/content/ui/entryButton.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/content/ui/entryButton.ts
git commit -m "feat: add entry button component for Files Changed toolbar"
```

---

### Task 7: Sidebar UI

**Files:**
- Create: `src/content/ui/sidebar.ts`

- [ ] **Step 1: Implement the sidebar**

Create `src/content/ui/sidebar.ts`:

```typescript
import { Step } from '../../types';

export interface SidebarCallbacks {
  onStepClick: (stepNumber: number) => void;
  onExit: () => void;
}

export function createSidebar(
  steps: Step[],
  activeStep: number,
  callbacks: SidebarCallbacks
): HTMLElement {
  const sidebar = document.createElement('div');
  sidebar.className = 'prn-sidebar';

  const title = document.createElement('div');
  title.className = 'prn-sidebar-title';
  title.textContent = 'PR Narrative';
  sidebar.appendChild(title);

  for (const step of steps) {
    const stepEl = document.createElement('div');
    stepEl.className = 'prn-sidebar-step';
    if (step.number === activeStep) {
      stepEl.classList.add('prn-sidebar-step--active');
    }
    stepEl.setAttribute('data-prn-step', String(step.number));

    const number = document.createElement('div');
    number.className = 'prn-sidebar-step-number';
    number.textContent = `Step ${step.number} of ${steps.length}`;
    stepEl.appendChild(number);

    const stepTitle = document.createElement('div');
    stepTitle.className = 'prn-sidebar-step-title';
    stepTitle.textContent = step.title;
    stepEl.appendChild(stepTitle);

    const fileCount = document.createElement('div');
    fileCount.className = 'prn-sidebar-step-files';
    fileCount.textContent = `${step.files.length} file${step.files.length !== 1 ? 's' : ''}`;
    stepEl.appendChild(fileCount);

    stepEl.addEventListener('click', () => callbacks.onStepClick(step.number));
    sidebar.appendChild(stepEl);
  }

  const exitSection = document.createElement('div');
  exitSection.className = 'prn-sidebar-exit';
  const exitBtn = document.createElement('button');
  exitBtn.className = 'prn-exit-btn';
  exitBtn.textContent = 'Exit Narrative';
  exitBtn.addEventListener('click', callbacks.onExit);
  exitSection.appendChild(exitBtn);
  sidebar.appendChild(exitSection);

  return sidebar;
}

export function updateSidebarActiveStep(sidebar: HTMLElement, stepNumber: number): void {
  sidebar.querySelectorAll('.prn-sidebar-step').forEach(el => {
    el.classList.remove('prn-sidebar-step--active');
    if (el.getAttribute('data-prn-step') === String(stepNumber)) {
      el.classList.add('prn-sidebar-step--active');
    }
  });
}

export function injectSidebar(sidebar: HTMLElement): void {
  document.body.appendChild(sidebar);
}

export function removeSidebar(): void {
  document.querySelector('.prn-sidebar')?.remove();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/ui/sidebar.ts
git commit -m "feat: add sidebar component with step list and exit button"
```

---

### Task 8: Stepper (Step Header) UI

**Files:**
- Create: `src/content/ui/stepper.ts`

- [ ] **Step 1: Implement the stepper**

Create `src/content/ui/stepper.ts`:

```typescript
import { Step } from '../../types';

export interface StepperCallbacks {
  onPrev: () => void;
  onNext: () => void;
}

export function createStepper(
  step: Step,
  totalSteps: number,
  callbacks: StepperCallbacks
): HTMLElement {
  const header = document.createElement('div');
  header.className = 'prn-step-header';

  const inner = document.createElement('div');
  inner.className = 'prn-step-header-inner';

  const info = document.createElement('div');

  const label = document.createElement('div');
  label.className = 'prn-step-label';
  label.textContent = `Step ${step.number} of ${totalSteps}`;
  info.appendChild(label);

  const title = document.createElement('h3');
  title.className = 'prn-step-title';
  title.textContent = step.title;
  info.appendChild(title);

  if (step.description) {
    const desc = document.createElement('p');
    desc.className = 'prn-step-description';
    desc.textContent = step.description;
    info.appendChild(desc);
  }

  const nav = document.createElement('div');
  nav.className = 'prn-step-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'prn-nav-btn';
  prevBtn.innerHTML = '&larr; Prev';
  prevBtn.disabled = step.number === 1;
  prevBtn.addEventListener('click', callbacks.onPrev);
  nav.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'prn-nav-btn prn-nav-btn--next';
  nextBtn.innerHTML = step.number === totalSteps ? 'Finish &rarr;' : 'Next &rarr;';
  nextBtn.addEventListener('click', callbacks.onNext);
  nav.appendChild(nextBtn);

  inner.appendChild(info);
  inner.appendChild(nav);
  header.appendChild(inner);

  return header;
}

export function injectStepper(stepper: HTMLElement): boolean {
  // Insert above the diff container
  const diffContainer = document.querySelector(
    '#diff, [data-target="diff-layout.mainContainer"], .js-diff-progressive-container'
  )?.parentElement;

  if (diffContainer) {
    diffContainer.insertBefore(stepper, diffContainer.firstChild);
    return true;
  }
  return false;
}

export function removeStepper(): void {
  document.querySelector('.prn-step-header')?.remove();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/ui/stepper.ts
git commit -m "feat: add stepper component with step header and next/prev navigation"
```

---

### Task 9: Completion Screen with Orphan Detection

**Files:**
- Create: `src/content/ui/orphans.ts`
- Create: `tests/orphans.test.ts`

- [ ] **Step 1: Write orphan detection test**

Create `tests/orphans.test.ts`:

```typescript
import { computeOrphans } from '../src/content/ui/orphans';

describe('computeOrphans', () => {
  it('returns files not covered by narrative', () => {
    const prFiles = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
    const narrativeFiles = ['src/a.ts', 'src/b.ts'];
    expect(computeOrphans(prFiles, narrativeFiles)).toEqual(['src/c.ts']);
  });

  it('returns empty when all files covered', () => {
    const prFiles = ['src/a.ts', 'src/b.ts'];
    const narrativeFiles = ['src/a.ts', 'src/b.ts'];
    expect(computeOrphans(prFiles, narrativeFiles)).toEqual([]);
  });

  it('uses suffix matching', () => {
    const prFiles = ['packages/app/src/a.ts'];
    const narrativeFiles = ['src/a.ts'];
    expect(computeOrphans(prFiles, narrativeFiles)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/orphans.test.ts
```

Expected: FAIL — `orphans.ts` doesn't exist yet.

- [ ] **Step 3: Implement completion screen and orphan detection**

Create `src/content/ui/orphans.ts`:

```typescript
export function computeOrphans(prFiles: string[], narrativeFiles: string[]): string[] {
  return prFiles.filter(
    prFile => !narrativeFiles.some(nf => prFile.endsWith(nf))
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
  title.textContent = 'Narrative complete';
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
    orphanTitle.textContent = `\u26A0 ${orphanFiles.length} file${orphanFiles.length !== 1 ? 's' : ''} not covered by the narrative`;
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
  const diffContainer = document.querySelector(
    '#diff, [data-target="diff-layout.mainContainer"], .js-diff-progressive-container'
  )?.parentElement;

  if (diffContainer) {
    diffContainer.insertBefore(screen, diffContainer.firstChild);
    return true;
  }
  return false;
}

export function removeCompletionScreen(): void {
  document.querySelector('.prn-completion')?.parentElement?.remove();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/orphans.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/ui/orphans.ts tests/orphans.test.ts
git commit -m "feat: add completion screen with orphan file detection"
```

---

### Task 10: Main Entry Point — Wiring It All Together

**Files:**
- Modify: `src/content/index.ts`

This is the orchestration layer that ties all the modules together. It manages state (current step, narrative mode on/off) and coordinates the UI components.

- [ ] **Step 1: Implement the entry point**

Replace `src/content/index.ts` with:

```typescript
import { NarrativeData, Step } from '../types';
import { extractPRContext, fetchNarrative } from './api';
import { filterFiles, showAllFiles } from './filter';
import { createEntryButton, injectEntryButton, removeEntryButton } from './ui/entryButton';
import { createSidebar, updateSidebarActiveStep, injectSidebar, removeSidebar } from './ui/sidebar';
import { createStepper, injectStepper, removeStepper } from './ui/stepper';
import {
  computeOrphans,
  createCompletionScreen,
  injectCompletionScreen,
  removeCompletionScreen,
} from './ui/orphans';

interface State {
  narrative: NarrativeData | null;
  currentStep: number;
  active: boolean;
  sidebarEl: HTMLElement | null;
}

const state: State = {
  narrative: null,
  currentStep: 1,
  active: false,
  sidebarEl: null,
};

function getAllPRFilePaths(): string[] {
  return Array.from(document.querySelectorAll('.file[data-tagsearch-path]'))
    .map(el => el.getAttribute('data-tagsearch-path') || '')
    .filter(Boolean);
}

function getLayoutContainer(): HTMLElement | null {
  // The main content area that needs to shift when sidebar opens
  return document.querySelector(
    '.repository-content, [data-target="diff-layout.layoutContainer"], .diff-view'
  );
}

function enterNarrativeMode(): void {
  if (!state.narrative || state.narrative.steps.length === 0) return;

  state.active = true;
  state.currentStep = 1;
  removeEntryButton();

  // Shift layout for sidebar
  const layout = getLayoutContainer();
  if (layout) layout.classList.add('prn-layout-shifted');

  // Create and inject sidebar
  state.sidebarEl = createSidebar(state.narrative.steps, state.currentStep, {
    onStepClick: goToStep,
    onExit: exitNarrativeMode,
  });
  injectSidebar(state.sidebarEl);

  // Show first step
  showStep(state.narrative.steps[0]);
}

function exitNarrativeMode(): void {
  state.active = false;
  removeSidebar();
  removeStepper();
  removeCompletionScreen();
  showAllFiles();
  state.sidebarEl = null;

  // Restore layout
  const layout = getLayoutContainer();
  if (layout) layout.classList.remove('prn-layout-shifted');

  // Re-inject entry button
  if (state.narrative) {
    const btn = createEntryButton(state.narrative.steps.length, enterNarrativeMode);
    injectEntryButton(btn);
  }
}

function goToStep(stepNumber: number): void {
  if (!state.narrative) return;

  const step = state.narrative.steps.find(s => s.number === stepNumber);
  if (!step) return;

  state.currentStep = stepNumber;
  removeCompletionScreen();
  showStep(step);

  if (state.sidebarEl) {
    updateSidebarActiveStep(state.sidebarEl, stepNumber);
  }
}

function showStep(step: Step): void {
  if (!state.narrative) return;

  removeStepper();
  removeCompletionScreen();

  const stepper = createStepper(step, state.narrative.steps.length, {
    onPrev: () => goToStep(state.currentStep - 1),
    onNext: () => {
      if (state.currentStep === state.narrative!.steps.length) {
        showCompletion();
      } else {
        goToStep(state.currentStep + 1);
      }
    },
  });
  injectStepper(stepper);
  filterFiles(step.files);
}

function showCompletion(): void {
  if (!state.narrative) return;

  removeStepper();
  showAllFiles();
  // Then hide all files so completion screen is the focus
  filterFiles([]);

  const prFiles = getAllPRFilePaths();
  const orphans = computeOrphans(prFiles, state.narrative.allFiles);

  const screen = createCompletionScreen(
    state.narrative.steps.length,
    state.narrative.allFiles.length,
    orphans,
    {
      onBack: () => goToStep(state.narrative!.steps.length),
      onShowAll: exitNarrativeMode,
    }
  );
  injectCompletionScreen(screen);

  if (state.sidebarEl) {
    // Deselect all steps in sidebar
    state.sidebarEl.querySelectorAll('.prn-sidebar-step').forEach(el => {
      el.classList.remove('prn-sidebar-step--active');
    });
  }
}

async function init(): Promise<void> {
  const ctx = extractPRContext();
  if (!ctx) return;

  const narrative = await fetchNarrative(ctx);
  if (!narrative || narrative.steps.length === 0) return;

  state.narrative = narrative;

  const btn = createEntryButton(narrative.steps.length, enterNarrativeMode);
  injectEntryButton(btn);
}

// Initialize on page load
init();

// Handle GitHub SPA navigation (Turbo)
document.addEventListener('turbo:load', () => {
  // Clean up any active narrative mode
  if (state.active) {
    exitNarrativeMode();
  }
  state.narrative = null;
  removeEntryButton();
  init();
});
```

- [ ] **Step 2: Verify build works**

```bash
npm run build
```

Expected: builds successfully, `build/chrome/content.js` and `build/firefox/content.js` contain the bundled extension.

- [ ] **Step 3: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: wire up main entry point with state management and SPA navigation"
```

---

### Task 11: Run All Tests and Manual Verification

**Files:** None — verification only.

- [ ] **Step 1: Run all tests**

```bash
npx jest --verbose
```

Expected: all tests in `parser.test.ts`, `filter.test.ts`, and `orphans.test.ts` pass.

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: clean build, `build/chrome/` and `build/firefox/` each contain `manifest.json`, `content.js`, `content.js.map`, and `styles.css`.

- [ ] **Step 3: Verify Chrome extension loads**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `build/chrome/`
4. Navigate to any GitHub PR's Files Changed tab
5. Verify: if no narrative comment exists, the page looks normal (no button injected)

- [ ] **Step 4: Verify Firefox extension loads**

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `build/firefox/manifest.json`
4. Navigate to any GitHub PR's Files Changed tab
5. Verify: if no narrative comment exists, the page looks normal

- [ ] **Step 5: Create a test narrative comment and verify full flow**

On a real PR, add a comment with the `## PR Narrative` format. Verify:
- The "Start PR Narrative" button appears
- Clicking it shows the sidebar and filters the diffs
- Next/Prev navigation works
- Sidebar click navigation works
- Completion screen shows after the last step
- Orphan files are detected if applicable
- Exit Narrative restores the full diff view

Note: The DOM selectors for injecting UI elements (entry button, stepper, sidebar layout shift) will likely need adjustment based on GitHub's actual current DOM structure. This is expected — update the selectors in `entryButton.ts`, `stepper.ts`, and `index.ts` as needed during this manual testing step.

- [ ] **Step 6: Commit any selector fixes**

```bash
git add -A
git commit -m "fix: update DOM selectors based on GitHub's actual page structure"
```

---

### Task 12: Final Cleanup and Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README with development instructions**

Add a "Development" section to the existing `README.md`, after the "Browser Support" section:

```markdown
## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run build        # Production build for Chrome and Firefox
npm run dev          # Watch mode — rebuilds on change
```

### Test

```bash
npm test
```

### Load the Extension

**Chrome:**
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `build/chrome/`

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `build/firefox/manifest.json`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add development setup instructions to README"
```
