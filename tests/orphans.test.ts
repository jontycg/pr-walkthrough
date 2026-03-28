import { computeOrphans } from '../src/content/ui/orphans';

describe('computeOrphans', () => {
  it('returns files not covered by narrative', () => {
    const prFiles = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
    const narrativeFiles = ['src/a.ts', 'src/b.ts'];
    expect(computeOrphans(prFiles, narrativeFiles)).toEqual(['src/c.ts']);
  });

  it('returns empty when all files covered', () => {
    const prFiles = ['src/a.ts', 'src/b.ts'];
    const narrativeFiles = ['src/a.ts', 'src/b.ts'];
    expect(computeOrphans(prFiles, narrativeFiles)).toEqual([]);
  });

  it('uses suffix matching', () => {
    const prFiles = ['packages/app/src/a.ts'];
    const narrativeFiles = ['src/a.ts'];
    expect(computeOrphans(prFiles, narrativeFiles)).toEqual([]);
  });
});
