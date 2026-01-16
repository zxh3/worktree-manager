# Git Worktree Manager - Design Document

## Vision

Make git worktrees as effortless as branches. Just as `git checkout -b` made branching trivial, `wt` makes worktrees trivial—especially for parallel coding sessions.

**Quick example:**
```bash
# Instead of this:
git worktree add ../myrepo-feature-auth -b feature/auth
cd ../myrepo-feature-auth

# Just do this:
wt new auth
wt cd auth
```

## Problem Statement

### Current Pain Points

1. **Cognitive overhead**: Users must decide where to put each worktree (`../repo-feature`? `~/worktrees/repo/feature`?), leading to inconsistent, scattered directories.

2. **Poor discoverability**: `git worktree list` outputs raw paths with no context—no status, no indication of staleness, no way to know which worktree is for what task.

3. **Manual lifecycle management**: No easy way to identify and clean up worktrees whose branches are merged, abandoned, or stale.

4. **Context switching friction**: Navigating to the right worktree requires remembering paths and typing long commands.

### Target Users

- **Code reviewers**: Quickly checking out PRs without disrupting current work
- **Multi-taskers**: Developers juggling multiple features, hotfixes, or experiments
- **Parallel workers**: Running multiple tasks in separate worktrees simultaneously

## Design Principles

1. **Convention over configuration**: Sensible defaults that work without setup
2. **Progressive disclosure**: Simple commands for common tasks, power features discoverable
3. **Transparency**: Never hide what git is doing; users should be able to drop to raw git anytime
4. **Speed**: Sub-100ms startup, instant operations
5. **Single binary**: No runtime dependencies via `bun build --compile`, easy installation

## Architecture

### Path Strategy

```
~/.worktrees/
└── <repo-id>/
    ├── feature-auth/
    ├── fix-bug-123/
    └── experiment-new-api/
```

**Repo identification:**
- `<repo-id>` is derived from the git remote origin URL
- `git@github.com:user/repo.git` → `github.com-user-repo`
- `https://github.com/user/repo` → `github.com-user-repo`
- Fallback (no remote): directory name + short hash of absolute path
- This ensures uniqueness even with multiple repos named "api"

**Why centralized over sibling directories:**
- Predictable: Always know where worktrees live
- Clean: Doesn't clutter project parent directories
- Searchable: Easy to find all worktrees across all repos
- Configurable: Can override per-repo if needed

**Sibling strategy (alternative):**
When `strategy: "sibling"` is configured:
```
~/dev/
├── myrepo/                    # Primary (original clone)
├── myrepo--feature-auth/      # Worktree
├── myrepo--fix-bug-123/       # Worktree
└── other-project/
```
Pattern: `<primary-dir>--<worktree-name>` in the same parent directory.

**Primary worktree:**
- The original clone location (where `.git` is a directory, not a file)
- Always shown first in listings, marked as "primary"
- Cannot be removed via `wt rm` (use regular `rm -rf` if needed)

**External worktrees:**
- Worktrees created outside `wt` (via `git worktree add`) are discovered automatically
- They appear in `wt ls` with their directory name as the display name
- `wt` manages them normally (cd, remove, etc.)

**Naming convention:**
- Worktree name is user-provided (required for `wt new`)
- Branch name defaults to worktree name, optionally with configured prefix
- Example: `wt new auth` → worktree "auth", branch "feature/auth" (if prefix configured)

### Data Model

```
Worktree {
    // Core fields (from git, always available)
    name: string          // Directory name of worktree
    path: string          // Filesystem path
    branch: string        // Git branch name (or HEAD commit if detached)
    isPrimary: boolean    // True if this is the main repo clone

    // Derived fields (computed on demand)
    status?: Status       // dirty, merged, stale, etc.
    ahead?: number        // Commits ahead of base
    behind?: number       // Commits behind base

    // Optional metadata (from ~/.config/wt/metadata.json, Phase 4+)
    description?: string  // User note
    created_at?: timestamp // When created via wt
    last_accessed?: timestamp // Last wt interaction
}
```

**Storage strategy:**
- Primary source: `git worktree list --porcelain` (always authoritative)
- Metadata: Optional `~/.config/wt/metadata.json` for descriptions, timestamps (Phase 4)
- No separate database—if metadata is lost, worktrees still work
- Metadata is keyed by worktree path for reliability

### State Derivation

All status information is derived, not stored:

| Status | Derivation |
|--------|------------|
| `dirty` | `git status --porcelain` shows changes |
| `merged` | Branch exists in `git branch --merged main` |
| `behind` | `git rev-list --count HEAD..origin/main` > 0 |
| `stale` | Directory mtime older than N days (configurable via `staleDays`) |
| `orphan` | Branch deleted but worktree exists |

**Performance considerations:**
- Checking status for many worktrees can be slow (each needs `git status`)
- TUI uses lazy loading: show list immediately, load status indicators in background
- `wt ls` in CLI: fast mode by default, `--status` flag for full status check
- Cache status for 5 seconds to avoid repeated git calls during navigation

## User Interface

### TUI Design

```
┌─ wt: myrepo ─────────────────────────────────────────────────────┐
│                                                                   │
│  Worktrees                                                        │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  ● main              ~/dev/myrepo                    primary      │
│ ❯○ auth              ~/.worktrees/myrepo/auth        ✎ dirty     │
│  ○ fix-login         ~/.worktrees/myrepo/fix-login   ✓ merged    │
│  ○ experiment        ~/.worktrees/myrepo/experiment  ⚠ stale     │
│  ○ pr-456            ~/.worktrees/myrepo/pr-456                   │
│                                                                   │
│                                                                   │
│                                                                   │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  ↵ select  n new  d delete  r rename  p prune  / filter  ? help  │
└───────────────────────────────────────────────────────────────────┘
```

**Navigation:**
- `j/k` or `↑/↓`: Move selection
- `Enter`: Select worktree → exit TUI → cd to worktree
- `/`: Filter/search worktrees
- `?`: Help overlay

**Quick actions:**
- `n`: New worktree (opens create dialog)
- `d`: Delete selected (with confirmation)
- `r`: Rename worktree
- `p`: Prune merged/stale worktrees
- `i`: Show details view
- `q` or `Esc`: Quit

**TUI States:**

```
# Loading state
┌─ wt: myrepo ─────────────────────────────────────────────────────┐
│                                                                   │
│  ◐ Loading worktrees...                                           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

# Empty state (only primary exists)
┌─ wt: myrepo ─────────────────────────────────────────────────────┐
│                                                                   │
│  Worktrees                                                        │
│  ─────────────────────────────────────────────────────────────── │
│                                                                   │
│  ● main              ~/dev/myrepo                    primary      │
│                                                                   │
│  No additional worktrees. Press 'n' to create one.                │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  n new  ? help                                                    │
└───────────────────────────────────────────────────────────────────┘

# Error state
┌─ wt: myrepo ─────────────────────────────────────────────────────┐
│                                                                   │
│  ✗ Error: Not a git repository                                    │
│                                                                   │
│  Run this command from within a git repository.                   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Create dialog:**
```
┌─ New Worktree ───────────────────────────────────────┐
│                                                       │
│  Name: auth_____________________________              │
│                                                       │
│  Base from:                                           │
│    ● HEAD (main)                                      │
│    ○ main                                             │
│    ○ Other branch...                                  │
│    ○ Remote branch... (e.g., origin/pr/123)          │
│                                                       │
│  New branch name: feature/auth                        │
│                                                       │
│              [ Cancel ]  [ Create ]                   │
└───────────────────────────────────────────────────────┘
```

The dialog creates a new branch by default (matching `wt new <name>` behavior). Advanced options like `--no-branch` (detached HEAD) or `--track` are CLI-only for simplicity.

**Details view (via `i` on selected worktree):**
```
┌─ Worktree: auth ─────────────────────────────────────┐
│                                                       │
│  Path:    ~/.worktrees/myrepo/auth                   │
│  Branch:  feature/auth                                │
│  Base:    main (3 commits ahead)                      │
│  Status:  2 files modified                            │
│                                                       │
│  Actions:                                             │
│  ❯ Select (cd to worktree)                            │
│    Copy path                                          │
│    Rename worktree                                    │
│    Delete worktree                                    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### CLI Design

**Design philosophy:**

Commands answer natural questions or perform clear actions:

| Pattern | Example | Question/Action |
|---------|---------|-----------------|
| `wt <verb> <name>` | `wt new auth` | "Create a worktree called auth" |
| `wt <verb> <name>` | `wt rm auth` | "Remove the worktree called auth" |
| `wt <verb> <old> <new>` | `wt mv auth authentication` | "Rename auth to authentication" |
| `wt <verb>` | `wt ls` | "List all worktrees" |
| `wt <noun>` | `wt current` | "What's the current worktree?" |
| `wt <verb> <name>` | `wt cd auth` | "Go to the auth worktree" |

**Principles:**
- Commands don't leak implementation details (`wt current` not `wt prompt`)
- Verbs are familiar Unix conventions (`ls`, `rm`, `mv`, `cd`)
- Dangerous operations require confirmation or `--force`
- Output is human-friendly by default, `--json` for scripting

```bash
# Core CRUD
wt                          # Launch TUI (default action)
wt new <name> [options]     # Create worktree
wt rm <name> [options]      # Remove worktree
wt mv <old> <new>           # Rename worktree
wt ls [options]             # List all worktrees

# Context & Navigation
wt current [options]        # What worktree am I in?
wt cd <name>                # Print path (for shell integration)

# Maintenance
wt prune [options]          # Clean up stale/merged worktrees
wt status [name]            # Show detailed status

# Setup
wt init                     # Create .wtrc.json in current repo with defaults
wt config [key] [value]     # View/set global configuration
wt shell-init [shell]       # Output shell integration code
```

**Command details:**

```bash
# Create with options
wt new auth                      # Create "auth" with new branch
wt new auth --base develop       # Branch from develop
wt new auth --branch my-branch   # Custom branch name
wt new auth --no-branch          # Detached HEAD
wt new auth --track origin/pr/123  # Track remote branch

# Remove with options
wt rm auth                       # Remove (fails if dirty)
wt rm auth --force               # Remove even if dirty
wt rm auth --delete-branch       # Also delete the branch

# Rename
wt mv auth authentication        # Rename worktree (moves directory)

# List with formats
wt ls                            # Human-readable list (fast, no status)
wt ls --status                   # Include status indicators (slower)
wt ls --json                     # JSON output for scripting
wt ls --porcelain                # Machine-readable, stable format
wt ls --filter=merged            # Only show merged worktrees

# Prune options
wt prune                         # Interactive: select which to remove
wt prune --merged                # Remove all merged (with confirmation)
wt prune --stale-days=30         # Remove untouched for 30+ days
wt prune --dry-run               # Show what would be removed
wt prune --yes                   # Skip confirmation
```

### Shell Integration

The `cd` problem: Child processes can't change parent shell directory.

**Solution: Shell function wrapper**

```bash
# In ~/.bashrc or ~/.zshrc
eval "$(wt shell-init bash)"  # or zsh/fish

# This installs:
wt() {
    case "$1" in
        cd)
            local dir
            dir=$(command wt cd "$2") && cd "$dir"
            ;;
        *)
            # Run wt and capture output
            local output
            output=$(command wt "$@")
            local exit_code=$?

            # Check for cd handoff (TUI selection or other commands that want to cd)
            if [[ "$output" == __wt_cd__* ]]; then
                cd "${output#__wt_cd__}"
            elif [[ -n "$output" ]]; then
                echo "$output"
            fi
            return $exit_code
            ;;
    esac
}
```

Now `wt cd auth` changes directory, and selecting a worktree in the TUI (Enter key) exits and changes to that directory.

**How TUI → cd works:**
1. User runs `wt` (launches TUI via shell wrapper)
2. User selects worktree with Enter
3. TUI exits and prints `__wt_cd__/path/to/worktree`
4. Shell wrapper intercepts this and runs `cd /path/to/worktree`

### Prompt Integration

Show the current worktree in the shell prompt, similar to how git branch or kubectl context is shown.

**Display format:**
```
# When in a worktree:
~/code/myrepo [wt:auth] $

# When in primary worktree (optional, configurable):
~/code/myrepo [wt:main] $

# With dirty indicator (optional):
~/code/myrepo [wt:auth*] $
```

**Primary approach: Pure shell function (fastest)**

No process spawn, ~1-2ms - find .git and read it:

```bash
# Worktrees have a .git FILE (not directory) containing:
# "gitdir: /path/to/main/.git/worktrees/<name>"
__wt_info() {
    local dir="$PWD"
    # Walk up to find .git (handles subdirectories)
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/.git" ]]; then
            # It's a worktree - extract name from gitdir path
            sed -n 's|.*worktrees/\([^/]*\).*|\1|p' "$dir/.git"
            return
        elif [[ -d "$dir/.git" ]]; then
            # It's the primary worktree - no name to show (or show "main")
            return
        fi
        dir=$(dirname "$dir")
    done
}

__wt_prompt() {
    local wt=$(__wt_info)
    [[ -n "$wt" ]] && echo "[wt:$wt] "
}

# Add to PS1:
PS1='$(__wt_prompt)\w $ '
```

**Integration with `wt shell-init`:**
```bash
eval "$(wt shell-init bash --prompt)"
# Installs __wt_info and __wt_prompt functions
# User still needs to add $(__wt_prompt) to their PS1
```

**Integration with popular frameworks:**

```bash
# Oh-My-Zsh: Copy function to custom plugin
# ~/.oh-my-zsh/custom/plugins/wt/wt.plugin.zsh
# Then add wt to plugins=(...) in .zshrc

# Powerlevel10k: Custom segment in ~/.p10k.zsh
function prompt_wt() {
    local wt=$(__wt_info)
    [[ -n "$wt" ]] && p10k segment -f blue -t "wt:$wt"
}

# Starship: Uses command, so needs `wt current` (see below)
```

**Fallback: `wt current` command**

For tools like Starship that require an external command, or for scripting:

```bash
wt current           # Print worktree name (exit 1 if not in worktree)
wt current --path    # Print worktree path instead of name
wt current --branch  # Print branch name instead
```

Note: Spawns a process (~25ms with Bun), noticeable with rapid navigation.
Use shell functions for prompts when possible.

```toml
# ~/.config/starship.toml
[custom.worktree]
command = "wt current 2>/dev/null"
when = "test -e .git"  # -e not -f: .git is a file in worktrees, directory in primary
format = "[wt:$output]($style) "
style = "blue bold"
```

**Scripting examples:**
```bash
# Conditional logic based on worktree
if wt current &>/dev/null; then
    echo "In worktree: $(wt current)"
fi

# Get path for current worktree
cd "$(wt current --path)"
```

## Configuration

### Config file: `~/.config/wt/config.json`

```json
{
  "paths": {
    "strategy": "centralized",
    "base": "~/.worktrees"
  },
  "defaults": {
    "branchPrefix": "",
    "staleDays": 30
  },
  "repos": {
    "github.com-user-special-repo": {
      "branchPrefix": "user/",
      "base": "~/special-worktrees"
    }
  }
}
```

**Config schema (validated with Zod):**
```typescript
const ConfigSchema = z.object({
  paths: z.object({
    strategy: z.enum(["centralized", "sibling"]).default("centralized"),
    base: z.string().default("~/.worktrees"),
  }),
  defaults: z.object({
    branchPrefix: z.string().default(""),
    staleDays: z.number().default(30),
  }),
  repos: z.record(z.object({
    branchPrefix: z.string().optional(),
    base: z.string().optional(),
  })).optional(),
});
```

### Repo-local config: `.wtrc.json` (optional)

```json
{
  "defaults": {
    "branchPrefix": "feature/"
  }
}
```

**Templates (Phase 4+):**

```json
{
  "templates": {
    "default": {
      "postCreate": [
        "bun install",
        "cp .env.example .env"
      ]
    }
  }
}
```

Templates define hooks that run after worktree creation. This is a Phase 4 feature.

## Technical Implementation

### Tech Stack

**Runtime: Bun**

Rationale:
- Fast startup (~25ms) - critical for CLI tools
- Built-in TypeScript support (no transpilation step)
- Single binary compilation via `bun build --compile`
- Native file I/O and shell execution APIs
- Growing ecosystem, modern DX

**UI Framework: Ink (React for CLI)**

Rationale:
- Component-based architecture with declarative UI patterns
- React's component model fits TUI well (state → render)
- Rich ecosystem of components (ink-text-input, ink-select-input, etc.)
- Easy to reason about UI updates
- Great developer experience with hot reloading

**Key dependencies:**
```json
{
  "dependencies": {
    "ink": "^6.6.0",              // React for CLI
    "ink-text-input": "^6.0.0",   // Text input component
    "ink-select-input": "^6.2.0", // Select/list component
    "ink-spinner": "^5.0.0",      // Loading spinners
    "react": "^19.2.3",           // React runtime
    "pastel": "^4.0.0",           // CLI framework (commands, args)
    "zod": "^4.3.5",              // Schema validation (config)
    "chalk": "^5.6.2"             // Terminal styling (non-TUI output)
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^19.2.8",
    "typescript": "^5.9.3",
    "ink-testing-library": "^4.0.0"
  }
}
```

**Git interaction:**
- Shell out to `git` binary via `Bun.spawn()`
- Rationale: Guarantees compatibility with user's git version/config
- Parsing: Use `--porcelain` flags for stable output format

### Project Structure

```
wt/
├── src/
│   ├── cli.tsx               # Entry point, command routing
│   ├── commands/             # CLI command handlers
│   │   ├── index.ts          # Command registry
│   │   ├── new.tsx           # wt new
│   │   ├── rm.tsx            # wt rm
│   │   ├── mv.ts             # wt mv
│   │   ├── ls.tsx            # wt ls
│   │   ├── cd.ts             # wt cd (prints path)
│   │   ├── current.ts        # wt current
│   │   ├── prune.tsx         # wt prune
│   │   ├── status.ts         # wt status
│   │   ├── init.ts           # wt init
│   │   ├── config.ts         # wt config
│   │   └── shell-init.ts     # wt shell-init
│   ├── tui/                  # TUI components
│   │   ├── App.tsx           # Main TUI application
│   │   ├── WorktreeList.tsx  # List view component
│   │   ├── CreateDialog.tsx  # Create worktree modal
│   │   ├── DeleteConfirm.tsx # Delete confirmation
│   │   ├── DetailsView.tsx   # Worktree details panel
│   │   ├── StatusBar.tsx     # Bottom status/help bar
│   │   └── hooks/            # Custom React hooks
│   │       ├── useWorktrees.ts
│   │       ├── useGitStatus.ts
│   │       └── useKeyboard.ts
│   ├── lib/                  # Core logic (non-UI)
│   │   ├── git/              # Git operations
│   │   │   ├── worktree.ts   # Worktree CRUD
│   │   │   ├── branch.ts     # Branch operations
│   │   │   ├── status.ts     # Status queries
│   │   │   └── repo.ts       # Repository detection
│   │   ├── config.ts         # Configuration loading
│   │   ├── paths.ts          # Path resolution
│   │   └── types.ts          # Shared TypeScript types
│   └── utils/                # Utilities
│       ├── exec.ts           # Shell execution helpers
│       ├── format.ts         # Output formatting
│       └── errors.ts         # Error handling
├── tests/                    # Integration tests
│   ├── commands.test.ts
│   └── shell-integration.test.ts
├── scripts/
│   └── build.ts              # Build script
├── package.json
├── tsconfig.json
├── bunfig.toml               # Bun configuration
└── README.md
```

### Build & Distribution

**Development:**
```bash
bun install
bun run src/cli.tsx           # Run directly
bun --watch run src/cli.tsx   # With hot reload
```

**Production build:**
```bash
# Compile to single binary
bun build ./src/cli.tsx --compile --outfile wt

# Cross-compile (when supported)
bun build ./src/cli.tsx --compile --target=bun-linux-x64 --outfile wt-linux
bun build ./src/cli.tsx --compile --target=bun-darwin-arm64 --outfile wt-macos
```

**Distribution options:**
- Direct binary download from GitHub releases
- npm/bun package: `bun add -g @user/wt`
- Homebrew tap (wraps binary or uses bun)

### Git Operations Mapping

| wt command | git command(s) |
|------------|---------------|
| `wt new foo` | `git worktree add <path> -b <branch>` |
| `wt new foo --base dev` | `git worktree add <path> -b <branch> dev` |
| `wt new foo --track origin/x` | `git worktree add <path> --track origin/x` |
| `wt rm foo` | `git worktree remove <path>` |
| `wt rm foo --force` | `git worktree remove --force <path>` |
| `wt mv foo bar` | `git worktree move <old-path> <new-path>` |
| `wt ls` | `git worktree list --porcelain` |
| `wt current` | Parse `.git` file in current directory |
| `wt prune` | `git worktree prune` + selective `git worktree remove` |

### Error Handling

User-friendly messages for common errors:

| Git error | wt message |
|-----------|------------|
| `fatal: '<branch>' is already checked out at '<path>'` | `Branch 'feature/auth' is already checked out in worktree 'auth'. Use a different branch or remove that worktree first.` |
| `fatal: '<path>' already exists` | `A worktree named 'auth' already exists. Choose a different name or remove it with 'wt rm auth'.` |
| `error: cannot remove worktree while dirty` | `Worktree 'auth' has uncommitted changes. Commit, stash, or use --force to discard them.` |

### Testing Strategy

**Test runner: Bun's built-in test runner**

Bun includes a fast, Jest-compatible test runner. No additional dependencies needed.

```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test --coverage         # With coverage report
```

**Unit tests (`src/**/*.test.ts`):**

Test pure logic in isolation:

```typescript
// src/lib/paths.test.ts
import { describe, expect, test } from "bun:test";
import { deriveRepoId, resolveWorktreePath } from "./paths";

describe("deriveRepoId", () => {
  test("extracts repo id from SSH remote", () => {
    expect(deriveRepoId("git@github.com:user/repo.git"))
      .toBe("github.com-user-repo");
  });

  test("extracts repo id from HTTPS remote", () => {
    expect(deriveRepoId("https://github.com/user/repo"))
      .toBe("github.com-user-repo");
  });

  test("falls back to directory name when no remote", () => {
    expect(deriveRepoId(null, "/Users/dev/myproject"))
      .toMatch(/^myproject-[a-f0-9]+$/);
  });
});
```

Key areas for unit tests:
- `lib/paths.ts` - repo ID derivation, path resolution
- `lib/config.ts` - config loading, merging, validation
- `lib/git/*.ts` - output parsing (not git execution)
- `utils/format.ts` - output formatting helpers

**Integration tests (`tests/*.test.ts`):**

Test CLI commands against real git repos in isolated temp directories:

```typescript
// tests/commands.test.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { $ } from "bun";

describe("wt new", () => {
  let tmpDir: string;
  let repoDir: string;

  beforeEach(async () => {
    // Create isolated test environment
    tmpDir = await mkdtemp("/tmp/wt-test-");
    repoDir = join(tmpDir, "repo");

    // Initialize a real git repo
    await $`git init ${repoDir}`;
    await $`git -C ${repoDir} commit --allow-empty -m "init"`;
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  test("creates worktree with new branch", async () => {
    const result = await $`wt new feature -C ${repoDir}`.text();

    expect(result).toContain("Created worktree 'feature'");

    // Verify git state
    const worktrees = await $`git -C ${repoDir} worktree list`.text();
    expect(worktrees).toContain("feature");
  });

  test("fails when worktree already exists", async () => {
    await $`wt new feature -C ${repoDir}`;

    const result = await $`wt new feature -C ${repoDir}`.nothrow();
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("already exists");
  });
});
```

Integration test coverage:
- All CLI commands (`new`, `rm`, `mv`, `ls`, `cd`, `current`, `prune`)
- Edge cases (dirty worktree, branch conflicts, missing repos)
- Config file loading from different locations
- Shell integration output

**TUI tests (`src/tui/**/*.test.tsx`):**

Test React components with `ink-testing-library`:

```typescript
// src/tui/WorktreeList.test.tsx
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { WorktreeList } from "./WorktreeList";

describe("WorktreeList", () => {
  const mockWorktrees = [
    { name: "main", path: "/repo", branch: "main", isPrimary: true },
    { name: "feature", path: "/wt/feature", branch: "feature/auth", isPrimary: false },
  ];

  test("renders worktree names", () => {
    const { lastFrame } = render(<WorktreeList worktrees={mockWorktrees} />);

    expect(lastFrame()).toContain("main");
    expect(lastFrame()).toContain("feature");
  });

  test("marks primary worktree", () => {
    const { lastFrame } = render(<WorktreeList worktrees={mockWorktrees} />);

    expect(lastFrame()).toContain("primary");
  });

  test("handles keyboard navigation", () => {
    const { lastFrame, stdin } = render(<WorktreeList worktrees={mockWorktrees} />);

    stdin.write("j"); // Move down
    expect(lastFrame()).toContain("❯"); // Selection indicator on second item
  });
});
```

**Test organization:**

Unit tests are colocated with source files (`*.test.ts`), integration tests live in `tests/`:

```
wt/
├── src/
│   ├── lib/
│   │   ├── paths.ts
│   │   ├── paths.test.ts        # Unit test
│   │   ├── config.ts
│   │   └── config.test.ts       # Unit test
│   └── tui/
│       ├── WorktreeList.tsx
│       └── WorktreeList.test.tsx # TUI component test
├── tests/                        # Integration tests
│   ├── commands.test.ts         # CLI command tests
│   └── shell-integration.test.ts
└── package.json
```

**CI pipeline (GitHub Actions):**

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test
      - run: bun test --coverage
```

**Testing principles:**
- Unit tests for pure logic, integration tests for git interactions
- Each integration test gets a fresh temp directory with real git repo
- No mocking git - test against real git behavior
- TUI tests focus on rendering and keyboard handling
- CI runs on all target platforms (Linux, macOS, Windows)

## Development Phases

### Phase 1: MVP (Core CLI)

- [x] Project setup (Bun, TypeScript, package.json)
- [x] Git worktree detection and parsing
- [x] `wt new <name>` - create worktree
- [x] `wt rm <name>` - remove worktree
- [x] `wt mv <old> <new>` - rename worktree
- [x] `wt ls` - list worktrees
- [x] `wt cd <name>` - output path
- [x] `wt current` - print current worktree
- [x] Basic configuration (~/.config/wt/config.json)
- [x] Shell integration (`wt shell-init`)
- [x] Prompt integration (`--prompt` flag for shell-init)
- [x] Unit tests for lib modules (paths, config, git parsing)
- [x] Integration tests for all CLI commands
- [ ] GitHub Actions CI (Linux, macOS, Windows)

### Phase 2: TUI

- [ ] Basic TUI with list view
- [ ] Navigation (j/k, arrow keys)
- [ ] Create worktree dialog
- [ ] Delete with confirmation
- [ ] Rename dialog
- [ ] Status indicators (dirty, merged, stale)
- [ ] Quick action keys (n, d, r, p, i, q)
- [ ] Enter key → exit TUI + cd to selected worktree
- [ ] Details view (`i` key)
- [ ] TUI component tests with ink-testing-library

### Phase 3: Maintenance Features

- [ ] `wt prune` - interactive cleanup
- [ ] Merge detection (`--merged` flag)
- [ ] Stale detection (using directory mtime as proxy)
- [ ] Batch operations in TUI
- [ ] `--dry-run` support

### Phase 4: Polish & Advanced

- [ ] Metadata storage (descriptions, last_accessed timestamps)
- [ ] `wt status` - detailed view with full metadata
- [ ] Filter/search in TUI
- [ ] Custom aliases
- [ ] Hooks (post-create commands)
- [ ] Completions (bash, zsh, fish)

### Phase 5: Distribution

- [ ] npm/bun package (`bun add -g wt` / `npm install -g wt`)
- [ ] GitHub releases with compiled binaries
- [ ] Homebrew formula
- [ ] Scoop for Windows
- [ ] Documentation site

## Open Questions

1. **Should `wt` work outside a git repo?**
   - Could operate on a "default" repo from config
   - Could show all worktrees across all repos
   - MVP: Require being in a git repo

2. **How to handle nested worktrees?**
   - Git supports worktrees of worktrees (rarely used)
   - MVP: Ignore, treat repo's worktrees as flat list

3. **Integration with GitHub/GitLab CLI?**
   - `wt pr 123` could create worktree from PR
   - Requires additional dependencies
   - Future phase, not MVP

4. **Windows support priority?**
   - Path handling differs significantly (use `path` module consistently)
   - Bun has good Windows support, Ink works cross-platform
   - Shell integration differs (PowerShell vs bash/zsh)
   - Test on Windows in Phase 1, full support by Phase 5

## Success Metrics

- **Adoption**: GitHub stars, Homebrew installs
- **Usability**: Time to create first worktree < 10 seconds
- **Performance**: TUI startup < 100ms, all operations < 500ms
- **Reliability**: Zero data loss (worktrees should always be recoverable via git)

## Appendix: Competitive Analysis

| Tool | Pros | Cons |
|------|------|------|
| Raw `git worktree` | Universal, no deps | Poor UX, manual path management |
| `git-worktree` (npm) | Simple wrapper | Node dependency, limited features |
| Magit (Emacs) | Powerful git UI | Emacs-only |
| lazygit | Great TUI | Worktree support is secondary |

**Our differentiation**: Purpose-built for worktrees with a focus on simplicity and speed. Modern TUI built with Ink + React for a polished, responsive experience.
