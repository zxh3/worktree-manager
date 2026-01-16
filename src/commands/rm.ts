/**
 * wt rm - Remove a worktree
 */

import { removeWorktree, findWorktree } from "../lib/git/worktree";
import { isInsideGitRepo } from "../lib/git/repo";
import { formatError, formatSuccess, formatHint, formatWarning } from "../utils/format";
import {
  NotInRepoError,
  WorktreeNotFoundError,
  CannotRemovePrimaryError,
  parseGitError,
} from "../utils/errors";

export interface RmOptions {
  force?: boolean;
  deleteBranch?: boolean;
}

export async function rm(name: string, options: RmOptions = {}): Promise<void> {
  // Check if we're in a git repo
  if (!(await isInsideGitRepo())) {
    console.error(formatError(new NotInRepoError().message));
    process.exit(1);
  }

  try {
    // Find the worktree
    const worktree = await findWorktree(name);
    if (!worktree) {
      const error = new WorktreeNotFoundError(name);
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    // Cannot remove primary worktree
    if (worktree.isPrimary) {
      const error = new CannotRemovePrimaryError();
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    // Remove the worktree
    const result = await removeWorktree(worktree.path, {
      force: options.force,
    });

    if (!result.success) {
      const error = parseGitError(result.stderr, { name });
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    console.log(formatSuccess(`Removed worktree '${name}'`));

    // Note about branch deletion
    if (worktree.branch && !options.deleteBranch) {
      console.log(formatHint(`Branch '${worktree.branch}' was not deleted. Delete it with: git branch -d ${worktree.branch}`));
    }
  } catch (error) {
    console.error(formatError(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
