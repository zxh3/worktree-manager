/**
 * Tests for WorktreeList component
 */

import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import type { WorktreeWithStatus } from "../../lib/types";
import { WorktreeList } from "../components/WorktreeList";

const mockWorktrees: WorktreeWithStatus[] = [
  {
    name: "main",
    path: "/Users/dev/repo",
    branch: "main",
    head: "abc123def456",
    isPrimary: true,
    isDetached: false,
    isLocked: false,
    isPrunable: false,
    status: [],
  },
  {
    name: "feature-auth",
    path: "/Users/dev/.worktrees/repo/feature-auth",
    branch: "feature/auth",
    head: "def456abc123",
    isPrimary: false,
    isDetached: false,
    isLocked: false,
    isPrunable: false,
    status: ["dirty"],
  },
  {
    name: "fix-login",
    path: "/Users/dev/.worktrees/repo/fix-login",
    branch: "fix/login",
    head: "789abc123def",
    isPrimary: false,
    isDetached: false,
    isLocked: false,
    isPrunable: false,
    status: ["merged"],
  },
];

describe("WorktreeList", () => {
  test("renders worktree names", () => {
    const { lastFrame } = render(
      <WorktreeList
        worktrees={mockWorktrees}
        selectedIndex={0}
        isLoading={false}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain("main");
    expect(frame).toContain("feature-auth");
    expect(frame).toContain("fix-login");
  });

  test("shows worktrees header", () => {
    const { lastFrame } = render(
      <WorktreeList
        worktrees={mockWorktrees}
        selectedIndex={0}
        isLoading={false}
      />,
    );

    expect(lastFrame()).toContain("worktrees");
  });

  test("shows loading state when loading and no worktrees", () => {
    const { lastFrame } = render(
      <WorktreeList worktrees={[]} selectedIndex={0} isLoading={true} />,
    );

    expect(lastFrame()).toContain("Loading");
  });

  test("shows empty state when no worktrees", () => {
    const { lastFrame } = render(
      <WorktreeList worktrees={[]} selectedIndex={0} isLoading={false} />,
    );

    expect(lastFrame()).toContain("No worktrees found");
  });

  test("shows worktrees even while loading status", () => {
    const { lastFrame } = render(
      <WorktreeList
        worktrees={mockWorktrees}
        selectedIndex={0}
        isLoading={true}
      />,
    );

    // Should show worktrees, not loading
    expect(lastFrame()).toContain("main");
    expect(lastFrame()).not.toContain("Loading");
  });

  test("shows selection cursor", () => {
    const { lastFrame } = render(
      <WorktreeList
        worktrees={mockWorktrees}
        selectedIndex={1}
        isLoading={false}
      />,
    );

    // The cursor > should appear in the output
    expect(lastFrame()).toContain(">");
  });

  test("shows status badges", () => {
    const { lastFrame } = render(
      <WorktreeList
        worktrees={mockWorktrees}
        selectedIndex={0}
        isLoading={false}
      />,
    );

    const frame = lastFrame();
    // Primary shown as * after name, not status badge
    expect(frame).toContain(" *");
    expect(frame).toContain("dirty");
    expect(frame).toContain("merged");
  });

  test("shows current worktree indicator", () => {
    const { lastFrame } = render(
      <WorktreeList
        worktrees={mockWorktrees}
        selectedIndex={0}
        isLoading={false}
        currentPath="/Users/dev/.worktrees/repo/feature-auth"
      />,
    );

    // Current worktree (non-primary) should have ● indicator
    expect(lastFrame()).toContain("●");
  });
});
