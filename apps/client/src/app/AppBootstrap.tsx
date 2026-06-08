import { useEffect } from "react";
import { App } from "./App";
import { UpdaterGateDialog } from "../components/UpdaterGateDialog";
import { useAppUpdater } from "../hooks/useAppUpdater";
import { appUpdaterService } from "../services/updater/updater-service";
import { MatchHistoryWindow } from "../pages/MatchHistoryWindow";

export function AppBootstrap() {
  const isMatchHistoryWindow =
    new URLSearchParams(window.location.search).get("view") === "match-history";
  const snapshot = useAppUpdater((state) => state);

  useEffect(() => {
    if (isMatchHistoryWindow) {
      return;
    }
    void appUpdaterService.bootstrap();
  }, [isMatchHistoryWindow]);

  if (isMatchHistoryWindow) {
    return <MatchHistoryWindow />;
  }

  if (snapshot.phase === "continue-app" || snapshot.phase === "done") {
    return <App />;
  }

  return (
    <UpdaterGateDialog
      snapshot={snapshot}
      onStartUpdate={() => {
        void appUpdaterService.installAvailableUpdate();
      }}
    />
  );
}
