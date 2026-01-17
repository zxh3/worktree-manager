/**
 * Configuration loading and validation
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { fileExists, readFileText, writeFileText } from "../utils/compat";
import { expandHome } from "./paths";

/** Global config file path */
export const GLOBAL_CONFIG_PATH = join(
  homedir(),
  ".config",
  "wt",
  "config.json",
);

/** Schema for per-repo overrides */
const RepoOverrideSchema = z.object({
  branchPrefix: z
    .string()
    .max(30)
    .regex(/^[a-zA-Z0-9_/-]*$/, "Invalid branch prefix format")
    .optional(),
  base: z.string().optional(),
  comparisonBranch: z.string().optional(),
});

/** Schema for global configuration */
export const ConfigSchema = z.object({
  paths: z
    .object({
      strategy: z.enum(["centralized", "sibling"]).default("centralized"),
      base: z.string().default("~/.worktrees"),
    })
    .default({ strategy: "centralized", base: "~/.worktrees" }),
  defaults: z
    .object({
      branchPrefix: z.string().default(""),
      staleDays: z.number().default(30),
      comparisonBranch: z.string().optional(),
    })
    .default({ branchPrefix: "", staleDays: 30 }),
  repos: z.record(z.string(), RepoOverrideSchema).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Default configuration */
export const DEFAULT_CONFIG: Config = {
  paths: {
    strategy: "centralized",
    base: "~/.worktrees",
  },
  defaults: {
    branchPrefix: "",
    staleDays: 30,
  },
};

/**
 * Load and parse a JSON config file
 */
async function loadJsonFile<T>(path: string): Promise<T | null> {
  try {
    if (!(await fileExists(path))) {
      return null;
    }
    const content = await readFileText(path);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Load global configuration
 */
export async function loadGlobalConfig(): Promise<Config> {
  const raw = await loadJsonFile<unknown>(GLOBAL_CONFIG_PATH);
  if (!raw) {
    return DEFAULT_CONFIG;
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    console.warn(`Invalid config at ${GLOBAL_CONFIG_PATH}, using defaults`);
    return DEFAULT_CONFIG;
  }

  return result.data;
}

/**
 * Get configuration for a specific repo
 */
export async function getConfig(
  _repoRoot: string,
  repoId: string,
): Promise<{
  config: Config;
  branchPrefix: string;
  worktreeBase: string;
  comparisonBranch?: string;
}> {
  const config = await loadGlobalConfig();

  // Check for repo-specific overrides
  const repoOverride = config.repos?.[repoId];

  // Determine branch prefix (repo override > global default)
  const branchPrefix =
    repoOverride?.branchPrefix ?? config.defaults.branchPrefix;

  // Determine worktree base directory (repo override > global)
  const worktreeBase = expandHome(repoOverride?.base ?? config.paths.base);

  // Determine comparison branch (repo override > global default)
  const comparisonBranch =
    repoOverride?.comparisonBranch ?? config.defaults.comparisonBranch;

  return {
    config,
    branchPrefix,
    worktreeBase,
    comparisonBranch,
  };
}

/**
 * Save global configuration
 */
export async function saveGlobalConfig(config: Config): Promise<void> {
  await writeFileText(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
}
