# wt - Git Worktree Manager

A fast, interactive TUI for managing git worktrees. Makes worktrees as effortless as branches.

<img width="968" height="186" alt="image" src="https://github.com/user-attachments/assets/cdfbd1e0-ad2e-4488-8a42-7ab847db0458" />


## Install

```bash
npm install -g @kianax/wt
```

Or build from source (requires [Bun](https://bun.sh)):

```bash
bun install && bun run build
cp wt /usr/local/bin/
```

## Shell Integration

Shell integration enables `wt` to change your working directory when selecting a worktree. Without it, selections just print the path.

**Bash/Zsh** - add to `~/.bashrc` or `~/.zshrc`:

```bash
eval "$(wt shell-init bash)"   # or zsh
```

**Fish** - add to `~/.config/fish/config.fish`:

```fish
wt shell-init fish | source
```

The TUI will prompt you to set this up on first run.

## Usage

```bash
wt                    # Open interactive TUI
wt new <name>         # Create new worktree
wt cd <name>          # Switch to worktree (requires shell integration)
wt rm <name>          # Remove worktree
wt mv <old> <new>     # Rename worktree
wt ls                 # List all worktrees
wt current            # Show current worktree name
```

### Command Options

```bash
# Create with options
wt new feature --base main        # Branch from specific base
wt new feature --branch feat/foo  # Custom branch name
wt new feature --detach           # Detached HEAD (no branch)

# Remove with options
wt rm feature --force             # Force remove even if dirty
wt rm feature --delete-branch     # Also delete the branch

# List with options
wt ls --json                      # JSON output
wt ls --porcelain                 # Machine-readable format

# Current worktree info
wt current --path                 # Full path
wt current --branch               # Branch name
```

## TUI Keybindings

| Key | Action |
|-----|--------|
| `j/k` or `↑/↓` | Navigate |
| `Enter` | Select worktree |
| `n` | New worktree |
| `d` | Delete worktree |
| `r` | Rename worktree |
| `i` | Show details |
| `s` | Settings |
| `q` | Quit |

## Status Indicators

The TUI shows status for each worktree:

| Status | Meaning |
|--------|---------|
| `dirty` | Uncommitted changes |
| `ahead` | Commits ahead of comparison branch |
| `behind` | Commits behind comparison branch |
| `diverged` | Both ahead and behind |
| `synced` | Up-to-date with comparison branch |
| `merged` | Branch merged into comparison branch |
| `stale` | No commits in 30+ days |

Sync status compares against `origin/main` by default (using local refs—no fetch). Falls back to `origin/master`, then local `main`/`master` if remote doesn't exist.

Press `i` on a worktree to see which branch it's comparing against (e.g., `↑3 ahead (vs origin/main)`).

To customize the comparison branch, press `s` to open Settings or edit `~/.config/wt/config.json`:

```json
{
  "defaults": {
    "comparisonBranch": "origin/develop"
  }
}
```

## How It Works

Worktrees are stored in `~/.worktrees/<repo-id>/` by default:

```
~/.worktrees/
  github.com-user-repo/
    feature-auth/
    bugfix-login/
```

The repo ID is derived from your git remote URL (e.g., `github.com-user-repo`).

## Configuration

All configuration is in `~/.config/wt/config.json`:

```json
{
  "defaults": {
    "branchPrefix": "feature/",
    "staleDays": 30
  },
  "repos": {
    "github.com-user-repo": {
      "branchPrefix": "feat/"
    }
  }
}
```

Use `repos` to override settings for specific repositories (keyed by repo ID).

## Hooks

Run shell commands automatically on worktree lifecycle events.

### Available Hooks

| Hook | Trigger |
|------|---------|
| `post-create` | After creating a worktree |
| `post-select` | After switching to a worktree |
| `post-delete` | After deleting a worktree |
| `post-rename` | After renaming a worktree |

### Configuration

Add hooks to `~/.config/wt/config.json` or use the TUI Settings (`s` key):

```json
{
  "hooks": {
    "post-create": "npm install",
    "post-select": "code ."
  }
}
```

### Hook Formats

```json
{
  "hooks": {
    "post-create": "npm install",
    "post-select": ["code .", "echo 'Ready!'"],
    "post-delete": {
      "commands": ["echo 'Cleaned up'"],
      "timeout": 60,
      "continueOnError": true
    }
  }
}
```

### Environment Variables

Hooks receive context via environment variables:

| Variable | Description |
|----------|-------------|
| `WT_NAME` | Worktree directory name |
| `WT_PATH` | Absolute path to worktree |
| `WT_BRANCH` | Git branch name |
| `WT_REPO_ID` | Repository identifier |
| `WT_HOOK` | Hook type being executed |
| `WT_OLD_NAME` | Previous name (post-rename only) |
| `WT_OLD_PATH` | Previous path (post-rename only) |

### Per-Repository Hooks

Override hooks for specific repositories:

```json
{
  "hooks": {
    "post-create": "npm install"
  },
  "repos": {
    "github.com-user-python-project": {
      "hooks": {
        "post-create": "pip install -e ."
      }
    }
  }
}
```

## License

MIT
