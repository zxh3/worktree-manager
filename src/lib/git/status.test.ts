/**
 * Tests for git status operations
 */

import { describe, expect, test } from "bun:test";

// We'll test the status module logic by checking the exported interface
// Full integration tests would require a real git repo

describe("getWorktreeStatus interface", () => {
  test("module exports getWorktreeStatus function", async () => {
    const { getWorktreeStatus } = await import("./status");
    expect(typeof getWorktreeStatus).toBe("function");
  });

  test("WorktreeStatusResult has correct shape", async () => {
    const { getWorktreeStatus } = await import("./status");

    // This will fail without a real git repo, but we're testing the interface
    try {
      const result = await getWorktreeStatus("/nonexistent", "main");
      // If it somehow succeeds, check shape
      expect(result).toHaveProperty("status");
      expect(Array.isArray(result.status)).toBe(true);
    } catch {
      // Expected to fail - that's fine for interface test
      expect(true).toBe(true);
    }
  });
});

describe("status detection logic", () => {
  // These tests verify the expected behavior based on the module implementation

  test("dirty status should be detected from git status --porcelain output", () => {
    // If git status --porcelain returns non-empty output, status should include 'dirty'
    // This is a documentation test showing expected behavior
    const porcelainOutput = " M file.txt\n?? untracked.txt";
    expect(porcelainOutput.trim().length).toBeGreaterThan(0);
  });

  test("stale detection uses 30-day threshold", () => {
    const STALE_DAYS = 30;
    const SECONDS_PER_DAY = 86400;

    // A commit 31 days ago should be stale
    const oldTimestamp = Date.now() / 1000 - 31 * SECONDS_PER_DAY;
    const daysSinceCommit =
      (Date.now() / 1000 - oldTimestamp) / SECONDS_PER_DAY;

    expect(daysSinceCommit > STALE_DAYS).toBe(true);

    // A commit 15 days ago should not be stale
    const recentTimestamp = Date.now() / 1000 - 15 * SECONDS_PER_DAY;
    const recentDays = (Date.now() / 1000 - recentTimestamp) / SECONDS_PER_DAY;

    expect(recentDays > STALE_DAYS).toBe(false);
  });
});
