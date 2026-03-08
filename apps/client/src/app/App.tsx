import { startTransition, useEffect, useState } from "react";
import { AppSidebar, type AppView } from "../components/AppSidebar";
import { ErrorDialog } from "../components/ErrorDialog";
import { LobbyPage } from "../pages/LobbyPage";
import { RoomPage } from "../pages/RoomPage";
import { SettingsPage } from "../pages/SettingsPage";
import { StatsPage } from "../pages/StatsPage";
import { localResultArchiveService } from "../services/result-archive";
import { statsArchiveService } from "../services/stats-archive";
import { voiceAnnouncerService } from "../services/voice-announcer";
import { roomStore, useRoomStore } from "../stores/room-store";
import { sourceStore } from "../stores/source-store";
import { useSettingsStore } from "../stores/settings-store";

export function App() {
  const savedSettings = useSettingsStore((state) => state.saved);
  const roomSnapshot = useRoomStore((state) => state.snapshot);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);
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
    localResultArchiveService.start();
    statsArchiveService.start();
    voiceAnnouncerService.start();

    return () => {
      voiceAnnouncerService.stop();
      statsArchiveService.stop();
      localResultArchiveService.stop();
      sourceStore.detach();
    };
  }, []);

  useEffect(() => {
    void sourceStore.start(savedSettings, { force: false });
  }, [savedSettings]);

  function navigate(view: AppView): void {
    startTransition(() => {
      setActiveView(view);
    });
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#1e1e1e]">
      <AppSidebar activeView={activeView} hasRoom={roomSnapshot !== null} onNavigate={navigate} />

      <section className="custom-scrollbar relative min-w-0 flex-1 overflow-y-auto p-8">
        {activeView === "lobby" ? (
          <LobbyPage
            onEnterRoom={() => {
              navigate("room");
            }}
          />
        ) : null}
        {activeView === "settings" ? (
          <SettingsPage
            roomJoined={roomSnapshot !== null}
            onNavigateToLobby={() => {
              navigate("lobby");
            }}
          />
        ) : null}
        {activeView === "room" ? <RoomPage /> : null}
        {activeView === "stats" ? <StatsPage /> : null}
      </section>

      {dialog ? <ErrorDialog dialog={dialog} onClose={() => roomStore.clearError()} /> : null}
    </main>
  );
}
