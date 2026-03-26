import test from "node:test";
import assert from "node:assert/strict";
import { createRoomChartMaster } from "./chart-master.ts";

function createSnapshot() {
  return {
    metadata: {
      source_repo: "test/repo",
      release_tag: "test-tag",
      sqlite_file_name: "test.sqlite",
      schema_version: "1",
      generated_at: "2026-03-11T00:00:00.000Z",
      sha256: "test-hash",
      byte_size: 1,
    },
    charts: [
      {
        chart_id: 101,
        play_style: "SP",
        difficulty: "HYPER",
        level: 10,
        title: "Blue Fire",
        title_qualifier: "",
        artist: "Unit A",
        genre: "TRANCE",
        version: "11",
        title_search_key: "blue fire",
        inf_unlock_type: "bit",
        inf_pack_id: null,
      },
      {
        chart_id: 102,
        play_style: "SP",
        difficulty: "ANOTHER",
        level: 12,
        title: "Blue Fire",
        title_qualifier: "",
        artist: "Unit A",
        genre: "TRANCE",
        version: "11",
        title_search_key: "blue fire",
        inf_unlock_type: "djp",
        inf_pack_id: null,
      },
      {
        chart_id: 103,
        play_style: "SP",
        difficulty: "NORMAL",
        level: 8,
        title: "Night Sky",
        title_qualifier: "",
        artist: "Unit B",
        genre: "HOUSE",
        version: "12",
        title_search_key: "night sky",
        inf_unlock_type: "initial",
        inf_pack_id: null,
      },
      {
        chart_id: 104,
        play_style: "DP",
        difficulty: "HYPER",
        level: 10,
        title: "Blue Fire",
        title_qualifier: "",
        artist: "Unit A",
        genre: "TRANCE",
        version: "11",
        title_search_key: "blue fire",
        inf_unlock_type: "pack",
        inf_pack_id: 2,
      },
    ],
    aliases: {
      "Blue Fire (Alias)": "blue fire",
      "NightSky": "night sky",
    },
    song_packs: [
      {
        inf_pack_id: 2,
        pack_code: "pack_2",
        pack_name: "Pack 2",
        display_order: 2,
        created_at: "2026-03-11T00:00:00.000Z",
        updated_at: "2026-03-11T00:00:00.000Z",
      },
    ],
  };
}

test("searchCharts applies filters and pagination", () => {
  const master = createRoomChartMaster(createSnapshot());

  const page1 = master.searchCharts({
    play_style: "SP",
    level_filter: "ANY",
    keyword: "blue",
    limit: 1,
  });
  assert.equal(page1.charts.length, 1);
  assert.equal(page1.charts[0]?.chart_key, "SP::HYPER::blue fire");
  assert.equal(page1.next_cursor, "1");

  const page2 = master.searchCharts({
    play_style: "SP",
    level_filter: "ANY",
    keyword: "blue",
    cursor: page1.next_cursor ?? undefined,
    limit: 1,
  });
  assert.equal(page2.charts.length, 1);
  assert.equal(page2.charts[0]?.chart_key, "SP::ANOTHER::blue fire");
  assert.equal(page2.next_cursor, null);
});

test("searchCharts filters by version", () => {
  const master = createRoomChartMaster(createSnapshot());

  const result = master.searchCharts({
    play_style: "SP",
    level_filter: "ANY",
    version: "12",
  });

  assert.deepEqual(result.charts.map((chart) => chart.chart_key), ["SP::NORMAL::night sky"]);
});

test("resolvePickChartKey supports direct and alias lookup", () => {
  const master = createRoomChartMaster(createSnapshot());

  const direct = master.resolvePickChartKey("SP::HYPER::blue fire", "SP", "ANY");
  assert.equal(direct?.chart_key, "SP::HYPER::blue fire");

  const aliased = master.resolvePickChartKey("SP::HYPER::Blue Fire (Alias)", "SP", "ANY");
  assert.equal(aliased?.chart_key, "SP::HYPER::blue fire");

  const jsonAliased = master.resolvePickChartKey(
    JSON.stringify({
      difficulty: "HYPER",
      title: "Blue Fire (Alias)",
    }),
    "SP",
    "ANY",
  );
  assert.equal(jsonAliased?.chart_key, "SP::HYPER::blue fire");

  const playStyleMismatch = master.resolvePickChartKey("DP::HYPER::blue fire", "SP", "ANY");
  assert.equal(playStyleMismatch, null);

  const levelMismatch = master.resolvePickChartKey("SP::HYPER::blue fire", "SP", "LV12");
  assert.equal(levelMismatch, null);
});

test("resolvePickChartKey resolves compatibility-normalized title_search_key picks", () => {
  const snapshot = createSnapshot();
  snapshot.charts.push({
    chart_id: 105,
    play_style: "DP",
    difficulty: "ANOTHER",
    level: 11,
    title: "♥LOVE² シュガ→♥",
    title_qualifier: "",
    artist: "ASY",
    genre: "HAPPY",
    title_search_key: "♥love² シュカ→♥",
    inf_unlock_type: "bit",
    inf_pack_id: null,
  });
  const master = createRoomChartMaster(snapshot);

  const resolved = master.resolvePickChartKey("DP::ANOTHER::♥love² シュカ→♥", "DP", "ANY");
  assert.equal(resolved?.chart_key, "DP::ANOTHER::♥love² シュカ→♥");
});

test("resolveAliasExact matches trim-only exact aliases", () => {
  const master = createRoomChartMaster(createSnapshot());

  assert.equal(master.hasAliasExact("Blue Fire"), true);
  assert.equal(master.hasAliasExact(" Blue Fire "), true);
  assert.equal(master.hasAliasExact("blue fire"), false);

  assert.deepEqual(master.resolveAliasExact("Blue Fire", "SP", "HYPER"), ["blue fire"]);
  assert.deepEqual(master.resolveAliasExact(" Blue Fire ", "SP", "HYPER"), ["blue fire"]);
  assert.deepEqual(master.resolveAliasExact("Blue Fire (Alias)", "SP", "HYPER"), ["blue fire"]);

  // lower-case is not an exact match (trim-only).
  assert.deepEqual(master.resolveAliasExact("blue fire", "SP", "HYPER"), []);

  // Alias exists but chart does not for the requested difficulty.
  assert.deepEqual(master.resolveAliasExact("NightSky", "SP", "HYPER"), []);
});

test("pickRandomUnusedChart respects preferred options and used chart keys", () => {
  const master = createRoomChartMaster(createSnapshot());

  const preferred = master.pickRandomUnusedChart({
    play_style: "SP",
    level_filter: "LV12",
    used_chart_keys: new Set(),
    seed: "seed-preferred",
    preferred_difficulty: "ANOTHER",
    preferred_level: 12,
  });
  assert.equal(preferred?.chart_key, "SP::ANOTHER::blue fire");

  const fallback = master.pickRandomUnusedChart({
    play_style: "SP",
    level_filter: "LV8_10",
    used_chart_keys: new Set(["SP::HYPER::blue fire"]),
    seed: "seed-fallback",
    preferred_difficulty: "ANOTHER",
    preferred_level: 10,
  });
  assert.ok(fallback);
  assert.equal(fallback?.chart_key, "SP::NORMAL::night sky");

  const ranged = master.pickRandomUnusedChart({
    play_style: "SP",
    level_filter: "ANY",
    used_chart_keys: new Set(["SP::NORMAL::night sky"]),
    seed: "seed-ranged",
    preferred_level_min: 8,
    preferred_level_max: 10,
    enforce_level_range: true,
  });
  assert.equal(ranged?.chart_key, "SP::HYPER::blue fire");

  const rangedExhausted = master.pickRandomUnusedChart({
    play_style: "SP",
    level_filter: "ANY",
    used_chart_keys: new Set(["SP::HYPER::blue fire", "SP::NORMAL::night sky"]),
    seed: "seed-ranged-exhausted",
    preferred_level_min: 8,
    preferred_level_max: 10,
    enforce_level_range: true,
  });
  assert.equal(rangedExhausted, null);

  const rangedFallback = master.pickRandomUnusedChart({
    play_style: "SP",
    level_filter: "ANY",
    used_chart_keys: new Set(["SP::HYPER::blue fire", "SP::NORMAL::night sky"]),
    seed: "seed-ranged-fallback",
    preferred_level_min: 8,
    preferred_level_max: 10,
  });
  assert.equal(rangedFallback?.chart_key, "SP::ANOTHER::blue fire");

  const exhausted = master.pickRandomUnusedChart({
    play_style: "SP",
    level_filter: "LV8_10",
    used_chart_keys: new Set(["SP::HYPER::blue fire", "SP::NORMAL::night sky"]),
    seed: "seed-exhausted",
  });
  assert.equal(exhausted, null);
});

test("unlock filter applies to search and resolve", () => {
  const snapshot = createSnapshot();
  snapshot.charts.push({
    chart_id: 105,
    play_style: "SP",
    difficulty: "LEGGENDARIA",
    level: 12,
    title: "Legend Star",
    title_qualifier: "",
    artist: "Unit C",
    genre: "HARDCORE",
    title_search_key: "legend star",
    inf_unlock_type: "initial",
    inf_pack_id: null,
  });
  const master = createRoomChartMaster(snapshot);

  const filteredSearch = master.searchCharts({
    play_style: "SP",
    level_filter: "ANY",
    unlock_filter: {
      include_bit: true,
      include_djp: false,
      include_leggendaria: false,
      common_pack_ids: [],
    },
  });
  assert.deepEqual(
    filteredSearch.charts.map((chart) => chart.chart_key).sort(),
    ["SP::HYPER::blue fire", "SP::NORMAL::night sky"].sort(),
  );

  const allowed = master.resolvePickChartKey(
    "SP::HYPER::blue fire",
    "SP",
    "ANY",
    {
      include_bit: true,
      include_djp: false,
      include_leggendaria: false,
      common_pack_ids: [],
    },
  );
  assert.equal(allowed?.chart_key, "SP::HYPER::blue fire");

  const rejected = master.resolvePickChartKey(
    "SP::ANOTHER::blue fire",
    "SP",
    "ANY",
    {
      include_bit: true,
      include_djp: false,
      include_leggendaria: false,
      common_pack_ids: [],
    },
  );
  assert.equal(rejected, null);

  const leggendariaAllowed = master.searchCharts({
    play_style: "SP",
    level_filter: "ANY",
    unlock_filter: {
      include_bit: true,
      include_djp: false,
      include_leggendaria: true,
      common_pack_ids: [],
    },
  });
  assert.equal(
    leggendariaAllowed.charts.some((chart) => chart.chart_key === "SP::LEGGENDARIA::legend star"),
    true,
  );
});
