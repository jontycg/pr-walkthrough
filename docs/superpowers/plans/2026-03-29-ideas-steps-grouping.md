# Ideas + Steps Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-level grouping to PR Walkthrough — ideas (`###`) containing steps (`####`) — with automatic detection and backwards-compatible flat mode.

**Architecture:** Parser detects `####` presence to switch between flat/grouped modes. Data model keeps steps as a flat array with optional group back-references. Sidebar is the only UI component that changes.

**Tech Stack:** TypeScript, Jest (jsdom), WebExtension content script

**Spec:** `docs/superpowers/specs/2026-03-29-ideas-steps-grouping-design.md`

---

## File Structure

```
src/types.ts                    # Add Group interface, update Step and WalkthroughData
src/content/parser.ts           # Add grouped mode detection and parsing
src/content/ui/sidebar.ts       # Render group headers when groups are present
skill/pr-walkthrough/SKILL.md   # Clarify flat vs grouped output rules
tests/parser.test.ts            # Add grouped mode test cases
```

---

### Task 1: Update data model

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add Group interface and update Step and WalkthroughData**

Update `src/types.ts` to:

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

export interface PRContext {
  owner: string;
  repo: string;
  pullNumber: number;
}
```

- [ ] **Step 2: Run tests to check what breaks**

```bash
npm test
```

Expected: parser tests will fail because `parseWalkthroughComment` doesn't return `groups` or set `group` on steps yet. Note which tests fail — we'll fix them in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Group type and group fields to Step and WalkthroughData"
```

---

### Task 2: Update parser for grouped mode

**Files:**
- Modify: `src/content/parser.ts`
- Modify: `tests/parser.test.ts`

- [ ] **Step 1: Write failing tests for grouped mode**

Add these tests to `tests/parser.test.ts`:

```typescript
describe('grouped mode (#### steps under ### ideas)', () => {
  it('parses a single group with steps', () => {
    const comment = `## PR Walkthrough

### User onboarding
Adds the onboarding flow from route through service.

#### Route handler
Handle the signup request.
- \`src/routes/onboard.ts\`

#### Service layer
- \`src/services/onboard.ts\``;

    const result = parseWalkthroughComment(comment);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toEqual({
      title: 'User onboarding',
      description: 'Adds the onboarding flow from route through service.',
    });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toEqual({
      number: 1,
      title: 'Route handler',
      description: 'Handle the signup request.',
      files: ['src/routes/onboard.ts'],
      group: result.groups[0],
    });
    expect(result.steps[1]).toEqual({
      number: 2,
      title: 'Service layer',
      description: '',
      files: ['src/services/onboard.ts'],
      group: result.groups[0],
    });
  });

  it('parses multiple groups with steps', () => {
    const comment = `## PR Walkthrough

### Signup notification email
Sends a notification when a customer signs up.

#### Email service
- \`src/services/email.ts\`

#### Trigger from onboarding
- \`src/services/onboarding.ts\`

### Reconnect toast
Replaces the default reconnect modal.

#### Toast component
- \`src/components/toast.ts\``;

    const result = parseWalkthroughComment(comment);

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].title).toBe('Signup notification email');
    expect(result.groups[1].title).toBe('Reconnect toast');

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].group).toBe(result.groups[0]);
    expect(result.steps[1].group).toBe(result.groups[0]);
    expect(result.steps[2].group).toBe(result.groups[1]);

    // Step numbers are global across groups
    expect(result.steps[0].number).toBe(1);
    expect(result.steps[1].number).toBe(2);
    expect(result.steps[2].number).toBe(3);

    expect(result.allFiles).toEqual([
      'src/services/email.ts',
      'src/services/onboarding.ts',
      'src/components/toast.ts',
    ]);
  });

  it('handles group with no description', () => {
    const comment = `## PR Walkthrough

### Config changes

#### Build config
- \`webpack.config.js\``;

    const result = parseWalkthroughComment(comment);
    expect(result.groups[0].description).toBe('');
    expect(result.steps[0].group).toBe(result.groups[0]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: the new grouped mode tests fail (no `groups` returned, no `group` on steps). Existing flat mode tests also fail because `group: null` and `groups: []` are missing from results.

- [ ] **Step 3: Update parser to handle both modes**

Replace the contents of `src/content/parser.ts` with:

```typescript
import { Group, Step, WalkthroughData } from '../types';

const WALKTHROUGH_PREFIX = /^\s*## PR Walkthrough\s*$/m;
const H3_HEADING = /^### (.+)$/;
const H4_HEADING = /^#### (.+)$/;
const FILE_ITEM = /^- `([^`]+)`/;

export function isWalkthroughComment(body: string): boolean {
  return WALKTHROUGH_PREFIX.test(body);
}

function detectGroupedMode(lines: string[]): boolean {
  let pastHeader = false;
  for (const line of lines) {
    if (!pastHeader) {
      if (WALKTHROUGH_PREFIX.test(line)) pastHeader = true;
      continue;
    }
    if (H4_HEADING.test(line)) return true;
  }
  return false;
}

export function parseWalkthroughComment(body: string): WalkthroughData {
  const lines = body.split('\n');
  const grouped = detectGroupedMode(lines);
  return grouped ? parseGrouped(lines) : parseFlat(lines);
}

function parseFlat(lines: string[]): WalkthroughData {
  const steps: Step[] = [];
  let current: { title: string; descriptionLines: string[]; files: string[] } | null = null;
  let pastHeader = false;

  for (const line of lines) {
    if (!pastHeader) {
      if (WALKTHROUGH_PREFIX.test(line)) pastHeader = true;
      continue;
    }

    const h3 = line.match(H3_HEADING);
    if (h3) {
      if (current) steps.push(finalizeStep(current, steps.length + 1, null));
      current = { title: h3[1].trim(), descriptionLines: [], files: [] };
      continue;
    }

    if (!current) continue;

    const file = line.match(FILE_ITEM);
    if (file) {
      current.files.push(file[1]);
    } else if (line.trim() !== '' && current.files.length === 0) {
      current.descriptionLines.push(line.trim());
    }
  }

  if (current) steps.push(finalizeStep(current, steps.length + 1, null));

  return {
    steps,
    allFiles: collectUniqueFiles(steps),
    groups: [],
  };
}

function parseGrouped(lines: string[]): WalkthroughData {
  const groups: Group[] = [];
  const steps: Step[] = [];
  let currentGroup: { title: string; descriptionLines: string[] } | null = null;
  let currentStep: { title: string; descriptionLines: string[]; files: string[] } | null = null;
  let pastHeader = false;

  for (const line of lines) {
    if (!pastHeader) {
      if (WALKTHROUGH_PREFIX.test(line)) pastHeader = true;
      continue;
    }

    const h3 = line.match(H3_HEADING);
    if (h3) {
      // Save previous step
      if (currentStep && currentGroup) {
        const group = groups[groups.length - 1];
        steps.push(finalizeStep(currentStep, steps.length + 1, group));
      }
      currentStep = null;

      // Save previous group and start new one
      if (currentGroup) {
        groups.push(finalizeGroup(currentGroup));
      }
      currentGroup = { title: h3[1].trim(), descriptionLines: [] };
      continue;
    }

    const h4 = line.match(H4_HEADING);
    if (h4) {
      // Save previous step
      if (currentStep && currentGroup) {
        const group = groups[groups.length - 1];
        steps.push(finalizeStep(currentStep, steps.length + 1, group));
      }

      // First h4 under a group means we need to finalize the group
      if (currentGroup && groups.length === 0 || (groups.length > 0 && groups[groups.length - 1].title !== currentGroup?.title)) {
        if (currentGroup) groups.push(finalizeGroup(currentGroup));
      }

      currentStep = { title: h4[1].trim(), descriptionLines: [], files: [] };
      continue;
    }

    if (!currentGroup && !currentStep) continue;

    const file = line.match(FILE_ITEM);
    if (file) {
      if (currentStep) currentStep.files.push(file[1]);
    } else if (line.trim() !== '') {
      if (currentStep && currentStep.files.length === 0) {
        currentStep.descriptionLines.push(line.trim());
      } else if (!currentStep && currentGroup) {
        currentGroup.descriptionLines.push(line.trim());
      }
    }
  }

  // Save final group and step
  if (currentGroup && (groups.length === 0 || groups[groups.length - 1].title !== currentGroup.title)) {
    groups.push(finalizeGroup(currentGroup));
  }
  if (currentStep && groups.length > 0) {
    steps.push(finalizeStep(currentStep, steps.length + 1, groups[groups.length - 1]));
  }

  return {
    steps,
    allFiles: collectUniqueFiles(steps),
    groups,
  };
}

function finalizeStep(
  raw: { title: string; descriptionLines: string[]; files: string[] },
  number: number,
  group: Group | null,
): Step {
  return {
    number,
    title: raw.title,
    description: raw.descriptionLines.join('\n'),
    files: raw.files,
    group,
  };
}

function finalizeGroup(raw: { title: string; descriptionLines: string[] }): Group {
  return {
    title: raw.title,
    description: raw.descriptionLines.join('\n'),
  };
}

function collectUniqueFiles(steps: Step[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const step of steps) {
    for (const file of step.files) {
      if (!seen.has(file)) {
        seen.add(file);
        result.push(file);
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Update existing flat mode tests to include group fields**

In the existing `parseWalkthroughComment` tests, update assertions that use `toEqual` on steps to include `group: null`:

For example, the "parses a single step with files" test becomes:

```typescript
expect(result.steps[0]).toEqual({
  number: 1,
  title: 'API route',
  description: 'The entry point.',
  files: ['src/routes/users.ts', 'src/controllers/userController.ts'],
  group: null,
});
```

Also add `expect(result.groups).toEqual([]);` to each existing test.

Apply this pattern to all existing tests that assert on step shape.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass — both existing flat mode tests and new grouped mode tests.

- [ ] **Step 6: Commit**

```bash
git add src/content/parser.ts tests/parser.test.ts
git commit -m "feat: add grouped mode parsing (### ideas with #### steps)"
```

---

### Task 3: Update sidebar to render group headers

**Files:**
- Modify: `src/content/ui/sidebar.ts`
- Modify: `src/content/styles.css`

- [ ] **Step 1: Update createSidebar to accept WalkthroughData instead of just steps**

Change the `createSidebar` signature to accept groups alongside steps. When groups are present, render group headers as non-clickable section dividers.

In `src/content/ui/sidebar.ts`, update the import and function signature:

```typescript
import { Group, Step } from '../../types';
```

Change `createSidebar` to:

```typescript
export function createSidebar(
  steps: Step[],
  groups: Group[],
  activeStep: number,
  callbacks: SidebarCallbacks
): HTMLElement {
```

Replace the step rendering loop (the `for (const step of steps)` block) with:

```typescript
  if (groups.length > 0) {
    // Grouped mode: render group headers with indented steps
    for (const group of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'prn-sidebar-group';

      const groupTitle = document.createElement('div');
      groupTitle.className = 'prn-sidebar-group-title';
      groupTitle.textContent = group.title;
      groupEl.appendChild(groupTitle);

      sidebar.appendChild(groupEl);

      // Render steps belonging to this group
      for (const step of steps.filter(s => s.group === group)) {
        sidebar.appendChild(createStepElement(step, activeStep, steps.length, callbacks));
      }
    }
  } else {
    // Flat mode: render steps directly
    for (const step of steps) {
      sidebar.appendChild(createStepElement(step, activeStep, steps.length, callbacks));
    }
  }
```

Extract the step element creation into a helper (add above `createSidebar`):

```typescript
function createStepElement(
  step: Step,
  activeStep: number,
  totalSteps: number,
  callbacks: SidebarCallbacks,
): HTMLElement {
  const stepEl = document.createElement('div');
  stepEl.className = 'prn-sidebar-step';
  if (step.group) stepEl.classList.add('prn-sidebar-step--grouped');
  if (step.number === activeStep) stepEl.classList.add('prn-sidebar-step--active');
  stepEl.setAttribute('data-prn-step', String(step.number));

  const number = document.createElement('div');
  number.className = 'prn-sidebar-step-number';
  number.textContent = `Step ${step.number} of ${totalSteps}`;
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
  return stepEl;
}
```

- [ ] **Step 2: Add CSS for group headers and indented steps**

Add to `src/content/styles.css`:

```css
.prn-sidebar-group-title {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fgColor-muted, #636c76);
}

.prn-sidebar-step--grouped {
  padding-left: 24px;
}
```

- [ ] **Step 3: Update the call site in index.ts**

In `src/content/index.ts`, find where `createSidebar` is called and add the `groups` argument. It should look like:

```typescript
createSidebar(walkthrough.steps, walkthrough.groups, stepNumber, callbacks)
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: builds successfully with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/content/ui/sidebar.ts src/content/styles.css src/content/index.ts
git commit -m "feat: render group headers in sidebar for grouped walkthroughs"
```

---

### Task 4: Update skill for flat vs grouped output

**Files:**
- Modify: `skill/pr-walkthrough/SKILL.md`

- [ ] **Step 1: Update the Comment Generation section**

In the skill's Comment Generation section, replace the Output Format and Format Rules to clarify when to use flat vs grouped:

The key change: add guidance that single-idea PRs (~8 files or fewer, or one cohesive change) should use flat `###` steps, while multi-idea PRs use `###` ideas with `####` steps. Update the format examples to show both modes.

Also update the grouping derivation section: rename "ideas" language to match the comment format, and clarify that the decision between flat and grouped is based on whether the PR has multiple distinct change areas.

- [ ] **Step 2: Commit**

```bash
git add skill/pr-walkthrough/SKILL.md
git commit -m "docs: clarify flat vs grouped output rules in skill"
```

---

## Self-Review

**Spec coverage:**
- ✅ Comment format: flat and grouped modes with detection rule
- ✅ Data model: `Group` type, `group` on `Step`, `groups` on `WalkthroughData`
- ✅ Parser: detection pass, flat mode unchanged, grouped mode parsing
- ✅ Sidebar: group headers rendered, steps indented, flat mode unchanged
- ✅ Stepper/filter/navigation: explicitly not modified (flat steps array)
- ✅ Skill: flat vs grouped output guidance
- ✅ Backwards compatibility: flat mode is identical to current behavior
- ✅ Tests: grouped mode parser tests

**Placeholder scan:** No TBD/TODO found. Task 4 Step 1 is less specific than other tasks since it's a prose edit to the skill, but the intent is clear and the changes are described.

**Type consistency:** `Group` interface is consistent across types.ts, parser.ts, and sidebar.ts. `step.group` is `Group | null` everywhere. `createSidebar` signature matches its call site update.
