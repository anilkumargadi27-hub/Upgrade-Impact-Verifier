export interface GitHubPrInfo {
  repoOwner: string;
  repoName: string;
  pullNumber: number;
  title: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  mergeBaseSha?: string;
  dependencyName: string;
  baselineVersion: string;
  targetVersion: string;
}

export interface IngestionValidationResult {
  valid: boolean;
  error?: string;
  unsupportedReason?: string;
  prInfo?: GitHubPrInfo;
}

/**
 * Parse a GitHub PR URL into owner, repo, and pull number
 */
export function parseGitHubPrUrl(url: string): { owner: string; repo: string; pullNumber: number } | null {
  const match = url.trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
    pullNumber: parseInt(match[3], 10)
  };
}

/**
 * Parse a GitHub repository URL into owner and repo
 */
export function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.trim().match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, '')
  };
}

/**
 * Validate a GitHub PR for supported UpgradeLens boundaries:
 * - Public repository
 * - Exactly one direct dependency change in package.json / package-lock.json
 * - No unrelated application source changes
 */
export async function inspectAndValidatePr(
  prUrl: string,
  token?: string
): Promise<IngestionValidationResult> {
  const parsed = parseGitHubPrUrl(prUrl);
  if (!parsed) {
    return {
      valid: false,
      error: 'Invalid GitHub PR URL. Must match https://github.com/owner/repo/pull/123'
    };
  }

  const { owner, repo, pullNumber } = parsed;
  const headers: Record<string, string> = {
    'User-Agent': 'UpgradeLens-Bot/1.0',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    // 1. Fetch PR details
    const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, { headers });
    if (prRes.status === 404) {
      return { valid: false, error: 'Repository or Pull Request not found on GitHub (or repository is private).' };
    }
    if (prRes.status === 403) {
      return { valid: false, error: 'GitHub API rate limit exceeded or access denied. Configure GITHUB_TOKEN in settings.' };
    }
    if (!prRes.ok) {
      return { valid: false, error: `GitHub API error (${prRes.status}): ${prRes.statusText}` };
    }

    const prData: any = await prRes.json();

    // 2. Fetch list of modified files in PR
    const filesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`, { headers });
    if (!filesRes.ok) {
      return { valid: false, error: `Failed to fetch PR changed files (${filesRes.status}).` };
    }

    const files: any[] = await filesRes.json();
    const changedFilenames = files.map(f => f.filename);

    // Rule: Reject PRs containing unrelated application source changes
    // Only package.json and package-lock.json (and optional .npmrc / changelog) may be changed in a dependency PR
    const allowedPatterns = [/^package\.json$/, /^package-lock\.json$/, /^\.npmrc$/, /changelog/i];
    const unrelatedFiles = changedFilenames.filter(name => !allowedPatterns.some(p => p.test(name)));

    if (unrelatedFiles.length > 0) {
      return {
        valid: false,
        unsupportedReason: `PR contains ${unrelatedFiles.length} unrelated application source file(s) (e.g. ${unrelatedFiles.slice(0, 3).join(', ')}). UpgradeLens only accepts single isolated dependency update PRs.`
      };
    }

    // Rule: Reject monorepos or other package managers
    const hasOtherLockfiles = changedFilenames.some(name => /yarn\.lock|pnpm-lock\.yaml|bun\.lockb/.test(name));
    if (hasOtherLockfiles) {
      return {
        valid: false,
        unsupportedReason: 'Unsupported package manager detected (yarn, pnpm, or bun). UpgradeLens supports npm with package-lock.json.'
      };
    }

    // Inspect package.json patch to find dependency change
    const pkgFile = files.find(f => f.filename === 'package.json');
    if (!pkgFile || !pkgFile.patch) {
      return {
        valid: false,
        unsupportedReason: 'PR does not modify package.json.'
      };
    }

    // Parse patch to identify changed dependency
    const lines = pkgFile.patch.split('\n');
    const removedDepLines = lines.filter((l: string) => l.startsWith('-') && !l.startsWith('---'));
    const addedDepLines = lines.filter((l: string) => l.startsWith('+') && !l.startsWith('+++'));

    // Extract dependency name and versions
    let depName = '';
    let baseVer = '';
    let targetVer = '';

    const depRegex = /"([^"]+)"\s*:\s*"[\^~]?([^"]+)"/;
    for (const line of addedDepLines) {
      const match = line.match(depRegex);
      if (match && !['name', 'version', 'description', 'scripts'].includes(match[1])) {
        depName = match[1];
        targetVer = match[2];
        break;
      }
    }

    for (const line of removedDepLines) {
      const match = line.match(depRegex);
      if (match && match[1] === depName) {
        baseVer = match[2];
        break;
      }
    }

    if (!depName || !targetVer) {
      return {
        valid: false,
        unsupportedReason: 'Could not extract single direct dependency change from PR package.json diff.'
      };
    }

    return {
      valid: true,
      prInfo: {
        repoOwner: owner,
        repoName: repo,
        pullNumber,
        title: prData.title,
        baseRef: prData.base.ref,
        baseSha: prData.base.sha,
        headRef: prData.head.ref,
        headSha: prData.head.sha,
        dependencyName: depName,
        baselineVersion: baseVer || 'unknown',
        targetVersion: targetVer
      }
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Network error connecting to GitHub: ${err.message}`
    };
  }
}
