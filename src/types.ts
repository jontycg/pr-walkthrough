export interface Step {
  /** Display number (1-indexed, assigned from document order) */
  number: number;
  /** Step title from ### heading */
  title: string;
  /** Description lines between heading and file list */
  description: string;
  /** File paths extracted from backtick-wrapped list items */
  files: string[];
}

export interface NarrativeData {
  /** All steps in document order */
  steps: Step[];
  /** All unique file paths across all steps */
  allFiles: string[];
}

export interface PRContext {
  owner: string;
  repo: string;
  pullNumber: number;
}
