import assert from "node:assert/strict";
import test from "node:test";
import {
  VISUAL_SCENARIO_IDS,
  findVisualScenarioChartByChartKey,
  getVisualScenario,
} from "./visual-scenarios";

test("cut-in visual scenarios are listed", () => {
  assert.equal(VISUAL_SCENARIO_IDS.includes("bpl-cut-in"), true);
  assert.equal(VISUAL_SCENARIO_IDS.includes("arena-cut-in"), true);
});

test("bpl cut-in scenario exposes own pick presentation metadata", () => {
  const scenario = getVisualScenario("bpl-cut-in");
  assert.ok(scenario);
  assert.equal(scenario.label, "BPL Pick Cut-In");
  assert.equal(scenario.captureDelayMs, 100);
  assert.equal(scenario.presentation?.ownPickCutInChartKey, scenario.room.snapshot?.picks[0]?.pick_chart_key);
});

test("arena cut-in scenario exposes own pick presentation metadata", () => {
  const scenario = getVisualScenario("arena-cut-in");
  assert.ok(scenario);
  assert.equal(scenario.label, "Arena Pick Cut-In");
  assert.equal(scenario.captureDelayMs, 100);
  assert.equal(scenario.presentation?.ownPickCutInChartKey, scenario.room.snapshot?.picks[0]?.pick_chart_key);
});

test("chart lookup by exact pick chart key resolves cut-in charts", () => {
  const bplScenario = getVisualScenario("bpl-cut-in");
  const arenaScenario = getVisualScenario("arena-cut-in");
  assert.ok(bplScenario);
  assert.ok(arenaScenario);

  const bplChartKey = bplScenario.room.snapshot?.picks[0]?.pick_chart_key ?? null;
  const arenaChartKey = arenaScenario.room.snapshot?.picks[0]?.pick_chart_key ?? null;

  const bplChart = findVisualScenarioChartByChartKey("bpl-cut-in", bplChartKey);
  const arenaChart = findVisualScenarioChartByChartKey("arena-cut-in", arenaChartKey);

  assert.equal(bplChart?.chart_key, bplChartKey);
  assert.equal(arenaChart?.chart_key, arenaChartKey);
});
