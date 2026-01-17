/**
 * Settings dialog for editing configuration
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import {
  type Config,
  ConfigSchema,
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
  | `repos.${string}.branchPrefix`
  | `repos.${string}.base`
  | "addRepo";

const FIELD_ORDER: FieldId[] = [
  "paths.strategy",
  "paths.base",
  "defaults.branchPrefix",
  "defaults.staleDays",
];

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
      (id) => [`repos.${id}.branchPrefix`, `repos.${id}.base`] as FieldId[],
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

    // Repo override fields
    const match = fieldId.match(/^repos\.(.+)\.(branchPrefix|base)$/);
    if (match) {
      const [, repoId, field] = match;
      const repoConfig = config.repos?.[repoId];
      if (!repoConfig) return "";
      return (repoConfig as Record<string, string | undefined>)[field] ?? "";
    }

    return "";
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
    } else {
      // Repo override fields
      const match = fieldId.match(/^repos\.(.+)\.(branchPrefix|base)$/);
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

  // Add new repo override
  function addRepoOverride(id: string): void {
    if (!config || !id.trim()) return;

    const newConfig = {
      ...config,
      repos: {
        ...config.repos,
        [id]: { branchPrefix: "", base: "" },
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
