/**
 * Output formatting utilities
 */

import chalk from "chalk";
import { contractHome } from "../lib/paths";
import type { Worktree } from "../lib/types";

/**
 * Format a worktree for display
 */
export function formatWorktree(
  wt: Worktree,
  options?: { showPath?: boolean },
): string {
  const parts: string[] = [];

  // Status indicator
  if (wt.isPrimary) {
    parts.push(chalk.green("●"));
  } else {
    parts.push(chalk.dim("○"));
  }

  // Name
  parts.push(wt.isPrimary ? chalk.bold(wt.name) : wt.name);

  // Branch (if different from name)
  if (wt.branch && wt.branch !== wt.name) {
    parts.push(chalk.dim(`(${wt.branch})`));
  } else if (wt.isDetached) {
    parts.push(chalk.yellow(`(detached: ${wt.head.slice(0, 7)})`));
  }

  // Path
  if (options?.showPath) {
    parts.push(chalk.dim(contractHome(wt.path)));
  }

  // Flags (primary indicated by ● icon, not text badge)
  if (wt.isLocked) {
    parts.push(chalk.red("locked"));
  }
  if (wt.isPrunable) {
    parts.push(chalk.yellow("prunable"));
  }

  return parts.join("  ");
}

/**
 * Format worktrees as a list
 */
export function formatWorktreeList(worktrees: Worktree[]): string {
  if (worktrees.length === 0) {
    return chalk.dim("No worktrees found");
  }

  return worktrees
    .map((wt) => formatWorktree(wt, { showPath: true }))
    .join("\n");
}

/**
 * Format worktrees as JSON
 */
export function formatWorktreesJson(worktrees: Worktree[]): string {
  return JSON.stringify(worktrees, null, 2);
}

/**
 * Format worktrees in porcelain format (machine-readable)
 */
export function formatWorktreesPorcelain(worktrees: Worktree[]): string {
  return worktrees
    .map((wt) => {
      const lines = [`worktree ${wt.path}`, `HEAD ${wt.head}`];
      if (wt.branch) {
        lines.push(`branch refs/heads/${wt.branch}`);
      } else {
        lines.push("detached");
      }
      if (wt.isLocked) lines.push("locked");
      if (wt.isPrunable) lines.push("prunable");
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Format an error message
 */
export function formatError(message: string): string {
  return chalk.red(`error: ${message}`);
}

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return chalk.green(`✓ ${message}`);
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return chalk.yellow(`warning: ${message}`);
}

/**
 * Format a hint/info message
 */
export function formatHint(message: string): string {
  return chalk.dim(`hint: ${message}`);
}
