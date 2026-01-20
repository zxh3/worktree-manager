/**
 * Create worktree dialog
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
import { createWorktree } from "../../lib/git/worktree";
import { executeHook, getHookConfig } from "../../lib/hooks";
import { resolveWorktreePath } from "../../lib/paths";
import { theme } from "../theme";

interface CreateDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateDialog({ onClose, onCreated }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useInput((input, key) => {
    if (isCreating) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (key.return && name.trim()) {
      handleCreate();
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

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Validate reserved names
    if (
      RESERVED_NAMES.includes(trimmedName as (typeof RESERVED_NAMES)[number])
    ) {
      setError(`"${trimmedName}" is a reserved name`);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const repoInfo = await getRepoInfo();
      if (!repoInfo) {
        throw new Error("Not in a git repository");
      }

      const { worktreeBase, branchPrefix, hooks } = await getConfig(
        repoInfo.worktreeRoot,
        repoInfo.repoId,
      );
      const worktreePath = resolveWorktreePath(
        repoInfo.repoId,
        trimmedName,
        worktreeBase,
      );

      // Determine branch name (with prefix if configured)
      const branchName = branchPrefix
        ? `${branchPrefix}${trimmedName}`
        : trimmedName;

      let result = await createWorktree(worktreePath, {
        name: trimmedName,
        branch: branchName,
      });

      // If branch already exists, reuse it
      if (!result.success && result.stderr.includes("already exists")) {
        result = await createWorktree(worktreePath, {
          name: trimmedName,
          existingBranch: branchName,
        });
      }

      if (!result.success) {
        // Parse common errors
        if (result.stderr.includes("already checked out")) {
          setError("Branch is already checked out in another worktree");
        } else {
          setError(result.stderr || "Failed to create worktree");
        }
        setIsCreating(false);
        return;
      }

      // Execute post-create hook before notifying parent
      const hookConfig = getHookConfig(hooks, "post-create");
      if (hookConfig) {
        await executeHook("post-create", hookConfig, {
          name: trimmedName,
          path: worktreePath,
          branch: branchName,
          repoId: repoInfo.repoId,
        });
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsCreating(false);
    }
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.dialog.create}
      padding={1}
      marginTop={1}
    >
      <Text bold color={theme.dialog.create}>
        Create New Worktree
      </Text>

      <Box marginTop={1}>
        <Text>Name: </Text>
        <Text color={theme.dialog.create}>{name}</Text>
        <Text color={theme.dialog.create} dimColor={isCreating}>
          █
        </Text>
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={theme.ui.error}>{error}</Text>
        </Box>
      )}

      {isCreating && (
        <Box marginTop={1}>
          <Text dimColor>Creating...</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Enter to create • Esc to cancel</Text>
      </Box>
    </Box>
  );
}
