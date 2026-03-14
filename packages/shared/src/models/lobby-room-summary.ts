import type { MaxPlayersOption } from "../constants/room";
import type { RoomSettings } from "./room-settings";

export const LOBBY_ROOM_STATUSES = [
  "LOBBY",
  "PICKING",
  "PLAYING",
  "RESULT",
] as const;

export type LobbyRoomStatus = (typeof LOBBY_ROOM_STATUSES)[number];

export interface LobbyRoomSummary {
  roomId: string;
  roomName: string;
  ownerUserId: string;
  ownerDisplayName: string;
  mode: RoomSettings["mode"];
  playStyle: RoomSettings["play_style"];
  levelFilter: RoomSettings["level_filter"];
  winMetric: RoomSettings["win_metric"];
  hasJoinCode: boolean;
  isPublic: boolean;
  currentPlayers: number;
  maxPlayers: MaxPlayersOption;
  isFull: boolean;
  status: LobbyRoomStatus;
  ttlStartedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface LobbyListResponse {
  rooms: LobbyRoomSummary[];
  serverTime: number;
}
