import { AlertTriangle, Download, LoaderCircle, ShieldAlert } from "lucide-react";
import type { AppUpdaterState } from "../stores/updater-store";

interface UpdaterGateDialogProps {
  snapshot: AppUpdaterState;
  onStartUpdate: () => void;
}

function formatByteCount(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function createPhaseCopy(snapshot: AppUpdaterState): {
  title: string;
  statusText: string;
  bodyLines: string[];
  Icon: typeof LoaderCircle;
  accentClass: string;
  iconClass: string;
  buttonLabel: string | null;
} {
  switch (snapshot.phase) {
    case "update-available":
      return {
        title: "更新が必要です",
        statusText: "最新の更新が見つかりました。",
        bodyLines: [
          "最新のバージョンがあります。",
          "更新中はアプリを操作できません。",
          "更新後に再起動します。",
        ],
        Icon: Download,
        accentClass: "text-cyan-300",
        iconClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
        buttonLabel: "更新する",
      };
    case "downloading":
      return {
        title: "更新しています",
        statusText: "更新をダウンロードしています...",
        bodyLines: ["更新中はアプリを操作できません。"],
        Icon: LoaderCircle,
        accentClass: "text-cyan-300",
        iconClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
        buttonLabel: null,
      };
    case "installing":
      return {
        title: "更新しています",
        statusText: "更新を適用しています...",
        bodyLines: ["更新中はアプリを操作できません。", "更新後に再起動します。"],
        Icon: LoaderCircle,
        accentClass: "text-cyan-300",
        iconClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
        buttonLabel: null,
      };
    case "failed":
      return {
        title: "更新に失敗しました",
        statusText: snapshot.failure?.message ?? "更新の確認に失敗しました",
        bodyLines: ["現在のバージョンで起動します。"],
        Icon: AlertTriangle,
        accentClass: "text-amber-300",
        iconClass: "border-amber-500/20 bg-amber-500/10 text-amber-300",
        buttonLabel: null,
      };
    case "idle":
    case "checking":
    default:
      return {
        title: "起動しています",
        statusText: "更新を確認しています...",
        bodyLines: ["起動前の準備を進めています。"],
        Icon: LoaderCircle,
        accentClass: "text-cyan-300",
        iconClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
        buttonLabel: null,
      };
  }
}

export function UpdaterGateDialog({ snapshot, onStartUpdate }: UpdaterGateDialogProps) {
  const copy = createPhaseCopy(snapshot);
  const progressPercent = snapshot.progress.percent;
  const showProgress = snapshot.phase === "downloading" || snapshot.phase === "installing";
  const showVersionMeta = snapshot.currentVersion !== null || snapshot.nextVersion !== null;
  const progressWidth =
    progressPercent !== null && Number.isFinite(progressPercent)
      ? `${Math.max(8, Math.min(100, progressPercent))}%`
      : snapshot.phase === "installing"
        ? "100%"
        : "30%";

  return (
    <main className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#101114] px-4 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_38%),linear-gradient(180deg,#111214_0%,#09090b_100%)]" />

      <div
        className="relative z-10 w-full max-w-[460px] overflow-hidden rounded-[32px] border border-white/10 bg-[#16171a]/95 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="updater-gate-title"
      >
        <div className="p-8 text-center">
          <div className={`mb-6 inline-flex rounded-full border p-4 ${copy.iconClass}`}>
            <copy.Icon
              size={42}
              strokeWidth={2.5}
              className={snapshot.phase === "checking" || snapshot.phase === "downloading" || snapshot.phase === "installing" ? "animate-spin" : undefined}
            />
          </div>

          <p className={`mb-3 text-[10px] font-black uppercase tracking-[0.35em] ${copy.accentClass}`}>
            Startup Update Gate
          </p>
          <h1 id="updater-gate-title" className="text-3xl font-black tracking-tight text-white">
            {copy.title}
          </h1>
          <p className="mt-3 text-sm font-semibold text-gray-200">{copy.statusText}</p>

          <div className="mt-5 space-y-2 text-sm leading-relaxed text-gray-400">
            {copy.bodyLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        {showVersionMeta ? (
          <div className="mx-8 rounded-2xl border border-white/5 bg-black/25 p-5 text-left">
            <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-gray-500">
              Version
            </span>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-gray-500">
                  Current
                </span>
                <strong className="mt-1 block text-sm font-black text-white">
                  {snapshot.currentVersion ?? "--"}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-gray-500">
                  Update
                </span>
                <strong className="mt-1 block text-sm font-black text-white">
                  {snapshot.nextVersion ?? "--"}
                </strong>
              </div>
            </div>
          </div>
        ) : null}

        {showProgress ? (
          <div className="mx-8 mt-6 rounded-2xl border border-white/5 bg-black/25 p-5 text-left">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-500">
                Download Event
              </span>
              <span className="text-xs font-black text-cyan-300">
                {snapshot.progress.event ?? "Started"}
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-white ${progressPercent === null ? "animate-pulse" : ""}`}
                style={{ width: progressWidth }}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 text-xs text-gray-400">
              <span>
                {formatByteCount(snapshot.progress.downloadedBytes)}
                {snapshot.progress.totalBytes !== null
                  ? ` / ${formatByteCount(snapshot.progress.totalBytes)}`
                  : ""}
              </span>
              <span>
                {progressPercent !== null ? `${progressPercent}%` : snapshot.phase === "installing" ? "Installing" : "Streaming"}
              </span>
            </div>
          </div>
        ) : null}

        <div className="px-8 py-8">
          {copy.buttonLabel ? (
            <button
              type="button"
              onClick={onStartUpdate}
              className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-cyan-300"
            >
              {copy.buttonLabel}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-gray-500">
              <ShieldAlert size={14} />
              アプリ本体はまだ起動していません
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
