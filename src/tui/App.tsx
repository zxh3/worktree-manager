/**
 * Main TUI application
 */

import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useState } from "react";
import type { WorktreeWithStatus } from "../lib/types";
import { CreateDialog } from "./components/CreateDialog";
import { DeleteConfirm } from "./components/DeleteConfirm";
import { DetailsView } from "./components/DetailsView";
import { RenameDialog } from "./components/RenameDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { StatusBar } from "./components/StatusBar";
import { WorktreeList } from "./components/WorktreeList";
import { useWorktrees } from "./hooks/useWorktrees";

type DialogType =
  | "none"
  | "create"
  | "delete"
  | "rename"
  | "details"
  | "settings";

interface AppProps {
  repoName: string;
  currentPath?: string;
  onSelect: (path: string) => void;
}

export function App({ repoName, currentPath, onSelect }: AppProps) {
  const { exit } = useApp();
  const { worktrees, isLoading, error, refresh } = useWorktrees();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeDialog, setActiveDialog] = useState<DialogType>("none");
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);
  // Track the "destination" worktree (where we'll cd on quit)
  const [destinationPath, setDestinationPath] = useState<string | undefined>(
    currentPath,
  );

  // Set initial selection to current worktree
  useEffect(() => {
    if (!initialSelectionDone && worktrees.length > 0 && currentPath) {
      // Find worktree that matches current path (current path may be subdirectory)
      const index = worktrees.findIndex(
        (wt) =>
          currentPath === wt.path || currentPath.startsWith(`${wt.path}/`),
      );
      if (index !== -1) {
        setSelectedIndex(index);
      }
      setInitialSelectionDone(true);
    }
  }, [worktrees, currentPath, initialSelectionDone]);

  // Keep selection in bounds when worktrees change
  useEffect(() => {
    if (selectedIndex >= worktrees.length && worktrees.length > 0) {
      setSelectedIndex(worktrees.length - 1);
    }
  }, [worktrees.length, selectedIndex]);

  const selectedWorktree = worktrees[selectedIndex] as
    | WorktreeWithStatus
    | undefined;
  const primaryWorktree = worktrees.find((wt) => wt.isPrimary);

  // Handle keyboard input when no dialog is open
  useInput(
    (input, key) => {
      if (activeDialog !== "none") return;

      // Navigation (wrap around)
      if (input === "j" || key.downArrow) {
        setSelectedIndex((i) => (i + 1) % worktrees.length);
        return;
      }
      if (input === "k" || key.upArrow) {
        setSelectedIndex((i) => (i - 1 + worktrees.length) % worktrees.length);
        return;
      }

      // Quick actions
      if (input === "n") {
        setActiveDialog("create");
        return;
      }
      if (input === "d" && selectedWorktree) {
        setActiveDialog("delete");
        return;
      }
      if (input === "r" && selectedWorktree && !selectedWorktree.isPrimary) {
        setActiveDialog("rename");
        return;
      }
      if (input === "i" && selectedWorktree) {
        setActiveDialog("details");
        return;
      }
      if (input === "s") {
        setActiveDialog("settings");
        return;
      }

      // Quit - go to destination if different from current
      if (input === "q") {
        if (destinationPath && destinationPath !== currentPath) {
          onSelect(destinationPath);
        }
        exit();
        return;
      }

      // Enter marks destination (doesn't exit)
      if (key.return && selectedWorktree) {
        setDestinationPath(selectedWorktree.path);
        return;
      }
    },
    { isActive: activeDialog === "none" },
  );

  const handleDialogClose = () => {
    setActiveDialog("none");
  };

  const handleCreated = () => {
    refresh();
    setActiveDialog("none");
  };

  const handleDeleted = () => {
    refresh();
    setActiveDialog("none");
  };

  const handleRenamed = () => {
    refresh();
    setActiveDialog("none");
  };

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <WorktreeList
        worktrees={worktrees}
        selectedIndex={selectedIndex}
        isLoading={isLoading}
        currentPath={destinationPath}
      />

      <StatusBar />

      {activeDialog === "create" && (
        <CreateDialog onClose={handleDialogClose} onCreated={handleCreated} />
      )}

      {activeDialog === "delete" && selectedWorktree && primaryWorktree && (
        <DeleteConfirm
          worktree={selectedWorktree}
          primaryWorktree={primaryWorktree}
          currentPath={currentPath}
          onClose={handleDialogClose}
          onDeleted={(shouldMoveToPrimary) => {
            if (shouldMoveToPrimary) {
              setDestinationPath(primaryWorktree.path);
            }
            handleDeleted();
          }}
        />
      )}

      {activeDialog === "rename" && selectedWorktree && (
        <RenameDialog
          worktree={selectedWorktree}
          onClose={handleDialogClose}
          onRenamed={handleRenamed}
        />
      )}

      {activeDialog === "details" && selectedWorktree && (
        <DetailsView
          worktree={selectedWorktree}
          onClose={handleDialogClose}
          onSelect={() => {
            setDestinationPath(selectedWorktree.path);
            setActiveDialog("none");
          }}
        />
      )}

      {activeDialog === "settings" && (
        <SettingsDialog
          repoId={repoName}
          onClose={handleDialogClose}
          onSaved={() => {
            refresh();
            setActiveDialog("none");
          }}
        />
      )}
    </Box>
  );
}
