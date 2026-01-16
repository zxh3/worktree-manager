/**
 * wt cd - Output worktree path for shell cd integration
 */

import { findWorktree } from "../lib/git/worktree";
import { isInsideGitRepo } from "../lib/git/repo";
import { formatError, formatHint } from "../utils/format";
import { NotInRepoError, WorktreeNotFoundError } from "../utils/errors";

export async function cd(name: string): Promise<void> {
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

    // Output the path (shell wrapper will cd to it)
    console.log(worktree.path);
  } catch (error) {
    console.error(formatError(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
