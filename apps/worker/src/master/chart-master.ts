import {
  CHART_SEARCH_PAGE_SIZE,
  CHART_DIFFICULTIES,
  type ChartSearchEntry,
  type ChartSearchResponse,
  type ChartDifficulty,
  type ExpectedKey,
  type FrozenRound,
  type LevelFilter,
  type PlayStyle,
} from "@infinitas/shared";
import masterSnapshotJson from "./generated/iidx-song-master.json";

interface WorkerChartMasterMetadata {
  source_repo: string;
  release_tag: string;
  sqlite_file_name: string;
  schema_version: string;
  generated_at: string;
  sha256: string;
  byte_size: number;
  retained_chart_count?: number;
  excluded_ambiguous_chart_count?: number;
}

interface WorkerChartMasterChart {
  play_style: PlayStyle;
  difficulty: ChartDifficulty;
  level: number;
  title: string;
  title_qualifier: string;
  artist: string;
  genre: string;
  title_search_key: string;
}

interface WorkerChartMasterSnapshot {
  metadata: WorkerChartMasterMetadata;
  charts: WorkerChartMasterChart[];
  aliases: Record<string, string>;
}

interface ParsedPickChartKey {
  play_style: PlayStyle;
  difficulty: ChartDifficulty;
  title_search_key: string | null;
  title_lookup_key: string | null;
}

interface ResolvedMasterExpectedKey extends ExpectedKey {
  play_style: PlayStyle;
  difficulty: ChartDifficulty;
}

export interface ResolvedMasterChart {
  chart_key: string;
  expected_key: ResolvedMasterExpectedKey;
  display: FrozenRound["display"];
}

export interface RandomUnusedChartOptions {
  play_style: PlayStyle;
  level_filter: LevelFilter;
  used_chart_keys: ReadonlySet<string>;
  seed: string;
  preferred_difficulty?: ChartDifficulty;
  preferred_level?: number | null;
  preferred_level_min?: number | null;
  preferred_level_max?: number | null;
  enforce_level_range?: boolean;
}

export interface SearchChartsOptions {
  play_style: PlayStyle;
  level_filter: LevelFilter;
  difficulty?: ChartDifficulty;
  level?: number;
  keyword?: string;
  cursor?: string;
  limit?: number;
}

export interface RoomChartMaster {
  resolvePickChartKey(
    pickChartKey: string,
    playStyle: PlayStyle,
    levelFilter: LevelFilter,
  ): ResolvedMasterChart | null;
  pickRandomUnusedChart(options: RandomUnusedChartOptions): ResolvedMasterChart | null;
  searchCharts(options: SearchChartsOptions): ChartSearchResponse;
  getMetadata(): WorkerChartMasterMetadata;
}

function isChartDifficulty(value: unknown): value is ChartDifficulty {
  return typeof value === "string" && CHART_DIFFICULTIES.includes(value as ChartDifficulty);
}

function isPlayStyle(value: unknown): value is PlayStyle {
  return value === "SP" || value === "DP";
}

function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+\(/g, "(")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildChartKey(playStyle: PlayStyle, difficulty: ChartDifficulty, titleSearchKey: string): string {
  return `${playStyle}::${difficulty}::${titleSearchKey}`;
}

function parseCursorOffset(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function matchesLevelFilter(level: number, levelFilter: LevelFilter): boolean {
  switch (levelFilter) {
    case "ANY":
      return true;
    case "LV8_10":
      return level >= 8 && level <= 10;
    case "LV10":
      return level === 10;
    case "LV11":
      return level === 11;
    case "LV12":
      return level === 12;
  }
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function parsePickChartKeyJson(value: string, roomPlayStyle: PlayStyle): ParsedPickChartKey | null {
  if (!value.startsWith("{")) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.chart_key === "string") {
    return parsePickChartKey(record.chart_key, roomPlayStyle);
  }

  if (typeof record.expected_key === "object" && record.expected_key !== null) {
    const expectedKey = record.expected_key as Record<string, unknown>;
    if (!isChartDifficulty(expectedKey.difficulty) || typeof expectedKey.title_search_key !== "string") {
      return null;
    }

    const playStyle = isPlayStyle(expectedKey.play_style) ? expectedKey.play_style : roomPlayStyle;
    const titleSearchKey = normalizeLookupKey(expectedKey.title_search_key);
    if (titleSearchKey.length === 0) {
      return null;
    }

    return {
      play_style: playStyle,
      difficulty: expectedKey.difficulty,
      title_search_key: titleSearchKey,
      title_lookup_key: null,
    };
  }

  if (!isChartDifficulty(record.difficulty)) {
    return null;
  }

  const playStyle = isPlayStyle(record.play_style) ? record.play_style : roomPlayStyle;
  const titleSearchKey =
    typeof record.title_search_key === "string" ? normalizeLookupKey(record.title_search_key) : "";
  const titleLookupKey = typeof record.title === "string" ? normalizeLookupKey(record.title) : "";

  if (titleSearchKey.length === 0 && titleLookupKey.length === 0) {
    return null;
  }

  return {
    play_style: playStyle,
    difficulty: record.difficulty,
    title_search_key: titleSearchKey.length > 0 ? titleSearchKey : null,
    title_lookup_key: titleLookupKey.length > 0 ? titleLookupKey : null,
  };
}

function parsePickChartKeyDelimited(value: string, roomPlayStyle: PlayStyle): ParsedPickChartKey | null {
  const delimiter = value.includes("::") ? "::" : value.includes("|") ? "|" : null;
  if (delimiter === null) {
    return null;
  }

  const segments = value.split(delimiter).map((segment) => segment.trim());
  const firstSegment = segments[0];
  const secondSegment = segments[1];
  const thirdSegment = segments[2];

  if (
    segments.length >= 3 &&
    firstSegment !== undefined &&
    secondSegment !== undefined &&
    thirdSegment !== undefined &&
    isPlayStyle(firstSegment) &&
    isChartDifficulty(secondSegment)
  ) {
    const titleSearchKey = normalizeLookupKey(thirdSegment);
    if (titleSearchKey.length === 0) {
      return null;
    }

    return {
      play_style: firstSegment,
      difficulty: secondSegment,
      title_search_key: titleSearchKey,
      title_lookup_key: segments[3] ? normalizeLookupKey(segments[3]) : null,
    };
  }

  if (segments.length < 2 || firstSegment === undefined || secondSegment === undefined || !isChartDifficulty(firstSegment)) {
    return null;
  }

  const titleSearchKey = normalizeLookupKey(secondSegment);
  const titleLookupKey = segments[2] ? normalizeLookupKey(segments[2]) : "";
  if (titleSearchKey.length === 0 && titleLookupKey.length === 0) {
    return null;
  }

  return {
    play_style: roomPlayStyle,
    difficulty: firstSegment,
    title_search_key: titleSearchKey.length > 0 ? titleSearchKey : null,
    title_lookup_key: titleLookupKey.length > 0 ? titleLookupKey : null,
  };
}

function parsePickChartKey(value: string, roomPlayStyle: PlayStyle): ParsedPickChartKey | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  return (
    parsePickChartKeyJson(trimmedValue, roomPlayStyle) ??
    parsePickChartKeyDelimited(trimmedValue, roomPlayStyle)
  );
}

function createResolvedMasterChart(chart: WorkerChartMasterChart): ResolvedMasterChart {
  const chartKey = buildChartKey(chart.play_style, chart.difficulty, chart.title_search_key);

  return {
    chart_key: chartKey,
    expected_key: {
      play_style: chart.play_style,
      difficulty: chart.difficulty,
      title_search_key: chart.title_search_key,
    },
    display: {
      title: chart.title,
      level: chart.level,
    },
  };
}

function createChartSearchEntry(chart: WorkerChartMasterChart): ChartSearchEntry {
  return {
    chart_key: buildChartKey(chart.play_style, chart.difficulty, chart.title_search_key),
    play_style: chart.play_style,
    difficulty: chart.difficulty,
    level: chart.level,
    title: chart.title,
    title_qualifier: chart.title_qualifier,
    artist: chart.artist,
    genre: chart.genre,
    title_search_key: chart.title_search_key,
  };
}

export function createRoomChartMaster(snapshotInput: WorkerChartMasterSnapshot): RoomChartMaster {
  const snapshot = snapshotInput;
  const chartKeyCounts = new Map<string, number>();
  const chartByKey = new Map<string, ResolvedMasterChart>();
  const poolByFilter = new Map<string, ResolvedMasterChart[]>();
  const aliasToTitleSearchKey = new Map<string, string>();
  const searchableCharts: Array<{ chart: ChartSearchEntry; keyword_index: string }> = [];

  for (const [alias, titleSearchKey] of Object.entries(snapshot.aliases)) {
    aliasToTitleSearchKey.set(normalizeLookupKey(alias), titleSearchKey);
  }

  for (const chart of snapshot.charts) {
    const chartKey = buildChartKey(chart.play_style, chart.difficulty, chart.title_search_key);
    chartKeyCounts.set(chartKey, (chartKeyCounts.get(chartKey) ?? 0) + 1);
  }

  for (const chart of snapshot.charts) {
    const resolvedChart = createResolvedMasterChart(chart);
    if ((chartKeyCounts.get(resolvedChart.chart_key) ?? 0) > 1) {
      continue;
    }

    searchableCharts.push({
      chart: createChartSearchEntry(chart),
      keyword_index: normalizeLookupKey(
        [chart.title, chart.title_qualifier, chart.artist, chart.genre].filter((value) => value.length > 0).join(" "),
      ),
    });
    chartByKey.set(resolvedChart.chart_key, resolvedChart);

    for (const levelFilter of ["ANY", "LV8_10", "LV10", "LV11", "LV12"] as const) {
      if (!matchesLevelFilter(chart.level, levelFilter)) {
        continue;
      }

      const poolKey = `${chart.play_style}::${levelFilter}`;
      const pool = poolByFilter.get(poolKey);
      if (pool) {
        pool.push(resolvedChart);
      } else {
        poolByFilter.set(poolKey, [resolvedChart]);
      }
    }
  }

  const resolveByLookup = (
    parsedPick: ParsedPickChartKey,
    levelFilter: LevelFilter,
  ): ResolvedMasterChart | null => {
    if (parsedPick.play_style !== "SP" && parsedPick.play_style !== "DP") {
      return null;
    }

    const directLookupKey =
      parsedPick.title_search_key === null
        ? null
        : buildChartKey(parsedPick.play_style, parsedPick.difficulty, parsedPick.title_search_key);

    const directChart = directLookupKey === null ? undefined : chartByKey.get(directLookupKey);
    if (
      directChart !== undefined &&
      typeof directChart.display.level === "number" &&
      matchesLevelFilter(directChart.display.level, levelFilter)
    ) {
      return directChart;
    }

    const aliasCandidates = [parsedPick.title_search_key, parsedPick.title_lookup_key];
    for (const aliasCandidate of aliasCandidates) {
      if (aliasCandidate === null || aliasCandidate.length === 0) {
        continue;
      }

      const canonicalTitleSearchKey = aliasToTitleSearchKey.get(aliasCandidate);
      if (!canonicalTitleSearchKey) {
        continue;
      }

      const chartKey = buildChartKey(parsedPick.play_style, parsedPick.difficulty, canonicalTitleSearchKey);
      const chart = chartByKey.get(chartKey);
      if (
        chart !== undefined &&
        typeof chart.display.level === "number" &&
        matchesLevelFilter(chart.display.level, levelFilter)
      ) {
        return chart;
      }
    }

    return null;
  };

  return {
    resolvePickChartKey(pickChartKey, playStyle, levelFilter) {
      const parsedPick = parsePickChartKey(pickChartKey, playStyle);
      if (parsedPick === null || parsedPick.play_style !== playStyle) {
        return null;
      }

      return resolveByLookup(parsedPick, levelFilter);
    },

    pickRandomUnusedChart({
      play_style,
      level_filter,
      used_chart_keys,
      seed,
      preferred_difficulty,
      preferred_level,
      preferred_level_min,
      preferred_level_max,
      enforce_level_range,
    }) {
      const poolKey = `${play_style}::${level_filter}`;
      const pool = poolByFilter.get(poolKey) ?? [];
      if (pool.length === 0) {
        return null;
      }

      const hasLevelRange =
        typeof preferred_level_min === "number" &&
        Number.isFinite(preferred_level_min) &&
        typeof preferred_level_max === "number" &&
        Number.isFinite(preferred_level_max);
      const levelRange = hasLevelRange
        ? {
            min: Math.min(preferred_level_min, preferred_level_max),
            max: Math.max(preferred_level_min, preferred_level_max),
          }
        : null;

      const candidateGroups: ResolvedMasterChart[][] = [];
      if (preferred_difficulty && typeof preferred_level === "number") {
        candidateGroups.push(
          pool.filter(
            (chart) =>
              chart.expected_key.difficulty === preferred_difficulty &&
              chart.display.level === preferred_level,
          ),
        );
      }

      if (preferred_difficulty && hasLevelRange) {
        candidateGroups.push(
          pool.filter(
            (chart) =>
              chart.expected_key.difficulty === preferred_difficulty &&
              typeof chart.display.level === "number" &&
              chart.display.level >= (levelRange?.min ?? Number.NEGATIVE_INFINITY) &&
              chart.display.level <= (levelRange?.max ?? Number.POSITIVE_INFINITY),
          ),
        );
      }

      if (hasLevelRange) {
        candidateGroups.push(
          pool.filter(
            (chart) =>
              typeof chart.display.level === "number" &&
              chart.display.level >= (levelRange?.min ?? Number.NEGATIVE_INFINITY) &&
              chart.display.level <= (levelRange?.max ?? Number.POSITIVE_INFINITY),
          ),
        );
      }

      if (preferred_difficulty && !(enforce_level_range && hasLevelRange)) {
        candidateGroups.push(
          pool.filter((chart) => chart.expected_key.difficulty === preferred_difficulty),
        );
      }

      if (!(enforce_level_range && hasLevelRange)) {
        candidateGroups.push(pool);
      }

      for (const candidates of candidateGroups) {
        const unusedCandidates = candidates.filter((chart) => !used_chart_keys.has(chart.chart_key));
        if (unusedCandidates.length === 0) {
          continue;
        }

        const selectedIndex = hashString(seed) % unusedCandidates.length;
        return unusedCandidates[selectedIndex] ?? null;
      }

      return null;
    },

    searchCharts({
      play_style,
      level_filter,
      difficulty,
      level,
      keyword,
      cursor,
      limit,
    }) {
      const offset = parseCursorOffset(cursor);
      const normalizedKeyword = keyword?.trim() ? normalizeLookupKey(keyword) : "";
      const pageSize = Math.max(1, Math.min(limit ?? CHART_SEARCH_PAGE_SIZE, CHART_SEARCH_PAGE_SIZE));
      const filteredCharts = searchableCharts.filter(({ chart, keyword_index }) => {
        if (chart.play_style !== play_style) {
          return false;
        }
        if (!matchesLevelFilter(chart.level, level_filter)) {
          return false;
        }
        if (difficulty !== undefined && chart.difficulty !== difficulty) {
          return false;
        }
        if (level !== undefined && chart.level !== level) {
          return false;
        }
        if (normalizedKeyword.length > 0 && !keyword_index.includes(normalizedKeyword)) {
          return false;
        }

        return true;
      });

      const charts = filteredCharts.slice(offset, offset + pageSize).map(({ chart }) => chart);
      const nextOffset = offset + charts.length;

      return {
        charts,
        next_cursor: nextOffset < filteredCharts.length ? String(nextOffset) : null,
      };
    },

    getMetadata() {
      return snapshot.metadata;
    },
  };
}

const snapshot = masterSnapshotJson as WorkerChartMasterSnapshot;

export const workerChartMaster = createRoomChartMaster(snapshot);
