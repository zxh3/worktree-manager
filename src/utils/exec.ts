/**
 * Shell execution utilities
 */

import type { GitResult } from "../lib/types";
import { execCommand } from "./compat";

/**
 * Execute a command and return the result
 */
export async function exec(
  command: string[],
  options?: { cwd?: string },
): Promise<GitResult> {
  return execCommand(command, options);
}

/**
 * Execute a git command
 */
export async function git(
  args: string[],
  options?: { cwd?: string },
): Promise<GitResult> {
  return exec(["git", ...args], options);
}

/**
 * Execute a git command and throw on failure
 */
export async function gitOrThrow(
  args: string[],
  options?: { cwd?: string },
): Promise<string> {
  const result = await git(args, options);
  if (!result.success) {
    throw new Error(result.stderr || `git ${args[0]} failed`);
  }
  return result.stdout;
}
