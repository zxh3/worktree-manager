#!/usr/bin/env bun
/**
 * wt - Git worktree manager
 *
 * Make git worktrees as effortless as branches.
 */

import { cd, current, ls, mv, newWorktree, rm, shellInit } from "./commands";
import { VERSION } from "./lib/version";

const HELP = `
wt - Git worktree manager

Usage: wt <command> [options]

Commands:
  wt                       Launch TUI (coming soon)
  wt ls [options]          List all worktrees
  wt new <name> [options]  Create a new worktree
  wt rm <name> [options]   Remove a worktree
  wt mv <old> <new>        Rename a worktree
  wt cd <name>             Print worktree path (for shell integration)
  wt current [options]     Show current worktree info

Setup:
  wt shell-init <shell>    Output shell integration code (bash, zsh, fish)

Options:
  -h, --help               Show this help message
  -v, --version            Show version number

Examples:
  wt new auth              Create worktree 'auth' with new branch
  wt new auth --base dev   Branch from 'dev' instead of current
  wt cd auth               Change to the 'auth' worktree
  wt rm auth               Remove the 'auth' worktree
  wt ls --json             List worktrees as JSON

Shell integration:
  Add to your shell config:
    eval "$(wt shell-init bash)"   # bash
    eval "$(wt shell-init zsh)"    # zsh
    wt shell-init fish | source    # fish
`.trim();

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  options: Record<string, string | boolean>;
} {
  let command = "";
  const positional: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip if we haven't found a command yet and this is a flag
    if (!command && arg.startsWith("-")) {
      // Handle global flags before command
      if (arg === "-h" || arg === "--help") {
        options.help = true;
        continue;
      }
      if (arg === "-v" || arg === "--version") {
        options.version = true;
        continue;
      }
    }

    // First non-flag argument is the command
    if (!command && !arg.startsWith("-")) {
      command = arg;
      continue;
    }

    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (value !== undefined) {
        options[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith("-")) {
        // Check if next arg could be a value
        const nextArg = args[i + 1];
        // Heuristic: if it looks like a flag value, use it
        if (["base", "branch", "track", "filter"].includes(key)) {
          options[key] = nextArg;
          i++;
        } else {
          options[key] = true;
        }
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flags
      const flag = arg[1];
      switch (flag) {
        case "h":
          options.help = true;
          break;
        case "v":
          options.version = true;
          break;
        case "f":
          options.force = true;
          break;
        default:
          options[flag] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, options };
}

async function main() {
  const { command, positional, options } = parseArgs(process.argv.slice(2));

  // Handle global flags
  if (options.help || command === "help") {
    console.log(HELP);
    return;
  }

  if (options.version || command === "version") {
    console.log(`wt version ${VERSION}`);
    return;
  }

  // Route to command
  switch (command) {
    case "": {
      // No command - launch TUI
      const { launchTui } = await import("./tui");
      await launchTui();
      break;
    }

    case "ls":
    case "list":
      await ls({
        json: Boolean(options.json),
        porcelain: Boolean(options.porcelain),
        status: Boolean(options.status),
      });
      break;

    case "new":
    case "add":
    case "create":
      if (!positional[0]) {
        console.error("error: missing worktree name");
        console.error("usage: wt new <name> [options]");
        process.exit(1);
      }
      await newWorktree(positional[0], {
        base: options.base as string | undefined,
        branch: options.branch as string | undefined,
        track: options.track as string | undefined,
        detach: Boolean(options.detach || options["no-branch"]),
      });
      break;

    case "rm":
    case "remove":
    case "delete":
      if (!positional[0]) {
        console.error("error: missing worktree name");
        console.error("usage: wt rm <name> [options]");
        process.exit(1);
      }
      await rm(positional[0], {
        force: Boolean(options.force),
        deleteBranch: Boolean(options["delete-branch"]),
      });
      break;

    case "mv":
    case "move":
    case "rename":
      if (!positional[0] || !positional[1]) {
        console.error("error: missing arguments");
        console.error("usage: wt mv <old-name> <new-name>");
        process.exit(1);
      }
      await mv(positional[0], positional[1]);
      break;

    case "cd":
      if (!positional[0]) {
        console.error("error: missing worktree name");
        console.error("usage: wt cd <name>");
        process.exit(1);
      }
      await cd(positional[0]);
      break;

    case "current":
      await current({
        path: Boolean(options.path),
        branch: Boolean(options.branch),
      });
      break;

    case "shell-init":
      if (!positional[0]) {
        console.error("error: missing shell name");
        console.error("usage: wt shell-init <bash|zsh|fish>");
        process.exit(1);
      }
      shellInit(positional[0], {
        prompt: Boolean(options.prompt),
      });
      break;

    default:
      console.error(`error: unknown command '${command}'`);
      console.error("Run 'wt --help' for usage information");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
