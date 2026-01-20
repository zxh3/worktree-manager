/**
 * wt new - Create a new worktree
 */

import { getConfig } from "../lib/config";
import {
  MAX_NAME_LENGTH,
  RESERVED_NAMES,
  VALID_NAME_REGEX,
} from "../lib/constants";
import { getRepoInfo, isInsideGitRepo } from "../lib/git/repo";
import { createWorktree, findWorktree } from "../lib/git/worktree";
import { executeHook, getHookConfig } from "../lib/hooks";
import { resolveWorktreePath } from "../lib/paths";
import type { CreateWorktreeOptions } from "../lib/types";
import {
  NotInRepoError,
  parseGitError,
  WorktreeExistsError,
} from "../utils/errors";
import { formatError, formatHint, formatSuccess } from "../utils/format";

export interface NewOptions {
  base?: string;
  branch?: string;
  track?: string;
  detach?: boolean;
}

export async function newWorktree(
  name: string,
  options: NewOptions = {},
): Promise<void> {
  // Validate worktree name
  if (!name || !VALID_NAME_REGEX.test(name)) {
    console.error(
      formatError(
        "Invalid worktree name. Use only alphanumeric characters, hyphens, and underscores.",
      ),
    );
    process.exit(1);
  }
  if (name.length > MAX_NAME_LENGTH) {
    console.error(
      formatError(`Worktree name too long (max ${MAX_NAME_LENGTH} characters)`),
    );
    process.exit(1);
  }
  if (RESERVED_NAMES.includes(name as (typeof RESERVED_NAMES)[number])) {
    console.error(formatError(`"${name}" is a reserved name`));
    process.exit(1);
  }

  // Check if we're in a git repo
  if (!(await isInsideGitRepo())) {
    console.error(formatError(new NotInRepoError().message));
    process.exit(1);
  }

  try {
    // Get repo info
    const repoInfo = await getRepoInfo();
    if (!repoInfo) {
      console.error(formatError("Could not determine repository information"));
      process.exit(1);
    }

    // Check if worktree already exists
    const existing = await findWorktree(name);
    if (existing) {
      const error = new WorktreeExistsError(name);
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    // Get config for branch prefix and hooks
    const { branchPrefix, worktreeBase, hooks } = await getConfig(
      repoInfo.worktreeRoot,
      repoInfo.repoId,
    );

    // Determine worktree path
    const worktreePath = resolveWorktreePath(
      repoInfo.repoId,
      name,
      worktreeBase,
    );

    // Determine branch name
    const branchName = options.branch || `${branchPrefix}${name}`;

    // Create the worktree
    const createOptions: CreateWorktreeOptions = {
      name,
      branch: options.detach ? undefined : branchName,
      base: options.base,
      track: options.track,
      detach: options.detach,
    };

    const result = await createWorktree(worktreePath, createOptions);

    if (!result.success) {
      const error = parseGitError(result.stderr, { name, branch: branchName });
      console.error(formatError(error.message));
      if (error.hint) console.error(formatHint(error.hint));
      process.exit(1);
    }

    console.log(formatSuccess(`Created worktree '${name}'`));
    console.log(formatHint(`cd to it with: wt cd ${name}`));

    // Execute post-create hook
    const hookConfig = getHookConfig(hooks, "post-create");
    if (hookConfig) {
      await executeHook("post-create", hookConfig, {
        name,
        path: worktreePath,
        branch: options.detach ? "" : branchName,
        repoId: repoInfo.repoId,
      });
    }
  } catch (error) {
    console.error(
      formatError(error instanceof Error ? error.message : String(error)),
    );
    process.exit(1);
  }
}
