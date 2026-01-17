/**
 * Individual worktree row component
 */

import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { formatAge, getCommitInfo } from "../../lib/git/log";
import { contractHome } from "../../lib/paths";
import type { WorktreeWithStatus } from "../../lib/types";
import { theme } from "../theme";
import { COLUMNS, formatRow, GAP } from "./columns";

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

  const path = contractHome(worktree.path);

  // Determine status badge
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
  const displayPath =
    path.length > COLUMNS.path ? `...${path.slice(-(COLUMNS.path - 3))}` : path;

  // Build name with primary indicator
  const primarySuffix = worktree.isPrimary ? " *" : "";
  const maxNameLen = COLUMNS.name - primarySuffix.length;
  const displayName = worktree.name.slice(0, maxNameLen) + primarySuffix;

  // Build ahead/behind suffix
  const { ahead, behind } = worktree;
  let syncSuffix = "";
  if (ahead !== undefined && ahead > 0) syncSuffix += `+${ahead}`;
  if (behind !== undefined && behind > 0) syncSuffix += `-${behind}`;

  // Format the full row as a single string for consistent alignment
  const rowText = formatRow({
    cursor: isSelected ? ">" : "",
    icon: isCurrent ? "●" : "○",
    name: displayName,
    path: displayPath,
    age: age || "",
    status: statusBadge,
    suffix: syncSuffix,
  });

  // Render with colors applied to specific sections
  // Account for gaps between columns
  const cursorEnd = COLUMNS.cursor;
  const iconEnd = cursorEnd + COLUMNS.icon;
  const nameEnd = iconEnd + COLUMNS.name;
  const pathEnd = nameEnd + GAP + COLUMNS.path;
  const ageEnd = pathEnd + GAP + COLUMNS.age;
  const statusEnd = ageEnd + GAP + COLUMNS.status;

  return (
    <Box>
      <Text color={isSelected ? theme.accent : undefined}>
        {rowText.slice(0, cursorEnd)}
      </Text>
      <Text color={isCurrent ? theme.accent : "dim"}>
        {rowText.slice(cursorEnd, iconEnd)}
      </Text>
      <Text color={isSelected ? theme.accent : undefined}>
        {rowText.slice(iconEnd, nameEnd)}
      </Text>
      <Text dimColor>{rowText.slice(nameEnd, pathEnd)}</Text>
      <Text dimColor>{rowText.slice(pathEnd, ageEnd)}</Text>
      <Text color={statusColor}>{rowText.slice(ageEnd, statusEnd)}</Text>
      <Text color={ahead && ahead > 0 ? theme.ui.success : theme.status.behind}>
        {rowText.slice(statusEnd)}
      </Text>
    </Box>
  );
}
