/**
 * Interactive shell integration setup flow
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
import { setSkipShellIntegrationPrompt } from "../../lib/preferences";
import { fileExists, readFileText, writeFileText } from "../../utils/compat";
import { theme } from "../theme";

interface SetupFlowProps {
  onComplete: () => void;
  onQuit: () => void;
}

type SetupState = "prompt" | "success" | "error" | "already-setup";

interface ShellInfo {
  name: string;
  configPath: string;
  command: string;
}

function detectShell(): ShellInfo {
  const shell = process.env.SHELL || "/bin/zsh";
  const home = homedir();

  if (shell.includes("fish")) {
    return {
      name: "fish",
      configPath: join(home, ".config", "fish", "config.fish"),
      command: "wt shell-init fish | source",
    };
  } else if (shell.includes("bash")) {
    return {
      name: "bash",
      configPath: join(home, ".bashrc"),
      command: 'eval "$(wt shell-init bash)"',
    };
  } else {
    // Default to zsh
    return {
      name: "zsh",
      configPath: join(home, ".zshrc"),
      command: 'eval "$(wt shell-init zsh)"',
    };
  }
}

async function checkAlreadySetup(configPath: string): Promise<boolean> {
  try {
    if (!(await fileExists(configPath))) {
      return false;
    }
    const content = await readFileText(configPath);
    return content.includes("wt shell-init");
  } catch {
    return false;
  }
}

async function appendToConfig(
  configPath: string,
  command: string,
): Promise<void> {
  let content = "";

  if (await fileExists(configPath)) {
    content = await readFileText(configPath);
  }

  // Add newline if file doesn't end with one
  if (content && !content.endsWith("\n")) {
    content += "\n";
  }

  // Add the shell integration
  content += `\n# wt (git worktree manager) shell integration\n${command}\n`;

  await writeFileText(configPath, content);
}

export function SetupFlow({ onComplete, onQuit }: SetupFlowProps) {
  const { exit } = useApp();
  const [state, setState] = useState<SetupState>("prompt");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const shellInfo = detectShell();

  useInput(async (input, key) => {
    if (isProcessing) return;

    if (state === "success" || state === "already-setup") {
      // Any key continues to TUI
      onComplete();
      return;
    }

    if (state === "error") {
      // Any key continues to TUI
      onComplete();
      return;
    }

    // Handle prompt state
    if (input === "y" || input === "Y") {
      setIsProcessing(true);

      try {
        // Check if already set up
        if (await checkAlreadySetup(shellInfo.configPath)) {
          setState("already-setup");
          setIsProcessing(false);
          return;
        }

        await appendToConfig(shellInfo.configPath, shellInfo.command);
        setState("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      }

      setIsProcessing(false);
      return;
    }

    if (input === "s" || input === "S") {
      // Skip for now, continue to TUI
      onComplete();
      return;
    }

    if (input === "n" || input === "N") {
      // Don't ask again
      await setSkipShellIntegrationPrompt(true);
      onComplete();
      return;
    }

    if (input === "q" || key.escape) {
      onQuit();
      exit();
      return;
    }
  });

  if (state === "success") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor={theme.ui.success}
          paddingX={2}
          paddingY={1}
          flexDirection="column"
        >
          <Text bold color={theme.ui.success}>
            ✓ Shell integration installed!
          </Text>

          <Box marginTop={1} flexDirection="column">
            <Text>Added to {shellInfo.configPath}</Text>
            <Text dimColor>
              Restart your terminal or run:{" "}
              <Text color={theme.accent}>source {shellInfo.configPath}</Text>
            </Text>
          </Box>

          <Box marginTop={1}>
            <Text dimColor>Press any key to continue...</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (state === "already-setup") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor={theme.ui.warning}
          paddingX={2}
          paddingY={1}
          flexDirection="column"
        >
          <Text bold color={theme.ui.warning}>
            Shell integration already configured
          </Text>

          <Box marginTop={1} flexDirection="column">
            <Text>Found "wt shell-init" in {shellInfo.configPath}</Text>
            <Text dimColor>
              Try restarting your terminal or run:{" "}
              <Text color={theme.accent}>source {shellInfo.configPath}</Text>
            </Text>
          </Box>

          <Box marginTop={1}>
            <Text dimColor>Press any key to continue...</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (state === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor={theme.ui.error}
          paddingX={2}
          paddingY={1}
          flexDirection="column"
        >
          <Text bold color={theme.ui.error}>
            ✗ Failed to set up shell integration
          </Text>

          <Box marginTop={1}>
            <Text color={theme.ui.error}>{error}</Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text>You can manually add this to {shellInfo.configPath}:</Text>
            <Text color={theme.accent}>{shellInfo.command}</Text>
          </Box>

          <Box marginTop={1}>
            <Text dimColor>Press any key to continue...</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Prompt state
  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor={theme.accent}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color={theme.accent}>
          Shell Integration Setup
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text>
            Shell integration lets you <Text bold>cd</Text> into worktrees by
            selecting them in the TUI.
          </Text>
          <Text dimColor>Without it, selections just print the path.</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text>
            Detected shell:{" "}
            <Text color={theme.ui.success}>{shellInfo.name}</Text>
          </Text>
          <Text dimColor>Will add to: {shellInfo.configPath}</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Command to be added:</Text>
          <Text color={theme.accent}>{shellInfo.command}</Text>
        </Box>

        <Box marginTop={1} flexDirection="column" gap={0}>
          <Text>
            <Text color={theme.accent} bold>
              y
            </Text>
            <Text dimColor> - Set up now (recommended)</Text>
          </Text>
          <Text>
            <Text color={theme.accent} bold>
              s
            </Text>
            <Text dimColor> - Skip for now</Text>
          </Text>
          <Text>
            <Text color={theme.accent} bold>
              n
            </Text>
            <Text dimColor> - Don't ask again</Text>
          </Text>
          <Text>
            <Text color={theme.accent} bold>
              q
            </Text>
            <Text dimColor> - Quit</Text>
          </Text>
        </Box>

        {isProcessing && (
          <Box marginTop={1}>
            <Text dimColor>Setting up...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
