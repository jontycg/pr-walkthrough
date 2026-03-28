import { computeOrphans } from '../src/content/ui/orphans';

describe('computeOrphans', () => {
  it('returns files not covered by walkthrough', () => {
    const prFiles = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
    const walkthroughFiles = ['src/a.ts', 'src/b.ts'];
    expect(computeOrphans(prFiles, walkthroughFiles)).toEqual(['src/c.ts']);
  });

  it('returns empty when all files covered', () => {
    const prFiles = ['src/a.ts', 'src/b.ts'];
    const walkthroughFiles = ['src/a.ts', 'src/b.ts'];
    expect(computeOrphans(prFiles, walkthroughFiles)).toEqual([]);
  });

  it('uses suffix matching', () => {
    const prFiles = ['packages/app/src/a.ts'];
    const walkthroughFiles = ['src/a.ts'];
    expect(computeOrphans(prFiles, walkthroughFiles)).toEqual([]);
  });
});
