/**
 * Version information - reads from package.json
 */

// Import package.json at build time
import packageJson from "../../package.json";

export const VERSION = packageJson.version;
