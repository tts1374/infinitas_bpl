import { SOURCE_TYPES } from "@infinitas/shared";
import { sourceStore, useSourceStore } from "../stores/source-store";
import { settingsStore, useSettingsStore } from "../stores/settings-store";
import { formatDateTime } from "../utils/format";

interface SettingsPageProps {
  roomJoined: boolean;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function SettingsPage({ roomJoined }: SettingsPageProps) {
  const draft = useSettingsStore((state) => state.draft);
  const statusMessage = useSettingsStore((state) => state.statusMessage);
  const lastSavedAt = useSettingsStore((state) => state.lastSavedAt);
  const watcherState = useSourceStore((state) => state.watcherState);
  const lastWatcherEvent = useSourceStore((state) => state.lastEvent);

  return (
    <section className="page-grid">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Local player profile</h2>
          </div>
          <span className={`status-pill ${roomJoined ? "warning" : "ok"}`}>
            {roomJoined ? "Source locked in room" : "Ready to edit"}
          </span>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              value={draft.displayName}
              onChange={(event) => {
                settingsStore.update("displayName", event.currentTarget.value);
              }}
              placeholder="DJ name"
            />
          </label>

          <label className="field">
            <span>Worker API URL</span>
            <input
              type="url"
              value={draft.apiBaseUrl}
              onChange={(event) => {
                settingsStore.update("apiBaseUrl", event.currentTarget.value);
              }}
              placeholder="http://127.0.0.1:8787"
            />
          </label>

          <label className="field">
            <span>Player ID</span>
            <div className="inline-field">
              <input type="text" value={draft.playerId} readOnly />
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  const copied = await copyToClipboard(draft.playerId);
                  settingsStore.setStatusMessage(copied ? "Player ID copied." : "Clipboard unavailable.");
                }}
              >
                Copy
              </button>
            </div>
          </label>

          <label className="field">
            <span>Source</span>
            <select
              value={draft.source}
              disabled={roomJoined}
              onChange={(event) => {
                settingsStore.update("source", event.currentTarget.value as (typeof SOURCE_TYPES)[number]);
              }}
            >
              {SOURCE_TYPES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>

          <label className="field full-width">
            <span>inf_daken_counter / today_update.xml</span>
            <input
              type="text"
              value={draft.sourcePaths.dakenTodayUpdateXml}
              onChange={(event) => {
                settingsStore.updateSourcePath("dakenTodayUpdateXml", event.currentTarget.value);
              }}
              placeholder="C:\\path\\to\\today_update.xml"
            />
          </label>

          <label className="field full-width">
            <span>inf-notebook / export/recent.json</span>
            <input
              type="text"
              value={draft.sourcePaths.notebookExportRecentJson}
              onChange={(event) => {
                settingsStore.updateSourcePath("notebookExportRecentJson", event.currentTarget.value);
              }}
              placeholder="C:\\path\\to\\export\\recent.json"
            />
          </label>

          <label className="field full-width">
            <span>inf-notebook / records/recent.json</span>
            <input
              type="text"
              value={draft.sourcePaths.notebookRecordsRecentJson}
              onChange={(event) => {
                settingsStore.updateSourcePath("notebookRecordsRecentJson", event.currentTarget.value);
              }}
              placeholder="Optional"
            />
          </label>

          <label className="field toggle-field">
            <span>Voice notifications</span>
            <input
              type="checkbox"
              checked={draft.voiceEnabled}
              onChange={(event) => {
                settingsStore.update("voiceEnabled", event.currentTarget.checked);
              }}
            />
          </label>
        </div>

        <div className="panel-footer">
          <div className="status-stack">
            <span className="status-label">Watcher state</span>
            <div className="inline-field">
              <strong>{watcherState.status}</strong>
              <span className={`status-pill ${getWatcherTone(watcherState.status)}`}>
                {watcherState.status}
              </span>
            </div>
            <span className="status-muted">{watcherState.detail}</span>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void sourceStore.start(draft, { force: true });
              }}
            >
              Restart watcher
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void sourceStore.stop();
              }}
            >
              Stop watcher
            </button>
            <button type="button" className="secondary-button" onClick={() => settingsStore.resetDraft()}>
              Reset draft
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                settingsStore.save();
                void sourceStore.start(settingsStore.getState().saved, { force: true });
              }}
            >
              Save settings
            </button>
          </div>
        </div>

        <div className="panel-subsection watcher-block">
          <div className="meta-grid compact">
            <div className="status-stack">
              <span className="status-label">Active source</span>
              <strong>{watcherState.source ?? "-"}</strong>
              <span className="status-muted">Saved source and path selection.</span>
            </div>
            <div className="status-stack">
              <span className="status-label">Last watcher update</span>
              <strong>{formatDateTime(watcherState.lastEventAt)}</strong>
              <span className="status-muted">State transition or file event.</span>
            </div>
            <div className="status-stack">
              <span className="status-label">Last event kind</span>
              <strong>{lastWatcherEvent?.kind ?? "-"}</strong>
              <span className="status-muted">{lastWatcherEvent?.detail ?? "No file events yet."}</span>
            </div>
            <div className="status-stack">
              <span className="status-label">Last file</span>
              <strong>{lastWatcherEvent?.filePath ?? "-"}</strong>
              <span className="status-muted">
                {lastWatcherEvent?.parserOutput
                  ? `${lastWatcherEvent.parserOutput.fileSizeBytes.toLocaleString()} bytes / ${lastWatcherEvent.parserOutput.observations.length} observation(s)`
                  : "Parser payload not available."}
              </span>
            </div>
          </div>

          <div className="status-stack watcher-path-list">
            <span className="status-label">Watched paths</span>
            {watcherState.watchedPaths.length === 0 ? (
              <span className="status-muted">No active watch targets.</span>
            ) : (
              watcherState.watchedPaths.map((path) => (
                <code key={path} className="path-chip">
                  {path}
                </code>
              ))
            )}
          </div>
        </div>

        <div className="meta-strip">
          <span>{statusMessage ?? "Idle."}</span>
          <span>Last saved: {formatDateTime(lastSavedAt)}</span>
        </div>
      </article>
    </section>
  );
}

function getWatcherTone(status: string): string {
  if (status === "RUNNING") {
    return "ok";
  }

  if (status === "ERROR" || status === "UNAVAILABLE") {
    return "danger";
  }

  return "warning";
}
