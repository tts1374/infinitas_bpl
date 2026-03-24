import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

/**
 * @param {string} relativePath
 * @returns {string}
 */
function readUtf8(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

/**
 * @param {string[]} failures
 * @param {string} file
 * @param {string} pattern
 */
function assertIncludes(failures, file, pattern) {
  const text = readUtf8(file);
  if (!text.includes(pattern)) {
    failures.push(`${file}: missing "${pattern}"`);
  }
}

const failures = [];

assertIncludes(failures, "AGENTS.md", "docs/design/10_regression_guard_addendum.md");
assertIncludes(failures, "docs/design/01_fsm.md", "`ROOM_STATE_LOST`");
assertIncludes(failures, "docs/design/02_ws_protocol.md", "per_round: { rounds: RoundResult[] }");
assertIncludes(failures, "docs/design/02_ws_protocol.md", "`ROOM_STATE_LOST`");
assertIncludes(failures, "docs/design/03_data_model.md", "## 9. 互換/移行ルール（Ph1）");
assertIncludes(failures, "docs/design/07_constants.md", "DEPRECATED_SOURCE_OPTIONS");
assertIncludes(failures, "docs/design/07_constants.md", "SOURCE_DEPRECATED_JOIN_REJECT");
assertIncludes(failures, "docs/design/08_repo_structure.md", "10_regression_guard_addendum.md");
assertIncludes(failures, "packages/shared/src/enums/room.ts", "\"ROOM_STATE_LOST\"");
assertIncludes(failures, "packages/shared/src/ws/server.ts", "interface ResultReadyPerRound");
assertIncludes(failures, "packages/shared/src/ws/server.ts", "interface ResultReadyPerPlayer");
assertIncludes(failures, "QUALITY.md", "daken_counter_v3");
assertIncludes(failures, "QUALITY.md", "reflux");

const screenList = readUtf8("docs/design/05_screen_list.md");
const firstLine = screenList.split(/\r?\n/, 1)[0] ?? "";
if (firstLine.startsWith("```")) {
  failures.push("docs/design/05_screen_list.md: must not start with a code fence");
}
if (screenList.includes("## 11.4 主な操作")) {
  failures.push("docs/design/05_screen_list.md: section number drift (11.4) is not allowed");
}

if (failures.length > 0) {
  console.error("Design contract check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Design contract check passed.");
