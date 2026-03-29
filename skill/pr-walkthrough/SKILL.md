---
name: pr-walkthrough
description: Analyze a GitHub PR and generate a "## PR Walkthrough" comment that guides reviewers through changed files in a logical, step-by-step order.
triggers:
  - /pr-walkthrough
  - when the user asks to create a PR walkthrough
  - when the user asks to generate a walkthrough comment
---

# PR Walkthrough Skill

You are generating a **PR Walkthrough** comment for a GitHub pull request. This comment will be consumed by the PR Walkthrough browser extension, which turns it into a guided step-by-step review UI on GitHub's Files Changed tab.

The output format is strict. Follow every stage below in order.

---

## PR Detection

Before anything else, verify that the GitHub CLI is authenticated and identify the target PR.

1. **Check auth:**

```bash
gh auth status
```

If this fails, stop and tell the user to run `gh auth login` first.

2. **Identify the PR.** Use one of these methods, in priority order:

   - **Argument provided:** If the user gave a PR URL or number, use that directly. Extract the number from URLs like `https://github.com/owner/repo/pull/123`.
   - **Current branch:** If no argument was given, detect the current branch and look for an open PR:

```bash
BRANCH=$(git branch --show-current)
gh pr list --head "$BRANCH" --json number,title --limit 1
```

   - **Ask the user:** If neither method finds a PR, ask which PR to generate a walkthrough for. Do not guess.

Once you have the PR number, store it as `PR_NUMBER` for all subsequent commands. Confirm the PR title with the user before proceeding.

---

## Role Detection

Determine whether the current user is the PR author or a reviewer. This affects the grouping workflow later.

```bash
CURRENT_USER=$(gh api user --jq '.login')
PR_AUTHOR=$(gh pr view $PR_NUMBER --json author --jq '.author.login')
```

- If `CURRENT_USER == PR_AUTHOR`: the user is the **author**. They get interactive grouping options (choice of strategy).
- If `CURRENT_USER != PR_AUTHOR`: the user is a **reviewer**. Auto-pick the best grouping strategy without prompting.

---

## Stage 1 -- Gather Commit Data

The purpose of this stage is to understand the **intent** behind the PR. Commits reveal why changes were made and in what order they were developed. This understanding informs how you group files later. Commits are for understanding intent, NOT for structuring the output.

1. **Fetch commit metadata:**

```bash
gh pr view $PR_NUMBER --json commits --jq '.commits[] | "\(.oid) \(.messageHeadline)"'
```

2. **Read each commit's diff** to understand what it changed and why:

```bash
git show <SHA> --stat
git show <SHA>
```

Do this for every commit. For PRs with many commits (10+), focus on the commits with the most substantial diffs and skim the rest.

3. **Build a mental model** of the PR's intent from the commit messages and diffs:
   - What is the primary goal of this PR?
   - What are the secondary changes (refactors, renames, config)?
   - What order were changes developed in?

4. **Single-commit PRs:** If there is only one commit, the commit message gives limited signal. Rely more heavily on file analysis in Stage 2.

---

## Stage 2 -- Build Change Model

Now build a complete picture of what files changed and how they relate to each other.

1. **Get the list of changed files:**

```bash
gh pr diff $PR_NUMBER --name-only
```

2. **Read each changed file's full content** to understand its role. Use the Read tool (not cat/head) for each file. For very large PRs (50+ files), read only the most central files -- entry points, services, types -- and skim the rest via their diff.

3. **Classify each file** by its role in the codebase:
   - **Entry point:** Route handler, API endpoint, CLI command, main function
   - **Service/logic:** Business logic, core algorithm, data processing
   - **Utility:** Helper function, shared module, library wrapper
   - **Type definition:** Interface, type, schema, model
   - **Test:** Unit test, integration test, test fixture
   - **Config:** Build config, CI config, package manifest, linter rules

4. **Map relationships between files:**
   - Which test files correspond to which source files?
   - Which files import from which other files?
   - Which files are entry points that call into service layers?
   - Note import/export relationships that reveal the call graph.

5. **Identify the primary flow:** Trace from the entry point(s) through the call stack to understand the main execution path that this PR modifies.

---

## Stage 3 -- Derive Groupings

Group the changed files into steps that make sense for a reviewer reading the PR for the first time. The goal is reviewer comprehension, not developer history.

### Grouping Principles

Apply these principles when creating step groupings:

1. **Most important flow first.** Start with the primary change, traced from entry point through the call stack. The reviewer should understand the main point of the PR before seeing supporting changes.

2. **Follow code execution/dependency order within a flow.** Within a single flow, order files so the reviewer sees the caller before the callee, or the type definition before its usage -- whichever makes the code easier to follow.

3. **Test files alongside their code** -- unless tests massively outnumber source files, in which case put tests in a separate step. The threshold is roughly 2:1 test-to-source ratio within a step.

4. **Secondary flows after primary.** Refactors, renames, config changes, and other supporting work come after the main story.

5. **Each step must be comprehensible on its own.** A reviewer should be able to understand what a step is about without reading other steps. Do not split tightly coupled files across steps.

6. **Step descriptions explain "why", not just "what".** "Adds validation middleware to reject malformed requests before they hit the service layer" is better than "Validation changes".

### Grouping Strategies

There are several valid ways to group files. The best choice depends on the PR:

- **Entry-point inward:** Start at the API/UI entry point and trace inward through service layers, ending with utilities and types. Best for feature PRs.
- **Data-flow:** Follow the data path from input to output. Best for pipeline or transformation PRs.
- **Layer-by-layer:** Group by architectural layer (types, then services, then routes, then tests). Best for cross-cutting refactors.

### Author Flow (current user is the PR author)

Generate 2-3 candidate grouping strategies. For each, produce:
- A short label (e.g., "Entry-point inward")
- A one-sentence rationale for why this strategy fits this PR
- A brief outline of the steps (titles only, with file counts)

Present these to the user as a survey using AskUserQuestion. Let them pick one, or suggest modifications.

**Exception:** If the PR is small (fewer than 8 files) or the grouping is obvious (single feature, clear layers), skip the survey and use the best strategy directly. Tell the user what you chose and why.

### Reviewer Flow (current user is NOT the PR author)

Auto-pick the best grouping strategy. Default to **entry-point inward** unless the PR structure clearly favors another approach. Do not prompt the user for strategy selection.

---

## Comment Generation

Generate the walkthrough comment in the exact format required by the PR Walkthrough browser extension.

### Output Format

The comment MUST follow this exact structure:

```
## PR Walkthrough

### [Step Title]
[1-3 sentence description explaining why this step matters and what to look for]

- `[exact/path/to/file]`
- `[exact/path/to/another-file]`

### [Next Step Title]
[1-3 sentence description]

- `[exact/path/to/file]`
```

### Format Rules

- The comment MUST start with `## PR Walkthrough` on its own line. This is the magic prefix the extension looks for.
- Each step uses a `### ` heading (h3) for its title.
- Step descriptions are plain text lines between the heading and the file list. Keep them to 1-3 sentences.
- Files are listed as markdown bullet items with backtick-wrapped paths: `- \`path/to/file\``
- Use exact file paths as they appear in the PR diff (from `gh pr diff --name-only`). Do not abbreviate or modify paths.
- Blank line between the description and the file list.
- Blank line between steps.
- **Every changed file must appear in exactly one step.** No file should be missing and no file should appear in multiple steps. After generating, verify this by cross-referencing against the full file list from Stage 2.

### Review Loop

After generating the comment:

1. Show the full comment to the user in a code block.
2. Ask if they want to make any changes (reorder steps, rename titles, move files between steps, edit descriptions).
3. If they request changes, regenerate and show again.
4. Repeat until the user approves.

---

## Existing Comment Check

Before publishing, check whether a PR Walkthrough comment already exists on the PR.

```bash
gh api "repos/{owner}/{repo}/issues/$PR_NUMBER/comments" --jq '.[] | select(.body | startswith("## PR Walkthrough")) | {id: .id, author: .user.login}'
```

Extract `{owner}` and `{repo}` from the PR or from the git remote:

```bash
gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"'
```

Three possible outcomes:

1. **No existing comment:** Proceed to publish a new comment.
2. **Existing comment by the current user:** Offer to update (edit) the existing comment instead of creating a duplicate. Default to updating.
3. **Existing comment by a different user:** Warn the user that someone else already posted a walkthrough. Ask whether to create a second one or skip publishing.

---

## Publishing

Write the comment to a temp file to avoid shell escaping issues, then publish via the GitHub CLI.

### New Comment

```bash
# Write comment to temp file
# (use the Write tool to create /tmp/pr-walkthrough-comment.md with the comment content)

gh pr comment $PR_NUMBER --body-file /tmp/pr-walkthrough-comment.md
```

### Edit Existing Comment

```bash
# Write updated comment to temp file
# (use the Write tool to create /tmp/pr-walkthrough-comment.md with the comment content)

REPO_INFO=$(gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"')
gh api --method PATCH "repos/$REPO_INFO/issues/comments/$COMMENT_ID" -f body="$(cat /tmp/pr-walkthrough-comment.md)"
```

### After Publishing

1. Clean up the temp file:

```bash
rm -f /tmp/pr-walkthrough-comment.md
```

2. Confirm to the user that the comment was published. Include a direct link to the PR:

```bash
gh pr view $PR_NUMBER --json url --jq '.url'
```

Tell the user the walkthrough is live and reviewers with the PR Walkthrough extension will see the guided view on the Files Changed tab.
