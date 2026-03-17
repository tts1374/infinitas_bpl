import type { ISO8601String } from "./common";

export interface SongPack {
  inf_pack_id: number;
  pack_code: string;
  pack_name: string;
  display_order: number;
  created_at: ISO8601String;
  updated_at: ISO8601String;
}
