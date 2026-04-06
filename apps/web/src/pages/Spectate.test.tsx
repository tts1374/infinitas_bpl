import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RoomStateSnapshot, ServerMessageType } from "@infinitas/shared";
import { SpectatePage } from "./Spectate";

const ROOM_ID = "room-test-001";
const WS_URL = `ws://127.0.0.1:8787/api/rooms/${ROOM_ID}/ws`;

type WebSocketListener = (event: unknown) => void;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sentPayloads: string[] = [];
  private readonly listeners: Record<string, WebSocketListener[]> = {
    open: [],
    message: [],
    close: [],
    error: [],
  };

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: WebSocketListener): void {
    const list = this.listeners[type];
    if (list === undefined) {
      return;
    }
    list.push(listener);
  }

  send(payload: string): void {
    this.sentPayloads.push(payload);
  }

  close(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", { code, reason, wasClean: true });
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open", {});
  }

  emitServerMessage(type: ServerMessageType, payload: unknown): void {
    this.emit("message", {
      data: JSON.stringify({
        type,
        payload,
      }),
    });
  }

  private emit(type: string, event: unknown): void {
    const list = this.listeners[type];
    if (list === undefined) {
      return;
    }
    for (const listener of list) {
      listener(event);
    }
  }
}

function createSnapshot(options: {
  currentRoundIndex: number | null;
  confirmedMetrics?: Record<string, number>;
  frozenRoundCount?: number;
  mode?: "ARENA" | "BPL";
}): RoomStateSnapshot {
  const frozenRoundCount = options.frozenRoundCount ?? 2;
  const mode = options.mode ?? "ARENA";
  const frozenRounds = Array.from({ length: frozenRoundCount }, (_, index) => ({
    round_index: index,
    expected_key: {
      play_style: "SP" as const,
      difficulty: "ANOTHER",
      title_search_key: `song-${index}`,
    },
    display: {
      title: `Song ${index}`,
      level: 10 + index,
    },
    started_at: "2026-04-05T12:00:00.000Z",
    soft_ttl_seconds: 300,
  }));

  const confirmed = Object.entries(options.confirmedMetrics ?? {}).map(([playerId, metricValue]) => ({
    player_id: playerId,
    status: "PLAYED" as const,
    metric_value: metricValue,
    reason: null,
    submitted_by: "SELF" as const,
    submitted_at: "2026-04-05T12:01:00.000Z",
    source_meta: null,
  }));

  const currentRound =
    options.currentRoundIndex === null
      ? null
      : {
          round_index: options.currentRoundIndex,
          expected_key: frozenRounds[options.currentRoundIndex]?.expected_key ?? {
            play_style: "SP" as const,
            difficulty: "ANOTHER",
            title_search_key: "song-fallback",
          },
          round_started_at: "2026-04-05T12:00:00.000Z",
          soft_ttl_seconds: 300,
          confirmed,
        };

  return {
    room_id: ROOM_ID,
    room_state: "PLAYING",
    settings: {
      visibility: "PRIVATE",
      join_code: "ABCD1234",
      mode,
      win_metric: "SCORE",
      play_style: "SP",
      level_filter: "ANY",
      room_comment: "",
      max_players: 2,
    },
    host_player_id: "p1",
    players: [
      {
        player_id: "p1",
        display_name: "PLAYER1",
        source: "inf-notebook",
        connected: true,
        ready: true,
        role: "HOST",
      },
      {
        player_id: "p2",
        display_name: "PLAYER2",
        source: "reflux",
        connected: true,
        ready: true,
        role: "GUEST",
      },
    ],
    picks: [],
    frozen_rounds: frozenRounds,
    current_round: currentRound,
    timers: {
      ready_check_deadline: null,
      picking_deadline: null,
      match_deadline: null,
      result_deadline: null,
    },
    result_ready: false,
    created_at: "2026-04-05T11:59:00.000Z",
    closed_at: null,
    close_reason: null,
  };
}

async function connectAndJoin(snapshot: RoomStateSnapshot): Promise<MockWebSocket> {
  render(<SpectatePage />);

  const connectButton = screen.getByRole("button", { name: "CONNECT TO MATCH" });
  fireEvent.click(connectButton);

  const ws = MockWebSocket.instances.at(-1);
  if (ws === undefined) {
    throw new Error("WebSocket was not created.");
  }

  expect(ws.url).toBe(WS_URL);

  await act(async () => {
    ws.open();
  });

  await act(async () => {
    ws.emitServerMessage("ROOM_JOIN_ACCEPTED", {
      room_state_snapshot: snapshot,
      session_role: "SPECTATOR",
    });
  });

  await waitFor(() => {
    expect(screen.queryByText("Spectator Connect")).toBeNull();
  });

  return ws;
}

describe("SpectatePage", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");
    Object.defineProperty(globalThis, "WebSocket", {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    });
    window.history.replaceState({}, "", `/spectate/?r=${ROOM_ID}`);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows '次曲準備中' on round 0 when next frozen round does not exist", async () => {
    const snapshot = createSnapshot({
      currentRoundIndex: 0,
      confirmedMetrics: {},
      frozenRoundCount: 1,
    });

    await connectAndJoin(snapshot);

    expect(screen.getByText("LIVE Next Preview")).toBeDefined();
    expect(screen.getByText("次曲準備中")).toBeDefined();
  });

  it("keeps previous result while previewing live next round during sticky state", async () => {
    const round0Snapshot = createSnapshot({
      currentRoundIndex: 0,
      confirmedMetrics: {
        p1: 2900,
        p2: 2750,
      },
      frozenRoundCount: 2,
    });
    const ws = await connectAndJoin(round0Snapshot);

    const round1StartedSnapshot = createSnapshot({
      currentRoundIndex: 1,
      confirmedMetrics: {},
      frozenRoundCount: 2,
    });

    await act(async () => {
      ws.emitServerMessage("ROOM_UPDATED", {
        room_state_snapshot: round1StartedSnapshot,
      });
    });

    expect(screen.getByText("Song 0")).toBeDefined();
    expect(screen.getByText("Song 1")).toBeDefined();
    expect(screen.getByText("上段は直前ラウンド結果を保持中です（次曲の提出開始まで）。")).toBeDefined();
  });

  it("releases sticky state after first confirmation in the live round", async () => {
    const round0Snapshot = createSnapshot({
      currentRoundIndex: 0,
      confirmedMetrics: {
        p1: 2900,
        p2: 2750,
      },
      frozenRoundCount: 2,
    });
    const ws = await connectAndJoin(round0Snapshot);

    await act(async () => {
      ws.emitServerMessage("ROOM_UPDATED", {
        room_state_snapshot: createSnapshot({
          currentRoundIndex: 1,
          confirmedMetrics: {},
          frozenRoundCount: 2,
        }),
      });
    });

    expect(screen.getByText("上段は直前ラウンド結果を保持中です（次曲の提出開始まで）。")).toBeDefined();

    await act(async () => {
      ws.emitServerMessage("PLAYER_ROUND_CONFIRMED", {
        round_index: 1,
        player_id: "p1",
        status: "PLAYED",
        metric_value: 3000,
        reason: null,
        submitted_at: "2026-04-05T12:03:00.000Z",
        submitted_by: "SELF",
        source_meta: null,
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("上段は直前ラウンド結果を保持中です（次曲の提出開始まで）。")).toBeNull();
    });
  });

  it("matches snapshot for connected layout", async () => {
    const snapshot = createSnapshot({
      currentRoundIndex: 0,
      confirmedMetrics: {
        p1: 2888,
      },
      frozenRoundCount: 2,
    });

    const { asFragment } = render(<SpectatePage />);
    fireEvent.click(screen.getByRole("button", { name: "CONNECT TO MATCH" }));

    const ws = MockWebSocket.instances.at(-1);
    if (ws === undefined) {
      throw new Error("WebSocket was not created.");
    }

    await act(async () => {
      ws.open();
      ws.emitServerMessage("ROOM_JOIN_ACCEPTED", {
        room_state_snapshot: snapshot,
        session_role: "SPECTATOR",
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Spectator Connect")).toBeNull();
    });

    expect(asFragment()).toMatchSnapshot();
  });
});
