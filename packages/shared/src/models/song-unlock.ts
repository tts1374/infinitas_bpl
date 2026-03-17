export interface SongUnlockSettings {
  bit_unlocked: boolean;
  djp_unlocked: boolean;
  owned_pack_ids: number[];
}

export interface MatchSongUnlockFilter {
  include_bit: boolean;
  include_djp: boolean;
  common_pack_ids: number[];
}
