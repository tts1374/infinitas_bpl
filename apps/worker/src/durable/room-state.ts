import { MATCH_TTL_MINUTES, type PlayerRole, type RoomSettings, type RoomState, type RoomStateSnapshot, type SourceType } from "@infinitas/shared";

interface InternalPlayer {
  player_id: string;
  display_name: string;
  source: SourceType;
  connected: boolean;
  ready: boolean;
  role: PlayerRole;
  joined_at: Date;
  left_at: Date | null;
  rejoin_until: Date | null;
}

export interface RoomInitializationInput {
  room_id: string;
  settings: RoomSettings;
  created_at: string;
}

export interface JoinPlayerInput {
  player_id: string;
  display_name: string;
  source: SourceType;
  now: Date;
}

export interface JoinPlayerResult {
  ok: boolean;
  reason?: "ROOM_CLOSED" | "ROOM_FULL";
}

export interface LeavePlayerResult {
  removed: boolean;
  was_host: boolean;
}

const DEFAULT_SETTINGS: RoomSettings = {
  visibility: "PUBLIC",
  join_code: null,
  mode: "ARENA",
  win_metric: "SCORE",
  play_style: "SP",
  level_filter: "ANY",
  room_comment: "",
  max_players: 4,
};

function toIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function computeMatchDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + MATCH_TTL_MINUTES * 60_000);
}

export class RoomLobbyState {
  private initialized = false;
  private roomId = "";
  private roomState: RoomState = "LOBBY";
  private settings: RoomSettings = { ...DEFAULT_SETTINGS };
  private hostPlayerId: string | null = null;
  private createdAt = new Date();
  private matchDeadline = computeMatchDeadline(this.createdAt);
  private resultDeadline: Date | null = null;
  private closedAt: Date | null = null;
  private closeReason: string | null = null;
  private readonly players = new Map<string, InternalPlayer>();

  initialize(input: RoomInitializationInput): void {
    const createdAt = new Date(input.created_at);
    if (!Number.isFinite(createdAt.getTime())) {
      throw new Error("created_at must be ISO8601.");
    }

    if (this.initialized) {
      if (this.roomId !== input.room_id) {
        throw new Error("room_id mismatch on reinitialize.");
      }
      return;
    }

    this.initialized = true;
    this.roomId = input.room_id;
    this.settings = { ...input.settings };
    this.createdAt = createdAt;
    this.matchDeadline = computeMatchDeadline(createdAt);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getRoomId(): string {
    return this.roomId;
  }

  getRoomState(): RoomState {
    return this.roomState;
  }

  getSettings(): RoomSettings {
    return this.settings;
  }

  getHostPlayerId(): string | null {
    return this.hostPlayerId;
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  isPlayerConnected(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player?.connected === true;
  }

  canJoin(playerId: string): boolean {
    if (this.players.has(playerId)) {
      return true;
    }

    return this.players.size < this.settings.max_players;
  }

  joinPlayer(input: JoinPlayerInput): JoinPlayerResult {
    if (this.roomState === "CLOSED") {
      return { ok: false, reason: "ROOM_CLOSED" };
    }

    const existing = this.players.get(input.player_id);
    if (!existing && this.players.size >= this.settings.max_players) {
      return { ok: false, reason: "ROOM_FULL" };
    }

    if (existing) {
      existing.display_name = input.display_name;
      existing.source = input.source;
      existing.connected = true;
      existing.left_at = null;
      existing.ready = false;
      return { ok: true };
    }

    let role: PlayerRole = "GUEST";
    if (this.hostPlayerId === null) {
      this.hostPlayerId = input.player_id;
      role = "HOST";
    }

    this.players.set(input.player_id, {
      player_id: input.player_id,
      display_name: input.display_name,
      source: input.source,
      connected: true,
      ready: false,
      role,
      joined_at: input.now,
      left_at: null,
      rejoin_until: null,
    });

    return { ok: true };
  }

  leavePlayer(playerId: string, now: Date): LeavePlayerResult {
    const player = this.players.get(playerId);
    if (!player) {
      return { removed: false, was_host: false };
    }

    const wasHost = this.hostPlayerId === playerId;
    player.connected = false;
    player.left_at = now;
    this.players.delete(playerId);

    if (wasHost) {
      this.close("HOST_LEFT", now);
    }

    return { removed: true, was_host: wasHost };
  }

  close(reason: string, now: Date): void {
    if (this.roomState === "CLOSED") {
      return;
    }

    this.roomState = "CLOSED";
    this.closeReason = reason;
    this.closedAt = now;
  }

  toSnapshot(): RoomStateSnapshot {
    const players = Array.from(this.players.values())
      .sort((left, right) => left.joined_at.getTime() - right.joined_at.getTime())
      .map((player) => ({
        player_id: player.player_id,
        display_name: player.display_name,
        source: player.source,
        connected: player.connected,
        ready: player.ready,
        role: player.role,
        joined_at: player.joined_at.toISOString(),
        left_at: toIsoString(player.left_at),
        rejoin_until: toIsoString(player.rejoin_until),
      }));

    return {
      room_id: this.roomId,
      room_state: this.roomState,
      settings: this.settings,
      host_player_id: this.hostPlayerId ?? "",
      players,
      picks: [],
      frozen_rounds: [],
      current_round: null,
      timers: {
        ready_check_deadline: null,
        match_deadline: this.matchDeadline.toISOString(),
        result_deadline: toIsoString(this.resultDeadline),
      },
      created_at: this.createdAt.toISOString(),
      closed_at: toIsoString(this.closedAt),
      close_reason: this.closeReason,
    };
  }
}
