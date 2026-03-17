import type { SongPack } from "@infinitas/shared";

export interface MockSongPack {
  code: string;
  name: string;
  order: number;
}

export const SONG_PACKS: MockSongPack[] = [
  { code: 'inf_pack_vol_29', name: '楽曲パック vol.29( 32 Pinky Crush + スペシャルセレクション )', order: 42 },
  { code: 'inf_pack_gitadora_selection_vol_01', name: 'GITADORA セレクション 楽曲パック vol.1', order: 41 },
  { code: 'inf_pack_vol_28', name: '楽曲パック vol.28( 31 EPOLIS + スペシャルセレクション )', order: 40 },
  { code: 'inf_pack_sound_voltex_selection_vol_02', name: 'SOUND VOLTEX セレクション 楽曲パック vol.2', order: 39 },
  { code: 'inf_pack_vol_27', name: '楽曲パック vol.27( 31 EPOLIS + スペシャルセレクション )', order: 38 },
  { code: 'inf_pack_vol_26', name: '楽曲パック vol.26( 30 RESIDENT )', order: 37 },
  { code: 'inf_pack_ultimate_mobile_selection_vol_01', name: 'ULTIMATE MOBILE セレクション 楽曲パック vol.1', order: 36 },
  { code: 'inf_pack_bpl_selection_vol_02', name: 'BPL セレクション 楽曲パック vol.2', order: 35 },
  { code: 'inf_pack_vol_25', name: '楽曲パック vol.25( 30 RESIDENT + スペシャルセレクション )', order: 34 },
  { code: 'inf_pack_touhou_project_selection_vol_01', name: '東方Project セレクション 楽曲パック vol.1', order: 33 },
  { code: 'inf_pack_vol_24', name: '楽曲パック vol.24( 29 CastHour )', order: 32 },
  { code: 'inf_pack_vol_23', name: '楽曲パック vol.23( 29 CastHour + スペシャルセレクション )', order: 31 },
  { code: 'inf_pack_vol_22', name: '楽曲パック vol.22( 28 BISTROVER )', order: 30 },
  { code: 'inf_pack_popn_music_selection_vol_02', name: "pop'n music セレクション 楽曲パック vol.2", order: 29 },
  { code: 'inf_pack_vol_21', name: '楽曲パック vol.21( 28 BISTROVER )', order: 28 },
  { code: 'inf_pack_vol_20', name: '楽曲パック vol.20( 27 HEROIC VERSE )', order: 27 },
  { code: 'inf_pack_vol_19', name: '楽曲パック vol.19( 27 HEROIC VERSE + BPL S2セレクション )', order: 26 },
  { code: 'inf_pack_sound_voltex_selection_vol_01', name: 'SOUND VOLTEX セレクション 楽曲パック vol.1', order: 25 },
  { code: 'inf_pack_vol_18', name: '楽曲パック vol.18( 26 Rootage + セレクション )', order: 24 },
  { code: 'inf_pack_vol_17', name: '楽曲パック vol.17( 26 Rootage )', order: 23 },
  { code: 'inf_pack_bpl_selection_vol_01', name: 'BPL セレクション 楽曲パック vol.1', order: 22 },
  { code: 'inf_pack_jubeat_selection_vol_01', name: 'jubeat セレクション 楽曲パック vol.1', order: 21 },
  { code: 'inf_pack_vol_16', name: '楽曲パック vol.16( 26 Rootage )', order: 20 },
  { code: 'inf_pack_startup_selection_vol_03', name: 'スタートアップセレクション 楽曲パック vol.3', order: 19 },
  { code: 'inf_pack_vol_15', name: '楽曲パック vol.15( 25 CANNON BALLERS )', order: 18 },
  { code: 'inf_pack_startup_selection_vol_02', name: 'スタートアップセレクション 楽曲パック vol.2', order: 17 },
  { code: 'inf_pack_vol_14', name: '楽曲パック vol.14( 25 CANNON BALLERS )', order: 16 },
  { code: 'inf_pack_popn_music_selection_vol_01', name: "pop'n music セレクション 楽曲パック vol.1", order: 15 },
  { code: 'inf_pack_startup_selection_vol_01', name: 'スタートアップセレクション 楽曲パック vol.1', order: 14 },
  { code: 'inf_pack_vol_13', name: '楽曲パック vol.13( 24 SINOBUZ )', order: 13 },
  { code: 'inf_pack_vol_12', name: '楽曲パック vol.12( 24 SINOBUZ )', order: 12 },
  { code: 'inf_pack_vol_11', name: '楽曲パック vol.11( 23 copula )', order: 11 },
  { code: 'inf_pack_vol_10', name: '楽曲パック vol.10( 23 copula )', order: 10 },
  { code: 'inf_pack_vol_09', name: '楽曲パック vol.9( 22 PENDUAL )', order: 9 },
  { code: 'inf_pack_vol_08', name: '楽曲パック vol.8( 22 PENDUAL )', order: 8 },
  { code: 'inf_pack_vol_07', name: '楽曲パック vol.7( 21 SPADA )', order: 7 },
  { code: 'inf_pack_vol_06', name: '楽曲パック vol.6( 21 SPADA )', order: 6 },
  { code: 'inf_pack_vol_05', name: '楽曲パック vol.5( 20 tricoro + セレクション )', order: 5 },
  { code: 'inf_pack_vol_04', name: '楽曲パック vol.4( 20 tricoro + The 8th KAC )', order: 4 },
  { code: 'inf_pack_vol_03', name: '楽曲パック vol.3( 20 tricoro )', order: 3 },
  { code: 'inf_pack_vol_02', name: '楽曲パック vol.2( 19 Lincle + The 7th KAC )', order: 2 },
  { code: 'inf_pack_vol_01', name: '楽曲パック vol.1( 19 Lincle )', order: 1 },
];

const MOCK_PACK_TIMESTAMP = "2026-03-17T00:00:00.000Z";

export const MOCK_SONG_PACKS: SongPack[] = SONG_PACKS.map((pack) => ({
  inf_pack_id: pack.order,
  pack_code: pack.code,
  pack_name: pack.name,
  display_order: pack.order,
  created_at: MOCK_PACK_TIMESTAMP,
  updated_at: MOCK_PACK_TIMESTAMP,
}));
