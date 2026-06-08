import type { ChartSearchQuery, RoomStateSnapshot } from "@infinitas/shared";
import { runtimeConfig } from "../runtime/runtime-config";
import { listRoomCharts } from "./worker-api-client";
import {
  captureE2EScreenshot,
  initializeE2EObservability,
  logE2EEvent,
  writeE2EStateDump,
} from "./e2e-observability";
import { roomStore } from "../stores/room-store";
import { settingsStore, isRoomEntryReady } from "../stores/settings-store";
import { sourceStore } from "../stores/source-store";
import { readMatchHistory } from "./match-history-overlay";
import { selectActiveMatchHistory } from "./match-history-view-model";
import { statsArchiveService } from "./stats-archive";

type GetView = () => string;

let runnerStarted = false;
let roomConnectRequested = false;
let automationStepInFlight = false;
let automationStepQueued = false;
let pickRequestInFlight = false;
let lastStateSignature: string | null = null;
let lastFailureSignature: string | null = null;
let readyRequestedKey: string | null = null;
let startMatchRequestedKey: string | null = null;
let pickRequestedKey: string | null = null;
const completedMatchIds = new Set<string>();
let returnToLobbyRequestedForMatchId: string | null = null;
const stopSubscriptions: (() => void)[] = [];

function getActivePlayerId(): string {
  const roomState = roomStore.getState();
  return roomState.connectionPlayerId ?? settingsStore.getState().saved.playerId;
}

function buildRoomConnectionSettings() {
  const settings = settingsStore.getState().saved;
  return {
    apiBaseUrl: settings.apiBaseUrl,
    playerId: settings.playerId,
    displayName: settings.displayName,
    source: settings.source,
    bitUnlockEnabled: settings.bitUnlockEnabled,
    djpUnlockEnabled: settings.djpUnlockEnabled,
    allowLeggendaria: settings.allowLeggendaria,
    ownedPackIds: settings.ownedPackIds,
  };
}

function canAutoStartMatch(snapshot: RoomStateSnapshot, activePlayerId: string): boolean {
  if (snapshot.room_state !== "LOBBY") {
    return false;
  }
  if (snapshot.players.length < 2) {
    return false;
  }
  if (snapshot.current_round !== null || snapshot.picks.length > 0 || snapshot.frozen_rounds.length > 0) {
    return false;
  }
  const me = snapshot.players.find((player) => player.player_id === activePlayerId);
  if (me?.source === "daken_counter_v3" && sourceStore.getState().watcherState.status !== "RUNNING") {
    return false;
  }

  return snapshot.players
    .filter((player) => player.player_id !== snapshot.host_player_id)
    .every((player) => player.ready);
}

function buildStateSignature(snapshot: RoomStateSnapshot | null): string {
  if (snapshot === null) {
    return "snapshot:null";
  }

  return [
    snapshot.room_id,
    snapshot.room_state,
    snapshot.players.map((player) => `${player.player_id}:${String(player.ready)}:${String(player.connected)}`).join(","),
    snapshot.picks.map((pick) => `${pick.player_id}:${pick.pick_chart_key}`).join(","),
    snapshot.current_round?.round_index ?? "none",
    snapshot.current_round?.confirmed.length ?? 0,
    String(snapshot.result_ready),
  ].join("|");
}

function buildMatchActionKey(snapshot: RoomStateSnapshot, activePlayerId: string, action: string): string {
  const matchId = snapshot.current_match_id ?? snapshot.room_id;
  return [
    snapshot.room_id,
    String(snapshot.generation ?? "na"),
    matchId,
    activePlayerId,
    action,
  ].join(":");
}

function getRequiredPickCountForPlayer(snapshot: RoomStateSnapshot): number {
  return snapshot.settings.mode === "BPL4" ? 2 : 1;
}

function buildStateDumpPayload(activeView: string) {
  const roomState = roomStore.getState();
  const sourceState = sourceStore.getState();
  const settingsState = settingsStore.getState();
  const matchHistory = readMatchHistory();

  return {
    activeView,
    connectionStatus: roomState.connectionStatus,
    connectionDetail: roomState.connectionDetail,
    roomId: roomState.roomId,
    joinCode: roomState.joinCode,
    activePlayerId: getActivePlayerId(),
    roomSnapshot: roomState.snapshot,
    resultReady: roomState.resultReady,
    roomEventLog: roomState.eventLog,
    sourceWatcherState: sourceState.watcherState,
    sourceLastEvent: sourceState.lastEvent,
    activeUnresolvedDialog: sourceState.activeUnresolvedDialog,
    datasource: settingsState.saved.source,
    sourcePaths: settingsState.saved.sourcePaths,
    matchHistory,
    activeMatchHistory: selectActiveMatchHistory(matchHistory),
    e2e: runtimeConfig.e2e,
  };
}

async function updateStateDump(activeView: string, reason: string): Promise<void> {
  const roomSnapshot = roomStore.getState().snapshot;
  const nextSignature = `${buildStateSignature(roomSnapshot)}|${reason}|${activeView}`;
  if (lastStateSignature === nextSignature) {
    return;
  }

  lastStateSignature = nextSignature;
  await writeE2EStateDump(buildStateDumpPayload(activeView), reason);
  const captureTarget =
    (document.getElementById("visual-capture-root") as HTMLElement | null) ??
    document.body;
  await captureE2EScreenshot("latest", captureTarget);
}

async function maybeCaptureFailure(activeView: string): Promise<void> {
  const roomState = roomStore.getState();
  const dialog = roomState.errorDialog;
  if (!dialog?.blocking) {
    return;
  }

  const signature = `${dialog.code ?? "blocking"}|${dialog.description}|${activeView}`;
  if (lastFailureSignature === signature) {
    return;
  }

  lastFailureSignature = signature;
  await logE2EEvent("blocking_error_dialog", {
    code: dialog.code ?? null,
    description: dialog.description,
    roomState: roomState.snapshot?.room_state ?? null,
  });
  const captureTarget =
    (document.getElementById("visual-capture-root") as HTMLElement | null) ??
    document.body;
  await captureE2EScreenshot("failure", captureTarget);
}

async function ensureRoomConnected(): Promise<void> {
  if (!runtimeConfig.e2e.roomId || roomConnectRequested) {
    return;
  }

  const settings = settingsStore.getState().saved;
  if (!isRoomEntryReady(settings)) {
    return;
  }

  roomConnectRequested = true;
  const connected = roomStore.connect(
    {
      roomId: runtimeConfig.e2e.roomId,
      joinCode: runtimeConfig.e2e.joinCode,
    },
    buildRoomConnectionSettings(),
  );
  if (!connected) {
    roomConnectRequested = false;
    await logE2EEvent("room_join_request_failed", {
      roomId: runtimeConfig.e2e.roomId,
    });
  }
}

async function maybeAutoReadyAndStart(): Promise<void> {
  const roomState = roomStore.getState();
  const snapshot = roomState.snapshot;
  if (snapshot === null || snapshot.room_state !== "LOBBY") {
    readyRequestedKey = null;
    startMatchRequestedKey = null;
    return;
  }

  const activePlayerId = getActivePlayerId();
  const me = snapshot.players.find((player) => player.player_id === activePlayerId);
  if (me && !me.ready) {
    const readyKey = buildMatchActionKey(snapshot, activePlayerId, "ready");
    if (readyRequestedKey === readyKey) {
      return;
    }
    if (roomStore.setReady(true)) {
      readyRequestedKey = readyKey;
    }
    return;
  }
  readyRequestedKey = null;

  if (activePlayerId === snapshot.host_player_id && canAutoStartMatch(snapshot, activePlayerId)) {
    const startKey = buildMatchActionKey(snapshot, activePlayerId, "start");
    if (startMatchRequestedKey === startKey) {
      return;
    }
    if (roomStore.startMatch()) {
      startMatchRequestedKey = startKey;
    }
  }
}

function buildChartSearchQuery(snapshot: RoomStateSnapshot): ChartSearchQuery {
  return {
    play_style: snapshot.settings.play_style,
    level_filter: snapshot.settings.level_filter,
    limit: 20,
  };
}

async function maybeAutoPick(): Promise<void> {
  const roomState = roomStore.getState();
  const snapshot = roomState.snapshot;
  if (snapshot === null || snapshot.room_state !== "PICKING" || pickRequestInFlight) {
    if (snapshot?.room_state !== "PICKING") {
      pickRequestedKey = null;
    }
    return;
  }

  const activePlayerId = getActivePlayerId();
  const ownPickCount = snapshot.picks.filter((pick) => pick.player_id === activePlayerId).length;
  if (ownPickCount >= getRequiredPickCountForPlayer(snapshot)) {
    pickRequestedKey = null;
    return;
  }

  const pickKey = buildMatchActionKey(snapshot, activePlayerId, `pick:${ownPickCount}`);
  if (pickRequestedKey === pickKey) {
    return;
  }

  pickRequestInFlight = true;
  pickRequestedKey = pickKey;
  try {
    const settings = settingsStore.getState().saved;
    const response = await listRoomCharts(
      settings.apiBaseUrl,
      snapshot.room_id,
      buildChartSearchQuery(snapshot),
    );
    const alreadyPicked = new Set(snapshot.picks.map((pick) => pick.pick_chart_key));
    const nextChart =
      response.charts.find((chart) => !alreadyPicked.has(chart.chart_key)) ??
      response.charts[0];

    if (!nextChart) {
      pickRequestedKey = null;
      await logE2EEvent("auto_pick_failed", {
        roomId: snapshot.room_id,
        reason: "no chart candidates from room chart search",
      });
      return;
    }

    if (!roomStore.submitPick(nextChart.chart_key)) {
      pickRequestedKey = null;
    }
  } catch (error) {
    pickRequestedKey = null;
    await logE2EEvent("auto_pick_failed", {
      roomId: snapshot.room_id,
      reason: error instanceof Error ? error.message : "unknown error",
    });
  } finally {
    pickRequestInFlight = false;
  }
}

function resolveResultMatchId(): string | null {
  const roomState = roomStore.getState();
  const snapshot = roomState.snapshot;
  if (snapshot === null) {
    return null;
  }

  const summary = roomState.resultReady?.summary;
  if (summary && typeof summary.match_id === "string" && summary.match_id.trim().length > 0) {
    return summary.match_id;
  }

  if (typeof snapshot.current_match_id === "string" && snapshot.current_match_id.trim().length > 0) {
    return snapshot.current_match_id;
  }

  return typeof snapshot.room_id === "string" && snapshot.room_id.trim().length > 0
    ? snapshot.room_id
    : null;
}

async function maybeAutoReturnToLobbyForRematch(): Promise<void> {
  const roomState = roomStore.getState();
  const snapshot = roomState.snapshot;
  if (snapshot === null || snapshot.room_state !== "RESULT") {
    returnToLobbyRequestedForMatchId = null;
    return;
  }

  const activePlayerId = getActivePlayerId();
  if (runtimeConfig.e2e.matchCount <= 1 || activePlayerId !== snapshot.host_player_id) {
    return;
  }

  const resultMatchId = resolveResultMatchId();
  if (resultMatchId === null) {
    return;
  }

  completedMatchIds.add(resultMatchId);
  if (completedMatchIds.size >= runtimeConfig.e2e.matchCount) {
    return;
  }

  if (returnToLobbyRequestedForMatchId === resultMatchId) {
    return;
  }

  const sent = roomStore.returnToLobby();
  returnToLobbyRequestedForMatchId = resultMatchId;
  await logE2EEvent("return_to_lobby_sent", {
    roomId: snapshot.room_id,
    matchId: resultMatchId,
    actorPlayerId: activePlayerId,
    hostPlayerId: snapshot.host_player_id,
    completedMatches: completedMatchIds.size,
    targetMatches: runtimeConfig.e2e.matchCount,
    sent,
  });
}

async function runAutomationStep(getView: GetView): Promise<void> {
  if (automationStepInFlight) {
    automationStepQueued = true;
    return;
  }

  automationStepInFlight = true;
  try {
    do {
      automationStepQueued = false;
      await ensureRoomConnected();
      await maybeAutoReadyAndStart();
      await maybeAutoPick();
      await maybeAutoReturnToLobbyForRematch();
      await updateStateDump(getView(), "automation_step");
      await maybeCaptureFailure(getView());
    } while (automationStepQueued);
  } finally {
    automationStepInFlight = false;
  }
}

function clearRunnerState(): void {
  runnerStarted = false;
  roomConnectRequested = false;
  automationStepInFlight = false;
  automationStepQueued = false;
  pickRequestInFlight = false;
  lastStateSignature = null;
  lastFailureSignature = null;
  readyRequestedKey = null;
  startMatchRequestedKey = null;
  pickRequestedKey = null;
  completedMatchIds.clear();
  returnToLobbyRequestedForMatchId = null;
  while (stopSubscriptions.length > 0) {
    const stop = stopSubscriptions.pop();
    stop?.();
  }
}

export function startE2EScenarioRunner(getView: GetView): () => void {
  if (!runtimeConfig.e2e.enabled || !runtimeConfig.e2e.roomId || runnerStarted) {
    return () => {
      clearRunnerState();
    };
  }

  runnerStarted = true;
  void initializeE2EObservability();
  void logE2EEvent("scenario_runner_started", {
    scenario: runtimeConfig.e2e.scenario,
    role: runtimeConfig.e2e.role,
    roomId: runtimeConfig.e2e.roomId,
    matchCount: runtimeConfig.e2e.matchCount,
  });

  stopSubscriptions.push(
    settingsStore.subscribe(() => {
      void runAutomationStep(getView);
    }),
  );
  stopSubscriptions.push(
    roomStore.subscribe(() => {
      void runAutomationStep(getView);
    }),
  );
  stopSubscriptions.push(
    sourceStore.subscribe(() => {
      void updateStateDump(getView(), "source_state_changed");
    }),
  );
  stopSubscriptions.push(
    statsArchiveService.subscribe(() => {
      void updateStateDump(getView(), "stats_archive_changed");
    }),
  );

  void runAutomationStep(getView);

  return () => {
    clearRunnerState();
  };
}
