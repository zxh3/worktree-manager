/**
 * Tests for useWorktrees hook - specifically status preservation during refresh
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { useEffect } from "react";
import type { Worktree, WorktreeWithStatus } from "../../lib/types";
import { useWorktrees } from "../hooks/useWorktrees";

// Mock modules
const mockListWorktrees = mock(() => Promise.resolve([] as Worktree[]));
const mockGetWorktreeStatus = mock(() =>
  Promise.resolve({
    status: [] as string[],
    ahead: 0,
    behind: 0,
    comparisonBranch: "origin/main",
  }),
);
const mockGetRepoInfo = mock(() =>
  Promise.resolve({
    gitDir: "/repo/.git",
    worktreeRoot: "/repo",
    isPrimary: true,
    remoteUrl: "git@github.com:user/repo.git",
    repoId: "repo",
  }),
);
const mockGetConfig = mock(() =>
  Promise.resolve({
    comparisonBranch: undefined,
  }),
);

// Apply mocks
mock.module("../../lib/git/worktree", () => ({
  listWorktrees: mockListWorktrees,
}));
mock.module("../../lib/git/status", () => ({
  getWorktreeStatus: mockGetWorktreeStatus,
}));
mock.module("../../lib/git/repo", () => ({
  getRepoInfo: mockGetRepoInfo,
}));
mock.module("../../lib/config", () => ({
  getConfig: mockGetConfig,
}));

// Test component that exposes hook state
function TestComponent({
  onState,
}: {
  onState: (state: {
    worktrees: WorktreeWithStatus[];
    isLoading: boolean;
    refresh: () => void;
  }) => void;
}) {
  const { worktrees, isLoading, refresh } = useWorktrees();

  useEffect(() => {
    onState({ worktrees, isLoading, refresh });
  }, [worktrees, isLoading, refresh, onState]);

  return (
    <Text>
      {worktrees
        .map((wt) => `${wt.name}:${wt.status.join(",") || "none"}`)
        .join("|")}
    </Text>
  );
}

// Helper to wait for async operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const baseWorktree: Worktree = {
  name: "main",
  path: "/repo",
  branch: "main",
  head: "abc123",
  isPrimary: true,
  isDetached: false,
  isLocked: false,
  isPrunable: false,
};

describe("useWorktrees", () => {
  beforeEach(() => {
    mockListWorktrees.mockReset();
    mockGetWorktreeStatus.mockReset();
    mockGetRepoInfo.mockReset();
    mockGetConfig.mockReset();

    // Default implementations
    mockGetRepoInfo.mockImplementation(() =>
      Promise.resolve({
        gitDir: "/repo/.git",
        worktreeRoot: "/repo",
        isPrimary: true,
        remoteUrl: "git@github.com:user/repo.git",
        repoId: "repo",
      }),
    );
    mockGetConfig.mockImplementation(() =>
      Promise.resolve({ comparisonBranch: undefined }),
    );
  });

  afterEach(() => {
    mock.restore();
  });

  test("preserves existing status during refresh", async () => {
    const worktrees: Worktree[] = [
      { ...baseWorktree },
      {
        ...baseWorktree,
        name: "feature",
        path: "/repo/feature",
        branch: "feature",
        isPrimary: false,
      },
    ];

    // First load: return status immediately
    mockListWorktrees.mockImplementation(() => Promise.resolve(worktrees));
    mockGetWorktreeStatus
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: ["dirty"],
          ahead: 1,
          behind: 0,
          comparisonBranch: "origin/main",
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: ["merged"],
          ahead: 0,
          behind: 2,
          comparisonBranch: "origin/main",
        }),
      );

    const states: { worktrees: WorktreeWithStatus[]; isLoading: boolean }[] =
      [];
    const ref = { refresh: null as (() => void) | null };

    const { lastFrame } = render(
      <TestComponent
        onState={(state) => {
          states.push({
            worktrees: [...state.worktrees],
            isLoading: state.isLoading,
          });
          ref.refresh = state.refresh;
        }}
      />,
    );

    // Wait for initial load to complete
    await delay(50);

    // Should have loaded with status
    const initialState = states[states.length - 1];
    expect(initialState.worktrees.length).toBe(2);
    expect(initialState.worktrees[0].status).toContain("dirty");
    expect(initialState.worktrees[1].status).toContain("merged");

    // Verify status shows in render
    expect(lastFrame()).toContain("dirty");
    expect(lastFrame()).toContain("merged");

    // Now simulate refresh with delayed status fetch
    // The status fetch will take longer this time
    const resolvers: { resolve: () => void }[] = [];
    mockGetWorktreeStatus
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvers.push({
              resolve: () =>
                resolve({
                  status: ["synced"],
                  ahead: 0,
                  behind: 0,
                  comparisonBranch: "origin/main",
                }),
            });
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvers.push({
              resolve: () =>
                resolve({
                  status: ["ahead"],
                  ahead: 3,
                  behind: 0,
                  comparisonBranch: "origin/main",
                }),
            });
          }),
      );

    // Trigger refresh
    ref.refresh?.();
    await delay(10);

    // During refresh, status should be PRESERVED (this is the bug fix we're testing)
    const duringRefreshState = states[states.length - 1];
    expect(duringRefreshState.worktrees.length).toBe(2);
    // Status should still show the old values
    expect(duringRefreshState.worktrees[0].status).toContain("dirty");
    expect(duringRefreshState.worktrees[1].status).toContain("merged");

    // The rendered output should still show the old status
    expect(lastFrame()).toContain("dirty");
    expect(lastFrame()).toContain("merged");

    // Now resolve the status fetches
    for (const r of resolvers) {
      r.resolve();
    }
    await delay(50);

    // After refresh completes, should have new status
    const afterRefreshState = states[states.length - 1];
    expect(afterRefreshState.worktrees[0].status).toContain("synced");
    expect(afterRefreshState.worktrees[1].status).toContain("ahead");
  });

  test("handles removed worktree during refresh", async () => {
    const worktrees: Worktree[] = [
      { ...baseWorktree },
      {
        ...baseWorktree,
        name: "feature",
        path: "/repo/feature",
        branch: "feature",
        isPrimary: false,
      },
    ];

    mockListWorktrees.mockImplementation(() => Promise.resolve(worktrees));
    mockGetWorktreeStatus.mockImplementation(() =>
      Promise.resolve({
        status: ["dirty"],
        ahead: 1,
        behind: 0,
        comparisonBranch: "origin/main",
      }),
    );

    const states: { worktrees: WorktreeWithStatus[] }[] = [];
    const ref = { refresh: null as (() => void) | null };

    render(
      <TestComponent
        onState={(state) => {
          states.push({ worktrees: [...state.worktrees] });
          ref.refresh = state.refresh;
        }}
      />,
    );

    await delay(50);

    // Initially 2 worktrees
    expect(states[states.length - 1].worktrees.length).toBe(2);

    // Simulate deletion - now only return 1 worktree
    mockListWorktrees.mockImplementation(() => Promise.resolve([worktrees[0]]));

    // Trigger refresh
    ref.refresh?.();
    await delay(50);

    // Should now only have 1 worktree (the deleted one shouldn't persist)
    const afterDeleteState = states[states.length - 1];
    expect(afterDeleteState.worktrees.length).toBe(1);
    expect(afterDeleteState.worktrees[0].name).toBe("main");
  });

  test("preserves ahead/behind counts during refresh", async () => {
    const worktrees: Worktree[] = [{ ...baseWorktree }];

    mockListWorktrees.mockImplementation(() => Promise.resolve(worktrees));
    mockGetWorktreeStatus.mockImplementation(() =>
      Promise.resolve({
        status: ["ahead"],
        ahead: 5,
        behind: 2,
        comparisonBranch: "origin/main",
      }),
    );

    const states: { worktrees: WorktreeWithStatus[] }[] = [];
    const ref = { refresh: null as (() => void) | null };

    render(
      <TestComponent
        onState={(state) => {
          states.push({ worktrees: [...state.worktrees] });
          ref.refresh = state.refresh;
        }}
      />,
    );

    await delay(50);

    // Check initial ahead/behind
    const initialState = states[states.length - 1];
    expect(initialState.worktrees[0].ahead).toBe(5);
    expect(initialState.worktrees[0].behind).toBe(2);
    expect(initialState.worktrees[0].comparisonBranch).toBe("origin/main");

    // Set up delayed status response
    const resolver = { resolve: null as (() => void) | null };
    mockGetWorktreeStatus.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver.resolve = () =>
            resolve({
              status: ["synced"],
              ahead: 0,
              behind: 0,
              comparisonBranch: "origin/main",
            });
        }),
    );

    // Trigger refresh
    ref.refresh?.();
    await delay(10);

    // During refresh, ahead/behind should be preserved
    const duringRefresh = states[states.length - 1];
    expect(duringRefresh.worktrees[0].ahead).toBe(5);
    expect(duringRefresh.worktrees[0].behind).toBe(2);

    // Complete the refresh
    resolver.resolve?.();
    await delay(50);

    // After refresh, should have new values
    const afterRefresh = states[states.length - 1];
    expect(afterRefresh.worktrees[0].ahead).toBe(0);
    expect(afterRefresh.worktrees[0].behind).toBe(0);
  });

  test("new worktrees get empty status until loaded", async () => {
    const initialWorktrees: Worktree[] = [{ ...baseWorktree }];

    mockListWorktrees.mockImplementation(() =>
      Promise.resolve(initialWorktrees),
    );
    mockGetWorktreeStatus.mockImplementation(() =>
      Promise.resolve({
        status: ["dirty"],
        ahead: 0,
        behind: 0,
        comparisonBranch: "origin/main",
      }),
    );

    const states: { worktrees: WorktreeWithStatus[] }[] = [];
    const ref = { refresh: null as (() => void) | null };

    render(
      <TestComponent
        onState={(state) => {
          states.push({ worktrees: [...state.worktrees] });
          ref.refresh = state.refresh;
        }}
      />,
    );

    await delay(50);

    // Initial: 1 worktree with status
    expect(states[states.length - 1].worktrees.length).toBe(1);
    expect(states[states.length - 1].worktrees[0].status).toContain("dirty");

    // Add a new worktree
    const newWorktree: Worktree = {
      ...baseWorktree,
      name: "new-feature",
      path: "/repo/new-feature",
      branch: "new-feature",
      isPrimary: false,
    };
    mockListWorktrees.mockImplementation(() =>
      Promise.resolve([...initialWorktrees, newWorktree]),
    );

    // Delay status for the new worktree
    const resolver = { resolve: null as (() => void) | null };
    mockGetWorktreeStatus
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: ["dirty"],
          ahead: 0,
          behind: 0,
          comparisonBranch: "origin/main",
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolver.resolve = () =>
              resolve({
                status: ["synced"],
                ahead: 0,
                behind: 0,
                comparisonBranch: "origin/main",
              });
          }),
      );

    // Trigger refresh
    ref.refresh?.();
    await delay(10);

    // During refresh: existing worktree keeps status, new one has empty
    const duringRefresh = states[states.length - 1];
    expect(duringRefresh.worktrees.length).toBe(2);
    expect(duringRefresh.worktrees[0].status).toContain("dirty"); // preserved
    expect(duringRefresh.worktrees[1].status).toEqual([]); // new, empty

    // Complete status fetch
    resolver.resolve?.();
    await delay(50);

    // After refresh, new worktree should have status
    const afterRefresh = states[states.length - 1];
    expect(afterRefresh.worktrees[1].status).toContain("synced");
  });
});
