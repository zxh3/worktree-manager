/**
 * wt current - Show current worktree information
 */

import {
  getCurrentBranch,
  getWorktreeRoot,
  isInsideGitRepo,
} from "../lib/git/repo";
import {
  findWorktreeByPath,
  getWorktreeNameFromPath,
} from "../lib/git/worktree";
import { NotInRepoError } from "../utils/errors";
import { formatError } from "../utils/format";

export interface CurrentOptions {
  path?: boolean;
  branch?: boolean;
}

export async function current(options: CurrentOptions = {}): Promise<void> {
  // Check if we're in a git repo
  if (!(await isInsideGitRepo())) {
    console.error(formatError(new NotInRepoError().message));
    process.exit(1);
  }

  try {
    const worktreeRoot = await getWorktreeRoot();
    if (!worktreeRoot) {
      console.error(formatError("Could not determine worktree root"));
      process.exit(1);
    }

    if (options.path) {
      // Output the path
      console.log(worktreeRoot);
      return;
    }

    if (options.branch) {
      // Output the branch
      const branch = await getCurrentBranch();
      if (branch) {
        console.log(branch);
      } else {
        // Detached HEAD - output commit hash
        const worktree = await findWorktreeByPath(worktreeRoot);
        if (worktree) {
          console.log(worktree.head.slice(0, 7));
        } else {
          console.error(formatError("Could not find worktree information"));
          process.exit(1);
        }
      }
      return;
    }

    // Default: output worktree name
    // First try to get it from the .git file (for worktrees)
    const worktreeName = await getWorktreeNameFromPath(worktreeRoot);
    if (worktreeName) {
      console.log(worktreeName);
      return;
    }

    // If not a worktree, find this path in the worktree list
    const worktree = await findWorktreeByPath(worktreeRoot);
    if (worktree) {
      console.log(worktree.name);
      return;
    }

    // Not in a worktree
    console.error(formatError("Not inside a worktree"));
    process.exit(1);
  } catch (error) {
    console.error(
      formatError(error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  }
}
