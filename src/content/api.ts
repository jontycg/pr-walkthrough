import { PRContext, NarrativeData } from '../types';
import { isNarrativeComment, parseNarrativeComment } from './parser';

export function extractPRContext(): PRContext | null {
  // URL pattern: github.com/:owner/:repo/pull/:number/files or /changes
  const match = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(?:files|changes)/
  );
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    pullNumber: parseInt(match[3], 10),
  };
}

interface GitHubComment {
  id: number;
  body: string;
}

export async function fetchNarrative(ctx: PRContext): Promise<NarrativeData | null> {
  // Try same-origin first (works for private repos since it carries session cookies)
  // GitHub's timeline page contains all comments — we fetch the HTML and parse it
  const conversationUrl = `https://github.com/${ctx.owner}/${ctx.repo}/pull/${ctx.pullNumber}`;
  try {
    const response = await fetch(conversationUrl, {
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    return extractNarrativeFromHTML(html);
  } catch {
    return null;
  }
}

function extractNarrativeFromHTML(html: string): NarrativeData | null {
  // Parse the HTML and find comment bodies
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // GitHub renders comment bodies in elements with classes like .comment-body or .markdown-body
  const commentBodies = doc.querySelectorAll('.comment-body, td.comment-body .markdown-body, .timeline-comment .markdown-body');

  let narrativeBody: string | null = null;
  for (const el of commentBodies) {
    const text = el.textContent || '';
    if (text.trim().startsWith('PR Narrative')) {
      // Get the raw markdown-ish content from the rendered HTML
      // We need to reconstruct the markdown from the DOM structure
      const markdown = htmlCommentToMarkdown(el as HTMLElement);
      if (isNarrativeComment(markdown)) {
        narrativeBody = markdown;
      }
    }
  }

  if (!narrativeBody) return null;
  return parseNarrativeComment(narrativeBody);
}

function htmlCommentToMarkdown(el: HTMLElement): string {
  const lines: string[] = [];

  for (const child of el.children) {
    const tag = child.tagName.toLowerCase();
    const text = child.textContent?.trim() || '';

    if (tag === 'h2') {
      lines.push(`## ${text}`);
    } else if (tag === 'h3') {
      lines.push(`### ${text}`);
    } else if (tag === 'p') {
      lines.push(text);
    } else if (tag === 'ul') {
      for (const li of child.children) {
        // Look for code elements inside list items
        const code = li.querySelector('code');
        if (code) {
          lines.push(`- \`${code.textContent?.trim()}\``);
        } else {
          lines.push(`- ${li.textContent?.trim()}`);
        }
      }
    }
  }

  return lines.join('\n');
}
