/**
 * Worktree list component
 */

import { Box, Text, useStdout } from "ink";
import type { WorktreeWithStatus } from "../../lib/types";
import { VERSION } from "../../lib/version";
import { formatHeader } from "./columns";
import { WorktreeItem } from "./WorktreeItem";

interface WorktreeListProps {
  worktrees: WorktreeWithStatus[];
  selectedIndex: number;
  isLoading: boolean;
  currentPath?: string;
}

export function WorktreeList({
  worktrees,
  selectedIndex,
  isLoading,
  currentPath,
}: WorktreeListProps) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 80;

  // Helper to check if a worktree is the current one
  const isCurrentWorktree = (wt: WorktreeWithStatus): boolean => {
    if (!currentPath) return false;
    return currentPath === wt.path || currentPath.startsWith(`${wt.path}/`);
  };

  if (isLoading && worktrees.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Loading worktrees...</Text>
      </Box>
    );
  }

  if (worktrees.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>No worktrees found</Text>
      </Box>
    );
  }

  const title = ` worktrees v${VERSION} `;
  const boxWidth = terminalWidth - 2; // -2 for paddingX
  const titleLineWidth = boxWidth - title.length - 4; // -4 for ╭─ and ─╮

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      {/* Top border with title and column headers */}
      <Text dimColor>
        {"╭─"}
        {title}
        {"─".repeat(Math.max(0, titleLineWidth))}
        {"─╮"}
      </Text>
      <Box>
        <Text dimColor>{"│"}</Text>
        <Box width={boxWidth - 2}>
          <Text dimColor>{formatHeader()}</Text>
        </Box>
        <Text dimColor>{"│"}</Text>
      </Box>
      {/* Content rows */}
      {worktrees.map((wt, index) => (
        <Box key={wt.path}>
          <Text dimColor>{"│"}</Text>
          <Box width={boxWidth - 2}>
            <WorktreeItem
              worktree={wt}
              isSelected={index === selectedIndex}
              isCurrent={isCurrentWorktree(wt)}
            />
          </Box>
          <Text dimColor>{"│"}</Text>
        </Box>
      ))}
      {/* Bottom border */}
      <Text dimColor>
        {"╰"}
        {"─".repeat(boxWidth - 2)}
        {"╯"}
      </Text>
    </Box>
  );
}
