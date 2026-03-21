export interface SongUnlockSettings {
  bit_unlocked: boolean;
  djp_unlocked: boolean;
  allow_leggendaria: boolean;
  owned_pack_ids: number[];
}

export interface MatchSongUnlockFilter {
  include_bit: boolean;
  include_djp: boolean;
  include_leggendaria: boolean;
  common_pack_ids: number[];
}
