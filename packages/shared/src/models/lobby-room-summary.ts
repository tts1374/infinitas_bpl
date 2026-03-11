import type { MaxPlayersOption } from "../constants/room";

export const LOBBY_ROOM_STATUSES = [
  "LOBBY",
  "READY_CHECK",
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
