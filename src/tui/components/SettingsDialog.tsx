/**
 * Settings dialog for editing configuration
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import {
  type Config,
  ConfigSchema,
  type HookCommand,
  type HookType,
  loadGlobalConfig,
  saveGlobalConfig,
} from "../../lib/config";
import { theme } from "../theme";

interface SettingsDialogProps {
  repoId: string;
  onClose: () => void;
  onSaved: () => void;
}

type FieldId =
  | "paths.strategy"
  | "paths.base"
  | "defaults.branchPrefix"
  | "defaults.staleDays"
  | "defaults.comparisonBranch"
  | "hooks.post-create"
  | "hooks.post-select"
  | "hooks.post-delete"
  | "hooks.post-rename"
  | `repos.${string}.branchPrefix`
  | `repos.${string}.base`
  | `repos.${string}.comparisonBranch`
  | `repos.${string}.hooks.post-create`
  | `repos.${string}.hooks.post-select`
  | `repos.${string}.hooks.post-delete`
  | `repos.${string}.hooks.post-rename`
  | "addRepo";

const FIELD_ORDER: FieldId[] = [
  "paths.strategy",
  "paths.base",
  "defaults.branchPrefix",
  "defaults.staleDays",
  "defaults.comparisonBranch",
  "hooks.post-create",
  "hooks.post-select",
  "hooks.post-delete",
  "hooks.post-rename",
];

const HOOK_TYPES: HookType[] = [
  "post-create",
  "post-select",
  "post-delete",
  "post-rename",
];

/**
 * Format a hook configuration for display in the UI
 */
function formatHookForDisplay(hook: HookCommand | undefined): string {
  if (!hook) return "(not set)";
  if (typeof hook === "string") return hook;
  if (Array.isArray(hook)) return hook.join("\n");
  // Object format - extract commands
  const cmds =
    typeof hook.commands === "string"
      ? hook.commands
      : hook.commands.join("\n");
  return cmds;
}

/**
 * Convert hook value to array of command lines
 */
function hookToLines(hook: HookCommand | undefined): string[] {
  if (!hook) return [""];
  if (typeof hook === "string") return [hook];
  if (Array.isArray(hook)) return hook.length > 0 ? hook : [""];
  // Object format
  const cmds = hook.commands;
  if (typeof cmds === "string") return [cmds];
  return cmds.length > 0 ? cmds : [""];
}

/**
 * Normalize hook value for saving - returns string, string[], or undefined
 */
function normalizeHookValue(lines: string[]): string | string[] | undefined {
  const filtered = lines.filter((v) => v.trim());
  if (filtered.length === 0) return undefined;
  if (filtered.length === 1) return filtered[0];
  return filtered;
}

/**
 * Check if a field is a hook field
 */
function isHookField(fieldId: FieldId): boolean {
  return (
    fieldId.startsWith("hooks.") || /^repos\..+\.hooks\.post-\w+$/.test(fieldId)
  );
}

const STRATEGIES = ["centralized", "sibling"] as const;

export function SettingsDialog({
  repoId,
  onClose,
  onSaved,
}: SettingsDialogProps) {
  const [config, setConfig] = useState<Config | null>(null);
  const [selectedField, setSelectedField] = useState<FieldId>("paths.strategy");
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [repoOverrideIds, setRepoOverrideIds] = useState<string[]>([]);
  // Multi-line hook editing state
  const [editLines, setEditLines] = useState<string[]>([]);
  const [editLineIndex, setEditLineIndex] = useState(0);

  // Load config on mount
  useEffect(() => {
    loadGlobalConfig().then((cfg) => {
      setConfig(cfg);
      setRepoOverrideIds(Object.keys(cfg.repos ?? {}));
    });
  }, []);

  // Build dynamic field order including repo overrides
  const allFields: FieldId[] = [
    ...FIELD_ORDER,
    ...repoOverrideIds.flatMap(
      (id) =>
        [
          `repos.${id}.branchPrefix`,
          `repos.${id}.base`,
          `repos.${id}.comparisonBranch`,
          `repos.${id}.hooks.post-create`,
          `repos.${id}.hooks.post-select`,
          `repos.${id}.hooks.post-delete`,
          `repos.${id}.hooks.post-rename`,
        ] as FieldId[],
    ),
    "addRepo",
  ];

  const selectedIndex = allFields.indexOf(selectedField);

  // Get the current value of a field
  function getFieldValue(fieldId: FieldId): string {
    if (!config) return "";
    if (fieldId === "paths.strategy") return config.paths.strategy;
    if (fieldId === "paths.base") return config.paths.base;
    if (fieldId === "defaults.branchPrefix")
      return config.defaults.branchPrefix;
    if (fieldId === "defaults.staleDays")
      return String(config.defaults.staleDays);
    if (fieldId === "defaults.comparisonBranch")
      return config.defaults.comparisonBranch ?? "";

    // Global hooks
    if (fieldId.startsWith("hooks.")) {
      const hookType = fieldId.replace("hooks.", "") as HookType;
      const hook = config.hooks?.[hookType];
      return formatHookForDisplay(hook);
    }

    // Repo hook overrides
    const repoHookMatch = fieldId.match(/^repos\.(.+)\.hooks\.(post-\w+)$/);
    if (repoHookMatch) {
      const [, repoIdMatch, hookType] = repoHookMatch;
      const hook = config.repos?.[repoIdMatch]?.hooks?.[hookType as HookType];
      return formatHookForDisplay(hook);
    }

    // Repo override fields (non-hook)
    const match = fieldId.match(
      /^repos\.(.+)\.(branchPrefix|base|comparisonBranch)$/,
    );
    if (match) {
      const [, repoIdMatch, field] = match;
      const repoConfig = config.repos?.[repoIdMatch];
      if (!repoConfig) return "";
      return (repoConfig as Record<string, string | undefined>)[field] ?? "";
    }

    return "";
  }

  // Get hook config for a field
  function getHookConfig(fieldId: FieldId): HookCommand | undefined {
    if (!config) return undefined;

    // Global hooks
    if (fieldId.startsWith("hooks.")) {
      const hookType = fieldId.replace("hooks.", "") as HookType;
      return config.hooks?.[hookType];
    }

    // Repo hook overrides
    const repoHookMatch = fieldId.match(/^repos\.(.+)\.hooks\.(post-\w+)$/);
    if (repoHookMatch) {
      const [, repoIdMatch, hookType] = repoHookMatch;
      return config.repos?.[repoIdMatch]?.hooks?.[hookType as HookType];
    }

    return undefined;
  }

  // Update config with a new value
  function updateField(fieldId: FieldId, value: string): void {
    if (!config) return;

    const newConfig = { ...config };

    if (fieldId === "paths.strategy") {
      newConfig.paths = {
        ...newConfig.paths,
        strategy: value as "centralized" | "sibling",
      };
    } else if (fieldId === "paths.base") {
      newConfig.paths = { ...newConfig.paths, base: value };
    } else if (fieldId === "defaults.branchPrefix") {
      newConfig.defaults = { ...newConfig.defaults, branchPrefix: value };
    } else if (fieldId === "defaults.staleDays") {
      const num = Number.parseInt(value, 10);
      if (!Number.isNaN(num) && num > 0) {
        newConfig.defaults = { ...newConfig.defaults, staleDays: num };
      }
    } else if (fieldId === "defaults.comparisonBranch") {
      newConfig.defaults = {
        ...newConfig.defaults,
        comparisonBranch: value || undefined,
      };
    } else {
      // Repo override fields (non-hook)
      const match = fieldId.match(
        /^repos\.(.+)\.(branchPrefix|base|comparisonBranch)$/,
      );
      if (match) {
        const [, repoIdMatch, field] = match;
        newConfig.repos = {
          ...newConfig.repos,
          [repoIdMatch]: {
            ...newConfig.repos?.[repoIdMatch],
            [field]: value || undefined,
          },
        };
      }
    }

    setConfig(newConfig);
  }

  // Update hook field with array of command lines
  function updateHookField(fieldId: FieldId, lines: string[]): void {
    if (!config) return;

    const hookValue = normalizeHookValue(lines);
    const newConfig = { ...config };

    // Global hooks
    if (fieldId.startsWith("hooks.")) {
      const hookType = fieldId.replace("hooks.", "") as HookType;
      if (hookValue === undefined) {
        // Remove hook if empty
        const newHooks = { ...newConfig.hooks };
        delete newHooks[hookType];
        newConfig.hooks =
          Object.keys(newHooks).length > 0 ? newHooks : undefined;
      } else {
        newConfig.hooks = {
          ...newConfig.hooks,
          [hookType]: hookValue,
        };
      }
      setConfig(newConfig);
      return;
    }

    // Repo hook overrides
    const repoHookMatch = fieldId.match(/^repos\.(.+)\.hooks\.(post-\w+)$/);
    if (repoHookMatch) {
      const [, repoIdMatch, hookType] = repoHookMatch;
      const existingRepo = newConfig.repos?.[repoIdMatch] ?? {};
      const existingHooks = existingRepo.hooks ?? {};

      if (hookValue === undefined) {
        // Remove hook if empty
        const newHooks = { ...existingHooks };
        delete newHooks[hookType as HookType];
        newConfig.repos = {
          ...newConfig.repos,
          [repoIdMatch]: {
            ...existingRepo,
            hooks: Object.keys(newHooks).length > 0 ? newHooks : undefined,
          },
        };
      } else {
        newConfig.repos = {
          ...newConfig.repos,
          [repoIdMatch]: {
            ...existingRepo,
            hooks: {
              ...existingHooks,
              [hookType]: hookValue,
            },
          },
        };
      }
      setConfig(newConfig);
    }
  }

  // Add new repo override
  function addRepoOverride(id: string): void {
    if (!config || !id.trim()) return;

    const newConfig = {
      ...config,
      repos: {
        ...config.repos,
        [id]: { branchPrefix: "", base: "", comparisonBranch: "" },
      },
    };
    setConfig(newConfig);
    setRepoOverrideIds([...repoOverrideIds, id]);
    setSelectedField(`repos.${id}.branchPrefix`);
  }

  // Delete repo override
  function deleteRepoOverride(id: string): void {
    if (!config) return;

    const newRepos = { ...config.repos };
    delete newRepos[id];

    setConfig({ ...config, repos: newRepos });
    setRepoOverrideIds(repoOverrideIds.filter((r) => r !== id));
    setSelectedField("addRepo");
  }

  // Handle save
  async function handleSave(): Promise<void> {
    if (!config) return;

    // Validate
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      setError(`Validation error: ${firstIssue?.message ?? "Unknown error"}`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveGlobalConfig(config);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSaving(false);
    }
  }

  // Input handling
  useInput((input, key) => {
    if (isSaving) return;

    // Handle edit mode
    if (editMode) {
      // Hook field editing (multi-line)
      if (isHookField(selectedField)) {
        if (key.escape) {
          setEditMode(false);
          setEditLines([]);
          setEditLineIndex(0);
          return;
        }

        if (key.return) {
          updateHookField(selectedField, editLines);
          setEditMode(false);
          setEditLines([]);
          setEditLineIndex(0);
          return;
        }

        // Tab or + to add new command line
        if (key.tab || input === "+") {
          setEditLines([...editLines, ""]);
          setEditLineIndex(editLines.length);
          return;
        }

        // Delete current line with 'd' (only if multiple lines)
        if (input === "d" && editLines.length > 1) {
          const newLines = editLines.filter((_, i) => i !== editLineIndex);
          setEditLines(newLines);
          setEditLineIndex(Math.min(editLineIndex, newLines.length - 1));
          return;
        }

        // Navigate lines with j/k or arrows (only in multi-line mode)
        if (editLines.length > 1) {
          if (
            (input === "j" || key.downArrow) &&
            editLineIndex < editLines.length - 1
          ) {
            setEditLineIndex(editLineIndex + 1);
            return;
          }
          if ((input === "k" || key.upArrow) && editLineIndex > 0) {
            setEditLineIndex(editLineIndex - 1);
            return;
          }
        }

        // Text editing for current line
        if (key.backspace || key.delete) {
          const newLines = [...editLines];
          newLines[editLineIndex] = newLines[editLineIndex].slice(0, -1);
          setEditLines(newLines);
          return;
        }

        // Allow most printable characters for commands
        if (input && input.length === 1 && /^[\x20-\x7e]$/.test(input)) {
          const newLines = [...editLines];
          newLines[editLineIndex] = newLines[editLineIndex] + input;
          setEditLines(newLines);
        }
        return;
      }

      // Non-hook field editing
      if (key.escape) {
        setEditMode(false);
        setEditValue("");
        return;
      }

      if (key.return) {
        if (selectedField === "addRepo" && editValue.trim()) {
          addRepoOverride(editValue.trim());
        } else {
          updateField(selectedField, editValue);
        }
        setEditMode(false);
        setEditValue("");
        return;
      }

      // For strategy field, use left/right to cycle
      if (selectedField === "paths.strategy") {
        if (key.leftArrow || key.rightArrow) {
          const currentIdx = STRATEGIES.indexOf(
            editValue as (typeof STRATEGIES)[number],
          );
          const newIdx = key.rightArrow
            ? (currentIdx + 1) % STRATEGIES.length
            : (currentIdx - 1 + STRATEGIES.length) % STRATEGIES.length;
          setEditValue(STRATEGIES[newIdx]);
        }
        return;
      }

      // For staleDays, only accept digits
      if (selectedField === "defaults.staleDays") {
        if (key.backspace || key.delete) {
          setEditValue((v) => v.slice(0, -1));
          return;
        }
        if (input && /^\d$/.test(input)) {
          setEditValue((v) => v + input);
        }
        return;
      }

      // For text fields
      if (key.backspace || key.delete) {
        setEditValue((v) => v.slice(0, -1));
        return;
      }

      // Allow valid characters for paths and branch prefixes
      if (input && /^[a-zA-Z0-9_/~.-]$/.test(input)) {
        setEditValue((v) => v + input);
      }
      return;
    }

    // Navigation mode
    if (key.escape) {
      onClose();
      return;
    }

    // Save with Ctrl+S
    if (key.ctrl && input === "s") {
      handleSave();
      return;
    }

    // Navigation
    if (input === "j" || key.downArrow) {
      const nextIndex = Math.min(selectedIndex + 1, allFields.length - 1);
      setSelectedField(allFields[nextIndex]);
      return;
    }
    if (input === "k" || key.upArrow) {
      const prevIndex = Math.max(selectedIndex - 1, 0);
      setSelectedField(allFields[prevIndex]);
      return;
    }
    if (key.tab) {
      const nextIndex = (selectedIndex + 1) % allFields.length;
      setSelectedField(allFields[nextIndex]);
      return;
    }

    // Enter edit mode
    if (key.return) {
      if (selectedField === "addRepo") {
        // Prompt for repo ID by starting edit mode with current repoId as suggestion
        setEditValue(repoId);
        setEditMode(true);
        return;
      }

      // Hook fields use multi-line editing
      if (isHookField(selectedField)) {
        const hookConfig = getHookConfig(selectedField);
        setEditLines(hookToLines(hookConfig));
        setEditLineIndex(0);
        setEditMode(true);
        return;
      }

      // Regular fields
      setEditValue(getFieldValue(selectedField));
      setEditMode(true);
      return;
    }

    // Delete repo override with 'd'
    if (input === "d") {
      const match = selectedField.match(/^repos\.(.+)\./);
      if (match) {
        deleteRepoOverride(match[1]);
      }
    }
  });

  if (!config) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.dialog.info}
        padding={1}
        marginTop={1}
      >
        <Text dimColor>Loading configuration...</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.dialog.info}
      padding={1}
      marginTop={1}
    >
      <Text bold color={theme.dialog.info}>
        Settings
      </Text>

      {/* Worktree Storage Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>
          Worktree Storage
        </Text>
        <Text dimColor>{"─".repeat(17)}</Text>

        <FieldRow
          label="Strategy"
          value={config.paths.strategy}
          isSelected={selectedField === "paths.strategy"}
          isEditing={editMode && selectedField === "paths.strategy"}
          editValue={editValue}
          isEnum
        />
        <FieldRow
          label="Base path"
          value={config.paths.base}
          isSelected={selectedField === "paths.base"}
          isEditing={editMode && selectedField === "paths.base"}
          editValue={editValue}
        />
      </Box>

      {/* Defaults Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>
          Defaults
        </Text>
        <Text dimColor>{"─".repeat(8)}</Text>

        <FieldRow
          label="Branch prefix"
          value={config.defaults.branchPrefix || "(none)"}
          isSelected={selectedField === "defaults.branchPrefix"}
          isEditing={editMode && selectedField === "defaults.branchPrefix"}
          editValue={editValue}
        />
        <FieldRow
          label="Stale days"
          value={String(config.defaults.staleDays)}
          isSelected={selectedField === "defaults.staleDays"}
          isEditing={editMode && selectedField === "defaults.staleDays"}
          editValue={editValue}
        />
        <FieldRow
          label="Compare branch"
          value={config.defaults.comparisonBranch || "(auto)"}
          isSelected={selectedField === "defaults.comparisonBranch"}
          isEditing={editMode && selectedField === "defaults.comparisonBranch"}
          editValue={editValue}
        />
      </Box>

      {/* Hooks Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>
          Hooks
        </Text>
        <Text dimColor>{"─".repeat(5)}</Text>

        {HOOK_TYPES.map((hookType) => (
          <HookFieldRow
            key={hookType}
            hookType={hookType}
            value={getFieldValue(`hooks.${hookType}`)}
            isSelected={selectedField === `hooks.${hookType}`}
            isEditing={editMode && selectedField === `hooks.${hookType}`}
            editLines={editLines}
            editLineIndex={editLineIndex}
          />
        ))}
      </Box>

      {/* Repository Overrides Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold dimColor>
          Repository Overrides
        </Text>
        <Text dimColor>{"─".repeat(20)}</Text>

        {repoOverrideIds.map((id) => (
          <Box key={id} flexDirection="column" marginLeft={1}>
            <Text dimColor>{id}</Text>
            <Box marginLeft={2} flexDirection="column">
              <FieldRow
                label="branchPrefix"
                value={config.repos?.[id]?.branchPrefix || "(none)"}
                isSelected={selectedField === `repos.${id}.branchPrefix`}
                isEditing={
                  editMode && selectedField === `repos.${id}.branchPrefix`
                }
                editValue={editValue}
              />
              <FieldRow
                label="base"
                value={config.repos?.[id]?.base || "(none)"}
                isSelected={selectedField === `repos.${id}.base`}
                isEditing={editMode && selectedField === `repos.${id}.base`}
                editValue={editValue}
              />
              <FieldRow
                label="compareBranch"
                value={config.repos?.[id]?.comparisonBranch || "(auto)"}
                isSelected={selectedField === `repos.${id}.comparisonBranch`}
                isEditing={
                  editMode && selectedField === `repos.${id}.comparisonBranch`
                }
                editValue={editValue}
              />
              <Box marginTop={1}>
                <Text dimColor>hooks:</Text>
              </Box>
              {HOOK_TYPES.map((hookType) => (
                <HookFieldRow
                  key={hookType}
                  hookType={hookType}
                  value={getFieldValue(`repos.${id}.hooks.${hookType}`)}
                  isSelected={selectedField === `repos.${id}.hooks.${hookType}`}
                  isEditing={
                    editMode &&
                    selectedField === `repos.${id}.hooks.${hookType}`
                  }
                  editLines={editLines}
                  editLineIndex={editLineIndex}
                  indented
                />
              ))}
            </Box>
          </Box>
        ))}

        <Box marginTop={repoOverrideIds.length > 0 ? 1 : 0}>
          {selectedField === "addRepo" && editMode ? (
            <Box>
              <Text color={theme.accent}>[+ Add: </Text>
              <Text color={theme.accent}>{editValue}</Text>
              <Text color={theme.accent}>█]</Text>
            </Box>
          ) : (
            <Text
              color={selectedField === "addRepo" ? theme.accent : undefined}
              inverse={selectedField === "addRepo"}
            >
              [+ Add override]
            </Text>
          )}
        </Box>
      </Box>

      {/* Error display */}
      {error && (
        <Box marginTop={1}>
          <Text color={theme.ui.error}>{error}</Text>
        </Box>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <Box marginTop={1}>
          <Text dimColor>Saving...</Text>
        </Box>
      )}

      {/* Help text */}
      <Box
        marginTop={1}
        borderStyle="single"
        borderTop
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        paddingTop={1}
      >
        {editMode ? (
          selectedField === "paths.strategy" ? (
            <Text dimColor>{"←/→ cycle  Enter confirm  Esc cancel"}</Text>
          ) : isHookField(selectedField) ? (
            editLines.length > 1 ? (
              <Text dimColor>
                {
                  "Type cmd  ↑/↓ lines  Tab +line  d delete  Enter done  Esc cancel"
                }
              </Text>
            ) : (
              <Text dimColor>
                {"Type command  Tab +line  Enter done  Esc cancel"}
              </Text>
            )
          ) : (
            <Text dimColor>{"Type to edit  Enter confirm  Esc cancel"}</Text>
          )
        ) : (
          <Text dimColor>
            {"↑/↓ navigate  Tab next  Enter edit  Esc cancel  ^S save"}
          </Text>
        )}
      </Box>
    </Box>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  isSelected: boolean;
  isEditing: boolean;
  editValue: string;
  isEnum?: boolean;
}

function FieldRow({
  label,
  value,
  isSelected,
  isEditing,
  editValue,
  isEnum,
}: FieldRowProps) {
  const displayValue = isEditing ? editValue : value;
  const labelWidth = 14;
  const paddedLabel = `${label}:`.padEnd(labelWidth);

  return (
    <Box>
      <Text dimColor={!isSelected}>{paddedLabel}</Text>
      {isEditing ? (
        <Box>
          {isEnum ? (
            <Text color={theme.accent}>[{displayValue} ▾]</Text>
          ) : (
            <Box>
              <Text color={theme.accent}>{displayValue}</Text>
              <Text color={theme.accent}>█</Text>
            </Box>
          )}
        </Box>
      ) : (
        <Text
          color={isSelected ? theme.accent : undefined}
          inverse={isSelected}
        >
          {displayValue}
        </Text>
      )}
    </Box>
  );
}

interface HookFieldRowProps {
  hookType: string;
  value: string;
  isSelected: boolean;
  isEditing: boolean;
  editLines: string[];
  editLineIndex: number;
  indented?: boolean;
}

function HookFieldRow({
  hookType,
  value,
  isSelected,
  isEditing,
  editLines,
  editLineIndex,
  indented,
}: HookFieldRowProps) {
  const labelWidth = indented ? 12 : 14;
  const label = `${hookType}:`.padEnd(labelWidth);
  const lines = value.split("\n");
  const isMultiLine = lines.length > 1 || (isEditing && editLines.length > 1);

  if (isEditing) {
    // Single line editing
    if (editLines.length === 1) {
      return (
        <Box marginLeft={indented ? 2 : 0}>
          <Text dimColor={!isSelected}>{label}</Text>
          <Box>
            <Text color={theme.accent}>{editLines[0]}</Text>
            <Text color={theme.accent}>█</Text>
          </Box>
        </Box>
      );
    }

    // Multi-line editing
    return (
      <Box flexDirection="column" marginLeft={indented ? 2 : 0}>
        <Box>
          <Text dimColor>{label}</Text>
          <Text color={theme.accent}>[{editLines.length} commands]</Text>
        </Box>
        {editLines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are edited in place, index is stable
          <Box key={`edit-${i}`} marginLeft={labelWidth}>
            <Text color={i === editLineIndex ? theme.accent : undefined}>
              [{i + 1}] {line}
              {i === editLineIndex ? "█" : ""}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }

  // Display mode - multi-line
  if (isMultiLine) {
    return (
      <Box flexDirection="column" marginLeft={indented ? 2 : 0}>
        <Box>
          <Text dimColor={!isSelected}>{label}</Text>
          <Text
            color={isSelected ? theme.accent : undefined}
            inverse={isSelected}
          >
            [{lines.length} commands]
          </Text>
        </Box>
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: display mode, lines are read-only
          <Box key={`display-${i}`} marginLeft={labelWidth}>
            <Text dimColor>
              [{i + 1}] {line}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }

  // Display mode - single line
  return (
    <Box marginLeft={indented ? 2 : 0}>
      <Text dimColor={!isSelected}>{label}</Text>
      <Text color={isSelected ? theme.accent : undefined} inverse={isSelected}>
        {value}
      </Text>
    </Box>
  );
}
