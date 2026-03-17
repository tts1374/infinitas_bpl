import type { SongPack } from "@infinitas/shared";
import { workerChartMaster } from "../master/chart-master";

export interface SongPackListResponse {
  song_packs: SongPack[];
}

export function listSongPacks(): SongPackListResponse {
  return {
    song_packs: workerChartMaster.getSongPacks(),
  };
}
