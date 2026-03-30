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
  let currentGroup: { title: string; descriptionLines: string[]; finalized: boolean } | null = null;
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
      if (currentStep && currentGroup && currentGroup.finalized) {
        steps.push(finalizeStep(currentStep, steps.length + 1, groups[groups.length - 1]));
      }
      currentStep = null;

      // Finalize previous group if it exists and wasn't finalized yet
      if (currentGroup && !currentGroup.finalized) {
        groups.push(finalizeGroup(currentGroup));
        currentGroup.finalized = true;
      }

      currentGroup = { title: h3[1].trim(), descriptionLines: [], finalized: false };
      continue;
    }

    const h4 = line.match(H4_HEADING);
    if (h4) {
      // Save previous step
      if (currentStep && currentGroup && currentGroup.finalized) {
        steps.push(finalizeStep(currentStep, steps.length + 1, groups[groups.length - 1]));
      }

      // First h4 under a group: finalize the group so steps can reference it
      if (currentGroup && !currentGroup.finalized) {
        groups.push(finalizeGroup(currentGroup));
        currentGroup.finalized = true;
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
  if (currentGroup && !currentGroup.finalized) {
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
