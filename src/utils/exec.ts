/**
 * Shell execution utilities
 */

import type { GitResult } from "../lib/types";

/**
 * Execute a command and return the result
 */
export async function exec(
  command: string[],
  options?: { cwd?: string }
): Promise<GitResult> {
  const proc = Bun.spawn(command, {
    cwd: options?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return {
    success: exitCode === 0,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
  };
}

/**
 * Execute a git command
 */
export async function git(
  args: string[],
  options?: { cwd?: string }
): Promise<GitResult> {
  return exec(["git", ...args], options);
}

/**
 * Execute a git command and throw on failure
 */
export async function gitOrThrow(
  args: string[],
  options?: { cwd?: string }
): Promise<string> {
  const result = await git(args, options);
  if (!result.success) {
    throw new Error(result.stderr || `git ${args[0]} failed`);
  }
  return result.stdout;
}
