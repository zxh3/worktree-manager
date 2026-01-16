/**
 * Error handling utilities
 */

/**
 * Custom error class for wt errors
 */
export class WtError extends Error {
  constructor(
    message: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = "WtError";
  }
}

/**
 * Error for when not in a git repository
 */
export class NotInRepoError extends WtError {
  constructor() {
    super(
      "Not a git repository",
      "Run this command from within a git repository"
    );
    this.name = "NotInRepoError";
  }
}

/**
 * Error for when worktree is not found
 */
export class WorktreeNotFoundError extends WtError {
  constructor(name: string) {
    super(
      `Worktree '${name}' not found`,
      "Run 'wt ls' to see available worktrees"
    );
    this.name = "WorktreeNotFoundError";
  }
}

/**
 * Error for when worktree already exists
 */
export class WorktreeExistsError extends WtError {
  constructor(name: string) {
    super(
      `A worktree named '${name}' already exists`,
      `Choose a different name or remove it with 'wt rm ${name}'`
    );
    this.name = "WorktreeExistsError";
  }
}

/**
 * Error for when branch is already checked out
 */
export class BranchCheckedOutError extends WtError {
  constructor(branch: string, worktree: string) {
    super(
      `Branch '${branch}' is already checked out in worktree '${worktree}'`,
      "Use a different branch or remove that worktree first"
    );
    this.name = "BranchCheckedOutError";
  }
}

/**
 * Error for when worktree has uncommitted changes
 */
export class DirtyWorktreeError extends WtError {
  constructor(name: string) {
    super(
      `Worktree '${name}' has uncommitted changes`,
      "Commit, stash, or use --force to discard them"
    );
    this.name = "DirtyWorktreeError";
  }
}

/**
 * Error for attempting to remove primary worktree
 */
export class CannotRemovePrimaryError extends WtError {
  constructor() {
    super(
      "Cannot remove the primary worktree",
      "The primary worktree is the original clone. Use 'rm -rf' if you really want to delete it."
    );
    this.name = "CannotRemovePrimaryError";
  }
}

/**
 * Parse git error output into user-friendly errors
 */
export function parseGitError(stderr: string, context?: { name?: string; branch?: string }): WtError {
  // Branch already checked out
  const checkedOutMatch = stderr.match(/fatal: '([^']+)' is already checked out at '([^']+)'/);
  if (checkedOutMatch) {
    return new BranchCheckedOutError(checkedOutMatch[1], checkedOutMatch[2]);
  }

  // Path already exists
  if (stderr.includes("already exists")) {
    return new WorktreeExistsError(context?.name || "unknown");
  }

  // Dirty worktree
  if (stderr.includes("contains modified or untracked files")) {
    return new DirtyWorktreeError(context?.name || "unknown");
  }

  // Generic error
  return new WtError(stderr.split("\n")[0] || "Unknown error");
}
