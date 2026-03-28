import { parseNarrativeComment, isNarrativeComment } from '../src/content/parser';

describe('isNarrativeComment', () => {
  it('returns true for comment starting with ## PR Narrative', () => {
    expect(isNarrativeComment('## PR Narrative\n\n### Step one\n- `file.ts`')).toBe(true);
  });

  it('returns true with leading whitespace', () => {
    expect(isNarrativeComment('  ## PR Narrative\n')).toBe(true);
  });

  it('returns false for non-narrative comments', () => {
    expect(isNarrativeComment('This is a regular comment')).toBe(false);
    expect(isNarrativeComment('# PR Narrative')).toBe(false);
    expect(isNarrativeComment('### PR Narrative')).toBe(false);
  });
});

describe('parseNarrativeComment', () => {
  it('parses a single step with files', () => {
    const comment = `## PR Narrative

### API route
The entry point.
- \`src/routes/users.ts\`
- \`src/controllers/userController.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toEqual({
      number: 1,
      title: 'API route',
      description: 'The entry point.',
      files: ['src/routes/users.ts', 'src/controllers/userController.ts'],
    });
    expect(result.allFiles).toEqual(['src/routes/users.ts', 'src/controllers/userController.ts']);
  });

  it('parses multiple steps in document order', () => {
    const comment = `## PR Narrative

### Controllers
- \`src/controllers/a.ts\`

### Services
The business logic.
- \`src/services/b.ts\`

### Tests
- \`tests/a.test.ts\`
- \`tests/b.test.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].number).toBe(1);
    expect(result.steps[0].title).toBe('Controllers');
    expect(result.steps[1].number).toBe(2);
    expect(result.steps[1].title).toBe('Services');
    expect(result.steps[1].description).toBe('The business logic.');
    expect(result.steps[2].number).toBe(3);
    expect(result.steps[2].title).toBe('Tests');
    expect(result.steps[2].files).toEqual(['tests/a.test.ts', 'tests/b.test.ts']);
  });

  it('handles steps with no description', () => {
    const comment = `## PR Narrative

### Renames
- \`src/old.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps[0].description).toBe('');
    expect(result.steps[0].files).toEqual(['src/old.ts']);
  });

  it('handles multi-line descriptions', () => {
    const comment = `## PR Narrative

### Complex change
This is a longer explanation.
It spans multiple lines.
Pay attention to the error handling.
- \`src/complex.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps[0].description).toBe(
      'This is a longer explanation.\nIt spans multiple lines.\nPay attention to the error handling.'
    );
  });

  it('returns empty steps for narrative with no ### headings', () => {
    const comment = `## PR Narrative

Just some text without steps.`;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(0);
    expect(result.allFiles).toEqual([]);
  });

  it('handles steps with no files', () => {
    const comment = `## PR Narrative

### Overview
This step is just context, no files.

### Actual changes
- \`src/foo.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].files).toEqual([]);
    expect(result.steps[1].files).toEqual(['src/foo.ts']);
  });

  it('collects allFiles as unique set across steps', () => {
    const comment = `## PR Narrative

### Step A
- \`src/shared.ts\`
- \`src/a.ts\`

### Step B
- \`src/shared.ts\`
- \`src/b.ts\``;

    const result = parseNarrativeComment(comment);
    expect(result.allFiles).toEqual(['src/shared.ts', 'src/a.ts', 'src/b.ts']);
  });
});
