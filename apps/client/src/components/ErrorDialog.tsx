import type { RoomDialogState } from "../stores/room-store";

interface ErrorDialogProps {
  dialog: RoomDialogState;
  onClose: () => void;
}

export function ErrorDialog({ dialog, onClose }: ErrorDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="error-dialog-title">
        <div className="dialog-heading">
          <p className="eyebrow">Error</p>
          <h2 id="error-dialog-title">{dialog.title}</h2>
        </div>
        {dialog.code ? <p className="dialog-code">Code: {dialog.code}</p> : null}
        <p className="dialog-description">{dialog.description}</p>
        <div className="dialog-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Dismiss
          </button>
          {dialog.blocking ? <span className="dialog-note">Blocking event</span> : null}
        </div>
      </div>
    </div>
  );
}
