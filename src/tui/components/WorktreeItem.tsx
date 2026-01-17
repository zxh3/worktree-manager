/**
 * Individual worktree row component
 */

import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { formatAge, getCommitInfo } from "../../lib/git/log";
import { contractHome } from "../../lib/paths";
import type { WorktreeWithStatus } from "../../lib/types";
import { theme } from "../theme";

interface WorktreeItemProps {
  worktree: WorktreeWithStatus;
  isSelected: boolean;
  isCurrent: boolean;
}

export function WorktreeItem({
  worktree,
  isSelected,
  isCurrent,
}: WorktreeItemProps) {
  const [age, setAge] = useState<string | null>(null);

  // Fetch commit info on mount for age display
  useEffect(() => {
    getCommitInfo(worktree.path)
      .then((info) => {
        if (info) {
          setAge(formatAge(info.timestamp));
        }
      })
      .catch(() => {
        // Silently ignore errors (e.g., git not available in tests)
      });
  }, [worktree.path]);

  const cursor = isSelected ? ">" : " ";
  const icon = isCurrent ? "●" : "○";
  const path = contractHome(worktree.path);

  // Determine status badge (primary no longer overrides - show actual status)
  let statusBadge = "";
  let statusColor: string | undefined;

  if (worktree.status.includes("dirty")) {
    statusBadge = "dirty";
    statusColor = theme.status.dirty;
  } else if (worktree.status.includes("merged")) {
    statusBadge = "merged";
    statusColor = theme.status.merged;
  } else if (worktree.status.includes("stale")) {
    statusBadge = "stale";
    statusColor = theme.status.stale;
  } else if (worktree.status.includes("diverged")) {
    statusBadge = "diverged";
    statusColor = theme.status.diverged;
  } else if (worktree.status.includes("behind")) {
    statusBadge = "behind";
    statusColor = theme.status.behind;
  } else if (worktree.status.includes("ahead")) {
    statusBadge = "ahead";
    statusColor = theme.status.ahead;
  } else if (worktree.status.includes("synced")) {
    statusBadge = "synced";
    statusColor = theme.status.synced;
  }

  // Truncate path if too long
  const maxPathLen = 32;
  const displayPath =
    path.length > maxPathLen ? `...${path.slice(-(maxPathLen - 3))}` : path;

  // Get ahead/behind for sync indicators
  const { ahead, behind } = worktree;

  // Column widths (exported for header alignment)
  // cursor(1) + space(1) + icon(1) + space(1) = 4 chars before name
  // name: 20 chars (includes space for " (*)" primary indicator)
  // gap: 2 chars
  // path: 32 chars
  // gap: 2 chars
  // age: 4 chars
  // gap: 2 chars
  // status: 8 chars

  // Name column: 20 chars total, includes space for " *" primary indicator
  const nameWidth = 20;
  const primarySuffix = worktree.isPrimary ? " *" : "";
  const maxNameLen = nameWidth - primarySuffix.length;
  const truncatedName = worktree.name.slice(0, maxNameLen);
  const namePadding = " ".repeat(
    nameWidth - truncatedName.length - primarySuffix.length,
  );
  const pathStr = displayPath.padEnd(32);
  const ageStr = (age || "").padEnd(4);
  const statusStr = statusBadge.padEnd(8);

  return (
    <Box>
      <Text color={isSelected ? theme.accent : undefined}>{cursor} </Text>
      <Text color={isCurrent ? theme.accent : "dim"}>{icon}</Text>
      <Text color={isSelected ? theme.accent : undefined}>
        {" "}
        {truncatedName}
      </Text>
      {worktree.isPrimary && (
        <Text color={theme.status.primary}>{primarySuffix}</Text>
      )}
      <Text>{namePadding}</Text>
      <Text dimColor> {pathStr}</Text>
      <Text dimColor> {ageStr}</Text>
      <Text color={statusColor}> {statusStr}</Text>
      {ahead !== undefined && ahead > 0 && (
        <Text color={theme.ui.success}>↑{ahead}</Text>
      )}
      {behind !== undefined && behind > 0 && (
        <Text color={theme.status.behind}>↓{behind}</Text>
      )}
    </Box>
  );
}
