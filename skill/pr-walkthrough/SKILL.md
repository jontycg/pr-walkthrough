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

```bash
gh auth status
```

If this fails, stop and tell the user to run `gh auth login` first.

**Identify the PR** using one of these methods, in priority order:

1. **Argument provided:** If the user gave a PR URL or number, extract the number and use it directly. This is the **remote** path — you'll fetch data via API.

2. **Current branch:** If no argument was given, detect the current branch and look for an open PR:

```bash
gh pr list --head "$(git branch --show-current)" --json number,title --limit 1
```

This is the **local** path — you have the code checked out and can use local git history.

3. **Ask the user:** If neither method finds a PR, ask which PR to generate a walkthrough for.

Once you have the PR number, confirm the PR title with the user before proceeding.

---

## Analysis

Gather the information needed to understand the PR. The approach depends on whether you have the code locally.

### Local path (PR detected from current branch)

You have the code checked out. Use local git for commit analysis — it's faster and doesn't need API calls.

**Get commits:**

```bash
gh pr view $PR_NUMBER --json commits --jq '.commits[] | "\(.oid) \(.messageHeadline)"'
```

**Read each commit's diff** to understand intent:

```bash
git show <SHA>
```

**Get the list of changed files:**

```bash
gh pr diff $PR_NUMBER --name-only
```

**Read each changed file** using the Read tool to understand its role, relationships, and position in the call graph.

### Remote path (PR URL/number provided)

You don't have the code locally. Use the API for everything.

**Get commits and changed files:**

```bash
gh pr view $PR_NUMBER --json commits --jq '.commits[] | "\(.oid) \(.messageHeadline)"'
```

```bash
gh pr diff $PR_NUMBER --name-only
```

**Read the full PR diff** to understand what changed:

```bash
gh pr diff $PR_NUMBER
```

### What to look for

Whether local or remote, build a mental model:

- **Intent:** What is the primary goal of this PR? What are secondary changes?
- **File roles:** Classify each file — entry point, service, utility, type definition, test, config.
- **Relationships:** Which files import from each other? Which tests correspond to which source files?
- **Code flows:** Trace from entry point(s) through the call stack. Identify distinct flows the PR touches.

For single-commit PRs, the commit message gives limited signal. Rely on file analysis.

For very large PRs (50+ files), focus on entry points and the most-changed files. Skim the rest.

---

## Derive Groupings

Organize the changed files into a two-level hierarchy: **groups** containing **steps**.

- A **group** represents a cohesive set of related changes (e.g., "User onboarding flow", "Email resend feature", "Shared utilities").
- A **step** within a group traces one code flow from entry point through the call stack (e.g., "Route handler → service → database", "Tests").

For small PRs with a single feature, use one group with multiple steps. For PRs that touch multiple features or areas, use multiple groups.

### Grouping Principles

1. **Each group = one cohesive change area.** A feature, a refactor, a bugfix. The reviewer should understand what the group is about from its title alone.

2. **Each step = one code flow within the group.** Trace from entry point through services, helpers, and data layers. Don't group by file type (all routes, all services) — group by execution path.

3. **Test files alongside their code** — put tests in the same step as the code they test, unless tests massively outnumber source files (2:1+), in which case give tests their own step within the group.

4. **Most important group first.** The primary feature or fix comes before supporting changes, refactors, or config.

5. **Step descriptions explain "why", not "what".** "Validates webhook payloads before processing to prevent malformed data reaching the service layer" beats "Validation changes".

### Interactive grouping (PR detected from current branch)

Generate 2-3 candidate grouping strategies and present them to the user using AskUserQuestion. Each option should have:
- A short label
- A description listing the groups and their steps with file counts

**Exception:** If the PR is small (fewer than 8 files) or has an obvious single flow, skip the survey and use the best grouping directly.

### Auto grouping (PR URL/number provided)

Pick the best grouping without prompting. Default to tracing code flows from entry points inward.

---

## Comment Generation

Generate the walkthrough comment in the format required by the PR Walkthrough browser extension.

### Output Format

```
## PR Walkthrough

### [Group Title]
[1-3 sentence description of this group of changes and what to focus on]

#### [Step Title]
- `[exact/path/to/file]`
- `[exact/path/to/another-file]`

#### [Step Title]
- `[exact/path/to/file]`

### [Next Group Title]
[1-3 sentence description]

#### [Step Title]
- `[exact/path/to/file]`
```

### Format Rules

- The comment MUST start with `## PR Walkthrough` on its own line (magic prefix for the extension).
- Groups use `### ` headings (h3). Steps within groups use `#### ` headings (h4).
- Group descriptions are plain text between the `###` heading and the first `####` step. Keep to 1-3 sentences.
- Steps do NOT have descriptions — just a title and file list.
- Files are listed as `- \`path/to/file\`` with exact paths from `gh pr diff --name-only`.
- Blank line between groups. Blank line between the group description and first step.
- **Every changed file must appear in exactly one step.** Cross-reference against the full file list.
- For single-group PRs, you can omit the `####` step level and list files directly under the `###` heading (flat format, backwards compatible).

### Review Loop

1. Show the full comment to the user in a code block.
2. Ask if they want changes (reorder, rename, move files, edit descriptions).
3. Iterate until approved.

---

## Publish

Before publishing, check for an existing walkthrough comment:

```bash
gh api "repos/$(gh repo view --json nameWithOwner --jq '.nameWithOwner')/issues/$PR_NUMBER/comments" --jq '.[] | select(.body | startswith("## PR Walkthrough")) | {id: .id, author: .user.login}'
```

- **No existing comment:** Post a new one.
- **Existing comment by you:** Update it.
- **Existing comment by someone else:** Warn the user and ask whether to post a second one.

**Post the comment** using a heredoc to avoid escaping issues:

```bash
gh pr comment $PR_NUMBER --body "$(cat <<'WALKTHROUGH_EOF'
## PR Walkthrough

...full comment here...
WALKTHROUGH_EOF
)"
```

**Or update an existing comment:**

```bash
gh api --method PATCH "repos/$(gh repo view --json nameWithOwner --jq '.nameWithOwner')/issues/comments/$COMMENT_ID" -f body="$(cat <<'WALKTHROUGH_EOF'
## PR Walkthrough

...full comment here...
WALKTHROUGH_EOF
)"
```

After publishing, confirm with a link to the PR:

```bash
gh pr view $PR_NUMBER --json url --jq '.url'
```
