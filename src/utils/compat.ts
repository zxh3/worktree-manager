/**
 * Runtime compatibility layer for Bun and Node.js
 *
 * Provides unified APIs that work in both runtimes.
 */

import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Detect if running in Bun */
export const isBun = typeof globalThis.Bun !== "undefined";

/**
 * Read a file as text
 */
export async function readFileText(path: string): Promise<string> {
  if (isBun) {
    const file = Bun.file(path);
    return file.text();
  }
  return readFile(path, "utf-8");
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  if (isBun) {
    const file = Bun.file(path);
    return file.exists();
  }
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write content to a file
 */
export async function writeFileText(
  path: string,
  content: string,
): Promise<void> {
  if (isBun) {
    await Bun.write(path, content);
    return;
  }
  // Ensure directory exists
  const dir = dirname(path);
  await mkdir(dir, { recursive: true }).catch(() => {});
  await writeFile(path, content, "utf-8");
}

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command and return the result
 */
export async function execCommand(
  command: string[],
  options?: { cwd?: string },
): Promise<ExecResult> {
  if (isBun) {
    const proc = Bun.spawn(command, {
      cwd: options?.cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const exitCode = await proc.exited;

    return {
      success: exitCode === 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
    };
  }

  // Node.js implementation
  return new Promise((resolve) => {
    const [cmd, ...args] = command;
    const proc = spawn(cmd, args, {
      cwd: options?.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      const exitCode = code ?? 1;
      resolve({
        success: exitCode === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        stdout: "",
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}
