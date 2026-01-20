/**
 * wt rm - Remove a worktree
 */

import { getConfig } from "../lib/config";
import { getRepoInfo, isInsideGitRepo } from "../lib/git/repo";
import { findWorktree, removeWorktree } from "../lib/git/worktree";
import { executeHook, getHookConfig } from "../lib/hooks";
import {
  CannotRemovePrimaryError,
  NotInRepoError,
  parseGitError,
  WorktreeNotFoundError,
} from "../utils/errors";
import { git } from "../utils/exec";
import {
  formatError,
  formatHint,
  formatSuccess,
  formatWarning,
} from "../utils/format";

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
    // Get repo info for hooks
    const repoInfo = await getRepoInfo();
    if (!repoInfo) {
      console.error(formatError("Could not determine repository information"));
      process.exit(1);
    }

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

    // Store worktree info for hook (before deletion)
    const deletedWorktreePath = worktree.path;
    const deletedWorktreeBranch = worktree.branch ?? "";

    // Get config for hooks
    const { hooks } = await getConfig(repoInfo.worktreeRoot, repoInfo.repoId);

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

    // Execute post-delete hook (from repo root, since worktree is deleted)
    const hookConfig = getHookConfig(hooks, "post-delete");
    if (hookConfig) {
      await executeHook(
        "post-delete",
        hookConfig,
        {
          name,
          path: deletedWorktreePath,
          branch: deletedWorktreeBranch,
          repoId: repoInfo.repoId,
        },
        repoInfo.worktreeRoot, // Run from repo root
      );
    }

    // Handle branch deletion
    if (worktree.branch) {
      if (options.deleteBranch) {
        // Use -D (force) if --force was passed, otherwise -d (safe)
        const deleteFlag = options.force ? "-D" : "-d";
        const deleteResult = await git(["branch", deleteFlag, worktree.branch]);
        if (deleteResult.success) {
          console.log(formatSuccess(`Deleted branch '${worktree.branch}'`));
        } else {
          // Branch might have unmerged changes, warn but don't fail
          console.log(
            formatWarning(
              `Could not delete branch '${worktree.branch}': ${deleteResult.stderr}`,
            ),
          );
          console.log(
            formatHint(`Force delete with: git branch -D ${worktree.branch}`),
          );
        }
      } else {
        console.log(
          formatHint(
            `Branch '${worktree.branch}' was not deleted. Delete it with: git branch -d ${worktree.branch}`,
          ),
        );
      }
    }
  } catch (error) {
    console.error(
      formatError(error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  }
}
