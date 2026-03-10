import { useEffect, useState } from "react";
import { ChevronLeft, Database, FolderOpen, Save, Settings as SettingsIcon, User, Volume2, VolumeX } from "lucide-react";
import { pickDirectory, validateSourceDirectory } from "../services/tauri-bridge";
import { sourceStore } from "../stores/source-store";
import { getActiveSourceDirectory, settingsStore, useSettingsStore } from "../stores/settings-store";

interface SettingsPageProps {
  roomJoined: boolean;
  onNavigateToLobby: () => void;
}

const DJ_NAME_PATTERN = /^[a-zA-Z0-9.\-*&!?#$]*$/;
const DJ_NAME_MAX_LENGTH = 6;

const SOURCE_OPTIONS = [
  {
    id: "inf_daken_counter" as const,
    name: "打鍵カウンタ",
    description: "today_update.xml を監視",
    label: "Daken Counter Directory",
    placeholder: "C:\\Games\\beatmania IIDX INFINITAS\\data",
  },
  {
    id: "inf-notebook" as const,
    name: "リザルト手帳",
    description: "summary.json を監視",
    label: "Result Notebook Directory",
    placeholder: "C:\\Users\\you\\Documents\\inf-notebook",
  },
];

const HIDDEN_SOURCE_IDS = new Set<(typeof SOURCE_OPTIONS)[number]["id"]>(["inf_daken_counter"]);
const VISIBLE_SOURCE_OPTIONS = SOURCE_OPTIONS.filter((option) => !HIDDEN_SOURCE_IDS.has(option.id));

export function SettingsPage({ roomJoined, onNavigateToLobby }: SettingsPageProps) {
  const draft = useSettingsStore((state) => state.draft);
  const statusMessage = useSettingsStore((state) => state.statusMessage);
  const _lastSavedAt = useSettingsStore((state) => state.lastSavedAt);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const activeDirectory = getActiveSourceDirectory(draft);
  const activeOption = getSourceOption(draft.source);

  useEffect(() => {
    settingsStore.restoreDraftFromSaved();
    setDisplayNameError(null);
    setValidationMessage(null);
  }, []);

  async function handleBrowseDirectory(): Promise<void> {
    try {
      const selectedDirectory = await pickDirectory();
      if (selectedDirectory !== null) {
        settingsStore.updateSourceDirectory(draft.source, selectedDirectory);
        setValidationMessage(null);
      }
    } catch (error) {
      settingsStore.setStatusMessage(formatUnknownError(error, "Failed to open the directory picker."));
    }
  }

  async function handleSave(): Promise<void> {
    settingsStore.setStatusMessage(null);

    const nextDisplayNameError = validateDisplayName(draft.displayName);
    if (nextDisplayNameError !== null) {
      setDisplayNameError(nextDisplayNameError);
      return;
    }

    setDisplayNameError(null);

    if (activeDirectory.trim().length === 0) {
      setValidationMessage("先に監視元フォルダを指定してください。");
      return;
    }

    try {
      setValidationMessage(null);
      const validation = await validateSourceDirectory({
        source: draft.source,
        directoryPath: activeDirectory,
      });

      if (validation.missingPaths.length > 0) {
        setValidationMessage(`必須ファイルが見つかりません: ${validation.missingPaths.join(" / ")}`);
        return;
      }

      settingsStore.save();
      await sourceStore.start(settingsStore.getState().saved, { force: false });
    } catch (error) {
      setValidationMessage(formatUnknownError(error, "監視元フォルダの検証に失敗しました。"));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12">
      <header className="mb-2">
        <button
          type="button"
          onClick={onNavigateToLobby}
          className="group mb-4 flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-white"
        >
          <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" />
          ロビーに戻る
        </button>
        <h1 className="flex items-center gap-3 text-4xl font-black italic uppercase tracking-tighter text-white">
          <SettingsIcon className="h-8 w-8 text-cyan-500" />
          System Settings
        </h1>
      </header>

      <div className="space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <User size={20} className="text-cyan-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">User Profile</h2>
          </div>

          <div className="max-w-md space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500">DJ NAME</label>
            <input
              type="text"
              value={draft.displayName}
              maxLength={DJ_NAME_MAX_LENGTH}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                settingsStore.update("displayName", nextValue);
                setDisplayNameError(validateDisplayName(nextValue));
              }}
              placeholder="DJNAME"
              className="w-full rounded-xl border border-white/10 bg-[#252526] p-4 font-bold text-white outline-none transition-all placeholder:text-gray-600 focus:border-cyan-500"
            />
            {displayNameError ? <p className="text-sm font-semibold text-red-400">{displayNameError}</p> : null}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Database size={20} className="text-cyan-400" />
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Data Source</h2>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                  roomJoined ? "bg-amber-500/20 text-amber-300" : "bg-cyan-500/10 text-cyan-300"
                }`}
              >
                {roomJoined ? "Locked In Room" : "Ready"}
              </span>
            </div>
          </div>

          <div className="grid max-w-2xl gap-4 md:grid-cols-2">
            {VISIBLE_SOURCE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={roomJoined}
                onClick={() => {
                  settingsStore.update("source", option.id);
                  setValidationMessage(null);
                }}
                className={`flex flex-col gap-2 rounded-2xl border p-6 text-left transition-all ${
                  draft.source === option.id
                    ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                    : "border-white/5 bg-[#252526] hover:border-white/20"
                } ${roomJoined ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span className={`text-lg font-bold ${draft.source === option.id ? "text-cyan-400" : "text-white"}`}>
                  {option.name}
                </span>
                <span className="text-xs text-gray-500">{option.description}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase italic tracking-wider text-gray-500">
              {activeOption.label}
            </label>
            <div className="flex max-w-3xl flex-col gap-3 md:flex-row">
              <input
                type="text"
                value={activeDirectory}
                disabled={roomJoined}
                onChange={(event) => {
                  settingsStore.updateSourceDirectory(draft.source, event.currentTarget.value);
                  setValidationMessage(null);
                }}
                placeholder={activeOption.placeholder}
                className="flex-1 rounded-xl border border-white/5 bg-[#151515] px-4 py-3 text-sm font-mono text-gray-300 outline-none placeholder:text-gray-600 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <button
                type="button"
                disabled={roomJoined}
                onClick={() => {
                  void handleBrowseDirectory();
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#2d2d30] px-6 py-3 text-sm font-bold text-white transition-all active:scale-95 hover:bg-[#353538] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <FolderOpen size={18} />
                参照
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {draft.source === "inf_daken_counter"
                ? "選択したフォルダ配下の today_update.xml を自動で監視します。"
                : "選択したフォルダ配下の records/summary.json を監視し、export/recent.json から score/misscount を補完します。"}
            </p>
            {validationMessage ? <p className="text-sm font-semibold text-red-400">{validationMessage}</p> : null}
          </div>

        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <Volume2 size={20} className="text-cyan-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Audio Notice</h2>
          </div>

          <div className="max-w-md space-y-6 rounded-2xl border border-white/5 bg-[#252526] p-8">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Master Volume</label>
                <div className="text-3xl font-black italic text-white">
                  {draft.voiceMuted ? "MUTE" : draft.voiceVolume}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  settingsStore.updateVoiceMuted(!draft.voiceMuted);
                }}
                className={`rounded-xl p-3 transition-all ${
                  draft.voiceMuted
                    ? "border border-red-500/30 bg-red-500/20 text-red-400"
                    : "bg-white/5 text-gray-400 hover:text-white"
                }`}
              >
                {draft.voiceMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={draft.voiceVolume}
              disabled={draft.voiceMuted}
              onChange={(event) => {
                settingsStore.updateVoiceVolume(Number(event.currentTarget.value));
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#1e1e1e] accent-cyan-500 disabled:cursor-not-allowed"
            />

            <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-gray-600">
              <span>Min</span>
              <span>Max</span>
            </div>
          </div>
        </section>

        <footer className="space-y-3 pt-4">
          <p className="text-sm text-gray-400">{statusMessage ?? "Ready to save local settings."}</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              className="flex items-center justify-center gap-3 rounded-xl bg-cyan-500 px-10 py-4 font-black text-black shadow-[0_10px_30px_rgba(6,182,212,0.3)] transition-all active:scale-95 hover:bg-cyan-400"
            >
              <Save size={20} />
              設定を保存して反映
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}

function getSourceOption(source: "inf_daken_counter" | "inf-notebook") {
  return SOURCE_OPTIONS.find((option) => option.id === source) ?? SOURCE_OPTIONS[0]!;
}

function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "DJ NAME は必須です。";
  }

  if (Array.from(trimmed).length > DJ_NAME_MAX_LENGTH) {
    return "DJ NAME は6文字以内で入力してください。";
  }

  if (!DJ_NAME_PATTERN.test(trimmed)) {
    return "使用可能文字はa-z A-Z 0-9 .- *&!?#$です";
  }

  return null;
}
