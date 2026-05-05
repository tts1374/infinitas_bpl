import type { QuickChatPhraseId } from "../constants/quick-chat";
import type { ISO8601String } from "./common";

export interface QuickChatMessage {
  message_id: string;
  player_id: string;
  phrase_ids: QuickChatPhraseId[];
  message: string;
  posted_at: ISO8601String;
}
