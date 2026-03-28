import { Step, WalkthroughData } from '../types';

const WALKTHROUGH_PREFIX = /^\s*## PR Walkthrough\s*$/m;
const STEP_HEADING = /^### (.+)$/;
const FILE_ITEM = /^- `([^`]+)`/;

export function isWalkthroughComment(body: string): boolean {
  return WALKTHROUGH_PREFIX.test(body);
}

export function parseWalkthroughComment(body: string): WalkthroughData {
  const lines = body.split('\n');
  const steps: Step[] = [];
  let currentStep: { title: string; descriptionLines: string[]; files: string[] } | null = null;
  let pastHeader = false;

  for (const line of lines) {
    // Skip until we're past the ## PR Walkthrough header
    if (!pastHeader) {
      if (WALKTHROUGH_PREFIX.test(line)) {
        pastHeader = true;
      }
      continue;
    }

    const stepMatch = line.match(STEP_HEADING);
    if (stepMatch) {
      // Save previous step
      if (currentStep) {
        steps.push(finalizeStep(currentStep, steps.length + 1));
      }
      currentStep = { title: stepMatch[1].trim(), descriptionLines: [], files: [] };
      continue;
    }

    if (!currentStep) continue;

    const fileMatch = line.match(FILE_ITEM);
    if (fileMatch) {
      currentStep.files.push(fileMatch[1]);
    } else if (line.trim() !== '') {
      // Only add to description if we haven't started the file list yet
      if (currentStep.files.length === 0) {
        currentStep.descriptionLines.push(line.trim());
      }
    }
  }

  // Save last step
  if (currentStep) {
    steps.push(finalizeStep(currentStep, steps.length + 1));
  }

  const allFilesSet = new Set<string>();
  for (const step of steps) {
    for (const file of step.files) {
      allFilesSet.add(file);
    }
  }

  return {
    steps,
    allFiles: Array.from(allFilesSet),
  };
}

function finalizeStep(
  raw: { title: string; descriptionLines: string[]; files: string[] },
  number: number
): Step {
  return {
    number,
    title: raw.title,
    description: raw.descriptionLines.join('\n'),
    files: raw.files,
  };
}
