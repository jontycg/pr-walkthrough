import { PRContext, NarrativeData } from '../types';
import { isNarrativeComment, parseNarrativeComment } from './parser';

export function extractPRContext(): PRContext | null {
  // URL pattern: github.com/:owner/:repo/pull/:number/files
  const match = window.location.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/files/
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
  const url = `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.pullNumber}/comments`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) return null;

  const comments: GitHubComment[] = await response.json();

  // Find the most recent narrative comment (highest ID)
  let narrativeBody: string | null = null;
  for (const comment of comments) {
    if (isNarrativeComment(comment.body)) {
      narrativeBody = comment.body;
    }
  }

  if (!narrativeBody) return null;

  return parseNarrativeComment(narrativeBody);
}
