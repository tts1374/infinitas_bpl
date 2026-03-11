import { LOBBY_POLL_INTERVAL_MS } from "@infinitas/shared";
import { startTransition, useEffect, useState } from "react";
import { AppSidebar, type AppView } from "../components/AppSidebar";
import { captureElementAsPng } from "../dev/visual-capture";
import { getVisualScenario } from "../dev/visual-scenarios";
import { ErrorDialog } from "../components/ErrorDialog";
import { LobbyPage } from "../pages/LobbyPage";
import { RoomPage } from "../pages/RoomPage";
import { SettingsPage } from "../pages/SettingsPage";
import { StatsPage } from "../pages/StatsPage";
import { localResultArchiveService } from "../services/result-archive";
import { runtimeConfig } from "../runtime/runtime-config";
import { statsArchiveService } from "../services/stats-archive";
import { voiceAnnouncerService } from "../services/voice-announcer";
import { lobbyStore } from "../stores/lobby-store";
import { roomStore, useRoomStore } from "../stores/room-store";
import { sourceStore } from "../stores/source-store";
import { isRoomEntryReady, settingsStore, useSettingsStore } from "../stores/settings-store";

export function App() {
  const savedSettings = useSettingsStore((state) => state.saved);
  const roomSnapshot = useRoomStore((state) => state.snapshot);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);
  const dialog = useRoomStore((state) => state.errorDialog);
  const [activeView, setActiveView] = useState<AppView>("lobby");
  const [mockScenario] = useState(() =>
    runtimeConfig.mockScenarioId ? getVisualScenario(runtimeConfig.mockScenarioId) : null,
  );
  const roomEntryReady = isRoomEntryReady(savedSettings);
  const shouldShowSetupDialog = activeView === "lobby" && roomSnapshot === null && !roomEntryReady;

  const mockScenarioRequested = runtimeConfig.mockScenarioId !== null;

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
    if (activeView !== "lobby") {
      return;
    }

    void lobbyStore.refresh(savedSettings.apiBaseUrl);
    const intervalId = window.setInterval(() => {
      void lobbyStore.refresh(savedSettings.apiBaseUrl);
    }, LOBBY_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeView, savedSettings.apiBaseUrl]);

  useEffect(() => {
    if (mockScenarioRequested) {
      if (mockScenario !== null) {
        settingsStore.replaceAll(mockScenario.settings, {
          persist: false,
          statusMessage: `Loaded visual scenario: ${mockScenario.label}.`,
        });
        roomStore.hydrateMockScenario({
          scenarioId: mockScenario.id,
          ...mockScenario.room,
        });
        document.body.dataset.visualScenario = mockScenario.id;
        document.body.dataset.visualReady = "true";
        startTransition(() => {
          setActiveView("room");
        });
      } else {
        document.body.dataset.visualReady = "error";
      }

      return () => {
        delete document.body.dataset.visualScenario;
        delete document.body.dataset.visualReady;
      };
    }

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
  }, [mockScenario, mockScenarioRequested]);

  useEffect(() => {
    if (mockScenarioRequested) {
      return;
    }

    void sourceStore.start(savedSettings, { force: false });
  }, [mockScenarioRequested, savedSettings]);

  function navigate(view: AppView): void {
    startTransition(() => {
      setActiveView(view);
    });
  }

  function dismissDialog(): void {
    if (dialog?.blocking && roomSnapshot?.room_state === "CLOSED") {
      roomStore.leaveRoom();
      return;
    }

    roomStore.clearError();
  }

  async function handleCapture(): Promise<void> {
    const captureRoot = document.getElementById("visual-capture-root");
    if (!(captureRoot instanceof HTMLElement)) {
      return;
    }

    const fileName = `${mockScenario?.id ?? runtimeConfig.mockScenarioId ?? "visual-scenario"}.png`;
    await captureElementAsPng(captureRoot, fileName);
  }

  useEffect(() => {
    if (!runtimeConfig.autoCapture || mockScenario === null || activeView !== "room") {
      return;
    }

    let cancelled = false;

    void (async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => window.setTimeout(resolve, runtimeConfig.captureDelayMs));
      if (cancelled) {
        return;
      }
      await handleCapture();
    })();

    return () => {
      cancelled = true;
    };
  }, [activeView, mockScenario]);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#1e1e1e]">
      {activeView !== "room" ? <AppSidebar activeView={activeView} hasRoom={roomSnapshot !== null} onNavigate={navigate} /> : null}

      <section className={activeView === "room" ? "relative min-w-0 flex-1 overflow-hidden" : "custom-scrollbar relative min-w-0 flex-1 overflow-y-auto p-8"}>
        {activeView === "lobby" ? <LobbyPage /> : null}
        {activeView === "settings" ? (
          <SettingsPage
            roomJoined={roomSnapshot !== null}
            onNavigateToLobby={() => {
              navigate("lobby");
            }}
          />
        ) : null}
        {activeView === "room" ? <RoomPage /> : null}
        {activeView === "stats" ? (
          <StatsPage
            onNavigateToLobby={() => {
              navigate("lobby");
            }}
          />
        ) : null}
      </section>

      {dialog ? <ErrorDialog dialog={dialog} onClose={dismissDialog} /> : null}
      {shouldShowSetupDialog ? (
        <div className="fixed inset-0 z-[2800] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-[460px] overflow-hidden rounded-3xl border border-amber-500/20 bg-[#1a1a1c] shadow-[0_30px_90px_rgba(0,0,0,0.9)]">
            <div className="p-8 text-center">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">Setup Required</p>
              <h2 className="text-2xl font-black tracking-tight text-white">まずは設定を行いましょう</h2>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-300">
                DJ NAME と DATA SOURCE を設定すると、
                <br />
                ルーム作成と参加が可能になります。
              </p>
            </div>
            <div className="px-8 pb-8">
              <button
                type="button"
                onClick={() => navigate("settings")}
                className="w-full rounded-2xl bg-amber-400 py-4 text-sm font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-amber-300"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mockScenarioRequested ? (
        <div className="fixed right-4 top-4 z-[400] flex items-center gap-3 rounded-2xl border border-white/10 bg-black/80 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">Visual Scenario</span>
            <span className="text-sm font-black italic tracking-tight text-white">
              {mockScenario?.label ?? `Unknown: ${runtimeConfig.mockScenarioId}`}
            </span>
          </div>
          {mockScenario ? (
            <button
              type="button"
              onClick={() => {
                void handleCapture();
              }}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-cyan-400"
            >
              Capture PNG
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
