/**
 * Unit tests for worktree parsing
 */

import { describe, expect, test } from "bun:test";
import { parseWorktreeList } from "./worktree";

describe("parseWorktreeList", () => {
  test("parses single worktree (primary)", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/main`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: "/Users/dev/repo",
      name: "repo",
      head: "abc123def456",
      branch: "main",
      isDetached: false,
      isLocked: false,
      isPrunable: false,
      isPrimary: true,
    });
  });

  test("parses multiple worktrees", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/main

worktree /Users/dev/.worktrees/repo-id/feature
HEAD def456abc789
branch refs/heads/feature`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(2);
    expect(result[0].isPrimary).toBe(true);
    expect(result[0].name).toBe("repo");
    expect(result[0].branch).toBe("main");
    expect(result[1].isPrimary).toBe(false);
    expect(result[1].name).toBe("feature");
    expect(result[1].branch).toBe("feature");
  });

  test("parses detached HEAD worktree", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/main

worktree /Users/dev/.worktrees/repo-id/detached-wt
HEAD def456abc789
detached`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(2);
    expect(result[1].isDetached).toBe(true);
    expect(result[1].branch).toBeNull();
  });

  test("parses locked worktree", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/main

worktree /Users/dev/.worktrees/repo-id/locked-wt
HEAD def456abc789
branch refs/heads/feature
locked`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(2);
    expect(result[1].isLocked).toBe(true);
  });

  test("parses prunable worktree", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/main

worktree /Users/dev/.worktrees/repo-id/stale-wt
HEAD def456abc789
branch refs/heads/stale
prunable`;

    const result = parseWorktreeList(output);

    expect(result).toHaveLength(2);
    expect(result[1].isPrunable).toBe(true);
  });

  test("handles empty output", () => {
    const result = parseWorktreeList("");
    expect(result).toHaveLength(0);
  });

  test("handles whitespace-only output", () => {
    const result = parseWorktreeList("   \n\n   ");
    expect(result).toHaveLength(0);
  });

  test("skips incomplete worktree blocks", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/main

worktree /Users/dev/incomplete`;

    const result = parseWorktreeList(output);

    // Only the complete worktree should be parsed
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("repo");
  });

  test("handles nested branch paths", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/feature/nested/branch`;

    const result = parseWorktreeList(output);

    expect(result[0].branch).toBe("feature/nested/branch");
  });

  test("handles worktree with all flags", () => {
    const output = `worktree /Users/dev/repo
HEAD abc123def456
branch refs/heads/main

worktree /Users/dev/.worktrees/repo-id/flagged-wt
HEAD def456abc789
branch refs/heads/flagged
locked
prunable`;

    const result = parseWorktreeList(output);

    expect(result[1].isLocked).toBe(true);
    expect(result[1].isPrunable).toBe(true);
    expect(result[1].isDetached).toBe(false);
  });
});
