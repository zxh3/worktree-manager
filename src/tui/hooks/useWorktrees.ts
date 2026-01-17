/**
 * Hook for fetching and managing worktree data
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getConfig } from "../../lib/config";
import { getRepoInfo } from "../../lib/git/repo";
import { getWorktreeStatus } from "../../lib/git/status";
import { listWorktrees } from "../../lib/git/worktree";
import type { WorktreeWithStatus } from "../../lib/types";

export function useWorktrees() {
  const [worktrees, setWorktrees] = useState<WorktreeWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Store primary worktree path to use as cwd for all git operations
  const primaryPathRef = useRef<string | null>(null);

  const fetchWorktrees = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use primary path as cwd if we have it (important after deleting current worktree)
      const list = await listWorktrees(primaryPathRef.current || undefined);

      // Store primary path for future operations
      const primary = list.find((wt) => wt.isPrimary);
      if (primary) {
        primaryPathRef.current = primary.path;
      }

      // Get configured comparison branch from config
      let configuredComparisonBranch: string | undefined;
      try {
        const repoInfo = await getRepoInfo();
        if (repoInfo) {
          const { comparisonBranch } = await getConfig(
            repoInfo.worktreeRoot,
            repoInfo.repoId,
          );
          configuredComparisonBranch = comparisonBranch;
        }
      } catch {
        // Ignore config errors, use auto-detection
      }

      // First, set worktrees without status (fast initial render)
      const initialWorktrees: WorktreeWithStatus[] = list.map((wt) => ({
        ...wt,
        status: [],
      }));
      setWorktrees(initialWorktrees);
      setIsLoading(false);

      // Then, load status for each worktree (slower, background)
      const withStatus: WorktreeWithStatus[] = await Promise.all(
        list.map(async (wt) => {
          try {
            const statusResult = await getWorktreeStatus(
              wt.path,
              wt.branch,
              configuredComparisonBranch,
            );
            return {
              ...wt,
              status: statusResult.status,
              ahead: statusResult.ahead,
              behind: statusResult.behind,
              comparisonBranch: statusResult.comparisonBranch,
            };
          } catch {
            return { ...wt, status: [] };
          }
        }),
      );

      setWorktrees(withStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorktrees();
  }, [fetchWorktrees]);

  return {
    worktrees,
    isLoading,
    error,
    refresh: fetchWorktrees,
  };
}
