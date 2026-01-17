/**
 * Git repository detection and information
 */

import { resolve } from "node:path";
import { git } from "../../utils/exec";
import { deriveRepoId } from "../paths";
import type { RepoInfo } from "../types";

/**
 * Check if we're inside a git repository
 */
export async function isInsideGitRepo(cwd?: string): Promise<boolean> {
  const result = await git(["rev-parse", "--is-inside-work-tree"], { cwd });
  return result.success && result.stdout === "true";
}

/**
 * Get the root directory of the current worktree
 */
export async function getWorktreeRoot(cwd?: string): Promise<string | null> {
  const result = await git(["rev-parse", "--show-toplevel"], { cwd });
  return result.success ? result.stdout : null;
}

/**
 * Get the git directory path
 * For primary worktree: /path/to/repo/.git
 * For worktree: /path/to/repo/.git/worktrees/<name>
 */
export async function getGitDir(cwd?: string): Promise<string | null> {
  const result = await git(["rev-parse", "--git-dir"], { cwd });
  if (!result.success) return null;

  // Resolve to absolute path
  const gitDir = result.stdout;
  if (gitDir.startsWith("/")) {
    return gitDir;
  }
  return resolve(cwd || process.cwd(), gitDir);
}

/**
 * Get the common git directory (always the main .git directory)
 */
export async function getCommonGitDir(cwd?: string): Promise<string | null> {
  const result = await git(["rev-parse", "--git-common-dir"], { cwd });
  if (!result.success) return null;

  const commonDir = result.stdout;
  if (commonDir.startsWith("/")) {
    return commonDir;
  }
  return resolve(cwd || process.cwd(), commonDir);
}

/**
 * Check if the current directory is the primary worktree (original clone)
 */
export async function isPrimaryWorktree(cwd?: string): Promise<boolean> {
  const gitDir = await getGitDir(cwd);
  const commonDir = await getCommonGitDir(cwd);

  if (!gitDir || !commonDir) return false;

  // Primary worktree has gitDir === commonDir
  return gitDir === commonDir;
}

/**
 * Get the remote origin URL
 */
export async function getRemoteUrl(cwd?: string): Promise<string | null> {
  const result = await git(["remote", "get-url", "origin"], { cwd });
  return result.success ? result.stdout : null;
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(cwd?: string): Promise<string | null> {
  const result = await git(["symbolic-ref", "--short", "HEAD"], { cwd });
  return result.success ? result.stdout : null;
}

/**
 * Get the current HEAD commit
 */
export async function getHead(cwd?: string): Promise<string | null> {
  const result = await git(["rev-parse", "HEAD"], { cwd });
  return result.success ? result.stdout : null;
}

/**
 * Get comprehensive repository information
 */
export async function getRepoInfo(cwd?: string): Promise<RepoInfo | null> {
  const [worktreeRoot, gitDir, commonDir, remoteUrl] = await Promise.all([
    getWorktreeRoot(cwd),
    getGitDir(cwd),
    getCommonGitDir(cwd),
    getRemoteUrl(cwd),
  ]);

  if (!worktreeRoot || !gitDir || !commonDir) {
    return null;
  }

  const isPrimary = gitDir === commonDir;
  const repoId = deriveRepoId(remoteUrl, worktreeRoot);

  return {
    gitDir,
    worktreeRoot,
    isPrimary,
    remoteUrl,
    repoId,
  };
}
