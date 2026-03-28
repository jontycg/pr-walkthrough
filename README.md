# PR Narrative

A browser extension that transforms PR reviews into guided tours. Instead of reviewing a flat list of changed files, PR authors write a narrative comment that groups files into logical steps with commentary, and reviewers step through the PR in the order the author intended.

## The Problem

AI-assisted development has made writing code dramatically faster, but PR review hasn't kept pace. Reviewers are dropped into a diff of dozens of files with no sense of where to start, what's important, and what's just noise. This slows down review, increases the chance of missing critical changes, and makes the whole process feel like a chore.

## The Solution

PR Narrative lets authors add a structured comment to their PR (prefixed with `## PR Narrative`) that breaks the changes into steps. Each step groups related files and includes a brief explanation of what to focus on. The extension then:

- Adds a **guided tour UI** to GitHub's Files Changed tab
- **Filters the native diff view** to show only the files relevant to the current step — all GitHub functionality (commenting, suggesting changes, conversations) works as normal
- Provides a **sidebar** showing all steps for orientation and a **stepper** (next/prev) for linear flow
- Detects **orphan files** not covered by any step, so nothing gets missed

## Comment Format

PR authors add a comment to their PR like this:

```
## PR Narrative

### API route and controller
Brief description of what to focus on here.
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

## Browser Support

- Chrome (and Chromium-based browsers like Edge)
- Firefox

Built on the WebExtension API with near-identical code for both browsers.

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

## Status

Early development — not yet published to extension stores.

## License

Open source (license TBD).
