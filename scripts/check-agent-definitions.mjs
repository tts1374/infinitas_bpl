import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const agentsDir = path.join(repoRoot, ".codex", "agents");
const kebabNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {string} targetPath
 * @returns {string}
 */
function readUtf8(targetPath) {
  return readFileSync(targetPath, "utf8");
}

/**
 * @param {string} text
 * @returns {string | null}
 */
function extractTomlName(text) {
  const match = text.match(/^\s*name\s*=\s*"([^"\r\n]+)"\s*$/m);
  return match === null ? null : match[1];
}

/**
 * @param {string} input
 * @returns {string}
 */
function toPosix(input) {
  return input.replace(/\\/g, "/");
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const failures = [];
const tomlFiles = readdirSync(agentsDir)
  .filter((entry) => entry.endsWith(".toml"))
  .sort((left, right) => left.localeCompare(right));

if (tomlFiles.length === 0) {
  failures.push(".codex/agents: no TOML agent definitions found");
}

const discoveredNames = [];
const seenNames = new Set();

for (const fileName of tomlFiles) {
  const tomlPath = path.join(agentsDir, fileName);
  const tomlText = readUtf8(tomlPath);
  const relativeToml = toPosix(path.relative(repoRoot, tomlPath));
  const tomlName = extractTomlName(tomlText);
  const baseName = path.basename(fileName, ".toml");

  if (tomlName === null) {
    failures.push(`${relativeToml}: missing top-level name`);
    continue;
  }

  discoveredNames.push(tomlName);
  if (seenNames.has(tomlName)) {
    failures.push(`${relativeToml}: duplicated name "${tomlName}"`);
  }
  seenNames.add(tomlName);

  if (!kebabNamePattern.test(tomlName)) {
    failures.push(`${relativeToml}: name "${tomlName}" must be kebab-case`);
  }

  if (tomlName !== baseName) {
    failures.push(`${relativeToml}: name "${tomlName}" must match filename base "${baseName}"`);
  }

}

const filesToScan = [
  path.join(repoRoot, "WORKFLOW.md"),
  path.join(repoRoot, "AGENTS.md"),
  ...readdirSync(agentsDir).map((entry) => path.join(agentsDir, entry)),
];

for (const kebabName of discoveredNames) {
  const snakeAlias = kebabName.replace(/-/g, "_");
  const aliasPattern = new RegExp(`\\b${escapeRegex(snakeAlias)}\\b`, "g");

  for (const filePath of filesToScan) {
    const text = readUtf8(filePath);
    const relativePath = toPosix(path.relative(repoRoot, filePath));
    if (aliasPattern.test(text)) {
      failures.push(`${relativePath}: snake_case alias "${snakeAlias}" is not allowed`);
      aliasPattern.lastIndex = 0;
    }
  }
}

if (failures.length > 0) {
  console.error("Agent definition check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Agent definition check passed. (${discoveredNames.length} agents)`);
