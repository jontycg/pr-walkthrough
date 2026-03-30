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
