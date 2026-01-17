/**
 * wt mv - Move/rename a worktree
 */

import { getConfig } from "../lib/config";
import { getRepoInfo, isInsideGitRepo } from "../lib/git/repo";
import { findWorktree, moveWorktree } from "../lib/git/worktree";
import { resolveWorktreePath } from "../lib/paths";
import {
  CannotRemovePrimaryError,
  NotInRepoError,
  parseGitError,
  WorktreeExistsError,
  WorktreeNotFoundError,
} from "../utils/errors";
import { formatError, formatHint, formatSuccess } from "../utils/format";

export async function mv(oldName: string, newName: string): Promise<void> {
  // Check if we're in a git repo
  if (!(await isInsideGitRepo())) {
    console.error(formatError(new NotInRepoError().message));
    process.exit(1);
  }

  try {
    // Find the old worktree
    const oldWorktree = await findWorktree(oldName);
    if (!oldWorktree) {
      const error = new WorktreeNotFoundError(oldName);
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    // Cannot move primary worktree
    if (oldWorktree.isPrimary) {
      const error = new CannotRemovePrimaryError();
      console.error(formatError("Cannot move the primary worktree"));
      console.error(formatHint(error.hint || ""));
      process.exit(1);
    }

    // Check if new name already exists
    const existingNew = await findWorktree(newName);
    if (existingNew) {
      const error = new WorktreeExistsError(newName);
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    // Get repo info for determining new path
    const repoInfo = await getRepoInfo();
    if (!repoInfo) {
      console.error(formatError("Could not determine repository information"));
      process.exit(1);
    }

    const { worktreeBase } = await getConfig(
      repoInfo.worktreeRoot,
      repoInfo.repoId,
    );

    // Determine new path
    const newPath = resolveWorktreePath(repoInfo.repoId, newName, worktreeBase);

    // Move the worktree
    const result = await moveWorktree(oldWorktree.path, newPath);

    if (!result.success) {
      const error = parseGitError(result.stderr, { name: oldName });
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    console.log(formatSuccess(`Renamed worktree '${oldName}' to '${newName}'`));
  } catch (error) {
    console.error(
      formatError(error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  }
}
