#!/usr/bin/env node
/**
 * Adds Node.js shebang to the built CLI file
 */

import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "dist", "cli.js");

const shebang = "#!/usr/bin/env node\n";
const content = readFileSync(cliPath, "utf-8");

// Only add shebang if not already present
if (!content.startsWith("#!")) {
  writeFileSync(cliPath, shebang + content);
  console.log("Added shebang to dist/cli.js");
}

// Make executable
chmodSync(cliPath, 0o755);
console.log("Made dist/cli.js executable");
