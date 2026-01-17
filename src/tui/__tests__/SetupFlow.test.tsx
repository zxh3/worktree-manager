/**
 * Tests for SetupFlow component
 */

import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { SetupFlow } from "../components/SetupFlow";

describe("SetupFlow", () => {
  test("renders setup title", () => {
    const { lastFrame } = render(
      <SetupFlow onComplete={() => {}} onQuit={() => {}} />,
    );

    expect(lastFrame()).toContain("Shell Integration Setup");
  });

  test("shows explanation of shell integration", () => {
    const { lastFrame } = render(
      <SetupFlow onComplete={() => {}} onQuit={() => {}} />,
    );

    expect(lastFrame()).toContain("cd");
    expect(lastFrame()).toContain("worktrees");
  });

  test("shows detected shell", () => {
    const { lastFrame } = render(
      <SetupFlow onComplete={() => {}} onQuit={() => {}} />,
    );

    expect(lastFrame()).toContain("Detected shell:");
  });

  test("shows keyboard options", () => {
    const { lastFrame } = render(
      <SetupFlow onComplete={() => {}} onQuit={() => {}} />,
    );

    const frame = lastFrame();
    expect(frame).toContain("y");
    expect(frame).toContain("Set up now");
    expect(frame).toContain("s");
    expect(frame).toContain("Skip");
    expect(frame).toContain("n");
    expect(frame).toContain("Don't ask again");
  });

  test("shows the shell-init command", () => {
    const { lastFrame } = render(
      <SetupFlow onComplete={() => {}} onQuit={() => {}} />,
    );

    expect(lastFrame()).toContain("wt shell-init");
  });

  test("has rounded border", () => {
    const { lastFrame } = render(
      <SetupFlow onComplete={() => {}} onQuit={() => {}} />,
    );

    expect(lastFrame()).toContain("╭");
    expect(lastFrame()).toContain("╯");
  });
});
