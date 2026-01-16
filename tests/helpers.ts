/**
 * Test helpers for integration tests
 */

import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Create an isolated test environment with a git repo
 */
export async function createTestRepo(): Promise<{
  repoDir: string;
  worktreeBase: string;
  cleanup: () => Promise<void>;
}> {
  // Create temp directories
  const baseDir = await mkdtemp(join(tmpdir(), "wt-test-"));
  const repoDir = join(baseDir, "repo");
  const worktreeBase = join(baseDir, "worktrees");

  // Initialize git repo
  await Bun.spawn(["mkdir", "-p", repoDir]).exited;
  await Bun.spawn(["git", "init"], { cwd: repoDir }).exited;
  await Bun.spawn(["git", "config", "user.email", "test@test.com"], { cwd: repoDir }).exited;
  await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: repoDir }).exited;

  // Create initial commit so we have a valid HEAD
  await Bun.write(join(repoDir, "README.md"), "# Test Repo");
  await Bun.spawn(["git", "add", "."], { cwd: repoDir }).exited;
  await Bun.spawn(["git", "commit", "-m", "Initial commit"], { cwd: repoDir }).exited;

  // Create worktree base directory
  await Bun.spawn(["mkdir", "-p", worktreeBase]).exited;

  return {
    repoDir,
    worktreeBase,
    cleanup: async () => {
      await rm(baseDir, { recursive: true, force: true });
    },
  };
}

/**
 * Run the wt CLI with given arguments
 */
export async function runWt(
  args: string[],
  options: { cwd: string; env?: Record<string, string> }
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const cliPath = join(import.meta.dir, "..", "src", "cli.ts");

  const proc = Bun.spawn(["bun", "run", cliPath, ...args], {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...options.env,
    },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
  };
}

/**
 * Run git command in test repo
 */
export async function runGit(
  args: string[],
  options: { cwd: string }
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
  };
}
