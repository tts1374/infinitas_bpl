#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const VERSION_TARGET_FILES = [
  "package.json",
  "packages/shared/package.json",
  "apps/client/package.json",
  "apps/worker/package.json",
  "apps/update-worker/package.json",
  "apps/client/src-tauri/tauri.conf.json",
  "apps/client/src-tauri/Cargo.toml",
];

const MIN_SUPPORTED_TARGET_FILES = [
  "apps/worker/wrangler.toml",
  "apps/worker/src/durable/room-object.ts",
  "apps/worker/src/durable/room-object.test.mjs",
  "docs/design/07_constants.md",
];

const MIN_SUPPORTED_DECISION_PATTERNS = [
  /^apps\/worker\/src\/durable\/room-object(?:\.ts|\.test\.mjs)?$/,
  /^apps\/worker\/src\/routes\/join(?:\.ts|\.test\.mjs)?$/,
  /^packages\/shared\//,
  /^docs\/design\/02_ws_protocol\.md$/,
  /^docs\/design\/07_constants\.md$/,
];

const DEPLOY_MODES = new Set(["auto", "force", "skip"]);

function printUsage() {
  const usage = [
    "Usage:",
    "  node scripts/release/phase-d-release.mjs --version <x.y.z> [options]",
    "",
    "Required:",
    "  --version <x.y.z>                  Release version (semantic version)",
    "",
    "Core options:",
    "  --from-ref <ref>                   Diff base ref for update detection (default: latest tag)",
    "  --base-branch <name>               Expected branch (default: v1)",
    "  --bump-min-supported               Run version:bump with --bump-min-supported",
    "  --no-bump-min-supported            Explicitly keep MIN_SUPPORTED_CLIENT_VERSION unchanged",
    "  --push / --no-push                 Push version bump commit (default: push)",
    "  --remote <name>                    Push remote (default: origin)",
    "",
    "Deploy dispatch modes:",
    "  --force-worker-deploy | --skip-worker-deploy",
    "  --force-web-deploy    | --skip-web-deploy",
    "  --force-desktop-release | --skip-desktop-release",
    "  (default for each: auto, detected from git diff)",
    "",
    "Workflow and release options:",
    "  --wait-workflows / --no-wait-workflows       Wait for workflow completion (default: wait)",
    "  --timeout-minutes <n>                         Workflow wait timeout minutes (default: 90)",
    "  --update-release-notes / --no-update-release-notes (default: update)",
    "  --download-url <url>                          Explicit Windows download URL for release notes",
    "  --feature <text>                              New feature item (repeatable)",
    "  --fix <text>                                  Bug fix item (repeatable)",
    "  --other <text>                                Other change item (repeatable)",
    "  --note <text>                                 Notes item (repeatable)",
    "  --public-r2-base-url <url>                    Base URL used to build download URL",
    "  --create-release-if-missing                   Create GitHub release when tag does not exist",
    "",
    "Safety and dry-run:",
    "  --allow-dirty                    Allow running with uncommitted changes",
    "  --allow-non-base-branch          Allow running outside expected base branch",
    "  --dry-run                        Print actions without mutating git/GitHub",
    "  -h, --help                       Show this help",
  ];

  console.log(usage.join("\n"));
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function needsCmdProxy(command) {
  return process.platform === "win32" && (command === "npm" || command === "npx");
}

/**
 * @param {string} value
 * @returns {string}
 */
function quoteForCmd(value) {
  if (value === "") {
    return "\"\"";
  }
  if (/[\s"&<>|^()]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

/**
 * @param {string} value
 * @returns {string}
 */
function trimTrailingSlash(value) {
  return value.replace(/\/+$/g, "");
}

/**
 * @param {string} mode
 * @returns {asserts mode is "auto" | "force" | "skip"}
 */
function assertDeployMode(mode) {
  if (!DEPLOY_MODES.has(mode)) {
    throw new Error(`Invalid deploy mode "${mode}".`);
  }
}

/**
 * @param {string} name
 * @param {"auto" | "force" | "skip"} currentMode
 * @param {"force" | "skip"} requestedMode
 * @returns {"auto" | "force" | "skip"}
 */
function mergeDeployMode(name, currentMode, requestedMode) {
  if (currentMode !== "auto" && currentMode !== requestedMode) {
    throw new Error(`Conflicting ${name} mode flags were provided.`);
  }
  return requestedMode;
}

/**
 * @param {string[]} args
 */
function parseArgs(args) {
  /** @type {{
   *   version: string | null;
   *   fromRef: string | null;
   *   baseBranch: string;
   *   bumpMinSupported: boolean | null;
   *   workerMode: "auto" | "force" | "skip";
   *   webMode: "auto" | "force" | "skip";
   *   desktopMode: "auto" | "force" | "skip";
   *   push: boolean;
   *   remote: string;
   *   waitWorkflows: boolean;
   *   timeoutMinutes: number;
   *   updateReleaseNotes: boolean;
   *   downloadUrl: string | null;
   *   featureItems: string[];
   *   fixItems: string[];
   *   otherItems: string[];
   *   noteItems: string[];
   *   publicR2BaseUrl: string | null;
   *   createReleaseIfMissing: boolean;
   *   allowDirty: boolean;
   *   allowNonBaseBranch: boolean;
   *   dryRun: boolean;
   * }} */
  const options = {
    version: null,
    fromRef: null,
    baseBranch: "v1",
    bumpMinSupported: null,
    workerMode: "auto",
    webMode: "auto",
    desktopMode: "auto",
    push: true,
    remote: "origin",
    waitWorkflows: true,
    timeoutMinutes: 90,
    updateReleaseNotes: true,
    downloadUrl: null,
    featureItems: [],
    fixItems: [],
    otherItems: [],
    noteItems: [],
    publicR2BaseUrl: null,
    createReleaseIfMissing: false,
    allowDirty: false,
    allowNonBaseBranch: false,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--version") {
      options.version = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--from-ref") {
      options.fromRef = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--base-branch") {
      options.baseBranch = args[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--remote") {
      options.remote = args[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--timeout-minutes") {
      const raw = args[index + 1] ?? "";
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--timeout-minutes must be a positive integer. Received "${raw}".`);
      }
      options.timeoutMinutes = parsed;
      index += 1;
      continue;
    }

    if (arg === "--download-url") {
      options.downloadUrl = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--feature") {
      const item = args[index + 1] ?? "";
      if (item.trim() === "") {
        throw new Error("--feature requires a non-empty value.");
      }
      options.featureItems.push(item.trim());
      index += 1;
      continue;
    }

    if (arg === "--fix") {
      const item = args[index + 1] ?? "";
      if (item.trim() === "") {
        throw new Error("--fix requires a non-empty value.");
      }
      options.fixItems.push(item.trim());
      index += 1;
      continue;
    }

    if (arg === "--other") {
      const item = args[index + 1] ?? "";
      if (item.trim() === "") {
        throw new Error("--other requires a non-empty value.");
      }
      options.otherItems.push(item.trim());
      index += 1;
      continue;
    }

    if (arg === "--note") {
      const item = args[index + 1] ?? "";
      if (item.trim() === "") {
        throw new Error("--note requires a non-empty value.");
      }
      options.noteItems.push(item.trim());
      index += 1;
      continue;
    }

    if (arg === "--public-r2-base-url") {
      options.publicR2BaseUrl = args[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--bump-min-supported") {
      if (options.bumpMinSupported === false) {
        throw new Error("Conflicting MIN_SUPPORTED_CLIENT_VERSION flags were provided.");
      }
      options.bumpMinSupported = true;
      continue;
    }

    if (arg === "--no-bump-min-supported") {
      if (options.bumpMinSupported === true) {
        throw new Error("Conflicting MIN_SUPPORTED_CLIENT_VERSION flags were provided.");
      }
      options.bumpMinSupported = false;
      continue;
    }

    if (arg === "--force-worker-deploy") {
      options.workerMode = mergeDeployMode("worker deploy", options.workerMode, "force");
      continue;
    }

    if (arg === "--skip-worker-deploy") {
      options.workerMode = mergeDeployMode("worker deploy", options.workerMode, "skip");
      continue;
    }

    if (arg === "--force-web-deploy") {
      options.webMode = mergeDeployMode("web deploy", options.webMode, "force");
      continue;
    }

    if (arg === "--skip-web-deploy") {
      options.webMode = mergeDeployMode("web deploy", options.webMode, "skip");
      continue;
    }

    if (arg === "--force-desktop-release") {
      options.desktopMode = mergeDeployMode("desktop release", options.desktopMode, "force");
      continue;
    }

    if (arg === "--skip-desktop-release") {
      options.desktopMode = mergeDeployMode("desktop release", options.desktopMode, "skip");
      continue;
    }

    if (arg === "--push") {
      options.push = true;
      continue;
    }

    if (arg === "--no-push") {
      options.push = false;
      continue;
    }

    if (arg === "--wait-workflows") {
      options.waitWorkflows = true;
      continue;
    }

    if (arg === "--no-wait-workflows") {
      options.waitWorkflows = false;
      continue;
    }

    if (arg === "--update-release-notes") {
      options.updateReleaseNotes = true;
      continue;
    }

    if (arg === "--no-update-release-notes") {
      options.updateReleaseNotes = false;
      continue;
    }

    if (arg === "--create-release-if-missing") {
      options.createReleaseIfMissing = true;
      continue;
    }

    if (arg === "--allow-dirty") {
      options.allowDirty = true;
      continue;
    }

    if (arg === "--allow-non-base-branch") {
      options.allowNonBaseBranch = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (options.version !== null) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    options.version = arg;
  }

  if (options.version === null || !SEMVER_PATTERN.test(options.version)) {
    throw new Error("A valid semantic version is required. Example: --version 1.2.0");
  }

  if (options.fromRef !== null && options.fromRef.trim() === "") {
    throw new Error("--from-ref cannot be empty.");
  }

  if (options.baseBranch.trim() === "") {
    throw new Error("--base-branch cannot be empty.");
  }

  if (options.remote.trim() === "") {
    throw new Error("--remote cannot be empty.");
  }

  if (options.downloadUrl !== null && options.downloadUrl.trim() === "") {
    throw new Error("--download-url cannot be empty.");
  }

  if (options.publicR2BaseUrl !== null && options.publicR2BaseUrl.trim() === "") {
    throw new Error("--public-r2-base-url cannot be empty.");
  }

  assertDeployMode(options.workerMode);
  assertDeployMode(options.webMode);
  assertDeployMode(options.desktopMode);

  return options;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{
 *   cwd?: string;
 *   capture?: boolean;
 *   allowFailure?: boolean;
 *   timeoutMs?: number;
 * }} [options]
 */
function runCommand(command, args, options = {}) {
  const spawnOptions = {
    cwd: options.cwd ?? process.cwd(),
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
    shell: false,
    timeout: options.timeoutMs,
  };
  const result = needsCmdProxy(command)
    ? spawnSync(
        "cmd.exe",
        ["/d", "/s", "/c", [command, ...args].map((entry) => quoteForCmd(entry)).join(" ")],
        spawnOptions,
      )
    : spawnSync(command, args, spawnOptions);

  if (result.error !== undefined) {
    throw result.error;
  }

  if (!options.allowFailure && result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    const suffix = stderr === "" ? "" : `\n${stderr}`;
    throw new Error(`Command failed (${command} ${args.join(" ")}): exit ${result.status}.${suffix}`);
  }

  return result;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {string}
 */
function runCapture(command, args) {
  const result = runCommand(command, args, { capture: true });
  return (result.stdout ?? "").trim();
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {unknown}
 */
function runJson(command, args) {
  const raw = runCapture(command, args);
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON from command "${command} ${args.join(" ")}": ${message}`);
  }
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ensureTooling() {
  runCommand("git", ["--version"], { capture: true });
  runCommand("npm", ["--version"], { capture: true });
  runCommand("gh", ["--version"], { capture: true });
}

function ensureGitStatus(allowDirty) {
  if (allowDirty) {
    return;
  }
  const status = runCapture("git", ["status", "--porcelain"]);
  if (status !== "") {
    throw new Error(
      "Working tree is not clean. Commit/stash local changes or rerun with --allow-dirty if intentional.",
    );
  }
}

function getCurrentBranch() {
  return runCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

/**
 * @param {string} ref
 * @returns {boolean}
 */
function gitRefExists(ref) {
  const result = runCommand("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
    capture: true,
    allowFailure: true,
  });
  return result.status === 0;
}

function resolveFromRef(explicitFromRef) {
  if (explicitFromRef !== null) {
    if (!gitRefExists(explicitFromRef)) {
      throw new Error(`--from-ref "${explicitFromRef}" does not resolve to a commit.`);
    }
    return explicitFromRef;
  }

  const result = runCommand("git", ["describe", "--tags", "--abbrev=0"], {
    capture: true,
    allowFailure: true,
  });
  if (result.status === 0) {
    const tag = (result.stdout ?? "").trim();
    if (tag !== "") {
      return tag;
    }
  }

  throw new Error(
    "Could not resolve latest tag. Provide an explicit diff base with --from-ref <ref>.",
  );
}

/**
 * @param {string[]} changedFiles
 */
function detectTargetUpdates(changedFiles) {
  const hasShared = changedFiles.some((filePath) => filePath.startsWith("packages/shared/"));
  const hasWorkerDirect = changedFiles.some((filePath) => filePath.startsWith("apps/worker/"));
  const hasWebDirect = changedFiles.some((filePath) => filePath.startsWith("apps/web/"));
  const hasClientDirect = changedFiles.some((filePath) => filePath.startsWith("apps/client/"));

  return {
    worker: hasWorkerDirect || hasShared,
    web: hasWebDirect,
    client: hasClientDirect || hasShared,
    hasShared,
  };
}

/**
 * @param {string[]} changedFiles
 */
function detectMinSupportedDecision(changedFiles) {
  const evidence = changedFiles.filter((filePath) =>
    MIN_SUPPORTED_DECISION_PATTERNS.some((pattern) => pattern.test(filePath)),
  );
  return {
    decisionRequired: evidence.length > 0,
    evidence,
  };
}

/**
 * @param {"auto" | "force" | "skip"} mode
 * @param {boolean} autoDetected
 * @returns {boolean}
 */
function resolveTargetRun(mode, autoDetected) {
  if (mode === "force") {
    return true;
  }
  if (mode === "skip") {
    return false;
  }
  return autoDetected;
}

/**
 * @param {string} fromRef
 * @returns {string[]}
 */
function getChangedFiles(fromRef) {
  const raw = runCapture("git", ["diff", "--name-only", `${fromRef}..HEAD`]);
  if (raw === "") {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .sort((left, right) => left.localeCompare(right));
}

/**
 * @param {string} version
 * @param {boolean} bumpMinSupported
 * @param {boolean} dryRun
 */
function runVersionBump(version, bumpMinSupported, dryRun) {
  const args = ["run", "version:bump", "--", version];
  if (bumpMinSupported) {
    args.push("--bump-min-supported");
  }
  if (dryRun) {
    args.push("--dry-run");
  }
  runCommand("npm", args);
}

/**
 * @param {boolean} includeMinSupportedTargets
 */
function stageVersionFiles(includeMinSupportedTargets) {
  const files = includeMinSupportedTargets
    ? [...VERSION_TARGET_FILES, ...MIN_SUPPORTED_TARGET_FILES]
    : [...VERSION_TARGET_FILES];
  runCommand("git", ["add", "--", ...files]);
}

function hasStagedChanges() {
  const result = runCommand("git", ["diff", "--cached", "--quiet"], {
    allowFailure: true,
    capture: true,
  });
  return result.status !== 0;
}

/**
 * @param {string} workflowName
 * @param {string} branch
 */
function dispatchWorkflow(workflowName, branch) {
  runCommand("gh", ["workflow", "run", workflowName, "--ref", branch]);
}

/**
 * @param {string} workflowName
 * @param {string} branch
 * @param {number} startedAtMs
 * @param {number} timeoutMs
 * @returns {Promise<number>}
 */
async function findWorkflowRunId(workflowName, branch, startedAtMs, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const earliestAllowed = startedAtMs - 120_000;

  while (Date.now() < deadline) {
    const runs = /** @type {Array<{
     *   databaseId: number;
     *   createdAt: string;
     *   headBranch: string;
     * }>} */ (
      runJson("gh", [
        "run",
        "list",
        "--workflow",
        workflowName,
        "--branch",
        branch,
        "--event",
        "workflow_dispatch",
        "--limit",
        "20",
        "--json",
        "databaseId,createdAt,headBranch",
      ])
    );

    const candidates = runs
      .filter((run) => run.headBranch === branch)
      .filter((run) => {
        const createdAtMs = Number.parseInt(String(Date.parse(run.createdAt)), 10);
        return Number.isFinite(createdAtMs) && createdAtMs >= earliestAllowed;
      })
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

    if (candidates.length > 0) {
      return candidates[0].databaseId;
    }

    await sleep(5_000);
  }

  throw new Error(
    `Timed out while waiting for workflow run to appear: "${workflowName}" on branch "${branch}".`,
  );
}

/**
 * @param {string} workflowName
 * @param {string} branch
 * @param {number} timeoutMinutes
 * @returns {Promise<void>}
 */
async function dispatchAndWatchWorkflow(workflowName, branch, timeoutMinutes) {
  const startedAtMs = Date.now();
  dispatchWorkflow(workflowName, branch);
  const runId = await findWorkflowRunId(workflowName, branch, startedAtMs, 180_000);
  const timeoutMs = timeoutMinutes * 60_000;
  runCommand("gh", ["run", "watch", String(runId), "--exit-status"], {
    allowFailure: false,
    timeoutMs,
  });
}

/**
 * @param {string} body
 * @returns {string | null}
 */
function parseWindowsDownloadUrl(body) {
  const match = body.match(/^- Windows \(windows-x86_64\):\s*(\S+)\s*$/m);
  if (match === null) {
    return null;
  }
  const candidate = match[1].trim();
  return candidate === "" ? null : candidate;
}

/**
 * @param {string[]} items
 * @returns {string[]}
 */
function toBulletLines(items) {
  if (items.length === 0) {
    return ["- "];
  }
  return items.map((item) => `- ${item}`);
}

/**
 * @param {string} downloadUrl
 * @param {{
 *   featureItems: string[];
 *   fixItems: string[];
 *   otherItems: string[];
 *   noteItems: string[];
 * }} sections
 * @returns {string}
 */
function buildReleaseNoteTemplate(downloadUrl, sections) {
  const renderedDownloadUrl = downloadUrl.trim() === "" ? "" : downloadUrl.trim();
  const featureLines = toBulletLines(sections.featureItems);
  const fixLines = toBulletLines(sections.fixItems);
  const otherLines = toBulletLines(sections.otherItems);
  const noteLines = toBulletLines(sections.noteItems);

  return [
    "## Download URL",
    "",
    `- Windows (windows-x86_64): ${renderedDownloadUrl}`,
    "",
    "## 変更点",
    "",
    "### 新機能",
    "",
    ...featureLines,
    "",
    "### 不具合修正",
    "",
    ...fixLines,
    "",
    "### その他",
    "",
    ...otherLines,
    "",
    "### Notes",
    "",
    ...noteLines,
    "",
  ].join("\n");
}

/**
 * @param {string} tagName
 * @returns {{ exists: boolean; body: string; url: string | null; }}
 */
function getReleaseState(tagName) {
  const result = runCommand(
    "gh",
    ["release", "view", tagName, "--json", "body,url"],
    { capture: true, allowFailure: true },
  );
  if (result.status !== 0) {
    return {
      exists: false,
      body: "",
      url: null,
    };
  }

  const parsed = /** @type {{ body?: string; url?: string }} */ (JSON.parse(result.stdout ?? "{}"));
  return {
    exists: true,
    body: typeof parsed.body === "string" ? parsed.body : "",
    url: typeof parsed.url === "string" ? parsed.url : null,
  };
}

/**
 * @param {{
 *   version: string;
 *   tagName: string;
 *   title: string;
 *   downloadUrl: string;
 *   featureItems: string[];
 *   fixItems: string[];
 *   otherItems: string[];
 *   noteItems: string[];
 *   createReleaseIfMissing: boolean;
 *   dryRun: boolean;
 * }} params
 */
function updateReleaseNotes(params) {
  const releaseState = getReleaseState(params.tagName);
  const fallbackDownloadUrl = parseWindowsDownloadUrl(releaseState.body) ?? "";
  const finalDownloadUrl = params.downloadUrl.trim() !== "" ? params.downloadUrl : fallbackDownloadUrl;
  const noteBody = buildReleaseNoteTemplate(finalDownloadUrl, {
    featureItems: params.featureItems,
    fixItems: params.fixItems,
    otherItems: params.otherItems,
    noteItems: params.noteItems,
  });

  if (params.dryRun) {
    console.log(`[dry-run] release notes would be written to ${params.tagName}`);
    console.log(noteBody);
    return;
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "phase-d-release-notes-"));
  const notePath = path.join(tempDir, `v${params.version}-notes.md`);
  writeFileSync(notePath, noteBody, { encoding: "utf8" });

  try {
    if (releaseState.exists) {
      runCommand("gh", [
        "release",
        "edit",
        params.tagName,
        "--title",
        params.title,
        "--notes-file",
        notePath,
      ]);
      return;
    }

    if (!params.createReleaseIfMissing) {
      throw new Error(
        `Release "${params.tagName}" does not exist. Re-run with --create-release-if-missing if you intend to create it.`,
      );
    }

    runCommand("gh", [
      "release",
      "create",
      params.tagName,
      "--title",
      params.title,
      "--target",
      "HEAD",
      "--notes-file",
      notePath,
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * @param {{
 *   explicitDownloadUrl: string | null;
 *   publicR2BaseUrl: string | null;
 *   version: string;
 * }} params
 */
function resolveDownloadUrl(params) {
  if (params.explicitDownloadUrl !== null) {
    return params.explicitDownloadUrl.trim();
  }
  if (params.publicR2BaseUrl !== null) {
    return `${trimTrailingSlash(params.publicR2BaseUrl.trim())}/releases/${params.version}/windows-x86_64/app.msi`;
  }
  return "";
}

/**
 * @param {string} label
 * @param {boolean} value
 */
function printDecision(label, value) {
  console.log(`[decision] ${label}: ${value ? "yes" : "no"}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureTooling();
  ensureGitStatus(options.allowDirty);

  const currentBranch = getCurrentBranch();
  if (!options.allowNonBaseBranch && currentBranch !== options.baseBranch) {
    throw new Error(
      `Current branch is "${currentBranch}". Expected "${options.baseBranch}". Use --allow-non-base-branch to override.`,
    );
  }

  const fromRef = resolveFromRef(options.fromRef);
  const changedFiles = getChangedFiles(fromRef);
  const updates = detectTargetUpdates(changedFiles);
  const minSupported = detectMinSupportedDecision(changedFiles);

  let bumpMinSupported = options.bumpMinSupported;
  if (bumpMinSupported === null) {
    if (minSupported.decisionRequired) {
      const evidenceSummary = minSupported.evidence.map((entry) => `- ${entry}`).join("\n");
      throw new Error(
        [
          "MIN_SUPPORTED_CLIENT_VERSION decision is required for this diff.",
          "Use either --bump-min-supported or --no-bump-min-supported.",
          "Evidence:",
          evidenceSummary,
        ].join("\n"),
      );
    }
    bumpMinSupported = false;
  }

  const shouldRunWorkerDeploy = resolveTargetRun(options.workerMode, updates.worker);
  const shouldRunWebDeploy = resolveTargetRun(options.webMode, updates.web);
  const shouldRunDesktopRelease = resolveTargetRun(options.desktopMode, updates.client);

  console.log(`[info] current branch: ${currentBranch}`);
  console.log(`[info] diff base: ${fromRef}`);
  console.log(`[info] changed files in scope: ${changedFiles.length}`);
  printDecision("bump MIN_SUPPORTED_CLIENT_VERSION", bumpMinSupported);
  printDecision("run worker deploy workflow", shouldRunWorkerDeploy);
  printDecision("run web deploy workflow", shouldRunWebDeploy);
  printDecision("run desktop release workflow", shouldRunDesktopRelease);
  printDecision("update release notes", options.updateReleaseNotes);
  if (options.updateReleaseNotes) {
    console.log(
      `[info] release note items: feature=${options.featureItems.length}, fix=${options.fixItems.length}, other=${options.otherItems.length}, note=${options.noteItems.length}`,
    );
  }

  runVersionBump(options.version, bumpMinSupported, options.dryRun);

  if (!options.dryRun) {
    stageVersionFiles(bumpMinSupported);
    if (!hasStagedChanges()) {
      throw new Error("No staged changes found after version bump. Check target version and rerun.");
    }
    runCommand("git", ["commit", "-m", `chore(release): bump version to v${options.version}`]);
  }

  if (options.push) {
    if (options.dryRun) {
      console.log(`[dry-run] git push ${options.remote} HEAD`);
    } else {
      runCommand("git", ["push", options.remote, "HEAD"]);
    }
  }

  const workflowQueue = [
    {
      shouldRun: shouldRunWorkerDeploy,
      name: "Deploy infinitas-arena Worker",
    },
    {
      shouldRun: shouldRunWebDeploy,
      name: "Deploy INFINITAS ARENA Web to GitHub Pages",
    },
    {
      shouldRun: shouldRunDesktopRelease,
      name: "Release Desktop",
    },
  ];

  for (const workflow of workflowQueue) {
    if (!workflow.shouldRun) {
      console.log(`[skip] ${workflow.name}`);
      continue;
    }

    if (options.dryRun) {
      console.log(`[dry-run] gh workflow run "${workflow.name}" --ref ${currentBranch}`);
      continue;
    }

    if (options.waitWorkflows) {
      console.log(`[run] ${workflow.name} (wait enabled)`);
      await dispatchAndWatchWorkflow(workflow.name, currentBranch, options.timeoutMinutes);
    } else {
      console.log(`[run] ${workflow.name}`);
      dispatchWorkflow(workflow.name, currentBranch);
    }
  }

  if (options.updateReleaseNotes) {
    const tagName = `v${options.version}`;
    const title = `INFINITAS Arena v${options.version}`;
    const downloadUrl = resolveDownloadUrl({
      explicitDownloadUrl: options.downloadUrl,
      publicR2BaseUrl: options.publicR2BaseUrl,
      version: options.version,
    });

    updateReleaseNotes({
      version: options.version,
      tagName,
      title,
      downloadUrl,
      featureItems: options.featureItems,
      fixItems: options.fixItems,
      otherItems: options.otherItems,
      noteItems: options.noteItems,
      createReleaseIfMissing: options.createReleaseIfMissing,
      dryRun: options.dryRun,
    });
  }

  console.log("[done] Phase D release flow completed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  printUsage();
  process.exit(1);
});
