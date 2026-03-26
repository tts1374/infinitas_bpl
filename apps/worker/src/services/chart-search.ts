import {
  CHART_DIFFICULTIES,
  CHART_SEARCH_PAGE_SIZE,
  LEVEL_FILTERS,
  PLAY_STYLES,
  type ChartSearchResponse,
} from "@infinitas/shared";
import { workerChartMaster } from "../master/chart-master";
import { asEnumValue, parsePositiveInt } from "../utils/validation";

function parseLimit(rawLimit: string | null): number {
  const parsed = parsePositiveInt(rawLimit);
  if (parsed === undefined) {
    return CHART_SEARCH_PAGE_SIZE;
  }

  return Math.min(parsed, CHART_SEARCH_PAGE_SIZE);
}

export function searchCharts(url: URL): ChartSearchResponse {
  const playStyle = asEnumValue(url.searchParams.get("play_style"), PLAY_STYLES);
  const levelFilter = asEnumValue(url.searchParams.get("level_filter"), LEVEL_FILTERS);
  if (playStyle === undefined || levelFilter === undefined) {
    throw new Error("play_style and level_filter are required.");
  }

  const difficulty = asEnumValue(url.searchParams.get("difficulty"), CHART_DIFFICULTIES);
  const level = parsePositiveInt(url.searchParams.get("level"));
  const versionRaw = url.searchParams.get("version");
  const version = versionRaw !== null && versionRaw.trim().length > 0 ? versionRaw.trim() : undefined;
  const keywordRaw = url.searchParams.get("keyword");
  const cursorRaw = url.searchParams.get("cursor");
  const cursor = cursorRaw !== null && cursorRaw.trim().length > 0 ? cursorRaw : undefined;

  return workerChartMaster.searchCharts({
    play_style: playStyle,
    level_filter: levelFilter,
    ...(difficulty === undefined ? {} : { difficulty }),
    ...(level === undefined ? {} : { level }),
    ...(version === undefined ? {} : { version }),
    ...(keywordRaw === null ? {} : { keyword: keywordRaw }),
    ...(cursor === undefined ? {} : { cursor }),
    limit: parseLimit(url.searchParams.get("limit")),
  });
}
