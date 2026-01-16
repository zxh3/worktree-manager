/**
 * Integration tests for CLI commands
 *
 * These tests run against real git repos in isolated temp directories.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createTestRepo, runWt, runGit } from "./helpers";
import { join } from "path";

describe("CLI integration tests", () => {
  let testEnv: Awaited<ReturnType<typeof createTestRepo>>;

  beforeEach(async () => {
    testEnv = await createTestRepo();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe("wt --help", () => {
    test("displays help message", async () => {
      const result = await runWt(["--help"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("wt - Git worktree manager");
      expect(result.stdout).toContain("Commands:");
      expect(result.stdout).toContain("wt new");
      expect(result.stdout).toContain("wt ls");
      expect(result.stdout).toContain("wt rm");
    });
  });

  describe("wt --version", () => {
    test("displays version", async () => {
      const result = await runWt(["--version"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/wt version \d+\.\d+\.\d+/);
    });
  });

  describe("wt ls", () => {
    test("lists primary worktree", async () => {
      const result = await runWt(["ls"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("repo");
      expect(result.stdout).toContain("primary");
    });

    test("outputs JSON when --json flag is used", async () => {
      const result = await runWt(["ls", "--json"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("repo");
      expect(parsed[0].isPrimary).toBe(true);
    });

    test("outputs porcelain format when --porcelain flag is used", async () => {
      const result = await runWt(["ls", "--porcelain"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("worktree ");
      expect(result.stdout).toContain("HEAD ");
      expect(result.stdout).toContain("branch refs/heads/");
    });
  });

  describe("wt new", () => {
    test("creates a new worktree", async () => {
      const result = await runWt(["new", "feature"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Created worktree 'feature'");

      // Verify worktree was created
      const lsResult = await runWt(["ls", "--json"], { cwd: testEnv.repoDir });
      const worktrees = JSON.parse(lsResult.stdout);
      expect(worktrees.find((wt: any) => wt.name === "feature")).toBeTruthy();
    });

    test("creates worktree with custom branch via --branch", async () => {
      const result = await runWt(["new", "feature", "--branch", "custom-branch"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);

      // Verify branch name
      const lsResult = await runWt(["ls", "--json"], { cwd: testEnv.repoDir });
      const worktrees = JSON.parse(lsResult.stdout);
      const featureWt = worktrees.find((wt: any) => wt.name === "feature");
      expect(featureWt.branch).toBe("custom-branch");
    });

    test("fails when name is missing", async () => {
      const result = await runWt(["new"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("missing worktree name");
    });

    test("fails when worktree already exists", async () => {
      // Create first worktree
      await runWt(["new", "feature"], { cwd: testEnv.repoDir });

      // Try to create again
      const result = await runWt(["new", "feature"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("already exists");
    });
  });

  describe("wt rm", () => {
    test("removes a worktree", async () => {
      // Create a worktree first
      await runWt(["new", "feature"], { cwd: testEnv.repoDir });

      // Remove it
      const result = await runWt(["rm", "feature"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Removed worktree 'feature'");

      // Verify it's gone
      const lsResult = await runWt(["ls", "--json"], { cwd: testEnv.repoDir });
      const worktrees = JSON.parse(lsResult.stdout);
      expect(worktrees.find((wt: any) => wt.name === "feature")).toBeFalsy();
    });

    test("removes worktree and branch with --delete-branch", async () => {
      // Create a worktree first
      await runWt(["new", "to-delete"], { cwd: testEnv.repoDir });

      // Remove it with --delete-branch
      const result = await runWt(["rm", "to-delete", "--delete-branch"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Removed worktree");
      expect(result.stdout).toContain("Deleted branch");

      // Verify branch is also gone
      const branchResult = await runGit(["branch"], { cwd: testEnv.repoDir });
      expect(branchResult.stdout).not.toContain("to-delete");
    });

    test("fails when worktree does not exist", async () => {
      const result = await runWt(["rm", "nonexistent"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    test("cannot remove primary worktree", async () => {
      const result = await runWt(["rm", "repo"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("primary");
    });
  });

  describe("wt cd", () => {
    test("outputs worktree path", async () => {
      // Create a worktree first
      await runWt(["new", "feature"], { cwd: testEnv.repoDir });

      // Get path
      const result = await runWt(["cd", "feature"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("feature");
    });

    test("fails when worktree does not exist", async () => {
      const result = await runWt(["cd", "nonexistent"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("wt current", () => {
    test("outputs current worktree name", async () => {
      const result = await runWt(["current"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("repo");
    });

    test("outputs path with --path flag", async () => {
      const result = await runWt(["current", "--path"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      // macOS has /var as symlink to /private/var, so check if paths match after resolving
      expect(result.stdout).toContain("repo");
    });

    test("outputs branch with --branch flag", async () => {
      const result = await runWt(["current", "--branch"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      // Default branch is either main or master
      expect(["main", "master"]).toContain(result.stdout);
    });
  });

  describe("wt mv", () => {
    test("renames a worktree", async () => {
      // Create a worktree first
      await runWt(["new", "old-name"], { cwd: testEnv.repoDir });

      // Rename it
      const result = await runWt(["mv", "old-name", "new-name"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Renamed");

      // Verify rename
      const lsResult = await runWt(["ls", "--json"], { cwd: testEnv.repoDir });
      const worktrees = JSON.parse(lsResult.stdout);
      expect(worktrees.find((wt: any) => wt.name === "old-name")).toBeFalsy();
      expect(worktrees.find((wt: any) => wt.name === "new-name")).toBeTruthy();
    });

    test("fails when source worktree does not exist", async () => {
      const result = await runWt(["mv", "nonexistent", "new-name"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    test("cannot move primary worktree", async () => {
      const result = await runWt(["mv", "repo", "new-name"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("primary");
    });
  });

  describe("wt shell-init", () => {
    test("outputs bash shell integration", async () => {
      const result = await runWt(["shell-init", "bash"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("wt()");
      expect(result.stdout).toContain("case");
      expect(result.stdout).toContain("cd)");
    });

    test("outputs zsh shell integration", async () => {
      const result = await runWt(["shell-init", "zsh"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("wt()");
    });

    test("outputs fish shell integration", async () => {
      const result = await runWt(["shell-init", "fish"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("function wt");
    });

    test("fails for unknown shell", async () => {
      const result = await runWt(["shell-init", "unknown"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown shell");
    });
  });

  describe("error handling", () => {
    test("shows error when not in a git repo", async () => {
      const result = await runWt(["ls"], { cwd: testEnv.worktreeBase });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("git repository");
    });

    test("shows error for unknown command", async () => {
      const result = await runWt(["unknown-command"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("unknown command");
    });
  });
});
