/**
 * Git status operations for worktrees
 */

import { git } from "../../utils/exec";
import {
  DEFAULT_BRANCHES,
  REMOTE_DEFAULT_BRANCHES,
  STALE_DAYS_THRESHOLD,
} from "../constants";
import type { WorktreeStatus } from "../types";

export interface WorktreeStatusResult {
  status: WorktreeStatus[];
  ahead?: number;
  behind?: number;
}

/**
 * Get the status of a worktree (dirty, merged, stale, etc.)
 */
export async function getWorktreeStatus(
  worktreePath: string,
  branch: string | null,
): Promise<WorktreeStatusResult> {
  const status: WorktreeStatus[] = [];
  let ahead: number | undefined;
  let behind: number | undefined;

  // Check for uncommitted changes (dirty)
  const statusResult = await git(["status", "--porcelain"], {
    cwd: worktreePath,
  });
  if (statusResult.success && statusResult.stdout.trim()) {
    status.push("dirty");
  }

  // Check ahead/behind using remote-first comparison (origin/main > local main)
  if (branch) {
    const mainBranch = await getMainBranch(worktreePath);
    const comparisonBranch = await getComparisonBranch(worktreePath);

    if (comparisonBranch) {
      // Determine if this is the primary worktree (on main/master branch)
      const isPrimaryWorktree = mainBranch && branch === mainBranch;
      // Primary worktree should only show ahead/behind if comparing to remote
      // (comparing local main to itself doesn't make sense)
      const hasRemoteComparison = comparisonBranch.startsWith("origin/");

      if (!isPrimaryWorktree || hasRemoteComparison) {
        // Calculate ahead/behind for all branches against comparison branch
        const aheadBehindResult = await git(
          ["rev-list", "--left-right", "--count", `${comparisonBranch}...HEAD`],
          { cwd: worktreePath },
        );
        if (aheadBehindResult.success) {
          const parts = aheadBehindResult.stdout.trim().split(/\s+/);
          if (parts.length === 2) {
            const parsedBehind = parseInt(parts[0], 10);
            const parsedAhead = parseInt(parts[1], 10);
            // Validate parsed values before using
            if (!Number.isNaN(parsedBehind) && !Number.isNaN(parsedAhead)) {
              behind = parsedBehind;
              ahead = parsedAhead;
              // Set status based on ahead/behind
              if (ahead > 0 && behind > 0) {
                status.push("diverged");
              } else if (behind > 0) {
                status.push("behind");
              } else if (ahead > 0) {
                status.push("ahead");
              } else {
                status.push("synced");
              }
            }
          }
        }
      }

      // Check if merged to main (only for feature branches that are behind)
      // Skip if synced (ahead=0, behind=0) - that's likely a new branch, not a merged one
      if (mainBranch && branch !== mainBranch && behind && behind > 0) {
        // Use remote main for merge check if available, otherwise local
        const mergeCheckBranch = comparisonBranch.startsWith("origin/")
          ? comparisonBranch
          : mainBranch;
        const mergedResult = await git(
          ["branch", "--merged", mergeCheckBranch],
          {
            cwd: worktreePath,
          },
        );
        if (mergedResult.success) {
          const mergedBranches = mergedResult.stdout
            .split("\n")
            .map((b) => b.trim().replace(/^\*\s*/, ""));
          if (mergedBranches.includes(branch)) {
            status.push("merged");
          }
        }
      }
    }
  }

  // Check if stale (no commits in configured threshold)
  const lastCommitResult = await git(["log", "-1", "--format=%ct"], {
    cwd: worktreePath,
  });
  if (lastCommitResult.success) {
    const timestamp = parseInt(lastCommitResult.stdout.trim(), 10);
    if (!Number.isNaN(timestamp)) {
      const daysSinceCommit = (Date.now() / 1000 - timestamp) / 86400;
      if (daysSinceCommit > STALE_DAYS_THRESHOLD) {
        status.push("stale");
      }
    }
  }

  return { status, ahead, behind };
}

/**
 * Detect the main branch (main or master)
 */
async function getMainBranch(cwd: string): Promise<string | null> {
  for (const branch of DEFAULT_BRANCHES) {
    const result = await git(["rev-parse", "--verify", branch], { cwd });
    if (result.success) {
      return branch;
    }
  }
  return null;
}

/**
 * Get the comparison branch for ahead/behind calculations.
 * Uses remote-first design: tries origin/main first, falls back to local main.
 *
 * Priority:
 * 1. origin/main (or origin/master)
 * 2. local main (or master) - fallback if remote doesn't exist
 */
async function getComparisonBranch(cwd: string): Promise<string | null> {
  // Try remote branches first (source of truth)
  for (const branch of REMOTE_DEFAULT_BRANCHES) {
    const result = await git(["rev-parse", "--verify", branch], { cwd });
    if (result.success) {
      return branch;
    }
  }

  // Fall back to local branches (for repos without remotes or unfetched)
  for (const branch of DEFAULT_BRANCHES) {
    const result = await git(["rev-parse", "--verify", branch], { cwd });
    if (result.success) {
      return branch;
    }
  }

  return null;
}
