/**
 * Centralized color scheme for the TUI
 */

export const theme = {
  // Primary accent color (selection, keys, active items)
  accent: "#9c9282",

  // Status colors (ordered by urgency: high → low)
  status: {
    diverged: "#ff6b6b", // Coral red - needs rebase, most urgent
    behind: "#ffa07a", // Light salmon - needs pull/rebase
    dirty: "#f0c674", // Warm yellow - uncommitted changes
    ahead: "#81a2be", // Steel blue - ready to push
    synced: "#5f875f", // Muted green - all good, no action needed
    merged: "#87af87", // Soft green - can be cleaned up
    stale: "#707880", // Gray - old, low priority
    primary: "#c87c3e", // Orange-brown for primary worktree indicator
  },

  // UI element colors
  ui: {
    error: "red",
    success: "green",
    warning: "yellow",
    border: "dim",
    text: undefined, // Default text color
    textDim: "dim",
  },

  // Dialog colors
  dialog: {
    create: "#9c9282", // Accent color for create dialog
    delete: "red", // Red for delete dialog
    rename: "#9c9282", // Accent color for rename dialog
    info: "#9c9282", // Accent color for info/details dialog
  },
} as const;
