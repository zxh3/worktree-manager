/**
 * wt ls - List all worktrees
 */

import { isInsideGitRepo } from "../lib/git/repo";
import { listWorktrees } from "../lib/git/worktree";
import { NotInRepoError } from "../utils/errors";
import {
  formatError,
  formatWorktreeList,
  formatWorktreesJson,
  formatWorktreesPorcelain,
} from "../utils/format";

export interface LsOptions {
  json?: boolean;
  porcelain?: boolean;
  status?: boolean;
}

export async function ls(options: LsOptions = {}): Promise<void> {
  // Check if we're in a git repo
  if (!(await isInsideGitRepo())) {
    console.error(formatError(new NotInRepoError().message));
    process.exit(1);
  }

  try {
    const worktrees = await listWorktrees();

    if (options.json) {
      console.log(formatWorktreesJson(worktrees));
    } else if (options.porcelain) {
      console.log(formatWorktreesPorcelain(worktrees));
    } else {
      console.log(formatWorktreeList(worktrees));
    }
  } catch (error) {
    console.error(
      formatError(error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  }
}
