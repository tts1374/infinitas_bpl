#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const VERSION_TARGETS = [
  { filePath: "package.json", kind: "json", label: "version field" },
  { filePath: "packages/shared/package.json", kind: "json", label: "version field" },
  { filePath: "apps/client/package.json", kind: "json", label: "version field" },
  { filePath: "apps/worker/package.json", kind: "json", label: "version field" },
  { filePath: "apps/update-worker/package.json", kind: "json", label: "version field" },
  { filePath: "apps/client/src-tauri/tauri.conf.json", kind: "json", label: "version field" },
  {
    filePath: "apps/client/src-tauri/Cargo.toml",
    kind: "pattern",
    label: "Cargo package version",
    pattern: /(^\[package\]\n(?:.*\n)*?^version = ")([^"]+)(")/m,
  },
];

const MIN_SUPPORTED_TARGETS = [
  {
    filePath: "apps/worker/wrangler.toml",
    kind: "pattern",
    label: "MIN_SUPPORTED_CLIENT_VERSION",
    pattern: /(^MIN_SUPPORTED_CLIENT_VERSION = ")([^"]+)(")/m,
  },
  {
    filePath: "apps/worker/src/durable/room-object.ts",
    kind: "pattern",
    label: "DEFAULT_MIN_SUPPORTED_CLIENT_VERSION",
    pattern: /(^const DEFAULT_MIN_SUPPORTED_CLIENT_VERSION = ")([^"]+)(";)/m,
  },
  {
    filePath: "apps/worker/src/durable/room-object.test.mjs",
    kind: "pattern",
    label: "test ROOM_JOIN client_version",
    pattern: /(^\s*client_version: ")([^"]+)(",\s*$)/m,
  },
  {
    filePath: "docs/design/07_constants.md",
    kind: "pattern",
    label: "design MIN_SUPPORTED_CLIENT_VERSION",
    pattern: /(^- `MIN_SUPPORTED_CLIENT_VERSION = ")([^"]+)("`$)/m,
  },
];

function printUsage() {
  const usageText = [
    "Usage:",
    "  npm run version:bump -- <version> [--bump-min-supported] [--dry-run]",
    "",
    "Examples:",
    "  npm run version:bump -- 1.2.0",
    "  npm run version:bump -- 1.2.0 --bump-min-supported",
    "  npm run version:bump -- 1.2.0 --bump-min-supported --dry-run",
  ];
  console.log(usageText.join("\n"));
}

function normalizeLf(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function removeUtf8Bom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function updateJsonVersion(content, filePath, nextVersion) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`[${filePath}] Failed to parse JSON: ${String(error)}`);
  }

  if (typeof parsed.version !== "string") {
    throw new Error(`[${filePath}] Missing string "version" field.`);
  }

  const previousVersion = parsed.version;
  parsed.version = nextVersion;
  const nextContent = `${JSON.stringify(parsed, null, 2)}\n`;
  return { nextContent, previousVersion };
}

function updateVersionByPattern(content, target, nextVersion) {
  let matchCount = 0;
  let previousVersion = null;

  const nextContent = content.replace(target.pattern, (_match, prefix, current, suffix) => {
    matchCount += 1;
    previousVersion = current;
    return `${prefix}${nextVersion}${suffix}`;
  });

  if (matchCount !== 1) {
    throw new Error(
      `[${target.filePath}] Expected exactly one "${target.label}" match, but found ${matchCount}.`,
    );
  }

  if (previousVersion === null) {
    throw new Error(`[${target.filePath}] Could not capture the previous version.`);
  }

  return { nextContent, previousVersion };
}

function parseArgs(args) {
  let nextVersion = null;
  let bumpMinSupported = false;
  let dryRun = false;

  for (const arg of args) {
    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--bump-min-supported" || arg === "--bump-min-supported-client-version") {
      bumpMinSupported = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (nextVersion !== null) {
      throw new Error(`Multiple version values were provided: "${nextVersion}" and "${arg}".`);
    }
    nextVersion = arg;
  }

  if (nextVersion === null) {
    throw new Error("Version is required.");
  }

  if (!SEMVER_PATTERN.test(nextVersion)) {
    throw new Error(`Invalid version "${nextVersion}". Expected format: x.y.z`);
  }

  return {
    nextVersion,
    bumpMinSupported,
    dryRun,
  };
}

async function applyTarget(rootDir, target, nextVersion, dryRun) {
  const absolutePath = path.resolve(rootDir, target.filePath);
  const rawContent = await fs.readFile(absolutePath, "utf8");
  const normalizedContent = normalizeLf(removeUtf8Bom(rawContent));

  const { nextContent, previousVersion } =
    target.kind === "json"
      ? updateJsonVersion(normalizedContent, target.filePath, nextVersion)
      : updateVersionByPattern(normalizedContent, target, nextVersion);

  const changed = nextContent !== normalizedContent;
  if (changed && !dryRun) {
    await fs.writeFile(absolutePath, nextContent, { encoding: "utf8" });
  }

  return {
    filePath: target.filePath,
    previousVersion,
    nextVersion,
    changed,
  };
}

async function main() {
  const { nextVersion, bumpMinSupported, dryRun } = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const targets = bumpMinSupported
    ? [...VERSION_TARGETS, ...MIN_SUPPORTED_TARGETS]
    : [...VERSION_TARGETS];

  const updates = [];
  for (const target of targets) {
    const result = await applyTarget(rootDir, target, nextVersion, dryRun);
    updates.push(result);
  }

  const changedUpdates = updates.filter((update) => update.changed);
  if (changedUpdates.length === 0) {
    console.log("[info] No files changed.");
    return;
  }

  for (const update of changedUpdates) {
    console.log(`[update] ${update.filePath}: ${update.previousVersion} -> ${update.nextVersion}`);
  }

  if (dryRun) {
    console.log(`[dry-run] ${changedUpdates.length} file(s) would be updated.`);
    return;
  }

  console.log(`[done] Updated ${changedUpdates.length} file(s).`);
}

main().catch((error) => {
  console.error(`[error] ${error instanceof Error ? error.message : String(error)}`);
  printUsage();
  process.exit(1);
});
