# PR Walkthrough

A browser extension that transforms PR reviews into guided tours. Instead of reviewing a flat list of changed files, PR authors write a narrative comment that groups files into logical steps with commentary, and reviewers step through the PR in the order the author intended.

## The Problem

AI-assisted development has made writing code dramatically faster, but PR review hasn't kept pace. Reviewers are dropped into a diff of dozens of files with no sense of where to start, what's important, and what's just noise. This slows down review, increases the chance of missing critical changes, and makes the whole process feel like a chore.

## The Solution

PR Walkthrough lets authors add a structured comment to their PR (prefixed with `## PR Walkthrough`) that breaks the changes into steps. Each step groups related files and includes a brief explanation of what to focus on. The extension then:

- Adds a **guided tour UI** to GitHub's Files Changed tab
- **Filters the native diff view** to show only the files relevant to the current step — all GitHub functionality (commenting, suggesting changes, conversations) works as normal
- Provides a **sidebar** showing all steps for orientation and a **stepper** (next/prev) for linear flow
- Detects **orphan files** not covered by any step, so nothing gets missed

## Comment Format

PR authors add a comment to their PR like this:

```
## PR Walkthrough

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

## Claude Code Skill

PR Walkthrough includes a Claude Code skill that can automatically generate walkthrough comments by analyzing your PR's commits and code structure. It works for both PR authors (presents grouping options) and reviewers (best-effort automatic grouping).

### Install

**From a clone (recommended for development):**

```bash
ln -s "$(pwd)/skill/pr-walkthrough" ~/.claude/skills/pr-walkthrough
```

This symlinks the skill directory so any local changes are picked up immediately.

**Or with curl (no clone needed):**

```bash
mkdir -p ~/.claude/skills/pr-walkthrough && curl -fsSL https://raw.githubusercontent.com/jontycg/pr-walkthrough/main/skill/pr-walkthrough/SKILL.md -o ~/.claude/skills/pr-walkthrough/SKILL.md
```

### Usage

From within a repo with an open PR on the current branch:

```
/pr-walkthrough
```

Or point it at any PR:

```
/pr-walkthrough https://github.com/org/repo/pull/123
```

Requires the [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated.

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
