# Ideas + Steps Grouping Design

**Goal:** Add a two-level hierarchy to PR Walkthrough comments — **ideas** (cohesive change areas) containing **steps** (code flows) — while keeping navigation linear and remaining fully backwards compatible with the existing flat format.

---

## Comment Format

Two modes, detected automatically by the parser based on whether `####` headings appear.

### Flat mode (single idea or simple PR)

```
## PR Walkthrough

### Step Title
Description text.

- `path/to/file`

### Step Title
Description text.

- `path/to/file`
```

### Grouped mode (multi-idea PR)

```
## PR Walkthrough

### Idea Title
Idea description (parsed but only shown in sidebar).

#### Step Title
Step description.

- `path/to/file`

#### Step Title
Step description.

- `path/to/file`

### Another Idea
Idea description.

#### Step Title
Step description.

- `path/to/file`
```

### Detection rule

If any `####` heading appears after `## PR Walkthrough`, treat `###` as ideas and `####` as steps. Otherwise `###` are flat steps. This is fully backwards compatible — existing flat comments parse identically to today.

---

## Data Model

```typescript
export interface Group {
  /** Group title from ### heading (in grouped mode) */
  title: string;
  /** Group description (shown in sidebar only) */
  description: string;
}

export interface Step {
  /** Display number (1-indexed across all steps, regardless of group) */
  number: number;
  /** Step title from ### or #### heading */
  title: string;
  /** Description lines between heading and file list */
  description: string;
  /** File paths extracted from backtick-wrapped list items */
  files: string[];
  /** Optional group this step belongs to (null in flat mode) */
  group: Group | null;
}

export interface WalkthroughData {
  /** All steps in document order (flat list, linear navigation) */
  steps: Step[];
  /** All unique file paths across all steps */
  allFiles: string[];
  /** Distinct groups in document order (empty in flat mode) */
  groups: Group[];
}
```

Key decisions:

- **Steps stay as a flat array.** Navigation (prev/next) is always linear across all steps regardless of grouping. `step.group` is a back-reference for sidebar rendering.
- **`groups` on `WalkthroughData`** is a convenience for the sidebar to iterate over groups without deduplicating from steps.
- **In flat mode:** `groups` is empty, every step has `group: null`. Stepper, filter, and prev/next logic don't need to check for groups at all.

---

## Parser Changes

The parser adds a detection pass before the main parse loop:

1. Scan for any `####` heading after the `## PR Walkthrough` header.
2. If found → **grouped mode:** `###` = group, `####` = step.
3. If not found → **flat mode:** `###` = step (current behaviour, unchanged).

### Grouped mode parsing

- When a `###` heading is encountered, create a new `Group` with its title. Collect description lines until the first `####` or next `###`.
- When a `####` heading is encountered, create a `Step` with `group` pointing to the current group. Collect description lines and file items as before.

### Flat mode parsing

Identical to current parser. Steps get `group: null`.

`isWalkthroughComment()` is unchanged — it still checks for the `## PR Walkthrough` prefix.

---

## UI Changes

### Sidebar

When `groups` is non-empty, the sidebar renders ideas as non-clickable section headers with steps indented underneath:

```
[Idea Title]            ← non-clickable section header
  1. Step title         ← clickable, indented
  2. Step title         ← clickable, indented

[Another Idea]          ← non-clickable section header
  3. Step title         ← clickable, indented
  4. Step title         ← clickable, indented
```

Step numbers are global (continuous across groups), matching the linear prev/next flow.

When `groups` is empty, the sidebar renders flat steps exactly as it does today.

### Stepper, filter, prev/next

Zero changes. These components only see the flat `steps` array and are unaware of groups.

---

## Skill Changes

The skill already outputs `###`/`####` format. Refinements:

- **Single-idea PRs** (~8 files or fewer, or one cohesive change): output flat `###` steps only. No `####` headings.
- **Multi-idea PRs**: output `###` for each idea with a description, `####` for steps within each idea.

Grouping principles are unchanged — ideas are cohesive change areas, steps trace code flows from entry points through the call stack.

---

## Scope

### Files to modify

- `src/types.ts` — add `Group` interface, update `Step` and `WalkthroughData`
- `src/content/parser.ts` — add grouped mode detection and parsing
- `src/content/ui/sidebar.ts` — render group headers when `groups` is non-empty
- `skill/pr-walkthrough/SKILL.md` — clarify flat vs grouped output rules
- Parser tests — add cases for grouped mode

### Files NOT modified

- `src/content/filter.ts` — works on flat step file lists, unchanged
- `src/content/ui/stepper.ts` — works on flat step array, unchanged
- `src/content/ui/entryButton.ts` — unrelated
- `src/content/index.ts` — navigation logic uses flat step array, unchanged
