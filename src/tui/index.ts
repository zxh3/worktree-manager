/**
 * TUI entry point
 */

import chalk from "chalk";
import { render } from "ink";
import React from "react";
import { getRepoInfo, isInsideGitRepo } from "../lib/git/repo";
import { hasSkippedShellIntegrationPrompt } from "../lib/preferences";
import { App } from "./App";
import { SetupFlow } from "./components/SetupFlow";

// Bun bundler initializes chalk at compile time, ignoring runtime env vars.
// Manually set color level, respecting NO_COLOR standard (https://no-color.org/)
if (!process.env.NO_COLOR) {
  chalk.level = 3;
}

/**
 * Get render options for TUI.
 *
 * Renders to stderr so that stdout remains free for __wt_cd__ output
 * (shell wrapper captures stdout to detect cd commands).
 * Note: FORCE_COLOR is set in cli.ts before this module is imported.
 */
function getRenderOptions() {
  return {
    stdout: process.stderr,
    stdin: process.stdin,
  };
}

export interface TuiResult {
  selectedPath: string | null;
}

/**
 * Check if shell integration is set up
 */
function hasShellIntegration(): boolean {
  return process.env.WT_SHELL_INTEGRATION === "1";
}

/**
 * Show the setup flow for shell integration
 */
async function showSetupFlow(): Promise<boolean> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(
      React.createElement(SetupFlow, {
        onComplete: () => resolve(true),
        onQuit: () => resolve(false),
      }),
      getRenderOptions(),
    );

    waitUntilExit().then(() => {
      // If we get here without resolve being called, user quit
    });
  });
}

/**
 * Show the main TUI
 */
async function showMainTui(repoName: string): Promise<TuiResult> {
  return new Promise((resolve) => {
    let selectedPath: string | null = null;
    const currentPath = process.cwd();

    const { waitUntilExit } = render(
      React.createElement(App, {
        repoName,
        currentPath,
        onSelect: (path: string) => {
          selectedPath = path;
        },
      }),
      getRenderOptions(),
    );

    waitUntilExit().then(() => {
      // Output for shell integration (goes to stdout for shell wrapper to capture)
      // Escape the path to handle spaces and special characters
      if (selectedPath) {
        const escapedPath = selectedPath.replace(/"/g, '\\"');
        console.log(`__wt_cd__"${escapedPath}"`);
      }
      resolve({ selectedPath });
    });
  });
}

export async function launchTui(): Promise<TuiResult> {
  // Check we're in a git repo
  if (!(await isInsideGitRepo())) {
    console.error("error: Not a git repository");
    process.exit(1);
  }

  const repoInfo = await getRepoInfo();
  if (!repoInfo) {
    console.error("error: Could not get repository information");
    process.exit(1);
  }

  // Check if we need to show the setup flow
  const needsSetup = !hasShellIntegration();
  const skippedSetup = await hasSkippedShellIntegrationPrompt();

  if (needsSetup && !skippedSetup) {
    const shouldContinue = await showSetupFlow();
    if (!shouldContinue) {
      // User quit from setup flow
      return { selectedPath: null };
    }
  }

  // Show the main TUI
  return showMainTui(repoInfo.repoId);
}
