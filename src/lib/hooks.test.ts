/**
 * Unit tests for hooks module
 */

import { describe, expect, test } from "bun:test";
import { normalizeHookConfig } from "./hooks";

describe("normalizeHookConfig", () => {
  test("returns null for undefined config", () => {
    const result = normalizeHookConfig(undefined);
    expect(result).toBeNull();
  });

  test("normalizes string format", () => {
    const result = normalizeHookConfig("npm install");

    expect(result).not.toBeNull();
    expect(result?.commands).toEqual(["npm install"]);
    expect(result?.timeout).toBe(30);
    expect(result?.continueOnError).toBe(false);
  });

  test("normalizes array format", () => {
    const result = normalizeHookConfig(["npm install", "npm run build"]);

    expect(result).not.toBeNull();
    expect(result?.commands).toEqual(["npm install", "npm run build"]);
    expect(result?.timeout).toBe(30);
    expect(result?.continueOnError).toBe(false);
  });

  test("normalizes object format with string commands", () => {
    const result = normalizeHookConfig({
      commands: "npm install",
      timeout: 60,
      continueOnError: true,
    });

    expect(result).not.toBeNull();
    expect(result?.commands).toEqual(["npm install"]);
    expect(result?.timeout).toBe(60);
    expect(result?.continueOnError).toBe(true);
  });

  test("normalizes object format with array commands", () => {
    const result = normalizeHookConfig({
      commands: ["npm install", "npm run build"],
      timeout: 120,
    });

    expect(result).not.toBeNull();
    expect(result?.commands).toEqual(["npm install", "npm run build"]);
    expect(result?.timeout).toBe(120);
    expect(result?.continueOnError).toBe(false);
  });

  test("uses defaults for missing object fields", () => {
    const result = normalizeHookConfig({
      commands: "echo test",
    });

    expect(result).not.toBeNull();
    expect(result?.timeout).toBe(30);
    expect(result?.continueOnError).toBe(false);
  });
});
