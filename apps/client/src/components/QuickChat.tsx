import { MessageSquare, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  QUICK_CHAT_CATEGORIES,
  QUICK_CHAT_MAX_MESSAGE_LENGTH,
  canAppendQuickChatPhrase,
  getQuickChatMessageLength,
  getQuickChatPhrase,
  joinQuickChatPhrases,
  removeLastQuickChatPhrase,
  validateQuickChatPhraseIds,
  type QuickChatMessage,
} from "../features/room/quick-chat";

export interface QuickChatProps {
  available: boolean;
  disabledReason?: string;
  messages: QuickChatMessage[];
  onSubmit: (input: { phraseIds: string[]; message: string }) => boolean;
}

export function QuickChat({ available, disabledReason, messages, onSubmit }: QuickChatProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(QUICK_CHAT_CATEGORIES[0]?.id ?? "");
  const [phraseIds, setPhraseIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const activeCategory = QUICK_CHAT_CATEGORIES.find((category) => category.id === activeCategoryId) ?? QUICK_CHAT_CATEGORIES[0]!;
  const message = useMemo(() => joinQuickChatPhrases(phraseIds), [phraseIds]);
  const messageLength = getQuickChatMessageLength(message);
  const validation = validateQuickChatPhraseIds(phraseIds);
  const canSubmit = available && validation.ok;

  function appendPhrase(phraseId: string): void {
    setSubmitError(null);
    if (!canAppendQuickChatPhrase(phraseIds, phraseId)) {
      return;
    }

    setPhraseIds((current) => [...current, phraseId]);
  }

  function removeLastPhrase(): void {
    setSubmitError(null);
    setPhraseIds((current) => removeLastQuickChatPhrase(current));
  }

  function submit(): void {
    const result = validateQuickChatPhraseIds(phraseIds);
    if (!available) {
      setSubmitError(disabledReason ?? "現在は送信できません。");
      return;
    }
    if (!result.ok) {
      setSubmitError(result.reason);
      return;
    }

    const sent = onSubmit({ phraseIds, message: result.message });
    if (!sent) {
      setSubmitError("送信できませんでした。接続状態を確認してください。");
      return;
    }

    setPhraseIds([]);
    setSubmitError(null);
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2 text-gray-500">
        <MessageSquare size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">Quick Chat</span>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
        {QUICK_CHAT_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategoryId(category.id)}
            className={`shrink-0 rounded border px-2 py-1 text-[10px] font-black transition-colors ${
              category.id === activeCategory.id
                ? "border-cyan-500 bg-cyan-500 text-black"
                : "border-white/10 bg-white/5 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-300"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-[2rem] items-center gap-1 overflow-x-auto rounded border border-white/10 bg-black/30 px-2 py-1 custom-scrollbar">
        {phraseIds.length === 0 ? (
          <span className="text-[10px] font-bold text-gray-600">フレーズを選択</span>
        ) : (
          phraseIds.map((phraseId, index) => {
            const phrase = getQuickChatPhrase(phraseId);
            return phrase ? (
              <span
                key={`${phraseId}-${index}`}
                className="shrink-0 rounded bg-white/10 px-2 py-1 text-[11px] font-bold text-gray-200"
              >
                {phrase.text}
              </span>
            ) : null;
          })
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-12 text-right text-[10px] font-black ${messageLength > QUICK_CHAT_MAX_MESSAGE_LENGTH ? "text-red-400" : "text-gray-500"}`}>
          {messageLength}/{QUICK_CHAT_MAX_MESSAGE_LENGTH}
        </div>
        <button
          type="button"
          onClick={removeLastPhrase}
          disabled={phraseIds.length === 0}
          className="flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Remove last phrase"
        >
          <X size={14} />
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex h-8 w-8 items-center justify-center rounded bg-cyan-500 text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-600"
          title="Send quick chat"
        >
          <Send size={14} />
        </button>
        {!available ? <span className="text-[10px] font-bold text-gray-500">{disabledReason ?? "Unavailable"}</span> : null}
      </div>

      {submitError ? <p className="text-[10px] font-bold text-red-400">{submitError}</p> : null}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(4rem,1fr)_minmax(4rem,1fr)] gap-2">
        <div className="overflow-y-auto rounded border border-white/5 bg-black/20 p-2 custom-scrollbar">
          <div className="flex flex-wrap gap-1.5">
            {activeCategory.phrases.map((phrase) => {
              const phraseId = phrase.id;
              const disabled = !available || !canAppendQuickChatPhrase(phraseIds, phraseId);
              return (
                <button
                  key={phraseId}
                  type="button"
                  onClick={() => appendPhrase(phraseId)}
                  disabled={disabled}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-gray-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {phrase.text}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-y-auto rounded border border-white/5 bg-black/20 p-2 custom-scrollbar">
          {messages.length === 0 ? (
            <p className="text-[10px] font-bold text-gray-600">No quick chat yet.</p>
          ) : (
            <div className="space-y-1">
              {messages.map((entry) => (
                <p key={entry.id} className="text-[11px] text-gray-300">
                  <span className="font-black text-cyan-400">{entry.displayName}: </span>
                  {entry.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
