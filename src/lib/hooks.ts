/**
 * Hook execution system for worktree lifecycle events
 */

import { execShellCommand } from "../utils/compat";
import type { HookCommand, HooksConfig, HookType } from "./config";

/** Default timeout for hook commands in seconds */
const DEFAULT_TIMEOUT = 30;

/** Context passed to hooks as environment variables */
export interface HookContext {
  /** Worktree directory name */
  name: string;
  /** Absolute path to worktree */
  path: string;
  /** Git branch name (empty if detached) */
  branch: string;
  /** Repository identifier */
  repoId: string;
  /** Previous worktree name (for post-rename) */
  oldName?: string;
  /** Previous worktree path (for post-rename) */
  oldPath?: string;
}

/** Result of a single hook command execution */
export interface HookResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut?: boolean;
}

/** Normalized hook configuration */
interface NormalizedHookConfig {
  commands: string[];
  timeout: number;
  continueOnError: boolean;
}

/**
 * Normalize hook configuration from various formats to a standard form
 */
export function normalizeHookConfig(
  config: HookCommand | undefined,
): NormalizedHookConfig | null {
  if (!config) {
    return null;
  }

  // String format: single command
  if (typeof config === "string") {
    return {
      commands: [config],
      timeout: DEFAULT_TIMEOUT,
      continueOnError: false,
    };
  }

  // Array format: multiple commands
  if (Array.isArray(config)) {
    return {
      commands: config,
      timeout: DEFAULT_TIMEOUT,
      continueOnError: false,
    };
  }

  // Object format: full control
  const commands =
    typeof config.commands === "string" ? [config.commands] : config.commands;

  return {
    commands,
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    continueOnError: config.continueOnError ?? false,
  };
}

/**
 * Build environment variables for hook execution
 */
function buildHookEnv(
  hookType: HookType,
  context: HookContext,
): Record<string, string> {
  const env: Record<string, string> = {
    WT_NAME: context.name,
    WT_PATH: context.path,
    WT_BRANCH: context.branch,
    WT_REPO_ID: context.repoId,
    WT_HOOK: hookType,
  };

  // Additional vars for post-rename
  if (context.oldName) {
    env.WT_OLD_NAME = context.oldName;
  }
  if (context.oldPath) {
    env.WT_OLD_PATH = context.oldPath;
  }

  return env;
}

/**
 * Execute a single hook command
 */
async function runHookCommand(
  command: string,
  cwd: string,
  env: Record<string, string>,
  timeout: number,
): Promise<HookResult> {
  const result = await execShellCommand(command, { cwd, env, timeout });
  return {
    success: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
  };
}

/**
 * Format hook output for display to user
 */
function formatHookOutput(stdout: string, stderr: string): string {
  const lines: string[] = [];

  if (stdout) {
    for (const line of stdout.split("\n")) {
      lines.push(`[hook] ${line}`);
    }
  }

  if (stderr) {
    for (const line of stderr.split("\n")) {
      lines.push(`[hook] ${line}`);
    }
  }

  return lines.join("\n");
}

/**
 * Execute a hook for a given event
 * Logs output and warnings but does not throw on failure
 * @param hookType - The type of hook being executed
 * @param hookConfig - The hook configuration
 * @param context - Context for the hook (name, path, branch, etc.)
 * @param cwdOverride - Optional working directory override (used for post-delete)
 */
export async function executeHook(
  hookType: HookType,
  hookConfig: HookCommand | undefined,
  context: HookContext,
  cwdOverride?: string,
): Promise<void> {
  const normalized = normalizeHookConfig(hookConfig);
  if (!normalized || normalized.commands.length === 0) {
    return;
  }

  const env = buildHookEnv(hookType, context);

  // Determine working directory
  // Use override if provided (e.g., repo root for post-delete)
  // Otherwise use the worktree path
  const cwd = cwdOverride ?? context.path;

  for (const command of normalized.commands) {
    const result = await runHookCommand(command, cwd, env, normalized.timeout);

    // Display output
    const output = formatHookOutput(result.stdout, result.stderr);
    if (output) {
      console.error(output);
    }

    // Handle failures
    if (!result.success) {
      if (result.timedOut) {
        console.error(
          `[hook] Warning: ${hookType} hook timed out after ${normalized.timeout}s`,
        );
      } else {
        console.error(
          `[hook] Warning: ${hookType} hook command failed (exit ${result.exitCode})`,
        );
      }

      // Stop on first failure unless continueOnError is set
      if (!normalized.continueOnError) {
        break;
      }
    }
  }
}

/**
 * Get the hook configuration for a specific hook type from resolved hooks
 */
export function getHookConfig(
  hooks: HooksConfig | undefined,
  hookType: HookType,
): HookCommand | undefined {
  if (!hooks) {
    return undefined;
  }
  return hooks[hookType];
}
