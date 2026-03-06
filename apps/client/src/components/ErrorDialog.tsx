import type { RoomDialogState } from "../stores/room-store";
import { useLocalResultArchiveStore } from "../services/result-archive";
import { formatDateTime } from "../utils/format";

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

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="error-dialog-title">
        <div className="dialog-heading">
          <p className="eyebrow">Error</p>
          <h2 id="error-dialog-title">{dialog.title}</h2>
        </div>
        {dialog.code ? <p className="dialog-code">Code: {dialog.code}</p> : null}
        <p className="dialog-description">{dialog.description}</p>
        {dialog.code === "ROOM_STATE_LOST" ? (
          <div className="dialog-support">
            <span className="status-label">Latest local result archive</span>
            <strong>{archiveStatus}</strong>
            <span className="status-muted">
              {archiveStorage === "TAURI_FILE"
                ? "Saved as a local JSON file."
                : archiveStorage === "LOCAL_STORAGE"
                  ? "Saved in localStorage fallback."
                  : "No local archive has been saved yet."}
            </span>
            <span className="status-muted">Entries saved: {archiveSaveCount}</span>
            <span className="status-muted">Last saved: {formatDateTime(archiveLastSavedAt)}</span>
            {archiveLocation ? <code className="dialog-code">{archiveLocation}</code> : null}
          </div>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            {dialog.blocking ? "Acknowledge" : "Dismiss"}
          </button>
          {dialog.blocking ? <span className="dialog-note">Blocking event</span> : null}
        </div>
      </div>
    </div>
  );
}
