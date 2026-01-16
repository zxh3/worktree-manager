/**
 * Configuration loading and validation
 */

import { z } from "zod";
import { join } from "path";
import { homedir } from "os";
import { expandHome } from "./paths";

/** Global config file path */
export const GLOBAL_CONFIG_PATH = join(homedir(), ".config", "wt", "config.json");

/** Repo-local config file name */
export const LOCAL_CONFIG_FILE = ".wtrc.json";

/** Schema for per-repo overrides */
const RepoOverrideSchema = z.object({
  branchPrefix: z.string().optional(),
  base: z.string().optional(),
});

/** Schema for global configuration */
export const ConfigSchema = z.object({
  paths: z
    .object({
      strategy: z.enum(["centralized", "sibling"]).default("centralized"),
      base: z.string().default("~/.worktrees"),
    })
    .default({}),
  defaults: z
    .object({
      branchPrefix: z.string().default(""),
      staleDays: z.number().default(30),
    })
    .default({}),
  repos: z.record(RepoOverrideSchema).optional(),
});

/** Schema for repo-local configuration */
export const LocalConfigSchema = z.object({
  defaults: z
    .object({
      branchPrefix: z.string().optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type LocalConfig = z.infer<typeof LocalConfigSchema>;

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
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }
    const content = await file.text();
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
 * Load repo-local configuration
 */
export async function loadLocalConfig(repoRoot: string): Promise<LocalConfig | null> {
  const path = join(repoRoot, LOCAL_CONFIG_FILE);
  const raw = await loadJsonFile<unknown>(path);
  if (!raw) {
    return null;
  }

  const result = LocalConfigSchema.safeParse(raw);
  if (!result.success) {
    console.warn(`Invalid local config at ${path}, ignoring`);
    return null;
  }

  return result.data;
}

/**
 * Get merged configuration for a specific repo
 */
export async function getConfig(
  repoRoot: string,
  repoId: string
): Promise<{
  config: Config;
  localConfig: LocalConfig | null;
  branchPrefix: string;
  worktreeBase: string;
}> {
  const [config, localConfig] = await Promise.all([
    loadGlobalConfig(),
    loadLocalConfig(repoRoot),
  ]);

  // Check for repo-specific overrides
  const repoOverride = config.repos?.[repoId];

  // Determine branch prefix (local > repo override > global default)
  const branchPrefix =
    localConfig?.defaults?.branchPrefix ??
    repoOverride?.branchPrefix ??
    config.defaults.branchPrefix;

  // Determine worktree base directory (repo override > global)
  const worktreeBase = expandHome(
    repoOverride?.base ?? config.paths.base
  );

  return {
    config,
    localConfig,
    branchPrefix,
    worktreeBase,
  };
}

/**
 * Save global configuration
 */
export async function saveGlobalConfig(config: Config): Promise<void> {
  const dir = join(homedir(), ".config", "wt");
  await Bun.write(
    GLOBAL_CONFIG_PATH,
    JSON.stringify(config, null, 2)
  );
}

/**
 * Initialize a local .wtrc.json file
 */
export async function initLocalConfig(repoRoot: string): Promise<string> {
  const path = join(repoRoot, LOCAL_CONFIG_FILE);
  const defaultLocal: LocalConfig = {
    defaults: {
      branchPrefix: "",
    },
  };
  await Bun.write(path, JSON.stringify(defaultLocal, null, 2));
  return path;
}
