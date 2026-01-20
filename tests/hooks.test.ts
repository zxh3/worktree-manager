/**
 * Integration tests for hooks functionality
 *
 * These tests verify that hooks are executed correctly when
 * creating, deleting, and renaming worktrees.
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createTestRepo, runWt } from "./helpers";
import { join, basename } from "path";
import { mkdir, writeFile, readFile, rm, realpath } from "fs/promises";
import { homedir } from "os";
import { createHash } from "crypto";

describe("Hooks integration tests", () => {
  let testEnv: Awaited<ReturnType<typeof createTestRepo>>;
  let configDir: string;
  let configPath: string;
  let originalConfig: string | null = null;

  beforeEach(async () => {
    testEnv = await createTestRepo();

    // Setup config directory
    configDir = join(homedir(), ".config", "wt");
    configPath = join(configDir, "config.json");

    // Backup existing config if present
    try {
      originalConfig = await readFile(configPath, "utf-8");
    } catch {
      originalConfig = null;
    }
  });

  afterEach(async () => {
    // Restore original config or remove test config
    if (originalConfig !== null) {
      await writeFile(configPath, originalConfig, "utf-8");
    } else {
      try {
        await rm(configPath, { force: true });
      } catch {
        // Ignore if file doesn't exist
      }
    }

    await testEnv.cleanup();
  });

  async function setConfig(config: object): Promise<void> {
    await mkdir(configDir, { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  describe("post-create hook", () => {
    test("executes hook after creating worktree", async () => {
      // Create a hook that creates a marker file
      const markerFile = join(testEnv.worktreeBase, "hook-marker.txt");
      await setConfig({
        hooks: {
          "post-create": `echo "hook executed for $WT_NAME" > "${markerFile}"`,
        },
      });

      const result = await runWt(["new", "feature-hook"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Created worktree");

      // Verify hook was executed
      const markerContent = await readFile(markerFile, "utf-8");
      expect(markerContent.trim()).toBe("hook executed for feature-hook");
    });

    test("sets correct environment variables", async () => {
      const markerFile = join(testEnv.worktreeBase, "env-marker.txt");
      await setConfig({
        hooks: {
          "post-create": `echo "NAME=$WT_NAME PATH=$WT_PATH BRANCH=$WT_BRANCH HOOK=$WT_HOOK" > "${markerFile}"`,
        },
      });

      await runWt(["new", "env-test"], { cwd: testEnv.repoDir });

      const markerContent = await readFile(markerFile, "utf-8");
      expect(markerContent).toContain("NAME=env-test");
      expect(markerContent).toContain("BRANCH=env-test");
      expect(markerContent).toContain("HOOK=post-create");
    });

    test("runs multiple commands in array format", async () => {
      const marker1 = join(testEnv.worktreeBase, "marker1.txt");
      const marker2 = join(testEnv.worktreeBase, "marker2.txt");

      await setConfig({
        hooks: {
          "post-create": [
            `echo "first" > "${marker1}"`,
            `echo "second" > "${marker2}"`,
          ],
        },
      });

      await runWt(["new", "array-test"], { cwd: testEnv.repoDir });

      const content1 = await readFile(marker1, "utf-8");
      const content2 = await readFile(marker2, "utf-8");
      expect(content1.trim()).toBe("first");
      expect(content2.trim()).toBe("second");
    });

    test("hook failure does not fail command", async () => {
      await setConfig({
        hooks: {
          "post-create": "exit 1", // Intentionally fail
        },
      });

      const result = await runWt(["new", "fail-hook"], { cwd: testEnv.repoDir });

      // Command should succeed even though hook failed
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Created worktree");

      // Hook failure warning should be in stderr
      expect(result.stderr).toContain("Warning");
    });

    test("stops on first failure by default", async () => {
      const marker1 = join(testEnv.worktreeBase, "before-fail.txt");
      const marker2 = join(testEnv.worktreeBase, "after-fail.txt");

      await setConfig({
        hooks: {
          "post-create": [
            `echo "before" > "${marker1}"`,
            "exit 1", // Fail
            `echo "after" > "${marker2}"`,
          ],
        },
      });

      await runWt(["new", "stop-on-fail"], { cwd: testEnv.repoDir });

      // First command should run
      const content1 = await readFile(marker1, "utf-8");
      expect(content1.trim()).toBe("before");

      // Second command (after failure) should not run
      try {
        await readFile(marker2, "utf-8");
        expect.unreachable("Second command should not have run");
      } catch {
        // Expected - file should not exist
      }
    });

    test("continues on error when configured", async () => {
      const marker1 = join(testEnv.worktreeBase, "before-fail2.txt");
      const marker2 = join(testEnv.worktreeBase, "after-fail2.txt");

      await setConfig({
        hooks: {
          "post-create": {
            commands: [
              `echo "before" > "${marker1}"`,
              "exit 1", // Fail
              `echo "after" > "${marker2}"`,
            ],
            continueOnError: true,
          },
        },
      });

      await runWt(["new", "continue-on-fail"], { cwd: testEnv.repoDir });

      // Both commands should run despite failure in the middle
      const content1 = await readFile(marker1, "utf-8");
      const content2 = await readFile(marker2, "utf-8");
      expect(content1.trim()).toBe("before");
      expect(content2.trim()).toBe("after");
    });
  });

  describe("post-delete hook", () => {
    test("executes hook after deleting worktree", async () => {
      const markerFile = join(testEnv.worktreeBase, "delete-marker.txt");

      await setConfig({
        hooks: {
          "post-delete": `echo "deleted $WT_NAME" > "${markerFile}"`,
        },
      });

      // Create a worktree first
      await runWt(["new", "to-delete"], { cwd: testEnv.repoDir });

      // Delete it
      const result = await runWt(["rm", "to-delete"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);

      // Verify hook was executed
      const markerContent = await readFile(markerFile, "utf-8");
      expect(markerContent.trim()).toBe("deleted to-delete");
    });
  });

  describe("post-rename hook", () => {
    test("executes hook after renaming worktree", async () => {
      const markerFile = join(testEnv.worktreeBase, "rename-marker.txt");

      await setConfig({
        hooks: {
          "post-rename": `echo "renamed from $WT_OLD_NAME to $WT_NAME" > "${markerFile}"`,
        },
      });

      // Create a worktree first
      await runWt(["new", "old-name"], { cwd: testEnv.repoDir });

      // Rename it
      const result = await runWt(["mv", "old-name", "new-name"], { cwd: testEnv.repoDir });

      expect(result.exitCode).toBe(0);

      // Verify hook was executed
      const markerContent = await readFile(markerFile, "utf-8");
      expect(markerContent.trim()).toBe("renamed from old-name to new-name");
    });
  });

  describe("repo-specific hooks", () => {
    test("repo hooks override global hooks", async () => {
      const globalMarker = join(testEnv.worktreeBase, "global-marker.txt");
      const repoMarker = join(testEnv.worktreeBase, "repo-marker.txt");

      // For test repos without remotes, the repo ID includes a hash of the path
      // On macOS, /tmp is a symlink to /private/tmp, so we need to use the real path
      const realRepoDir = await realpath(testEnv.repoDir);
      const repoName = basename(realRepoDir);
      const hash = createHash("sha256").update(realRepoDir).digest("hex").slice(0, 8);
      const repoId = `${repoName}-${hash}`;

      await setConfig({
        hooks: {
          "post-create": `echo "global" > "${globalMarker}"`,
        },
        repos: {
          [repoId]: {
            hooks: {
              "post-create": `echo "repo-specific" > "${repoMarker}"`,
            },
          },
        },
      });

      await runWt(["new", "repo-hook-test"], { cwd: testEnv.repoDir });

      // Repo-specific hook should run, not global
      const repoContent = await readFile(repoMarker, "utf-8");
      expect(repoContent.trim()).toBe("repo-specific");

      // Global hook should NOT have run (repo hook replaces it)
      try {
        await readFile(globalMarker, "utf-8");
        expect.unreachable("Global hook should not have run");
      } catch {
        // Expected - file should not exist
      }
    });
  });
});
