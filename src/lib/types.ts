/**
 * Core types for the worktree manager
 */

/**
 * Status indicators for worktrees - organized by category
 */

/** Sync status relative to origin/main */
export type SyncStatus = "synced" | "ahead" | "behind" | "diverged";

/** Worktree condition (independent of sync status) */
export type WorktreeCondition = "dirty" | "merged" | "stale" | "orphan";

/** All possible worktree statuses */
export type WorktreeStatus = SyncStatus | WorktreeCondition;

/** All valid status values as a const array (useful for iteration) */
export const SYNC_STATUSES = ["synced", "ahead", "behind", "diverged"] as const;
export const WORKTREE_CONDITIONS = [
  "dirty",
  "merged",
  "stale",
  "orphan",
] as const;
export const ALL_STATUSES = [...SYNC_STATUSES, ...WORKTREE_CONDITIONS] as const;

/** Core worktree data from git */
export interface Worktree {
  /** Directory name of worktree */
  name: string;
  /** Absolute filesystem path */
  path: string;
  /** Git branch name (or HEAD commit if detached) */
  branch: string | null;
  /** HEAD commit hash */
  head: string;
  /** True if this is the main repo clone (has .git directory) */
  isPrimary: boolean;
  /** True if HEAD is detached */
  isDetached: boolean;
  /** True if worktree is locked */
  isLocked: boolean;
  /** True if worktree path is missing (prunable) */
  isPrunable: boolean;
}

/** Worktree with computed status */
export interface WorktreeWithStatus extends Worktree {
  status: WorktreeStatus[];
  /** Commits ahead of upstream/main */
  ahead?: number;
  /** Commits behind upstream/main */
  behind?: number;
  /** Branch used for sync status comparison (e.g., origin/main or main) */
  comparisonBranch?: string;
}

/** Options for creating a new worktree */
export interface CreateWorktreeOptions {
  /** Name for the worktree directory */
  name: string;
  /** Branch to create or checkout */
  branch?: string;
  /** Use an existing branch instead of creating new */
  existingBranch?: string;
  /** Base ref to branch from (for new branches) */
  base?: string;
  /** Track a remote branch instead of creating new */
  track?: string;
  /** Create worktree with detached HEAD */
  detach?: boolean;
}

/** Options for removing a worktree */
export interface RemoveWorktreeOptions {
  /** Force removal even if dirty */
  force?: boolean;
  /** Also delete the branch */
  deleteBranch?: boolean;
}

/** Result of a git operation */
export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Repository information */
export interface RepoInfo {
  /** Absolute path to the git directory */
  gitDir: string;
  /** Absolute path to the worktree root */
  worktreeRoot: string;
  /** Whether this is the primary worktree */
  isPrimary: boolean;
  /** Remote origin URL (if available) */
  remoteUrl: string | null;
  /** Derived repository ID */
  repoId: string;
}
