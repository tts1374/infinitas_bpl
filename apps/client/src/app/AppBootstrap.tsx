import { useEffect } from "react";
import { App } from "./App";
import { UpdaterGateDialog } from "../components/UpdaterGateDialog";
import { useAppUpdater } from "../hooks/useAppUpdater";
import { appUpdaterService } from "../services/updater/updater-service";

export function AppBootstrap() {
  const snapshot = useAppUpdater((state) => state);

  useEffect(() => {
    void appUpdaterService.bootstrap();
  }, []);

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
