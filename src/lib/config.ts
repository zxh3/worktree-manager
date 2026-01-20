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

/** Hook types supported by the system */
export type HookType =
  | "post-create"
  | "post-select"
  | "post-delete"
  | "post-rename";

/** Schema for hook command configuration */
export const HookCommandSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.object({
    commands: z.union([z.string(), z.array(z.string())]),
    timeout: z.number().positive().optional(),
    continueOnError: z.boolean().optional(),
  }),
]);

export type HookCommand = z.infer<typeof HookCommandSchema>;

/** Schema for hooks configuration */
export const HooksSchema = z
  .object({
    "post-create": HookCommandSchema.optional(),
    "post-select": HookCommandSchema.optional(),
    "post-delete": HookCommandSchema.optional(),
    "post-rename": HookCommandSchema.optional(),
  })
  .optional();

export type HooksConfig = z.infer<typeof HooksSchema>;

/** Schema for per-repo overrides */
const RepoOverrideSchema = z.object({
  branchPrefix: z
    .string()
    .max(30)
    .regex(/^[a-zA-Z0-9_/-]*$/, "Invalid branch prefix format")
    .optional(),
  base: z.string().optional(),
  comparisonBranch: z.string().optional(),
  hooks: HooksSchema,
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
  hooks: HooksSchema,
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
  hooks: HooksConfig;
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

  // Resolve hooks: repo-specific hooks completely replace global hooks per hook type
  const globalHooks = config.hooks ?? {};
  const repoHooks = repoOverride?.hooks ?? {};
  const hooks: HooksConfig = {
    "post-create": repoHooks["post-create"] ?? globalHooks["post-create"],
    "post-select": repoHooks["post-select"] ?? globalHooks["post-select"],
    "post-delete": repoHooks["post-delete"] ?? globalHooks["post-delete"],
    "post-rename": repoHooks["post-rename"] ?? globalHooks["post-rename"],
  };

  return {
    config,
    branchPrefix,
    worktreeBase,
    comparisonBranch,
    hooks,
  };
}

/**
 * Save global configuration
 */
export async function saveGlobalConfig(config: Config): Promise<void> {
  await writeFileText(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
}
