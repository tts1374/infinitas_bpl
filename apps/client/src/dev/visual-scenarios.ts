import type {
  ChartSearchEntry,
  ChartSearchQuery,
  ChartSearchResponse,
  CurrentRoundSnapshot,
  ExpectedKey,
  ResultReadyPayload,
  RoomStateSnapshot,
  ServerMessagePayloadMap,
} from "@infinitas/shared";
import type { RoomConnectionStatus, RoomDialogState } from "../stores/room-store";
import type { ClientSettings } from "../stores/settings-store";

type VisualScenarioId =
  | "bpl-lobby"
  | "bpl-picking"
  | "bpl-playing"
  | "bpl-result-phase"
  | "bpl-final"
  | "arena-lobby"
  | "arena-picking"
  | "arena-playing"
  | "arena-result"
  | "room-closed";

export interface VisualScenarioRoomState {
  roomId: string;
  joinCode: string | null;
  connectionStatus: RoomConnectionStatus;
  connectionDetail: string;
  snapshot: RoomStateSnapshot;
  resultReady: ResultReadyPayload | null;
  roundConfirmations: Record<number, Array<ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"]>>;
  endedRoundIndices: number[];
  errorDialog: RoomDialogState | null;
  eventLog: string[];
}

export interface VisualScenario {
  id: VisualScenarioId;
  label: string;
  settings: ClientSettings;
  room: VisualScenarioRoomState;
  charts: ChartSearchEntry[];
}

export const VISUAL_SCENARIO_IDS: VisualScenarioId[] = [
  "bpl-lobby",
  "bpl-picking",
  "bpl-playing",
  "bpl-result-phase",
  "bpl-final",
  "arena-lobby",
  "arena-picking",
  "arena-playing",
  "arena-result",
  "room-closed",
];

const HOST_PLAYER_ID = "mock-host-player";
const GUEST_PLAYER_ID = "mock-guest-player";
const ARENA_PLAYER_3_ID = "mock-arena-player-3";
const ARENA_PLAYER_4_ID = "mock-arena-player-4";

const BASE_SETTINGS: Omit<ClientSettings, "playerId" | "displayName" | "source" | "apiBaseUrl"> = {
  dakenCounterV3Port: 8767,
  sourcePaths: {
    dakenTodayUpdateXml: "",
    notebookExportRecentJson: "",
    notebookRecordsRecentJson: "",
    refluxLatestJson: "",
    refluxTrackerTsv: "",
  },
  sourceDirectories: {
    dakenDirectory: "",
    notebookDirectory: "",
    refluxDirectory: "",
  },
  voiceEnabled: true,
  voiceVolume: 80,
  voiceMuted: false,
  enablePresentationSe: true,
  bitUnlockEnabled: false,
  djpUnlockEnabled: false,
  ownedPackIds: [],
};

const VISUAL_CHARTS: ChartSearchEntry[] = [
  {
    chart_key: "mock:#the_relentless:spl",
    play_style: "SP",
    difficulty: "LEGGENDARIA",
    level: 10,
    title: "#the_relentless",
    title_qualifier: "",
    artist: "DJ Shimamura",
    genre: "HARDCORE",
    title_search_key: "#the_relentless",
  },
  {
    chart_key: "mock:stargaze:spa",
    play_style: "SP",
    difficulty: "ANOTHER",
    level: 10,
    title: "Stargaze",
    title_qualifier: "",
    artist: "BEMANI Sound Team",
    genre: "TRANCE",
    title_search_key: "Stargaze",
  },
  {
    chart_key: "mock:technophobia:sph",
    play_style: "SP",
    difficulty: "HYPER",
    level: 10,
    title: "Technophobia",
    title_qualifier: "",
    artist: "BEMANI Sound Team \"Sota Fujimori\"",
    genre: "TECHNO",
    title_search_key: "Technophobia",
  },
  {
    chart_key: "mock:everlasting-message:spa",
    play_style: "SP",
    difficulty: "ANOTHER",
    level: 10,
    title: "Everlasting Message",
    title_qualifier: "",
    artist: "削除",
    genre: "TRANCE CORE",
    title_search_key: "Everlasting Message",
  },
  {
    chart_key: "mock:stasis:spa",
    play_style: "SP",
    difficulty: "ANOTHER",
    level: 9,
    title: "Stasis",
    title_qualifier: "",
    artist: "daice",
    genre: "DRUM'N'BASS",
    title_search_key: "Stasis",
  },
  {
    chart_key: "mock:mei:spa",
    play_style: "SP",
    difficulty: "ANOTHER",
    level: 12,
    title: "冥",
    title_qualifier: "",
    artist: "Amuro vs Killer",
    genre: "NJS",
    title_search_key: "冥",
  },
  {
    chart_key: "mock:iidx-red-ending:sph",
    play_style: "SP",
    difficulty: "HYPER",
    level: 8,
    title: "IIDX RED Ending",
    title_qualifier: "",
    artist: "dj TAKA",
    genre: "TRANCE",
    title_search_key: "IIDX RED Ending",
  },
  {
    chart_key: "mock:illegal-function-call:spa",
    play_style: "SP",
    difficulty: "ANOTHER",
    level: 10,
    title: "Illegal Function Call",
    title_qualifier: "",
    artist: "Umeboshi Chazuke",
    genre: "ARTCORE",
    title_search_key: "Illegal Function Call",
  },
  {
    chart_key: "mock:beyond-the-earth:sph",
    play_style: "SP",
    difficulty: "HYPER",
    level: 8,
    title: "Beyond the Earth",
    title_qualifier: "",
    artist: "猫叉Master",
    genre: "PROGRESSIVE",
    title_search_key: "Beyond the Earth",
  },
  {
    chart_key: "mock:level-4:spa",
    play_style: "SP",
    difficulty: "ANOTHER",
    level: 10,
    title: "Level 4",
    title_qualifier: "",
    artist: "Yamajet",
    genre: "ELECTRO",
    title_search_key: "Level 4",
  },
];

function isoAt(baseMs: number, offsetSeconds: number): string {
  return new Date(baseMs + offsetSeconds * 1_000).toISOString();
}

function createSettings(args: {
  playerId?: string;
  displayName?: string;
  apiBaseUrl?: string;
  source?: ClientSettings["source"];
}): ClientSettings {
  return {
    ...BASE_SETTINGS,
    apiBaseUrl: args.apiBaseUrl ?? "mock://visual-scenario",
    playerId: args.playerId ?? HOST_PLAYER_ID,
    displayName: args.displayName ?? "PLAYER_ONE",
    source: args.source ?? "inf-notebook",
  };
}

function createPlayer(args: {
  playerId: string;
  displayName: string;
  ready: boolean;
  role: "HOST" | "GUEST";
  joinedAt: string;
}): RoomStateSnapshot["players"][number] {
  return {
    player_id: args.playerId,
    display_name: args.displayName,
    source: "inf-notebook",
    connected: true,
    ready: args.ready,
    role: args.role,
    joined_at: args.joinedAt,
    left_at: null,
    rejoin_until: null,
  };
}

function createExpectedKey(chart: ChartSearchEntry): ExpectedKey {
  return {
    play_style: chart.play_style,
    difficulty: chart.difficulty,
    title_search_key: chart.title_search_key,
  };
}

function createFrozenRound(
  chart: ChartSearchEntry,
  roundIndex: number,
  startedAt: string | null,
  softTtlSeconds = 180,
): RoomStateSnapshot["frozen_rounds"][number] {
  return {
    round_index: roundIndex,
    expected_key: createExpectedKey(chart),
    display: {
      title: chart.title,
      level: chart.level,
    },
    started_at: startedAt,
    soft_ttl_seconds: softTtlSeconds,
  };
}

function createPick(playerId: string, chart: ChartSearchEntry, acceptedAt: string): RoomStateSnapshot["picks"][number] {
  return {
    player_id: playerId,
    pick_chart_key: chart.chart_key,
    accepted_at: acceptedAt,
  };
}

function createConfirmed(
  roundIndex: number,
  playerId: string,
  metricValue: number,
  submittedAt: string,
  status: "PLAYED" | "SKIPPED" | "TIMEOUT" = "PLAYED",
): ServerMessagePayloadMap["PLAYER_ROUND_CONFIRMED"] {
  return {
    round_index: roundIndex,
    player_id: playerId,
    status,
    metric_value: metricValue,
    reason: null,
    submitted_at: submittedAt,
    submitted_by: "SELF",
    source_meta: null,
  };
}

function createCurrentRound(
  chart: ChartSearchEntry,
  roundIndex: number,
  roundStartedAt: string,
  confirmed: CurrentRoundSnapshot["confirmed"],
  softTtlSeconds = 180,
): CurrentRoundSnapshot {
  return {
    round_index: roundIndex,
    expected_key: createExpectedKey(chart),
    round_started_at: roundStartedAt,
    soft_ttl_seconds: softTtlSeconds,
    confirmed,
  };
}

function createSnapshot(args: {
  roomId: string;
  roomState: RoomStateSnapshot["room_state"];
  settings: RoomStateSnapshot["settings"];
  players: RoomStateSnapshot["players"];
  picks?: RoomStateSnapshot["picks"];
  frozenRounds?: RoomStateSnapshot["frozen_rounds"];
  currentRound?: RoomStateSnapshot["current_round"];
  readyCheckDeadline?: string | null;
  pickingDeadline?: string | null;
  matchDeadline?: string | null;
  resultDeadline?: string | null;
  resultReady?: boolean;
  createdAt: string;
  closedAt?: string | null;
  closeReason?: RoomStateSnapshot["close_reason"];
}): RoomStateSnapshot {
  return {
    room_id: args.roomId,
    room_state: args.roomState,
    settings: args.settings,
    host_player_id: HOST_PLAYER_ID,
    players: args.players,
    picks: args.picks ?? [],
    frozen_rounds: args.frozenRounds ?? [],
    current_round: args.currentRound ?? null,
    timers: {
      ready_check_deadline: args.readyCheckDeadline ?? null,
      picking_deadline: args.pickingDeadline ?? null,
      match_deadline: args.matchDeadline ?? null,
      result_deadline: args.resultDeadline ?? null,
    },
    result_ready: args.resultReady ?? false,
    created_at: args.createdAt,
    closed_at: args.closedAt ?? null,
    close_reason: args.closeReason ?? null,
  };
}

function createResultReady(args: {
  mode: "ARENA" | "BPL";
  totalRounds: number;
  winnerPlayerIds: string[];
  players: Array<{
    playerId: string;
    displayName: string;
    totalPoints: number;
    totalExScore: number;
    roundWins: number;
  }>;
  rounds: Array<{
    roundIndex: number;
    chart: ChartSearchEntry;
    winnerPlayerIds: string[];
    results: Array<{
      playerId: string;
      displayName: string;
      metricValue: number;
      arenaPoints: number;
    }>;
  }>;
}): ResultReadyPayload {
  return {
    summary: {
      match_id: `${args.mode.toLowerCase()}-visual-match`,
      mode: args.mode,
      win_metric: "SCORE",
      total_rounds: args.totalRounds,
      completed_rounds: args.totalRounds,
      winner_player_ids: args.winnerPlayerIds,
      is_draw: args.winnerPlayerIds.length === 0,
      is_rated: false,
      rated_block_reason: "private_room",
      rating_before: null,
      rating_after: null,
      rating_delta: null,
    },
    per_player: {
      players: args.players.map((player) => ({
        player_id: player.playerId,
        display_name: player.displayName,
        total_points: player.totalPoints,
        total_ex_score: player.totalExScore,
        round_wins: player.roundWins,
      })),
    },
    per_round: {
      rounds: args.rounds.map((round) => ({
        round_index: round.roundIndex,
        display: {
          title: round.chart.title,
          artist: round.chart.artist,
          level: round.chart.level,
        },
        expected_key: createExpectedKey(round.chart),
        winner_player_ids: round.winnerPlayerIds,
        results: round.results.map((result) => ({
          player_id: result.playerId,
          display_name: result.displayName,
          metric_value: result.metricValue,
          arena_points: result.arenaPoints,
        })),
      })),
    },
  };
}

function createBplSettings(joinCode: string): RoomStateSnapshot["settings"] {
  return {
    visibility: "PRIVATE",
    join_code: joinCode,
    mode: "BPL",
    win_metric: "SCORE",
    play_style: "SP",
    level_filter: "LV10",
    room_comment: "Visual scenario / BPL",
    max_players: 2,
  };
}

function createArenaSettings(joinCode: string): RoomStateSnapshot["settings"] {
  return {
    visibility: "PRIVATE",
    join_code: joinCode,
    mode: "ARENA",
    win_metric: "SCORE",
    play_style: "SP",
    level_filter: "LV8_10",
    room_comment: "Visual scenario / Arena",
    max_players: 4,
  };
}

function matchesLevelFilter(chart: ChartSearchEntry, levelFilter: ChartSearchQuery["level_filter"]): boolean {
  switch (levelFilter) {
    case "LV8_10":
      return chart.level >= 8 && chart.level <= 10;
    case "LV10":
      return chart.level === 10;
    case "LV11":
      return chart.level === 11;
    case "LV12":
      return chart.level === 12;
    default:
      return true;
  }
}

function buildScenario(id: VisualScenarioId, nowMs: number): VisualScenario {
  const createdAt = isoAt(nowMs, -900);
  const joinedAt = isoAt(nowMs, -840);
  const roomId = `visual-${id}`;
  const bplJoinCode = "BPL-S3-BATTLE";
  const arenaJoinCode = "ARENA123";
  const settings = createSettings({
    playerId: HOST_PLAYER_ID,
    displayName: "PLAYER_ONE",
  });
  const bplPlayers = [
    createPlayer({
      playerId: HOST_PLAYER_ID,
      displayName: "PLAYER_ONE",
      ready: true,
      role: "HOST",
      joinedAt,
    }),
    createPlayer({
      playerId: GUEST_PLAYER_ID,
      displayName: "RIVAL_KUN",
      ready: true,
      role: "GUEST",
      joinedAt,
    }),
  ];
  const arenaPlayers = [
    createPlayer({
      playerId: HOST_PLAYER_ID,
      displayName: "PLAYER_ONE",
      ready: true,
      role: "HOST",
      joinedAt,
    }),
    createPlayer({
      playerId: GUEST_PLAYER_ID,
      displayName: "RIVAL_KUN",
      ready: true,
      role: "GUEST",
      joinedAt,
    }),
    createPlayer({
      playerId: ARENA_PLAYER_3_ID,
      displayName: "IIDX_CHAMP",
      ready: true,
      role: "GUEST",
      joinedAt,
    }),
    createPlayer({
      playerId: ARENA_PLAYER_4_ID,
      displayName: "ARENA_PRO",
      ready: true,
      role: "GUEST",
      joinedAt,
    }),
  ];
  const bplChartOne = VISUAL_CHARTS[0]!;
  const bplChartTwo = VISUAL_CHARTS[1]!;
  const bplChartThree = VISUAL_CHARTS[2]!;
  const arenaChartOne = VISUAL_CHARTS[3]!;
  const arenaChartTwo = VISUAL_CHARTS[4]!;
  const arenaChartThree = VISUAL_CHARTS[8]!;
  const arenaChartFour = VISUAL_CHARTS[6]!;

  switch (id) {
    case "bpl-lobby": {
      const snapshot = createSnapshot({
        roomId,
        roomState: "LOBBY",
        settings: createBplSettings(bplJoinCode),
        players: bplPlayers,
        readyCheckDeadline: isoAt(nowMs, 1_200),
        createdAt,
      });

      return {
        id,
        label: "BPL Lobby",
        settings,
        room: {
          roomId,
          joinCode: bplJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: BPL lobby.",
          snapshot,
          resultReady: null,
          roundConfirmations: {},
          endedRoundIndices: [],
          errorDialog: null,
          eventLog: ["Mock scenario: BPL lobby."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "bpl-picking": {
      const snapshot = createSnapshot({
        roomId,
        roomState: "PICKING",
        settings: createBplSettings(bplJoinCode),
        players: bplPlayers,
        pickingDeadline: isoAt(nowMs, 96),
        createdAt,
      });

      return {
        id,
        label: "BPL Picking",
        settings,
        room: {
          roomId,
          joinCode: bplJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: BPL picking.",
          snapshot,
          resultReady: null,
          roundConfirmations: {},
          endedRoundIndices: [],
          errorDialog: null,
          eventLog: ["Mock scenario: BPL picking."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "bpl-playing": {
      const picks = [
        createPick(HOST_PLAYER_ID, bplChartOne, isoAt(nowMs, -150)),
        createPick(GUEST_PLAYER_ID, bplChartTwo, isoAt(nowMs, -120)),
      ];
      const currentRound = createCurrentRound(
        bplChartOne,
        0,
        isoAt(nowMs, -22),
        [
          {
            player_id: HOST_PLAYER_ID,
            status: "PLAYED",
            metric_value: 3421,
            reason: null,
            submitted_by: "SELF",
            submitted_at: isoAt(nowMs, -4),
            source_meta: null,
          },
        ],
        180,
      );
      const snapshot = createSnapshot({
        roomId,
        roomState: "PLAYING",
        settings: createBplSettings(bplJoinCode),
        players: bplPlayers,
        picks,
        frozenRounds: [createFrozenRound(bplChartOne, 0, currentRound.round_started_at)],
        currentRound,
        matchDeadline: isoAt(nowMs, 158),
        createdAt,
      });

      return {
        id,
        label: "BPL Playing",
        settings,
        room: {
          roomId,
          joinCode: bplJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: BPL playing.",
          snapshot,
          resultReady: null,
          roundConfirmations: {},
          endedRoundIndices: [],
          errorDialog: null,
          eventLog: ["Mock scenario: BPL playing."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "bpl-result-phase": {
      const picks = [
        createPick(HOST_PLAYER_ID, bplChartOne, isoAt(nowMs, -300)),
        createPick(GUEST_PLAYER_ID, bplChartTwo, isoAt(nowMs, -270)),
      ];
      const currentRound = createCurrentRound(
        bplChartTwo,
        1,
        isoAt(nowMs, 8),
        [],
        180,
      );
      const roundZeroConfirmations = [
        createConfirmed(0, HOST_PLAYER_ID, 3421, isoAt(nowMs, -32)),
        createConfirmed(0, GUEST_PLAYER_ID, 3278, isoAt(nowMs, -30)),
      ];
      const snapshot = createSnapshot({
        roomId,
        roomState: "PLAYING",
        settings: createBplSettings(bplJoinCode),
        players: bplPlayers,
        picks,
        frozenRounds: [
          createFrozenRound(bplChartOne, 0, isoAt(nowMs, -130)),
          createFrozenRound(bplChartTwo, 1, currentRound.round_started_at),
        ],
        currentRound,
        matchDeadline: isoAt(nowMs, 188),
        createdAt,
      });

      return {
        id,
        label: "BPL Result Phase",
        settings,
        room: {
          roomId,
          joinCode: bplJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: BPL result phase.",
          snapshot,
          resultReady: null,
          roundConfirmations: {
            0: roundZeroConfirmations,
          },
          endedRoundIndices: [0],
          errorDialog: null,
          eventLog: ["Mock scenario: BPL result phase.", "Round 1 ended."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "bpl-final": {
      const resultReady = createResultReady({
        mode: "BPL",
        totalRounds: 3,
        winnerPlayerIds: [HOST_PLAYER_ID],
        players: [
          {
            playerId: HOST_PLAYER_ID,
            displayName: "PLAYER_ONE",
            totalPoints: 5,
            totalExScore: 10_211,
            roundWins: 2,
          },
          {
            playerId: GUEST_PLAYER_ID,
            displayName: "RIVAL_KUN",
            totalPoints: 2,
            totalExScore: 9_871,
            roundWins: 1,
          },
        ],
        rounds: [
          {
            roundIndex: 0,
            chart: bplChartOne,
            winnerPlayerIds: [HOST_PLAYER_ID],
            results: [
              { playerId: HOST_PLAYER_ID, displayName: "PLAYER_ONE", metricValue: 3421, arenaPoints: 2 },
              { playerId: GUEST_PLAYER_ID, displayName: "RIVAL_KUN", metricValue: 3278, arenaPoints: 0 },
            ],
          },
          {
            roundIndex: 1,
            chart: bplChartTwo,
            winnerPlayerIds: [GUEST_PLAYER_ID],
            results: [
              { playerId: HOST_PLAYER_ID, displayName: "PLAYER_ONE", metricValue: 3110, arenaPoints: 0 },
              { playerId: GUEST_PLAYER_ID, displayName: "RIVAL_KUN", metricValue: 3360, arenaPoints: 2 },
            ],
          },
          {
            roundIndex: 2,
            chart: bplChartThree,
            winnerPlayerIds: [HOST_PLAYER_ID],
            results: [
              { playerId: HOST_PLAYER_ID, displayName: "PLAYER_ONE", metricValue: 3680, arenaPoints: 3 },
              { playerId: GUEST_PLAYER_ID, displayName: "RIVAL_KUN", metricValue: 3233, arenaPoints: 0 },
            ],
          },
        ],
      });
      const snapshot = createSnapshot({
        roomId,
        roomState: "RESULT",
        settings: createBplSettings(bplJoinCode),
        players: bplPlayers,
        picks: [
          createPick(HOST_PLAYER_ID, bplChartOne, isoAt(nowMs, -420)),
          createPick(GUEST_PLAYER_ID, bplChartTwo, isoAt(nowMs, -390)),
        ],
        frozenRounds: [
          createFrozenRound(bplChartOne, 0, isoAt(nowMs, -330)),
          createFrozenRound(bplChartTwo, 1, isoAt(nowMs, -240)),
          createFrozenRound(bplChartThree, 2, isoAt(nowMs, -120)),
        ],
        resultDeadline: isoAt(nowMs, 30),
        resultReady: true,
        createdAt,
      });

      return {
        id,
        label: "BPL Final",
        settings,
        room: {
          roomId,
          joinCode: bplJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: BPL final result.",
          snapshot,
          resultReady,
          roundConfirmations: {},
          endedRoundIndices: [0, 1, 2],
          errorDialog: null,
          eventLog: ["Mock scenario: BPL final result.", "Result summary ready."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "arena-lobby": {
      const snapshot = createSnapshot({
        roomId,
        roomState: "LOBBY",
        settings: createArenaSettings(arenaJoinCode),
        players: arenaPlayers,
        readyCheckDeadline: isoAt(nowMs, 1_200),
        createdAt,
      });

      return {
        id,
        label: "Arena Lobby",
        settings,
        room: {
          roomId,
          joinCode: arenaJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: Arena lobby.",
          snapshot,
          resultReady: null,
          roundConfirmations: {},
          endedRoundIndices: [],
          errorDialog: null,
          eventLog: ["Mock scenario: Arena lobby."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "arena-picking": {
      const snapshot = createSnapshot({
        roomId,
        roomState: "PICKING",
        settings: createArenaSettings(arenaJoinCode),
        players: arenaPlayers,
        picks: [
          createPick(GUEST_PLAYER_ID, arenaChartTwo, isoAt(nowMs, -40)),
          createPick(ARENA_PLAYER_3_ID, arenaChartThree, isoAt(nowMs, -32)),
        ],
        pickingDeadline: isoAt(nowMs, 84),
        createdAt,
      });

      return {
        id,
        label: "Arena Picking",
        settings,
        room: {
          roomId,
          joinCode: arenaJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: Arena picking.",
          snapshot,
          resultReady: null,
          roundConfirmations: {},
          endedRoundIndices: [],
          errorDialog: null,
          eventLog: ["Mock scenario: Arena picking."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "arena-playing": {
      const currentRound = createCurrentRound(
        arenaChartOne,
        1,
        isoAt(nowMs, -72),
        [
          {
            player_id: HOST_PLAYER_ID,
            status: "PLAYED",
            metric_value: 3281,
            reason: null,
            submitted_by: "SELF",
            submitted_at: isoAt(nowMs, -8),
            source_meta: null,
          },
          {
            player_id: GUEST_PLAYER_ID,
            status: "PLAYED",
            metric_value: 3102,
            reason: null,
            submitted_by: "SELF",
            submitted_at: isoAt(nowMs, -7),
            source_meta: null,
          },
        ],
        180,
      );
      const snapshot = createSnapshot({
        roomId,
        roomState: "PLAYING",
        settings: createArenaSettings(arenaJoinCode),
        players: arenaPlayers,
        picks: [
          createPick(HOST_PLAYER_ID, arenaChartOne, isoAt(nowMs, -200)),
          createPick(GUEST_PLAYER_ID, arenaChartTwo, isoAt(nowMs, -190)),
          createPick(ARENA_PLAYER_3_ID, arenaChartThree, isoAt(nowMs, -180)),
          createPick(ARENA_PLAYER_4_ID, arenaChartFour, isoAt(nowMs, -170)),
        ],
        frozenRounds: [
          createFrozenRound(arenaChartTwo, 0, isoAt(nowMs, -290)),
          createFrozenRound(arenaChartOne, 1, currentRound.round_started_at),
        ],
        currentRound,
        matchDeadline: isoAt(nowMs, 108),
        createdAt,
      });

      return {
        id,
        label: "Arena Playing",
        settings,
        room: {
          roomId,
          joinCode: arenaJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: Arena playing.",
          snapshot,
          resultReady: null,
          roundConfirmations: {},
          endedRoundIndices: [0],
          errorDialog: null,
          eventLog: ["Mock scenario: Arena playing."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "arena-result": {
      const resultReady = createResultReady({
        mode: "ARENA",
        totalRounds: 4,
        winnerPlayerIds: [HOST_PLAYER_ID],
        players: [
          { playerId: HOST_PLAYER_ID, displayName: "PLAYER_ONE", totalPoints: 17, totalExScore: 12_444, roundWins: 2 },
          { playerId: GUEST_PLAYER_ID, displayName: "RIVAL_KUN", totalPoints: 13, totalExScore: 12_031, roundWins: 1 },
          { playerId: ARENA_PLAYER_3_ID, displayName: "IIDX_CHAMP", totalPoints: 11, totalExScore: 11_998, roundWins: 1 },
          { playerId: ARENA_PLAYER_4_ID, displayName: "ARENA_PRO", totalPoints: 8, totalExScore: 11_422, roundWins: 0 },
        ],
        rounds: [
          {
            roundIndex: 0,
            chart: arenaChartTwo,
            winnerPlayerIds: [HOST_PLAYER_ID],
            results: [
              { playerId: HOST_PLAYER_ID, displayName: "PLAYER_ONE", metricValue: 3320, arenaPoints: 5 },
              { playerId: GUEST_PLAYER_ID, displayName: "RIVAL_KUN", metricValue: 3208, arenaPoints: 4 },
              { playerId: ARENA_PLAYER_3_ID, displayName: "IIDX_CHAMP", metricValue: 3181, arenaPoints: 3 },
              { playerId: ARENA_PLAYER_4_ID, displayName: "ARENA_PRO", metricValue: 3050, arenaPoints: 1 },
            ],
          },
          {
            roundIndex: 1,
            chart: arenaChartOne,
            winnerPlayerIds: [GUEST_PLAYER_ID],
            results: [
              { playerId: HOST_PLAYER_ID, displayName: "PLAYER_ONE", metricValue: 3250, arenaPoints: 4 },
              { playerId: GUEST_PLAYER_ID, displayName: "RIVAL_KUN", metricValue: 3310, arenaPoints: 5 },
              { playerId: ARENA_PLAYER_3_ID, displayName: "IIDX_CHAMP", metricValue: 3221, arenaPoints: 3 },
              { playerId: ARENA_PLAYER_4_ID, displayName: "ARENA_PRO", metricValue: 3010, arenaPoints: 1 },
            ],
          },
        ],
      });
      const snapshot = createSnapshot({
        roomId,
        roomState: "RESULT",
        settings: createArenaSettings(arenaJoinCode),
        players: arenaPlayers,
        picks: [
          createPick(HOST_PLAYER_ID, arenaChartOne, isoAt(nowMs, -260)),
          createPick(GUEST_PLAYER_ID, arenaChartTwo, isoAt(nowMs, -250)),
          createPick(ARENA_PLAYER_3_ID, arenaChartThree, isoAt(nowMs, -240)),
          createPick(ARENA_PLAYER_4_ID, arenaChartFour, isoAt(nowMs, -230)),
        ],
        frozenRounds: [
          createFrozenRound(arenaChartTwo, 0, isoAt(nowMs, -320)),
          createFrozenRound(arenaChartOne, 1, isoAt(nowMs, -120)),
        ],
        resultDeadline: isoAt(nowMs, 12),
        resultReady: true,
        createdAt,
      });

      return {
        id,
        label: "Arena Result",
        settings,
        room: {
          roomId,
          joinCode: arenaJoinCode,
          connectionStatus: "CONNECTED",
          connectionDetail: "Mock scenario: Arena result.",
          snapshot,
          resultReady,
          roundConfirmations: {},
          endedRoundIndices: [0, 1],
          errorDialog: null,
          eventLog: ["Mock scenario: Arena result.", "Result summary ready."],
        },
        charts: VISUAL_CHARTS,
      };
    }
    case "room-closed":
    default: {
      const snapshot = createSnapshot({
        roomId,
        roomState: "CLOSED",
        settings: createBplSettings(bplJoinCode),
        players: bplPlayers,
        resultReady: false,
        createdAt,
        closedAt: isoAt(nowMs, -5),
        closeReason: "HOST_ABORTED",
      });

      return {
        id: "room-closed",
        label: "Room Closed",
        settings,
        room: {
          roomId,
          joinCode: bplJoinCode,
          connectionStatus: "CLOSED",
          connectionDetail: "Mock scenario: Room closed.",
          snapshot,
          resultReady: null,
          roundConfirmations: {},
          endedRoundIndices: [],
          errorDialog: null,
          eventLog: ["Mock scenario: Room closed."],
        },
        charts: VISUAL_CHARTS,
      };
    }
  }
}

export function getVisualScenario(id: string): VisualScenario | null {
  if (!VISUAL_SCENARIO_IDS.includes(id as VisualScenarioId)) {
    return null;
  }

  return buildScenario(id as VisualScenarioId, Date.now());
}

export function listVisualScenarioCharts(id: string, query: ChartSearchQuery): ChartSearchResponse {
  const scenario = getVisualScenario(id);
  const charts = scenario?.charts ?? VISUAL_CHARTS;
  const offset = Math.max(0, Number(query.cursor ?? "0") || 0);
  const limit = query.limit ?? 20;
  const keyword = query.keyword?.trim().toLowerCase() ?? "";

  const filteredCharts = charts.filter((chart) => {
    if (chart.play_style !== query.play_style) {
      return false;
    }
    if (!matchesLevelFilter(chart, query.level_filter)) {
      return false;
    }
    if (query.difficulty !== undefined && chart.difficulty !== query.difficulty) {
      return false;
    }
    if (query.level !== undefined && chart.level !== query.level) {
      return false;
    }
    if (keyword.length === 0) {
      return true;
    }

    return [
      chart.title,
      chart.title_search_key,
      chart.artist,
      chart.genre,
    ].some((value) => value.toLowerCase().includes(keyword));
  });

  const page = filteredCharts.slice(offset, offset + limit);
  return {
    charts: page,
    next_cursor: offset + limit < filteredCharts.length ? String(offset + limit) : null,
  };
}

export function findVisualScenarioChart(id: string, expectedKey: ExpectedKey | null | undefined): ChartSearchEntry | null {
  if (!expectedKey) {
    return null;
  }

  const scenario = getVisualScenario(id);
  const charts = scenario?.charts ?? VISUAL_CHARTS;
  return (
    charts.find(
      (chart) =>
        chart.play_style === expectedKey.play_style &&
        chart.difficulty === expectedKey.difficulty &&
        chart.title_search_key === expectedKey.title_search_key,
    ) ?? null
  );
}
