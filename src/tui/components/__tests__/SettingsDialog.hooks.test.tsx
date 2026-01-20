import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import { SettingsDialog } from "../SettingsDialog";

describe("SettingsDialog hooks", () => {
  it("displays hooks section with all four hook types", async () => {
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

    // Verify hooks section header is displayed
    expect(frame).toContain("Hooks");

    // Verify all 4 hook types are displayed
    expect(frame).toContain("post-create:");
    expect(frame).toContain("post-select:");
    expect(frame).toContain("post-delete:");
    expect(frame).toContain("post-rename:");
  });

  it("displays navigation help text", async () => {
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
