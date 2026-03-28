# PR Narrative — Browser Extension Design Spec

## Overview

PR Narrative is a browser extension (Chrome + Firefox) that transforms PR reviews into guided tours. PR authors write a structured comment on their PR that groups changed files into logical steps with commentary. The extension renders this as a step-by-step experience on GitHub's Files Changed tab, filtering the native diff view to show only the files relevant to each step.

## Problem

AI-assisted development has made writing code dramatically faster, but PR review hasn't kept pace. Reviewers face a flat list of changed files with no guidance on where to start, what matters, and what's noise. This slows review, increases missed changes, and makes the process frustrating.

## Goals

- Let PR authors define a narrative walkthrough of their changes
- Let reviewers step through PRs in a guided, logical order
- Preserve all native GitHub functionality (comments, suggestions, conversations)
- Detect files not covered by the narrative so nothing gets missed
- Support Chrome and Firefox from day one
- Fully open source

## Non-Goals (v1)

- Claude skill for generating narrative comments (future work, top-level `skill/` directory reserved)
- GitHub Action integration
- Cross-PR narrative linking
- Progress persistence between sessions
- Custom diff rendering

---

## Comment Format

The narrative is a PR comment (on the Conversation tab) with the following structure:

```markdown
## PR Narrative

### API route and controller
Entry point for the new users endpoint. Focus on the route definitions and request handling.
- `src/routes/users.ts`
- `src/controllers/userController.ts`

### Service layer
The business logic for the new endpoint.
- `src/services/userService.ts`

### Database changes
Migration and model updates — straightforward schema addition.
- `db/migrations/20240101_add_users.sql`
- `src/models/user.ts`

### Tests
- `tests/users.test.ts`
- `tests/userService.test.ts`
```

### Parsing Rules

- Comment must begin with `## PR Narrative` (the magic prefix)
- Each step is defined by a `###` heading — the heading text is the step title
- Step ordering is determined by document order (no numbering required)
- Lines between the heading and the file list are the step description/commentary
- Files are markdown list items containing backtick-wrapped paths (e.g. `- \`src/foo.ts\``)
- The extension assigns display numbers (Step 1, Step 2, etc.) from document order

### Path Matching

File paths in the comment are matched against GitHub's diff file headers using suffix matching. `src/routes/users.ts` matches the file element whose `data-tagsearch-path` attribute ends with that path. Authors can use short paths (e.g. `users.ts`) if unambiguous, though full paths are recommended.

---

## Architecture

### Approach

Pure content script with GitHub API fetch for comment data. No background script, no framework, no custom diff rendering. The extension manipulates GitHub's existing DOM to filter which file diffs are visible.

### Project Structure

```
pr-narrative/
├── src/
│   ├── content/
│   │   ├── index.ts          # Entry point — detects PR pages, bootstraps
│   │   ├── parser.ts         # Parses narrative comment into structured data
│   │   ├── api.ts            # Fetches PR comments via GitHub API
│   │   ├── filter.ts         # Shows/hides file diffs in the DOM
│   │   ├── ui/
│   │   │   ├── sidebar.ts    # Step list sidebar component
│   │   │   ├── stepper.ts    # Next/prev navigation
│   │   │   └── orphans.ts    # Orphan file detection & display
│   │   └── styles.css        # Injected styles
│   └── types.ts              # Shared types (Step, NarrativeData, etc.)
├── manifest.chrome.json
├── manifest.firefox.json
├── build/                    # Build output per browser
├── package.json
└── tsconfig.json
```

The top-level structure leaves room for a future `skill/` directory for the Claude skill without any conflicts.

### Key Decisions

- **TypeScript** — type safety for parsed data structures and DOM manipulation
- **No framework** — plain DOM manipulation keeps the bundle small and avoids conflicts with GitHub's JS
- **Two manifests** — one per browser, referencing the same built JS; a build script copies the right one
- **No background script** — content script fetches comments directly via `fetch` using the user's GitHub session cookies
- **Namespaced CSS** — all injected elements use `prn-` class prefix to avoid style collisions with GitHub

---

## UX Flow

### 1. Entry Point

When the extension loads on a PR's Files Changed tab (`github.com/:owner/:repo/pull/:number/files`):

1. Extract owner, repo, and PR number from the URL
2. Fetch PR comments via GitHub API
3. Scan for a comment starting with `## PR Narrative`
4. If found, parse it and inject a green **"Start PR Narrative (N steps)"** button into the Files Changed toolbar
5. If not found, do nothing — zero interference with normal GitHub usage

### 2. Narrative Mode

When the reviewer clicks the start button:

1. Inject the **sidebar** on the left side of the diff container, showing all steps with titles and file counts
2. Inject the **step header** above the diff area, showing the current step's title, description, and next/prev buttons
3. **Filter diffs** — hide all file elements not in the current step
4. Highlight the active step in the sidebar

### 3. Step Navigation

- **Next/Prev buttons** in the step header for linear flow
- **Sidebar click** to jump to any step
- On step change: unhide all files, then hide files not in the new step
- Prev is disabled on step 1; Next advances to the completion screen after the last step

### 4. Completion Screen

After the last step:

- Show a summary: "Narrative complete — you've reviewed all N steps covering M files"
- **Orphan detection**: compare all file paths in the PR diff against all file paths in the narrative. Display any uncovered files with a warning
- Provide buttons: "Back to Step N" and "Show All Files" (exits narrative mode)

### 5. Exiting Narrative Mode

- "Exit Narrative" button in the sidebar, or "Show All Files" on completion screen
- Removes sidebar, step header, and unhides all file diffs
- Restores the page to its normal state

---

## DOM Manipulation Strategy

### Filtering Files

- Each file diff in GitHub's Files Changed tab lives in a `div.file` container with a `data-tagsearch-path` attribute containing the file path
- To filter: iterate all `div.file` elements, match `data-tagsearch-path` against the current step's file list (suffix match), set `display: none` on non-matches
- To unfilter: set `display` back to its original value on all file elements
- This preserves all GitHub event listeners, comment threads, and interactive features

### Injecting UI

- Sidebar: inserted as a sibling to the main diff container; diff container gets `margin-left` to make room
- Step header: inserted above the diff container
- Start button: appended to GitHub's existing toolbar in the Files Changed header

### SPA Navigation

GitHub uses Turbo for client-side navigation. The content script listens for `turbo:load` events (with `MutationObserver` fallback on the body) to detect navigation to/from the Files Changed tab and reinitialize accordingly.

### Lazy-Loaded Diffs

For large PRs, GitHub may not render all file diffs immediately. This needs investigation during implementation. The core hide/show approach works for files present in the DOM. For files not yet rendered, potential strategies include:

- Programmatically clicking "Load diff" buttons if they exist as collapsed placeholders
- Showing a note in the step header about files not yet loaded
- Using a `MutationObserver` on the diff container to apply filtering to newly loaded files

The exact strategy will be determined during implementation based on GitHub's actual DOM behaviour across different PR sizes.

---

## GitHub API Integration

### Fetching Comments

- Endpoint: `GET /repos/:owner/:repo/issues/:number/comments`
- Called from the content script using `fetch` — rides the user's GitHub session cookies, no token or OAuth needed
- Scan response for a comment body starting with `## PR Narrative`
- If multiple comments match, use the most recent one (highest comment ID)
- Parse and cache in memory for the page session

### Rate Limiting

- Session-authenticated requests get 5,000 requests/hour — more than sufficient
- Only one API call per PR page load

### Comment Updates

- v1: user refreshes the page to pick up narrative comment edits
- Future: "Refresh narrative" button or polling

---

## Build & Distribution

### Tooling

- **esbuild** for TypeScript bundling — fast, minimal config, single content script output
- Build script outputs `build/chrome/` and `build/firefox/`, each with the correct manifest and shared JS/CSS

### Manifests

- Both use Manifest V3
- Chrome: standard MV3 content script targeting `github.com/*/pull/*/files*`
- Firefox: same, plus `browser_specific_settings.gecko.id`
- Permissions: host permission for `github.com`

### Cross-Browser Compatibility

The WebExtension API is standardized across both browsers. Since we're only using content script functionality (DOM manipulation + fetch), there's minimal browser-specific code. The `webextension-polyfill` library handles the `chrome.*` vs `browser.*` namespace difference.

### Development Workflow

- `npm run dev` — watch mode, rebuilds on change
- `npm run build` — production build for both browsers
- Load unpacked in Chrome (`chrome://extensions`) or Firefox (`about:debugging`)

### Distribution

- Chrome Web Store
- Firefox Add-ons (addons.mozilla.org)
- GitHub releases for sideloading
- Open source — users can build from source

---

## Testing Strategy

### Unit Tests

- **Parser**: comment string → structured step data, covering valid formats, edge cases, malformed input
- **Path matching**: suffix matching logic against various file path formats
- **Orphan detection**: comparing narrative files against PR file list

### Integration Testing

- **Jest + jsdom**: test DOM manipulation against mock GitHub HTML structures
- **Manual testing**: load unpacked extension against real PRs during development

### Test Fixtures

- Maintain a test repo with PRs covering: small PR, large PR, no narrative comment, malformed narrative, files that don't match any diff, all files covered, orphan files present
