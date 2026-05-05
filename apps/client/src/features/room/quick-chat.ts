import {
  QUICK_CHAT_CATEGORIES,
  QUICK_CHAT_HISTORY_LIMIT,
  QUICK_CHAT_MAX_COMPOSED_LENGTH,
  QUICK_CHAT_PHRASES,
  type QuickChatPhrase,
  type RoomPlayerSnapshot,
  type RoomStateSnapshot,
} from "@infinitas/shared";

export { QUICK_CHAT_CATEGORIES };

export const QUICK_CHAT_MAX_MESSAGE_LENGTH = QUICK_CHAT_MAX_COMPOSED_LENGTH;
export const QUICK_CHAT_RECENT_LIMIT = QUICK_CHAT_HISTORY_LIMIT;
export const QUICK_CHAT_BUBBLE_VISIBLE_MS = 5_000;

export type QuickChatMessage = {
  id: string;
  playerId: string;
  displayName: string;
  message: string;
  sentAt: string;
};

const quickChatPhraseById = new Map<string, QuickChatPhrase>(QUICK_CHAT_PHRASES.map((phrase) => [phrase.id, phrase]));

export function getQuickChatPhrase(phraseId: string): QuickChatPhrase | null {
  return quickChatPhraseById.get(phraseId) ?? null;
}

export function joinQuickChatPhrases(phraseIds: string[]): string {
  return phraseIds.map((phraseId) => getQuickChatPhrase(phraseId)?.text ?? "").join("");
}

export function getQuickChatMessageLength(message: string): number {
  return Array.from(message).length;
}

export function canAppendQuickChatPhrase(phraseIds: string[], phraseId: string): boolean {
  const phrase = getQuickChatPhrase(phraseId);
  if (phrase === null) {
    return false;
  }

  return getQuickChatMessageLength(joinQuickChatPhrases([...phraseIds, phraseId])) <= QUICK_CHAT_MAX_MESSAGE_LENGTH;
}

export function removeLastQuickChatPhrase(phraseIds: string[]): string[] {
  return phraseIds.slice(0, -1);
}

export function validateQuickChatPhraseIds(phraseIds: string[]): { ok: true; message: string } | { ok: false; reason: string } {
  const message = joinQuickChatPhrases(phraseIds);
  if (message.trim().length === 0) {
    return { ok: false, reason: "フレーズを選択してください。" };
  }

  if (getQuickChatMessageLength(message) > QUICK_CHAT_MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `${QUICK_CHAT_MAX_MESSAGE_LENGTH}文字以内で選択してください。` };
  }

  return { ok: true, message };
}

type SnapshotWithQuickChat = RoomStateSnapshot & {
  quick_chat_messages?: unknown;
};

type QuickChatMessageRecord = {
  id?: unknown;
  message_id?: unknown;
  player_id?: unknown;
  display_name?: unknown;
  message?: unknown;
  text?: unknown;
  sent_at?: unknown;
  posted_at?: unknown;
  created_at?: unknown;
};

function getPlayerDisplayName(players: RoomPlayerSnapshot[], playerId: string): string {
  return players.find((player) => player.player_id === playerId)?.display_name ?? playerId;
}

export function readQuickChatMessages(snapshot: RoomStateSnapshot): QuickChatMessage[] {
  const rawMessages = (snapshot as SnapshotWithQuickChat).quick_chat_messages;
  if (!Array.isArray(rawMessages)) {
    return [];
  }

  return rawMessages
    .map((raw, index): QuickChatMessage | null => {
      if (typeof raw !== "object" || raw === null) {
        return null;
      }

      const record = raw as QuickChatMessageRecord;
      if (typeof record.player_id !== "string") {
        return null;
      }

      const message = typeof record.message === "string" ? record.message : typeof record.text === "string" ? record.text : null;
      if (message === null || message.trim().length === 0) {
        return null;
      }

      const sentAt =
        typeof record.sent_at === "string"
          ? record.sent_at
          : typeof record.posted_at === "string"
            ? record.posted_at
            : typeof record.created_at === "string"
              ? record.created_at
              : "";
      const displayName = typeof record.display_name === "string" && record.display_name.trim().length > 0
        ? record.display_name
        : getPlayerDisplayName(snapshot.players, record.player_id);
      const id =
        typeof record.id === "string"
          ? record.id
          : typeof record.message_id === "string"
            ? record.message_id
            : `${record.player_id}:${sentAt}:${index}`;

      return {
        id,
        playerId: record.player_id,
        displayName,
        message,
        sentAt,
      };
    })
    .filter((message): message is QuickChatMessage => message !== null)
    .slice(-QUICK_CHAT_RECENT_LIMIT);
}

export function getVisibleQuickChatBubbles(messages: QuickChatMessage[], nowMs: number): Record<string, QuickChatMessage> {
  return messages.reduce<Record<string, QuickChatMessage>>((bubbles, message) => {
    const sentAtMs = Date.parse(message.sentAt);
    if (Number.isNaN(sentAtMs) || nowMs - sentAtMs > QUICK_CHAT_BUBBLE_VISIBLE_MS) {
      return bubbles;
    }

    bubbles[message.playerId] = message;
    return bubbles;
  }, {});
}
