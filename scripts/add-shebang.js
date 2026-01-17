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
let content = readFileSync(cliPath, "utf-8");

// Replace any existing shebang (bun adds #!/usr/bin/env bun)
if (content.startsWith("#!")) {
  content = content.replace(/^#!.*\n/, "");
}
writeFileSync(cliPath, shebang + content);
console.log("Set shebang to node in dist/cli.js");

// Make executable
chmodSync(cliPath, 0o755);
console.log("Made dist/cli.js executable");
