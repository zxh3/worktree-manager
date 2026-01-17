# wt - Git Worktree Manager

A fast, interactive TUI for managing git worktrees. Makes worktrees as effortless as branches.

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
| `q` | Quit |

## Status Indicators

The TUI shows status for each worktree:

| Status | Meaning |
|--------|---------|
| `dirty` | Uncommitted changes |
| `ahead` | Commits to push |
| `behind` | Commits to pull |
| `diverged` | Both ahead and behind |
| `synced` | Clean and up-to-date |
| `merged` | Branch merged, can be cleaned up |
| `stale` | No commits in 30+ days |

Sync indicators show commit counts: `+3` (ahead) `-2` (behind)

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

## License

MIT
