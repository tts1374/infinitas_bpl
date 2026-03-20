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

type GetView = () => string;

let runnerStarted = false;
let roomConnectRequested = false;
let pickRequestInFlight = false;
let lastStateSignature: string | null = null;
let lastFailureSignature: string | null = null;
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
    ownedPackIds: settings.ownedPackIds,
  };
}

function canAutoStartMatch(snapshot: RoomStateSnapshot): boolean {
  if (snapshot.room_state !== "LOBBY") {
    return false;
  }
  if (snapshot.players.length < 2) {
    return false;
  }
  if (snapshot.current_round !== null || snapshot.picks.length > 0 || snapshot.frozen_rounds.length > 0) {
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

function buildStateDumpPayload(activeView: string) {
  const roomState = roomStore.getState();
  const sourceState = sourceStore.getState();
  const settingsState = settingsStore.getState();

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
    return;
  }

  const activePlayerId = getActivePlayerId();
  const me = snapshot.players.find((player) => player.player_id === activePlayerId);
  if (me && !me.ready) {
    roomStore.send("READY_SET", { ready: true });
    return;
  }

  if (activePlayerId === snapshot.host_player_id && canAutoStartMatch(snapshot)) {
    roomStore.startMatch();
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
    return;
  }

  const activePlayerId = getActivePlayerId();
  if (snapshot.picks.some((pick) => pick.player_id === activePlayerId)) {
    return;
  }

  pickRequestInFlight = true;
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
      await logE2EEvent("auto_pick_failed", {
        roomId: snapshot.room_id,
        reason: "no chart candidates from room chart search",
      });
      return;
    }

    roomStore.submitPick(nextChart.chart_key);
  } catch (error) {
    await logE2EEvent("auto_pick_failed", {
      roomId: snapshot.room_id,
      reason: error instanceof Error ? error.message : "unknown error",
    });
  } finally {
    pickRequestInFlight = false;
  }
}

async function runAutomationStep(getView: GetView): Promise<void> {
  await ensureRoomConnected();
  await maybeAutoReadyAndStart();
  await maybeAutoPick();
  await updateStateDump(getView(), "automation_step");
  await maybeCaptureFailure(getView());
}

function clearRunnerState(): void {
  runnerStarted = false;
  roomConnectRequested = false;
  pickRequestInFlight = false;
  lastStateSignature = null;
  lastFailureSignature = null;
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

  void runAutomationStep(getView);

  return () => {
    clearRunnerState();
  };
}
