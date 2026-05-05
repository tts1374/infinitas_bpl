import assert from "node:assert/strict";
import test from "node:test";
import type { RoomStateSnapshot } from "@infinitas/shared";
import {
  QUICK_CHAT_CATEGORIES,
  canAppendQuickChatPhrase,
  getVisibleQuickChatBubbles,
  joinQuickChatPhrases,
  readQuickChatMessages,
  removeLastQuickChatPhrase,
  validateQuickChatPhraseIds,
} from "./quick-chat";

test("quick chat categories keep kana-order tabs", () => {
  assert.deepEqual(
    QUICK_CHAT_CATEGORIES.map((category) => category.label),
    ["あ行", "か行", "さ行", "た行", "な行", "は行", "ま行", "や行", "ら行", "わ行", "記号・英数字"],
  );
});

test("quick chat composition deletes one phrase block and enforces joined 20 character limit", () => {
  const phraseIds = ["a-001", "ka-001", "symbol-037"];

  assert.equal(joinQuickChatPhrases(phraseIds), "お願いしますこれ！");
  assert.deepEqual(removeLastQuickChatPhrase(phraseIds), ["a-001", "ka-001"]);
  assert.deepEqual(validateQuickChatPhraseIds(phraseIds), { ok: true, message: "お願いしますこれ！" });
  assert.equal(canAppendQuickChatPhrase(["symbol-005", "symbol-003"], "symbol-034"), false);
});

test("quick chat snapshot reader returns bounded authoritative messages and visible bubbles", () => {
  const now = Date.parse("2026-05-05T00:00:05.000Z");
  const snapshot = {
    room_id: "room-1",
    room_state: "LOBBY",
    settings: {
      mode: "ARENA",
      visibility: "PUBLIC",
      join_code: null,
      max_players: 4,
      play_style: "SP",
      level_filter: "ANY",
      win_metric: "SCORE",
      auto_match: false,
      room_comment: "",
    },
    host_player_id: "p1",
    players: [
      {
        player_id: "p1",
        display_name: "HOST",
        source: "reflux",
        connected: true,
        ready: true,
      },
      {
        player_id: "p2",
        display_name: "GUEST",
        source: "reflux",
        connected: true,
        ready: false,
      },
    ],
    picks: [],
    frozen_rounds: [],
    current_round: null,
    timers: {
      ready_check_deadline: null,
      picking_deadline: null,
      match_deadline: null,
      result_deadline: null,
    },
    result_ready: false,
    quick_chat_messages: [
      { message_id: "old", player_id: "p1", phrase_ids: ["a-002"], message: "ありがとう", posted_at: "2026-05-05T00:00:00.000Z" },
      { message_id: "latest", player_id: "p2", phrase_ids: ["ya-001"], message: "よろしく", posted_at: "2026-05-05T00:00:03.000Z" },
    ],
  } satisfies RoomStateSnapshot;

  const messages = readQuickChatMessages(snapshot);
  assert.deepEqual(messages.map((message) => message.displayName), ["HOST", "GUEST"]);
  assert.deepEqual(messages.map((message) => message.message), ["ありがとう", "よろしく"]);
  assert.deepEqual(getVisibleQuickChatBubbles(messages, now), {
    p1: messages[0],
    p2: messages[1],
  });
  assert.deepEqual(getVisibleQuickChatBubbles(messages, now + 6_000), {});
});
