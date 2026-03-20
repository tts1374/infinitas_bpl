import { CHART_DIFFICULTIES, PLAY_STYLES } from "@infinitas/shared";
import { workerChartMaster } from "../master/chart-master";
import { asEnumValue } from "../utils/validation";

export interface ChartAliasResolveResponse {
  alias_exists: boolean;
  title_search_keys: string[];
}

export function resolveChartAlias(url: URL): ChartAliasResolveResponse {
  const aliasRaw = url.searchParams.get("alias");
  const alias = aliasRaw?.trim() ?? "";
  if (alias.length === 0) {
    throw new Error("alias is required.");
  }

  const playStyle = asEnumValue(url.searchParams.get("play_style"), PLAY_STYLES);
  const difficulty = asEnumValue(url.searchParams.get("difficulty"), CHART_DIFFICULTIES);
  if (playStyle === undefined || difficulty === undefined) {
    throw new Error("play_style and difficulty are required.");
  }

  return {
    alias_exists: workerChartMaster.hasAliasExact(alias),
    title_search_keys: workerChartMaster.resolveAliasExact(alias, playStyle, difficulty),
  };
}
