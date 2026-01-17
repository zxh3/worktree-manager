# wt - Git Worktree Manager

A fast, simple CLI for managing git worktrees.

## Install

```bash
# npm
npm install -g @kianax/wt

# Or build from source (requires Bun)
bun install && bun run build
cp wt /usr/local/bin/
```

## Setup

Add shell integration to your `.bashrc` or `.zshrc`:

```bash
eval "$(wt shell-init bash)"   # or zsh
```

For fish, add to `~/.config/fish/config.fish`:

```fish
wt shell-init fish | source
```

## Usage

```bash
wt              # Open interactive TUI
wt new feature  # Create new worktree
wt cd feature   # Switch to worktree
wt rm feature   # Remove worktree
wt list         # List all worktrees
wt current      # Show current worktree name
```

### TUI Keybindings

| Key | Action |
|-----|--------|
| `j/k` or arrows | Navigate |
| `Enter` | Switch to worktree |
| `n` | New worktree |
| `d` | Delete worktree |
| `r` | Rename worktree |
| `q` | Quit |

## How It Works

Worktrees are stored in `~/.worktrees/<repo-id>/` by default. Each worktree gets its own directory with a branch of the same name.

```
~/.worktrees/
  github.com-user-repo/
    feature-auth/
    bugfix-login/
```

## Configuration

Create `~/.config/wt/config.json` for global settings:

```json
{
  "defaults": {
    "branchPrefix": "feature/"
  }
}
```

Or `.wtrc.json` in your repo for per-project settings.

## License

MIT
