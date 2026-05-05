export const QUICK_CHAT_MAX_COMPOSED_LENGTH = 20;
export const QUICK_CHAT_HISTORY_LIMIT = 30;

export const QUICK_CHAT_CATEGORIES = [
  {
    id: "a",
    label: "あ行",
    phrases: [
      { id: "a-001", text: "お願いします" },
      { id: "a-002", text: "ありがとう" },
      { id: "a-003", text: "お疲れさま" },
      { id: "a-004", text: "いきます" },
      { id: "a-005", text: "あれ" },
      { id: "a-006", text: "あの" },
      { id: "a-007", text: "あんな" },
      { id: "a-008", text: "いい感じ" },
      { id: "a-009", text: "いけそう" },
      { id: "a-010", text: "惜しい" },
      { id: "a-011", text: "熱い" },
      { id: "a-012", text: "うれしい" },
      { id: "a-013", text: "面白い" },
    ],
  },
  {
    id: "ka",
    label: "か行",
    phrases: [
      { id: "ka-001", text: "これ" },
      { id: "ka-002", text: "ここ" },
      { id: "ka-003", text: "今回" },
      { id: "ka-004", text: "この" },
      { id: "ka-005", text: "こんな" },
      { id: "ka-006", text: "かなり" },
      { id: "ka-007", text: "きっと" },
      { id: "ka-008", text: "曲" },
      { id: "ka-009", text: "鍵盤" },
      { id: "ka-010", text: "高速" },
      { id: "ka-011", text: "きつい" },
      { id: "ka-012", text: "更新" },
      { id: "ka-013", text: "勝ち" },
      { id: "ka-014", text: "環境不調" },
      { id: "ka-015", text: "ごめん" },
      { id: "ka-016", text: "がんばる" },
      { id: "ka-017", text: "がんばります" },
      { id: "ka-018", text: "決めたい" },
      { id: "ka-019", text: "悲しい" },
      { id: "ka-020", text: "根性" },
      { id: "ka-021", text: "が" },
      { id: "ka-022", text: "から" },
      { id: "ka-023", text: "けど" },
      { id: "ka-024", text: "かも" },
      { id: "ka-025", text: "かな？" },
      { id: "ka-026", text: "か？" },
      { id: "ka-027", text: "休憩" },
    ],
  },
  {
    id: "sa",
    label: "さ行",
    phrases: [
      { id: "sa-001", text: "すみません" },
      { id: "sa-002", text: "それ" },
      { id: "sa-003", text: "そこ" },
      { id: "sa-004", text: "さっき" },
      { id: "sa-005", text: "その" },
      { id: "sa-006", text: "そんな" },
      { id: "sa-007", text: "そろそろ" },
      { id: "sa-008", text: "勝負" },
      { id: "sa-009", text: "再戦" },
      { id: "sa-010", text: "皿曲" },
      { id: "sa-011", text: "ソフラン" },
      { id: "sa-012", text: "初見" },
      { id: "sa-013", text: "集中" },
      { id: "sa-014", text: "スコア" },
      { id: "sa-015", text: "自己ベ" },
      { id: "sa-016", text: "準備OK" },
      { id: "sa-017", text: "先どうぞ" },
      { id: "sa-018", text: "そして" },
      { id: "sa-019", text: "した" },
      { id: "sa-020", text: "します" },
      { id: "sa-021", text: "したい" },
      { id: "sa-022", text: "しよう" },
      { id: "sa-023", text: "しましょう" },
    ],
  },
  {
    id: "ta",
    label: "た行",
    phrases: [
      { id: "ta-001", text: "次" },
      { id: "ta-002", text: "どの" },
      { id: "ta-003", text: "ちょっと" },
      { id: "ta-004", text: "たぶん" },
      { id: "ta-005", text: "対戦" },
      { id: "ta-006", text: "次も" },
      { id: "ta-007", text: "楽しみ" },
      { id: "ta-008", text: "低速" },
      { id: "ta-009", text: "得意" },
      { id: "ta-010", text: "挑戦" },
      { id: "ta-011", text: "チャンス" },
      { id: "ta-012", text: "で" },
      { id: "ta-013", text: "と" },
      { id: "ta-014", text: "では" },
      { id: "ta-015", text: "です" },
      { id: "ta-016", text: "ですか？" },
      { id: "ta-017", text: "ですね" },
      { id: "ta-018", text: "だ！" },
      { id: "ta-019", text: "だな" },
    ],
  },
  {
    id: "na",
    label: "な行",
    phrases: [
      { id: "na-001", text: "ナイス" },
      { id: "na-002", text: "なんとか" },
      { id: "na-003", text: "苦手" },
      { id: "na-004", text: "伸びそう" },
      { id: "na-005", text: "伸ばしたい" },
      { id: "na-006", text: "の" },
      { id: "na-007", text: "なぁ" },
    ],
  },
  {
    id: "ha",
    label: "は行",
    phrases: [
      { id: "ha-001", text: "本気" },
      { id: "ha-002", text: "フルコン" },
      { id: "ha-003", text: "募集" },
      { id: "ha-004", text: "減らしたい" },
      { id: "ha-005", text: "は" },
    ],
  },
  {
    id: "ma",
    label: "ま行",
    phrases: [
      { id: "ma-001", text: "めっちゃ" },
      { id: "ma-002", text: "もう" },
      { id: "ma-003", text: "まだ" },
      { id: "ma-004", text: "まさか" },
      { id: "ma-005", text: "もう一回" },
      { id: "ma-006", text: "むずい" },
      { id: "ma-007", text: "ミスカン" },
      { id: "ma-008", text: "負け" },
      { id: "ma-009", text: "未所持" },
      { id: "ma-010", text: "待って" },
      { id: "ma-011", text: "任せます" },
      { id: "ma-012", text: "目指す" },
      { id: "ma-013", text: "ミラクル" },
      { id: "ma-014", text: "も" },
      { id: "ma-015", text: "ます" },
    ],
  },
  {
    id: "ya",
    label: "や行",
    phrases: [
      { id: "ya-001", text: "よろしく" },
      { id: "ya-002", text: "やばい" },
      { id: "ya-003", text: "予感" },
    ],
  },
  {
    id: "ra",
    label: "ら行",
    phrases: [
      { id: "ra-001", text: "了解" },
      { id: "ra-002", text: "例の" },
      { id: "ra-003", text: "ラスト" },
      { id: "ra-004", text: "ランダム" },
      { id: "ra-005", text: "冷静に" },
      { id: "ra-006", text: "連続" },
    ],
  },
  {
    id: "wa",
    label: "わ行",
    phrases: [
      { id: "wa-001", text: "わくわく" },
    ],
  },
  {
    id: "symbol",
    label: "記号・英数字",
    phrases: [
      { id: "symbol-001", text: "CN" },
      { id: "symbol-002", text: "BP" },
      { id: "symbol-003", text: "EXスコア" },
      { id: "symbol-004", text: "1st" },
      { id: "symbol-005", text: "substream" },
      { id: "symbol-006", text: "2nd" },
      { id: "symbol-007", text: "3rd" },
      { id: "symbol-008", text: "4th" },
      { id: "symbol-009", text: "5th" },
      { id: "symbol-010", text: "6th" },
      { id: "symbol-011", text: "7th" },
      { id: "symbol-012", text: "8th" },
      { id: "symbol-013", text: "9th" },
      { id: "symbol-014", text: "10th" },
      { id: "symbol-015", text: "RED" },
      { id: "symbol-016", text: "HS" },
      { id: "symbol-017", text: "DD" },
      { id: "symbol-018", text: "GOLD" },
      { id: "symbol-019", text: "DJT" },
      { id: "symbol-020", text: "EMP" },
      { id: "symbol-021", text: "SIRIUS" },
      { id: "symbol-022", text: "RA" },
      { id: "symbol-023", text: "Lincle" },
      { id: "symbol-024", text: "tricoro" },
      { id: "symbol-025", text: "SPADA" },
      { id: "symbol-026", text: "PENDUAL" },
      { id: "symbol-027", text: "copula" },
      { id: "symbol-028", text: "SINOBUZ" },
      { id: "symbol-029", text: "CANNON" },
      { id: "symbol-030", text: "Rootage" },
      { id: "symbol-031", text: "HEROIC" },
      { id: "symbol-032", text: "BISTRO" },
      { id: "symbol-033", text: "CastHour" },
      { id: "symbol-034", text: "RESIDENT" },
      { id: "symbol-035", text: "EPOLIS" },
      { id: "symbol-036", text: "Pinky" },
      { id: "symbol-037", text: "！" },
      { id: "symbol-038", text: "？" },
      { id: "symbol-039", text: "…" },
      { id: "symbol-040", text: "♪" },
    ],
  },
] as const;

export type QuickChatCategoryId = string;
export type QuickChatCategoryLabel = string;
export type QuickChatPhraseId = string;

export interface QuickChatPhrase {
  id: QuickChatPhraseId;
  text: string;
}

export interface QuickChatCategory {
  id: QuickChatCategoryId;
  label: QuickChatCategoryLabel;
  phrases: readonly QuickChatPhrase[];
}

export const QUICK_CHAT_PHRASES: readonly QuickChatPhrase[] = QUICK_CHAT_CATEGORIES.reduce<QuickChatPhrase[]>(
  (phrases, category) => {
    phrases.push(...(category.phrases as readonly QuickChatPhrase[]));
    return phrases;
  },
  [],
);

const QUICK_CHAT_PHRASE_TEXT_BY_ID = new Map<string, string>(
  QUICK_CHAT_PHRASES.map((phrase) => [phrase.id, phrase.text]),
);

export function isQuickChatPhraseId(value: string): value is QuickChatPhraseId {
  return QUICK_CHAT_PHRASE_TEXT_BY_ID.has(value);
}

export function composeQuickChatMessage(phraseIds: readonly string[]): string | null {
  const parts: string[] = [];
  for (const phraseId of phraseIds) {
    const text = QUICK_CHAT_PHRASE_TEXT_BY_ID.get(phraseId);
    if (text === undefined) {
      return null;
    }
    parts.push(text);
  }
  return parts.join("");
}
