/**
 * Tests for DeleteConfirm component
 */

import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import type { Worktree } from "../../lib/types";
import { DeleteConfirm } from "../components/DeleteConfirm";

const mockWorktree: Worktree = {
  name: "feature-auth",
  path: "/Users/dev/.worktrees/repo/feature-auth",
  branch: "feature/auth",
  head: "abc123def456",
  isPrimary: false,
  isDetached: false,
  isLocked: false,
  isPrunable: false,
};

const mockPrimaryWorktree: Worktree = {
  name: "main",
  path: "/Users/dev/repo",
  branch: "main",
  head: "def456abc123",
  isPrimary: true,
  isDetached: false,
  isLocked: false,
  isPrunable: false,
};

describe("DeleteConfirm", () => {
  test("renders dialog title", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).toContain("Delete Worktree");
  });

  test("shows worktree name in confirmation", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).toContain("feature-auth");
  });

  test("shows confirmation prompt for non-primary", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).toContain("Are you sure");
    expect(lastFrame()).toContain("[y] confirm");
    expect(lastFrame()).toContain("[n/Esc] cancel");
  });

  test("shows path of worktree", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).toContain(mockWorktree.path);
  });

  test("shows error message for primary worktree", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockPrimaryWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).toContain("Cannot delete the primary worktree");
  });

  test("shows Esc to close for primary worktree", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockPrimaryWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).toContain("[Esc] close");
  });

  test("does not show confirmation prompt for primary", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockPrimaryWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).not.toContain("Are you sure");
    expect(lastFrame()).not.toContain("[y] confirm");
  });

  test("has rounded border style", () => {
    const { lastFrame } = render(
      <DeleteConfirm
        worktree={mockWorktree}
        primaryWorktree={mockPrimaryWorktree}
        onClose={() => {}}
        onDeleted={() => {}}
      />,
    );

    expect(lastFrame()).toContain("╭");
    expect(lastFrame()).toContain("╯");
  });
});
