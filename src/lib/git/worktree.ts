/**
 * Git worktree operations
 */

import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { fileExists, readFileText } from "../../utils/compat";
import { git } from "../../utils/exec";
import type {
  CreateWorktreeOptions,
  GitResult,
  RemoveWorktreeOptions,
  Worktree,
} from "../types";

/**
 * Parse git worktree list --porcelain output into Worktree objects
 * Note: isPrimary is set to false here, should be determined by checkPrimaryWorktree()
 */
export function parseWorktreeList(
  output: string,
): Omit<Worktree, "isPrimary">[] {
  const worktrees: Omit<Worktree, "isPrimary">[] = [];
  const blocks = output.split("\n\n").filter((block) => block.trim());

  for (const block of blocks) {
    const lines = block.split("\n");
    const worktree: Partial<Worktree> = {
      isDetached: false,
      isLocked: false,
      isPrunable: false,
    };

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        worktree.path = line.slice(9);
        worktree.name = basename(worktree.path);
      } else if (line.startsWith("HEAD ")) {
        worktree.head = line.slice(5);
      } else if (line.startsWith("branch ")) {
        // Format: refs/heads/branch-name
        worktree.branch = line.slice(7).replace(/^refs\/heads\//, "");
      } else if (line === "detached") {
        worktree.isDetached = true;
        worktree.branch = null;
      } else if (line === "locked") {
        worktree.isLocked = true;
      } else if (line === "prunable") {
        worktree.isPrunable = true;
      } else if (line === "bare") {
      }
    }

    if (worktree.path && worktree.head) {
      worktrees.push(worktree as Omit<Worktree, "isPrimary">);
    }
  }

  return worktrees;
}

/**
 * Check if a worktree path is the primary worktree.
 * Primary worktree has .git as a directory, secondary has .git as a file.
 */
async function checkPrimaryWorktree(worktreePath: string): Promise<boolean> {
  try {
    const gitPath = `${worktreePath}/.git`;

    // Check if .git exists and what type it is
    try {
      const gitStat = await stat(gitPath);
      // If .git is a directory, it's the primary worktree
      // If .git is a file, it's a secondary worktree (contains gitdir pointer)
      return gitStat.isDirectory();
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * List all worktrees for the current repository
 */
export async function listWorktrees(cwd?: string): Promise<Worktree[]> {
  const result = await git(["worktree", "list", "--porcelain"], { cwd });
  if (!result.success) {
    throw new Error(result.stderr || "Failed to list worktrees");
  }
  const worktrees = parseWorktreeList(result.stdout);

  // Determine which worktree is primary by checking .git type
  const withPrimary = await Promise.all(
    worktrees.map(async (wt) => ({
      ...wt,
      isPrimary: await checkPrimaryWorktree(wt.path),
    })),
  );

  return withPrimary;
}

/**
 * Find a worktree by name
 */
export async function findWorktree(
  name: string,
  cwd?: string,
): Promise<Worktree | null> {
  const worktrees = await listWorktrees(cwd);
  return worktrees.find((wt) => wt.name === name) || null;
}

/**
 * Find a worktree by path
 */
export async function findWorktreeByPath(
  path: string,
  cwd?: string,
): Promise<Worktree | null> {
  const worktrees = await listWorktrees(cwd);
  return worktrees.find((wt) => wt.path === path) || null;
}

/**
 * Create a new worktree
 */
export async function createWorktree(
  path: string,
  options: CreateWorktreeOptions,
  cwd?: string,
): Promise<GitResult> {
  const args = ["worktree", "add"];

  if (options.detach) {
    args.push("--detach");
  }

  if (options.existingBranch) {
    // Use an existing branch (no -b flag)
    args.push(path);
    args.push(options.existingBranch);
  } else if (options.track) {
    // Track a remote branch
    args.push("--track", "-b", options.branch || options.name);
    args.push(path);
    args.push(options.track);
  } else if (options.branch) {
    // Create with specific branch name
    args.push("-b", options.branch);
    args.push(path);
    if (options.base) {
      args.push(options.base);
    }
  } else {
    // Create with auto-generated branch name (same as worktree name)
    args.push("-b", options.name);
    args.push(path);
    if (options.base) {
      args.push(options.base);
    }
  }

  return git(args, { cwd });
}

/**
 * Remove a worktree
 */
export async function removeWorktree(
  pathOrName: string,
  options: RemoveWorktreeOptions = {},
  cwd?: string,
  branchName?: string,
): Promise<GitResult> {
  const args = ["worktree", "remove"];

  if (options.force) {
    args.push("--force");
  }

  args.push(pathOrName);

  const result = await git(args, { cwd });

  // Delete the branch too (if provided and removal succeeded)
  if (result.success && branchName) {
    // Try to delete the branch (use -d for safe delete, only if merged)
    await git(["branch", "-d", branchName], { cwd });
    // If -d fails (not merged), we silently ignore - user can force delete manually
  }

  return result;
}

/**
 * Move/rename a worktree
 */
export async function moveWorktree(
  oldPath: string,
  newPath: string,
  cwd?: string,
): Promise<GitResult> {
  return git(["worktree", "move", oldPath, newPath], { cwd });
}

/**
 * Lock a worktree
 */
export async function lockWorktree(
  path: string,
  reason?: string,
  cwd?: string,
): Promise<GitResult> {
  const args = ["worktree", "lock"];
  if (reason) {
    args.push("--reason", reason);
  }
  args.push(path);
  return git(args, { cwd });
}

/**
 * Unlock a worktree
 */
export async function unlockWorktree(
  path: string,
  cwd?: string,
): Promise<GitResult> {
  return git(["worktree", "unlock", path], { cwd });
}

/**
 * Prune worktree administrative files
 */
export async function pruneWorktrees(cwd?: string): Promise<GitResult> {
  return git(["worktree", "prune"], { cwd });
}

/**
 * Get the worktree name from a path (extracts from .git file for worktrees)
 */
export async function getWorktreeNameFromPath(
  dirPath: string,
): Promise<string | null> {
  try {
    const gitPath = `${dirPath}/.git`;
    if (await fileExists(gitPath)) {
      const content = await readFileText(gitPath);
      // File content: gitdir: /path/to/main/.git/worktrees/<name>
      const match = content.match(/worktrees\/([^/\s]+)/);
      if (match) {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}
