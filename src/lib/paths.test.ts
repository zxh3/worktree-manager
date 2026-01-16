/**
 * Unit tests for path resolution and repo ID derivation
 */

import { describe, expect, test } from "bun:test";
import { homedir } from "os";
import {
  deriveRepoId,
  deriveRepoIdFromUrl,
  deriveRepoIdFromPath,
  resolveWorktreePath,
  expandHome,
  contractHome,
  DEFAULT_WORKTREE_BASE,
} from "./paths";

describe("deriveRepoIdFromUrl", () => {
  test("extracts repo id from SSH remote", () => {
    expect(deriveRepoIdFromUrl("git@github.com:user/repo.git")).toBe(
      "github.com-user-repo"
    );
  });

  test("extracts repo id from SSH remote without .git suffix", () => {
    expect(deriveRepoIdFromUrl("git@github.com:user/repo")).toBe(
      "github.com-user-repo"
    );
  });

  test("extracts repo id from HTTPS remote", () => {
    expect(deriveRepoIdFromUrl("https://github.com/user/repo")).toBe(
      "github.com-user-repo"
    );
  });

  test("extracts repo id from HTTPS remote with .git suffix", () => {
    expect(deriveRepoIdFromUrl("https://github.com/user/repo.git")).toBe(
      "github.com-user-repo"
    );
  });

  test("handles nested paths in SSH format", () => {
    expect(deriveRepoIdFromUrl("git@gitlab.com:org/team/repo.git")).toBe(
      "gitlab.com-org-team-repo"
    );
  });

  test("handles nested paths in HTTPS format", () => {
    expect(deriveRepoIdFromUrl("https://gitlab.com/org/team/repo")).toBe(
      "gitlab.com-org-team-repo"
    );
  });

  test("falls back to hash for unrecognized URL format", () => {
    const result = deriveRepoIdFromUrl("file:///local/repo");
    expect(result).toMatch(/^repo-[a-f0-9]{8}$/);
  });
});

describe("deriveRepoIdFromPath", () => {
  test("includes directory name and hash", () => {
    const result = deriveRepoIdFromPath("/Users/dev/myproject");
    expect(result).toMatch(/^myproject-[a-f0-9]{8}$/);
  });

  test("different paths produce different hashes", () => {
    const result1 = deriveRepoIdFromPath("/Users/dev/project1");
    const result2 = deriveRepoIdFromPath("/Users/dev/project2");
    expect(result1).not.toBe(result2);
  });

  test("same path produces same hash", () => {
    const result1 = deriveRepoIdFromPath("/Users/dev/myproject");
    const result2 = deriveRepoIdFromPath("/Users/dev/myproject");
    expect(result1).toBe(result2);
  });
});

describe("deriveRepoId", () => {
  test("uses URL when available", () => {
    expect(deriveRepoId("git@github.com:user/repo.git", "/fallback")).toBe(
      "github.com-user-repo"
    );
  });

  test("falls back to path when URL is null", () => {
    const result = deriveRepoId(null, "/Users/dev/myproject");
    expect(result).toMatch(/^myproject-[a-f0-9]{8}$/);
  });
});

describe("resolveWorktreePath", () => {
  test("joins base, repo id, and worktree name", () => {
    const result = resolveWorktreePath("github.com-user-repo", "feature", "/base");
    expect(result).toBe("/base/github.com-user-repo/feature");
  });

  test("uses default base when not specified", () => {
    const result = resolveWorktreePath("my-repo", "feature");
    expect(result).toBe(`${DEFAULT_WORKTREE_BASE}/my-repo/feature`);
  });
});

describe("expandHome", () => {
  const home = homedir();

  test("expands ~/path to full path", () => {
    expect(expandHome("~/dev/project")).toBe(`${home}/dev/project`);
  });

  test("expands ~ alone to home directory", () => {
    expect(expandHome("~")).toBe(home);
  });

  test("leaves absolute paths unchanged", () => {
    expect(expandHome("/usr/local")).toBe("/usr/local");
  });

  test("leaves relative paths unchanged", () => {
    expect(expandHome("./local")).toBe("./local");
  });

  test("does not expand ~ in middle of path", () => {
    expect(expandHome("/some/~/path")).toBe("/some/~/path");
  });
});

describe("contractHome", () => {
  const home = homedir();

  test("contracts home directory to ~", () => {
    expect(contractHome(home)).toBe("~");
  });

  test("contracts paths under home directory", () => {
    expect(contractHome(`${home}/dev/project`)).toBe("~/dev/project");
  });

  test("leaves paths outside home unchanged", () => {
    expect(contractHome("/usr/local")).toBe("/usr/local");
  });

  test("handles edge case of path starting with home-like prefix", () => {
    // e.g., /home/user vs /home/username
    expect(contractHome(`${home}name/project`)).toBe(`${home}name/project`);
  });
});
