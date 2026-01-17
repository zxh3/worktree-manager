/**
 * Git log operations for commit info retrieval
 */

import { git } from "../../utils/exec";

export interface CommitInfo {
  timestamp: number;
  message: string;
}

/**
 * Get commit info (timestamp and message) for a worktree
 * Fetches on-demand from the HEAD commit
 */
export async function getCommitInfo(
  worktreePath: string,
): Promise<CommitInfo | null> {
  // Get timestamp and subject in one call: %ct = commit timestamp, %s = subject
  const result = await git(["log", "-1", "--format=%ct%n%s"], {
    cwd: worktreePath,
  });

  if (!result.success) {
    return null;
  }

  const lines = result.stdout.trim().split("\n");
  if (lines.length < 2) {
    return null;
  }

  const timestamp = parseInt(lines[0], 10);
  const message = lines.slice(1).join("\n"); // In case subject has newlines (shouldn't, but safe)

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return { timestamp, message };
}

/**
 * Format a timestamp as a human-readable age string
 * Examples: "now", "2h", "5d", "3w", "2m"
 */
export function formatAge(timestamp: number): string {
  const now = Date.now() / 1000;
  const seconds = now - timestamp;

  if (seconds < 3600) {
    // Less than 1 hour
    return "now";
  }

  const hours = seconds / 3600;
  if (hours < 24) {
    return `${Math.floor(hours)}h`;
  }

  const days = hours / 24;
  if (days < 7) {
    return `${Math.floor(days)}d`;
  }

  const weeks = days / 7;
  if (weeks < 5) {
    return `${Math.floor(weeks)}w`;
  }

  const months = days / 30;
  return `${Math.floor(months)}m`;
}
