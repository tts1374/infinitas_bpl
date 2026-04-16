import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArenaControlledProps,
  buildBplControlledProps,
} from "./room-page-compose";

test("buildBplControlledProps forwards shared and BPL-specific props", () => {
  const onPrimaryAction = () => undefined;
  const onSkip = () => undefined;
  const onProceedToResult = () => undefined;
  const onLeaveRoom = () => undefined;

  const controlled = buildBplControlledProps({
    roomStatus: "PLAYING",
    isReady: true,
    closeReason: "ALL_ROUNDS_COMPLETED",
    resultTimer: 7,
    showSearch: true,
    showCutIn: false,
    lastPickedSong: { title: "Song", artist: "Artist", level: "12" },
    copiedId: true,
    copiedCode: false,
    lobbyTimer: 99,
    roomId: "room-1",
    joinCode: "join-1",
    playTime: 42,
    playingPhase: "IN_PLAY",
    playingCountdownSeconds: 13,
    isHost: false,
    selfPlayerId: "player-2",
    searchModal: "search modal",
    disablePrimaryAction: true,
    disableLeave: false,
    onCopyRoomId: () => undefined,
    onCopyJoinCode: () => undefined,
    onPrimaryAction,
    onSkip,
    onProceedToResult,
    onLeaveRoom,
    currentTurn: 1,
    roundCount: 3,
    picks: [{ title: "Pick", artist: "Artist", level: "11" }],
    history: [
      {
        round: 1,
        song: { title: "History Song", artist: "Artist", level: "10" },
        scores: { "1": 1000, "2": 900 },
        winnerId: "1",
      },
    ],
    playerStatus: { "1": "PLAYED" },
    playerMetrics: { "1": 123 },
    metricLabel: "EX SCORE",
    resultPlayers: { "1": { metricValue: 123, stagePoints: 10, totalPoints: 20, outcome: "WINNER" } },
    resultRegulationLabel: "4 STAGES",
    finalResultPlayers: { "1": { totalPoints: 20, isWinner: true } },
    finalWinningPlayerName: "HOST",
    players: [{ id: "1", name: "HOST", isReady: true, isHost: true, side: "LEFT" }],
    roundPickerNames: ["HOST"],
    battleModeLabel: "SP / NO LIMIT",
  });

  assert.equal(controlled.roomStatus, "PLAYING");
  assert.equal(controlled.isReady, true);
  assert.equal(controlled.closeReason, "ALL_ROUNDS_COMPLETED");
  assert.equal(controlled.resultTimer, 7);
  assert.equal(controlled.showSearch, true);
  assert.equal(controlled.showCutIn, false);
  assert.deepEqual(controlled.lastPickedSong, { title: "Song", artist: "Artist", level: "12" });
  assert.equal(controlled.copiedId, true);
  assert.equal(controlled.copiedCode, false);
  assert.equal(controlled.lobbyTimer, 99);
  assert.equal(controlled.roomId, "room-1");
  assert.equal(controlled.joinCode, "join-1");
  assert.equal(controlled.playTime, 42);
  assert.equal(controlled.playingPhase, "IN_PLAY");
  assert.equal(controlled.playingCountdownSeconds, 13);
  assert.equal(controlled.isHost, false);
  assert.equal(controlled.selfPlayerId, "player-2");
  assert.equal(controlled.searchModal, "search modal");
  assert.equal(controlled.disablePrimaryAction, true);
  assert.equal(controlled.disableLeave, false);
  assert.equal(controlled.onPrimaryAction, onPrimaryAction);
  assert.equal(controlled.onSkip, onSkip);
  assert.equal(controlled.onProceedToResult, onProceedToResult);
  assert.equal(controlled.onLeaveRoom, onLeaveRoom);
  assert.equal(controlled.currentTurn, 1);
  assert.equal(controlled.roundCount, 3);
  assert.deepEqual(controlled.picks, [{ title: "Pick", artist: "Artist", level: "11" }]);
  assert.deepEqual(controlled.history, [
    {
      round: 1,
      song: { title: "History Song", artist: "Artist", level: "10" },
      scores: { "1": 1000, "2": 900 },
      winnerId: "1",
    },
  ]);
  assert.deepEqual(controlled.playerStatus, { "1": "PLAYED" });
  assert.deepEqual(controlled.playerMetrics, { "1": 123 });
  assert.equal(controlled.metricLabel, "EX SCORE");
  assert.deepEqual(controlled.resultPlayers, { "1": { metricValue: 123, stagePoints: 10, totalPoints: 20, outcome: "WINNER" } });
  assert.equal(controlled.resultRegulationLabel, "4 STAGES");
  assert.deepEqual(controlled.finalResultPlayers, { "1": { totalPoints: 20, isWinner: true } });
  assert.equal(controlled.finalWinningPlayerName, "HOST");
  assert.deepEqual(controlled.players, [{ id: "1", name: "HOST", isReady: true, isHost: true, side: "LEFT" }]);
  assert.deepEqual(controlled.roundPickerNames, ["HOST"]);
  assert.equal(controlled.battleModeLabel, "SP / NO LIMIT");
});

test("buildArenaControlledProps forwards shared and ARENA-specific props", () => {
  const onPrimaryAction = () => undefined;
  const onSkip = () => undefined;
  const onProceedToResult = () => undefined;
  const onLeaveRoom = () => undefined;
  const onRemakeStage = () => undefined;

  const controlled = buildArenaControlledProps({
    roomStatus: "RESULT",
    isReady: false,
    closeReason: "ALL_ROUNDS_COMPLETED",
    resultTimer: 5,
    showSearch: false,
    showCutIn: true,
    lastPickedSong: null,
    copiedId: false,
    copiedCode: true,
    lobbyTimer: 88,
    roomId: "arena-room",
    joinCode: "arena-join",
    playTime: 11,
    playingPhase: "PLAY_START",
    playingCountdownSeconds: 9,
    isHost: true,
    searchModal: "modal",
    disablePrimaryAction: false,
    disableLeave: true,
    onCopyRoomId: () => undefined,
    onCopyJoinCode: () => undefined,
    onPrimaryAction,
    onSkip,
    onProceedToResult,
    onLeaveRoom,
    onRemakeStage,
    roundCount: 4,
    history: [
      {
        round: 2,
        song: { title: "Arena History Song", artist: "Artist", level: "11" },
        scores: { "1": 1200, "2": 1100, "3": 1000, "4": 900 },
        winnerId: "1",
      },
    ],
    playerPicks: { "1": { title: "Arena Song", artist: "Artist", level: "12" } },
    currentPlayers: 2,
    maxPlayers: 4,
    roomName: "ARENA ROOM",
    battleModeLabel: "SP / NO LIMIT",
    regCount: 4,
    isPrivateRoom: true,
    logs: [{ id: "log-1", text: "joined" }],
    matchInfoItems: [{ label: "Mode", value: "ARENA" }],
    publicSharePanel: "share panel",
    playerStatus: { "1": "PLAYED" },
    playerMetrics: { "1": 777 },
    metricLabel: "EX SCORE",
    resultSong: { title: "Result Song", artist: "Artist", level: "12" },
    resultPlayers: { "1": { rank: 1, stagePoints: 10, metricValue: 777, isWinner: true } },
    durationLabel: "1M 00S",
    finalResultPlayers: { "1": { rank: 1, totalPoints: 888, isWinner: true } },
    totalRounds: 4,
    allPlayers: [{ id: "1", name: "HOST", isReady: true, isHost: true }],
    selectedByName: "HOST",
  });

  assert.equal(controlled.roomStatus, "RESULT");
  assert.equal(controlled.isReady, false);
  assert.equal(controlled.closeReason, "ALL_ROUNDS_COMPLETED");
  assert.equal(controlled.resultTimer, 5);
  assert.equal(controlled.showSearch, false);
  assert.equal(controlled.showCutIn, true);
  assert.equal(controlled.lastPickedSong, null);
  assert.equal(controlled.copiedId, false);
  assert.equal(controlled.copiedCode, true);
  assert.equal(controlled.lobbyTimer, 88);
  assert.equal(controlled.roomId, "arena-room");
  assert.equal(controlled.joinCode, "arena-join");
  assert.equal(controlled.playTime, 11);
  assert.equal(controlled.playingPhase, "PLAY_START");
  assert.equal(controlled.playingCountdownSeconds, 9);
  assert.equal(controlled.isHost, true);
  assert.equal(controlled.searchModal, "modal");
  assert.equal(controlled.disablePrimaryAction, false);
  assert.equal(controlled.disableLeave, true);
  assert.equal(controlled.onPrimaryAction, onPrimaryAction);
  assert.equal(controlled.onSkip, onSkip);
  assert.equal(controlled.onProceedToResult, onProceedToResult);
  assert.equal(controlled.onLeaveRoom, onLeaveRoom);
  assert.equal(controlled.onRemakeStage, onRemakeStage);
  assert.equal(controlled.roundCount, 4);
  assert.deepEqual(controlled.history, [
    {
      round: 2,
      song: { title: "Arena History Song", artist: "Artist", level: "11" },
      scores: { "1": 1200, "2": 1100, "3": 1000, "4": 900 },
      winnerId: "1",
    },
  ]);
  assert.deepEqual(controlled.playerPicks, { "1": { title: "Arena Song", artist: "Artist", level: "12" } });
  assert.equal(controlled.currentPlayers, 2);
  assert.equal(controlled.maxPlayers, 4);
  assert.equal(controlled.roomName, "ARENA ROOM");
  assert.equal(controlled.battleModeLabel, "SP / NO LIMIT");
  assert.equal(controlled.regCount, 4);
  assert.equal(controlled.isPrivateRoom, true);
  assert.deepEqual(controlled.logs, [{ id: "log-1", text: "joined" }]);
  assert.deepEqual(controlled.matchInfoItems, [{ label: "Mode", value: "ARENA" }]);
  assert.equal(controlled.publicSharePanel, "share panel");
  assert.deepEqual(controlled.playerStatus, { "1": "PLAYED" });
  assert.deepEqual(controlled.playerMetrics, { "1": 777 });
  assert.equal(controlled.metricLabel, "EX SCORE");
  assert.deepEqual(controlled.resultSong, { title: "Result Song", artist: "Artist", level: "12" });
  assert.deepEqual(controlled.resultPlayers, { "1": { rank: 1, stagePoints: 10, metricValue: 777, isWinner: true } });
  assert.equal(controlled.durationLabel, "1M 00S");
  assert.deepEqual(controlled.finalResultPlayers, { "1": { rank: 1, totalPoints: 888, isWinner: true } });
  assert.equal(controlled.totalRounds, 4);
  assert.deepEqual(controlled.allPlayers, [{ id: "1", name: "HOST", isReady: true, isHost: true }]);
  assert.equal(controlled.selectedByName, "HOST");
});
