import crypto from 'crypto';
import { config } from '../config';

interface GithubIssue {
  number: number;
  html_url: string;
  state: 'open' | 'closed';
}

function githubApiUrl(path: string): string {
  return `https://api.github.com${path}`;
}

function issueApiPath(issueNumber?: number): string {
  const base = `/repos/${config.github.owner}/${config.github.repo}/issues`;
  return issueNumber ? `${base}/${issueNumber}` : base;
}

function githubHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.github.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'furnlo-api-error-reporter',
  };
}

export function isGithubIssueIntegrationEnabled(): boolean {
  return Boolean(
    config.github.issuesEnabled &&
      config.github.owner &&
      config.github.repo &&
      config.github.token,
  );
}

export async function createGithubIssue(params: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<GithubIssue> {
  const response = await fetch(githubApiUrl(issueApiPath()), {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({
      title: params.title,
      body: params.body,
      labels: params.labels ?? [config.github.issueLabel],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub issue create failed (${response.status}): ${text}`);
  }
  return (await response.json()) as GithubIssue;
}

export async function getGithubIssue(issueNumber: number): Promise<GithubIssue> {
  const response = await fetch(githubApiUrl(issueApiPath(issueNumber)), {
    method: 'GET',
    headers: githubHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub issue fetch failed (${response.status}): ${text}`);
  }
  return (await response.json()) as GithubIssue;
}

export async function reopenGithubIssue(issueNumber: number): Promise<GithubIssue> {
  const response = await fetch(githubApiUrl(issueApiPath(issueNumber)), {
    method: 'PATCH',
    headers: githubHeaders(),
    body: JSON.stringify({ state: 'open' }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub issue reopen failed (${response.status}): ${text}`);
  }
  return (await response.json()) as GithubIssue;
}

export function verifyGithubWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = config.github.webhookSecret;
  if (!secret || !signatureHeader) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
