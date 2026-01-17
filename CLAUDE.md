# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun run dev           # Run directly with Bun (development)
bun run build         # Compile to standalone binary (./wt)
bun run build:node    # Build for npm distribution (dist/cli.js)
```

## Test Commands

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun test <file>       # Run specific test file
```

## Lint/Format Commands

```bash
bun run lint          # Check with Biome
bun run lint:fix      # Auto-fix issues
bun run format        # Format code
bun run typecheck     # TypeScript check
```

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `<type>: <description>`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

## Architecture

**wt** is a TUI for managing git worktrees. It has three layers:

1. **CLI Layer** (`src/cli.ts`, `src/commands/`) - Argument parsing and command routing
2. **Core Logic** (`src/lib/`) - Git operations, config, path resolution
3. **TUI Layer** (`src/tui/`) - React components via Ink library

### Key Directories

- `src/commands/` - CLI command implementations (new, rm, mv, ls, cd, current, shell-init)
- `src/lib/git/` - Git operations: `repo.ts` (detection), `worktree.ts` (CRUD), `status.ts` (dirty/merged/stale)
- `src/tui/components/` - Ink/React TUI components
- `tests/` - Integration tests that create real git repos in temp directories

### Data Flow

User input → Command handler → Git operations (`lib/git/*`) → Output (CLI) or render (TUI)

### Key Patterns

- **Git interaction**: Shell out to `git` via `Bun.spawn()`, parse `--porcelain` output
- **TUI renders to stderr**: stdout is reserved for shell integration (`__wt_cd__<path>` marker)
- **Worktree storage**: `~/.worktrees/<repo-id>/<name>/` where repo-id is derived from remote URL
- **Config**: Global at `~/.config/wt/config.json`, per-repo at `.wtrc.json` (Zod validated)

### Testing

- Integration tests create isolated git repos in temp directories
- TUI tests use `ink-testing-library`
- Tests colocated: `src/**/__tests__/` and `tests/commands.test.ts`
