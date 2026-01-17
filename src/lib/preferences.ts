/**
 * User preferences management
 */

import { rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { fileExists, readFileText, writeFileText } from "../utils/compat";

const PREFERENCES_DIR = join(homedir(), ".config", "wt");
const PREFERENCES_PATH = join(PREFERENCES_DIR, "preferences.json");

/** Preferences schema for validation */
const PreferencesSchema = z
  .object({
    skipShellIntegrationPrompt: z.boolean().optional(),
  })
  .passthrough(); // Allow unknown keys for forward compatibility

export type Preferences = z.infer<typeof PreferencesSchema>;

// Simple in-memory lock to prevent concurrent writes within same process
let writeLock: Promise<void> | null = null;

/**
 * Load user preferences with validation
 */
export async function loadPreferences(): Promise<Preferences> {
  try {
    if (!(await fileExists(PREFERENCES_PATH))) {
      return {};
    }
    const content = await readFileText(PREFERENCES_PATH);
    const parsed = JSON.parse(content);
    const result = PreferencesSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

/**
 * Save user preferences with atomic write to prevent race conditions.
 * Uses write-to-temp-then-rename pattern for atomicity.
 */
export async function savePreferences(prefs: Preferences): Promise<void> {
  // Wait for any existing write to complete
  if (writeLock) {
    await writeLock;
  }

  // Create a new lock
  let releaseLock: () => void;
  writeLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  try {
    // Merge with existing preferences
    const existing = await loadPreferences();
    const merged = { ...existing, ...prefs };

    // Write to temp file first, then rename (atomic on most filesystems)
    const tempPath = `${PREFERENCES_PATH}.tmp.${Date.now()}`;
    await writeFileText(tempPath, JSON.stringify(merged, null, 2));

    // Atomic rename
    await rename(tempPath, PREFERENCES_PATH);
  } finally {
    // Release the lock
    releaseLock!();
    writeLock = null;
  }
}

/**
 * Check if user has opted out of shell integration prompt
 */
export async function hasSkippedShellIntegrationPrompt(): Promise<boolean> {
  const prefs = await loadPreferences();
  return prefs.skipShellIntegrationPrompt === true;
}

/**
 * Set the skip shell integration prompt preference
 */
export async function setSkipShellIntegrationPrompt(
  skip: boolean,
): Promise<void> {
  await savePreferences({ skipShellIntegrationPrompt: skip });
}
