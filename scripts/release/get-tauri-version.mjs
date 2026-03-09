import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = resolve("apps/client/src-tauri/tauri.conf.json");
const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

let config;

try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to read ${configPath}: ${message}`);
  process.exit(1);
}

const rawVersion = typeof config.version === "string" ? config.version.trim() : "";
const normalizedVersion = rawVersion.startsWith("v") ? rawVersion.slice(1) : rawVersion;

if (normalizedVersion.length === 0) {
  console.error(`Missing "version" in ${configPath}.`);
  process.exit(1);
}

if (!semverPattern.test(normalizedVersion)) {
  console.error(
    `Version "${normalizedVersion}" from ${configPath} is not valid semver.`,
  );
  process.exit(1);
}

process.stdout.write(`${normalizedVersion}\n`);
