import {
  CHART_SEARCH_PAGE_SIZE,
  CHART_DIFFICULTIES,
  type ChartSearchEntry,
  type ChartSearchResponse,
  type ChartDifficulty,
  type ExpectedKey,
  type FrozenRound,
  type LevelFilter,
  type MatchSongUnlockFilter,
  type PlayStyle,
  type SongPack,
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
  chart_id: number;
  play_style: PlayStyle;
  difficulty: ChartDifficulty;
  level: number;
  title: string;
  title_qualifier: string;
  artist: string;
  genre: string;
  title_search_key: string;
  inf_unlock_type?: string | null;
  inf_pack_id?: number | null;
}

interface WorkerChartMasterSnapshot {
  metadata: WorkerChartMasterMetadata;
  charts: WorkerChartMasterChart[];
  aliases: Record<string, string>;
  song_packs?: SongPack[];
}

interface ParsedPickChartKey {
  chart_id: number | null;
  play_style: PlayStyle | null;
  difficulty: ChartDifficulty | null;
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
  unlock_filter?: MatchSongUnlockFilter;
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
  unlock_filter?: MatchSongUnlockFilter;
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
    unlockFilter?: MatchSongUnlockFilter,
  ): ResolvedMasterChart | null;
  resolveAliasExact(alias: string, playStyle: PlayStyle, difficulty: ChartDifficulty): string[];
  pickRandomUnusedChart(options: RandomUnusedChartOptions): ResolvedMasterChart | null;
  searchCharts(options: SearchChartsOptions): ChartSearchResponse;
  getSongPacks(): SongPack[];
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

function buildLegacyChartKey(playStyle: PlayStyle, difficulty: ChartDifficulty, titleSearchKey: string): string {
  return `${playStyle}::${difficulty}::${titleSearchKey}`;
}

function buildAmbiguousChartKey(chart: WorkerChartMasterChart): string {
  return JSON.stringify({
    chart_id: chart.chart_id,
    play_style: chart.play_style,
    difficulty: chart.difficulty,
    title_search_key: chart.title_search_key,
  });
}

function parseChartId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
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

type NormalizedUnlockType = "initial" | "bit" | "djp" | "pack" | "unknown";

function normalizeUnlockType(value: string | null | undefined): NormalizedUnlockType {
  const normalized = value?.trim().toLowerCase() ?? "initial";
  if (normalized.length === 0 || normalized === "initial") {
    return "initial";
  }
  if (normalized === "bit") {
    return "bit";
  }
  if (normalized === "djp") {
    return "djp";
  }
  if (normalized === "pack") {
    return "pack";
  }

  return "unknown";
}

function canUseChartByUnlockFilter(
  chart: WorkerChartMasterChart,
  unlockFilter: MatchSongUnlockFilter | undefined,
): boolean {
  if (unlockFilter === undefined) {
    return true;
  }

  switch (normalizeUnlockType(chart.inf_unlock_type)) {
    case "initial":
      return true;
    case "bit":
      return unlockFilter.include_bit;
    case "djp":
      return unlockFilter.include_djp;
    case "pack": {
      const packId = chart.inf_pack_id;
      if (typeof packId !== "number" || !Number.isInteger(packId) || packId <= 0) {
        return false;
      }

      return unlockFilter.common_pack_ids.includes(packId);
    }
    default:
      return false;
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

  const chartIdFromRecord = parseChartId(record.chart_id);

  if (typeof record.expected_key === "object" && record.expected_key !== null) {
    const expectedKey = record.expected_key as Record<string, unknown>;
    if (!isChartDifficulty(expectedKey.difficulty) || typeof expectedKey.title_search_key !== "string") {
      return null;
    }

    const chartId = parseChartId(expectedKey.chart_id) ?? chartIdFromRecord;
    const playStyle = isPlayStyle(expectedKey.play_style) ? expectedKey.play_style : roomPlayStyle;
    const titleSearchKey = normalizeLookupKey(expectedKey.title_search_key);
    if (titleSearchKey.length === 0) {
      return null;
    }

    return {
      chart_id: chartId,
      play_style: playStyle,
      difficulty: expectedKey.difficulty,
      title_search_key: titleSearchKey,
      title_lookup_key: null,
    };
  }

  if (chartIdFromRecord !== null && !isChartDifficulty(record.difficulty)) {
    return {
      chart_id: chartIdFromRecord,
      play_style: isPlayStyle(record.play_style) ? record.play_style : roomPlayStyle,
      difficulty: null,
      title_search_key: null,
      title_lookup_key: typeof record.title === "string" ? normalizeLookupKey(record.title) : null,
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
    chart_id: chartIdFromRecord,
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
      chart_id: null,
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
    chart_id: null,
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

  const chartIdOnlyMatch = /^chart_id::(\d+)$/i.exec(trimmedValue);
  if (chartIdOnlyMatch) {
    return {
      chart_id: Number.parseInt(chartIdOnlyMatch[1]!, 10),
      play_style: roomPlayStyle,
      difficulty: null,
      title_search_key: null,
      title_lookup_key: null,
    };
  }

  return (
    parsePickChartKeyJson(trimmedValue, roomPlayStyle) ??
    parsePickChartKeyDelimited(trimmedValue, roomPlayStyle)
  );
}

function createResolvedMasterChart(chart: WorkerChartMasterChart, chartKey: string): ResolvedMasterChart {
  return {
    chart_key: chartKey,
    expected_key: {
      play_style: chart.play_style,
      difficulty: chart.difficulty,
      title_search_key: chart.title_search_key,
      chart_id: chart.chart_id,
    },
    display: {
      title: chart.title,
      level: chart.level,
    },
  };
}

function createChartSearchEntry(chart: WorkerChartMasterChart, chartKey: string): ChartSearchEntry {
  return {
    chart_key: chartKey,
    chart_id: chart.chart_id,
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
  const legacyChartKeyCounts = new Map<string, number>();
  const chartByKey = new Map<string, ResolvedMasterChart>();
  const rawChartByKey = new Map<string, WorkerChartMasterChart>();
  const chartById = new Map<number, ResolvedMasterChart>();
  const rawChartById = new Map<number, WorkerChartMasterChart>();
  const chartsByLegacyKey = new Map<string, ResolvedMasterChart[]>();
  const poolByFilter = new Map<string, ResolvedMasterChart[]>();
  const aliasToTitleSearchKeys = new Map<string, Set<string>>();
  const aliasToTitleSearchKeysExact = new Map<string, Set<string>>();
  const searchableCharts: Array<{ chart: ChartSearchEntry; keyword_index: string; source: WorkerChartMasterChart }> = [];
  const songPacks = [...(snapshot.song_packs ?? [])].sort((left, right) => {
    if (left.display_order !== right.display_order) {
      return right.display_order - left.display_order;
    }
    return left.inf_pack_id - right.inf_pack_id;
  });

  for (const [alias, titleSearchKey] of Object.entries(snapshot.aliases)) {
    const normalizedAlias = normalizeLookupKey(alias);
    const existing = aliasToTitleSearchKeys.get(normalizedAlias);
    if (existing) {
      existing.add(titleSearchKey);
    } else {
      aliasToTitleSearchKeys.set(normalizedAlias, new Set([titleSearchKey]));
    }

    const exactAlias = alias.trim();
    if (exactAlias.length > 0) {
      const exactExisting = aliasToTitleSearchKeysExact.get(exactAlias);
      if (exactExisting) {
        exactExisting.add(titleSearchKey);
      } else {
        aliasToTitleSearchKeysExact.set(exactAlias, new Set([titleSearchKey]));
      }
    }
  }

  for (const chart of snapshot.charts) {
    const legacyChartKey = buildLegacyChartKey(chart.play_style, chart.difficulty, chart.title_search_key);
    legacyChartKeyCounts.set(legacyChartKey, (legacyChartKeyCounts.get(legacyChartKey) ?? 0) + 1);
  }

  for (const chart of snapshot.charts) {
    const legacyChartKey = buildLegacyChartKey(chart.play_style, chart.difficulty, chart.title_search_key);
    const isAmbiguous = (legacyChartKeyCounts.get(legacyChartKey) ?? 0) > 1;
    const chartKey = isAmbiguous ? buildAmbiguousChartKey(chart) : legacyChartKey;
    const resolvedChart = createResolvedMasterChart(chart, chartKey);
    const exactTitle = chart.title.trim();
    if (exactTitle.length > 0) {
      const exactExisting = aliasToTitleSearchKeysExact.get(exactTitle);
      if (exactExisting) {
        exactExisting.add(chart.title_search_key);
      } else {
        aliasToTitleSearchKeysExact.set(exactTitle, new Set([chart.title_search_key]));
      }
    }

    searchableCharts.push({
      chart: createChartSearchEntry(chart, chartKey),
      keyword_index: normalizeLookupKey(
        [chart.title, chart.title_qualifier, chart.artist, chart.genre].filter((value) => value.length > 0).join(" "),
      ),
      source: chart,
    });
    chartByKey.set(resolvedChart.chart_key, resolvedChart);
    rawChartByKey.set(resolvedChart.chart_key, chart);
    chartById.set(chart.chart_id, resolvedChart);
    rawChartById.set(chart.chart_id, chart);

    const legacyBucket = chartsByLegacyKey.get(legacyChartKey);
    if (legacyBucket) {
      legacyBucket.push(resolvedChart);
    } else {
      chartsByLegacyKey.set(legacyChartKey, [resolvedChart]);
    }

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

  const resolveUniqueAllowedChart = (
    candidates: ResolvedMasterChart[],
    levelFilter: LevelFilter,
    unlockFilter: MatchSongUnlockFilter | undefined,
  ): ResolvedMasterChart | null => {
    const eligible = candidates.filter((candidate) => {
      const sourceChart = rawChartByKey.get(candidate.chart_key);
      return (
        sourceChart !== undefined &&
        typeof candidate.display.level === "number" &&
        matchesLevelFilter(candidate.display.level, levelFilter) &&
        canUseChartByUnlockFilter(sourceChart, unlockFilter)
      );
    });

    return eligible.length === 1 ? (eligible[0] ?? null) : null;
  };

  const resolveByLookup = (
    parsedPick: ParsedPickChartKey,
    levelFilter: LevelFilter,
    unlockFilter: MatchSongUnlockFilter | undefined,
  ): ResolvedMasterChart | null => {
    if (parsedPick.chart_id !== null) {
      const chart = chartById.get(parsedPick.chart_id);
      if (chart !== undefined) {
        const sourceChart = rawChartById.get(parsedPick.chart_id);
        if (
          sourceChart !== undefined &&
          typeof chart.display.level === "number" &&
          matchesLevelFilter(chart.display.level, levelFilter) &&
          canUseChartByUnlockFilter(sourceChart, unlockFilter)
        ) {
          return chart;
        }
      }
    }

    if (
      (parsedPick.play_style !== "SP" && parsedPick.play_style !== "DP") ||
      !isChartDifficulty(parsedPick.difficulty)
    ) {
      return null;
    }

    if (parsedPick.title_search_key !== null) {
      const directLookupKey = buildLegacyChartKey(
        parsedPick.play_style,
        parsedPick.difficulty,
        parsedPick.title_search_key,
      );
      const directCandidates = chartsByLegacyKey.get(directLookupKey) ?? [];
      const directResolved = resolveUniqueAllowedChart(directCandidates, levelFilter, unlockFilter);
      if (directResolved !== null) {
        return directResolved;
      }
    }

    const aliasCandidates = [parsedPick.title_search_key, parsedPick.title_lookup_key];
    for (const aliasCandidate of aliasCandidates) {
      if (aliasCandidate === null || aliasCandidate.length === 0) {
        continue;
      }

      const canonicalTitleSearchKeys = aliasToTitleSearchKeys.get(aliasCandidate);
      if (!canonicalTitleSearchKeys) {
        continue;
      }

      for (const canonicalTitleSearchKey of canonicalTitleSearchKeys) {
        const chartKey = buildLegacyChartKey(
          parsedPick.play_style,
          parsedPick.difficulty,
          canonicalTitleSearchKey,
        );
        const candidates = chartsByLegacyKey.get(chartKey) ?? [];
        const resolved = resolveUniqueAllowedChart(candidates, levelFilter, unlockFilter);
        if (resolved !== null) {
          return resolved;
        }
      }
    }

    return null;
  };

  return {
    resolveAliasExact(alias, playStyle, difficulty) {
      const exactAlias = alias.trim();
      if (exactAlias.length === 0) {
        return [];
      }

      const titleSearchKeys = aliasToTitleSearchKeysExact.get(exactAlias);
      if (!titleSearchKeys) {
        return [];
      }

      const resolved: string[] = [];
      for (const titleSearchKey of titleSearchKeys) {
        const legacyKey = buildLegacyChartKey(playStyle, difficulty, titleSearchKey);
        if ((legacyChartKeyCounts.get(legacyKey) ?? 0) > 0) {
          resolved.push(titleSearchKey);
        }
      }

      return resolved;
    },

    resolvePickChartKey(pickChartKey, playStyle, levelFilter, unlockFilter) {
      const parsedPick = parsePickChartKey(pickChartKey, playStyle);
      if (parsedPick === null) {
        return null;
      }

      if (parsedPick.play_style !== null && parsedPick.play_style !== playStyle) {
        return null;
      }

      return resolveByLookup(parsedPick, levelFilter, unlockFilter);
    },

    pickRandomUnusedChart({
      play_style,
      level_filter,
      used_chart_keys,
      unlock_filter,
      seed,
      preferred_difficulty,
      preferred_level,
      preferred_level_min,
      preferred_level_max,
      enforce_level_range,
    }) {
      const poolKey = `${play_style}::${level_filter}`;
      const pool = poolByFilter.get(poolKey) ?? [];
      const unlockedPool =
        unlock_filter === undefined
          ? pool
          : pool.filter((chart) => {
              const sourceChart = rawChartByKey.get(chart.chart_key);
              return sourceChart !== undefined && canUseChartByUnlockFilter(sourceChart, unlock_filter);
            });
      if (unlockedPool.length === 0) {
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
          unlockedPool.filter(
            (chart) =>
              chart.expected_key.difficulty === preferred_difficulty &&
              chart.display.level === preferred_level,
          ),
        );
      }

      if (preferred_difficulty && hasLevelRange) {
        candidateGroups.push(
          unlockedPool.filter(
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
          unlockedPool.filter(
            (chart) =>
              typeof chart.display.level === "number" &&
              chart.display.level >= (levelRange?.min ?? Number.NEGATIVE_INFINITY) &&
              chart.display.level <= (levelRange?.max ?? Number.POSITIVE_INFINITY),
          ),
        );
      }

      if (preferred_difficulty && !(enforce_level_range && hasLevelRange)) {
        candidateGroups.push(
          unlockedPool.filter((chart) => chart.expected_key.difficulty === preferred_difficulty),
        );
      }

      if (!(enforce_level_range && hasLevelRange)) {
        candidateGroups.push(unlockedPool);
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
      unlock_filter,
      difficulty,
      level,
      keyword,
      cursor,
      limit,
    }) {
      const offset = parseCursorOffset(cursor);
      const normalizedKeyword = keyword?.trim() ? normalizeLookupKey(keyword) : "";
      const pageSize = Math.max(1, Math.min(limit ?? CHART_SEARCH_PAGE_SIZE, CHART_SEARCH_PAGE_SIZE));
      const filteredCharts = searchableCharts.filter(({ chart, keyword_index, source }) => {
        if (chart.play_style !== play_style) {
          return false;
        }
        if (!matchesLevelFilter(chart.level, level_filter)) {
          return false;
        }
        if (!canUseChartByUnlockFilter(source, unlock_filter)) {
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

    getSongPacks() {
      return songPacks.map((pack) => ({ ...pack }));
    },

    getMetadata() {
      return snapshot.metadata;
    },
  };
}

const snapshot = masterSnapshotJson as WorkerChartMasterSnapshot;

export const workerChartMaster = createRoomChartMaster(snapshot);
