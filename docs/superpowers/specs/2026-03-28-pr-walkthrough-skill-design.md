# PR Walkthrough Skill — Design Spec

## Goal

A Claude Code skill that analyzes a GitHub PR and generates a `## PR Walkthrough` comment grouping changed files into logical steps that guide a reviewer through the code in reading order. Works for both PR authors (interactive grouping options) and reviewers (best-effort automatic grouping).

## Invocation

- Responds to `/pr-walkthrough` slash command
- Also activates when user asks to generate a walkthrough for a PR
- Accepts an optional PR URL or number as argument

### PR Detection

1. If a PR URL/number is provided, use `gh pr view` to get metadata
2. Otherwise, detect current branch via `git branch --show-current` and find an open PR with `gh pr list --head <branch>`
3. If no PR found, ask the user for a URL

### Role Detection

Compare `gh pr view --json author` against `gh api user`:
- **Author**: present grouping options as a survey, let them choose
- **Reviewer**: generate best-effort grouping automatically, skip the survey

## Analysis Pipeline

### Stage 1: Gather Commit Data

Use `gh pr view --json commits` for the commit list, then `git show <sha>` for each commit's message and diff. This reveals the author's logical progression and intent.

Commits are input for understanding — not the output grouping structure. The point is to understand *why* changes were made, not to replay the commit order.

### Stage 2: Build a Change Model

Read the full content of each changed file to understand:
- **File role**: entry point, service, utility, type definition, test, config, etc.
- **Relationships**: import/export connections between changed files
- **Test mapping**: which test files correspond to which source files (by naming convention like `foo.test.ts` → `foo.ts`, or by import analysis)

Output: a structured model of changed files with roles, relationships, and commit context.

### Stage 3: Derive Groupings

Using the change model, group files into a walkthrough optimized for reviewer comprehension:

- Identify the most important code flow and trace it from entry point through the call stack
- Group files along that flow into steps
- Pair test files with the code they test, unless tests are disproportionately large (then separate step)
- Secondary flows (supporting changes, refactors, config) come after the primary flow
- Each step gets a title and description explaining what to focus on and why these files belong together

**Author flow**: generate 2-3 grouping strategies (e.g. "entry point through call stack", "core types first then consumers") and present as a survey with step titles and file counts. If the PR is straightforward (small, single obvious flow), skip the survey.

**Reviewer flow**: pick the best grouping automatically.

## Grouping Presentation (Author Flow)

Present options using AskUserQuestion-style format:

```
Option A: "API endpoint through service layer"
  Step 1: Request handler and routing (2 files)
  Step 2: Service logic and domain types (3 files)
  Step 3: Database queries (2 files)
  Step 4: Tests (4 files)

Option B: "Domain model outward"
  Step 1: Core types and interfaces (2 files)
  Step 2: Service implementation (3 files)
  Step 3: HTTP layer (2 files)
  Step 4: Tests (4 files)
```

After selection (or automatically for reviewer flow), generate the full comment.

## Comment Format

Must match the extension's parser format exactly:

```markdown
## PR Walkthrough

### Step Title
Description of what to focus on in this step and why these files are grouped together.

- `path/to/file1.ts`
- `path/to/file2.ts`

### Next Step Title
Description for this step.

- `path/to/file3.ts`
- `path/to/test_file3.ts`
```

## Publishing and Update Flow

### Confirm Before Posting

Display the generated comment to the user. They can request edits (move files between steps, rename steps, adjust descriptions). Re-show after edits until approved.

### Publishing

- Post with `gh pr comment <number> --body <comment>`
- To edit an existing comment: use `gh api` to list comments, find the `## PR Walkthrough` comment by the current user, update with `gh api --method PATCH`

### Existing Comment Handling

- If a `## PR Walkthrough` comment exists **by the current user**: edit it in place
- If a `## PR Walkthrough` comment exists **by someone else**: inform the user ("There's already a walkthrough by @username") and ask whether to post a second one or skip

## Edge Cases and Fallbacks

- **Squash-merged or single-commit PRs**: no meaningful commit history. Fall back to reading the full diff and file contents, infer flow from code structure (imports, file roles).
- **Very large PRs (50+ files)**: still works but uses coarser groupings (by subsystem/directory). Warn the user about PR size.
- **No gh CLI or not authenticated**: detect early with `gh auth status`, tell user to install/auth, exit gracefully.
- **No open PR for current branch**: ask for a PR URL.
- **Mixed languages**: don't rely on import parsing for every language. Use file naming conventions, directory structure, and commit context as primary grouping signals.

## File Structure

```
skill/
  pr-walkthrough.md    # The skill definition — all logic, prompts, tool instructions
```

The skill is a Claude Code skill prompt. It uses Bash (git/gh CLI), Read (file contents), and AskUserQuestion (grouping survey) as its tools. No runtime code beyond the skill markdown.

## Dependencies

- `gh` CLI installed and authenticated
- Git repository with the PR's branch available locally (for author flow) or accessible via `gh` (for reviewer flow)
