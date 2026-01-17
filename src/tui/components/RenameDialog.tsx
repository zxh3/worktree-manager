/**
 * Rename worktree dialog
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { getConfig } from "../../lib/config";
import {
  MAX_NAME_LENGTH,
  RESERVED_NAMES,
  VALID_NAME_REGEX,
} from "../../lib/constants";
import { getRepoInfo } from "../../lib/git/repo";
import { moveWorktree } from "../../lib/git/worktree";
import { resolveWorktreePath } from "../../lib/paths";
import type { Worktree } from "../../lib/types";
import { theme } from "../theme";

interface RenameDialogProps {
  worktree: Worktree;
  onClose: () => void;
  onRenamed: () => void;
}

export function RenameDialog({
  worktree,
  onClose,
  onRenamed,
}: RenameDialogProps) {
  const [name, setName] = useState(worktree.name);
  const [error, setError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  useInput((input, key) => {
    if (isRenaming) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (key.return && name.trim() && name.trim() !== worktree.name) {
      handleRename();
      return;
    }

    if (key.backspace || key.delete) {
      setName((n) => n.slice(0, -1));
      return;
    }

    // Only accept valid characters and respect max length
    if (
      input &&
      VALID_NAME_REGEX.test(input) &&
      name.length < MAX_NAME_LENGTH
    ) {
      setName((n) => n + input);
    }
  });

  async function handleRename() {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === worktree.name) return;

    // Validate reserved names
    if (
      RESERVED_NAMES.includes(trimmedName as (typeof RESERVED_NAMES)[number])
    ) {
      setError(`"${trimmedName}" is a reserved name`);
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      const repoInfo = await getRepoInfo();
      if (!repoInfo) {
        throw new Error("Not in a git repository");
      }

      const { worktreeBase } = await getConfig(
        repoInfo.worktreeRoot,
        repoInfo.repoId,
      );
      const newPath = resolveWorktreePath(
        repoInfo.repoId,
        trimmedName,
        worktreeBase,
      );

      const result = await moveWorktree(worktree.path, newPath);

      if (!result.success) {
        if (result.stderr.includes("already exists")) {
          setError(`A worktree named '${trimmedName}' already exists`);
        } else {
          setError(result.stderr || "Failed to rename worktree");
        }
        setIsRenaming(false);
        return;
      }

      onRenamed();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsRenaming(false);
    }
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.dialog.rename}
      padding={1}
      marginTop={1}
    >
      <Text bold color={theme.dialog.rename}>
        Rename Worktree
      </Text>

      <Box marginTop={1}>
        <Text dimColor>Current: </Text>
        <Text>{worktree.name}</Text>
      </Box>

      <Box marginTop={1}>
        <Text>New name: </Text>
        <Text color={theme.dialog.rename}>{name}</Text>
        <Text color={theme.dialog.rename} dimColor={isRenaming}>
          █
        </Text>
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.ui.error}>{error}</Text>
        </Box>
      )}

      {isRenaming && (
        <Box marginTop={1}>
          <Text dimColor>Renaming...</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Enter to rename • Esc to cancel</Text>
      </Box>
    </Box>
  );
}
