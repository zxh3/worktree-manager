/**
 * Shared column width definitions for consistent alignment
 */

export const COLUMNS = {
  cursor: 2, // "> " or "  "
  icon: 2, // "● " or "○ "
  name: 20, // includes space for " *" primary indicator
  path: 32,
  age: 4,
  status: 8,
} as const;

// Gap between columns
export const GAP = 2;

/**
 * Format a row with consistent column widths
 */
export function formatRow(parts: {
  cursor: string;
  icon: string;
  name: string;
  path: string;
  age: string;
  status: string;
  suffix?: string;
}): string {
  const { cursor, icon, name, path, age, status, suffix = "" } = parts;

  return [
    cursor.padEnd(COLUMNS.cursor),
    icon.padEnd(COLUMNS.icon),
    name.padEnd(COLUMNS.name),
    path.padEnd(COLUMNS.path),
    age.padEnd(COLUMNS.age),
    status.padEnd(COLUMNS.status),
    suffix,
  ].join("");
}

/**
 * Format the header row
 */
export function formatHeader(): string {
  return formatRow({
    cursor: "",
    icon: "",
    name: "name",
    path: "path",
    age: "age",
    status: "status",
  });
}
