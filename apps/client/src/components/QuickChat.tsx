import { MessageSquare, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(QUICK_CHAT_CATEGORIES[0]?.id ?? "");
  const [phraseIds, setPhraseIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeCategory = QUICK_CHAT_CATEGORIES.find((category) => category.id === activeCategoryId) ?? QUICK_CHAT_CATEGORIES[0]!;
  const message = useMemo(() => joinQuickChatPhrases(phraseIds), [phraseIds]);
  const messageLength = getQuickChatMessageLength(message);
  const validation = validateQuickChatPhraseIds(phraseIds);
  const canSubmit = available && validation.ok;

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages.length, messages[messages.length - 1]?.id]);

  function appendPhrase(phraseId: string): void {
    setSubmitError(null);
    setPhraseIds((current) => {
      if (!canAppendQuickChatPhrase(current, phraseId)) {
        return current;
      }

      return [...current, phraseId];
    });
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

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full border border-cyan-500 bg-[#252526] p-4 text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all hover:bg-cyan-500/10"
        title="Open quick chat"
      >
        <MessageSquare size={24} />
        {messages.length > 0 ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white animate-bounce">
            NEW
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <section className="fixed bottom-6 right-6 z-50 flex max-h-[600px] w-96 flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#1a1a1b] shadow-[0_0_30px_rgba(0,0,0,0.8)]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#252526] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-cyan-500" />
          <span className="text-sm font-black italic tracking-wider text-white">ROOM CHAT</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-gray-400 transition-colors hover:text-white"
          title="Close quick chat"
        >
          <X size={18} />
        </button>
      </div>

      <div className="min-h-[200px] max-h-[300px] flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-xs font-bold italic text-gray-500">
            <MessageSquare size={32} className="mb-2 opacity-20" />
            No messages yet.
          </div>
        ) : (
          messages.map((entry) => (
            <div key={entry.id} className="flex flex-col items-start">
              <span className="mb-0.5 px-1 text-[10px] font-bold text-gray-500">{entry.displayName}</span>
              <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-[#252526] px-3 py-2 text-sm text-white">
                {entry.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex shrink-0 flex-col border-t border-white/5 bg-[#0f0f10]">
        <div className="flex items-center gap-2 border-b border-white/5 p-3">
          <div className="flex h-10 flex-1 items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1b] px-3 py-2 text-sm font-bold text-white">
            <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden pr-2">
              {phraseIds.length === 0 ? (
                <span className="text-gray-600">Composing...</span>
              ) : (
                phraseIds.map((phraseId, index) => {
                  const phrase = getQuickChatPhrase(phraseId);
                  return phrase ? (
                    <span
                      key={`${phraseId}-${index}`}
                      className="whitespace-nowrap rounded bg-cyan-500/20 px-1.5 py-0.5 text-[11px] text-cyan-400"
                    >
                      {phrase.text}
                    </span>
                  ) : null;
                })
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[10px]">
              <span className={messageLength > QUICK_CHAT_MAX_MESSAGE_LENGTH ? "text-red-500" : "text-gray-400"}>
                {messageLength}/{QUICK_CHAT_MAX_MESSAGE_LENGTH}
              </span>
              {phraseIds.length > 0 ? (
                <button
                  type="button"
                  onClick={removeLastPhrase}
                  className="text-gray-400 hover:text-red-400"
                  title="Backspace phrase"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="shrink-0 rounded-xl bg-cyan-500 p-2.5 text-black transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            title="Send quick chat"
          >
            <Send size={18} />
          </button>
        </div>

        {submitError ? <p className="px-3 pt-2 text-[10px] font-bold text-red-400">{submitError}</p> : null}
        {!available ? <p className="px-3 pt-2 text-[10px] font-bold text-gray-500">{disabledReason ?? "Unavailable"}</p> : null}

        <div className="flex h-40">
          <div className="w-1/3 overflow-y-auto border-r border-white/5 bg-[#1a1a1b] custom-scrollbar">
            {QUICK_CHAT_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId(category.id)}
                className={`w-full truncate border-l-2 px-3 py-2 text-left text-[11px] font-bold transition-colors ${
                  category.id === activeCategory.id
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-transparent text-gray-400 hover:bg-white/5"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="w-2/3 overflow-y-auto p-2 custom-scrollbar">
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
                    className="rounded-lg border border-white/5 bg-[#252526] px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {phrase.text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
