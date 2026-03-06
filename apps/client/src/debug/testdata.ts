import arenaMisscountCleanRun from "../../../../testdata/debug-input/arena_misscount_clean_run.json";
import arenaScoreDrawEqual from "../../../../testdata/debug-input/arena_score_draw_equal.json";
import arenaScoreLoseP2 from "../../../../testdata/debug-input/arena_score_lose_p2.json";
import arenaScoreWinP1 from "../../../../testdata/debug-input/arena_score_win_p1.json";
import bplMisscountSurvivalP1 from "../../../../testdata/debug-input/bpl_misscount_survival_p1.json";
import bplScoreStandardP2 from "../../../../testdata/debug-input/bpl_score_standard_p2.json";
import bplSkipCase from "../../../../testdata/debug-input/bpl_skip_case.json";
import { ensureDebugInjectionTemplate, type DebugInjectionTemplate } from "./types";

export interface DebugInjectionFixture {
  fileName: string;
  rawJson: string;
  template: DebugInjectionTemplate;
}

function createFixture(fileName: string, value: unknown): DebugInjectionFixture {
  const template = ensureDebugInjectionTemplate(value, fileName);
  return {
    fileName,
    rawJson: JSON.stringify(template, null, 2),
    template,
  };
}

export const DEBUG_INJECTION_FIXTURES: DebugInjectionFixture[] = [
  createFixture("arena_score_win_p1.json", arenaScoreWinP1),
  createFixture("arena_score_lose_p2.json", arenaScoreLoseP2),
  createFixture("arena_score_draw_equal.json", arenaScoreDrawEqual),
  createFixture("bpl_skip_case.json", bplSkipCase),
  createFixture("arena_misscount_clean_run.json", arenaMisscountCleanRun),
  createFixture("bpl_score_standard_p2.json", bplScoreStandardP2),
  createFixture("bpl_misscount_survival_p1.json", bplMisscountSurvivalP1),
];
