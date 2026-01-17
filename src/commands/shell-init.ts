/**
 * wt shell-init - Output shell integration code
 */

export interface ShellInitOptions {
  prompt?: boolean;
}

const BASH_ZSH_WRAPPER = `
# wt shell integration
export WT_SHELL_INTEGRATION=1

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

            # Check for cd handoff (TUI selection)
            # Output format is __wt_cd__"/path/to/dir" (quoted to handle spaces)
            if [[ "$output" == __wt_cd__* ]]; then
                eval cd \${output#__wt_cd__}
            elif [[ -n "$output" ]]; then
                echo "$output"
            fi
            return $exit_code
            ;;
    esac
}
`.trim();

const BASH_ZSH_PROMPT = `
# wt prompt integration
__wt_info() {
    local dir="$PWD"
    # Walk up to find .git (handles subdirectories)
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/.git" ]]; then
            # It's a worktree - extract name from gitdir path
            sed -n 's|.*worktrees/\\([^/]*\\).*|\\1|p' "$dir/.git"
            return
        elif [[ -d "$dir/.git" ]]; then
            # It's the primary worktree - no name to show
            return
        fi
        dir=$(dirname "$dir")
    done
}

__wt_prompt() {
    local wt=$(__wt_info)
    [[ -n "$wt" ]] && echo "[wt:$wt] "
}
`.trim();

const FISH_WRAPPER = `
# wt shell integration for fish
set -gx WT_SHELL_INTEGRATION 1

function wt
    switch $argv[1]
        case cd
            set -l dir (command wt cd $argv[2])
            and cd $dir
        case '*'
            set -l output (command wt $argv)
            set -l exit_code $status

            # Check for cd handoff
            # Output format is __wt_cd__"/path/to/dir" (quoted to handle spaces)
            if string match -q '__wt_cd__*' -- $output
                set -l path (string replace '__wt_cd__' '' -- $output | string trim -c '"')
                cd $path
            else if test -n "$output"
                echo $output
            end
            return $exit_code
    end
end
`.trim();

const FISH_PROMPT = `
# wt prompt integration for fish
function __wt_info
    set -l dir $PWD
    while test "$dir" != "/"
        if test -f "$dir/.git"
            sed -n 's|.*worktrees/\\([^/]*\\).*|\\1|p' "$dir/.git"
            return
        else if test -d "$dir/.git"
            return
        end
        set dir (dirname "$dir")
    end
end

function __wt_prompt
    set -l wt (__wt_info)
    test -n "$wt"; and echo "[wt:$wt] "
end
`.trim();

export function shellInit(shell: string, options: ShellInitOptions = {}): void {
  let output = "";

  switch (shell) {
    case "bash":
    case "zsh":
      output = BASH_ZSH_WRAPPER;
      if (options.prompt) {
        output += `\n\n${BASH_ZSH_PROMPT}`;
      }
      break;

    case "fish":
      output = FISH_WRAPPER;
      if (options.prompt) {
        output += `\n\n${FISH_PROMPT}`;
      }
      break;

    default:
      console.error(`Unknown shell: ${shell}`);
      console.error("Supported shells: bash, zsh, fish");
      process.exit(1);
  }

  console.log(output);
}
