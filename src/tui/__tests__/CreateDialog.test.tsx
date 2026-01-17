/**
 * Tests for CreateDialog component
 */

import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { CreateDialog } from "../components/CreateDialog";

describe("CreateDialog", () => {
  test("renders dialog title", () => {
    const { lastFrame } = render(
      <CreateDialog onClose={() => {}} onCreated={() => {}} />,
    );

    expect(lastFrame()).toContain("Create New Worktree");
  });

  test("renders name input label", () => {
    const { lastFrame } = render(
      <CreateDialog onClose={() => {}} onCreated={() => {}} />,
    );

    expect(lastFrame()).toContain("Name:");
  });

  test("renders help text", () => {
    const { lastFrame } = render(
      <CreateDialog onClose={() => {}} onCreated={() => {}} />,
    );

    expect(lastFrame()).toContain("Enter to create");
    expect(lastFrame()).toContain("Esc to cancel");
  });

  test("renders cursor indicator", () => {
    const { lastFrame } = render(
      <CreateDialog onClose={() => {}} onCreated={() => {}} />,
    );

    // Should have a cursor block
    expect(lastFrame()).toContain("█");
  });

  test("has rounded border style", () => {
    const { lastFrame } = render(
      <CreateDialog onClose={() => {}} onCreated={() => {}} />,
    );

    // Rounded borders use ╭ and ╮
    expect(lastFrame()).toContain("╭");
    expect(lastFrame()).toContain("╯");
  });
});
