/**
 * Worktree details view
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { getCommitInfo } from "../../lib/git/log";
import { contractHome } from "../../lib/paths";
import type { WorktreeWithStatus } from "../../lib/types";
import { theme } from "../theme";

interface DetailsViewProps {
  worktree: WorktreeWithStatus;
  onClose: () => void;
  onSelect: () => void;
}

export function DetailsView({ worktree, onClose, onSelect }: DetailsViewProps) {
  const [commitMessage, setCommitMessage] = useState<string | null>(null);

  // Fetch commit message on mount
  useEffect(() => {
    getCommitInfo(worktree.path).then((info) => {
      if (info) {
        setCommitMessage(info.message);
      }
    });
  }, [worktree.path]);

  useInput((input, key) => {
    if (key.escape || input === "q") {
      onClose();
      return;
    }

    if (key.return) {
      onSelect();
    }
  });

  const path = contractHome(worktree.path);
  const statusText =
    worktree.status.length > 0 ? worktree.status.join(", ") : "clean";

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.dialog.info}
      padding={1}
      marginTop={1}
    >
      <Text bold color={theme.dialog.info}>
        Worktree: {worktree.name}
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text dimColor>{"Path:    "}</Text>
          <Text>{path}</Text>
        </Box>

        <Box>
          <Text dimColor>{"Branch:  "}</Text>
          <Text color={worktree.isDetached ? theme.ui.warning : undefined}>
            {worktree.branch || `(detached at ${worktree.head.slice(0, 7)})`}
          </Text>
        </Box>

        <Box>
          <Text dimColor>{"HEAD:    "}</Text>
          <Text>{worktree.head.slice(0, 7)}</Text>
        </Box>

        <Box>
          <Text dimColor>{"Status:  "}</Text>
          <Text
            color={
              worktree.status.includes("dirty")
                ? theme.status.dirty
                : worktree.status.includes("merged")
                  ? theme.status.merged
                  : worktree.status.includes("stale")
                    ? theme.status.stale
                    : undefined
            }
          >
            {statusText}
          </Text>
        </Box>

        {(worktree.ahead !== undefined || worktree.behind !== undefined) && (
          <Box>
            <Text dimColor>{"Sync:    "}</Text>
            {worktree.ahead !== undefined && worktree.ahead > 0 && (
              <Text color={theme.ui.success}>↑{worktree.ahead} ahead </Text>
            )}
            {worktree.behind !== undefined && worktree.behind > 0 && (
              <Text color={theme.status.behind}>↓{worktree.behind} behind</Text>
            )}
            {worktree.ahead === 0 && worktree.behind === 0 && (
              <Text>up to date</Text>
            )}
            {worktree.comparisonBranch && (
              <Text dimColor> (vs {worktree.comparisonBranch})</Text>
            )}
          </Box>
        )}

        {commitMessage && (
          <Box>
            <Text dimColor>{"Commit:  "}</Text>
            <Text>
              {commitMessage.length > 50
                ? `${commitMessage.slice(0, 47)}...`
                : commitMessage}
            </Text>
          </Box>
        )}

        {worktree.isPrimary && (
          <Box marginTop={1}>
            <Text color={theme.status.primary}>● Primary worktree</Text>
          </Box>
        )}

        {worktree.isLocked && (
          <Box>
            <Text color={theme.ui.warning}>🔒 Locked</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Enter to select • Esc to close</Text>
      </Box>
    </Box>
  );
}
