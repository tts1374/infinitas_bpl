import {
  MATCHMAKING_ARENA_MAX_PLAYERS,
  MATCHMAKING_ARENA_MIN_PLAYERS,
  MATCHMAKING_ARENA_PARTIAL_START_SECONDS,
  MATCHMAKING_INITIAL_RATING_RANGE,
  MATCHMAKING_RATING_RANGE_MAX,
  MATCHMAKING_RATING_RANGE_STEP,
  MATCHMAKING_RATING_RANGE_STEP_SECONDS,
  MODES,
  PLAY_STYLES,
  WIN_METRICS,
  type MatchmakingQueueRequest,
  type MatchmakingQueueTicket,
  type MatchmakingTicketStatus,
  type Mode,
  type PlayStyle,
  type RoomSettings,
  type WinMetric,
} from "@infinitas/shared";
import { createRoom } from "../services/room-create";
import type { WorkerEnv } from "../types/env";
import { asEnumValue, asOptionalString, isRecord } from "../utils/validation";

interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

interface MatchmakingQueueTicketRecord {
  ticket_id: string;
  status: MatchmakingTicketStatus;
  mode: Mode;
  play_style: PlayStyle;
  win_metric: WinMetric;
  rating: number;
  player_id: string;
  display_name: string;
  queued_at: string;
  updated_at: string;
  room_id: string | null;
  matched_player_count: number | null;
}

const TICKETS_STORAGE_KEY = "matchmaking-tickets";
const INTERNAL_QUEUE_TICKET_PATH_PATTERN = /^\/internal\/queue\/([^/]+)$/;

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function parseIsoTimeMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseQueueRequest(payload: unknown): MatchmakingQueueRequest | null {
  if (!isRecord(payload)) {
    return null;
  }

  const mode = asEnumValue(payload.mode, MODES);
  const playStyle = asEnumValue(payload.play_style, PLAY_STYLES);
  const winMetric = asEnumValue(payload.win_metric, WIN_METRICS);
  const rawRating = payload.rating;
  const playerId = asOptionalString(payload.player_id)?.trim() ?? "";
  const displayName = asOptionalString(payload.display_name)?.trim() ?? "";

  if (
    mode === undefined ||
    playStyle === undefined ||
    winMetric === undefined ||
    !isFiniteNumber(rawRating) ||
    playerId.length === 0 ||
    displayName.length === 0
  ) {
    return null;
  }

  const normalizedRating = Math.trunc(rawRating);
  if (normalizedRating < 0) {
    return null;
  }

  return {
    mode,
    play_style: playStyle,
    win_metric: winMetric,
    rating: normalizedRating,
    player_id: playerId,
    display_name: displayName,
  };
}

function matchTicketPath(pathname: string): string | null {
  const match = INTERNAL_QUEUE_TICKET_PATH_PATTERN.exec(pathname);
  if (!match) {
    return null;
  }

  const [, encodedTicketId] = match;
  if (!encodedTicketId) {
    return null;
  }

  return decodeURIComponent(encodedTicketId);
}

function parseStoredTicket(payload: unknown): MatchmakingQueueTicketRecord | null {
  if (!isRecord(payload)) {
    return null;
  }

  const ticketId = asOptionalString(payload.ticket_id)?.trim() ?? "";
  const status = asEnumValue(payload.status, ["SEARCHING", "MATCHED", "CANCELLED"] as const);
  const mode = asEnumValue(payload.mode, MODES);
  const playStyle = asEnumValue(payload.play_style, PLAY_STYLES);
  const winMetric = asEnumValue(payload.win_metric, WIN_METRICS);
  const rating = isFiniteNumber(payload.rating) ? Math.trunc(payload.rating) : NaN;
  const playerId = asOptionalString(payload.player_id)?.trim() ?? "";
  const displayName = asOptionalString(payload.display_name)?.trim() ?? "";
  const queuedAt = asOptionalString(payload.queued_at) ?? "";
  const updatedAt = asOptionalString(payload.updated_at) ?? "";
  const roomId = payload.room_id === null ? null : asOptionalString(payload.room_id) ?? null;
  const matchedPlayerCount =
    payload.matched_player_count === null
      ? null
      : isFiniteNumber(payload.matched_player_count)
        ? Math.trunc(payload.matched_player_count)
        : null;

  if (
    ticketId.length === 0 ||
    status === undefined ||
    mode === undefined ||
    playStyle === undefined ||
    winMetric === undefined ||
    !Number.isFinite(rating) ||
    rating < 0 ||
    playerId.length === 0 ||
    displayName.length === 0 ||
    parseIsoTimeMs(queuedAt) === null ||
    parseIsoTimeMs(updatedAt) === null
  ) {
    return null;
  }

  return {
    ticket_id: ticketId,
    status,
    mode,
    play_style: playStyle,
    win_metric: winMetric,
    rating,
    player_id: playerId,
    display_name: displayName,
    queued_at: queuedAt,
    updated_at: updatedAt,
    room_id: roomId,
    matched_player_count: matchedPlayerCount,
  };
}

function asSerializableRecord(
  tickets: Map<string, MatchmakingQueueTicketRecord>,
): Record<string, MatchmakingQueueTicketRecord> {
  const serialized: Record<string, MatchmakingQueueTicketRecord> = {};
  for (const [ticketId, ticket] of tickets.entries()) {
    serialized[ticketId] = ticket;
  }
  return serialized;
}

function buildStoredTickets(input: unknown): Map<string, MatchmakingQueueTicketRecord> {
  if (!isRecord(input)) {
    return new Map<string, MatchmakingQueueTicketRecord>();
  }

  const tickets = new Map<string, MatchmakingQueueTicketRecord>();
  for (const [ticketId, payload] of Object.entries(input)) {
    const parsed = parseStoredTicket(payload);
    if (parsed === null) {
      continue;
    }
    tickets.set(ticketId, parsed);
  }
  return tickets;
}

function compareByQueuedAt(left: MatchmakingQueueTicketRecord, right: MatchmakingQueueTicketRecord): number {
  const leftQueuedAt = parseIsoTimeMs(left.queued_at) ?? 0;
  const rightQueuedAt = parseIsoTimeMs(right.queued_at) ?? 0;
  if (leftQueuedAt !== rightQueuedAt) {
    return leftQueuedAt - rightQueuedAt;
  }
  return left.ticket_id.localeCompare(right.ticket_id);
}

function clampArenaMaxPlayers(value: number): RoomSettings["max_players"] {
  if (value <= 2) {
    return 2;
  }
  if (value === 3) {
    return 3;
  }
  return 4;
}

export class MatchmakingDurableObject {
  private readonly tickets = new Map<string, MatchmakingQueueTicketRecord>();
  private readonly readyPromise: Promise<void>;

  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: WorkerEnv,
  ) {
    this.readyPromise = this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Record<string, MatchmakingQueueTicketRecord>>(TICKETS_STORAGE_KEY);
      if (stored === undefined) {
        return;
      }

      const restored = buildStoredTickets(stored);
      this.tickets.clear();
      for (const [ticketId, ticket] of restored.entries()) {
        this.tickets.set(ticketId, ticket);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.readyPromise;

    const url = new URL(request.url);
    if (url.pathname === "/internal/queue" && request.method === "POST") {
      return this.handleEnqueue(request);
    }

    const ticketId = matchTicketPath(url.pathname);
    if (ticketId !== null) {
      if (request.method === "GET") {
        return this.handleGetTicket(ticketId);
      }
      if (request.method === "DELETE") {
        return this.handleCancelTicket(ticketId);
      }
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleEnqueue(request: Request): Promise<Response> {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON payload." });
    }

    const parsed = parseQueueRequest(payload);
    if (parsed === null) {
      return jsonResponse(400, { error: "Invalid matchmaking queue payload." });
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const ticketId = crypto.randomUUID();
    const ticket: MatchmakingQueueTicketRecord = {
      ticket_id: ticketId,
      status: "SEARCHING",
      mode: parsed.mode,
      play_style: parsed.play_style,
      win_metric: parsed.win_metric,
      rating: parsed.rating,
      player_id: parsed.player_id,
      display_name: parsed.display_name,
      queued_at: nowIso,
      updated_at: nowIso,
      room_id: null,
      matched_player_count: null,
    };

    this.tickets.set(ticketId, ticket);
    await this.matchTickets(nowMs);
    await this.persistTickets();

    return jsonResponse(201, this.buildQueueTicketResponse(ticketId, Date.now()));
  }

  private async handleGetTicket(ticketId: string): Promise<Response> {
    const normalizedTicketId = ticketId.trim();
    if (normalizedTicketId.length === 0) {
      return jsonResponse(400, { error: "ticket_id is required." });
    }

    const ticket = this.tickets.get(normalizedTicketId);
    if (ticket === undefined) {
      return jsonResponse(404, { error: "Ticket not found." });
    }

    if (ticket.status === "SEARCHING") {
      await this.matchTickets(Date.now());
      await this.persistTickets();
    }

    return jsonResponse(200, this.buildQueueTicketResponse(normalizedTicketId, Date.now()));
  }

  private async handleCancelTicket(ticketId: string): Promise<Response> {
    const normalizedTicketId = ticketId.trim();
    if (normalizedTicketId.length === 0) {
      return jsonResponse(400, { error: "ticket_id is required." });
    }

    const ticket = this.tickets.get(normalizedTicketId);
    if (ticket === undefined) {
      return jsonResponse(404, { error: "Ticket not found." });
    }

    if (ticket.status === "SEARCHING") {
      const nowIso = new Date().toISOString();
      this.tickets.set(normalizedTicketId, {
        ...ticket,
        status: "CANCELLED",
        updated_at: nowIso,
      });
      await this.persistTickets();
    }

    return jsonResponse(200, this.buildQueueTicketResponse(normalizedTicketId, Date.now()));
  }

  private buildQueueTicketResponse(ticketId: string, nowMs: number): MatchmakingQueueTicket {
    const ticket = this.tickets.get(ticketId);
    if (ticket === undefined) {
      throw new Error(`Unknown ticket: ${ticketId}`);
    }

    return {
      ticket_id: ticket.ticket_id,
      status: ticket.status,
      mode: ticket.mode,
      play_style: ticket.play_style,
      win_metric: ticket.win_metric,
      rating: ticket.rating,
      queued_at: ticket.queued_at,
      updated_at: ticket.updated_at,
      current_tolerance: this.computeTolerance(ticket, nowMs),
      candidate_count: ticket.status === "SEARCHING" ? this.countCompatibleCandidates(ticket, nowMs) : 0,
      room_id: ticket.room_id,
      matched_player_count: ticket.matched_player_count,
    };
  }

  private async matchTickets(nowMs: number): Promise<void> {
    const searchingTickets = Array.from(this.tickets.values())
      .filter((ticket) => ticket.status === "SEARCHING")
      .sort(compareByQueuedAt);
    if (searchingTickets.length < 2) {
      return;
    }

    const bucketMap = new Map<string, MatchmakingQueueTicketRecord[]>();
    for (const ticket of searchingTickets) {
      const key = this.buildBucketKey(ticket.mode, ticket.play_style, ticket.win_metric);
      const bucket = bucketMap.get(key) ?? [];
      bucket.push(ticket);
      bucketMap.set(key, bucket);
    }

    for (const bucket of bucketMap.values()) {
      const mode = bucket[0]?.mode;
      if (mode === undefined) {
        continue;
      }

      if (mode === "ARENA") {
        await this.matchArenaBucket(bucket, nowMs);
      } else {
        await this.matchDuelBucket(bucket, nowMs);
      }
    }
  }

  private async matchArenaBucket(
    inputTickets: MatchmakingQueueTicketRecord[],
    nowMs: number,
  ): Promise<void> {
    const consumedTicketIds = new Set<string>();
    const tickets = inputTickets
      .filter((ticket) => ticket.status === "SEARCHING")
      .sort(compareByQueuedAt);

    for (const anchor of tickets) {
      if (consumedTicketIds.has(anchor.ticket_id)) {
        continue;
      }

      const candidates = tickets.filter(
        (candidate) =>
          !consumedTicketIds.has(candidate.ticket_id) &&
          candidate.ticket_id !== anchor.ticket_id &&
          candidate.status === "SEARCHING",
      );
      if (candidates.length === 0) {
        continue;
      }

      const fullParty = this.collectCompatibleGroup(
        anchor,
        candidates,
        MATCHMAKING_ARENA_MAX_PLAYERS,
        MATCHMAKING_ARENA_MAX_PLAYERS,
        nowMs,
      );
      if (fullParty !== null && (await this.completeMatch(fullParty))) {
        for (const ticket of fullParty) {
          consumedTicketIds.add(ticket.ticket_id);
        }
        continue;
      }

      const waitSeconds = this.getWaitSeconds(anchor, nowMs);
      if (waitSeconds < MATCHMAKING_ARENA_PARTIAL_START_SECONDS) {
        continue;
      }

      const partialParty = this.collectCompatibleGroup(
        anchor,
        candidates,
        MATCHMAKING_ARENA_MAX_PLAYERS,
        MATCHMAKING_ARENA_MIN_PLAYERS,
        nowMs,
      );
      if (partialParty !== null && (await this.completeMatch(partialParty))) {
        for (const ticket of partialParty) {
          consumedTicketIds.add(ticket.ticket_id);
        }
      }
    }
  }

  private async matchDuelBucket(
    inputTickets: MatchmakingQueueTicketRecord[],
    nowMs: number,
  ): Promise<void> {
    const consumedTicketIds = new Set<string>();
    const tickets = inputTickets
      .filter((ticket) => ticket.status === "SEARCHING")
      .sort(compareByQueuedAt);

    for (const anchor of tickets) {
      if (consumedTicketIds.has(anchor.ticket_id)) {
        continue;
      }

      const partner = tickets.find(
        (candidate) =>
          candidate.ticket_id !== anchor.ticket_id &&
          !consumedTicketIds.has(candidate.ticket_id) &&
          candidate.status === "SEARCHING" &&
          this.isCompatible(anchor, candidate, nowMs),
      );
      if (partner === undefined) {
        continue;
      }

      if (await this.completeMatch([anchor, partner])) {
        consumedTicketIds.add(anchor.ticket_id);
        consumedTicketIds.add(partner.ticket_id);
      }
    }
  }

  private collectCompatibleGroup(
    anchor: MatchmakingQueueTicketRecord,
    candidates: MatchmakingQueueTicketRecord[],
    maxPlayers: number,
    minPlayers: number,
    nowMs: number,
  ): MatchmakingQueueTicketRecord[] | null {
    const group: MatchmakingQueueTicketRecord[] = [anchor];
    const sortedCandidates = [...candidates].sort(compareByQueuedAt);
    for (const candidate of sortedCandidates) {
      if (group.length >= maxPlayers) {
        break;
      }

      const compatibleWithAll = group.every((member) => this.isCompatible(member, candidate, nowMs));
      if (!compatibleWithAll) {
        continue;
      }

      group.push(candidate);
    }

    return group.length >= minPlayers ? group : null;
  }

  private async completeMatch(group: MatchmakingQueueTicketRecord[]): Promise<boolean> {
    if (group.length < 2) {
      return false;
    }

    try {
      const room = await createRoom(this.env, this.buildMatchRoomSettings(group));
      const matchedAt = new Date().toISOString();
      for (const ticket of group) {
        const current = this.tickets.get(ticket.ticket_id);
        if (current === undefined || current.status !== "SEARCHING") {
          continue;
        }
        this.tickets.set(ticket.ticket_id, {
          ...current,
          status: "MATCHED",
          updated_at: matchedAt,
          room_id: room.room_id,
          matched_player_count: group.length,
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  private buildMatchRoomSettings(group: MatchmakingQueueTicketRecord[]): RoomSettings {
    const first = group[0];
    if (first === undefined) {
      throw new Error("Matchmaking group must not be empty.");
    }

    const maxPlayers =
      first.mode === "ARENA"
        ? clampArenaMaxPlayers(Math.min(Math.max(group.length, MATCHMAKING_ARENA_MIN_PLAYERS), MATCHMAKING_ARENA_MAX_PLAYERS))
        : 2;

    return {
      visibility: "PUBLIC",
      join_code: null,
      auto_rematch: false,
      auto_match: true,
      mode: first.mode,
      win_metric: first.win_metric,
      play_style: first.play_style,
      level_filter: "ANY",
      room_comment: `Auto Match ${first.mode} ${first.play_style}`,
      max_players: maxPlayers,
    };
  }

  private countCompatibleCandidates(anchor: MatchmakingQueueTicketRecord, nowMs: number): number {
    let count = 0;
    for (const ticket of this.tickets.values()) {
      if (
        ticket.ticket_id === anchor.ticket_id ||
        ticket.status !== "SEARCHING" ||
        ticket.mode !== anchor.mode ||
        ticket.play_style !== anchor.play_style ||
        ticket.win_metric !== anchor.win_metric
      ) {
        continue;
      }

      if (this.isCompatible(anchor, ticket, nowMs)) {
        count += 1;
      }
    }

    return count;
  }

  private isCompatible(
    left: MatchmakingQueueTicketRecord,
    right: MatchmakingQueueTicketRecord,
    nowMs: number,
  ): boolean {
    const leftTolerance = this.computeTolerance(left, nowMs);
    const rightTolerance = this.computeTolerance(right, nowMs);
    return Math.abs(left.rating - right.rating) <= Math.min(leftTolerance, rightTolerance);
  }

  private computeTolerance(ticket: MatchmakingQueueTicketRecord, nowMs: number): number {
    const queuedAtMs = parseIsoTimeMs(ticket.queued_at);
    if (queuedAtMs === null) {
      return MATCHMAKING_INITIAL_RATING_RANGE;
    }

    const elapsedSeconds = Math.max(0, Math.floor((nowMs - queuedAtMs) / 1_000));
    const stepCount = Math.floor(elapsedSeconds / MATCHMAKING_RATING_RANGE_STEP_SECONDS);
    return Math.min(
      MATCHMAKING_INITIAL_RATING_RANGE + stepCount * MATCHMAKING_RATING_RANGE_STEP,
      MATCHMAKING_RATING_RANGE_MAX,
    );
  }

  private getWaitSeconds(ticket: MatchmakingQueueTicketRecord, nowMs: number): number {
    const queuedAtMs = parseIsoTimeMs(ticket.queued_at);
    if (queuedAtMs === null) {
      return 0;
    }
    return Math.max(0, Math.floor((nowMs - queuedAtMs) / 1_000));
  }

  private buildBucketKey(mode: Mode, playStyle: PlayStyle, winMetric: WinMetric): string {
    return `${mode}:${playStyle}:${winMetric}`;
  }

  private async persistTickets(): Promise<void> {
    await this.state.storage.put(TICKETS_STORAGE_KEY, asSerializableRecord(this.tickets));
  }
}
