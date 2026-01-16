/**
 * Path resolution and repository ID derivation
 */

import { createHash } from "crypto";
import { basename, join } from "path";
import { homedir } from "os";

/** Default base directory for worktrees */
export const DEFAULT_WORKTREE_BASE = join(homedir(), ".worktrees");

/**
 * Derive a unique repository ID from the remote URL or directory path
 *
 * Examples:
 * - git@github.com:user/repo.git -> github.com-user-repo
 * - https://github.com/user/repo -> github.com-user-repo
 * - (no remote) /Users/dev/myproject -> myproject-a1b2c3d4
 */
export function deriveRepoId(
  remoteUrl: string | null,
  fallbackPath: string
): string {
  if (remoteUrl) {
    return deriveRepoIdFromUrl(remoteUrl);
  }
  return deriveRepoIdFromPath(fallbackPath);
}

/**
 * Derive repo ID from a git remote URL
 */
export function deriveRepoIdFromUrl(url: string): string {
  // Handle SSH format: git@github.com:user/repo.git
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    const [, host, path] = sshMatch;
    return `${host}-${path.replace(/\//g, "-")}`;
  }

  // Handle HTTPS format: https://github.com/user/repo or https://github.com/user/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    const [, host, path] = httpsMatch;
    return `${host}-${path.replace(/\//g, "-")}`;
  }

  // Fallback: hash the URL
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 8);
  return `repo-${hash}`;
}

/**
 * Derive repo ID from a directory path (fallback when no remote)
 */
export function deriveRepoIdFromPath(dirPath: string): string {
  const dirName = basename(dirPath);
  const hash = createHash("sha256").update(dirPath).digest("hex").slice(0, 8);
  return `${dirName}-${hash}`;
}

/**
 * Resolve the worktree path for a given worktree name
 */
export function resolveWorktreePath(
  repoId: string,
  worktreeName: string,
  baseDir: string = DEFAULT_WORKTREE_BASE
): string {
  return join(baseDir, repoId, worktreeName);
}

/**
 * Expand ~ in paths to home directory
 */
export function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  if (path === "~") {
    return homedir();
  }
  return path;
}

/**
 * Contract home directory to ~ for display
 */
export function contractHome(path: string): string {
  const home = homedir();
  if (path === home) {
    return "~";
  }
  if (path.startsWith(home + "/")) {
    return "~" + path.slice(home.length);
  }
  return path;
}
