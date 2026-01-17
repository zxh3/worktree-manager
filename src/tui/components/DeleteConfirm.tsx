/**
 * Delete confirmation dialog
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { removeWorktree } from "../../lib/git/worktree";
import type { Worktree } from "../../lib/types";
import { theme } from "../theme";

interface DeleteConfirmProps {
  worktree: Worktree;
  primaryWorktree: Worktree;
  currentPath?: string;
  onClose: () => void;
  onDeleted: (shouldMoveToPrimary: boolean) => void;
}

export function DeleteConfirm({
  worktree,
  primaryWorktree,
  currentPath,
  onClose,
  onDeleted,
}: DeleteConfirmProps) {
  // Check if we're deleting the worktree we're currently in
  const isDeletingCurrent =
    currentPath === worktree.path ||
    (currentPath?.startsWith(`${worktree.path}/`) ?? false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useInput((input, key) => {
    if (isDeleting) return;

    if (key.escape || input === "n" || input === "N") {
      onClose();
      return;
    }

    if (input === "y" || input === "Y") {
      handleDelete();
    }
  });

  async function handleDelete() {
    if (worktree.isPrimary) {
      setError("Cannot delete primary worktree");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Run git from primary worktree to avoid issues when deleting current
      // Note: We don't auto-delete the branch - user can do that via CLI if desired
      const result = await removeWorktree(
        worktree.path,
        { force: false },
        primaryWorktree.path,
      );

      if (!result.success) {
        if (result.stderr.includes("dirty")) {
          setError("Worktree has uncommitted changes. Use CLI with --force.");
        } else {
          setError(result.stderr || "Failed to delete worktree");
        }
        setIsDeleting(false);
        return;
      }

      // If we deleted the current worktree, move to primary
      onDeleted(isDeletingCurrent);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsDeleting(false);
    }
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.dialog.delete}
      padding={1}
      marginTop={1}
    >
      <Text bold color={theme.dialog.delete}>
        Delete Worktree
      </Text>

      {worktree.isPrimary ? (
        <Box marginTop={1}>
          <Text color={theme.ui.error}>
            Cannot delete the primary worktree.
          </Text>
        </Box>
      ) : (
        <>
          <Box marginTop={1}>
            <Text>Are you sure you want to delete </Text>
            <Text bold color={theme.ui.warning}>
              {worktree.name}
            </Text>
            <Text>?</Text>
          </Box>

          <Box marginTop={1}>
            <Text dimColor>Path: {worktree.path}</Text>
          </Box>
        </>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={theme.ui.error}>{error}</Text>
        </Box>
      )}

      {isDeleting && (
        <Box marginTop={1}>
          <Text dimColor>Deleting...</Text>
        </Box>
      )}

      <Box marginTop={1}>
        {worktree.isPrimary ? (
          <Text dimColor>[Esc] close</Text>
        ) : (
          <Text dimColor>[y] confirm [n/Esc] cancel</Text>
        )}
      </Box>
    </Box>
  );
}
