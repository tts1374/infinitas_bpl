import type { ReactNode } from "react";
import type {
  RoomArenaControlledState,
  RoomArenaLogEntry,
  RoomArenaMatchInfoItem,
  RoomArenaPlayer,
} from "../../components/RoomArena";
import type {
  RoomBPLControlledState,
  RoomBPLPlayer,
} from "../../components/RoomBPL";
import type { RoomSong } from "./presentation-shared";

export type RoomPageSharedComposeInput = {
  roomStatus: RoomArenaControlledState["roomStatus"];
  isReady: boolean;
  closeReason: string;
  resultTimer: number;
  showSearch: boolean;
  showCutIn: boolean;
  lastPickedSong: RoomSong | null;
  copiedId: boolean;
  copiedCode: boolean;
  lobbyTimer: number;
  roomId: string;
  joinCode: string;
  playTime: number;
  playingPhase: RoomArenaControlledState["playingPhase"];
  playingCountdownSeconds: number | null;
  isHost: boolean;
  selfPlayerId: string;
  searchModal: RoomArenaControlledState["searchModal"];
  disablePrimaryAction: boolean;
  disableLeave: boolean;
  onCopyRoomId: () => void;
  onCopyJoinCode: () => void;
  onPrimaryAction: () => void;
  onSkip: (playerId: string) => void;
  onProceedToResult: () => void;
  onLeaveRoom: () => void;
  onRemakeStage?: () => void;
};

export type RoomPageBplComposeInput = RoomPageSharedComposeInput & {
  currentTurn: number;
  roundCount: number;
  picks: (RoomSong | null)[];
  history: RoomBPLControlledState["history"];
  playerStatus: RoomBPLControlledState["playerStatus"];
  playerMetrics?: RoomBPLControlledState["playerMetrics"];
  metricLabel?: string;
  resultPlayers?: RoomBPLControlledState["resultPlayers"];
  resultRegulationLabel?: string;
  finalResultPlayers?: RoomBPLControlledState["finalResultPlayers"];
  finalWinningPlayerName?: string;
  players: RoomBPLPlayer[];
  roundPickerNames?: RoomBPLControlledState["roundPickerNames"];
  battleModeLabel?: string;
};

export type RoomPageArenaComposeInput = RoomPageSharedComposeInput & {
  roundCount: number;
  history: RoomArenaControlledState["history"];
  playerPicks: RoomArenaControlledState["playerPicks"];
  currentPlayers: number;
  maxPlayers: number;
  roomName?: string;
  battleModeLabel?: string;
  regCount?: number;
  isPrivateRoom?: boolean;
  pickingCountdownSeconds?: number | null;
  logs?: RoomArenaLogEntry[];
  matchInfoItems?: RoomArenaMatchInfoItem[];
  publicSharePanel?: ReactNode;
  playerStatus: RoomArenaControlledState["playerStatus"];
  playerMetrics?: RoomArenaControlledState["playerMetrics"];
  metricLabel?: string;
  resultSong?: RoomArenaControlledState["resultSong"];
  resultPlayers?: RoomArenaControlledState["resultPlayers"];
  durationLabel?: string;
  finalResultPlayers?: RoomArenaControlledState["finalResultPlayers"];
  totalRounds?: number;
  allPlayers: RoomArenaPlayer[];
  selectedByName?: string | null;
  onToggleReady?: () => void;
};

function buildSharedControlledProps(input: RoomPageSharedComposeInput) {
  const shared = {
    roomStatus: input.roomStatus,
    isReady: input.isReady,
    closeReason: input.closeReason,
    resultTimer: input.resultTimer,
    showSearch: input.showSearch,
    showCutIn: input.showCutIn,
    lastPickedSong: input.lastPickedSong,
    copiedId: input.copiedId,
    copiedCode: input.copiedCode,
    lobbyTimer: input.lobbyTimer,
    roomId: input.roomId,
    joinCode: input.joinCode,
    playTime: input.playTime,
    playingPhase: input.playingPhase,
    playingCountdownSeconds: input.playingCountdownSeconds,
    isHost: input.isHost,
  };

  return {
    ...shared,
    ...(input.selfPlayerId === undefined ? {} : { selfPlayerId: input.selfPlayerId }),
    searchModal: input.searchModal,
    ...(input.disablePrimaryAction === undefined ? {} : { disablePrimaryAction: input.disablePrimaryAction }),
    ...(input.disableLeave === undefined ? {} : { disableLeave: input.disableLeave }),
    ...(input.onCopyRoomId === undefined ? {} : { onCopyRoomId: input.onCopyRoomId }),
    ...(input.onCopyJoinCode === undefined ? {} : { onCopyJoinCode: input.onCopyJoinCode }),
    ...(input.onPrimaryAction === undefined ? {} : { onPrimaryAction: input.onPrimaryAction }),
    ...(input.onSkip === undefined ? {} : { onSkip: input.onSkip }),
    ...(input.onProceedToResult === undefined ? {} : { onProceedToResult: input.onProceedToResult }),
    ...(input.onLeaveRoom === undefined ? {} : { onLeaveRoom: input.onLeaveRoom }),
    ...(input.onRemakeStage === undefined ? {} : { onRemakeStage: input.onRemakeStage }),
  };
}

export function buildBplControlledProps(
  input: RoomPageBplComposeInput,
): RoomBPLControlledState {
  const controlled = {
    ...buildSharedControlledProps(input),
    currentTurn: input.currentTurn,
    roundCount: input.roundCount,
    picks: input.picks,
    history: input.history,
    playerStatus: input.playerStatus,
    players: input.players,
  };

  return {
    ...controlled,
    ...(input.playerMetrics === undefined ? {} : { playerMetrics: input.playerMetrics }),
    ...(input.metricLabel === undefined ? {} : { metricLabel: input.metricLabel }),
    ...(input.resultPlayers === undefined ? {} : { resultPlayers: input.resultPlayers }),
    ...(input.resultRegulationLabel === undefined ? {} : { resultRegulationLabel: input.resultRegulationLabel }),
    ...(input.finalResultPlayers === undefined ? {} : { finalResultPlayers: input.finalResultPlayers }),
    ...(input.finalWinningPlayerName === undefined ? {} : { finalWinningPlayerName: input.finalWinningPlayerName }),
    ...(input.roundPickerNames === undefined ? {} : { roundPickerNames: input.roundPickerNames }),
    ...(input.battleModeLabel === undefined ? {} : { battleModeLabel: input.battleModeLabel }),
  };
}

export function buildArenaControlledProps(
  input: RoomPageArenaComposeInput,
): RoomArenaControlledState {
  const controlled = {
    ...buildSharedControlledProps(input),
    roundCount: input.roundCount,
    history: input.history,
    playerPicks: input.playerPicks,
    currentPlayers: input.currentPlayers,
    maxPlayers: input.maxPlayers,
    playerStatus: input.playerStatus,
    allPlayers: input.allPlayers,
  };

  return {
    ...controlled,
    ...(input.roomName === undefined ? {} : { roomName: input.roomName }),
    ...(input.battleModeLabel === undefined ? {} : { battleModeLabel: input.battleModeLabel }),
    ...(input.regCount === undefined ? {} : { regCount: input.regCount }),
    ...(input.isPrivateRoom === undefined ? {} : { isPrivateRoom: input.isPrivateRoom }),
    ...(input.pickingCountdownSeconds === undefined
      ? {}
      : { pickingCountdownSeconds: input.pickingCountdownSeconds }),
    ...(input.logs === undefined ? {} : { logs: input.logs }),
    ...(input.matchInfoItems === undefined ? {} : { matchInfoItems: input.matchInfoItems }),
    ...(input.publicSharePanel === undefined ? {} : { publicSharePanel: input.publicSharePanel }),
    ...(input.playerMetrics === undefined ? {} : { playerMetrics: input.playerMetrics }),
    ...(input.metricLabel === undefined ? {} : { metricLabel: input.metricLabel }),
    ...(input.resultSong === undefined ? {} : { resultSong: input.resultSong }),
    ...(input.resultPlayers === undefined ? {} : { resultPlayers: input.resultPlayers }),
    ...(input.durationLabel === undefined ? {} : { durationLabel: input.durationLabel }),
    ...(input.finalResultPlayers === undefined ? {} : { finalResultPlayers: input.finalResultPlayers }),
    ...(input.totalRounds === undefined ? {} : { totalRounds: input.totalRounds }),
    ...(input.selectedByName === undefined ? {} : { selectedByName: input.selectedByName }),
    ...(input.onToggleReady === undefined ? {} : { onToggleReady: input.onToggleReady }),
  };
}
