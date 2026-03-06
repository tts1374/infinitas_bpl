import { startTransition, useEffect, useState } from "react";
import { ErrorDialog } from "../components/ErrorDialog";
import { LobbyPage } from "../pages/LobbyPage";
import { RoomPage } from "../pages/RoomPage";
import { SettingsPage } from "../pages/SettingsPage";
import { roomStore, useRoomStore } from "../stores/room-store";
import { sourceStore } from "../stores/source-store";
import { useSettingsStore } from "../stores/settings-store";

type AppView = "lobby" | "settings" | "room";

function getStatusTone(connectionStatus: string): string {
  if (connectionStatus === "CONNECTED") {
    return "ok";
  }
  if (connectionStatus === "ERROR" || connectionStatus === "CLOSED") {
    return "danger";
  }

  return "warning";
}

export function App() {
  const savedSettings = useSettingsStore((state) => state.saved);
  const roomSnapshot = useRoomStore((state) => state.snapshot);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);
  const roomConnectionDetail = useRoomStore((state) => state.connectionDetail);
  const dialog = useRoomStore((state) => state.errorDialog);
  const [activeView, setActiveView] = useState<AppView>("lobby");

  useEffect(() => {
    if (roomSnapshot !== null && activeView !== "room") {
      startTransition(() => {
        setActiveView("room");
      });
    }
  }, [activeView, roomSnapshot]);

  useEffect(() => {
    if (roomSnapshot === null && activeView === "room" && roomConnectionStatus === "DISCONNECTED") {
      startTransition(() => {
        setActiveView("lobby");
      });
    }
  }, [activeView, roomConnectionStatus, roomSnapshot]);

  useEffect(() => {
    void sourceStore.attach();

    return () => {
      sourceStore.detach();
    };
  }, []);

  useEffect(() => {
    void sourceStore.start(savedSettings, { force: false });
  }, [savedSettings]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">PR-9</p>
          <h1>INFINITAS BPL Client</h1>
        </div>
        <div className="header-status">
          <div className="status-stack">
            <span className="status-label">Player</span>
            <strong>{savedSettings.displayName || "Unnamed player"}</strong>
            <span className="status-muted">{savedSettings.source}</span>
          </div>
          <div className="status-stack">
            <span className="status-label">Worker API</span>
            <strong>{savedSettings.apiBaseUrl}</strong>
            <span className={`status-pill ${getStatusTone(roomConnectionStatus)}`}>{roomConnectionStatus}</span>
          </div>
        </div>
      </header>

      <section className="app-layout">
        <nav className="side-nav">
          <button
            type="button"
            className={activeView === "lobby" ? "nav-button active" : "nav-button"}
            onClick={() => {
              setActiveView("lobby");
            }}
          >
            Lobby
          </button>
          <button
            type="button"
            className={activeView === "settings" ? "nav-button active" : "nav-button"}
            onClick={() => {
              setActiveView("settings");
            }}
          >
            Settings
          </button>
          <button
            type="button"
            className={activeView === "room" ? "nav-button active" : "nav-button"}
            disabled={roomSnapshot === null}
            onClick={() => {
              setActiveView("room");
            }}
          >
            Room
          </button>

          <div className="side-card">
            <span className="status-label">Room transport</span>
            <strong>{roomConnectionStatus}</strong>
            <span className="status-muted">{roomConnectionDetail}</span>
          </div>
        </nav>

        <div className="content-stage">
          {activeView === "lobby" ? (
            <LobbyPage
              onEnterRoom={() => {
                setActiveView("room");
              }}
            />
          ) : null}
          {activeView === "settings" ? <SettingsPage roomJoined={roomSnapshot !== null} /> : null}
          {activeView === "room" ? <RoomPage /> : null}
        </div>
      </section>

      {dialog ? <ErrorDialog dialog={dialog} onClose={() => roomStore.clearError()} /> : null}
    </main>
  );
}
