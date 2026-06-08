import { LOBBY_POLL_INTERVAL_MS, PING_INTERVAL_SECONDS } from "@infinitas/shared";
import { startTransition, useEffect, useRef, useState } from "react";
import { AppSidebar, type AppView } from "../components/AppSidebar";
import { captureElementAsPng } from "../dev/visual-capture";
import { getVisualScenario } from "../dev/visual-scenarios";
import { ErrorDialog } from "../components/ErrorDialog";
import { SourceUnresolvedDialog } from "../components/SourceUnresolvedDialog";
import { LobbyPage } from "../pages/LobbyPage";
import { RoomPage } from "../pages/RoomPage";
import { SettingsPage } from "../pages/SettingsPage";
import { StatsPage } from "../pages/StatsPage";
import { AutoMatchPage } from "../pages/AutoMatchPage";
import { localResultArchiveService } from "../services/result-archive";
import { matchHistoryOverlayService } from "../services/match-history-overlay";
import { initializeE2EObservability } from "../services/e2e-observability";
import { startE2EScenarioRunner } from "../services/e2e-scenario-runner";
import { runtimeConfig } from "../runtime/runtime-config";
import { statsArchiveService } from "../services/stats-archive";
import { logClientShareAnalytics } from "../services/share-analytics";
import { getCurrentDeepLinkUrls, listenToDeepLinkUrls, showMatchHistoryWindow } from "../services/tauri-bridge";
import { voiceAnnouncerService } from "../services/voice-announcer";
import { lobbyStore } from "../stores/lobby-store";
import { roomStore, useRoomStore } from "../stores/room-store";
import { sourceStore, useSourceStore } from "../stores/source-store";
import { isRoomEntryReady, settingsStore, useSettingsStore } from "../stores/settings-store";

function parseJoinRoomRefFromDeepLink(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "infinitas-arena:") {
      return null;
    }
    if (parsed.hostname !== "join" && parsed.pathname !== "/join") {
      return null;
    }

    const roomRef = parsed.searchParams.get("r")?.trim();
    return roomRef && roomRef.length > 0 ? roomRef : null;
  } catch {
    return null;
  }
}

function pickRoomRefFromDeepLinkUrls(urls: string[]): string | null {
  for (const url of urls) {
    const roomRef = parseJoinRoomRefFromDeepLink(url);
    if (roomRef !== null) {
      return roomRef;
    }
  }

  return null;
}

export function App() {
  const savedSettings = useSettingsStore((state) => state.saved);
  const roomSnapshot = useRoomStore((state) => state.snapshot);
  const roomConnectionStatus = useRoomStore((state) => state.connectionStatus);
  const connectionPlayerId = useRoomStore((state) => state.connectionPlayerId);
  const roomJoinCode = useRoomStore((state) => state.joinCode);
  const dialog = useRoomStore((state) => state.errorDialog);
  const sourceUnresolvedDialog = useSourceStore((state) => state.activeUnresolvedDialog);
  const [activeView, setActiveView] = useState<AppView>("lobby");
  const activeViewRef = useRef<AppView>(activeView);
  const roomSnapshotRef = useRef(roomSnapshot);
  const roomConnectionStatusRef = useRef(roomConnectionStatus);
  const pendingDeepLinkRoomIdRef = useRef<string | null>(null);
  const [pendingDeepLinkRoomId, setPendingDeepLinkRoomId] = useState<string | null>(null);
  const [pendingRecoveryJoin, setPendingRecoveryJoin] = useState<{ roomId: string; joinCode: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOpeningMatchHistory, setIsOpeningMatchHistory] = useState(false);
  const [mockScenario] = useState(() =>
    runtimeConfig.mockScenarioId ? getVisualScenario(runtimeConfig.mockScenarioId) : null,
  );
  const handledAutoMatchCloseRef = useRef<string | null>(null);
  const roomEntryReady = isRoomEntryReady(savedSettings);
  const shouldShowSetupDialog = activeView === "lobby" && roomSnapshot === null && !roomEntryReady;
  const shouldSendHostHeartbeat =
    roomConnectionStatus === "CONNECTED" &&
    roomSnapshot !== null &&
    connectionPlayerId !== null &&
    roomSnapshot.host_player_id === connectionPlayerId &&
    (roomSnapshot.room_state === "PICKING" || roomSnapshot.room_state === "PLAYING");
  const canRecreateFromDialog =
    dialog?.code === "ROOM_EXPIRED" &&
    roomSnapshot !== null &&
    roomSnapshot.room_state === "CLOSED" &&
    roomSnapshot.settings.auto_match !== true &&
    connectionPlayerId !== null &&
    roomSnapshot.host_player_id === connectionPlayerId;

  const mockScenarioRequested = runtimeConfig.mockScenarioId !== null;

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    roomSnapshotRef.current = roomSnapshot;
    roomConnectionStatusRef.current = roomConnectionStatus;
  }, [roomConnectionStatus, roomSnapshot]);

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
    if (
      roomSnapshot === null ||
      roomSnapshot.room_state !== "CLOSED" ||
      roomSnapshot.settings.auto_match !== true ||
      roomSnapshot.close_reason !== "ALL_ROUNDS_COMPLETED"
    ) {
      return;
    }

    const closeKey = `${roomSnapshot.room_id}:${roomSnapshot.closed_at ?? ""}:${roomSnapshot.close_reason}`;
    if (handledAutoMatchCloseRef.current === closeKey) {
      return;
    }
    handledAutoMatchCloseRef.current = closeKey;

    setToastMessage("部屋が解散しました。ロビーへ戻ります。");
    roomStore.leaveRoom();
    startTransition(() => {
      setActiveView("lobby");
    });
  }, [roomSnapshot]);

  useEffect(() => {
    if (toastMessage === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

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
    if (!shouldSendHostHeartbeat || mockScenarioRequested) {
      return;
    }

    roomStore.sendHeartbeatPing();
    const intervalId = window.setInterval(() => {
      roomStore.sendHeartbeatPing();
    }, PING_INTERVAL_SECONDS * 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mockScenarioRequested, shouldSendHostHeartbeat]);

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
    matchHistoryOverlayService.start();
    statsArchiveService.start();
    voiceAnnouncerService.start();

    return () => {
      voiceAnnouncerService.stop();
      statsArchiveService.stop();
      matchHistoryOverlayService.stop();
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

  useEffect(() => {
    if (mockScenarioRequested) {
      return;
    }

    sourceStore.syncRoomSnapshot(roomSnapshot);
  }, [
    mockScenarioRequested,
    roomSnapshot,
    savedSettings.source,
    savedSettings.dakenCounterV3Port,
  ]);

  useEffect(() => {
    if (mockScenarioRequested) {
      return;
    }

    let disposed = false;
    let stopListening: (() => void) | null = null;

    const handleDeepLinkUrls = (urls: string[], trigger: "startup" | "runtime"): void => {
      const roomRef = pickRoomRefFromDeepLinkUrls(urls);
      if (roomRef === null) {
        return;
      }

      const hasActiveRoom =
        roomSnapshotRef.current !== null ||
        roomConnectionStatusRef.current === "CONNECTING" ||
        roomConnectionStatusRef.current === "JOINING" ||
        roomConnectionStatusRef.current === "CONNECTED";
      if (hasActiveRoom) {
        logClientShareAnalytics("join_page_deep_link_ignored", {
          trigger,
          roomId: roomRef,
          reason: "active_room",
          roomState: roomSnapshotRef.current?.room_state ?? null,
          connectionStatus: roomConnectionStatusRef.current,
        });
        return;
      }

      pendingDeepLinkRoomIdRef.current = roomRef;
      setPendingDeepLinkRoomId(roomRef);
      logClientShareAnalytics("join_page_deep_link_received", {
        trigger,
        roomId: roomRef,
      });
      startTransition(() => {
        setActiveView("lobby");
      });
    };

    void (async () => {
      try {
        const startUrls = await getCurrentDeepLinkUrls();
        handleDeepLinkUrls(startUrls, "startup");
        stopListening = await listenToDeepLinkUrls((urls) => {
          handleDeepLinkUrls(urls, "runtime");
        });
        if (disposed && stopListening !== null) {
          stopListening();
          stopListening = null;
        }
      } catch {
        // no-op: deep-link plugin may be unavailable in non-desktop contexts.
      }
    })();

    return () => {
      disposed = true;
      if (stopListening !== null) {
        stopListening();
        stopListening = null;
      }
    };
  }, [mockScenarioRequested]);

  useEffect(() => {
    if (roomSnapshot === null || roomConnectionStatus !== "CONNECTED") {
      return;
    }

    if (pendingDeepLinkRoomIdRef.current !== roomSnapshot.room_id) {
      return;
    }

    logClientShareAnalytics("join_page_join_succeeded", {
      roomId: roomSnapshot.room_id,
      roomState: roomSnapshot.room_state,
    });
    pendingDeepLinkRoomIdRef.current = null;
    setPendingDeepLinkRoomId(null);
  }, [roomConnectionStatus, roomSnapshot]);

  useEffect(() => {
    void initializeE2EObservability();
    const stopRunner = startE2EScenarioRunner(() => activeViewRef.current);
    return () => {
      stopRunner();
    };
  }, []);

  function navigate(view: AppView): void {
    startTransition(() => {
      setActiveView(view);
    });
  }

  function rememberPrivateRecoveryJoinHint(): void {
    if (roomSnapshot === null || roomSnapshot.settings.visibility !== "PRIVATE") {
      return;
    }
    if (roomJoinCode === null || roomJoinCode.trim().length === 0) {
      return;
    }
    if (dialog?.code !== "ROOM_EXPIRED" && dialog?.code !== "ROOM_STATE_CHANGED") {
      return;
    }

    setPendingRecoveryJoin({
      roomId: roomSnapshot.room_id,
      joinCode: roomJoinCode.trim(),
    });
  }

  function dismissDialog(): void {
    if (dialog?.code === "ROOM_STATE_CHANGED") {
      rememberPrivateRecoveryJoinHint();
      roomStore.leaveRoom();
      navigate("lobby");
      return;
    }

    if (dialog?.blocking && roomSnapshot?.room_state === "CLOSED") {
      rememberPrivateRecoveryJoinHint();
      roomStore.leaveRoom();
      navigate("lobby");
      return;
    }

    roomStore.clearError();
  }

  function retryReconnectFromDialog(): void {
    const started = roomStore.retryReconnect();
    if (!started) {
      roomStore.clearError();
    }
  }

  function backToLobbyFromDialog(): void {
    rememberPrivateRecoveryJoinHint();
    roomStore.leaveRoom();
    navigate("lobby");
  }

  async function recreateRoomFromDialog(): Promise<void> {
    const recreated = await roomStore.recreateClosedRoom({
      apiBaseUrl: savedSettings.apiBaseUrl,
      playerId: savedSettings.playerId,
      displayName: savedSettings.displayName,
      source: savedSettings.source,
      bitUnlockEnabled: savedSettings.bitUnlockEnabled,
      djpUnlockEnabled: savedSettings.djpUnlockEnabled,
      allowLeggendaria: savedSettings.allowLeggendaria,
      ownedPackIds: savedSettings.ownedPackIds,
    });
    if (recreated) {
      roomStore.clearError();
      navigate("room");
    }
  }

  function resolveSourceUnresolvedDialog(action: "accept" | "skip" | "close"): void {
    sourceStore.resolveActiveUnresolvedDialog(action);
  }

  async function handleOpenMatchHistory(): Promise<void> {
    setIsOpeningMatchHistory(true);
    try {
      await showMatchHistoryWindow();
    } catch {
      setToastMessage("試合履歴ウィンドウを開けませんでした。");
    } finally {
      setIsOpeningMatchHistory(false);
    }
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
    const captureDelayMs = mockScenario.captureDelayMs ?? runtimeConfig.captureDelayMs;

    void (async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => window.setTimeout(resolve, captureDelayMs));
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
      {activeView !== "room" && activeView !== "automatch" ? (
        <AppSidebar
          activeView={activeView}
          hasRoom={roomSnapshot !== null}
          isOpeningMatchHistory={isOpeningMatchHistory}
          onNavigate={navigate}
          onOpenMatchHistory={() => {
            void handleOpenMatchHistory();
          }}
        />
      ) : null}

      <section className={activeView === "room" || activeView === "automatch" ? "relative min-w-0 flex-1 overflow-hidden" : "custom-scrollbar relative min-w-0 flex-1 overflow-y-auto p-8"}>
        {activeView === "lobby" ? (
          <LobbyPage
            pendingJoinRoomId={pendingDeepLinkRoomId}
            pendingRecoveryJoin={pendingRecoveryJoin}
            onConsumePendingJoinRoomId={() => {
              setPendingDeepLinkRoomId(null);
            }}
            onConsumePendingRecoveryJoin={() => {
              setPendingRecoveryJoin(null);
            }}
            onNavigateToAutoMatch={() => {
              navigate("automatch");
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
        {activeView === "automatch" ? (
          <AutoMatchPage
            onNavigate={(view) => {
              navigate(view);
            }}
          />
        ) : null}
        {activeView === "stats" ? (
          <StatsPage
            onNavigateToLobby={() => {
              navigate("lobby");
            }}
          />
        ) : null}
      </section>

      {sourceUnresolvedDialog ? (
        <SourceUnresolvedDialog
          dialog={sourceUnresolvedDialog}
          onAction={resolveSourceUnresolvedDialog}
        />
      ) : null}
      {dialog ? (
        <ErrorDialog
          dialog={dialog}
          onClose={dismissDialog}
          onRetryReconnect={retryReconnectFromDialog}
          onReturnToLobby={backToLobbyFromDialog}
          {...(canRecreateFromDialog ? { onRecreateRoom: recreateRoomFromDialog } : {})}
        />
      ) : null}
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
      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[2900] w-full max-w-[min(560px,calc(100%-2rem))] -translate-x-1/2 px-4">
          <div className="rounded-2xl border border-cyan-500/30 bg-[#0f1820]/95 px-5 py-3 text-sm font-bold text-cyan-100 shadow-[0_18px_44px_rgba(0,0,0,0.45)] backdrop-blur">
            {toastMessage}
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
