# PR Walkthrough Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code skill that analyzes a GitHub PR commit-by-commit and generates a `## PR Walkthrough` comment grouping changed files into logical reviewer-friendly steps.

**Architecture:** Single markdown skill file at `skill/pr-walkthrough.md`. The skill is a prompt that instructs Claude Code on how to use Bash (git/gh CLI), Read (file contents), and AskUserQuestion (grouping survey) to detect a PR, analyze its changes, derive groupings, and publish a walkthrough comment. No runtime code.

**Tech Stack:** Claude Code skill system, gh CLI, git

**Spec:** `docs/superpowers/specs/2026-03-28-pr-walkthrough-skill-design.md`

---

## File Structure

```
skill/
  pr-walkthrough.md    # The complete skill definition
```

This is a single-file deliverable. The plan is broken into tasks by the logical sections of the skill prompt, each building on the previous. Since this is a prompt file (not code), testing means running the skill against a real PR and verifying the output.

---

### Task 1: Skill scaffold and PR detection

**Files:**
- Create: `skill/pr-walkthrough.md`

- [ ] **Step 1: Create the skill file with metadata and PR detection logic**

```markdown
---
name: pr-walkthrough
description: Generate a PR Walkthrough comment that groups changed files into logical steps for reviewers. Use when the user asks to create a walkthrough, generate a PR walkthrough, or invokes /pr-walkthrough.
---

# PR Walkthrough Generator

You generate structured PR Walkthrough comments for GitHub pull requests. These comments group changed files into logical steps that guide a reviewer through the code in reading order.

## Step 1: Detect the PR

First, verify gh CLI is available and authenticated:

```bash
gh auth status
```

If this fails, tell the user to install and authenticate the gh CLI (`gh auth login`) and stop.

Determine which PR to analyze:

1. **If the user provided a PR URL or number**, extract the owner/repo/number and use it directly:
   ```bash
   gh pr view <URL_OR_NUMBER> --json number,title,author,headRefName,baseRefName
   ```

2. **Otherwise**, detect from the current branch:
   ```bash
   BRANCH=$(git branch --show-current)
   gh pr list --head "$BRANCH" --json number,title,author,headRefName,baseRefName --limit 1
   ```

3. If no PR is found, ask the user for a PR URL or number.

Store the PR number, title, author login, head branch, and base branch for later use.

## Step 2: Detect role (author vs reviewer)

```bash
CURRENT_USER=$(gh api user --jq '.login')
```

Compare `CURRENT_USER` against the PR author login from Step 1.

- If they match: this is the **author flow** (present grouping options later)
- If they don't match: this is the **reviewer flow** (auto-pick best grouping)
```

- [ ] **Step 2: Commit**

```bash
mkdir -p skill
git add skill/pr-walkthrough.md
git commit -m "feat: add skill scaffold with PR detection and role detection"
```

---

### Task 2: Analysis pipeline — gather commit data

**Files:**
- Modify: `skill/pr-walkthrough.md`

- [ ] **Step 1: Add Stage 1 (gather commits) to the skill**

Append to `skill/pr-walkthrough.md` after the role detection section:

```markdown
## Step 3: Gather commit data

Get the list of commits in the PR:

```bash
gh pr view <PR_NUMBER> --json commits --jq '.commits[] | "\(.oid) \(.messageHeadline)"'
```

For each commit SHA, get the full diff and message:

```bash
git show <SHA> --stat --patch
```

If there is only one commit, or the commits appear to be squash-merged (single commit with a generic message), note this — you will rely more heavily on file analysis in the next step rather than commit intent.

Read through each commit's message and diff. Build a mental model of:
- What was the author trying to accomplish with each commit?
- What is the overall narrative arc of the PR? (e.g., "add a new API endpoint", "refactor authentication", "fix a race condition")
- Which commits are foundational (types, interfaces) vs. implementation vs. tests vs. cleanup?

Do NOT use the commit structure as the walkthrough structure. Commits reveal intent; the walkthrough should be organized for reviewer comprehension, not author workflow.
```

- [ ] **Step 2: Commit**

```bash
git add skill/pr-walkthrough.md
git commit -m "feat: add commit data gathering stage to skill"
```

---

### Task 3: Analysis pipeline — build change model

**Files:**
- Modify: `skill/pr-walkthrough.md`

- [ ] **Step 1: Add Stage 2 (change model) to the skill**

Append to `skill/pr-walkthrough.md`:

```markdown
## Step 4: Build a change model

Get the full list of changed files:

```bash
gh pr diff <PR_NUMBER> --name-only
```

For each changed file, read its full content to understand its role:

```bash
# Use the Read tool to read each changed file
```

As you read each file, classify it:

- **Role**: entry point, route handler, service, utility, type/interface definition, test, config, migration, documentation
- **Test mapping**: if a file is a test, identify what it tests (by naming convention like `foo.test.ts` → `foo.ts`, `test_foo.py` → `foo.py`, or by looking at its imports)
- **Relationships**: note which other changed files this file imports from or exports to

Build a structured understanding:
- Which files define types/interfaces that other files consume?
- Which files are entry points (route handlers, CLI commands, main functions)?
- Which files contain core business logic?
- Which files are tests, and what do they test?
- Are there supporting files (config, migrations, documentation)?

For very large PRs (50+ files), don't read every file. Instead, read the most central files (entry points, files changed in the most commits) and use `gh pr diff` output to understand the rest by file path and diff size.
```

- [ ] **Step 2: Commit**

```bash
git add skill/pr-walkthrough.md
git commit -m "feat: add change model building stage to skill"
```

---

### Task 4: Grouping derivation

**Files:**
- Modify: `skill/pr-walkthrough.md`

- [ ] **Step 1: Add Stage 3 (derive groupings) to the skill**

Append to `skill/pr-walkthrough.md`:

```markdown
## Step 5: Derive walkthrough groupings

Using your understanding from Steps 3 and 4, group the changed files into walkthrough steps.

### Grouping principles

1. **Most important flow first**: identify the core change in the PR and trace it from entry point through the call stack. This becomes the first steps.
2. **Follow the code flow**: within a flow, order steps so that a reviewer reads code in the order it executes or in dependency order (types before consumers).
3. **Test files with their code**: pair test files with the implementation they test in the same step. Exception: if the test files massively outnumber the implementation (e.g., 1 source file and 8 test files), put tests in their own step after the implementation step.
4. **Secondary flows after primary**: supporting changes (refactors, config updates, migrations) come after the main feature flow.
5. **Each step should be comprehensible on its own**: a reviewer should understand why these files are grouped together from the step title and description alone.
6. **Step descriptions explain the "why"**: don't just list what the files are — explain what the reviewer should focus on and how this step connects to the overall change.

### Author flow (current user is PR author)

Generate 2-3 different grouping strategies. Each strategy should represent a genuinely different way to read the code, not minor variations.

Good strategy contrasts:
- "Entry point inward" vs. "Core types outward" vs. "By subsystem"
- "Feature flow then tests" vs. "Each component with its tests"

If the PR is small (fewer than 8 files) or has a single obvious flow, skip the options and generate one grouping directly.

Present the options to the user using AskUserQuestion with this format — each option should have a label describing the strategy and a description listing the step titles with file counts:

Example:
- Option label: "API endpoint through service layer"
- Option description: "Step 1: Request handler (2 files) → Step 2: Service logic (3 files) → Step 3: Database layer (2 files) → Step 4: Tests (4 files)"

### Reviewer flow (current user is not PR author)

Pick the single best grouping strategy — prefer entry-point-inward ordering as the default, since it matches how most reviewers want to read code.
```

- [ ] **Step 2: Commit**

```bash
git add skill/pr-walkthrough.md
git commit -m "feat: add grouping derivation logic to skill"
```

---

### Task 5: Comment generation

**Files:**
- Modify: `skill/pr-walkthrough.md`

- [ ] **Step 1: Add comment generation to the skill**

Append to `skill/pr-walkthrough.md`:

```markdown
## Step 6: Generate the walkthrough comment

Generate the comment in this exact format (the PR Walkthrough browser extension parses this):

```
## PR Walkthrough

### [Step Title]
[1-3 sentences explaining what to focus on in this step and why these files are grouped together.]

- `[exact/path/to/file1.ts]`
- `[exact/path/to/file2.ts]`

### [Next Step Title]
[Description for this step.]

- `[exact/path/to/file3.ts]`
```

**Format rules:**
- The comment MUST start with exactly `## PR Walkthrough` on its own line
- Each step starts with `### ` followed by a descriptive title (NOT "Step 1:", just the title)
- Description lines come after the heading, before the file list
- Each file is listed as `- \`path/to/file\`` with the path exactly as it appears in the PR diff (use the output of `gh pr diff --name-only` for exact paths)
- A blank line between the description and the file list
- A blank line between the last file of one step and the `###` of the next step
- Every changed file in the PR must appear in exactly one step — no file should be missing or duplicated

Display the generated comment to the user and ask if it looks good. If they request changes (move files, rename steps, adjust descriptions), make the edits and re-show until they approve.
```

- [ ] **Step 2: Commit**

```bash
git add skill/pr-walkthrough.md
git commit -m "feat: add comment generation with exact parser format"
```

---

### Task 6: Publishing and update flow

**Files:**
- Modify: `skill/pr-walkthrough.md`

- [ ] **Step 1: Add publishing logic to the skill**

Append to `skill/pr-walkthrough.md`:

```markdown
## Step 7: Check for existing walkthrough comment

Before publishing, check if a walkthrough comment already exists:

```bash
gh api repos/{owner}/{repo}/issues/{pr_number}/comments --jq '.[] | select(.body | startswith("## PR Walkthrough")) | {id: .id, author: .user.login}'
```

- If a comment exists **by the current user**: note the comment ID — you will edit it instead of creating a new one
- If a comment exists **by a different user**: tell the user "There's already a walkthrough comment by @{author}." and ask whether they want to post a second one or skip
- If no comment exists: proceed to publish

## Step 8: Publish the comment

Once the user has approved the comment:

**To create a new comment:**
```bash
gh pr comment <PR_NUMBER> --body '<COMMENT_BODY>'
```

**To edit an existing comment (by the current user):**
```bash
gh api repos/{owner}/{repo}/issues/comments/{comment_id} --method PATCH --field body='<COMMENT_BODY>'
```

Use a heredoc or temp file for the comment body to avoid shell escaping issues:
```bash
# Write comment to a temp file
cat > /tmp/pr-walkthrough-comment.md << 'WALKTHROUGH_EOF'
## PR Walkthrough
...full comment here...
WALKTHROUGH_EOF

# Post using the file
gh pr comment <PR_NUMBER> --body-file /tmp/pr-walkthrough-comment.md

# Or edit existing
gh api repos/{owner}/{repo}/issues/comments/{comment_id} --method PATCH --field body=@/tmp/pr-walkthrough-comment.md

# Clean up
rm /tmp/pr-walkthrough-comment.md
```

After publishing, confirm to the user with a link to the PR.
```

- [ ] **Step 2: Commit**

```bash
git add skill/pr-walkthrough.md
git commit -m "feat: add publishing and comment update flow to skill"
```

---

### Task 7: Manual testing

**Files:**
- None (testing only)

- [ ] **Step 1: Test author flow on a real PR**

Find a PR where you are the author (or use the current repo's existing PRs). Run:

```
/pr-walkthrough
```

Verify:
- PR is detected from current branch
- Role is correctly identified as author
- Commits are analyzed
- Changed files are read and classified
- Grouping options are presented (if PR has enough files)
- Generated comment matches the exact parser format
- Comment is posted/edited correctly via gh CLI

- [ ] **Step 2: Test reviewer flow with a PR URL**

Use a PR where you are NOT the author:

```
/pr-walkthrough https://github.com/<org>/<repo>/pull/<number>
```

Verify:
- PR is fetched via gh CLI
- Role is correctly identified as reviewer
- No grouping survey is shown (auto-picks best grouping)
- Comment is generated and posted after confirmation

- [ ] **Step 3: Test edge cases**

- Run against a single-commit PR — verify fallback to file analysis
- Run against a PR where a walkthrough comment already exists by you — verify it offers to edit
- Run against a PR where a walkthrough comment exists by someone else — verify it warns and asks

- [ ] **Step 4: Iterate on the skill prompt based on test results**

Based on the test runs, refine the skill prompt:
- Adjust analysis instructions if groupings aren't logical
- Fix format issues if the extension parser doesn't recognize the output
- Tune the grouping principles if test files aren't handled well

- [ ] **Step 5: Commit final version**

```bash
git add skill/pr-walkthrough.md
git commit -m "feat: finalize pr-walkthrough skill after manual testing"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Invocation: `/pr-walkthrough`, auto-detect branch, accept URL
- ✅ PR detection: gh CLI, current branch fallback
- ✅ Role detection: author vs reviewer
- ✅ Analysis pipeline: commits → change model → groupings
- ✅ Commit-by-commit analysis for understanding intent (not for output structure)
- ✅ Author flow: survey with grouping options
- ✅ Reviewer flow: auto-pick best grouping
- ✅ Comment format: exact parser match
- ✅ Confirm before posting
- ✅ Edit existing comment by current user
- ✅ Warn about comment by other user
- ✅ Edge cases: single commit, large PRs, no gh CLI, no PR found, mixed languages
- ✅ Test file pairing with implementation

**Placeholder scan:** No TBD, TODO, or vague instructions found.

**Type consistency:** N/A — this is a prompt file, not code. The comment format matches the parser exactly (verified against `src/content/parser.ts`).
