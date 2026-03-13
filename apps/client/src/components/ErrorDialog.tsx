import type { RoomDialogState } from "../stores/room-store";
import { useLocalResultArchiveStore } from "../services/result-archive";
import { formatDateTime } from "../utils/format";
import { AlertCircle, AlertTriangle, Database, ShieldAlert, Users } from "lucide-react";

interface ErrorDialogProps {
  dialog: RoomDialogState;
  onClose: () => void;
}

export function ErrorDialog({ dialog, onClose }: ErrorDialogProps) {
  const archiveStatus = useLocalResultArchiveStore((state) => state.status);
  const archiveStorage = useLocalResultArchiveStore((state) => state.storage);
  const archivePath = useLocalResultArchiveStore((state) => state.filePath);
  const archiveStorageKey = useLocalResultArchiveStore((state) => state.storageKey);
  const archiveLastSavedAt = useLocalResultArchiveStore((state) => state.lastSavedAt);
  const archiveSaveCount = useLocalResultArchiveStore((state) => state.saveCount);
  const archiveLocation = archivePath ?? archiveStorageKey;
  const variant =
    dialog.code === "ROOM_FULL"
      ? {
          Icon: Users,
          accentClass: "text-red-500",
          iconClass: "border-red-500/20 bg-red-500/10 text-red-500",
          cardClass: "border-red-500/20 shadow-[0_30px_90px_rgba(239,68,68,0.2)]",
          buttonClass: "bg-red-500 text-black hover:bg-red-400 shadow-[0_10px_30px_rgba(239,68,68,0.3)]",
          footerLabel: "Capacity Reached",
        }
      : dialog.code === "ROOM_CLOSED"
        ? {
            Icon: ShieldAlert,
            accentClass: "text-red-500",
            iconClass: "border-red-500/20 bg-red-500/10 text-red-500",
            cardClass: "border-red-500/20 shadow-[0_30px_90px_rgba(239,68,68,0.2)]",
            buttonClass: "bg-red-500 text-black hover:bg-red-400 shadow-[0_10px_30px_rgba(239,68,68,0.3)]",
            footerLabel: "ルーム終了",
          }
        : dialog.code === "ROOM_STATE_LOST"
          ? {
              Icon: Database,
              accentClass: "text-amber-400",
              iconClass: "border-amber-500/20 bg-amber-500/10 text-amber-400",
              cardClass: "border-amber-500/20 shadow-[0_30px_90px_rgba(245,158,11,0.2)]",
              buttonClass: "bg-amber-500 text-black hover:bg-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.25)]",
              footerLabel: "State Lost",
            }
          : {
              Icon: AlertTriangle,
              accentClass: "text-red-500",
              iconClass: "border-red-500/20 bg-red-500/10 text-red-500",
              cardClass: "border-red-500/20 shadow-[0_30px_90px_rgba(239,68,68,0.2)]",
              buttonClass: "bg-red-500 text-black hover:bg-red-400 shadow-[0_10px_30px_rgba(239,68,68,0.3)]",
              footerLabel: dialog.blocking ? "Blocking Error" : "Connection Issue",
            };
  const headingLabel =
    dialog.code === "ROOM_CLOSED" ? "ルーム通知" : dialog.blocking ? "Blocking Event" : "Room Error";

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-300"
      role="presentation"
    >
      <div
        className={`w-full max-w-[420px] overflow-hidden rounded-3xl border bg-[#1a1a1c] animate-in zoom-in-95 duration-300 ${variant.cardClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
      >
        <div className="p-8 text-center">
          <div className={`mb-6 inline-flex rounded-full border p-4 ${variant.iconClass}`}>
            <variant.Icon size={40} strokeWidth={2.5} />
          </div>
          <p className={`mb-3 text-[10px] font-black uppercase tracking-[0.45em] ${variant.accentClass}`}>
            {headingLabel}
          </p>
          <h2 id="error-dialog-title" className="text-2xl font-black tracking-tight text-white">
            {dialog.title}
          </h2>
          <p className="mt-3 px-4 text-sm leading-relaxed text-gray-400">{dialog.description}</p>
          {dialog.code ? (
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.28em] text-gray-600">Code: {dialog.code}</p>
          ) : null}
        </div>

        {dialog.code === "ROOM_STATE_LOST" ? (
          <div className="mx-8 mb-8 rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-left">
            <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
              Latest local result archive
            </span>
            <strong className="mt-2 block text-sm font-black text-white">{archiveStatus}</strong>
            <span className="mt-2 block text-xs text-gray-400">
              {archiveStorage === "TAURI_FILE"
                ? "Saved as a local JSON file."
                : archiveStorage === "LOCAL_STORAGE"
                  ? "Saved in localStorage fallback."
                  : "No local archive has been saved yet."}
            </span>
            <span className="mt-2 block text-xs text-gray-500">Entries saved: {archiveSaveCount}</span>
            <span className="mt-1 block text-xs text-gray-500">Last saved: {formatDateTime(archiveLastSavedAt)}</span>
            {archiveLocation ? (
              <code className="mt-3 block break-all rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-gray-300">
                {archiveLocation}
              </code>
            ) : null}
          </div>
        ) : null}

        <div className="px-8 pb-8">
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-2xl py-4 text-xs font-black uppercase tracking-widest transition-all ${variant.buttonClass}`}
          >
            OK
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-white/5 bg-white/[0.02] px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-600">
          <AlertCircle size={12} />
          {variant.footerLabel}
        </div>
      </div>
    </div>
  );
}
