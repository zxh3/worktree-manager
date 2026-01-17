/**
 * Unit tests for output formatting utilities
 */

import { describe, expect, test } from "bun:test";
import type { Worktree } from "../lib/types";
import { formatWorktreesJson, formatWorktreesPorcelain } from "./format";

const mockPrimaryWorktree: Worktree = {
  path: "/Users/dev/repo",
  name: "repo",
  head: "abc123def456",
  branch: "main",
  isDetached: false,
  isLocked: false,
  isPrunable: false,
  isPrimary: true,
};

const mockSecondaryWorktree: Worktree = {
  path: "/Users/dev/.worktrees/repo-id/feature",
  name: "feature",
  head: "def456abc789",
  branch: "feature",
  isDetached: false,
  isLocked: false,
  isPrunable: false,
  isPrimary: false,
};

const mockDetachedWorktree: Worktree = {
  path: "/Users/dev/.worktrees/repo-id/detached",
  name: "detached",
  head: "111222333444",
  branch: null,
  isDetached: true,
  isLocked: false,
  isPrunable: false,
  isPrimary: false,
};

const mockLockedWorktree: Worktree = {
  path: "/Users/dev/.worktrees/repo-id/locked",
  name: "locked",
  head: "555666777888",
  branch: "locked-branch",
  isDetached: false,
  isLocked: true,
  isPrunable: false,
  isPrimary: false,
};

const mockPrunableWorktree: Worktree = {
  path: "/Users/dev/.worktrees/repo-id/prunable",
  name: "prunable",
  head: "999000111222",
  branch: "prunable-branch",
  isDetached: false,
  isLocked: false,
  isPrunable: true,
  isPrimary: false,
};

describe("formatWorktreesJson", () => {
  test("formats empty array", () => {
    const result = formatWorktreesJson([]);
    expect(JSON.parse(result)).toEqual([]);
  });

  test("formats single worktree", () => {
    const result = formatWorktreesJson([mockPrimaryWorktree]);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].path).toBe("/Users/dev/repo");
    expect(parsed[0].name).toBe("repo");
    expect(parsed[0].branch).toBe("main");
    expect(parsed[0].isPrimary).toBe(true);
  });

  test("formats multiple worktrees", () => {
    const result = formatWorktreesJson([
      mockPrimaryWorktree,
      mockSecondaryWorktree,
    ]);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].isPrimary).toBe(true);
    expect(parsed[1].isPrimary).toBe(false);
  });

  test("includes all worktree properties", () => {
    const result = formatWorktreesJson([mockLockedWorktree]);
    const parsed = JSON.parse(result);

    expect(parsed[0]).toEqual({
      path: "/Users/dev/.worktrees/repo-id/locked",
      name: "locked",
      head: "555666777888",
      branch: "locked-branch",
      isDetached: false,
      isLocked: true,
      isPrunable: false,
      isPrimary: false,
    });
  });
});

describe("formatWorktreesPorcelain", () => {
  test("formats empty array", () => {
    const result = formatWorktreesPorcelain([]);
    expect(result).toBe("");
  });

  test("formats single worktree with branch", () => {
    const result = formatWorktreesPorcelain([mockPrimaryWorktree]);

    expect(result).toContain("worktree /Users/dev/repo");
    expect(result).toContain("HEAD abc123def456");
    expect(result).toContain("branch refs/heads/main");
  });

  test("formats detached worktree", () => {
    const result = formatWorktreesPorcelain([mockDetachedWorktree]);

    expect(result).toContain("worktree /Users/dev/.worktrees/repo-id/detached");
    expect(result).toContain("HEAD 111222333444");
    expect(result).toContain("detached");
    expect(result).not.toContain("branch refs/heads/");
  });

  test("includes locked flag", () => {
    const result = formatWorktreesPorcelain([mockLockedWorktree]);

    expect(result).toContain("locked");
  });

  test("includes prunable flag", () => {
    const result = formatWorktreesPorcelain([mockPrunableWorktree]);

    expect(result).toContain("prunable");
  });

  test("separates worktrees with blank line", () => {
    const result = formatWorktreesPorcelain([
      mockPrimaryWorktree,
      mockSecondaryWorktree,
    ]);

    // Should have a blank line between worktrees
    expect(result).toMatch(/main\n\nworktree/);
  });

  test("matches git worktree list --porcelain format", () => {
    const result = formatWorktreesPorcelain([mockPrimaryWorktree]);
    const lines = result.split("\n");

    expect(lines[0]).toBe("worktree /Users/dev/repo");
    expect(lines[1]).toBe("HEAD abc123def456");
    expect(lines[2]).toBe("branch refs/heads/main");
  });
});
