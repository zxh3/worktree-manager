/**
 * Shared constants across the application
 */

/** Default branch names to check for main branch detection */
export const DEFAULT_BRANCHES = ["main", "master"] as const;

/** Remote branch names to check (with origin prefix) */
export const REMOTE_DEFAULT_BRANCHES = [
  "origin/main",
  "origin/master",
] as const;

/** Valid characters for worktree/branch names */
export const VALID_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/** Reserved names that cannot be used for worktrees */
export const RESERVED_NAMES = [".", "..", ".git", "HEAD"] as const;

/** Maximum length for worktree names */
export const MAX_NAME_LENGTH = 50;

/** Number of days without commits before a branch is considered stale */
export const STALE_DAYS_THRESHOLD = 30;
