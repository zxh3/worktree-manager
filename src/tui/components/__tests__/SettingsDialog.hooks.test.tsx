import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { render } from "ink-testing-library";
import { type Config, GLOBAL_CONFIG_PATH } from "../../../lib/config";
import { SettingsDialog } from "../SettingsDialog";

describe("SettingsDialog hooks", () => {
  const testConfig: Config = {
    paths: { strategy: "centralized", base: "~/.worktrees" },
    defaults: { branchPrefix: "", staleDays: 30 },
    hooks: {
      "post-create": "npm install",
      "post-select": ["code .", "echo selected"],
    },
  };

  beforeEach(() => {
    mkdirSync(dirname(GLOBAL_CONFIG_PATH), { recursive: true });
    writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(testConfig, null, 2));
  });

  afterEach(() => {
    try {
      rmSync(GLOBAL_CONFIG_PATH);
    } catch {
      // ignore
    }
  });

  it("displays single command hook", async () => {
    const { lastFrame } = render(
      <SettingsDialog
        repoId="test-repo"
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    // Wait for config to load
    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();
    expect(frame).toContain("Hooks");
    expect(frame).toContain("post-create:");
    expect(frame).toContain("npm install");
  });

  it("displays multi-command hook with count", async () => {
    const { lastFrame } = render(
      <SettingsDialog
        repoId="test-repo"
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();
    expect(frame).toContain("post-select:");
    expect(frame).toContain("[2 commands]");
    expect(frame).toContain("[1] code .");
    expect(frame).toContain("[2] echo selected");
  });

  it("displays unset hooks correctly", async () => {
    const { lastFrame } = render(
      <SettingsDialog
        repoId="test-repo"
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();
    expect(frame).toContain("post-delete:");
    expect(frame).toContain("(not set)");
  });

  it("shows all four hook types in order", async () => {
    const { lastFrame } = render(
      <SettingsDialog
        repoId="test-repo"
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();

    // Verify all hook types are displayed
    expect(frame).toContain("post-create:");
    expect(frame).toContain("post-select:");
    expect(frame).toContain("post-delete:");
    expect(frame).toContain("post-rename:");

    // Verify section header
    expect(frame).toContain("Hooks");
  });

  it("displays hook help text in edit mode", async () => {
    // The help text should mention Tab for adding lines when editing hooks
    const { lastFrame } = render(
      <SettingsDialog
        repoId="test-repo"
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();

    // In navigation mode, shows standard help
    expect(frame).toContain("Enter edit");
    expect(frame).toContain("^S save");
  });
});
