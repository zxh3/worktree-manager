/**
 * Unit tests for configuration schema validation
 */

import { describe, expect, test } from "bun:test";
import { ConfigSchema, DEFAULT_CONFIG, LocalConfigSchema } from "./config";

describe("ConfigSchema", () => {
  test("accepts valid full config", () => {
    const config = {
      paths: {
        strategy: "centralized",
        base: "~/.worktrees",
      },
      defaults: {
        branchPrefix: "feature/",
        staleDays: 14,
      },
      repos: {
        "github.com-user-repo": {
          branchPrefix: "wip/",
          base: "~/custom-worktrees",
        },
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paths.strategy).toBe("centralized");
      expect(result.data.defaults.branchPrefix).toBe("feature/");
      expect(result.data.repos?.["github.com-user-repo"]?.branchPrefix).toBe(
        "wip/",
      );
    }
  });

  test("applies defaults for missing fields", () => {
    const config = {};

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paths.strategy).toBe("centralized");
      expect(result.data.paths.base).toBe("~/.worktrees");
      expect(result.data.defaults.branchPrefix).toBe("");
      expect(result.data.defaults.staleDays).toBe(30);
    }
  });

  test("applies defaults for partial paths config", () => {
    const config = {
      paths: {
        strategy: "sibling" as const,
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paths.strategy).toBe("sibling");
      expect(result.data.paths.base).toBe("~/.worktrees");
    }
  });

  test("rejects invalid strategy", () => {
    const config = {
      paths: {
        strategy: "invalid",
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  test("rejects invalid staleDays type", () => {
    const config = {
      defaults: {
        staleDays: "thirty",
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  test("accepts sibling strategy", () => {
    const config = {
      paths: {
        strategy: "sibling",
        base: "~/.worktrees",
      },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paths.strategy).toBe("sibling");
    }
  });
});

describe("LocalConfigSchema", () => {
  test("accepts valid local config", () => {
    const config = {
      defaults: {
        branchPrefix: "local/",
      },
    };

    const result = LocalConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults?.branchPrefix).toBe("local/");
    }
  });

  test("accepts empty config", () => {
    const result = LocalConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts config with empty defaults", () => {
    const config = {
      defaults: {},
    };

    const result = LocalConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});

describe("DEFAULT_CONFIG", () => {
  test("is a valid config", () => {
    const result = ConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });

  test("has expected default values", () => {
    expect(DEFAULT_CONFIG.paths.strategy).toBe("centralized");
    expect(DEFAULT_CONFIG.paths.base).toBe("~/.worktrees");
    expect(DEFAULT_CONFIG.defaults.branchPrefix).toBe("");
    expect(DEFAULT_CONFIG.defaults.staleDays).toBe(30);
  });
});
