import type { ChartDifficulty, LevelFilter, PlayStyle } from "../enums";

export interface ChartSearchEntry {
  chart_key: string;
  chart_id?: number | null;
  play_style: PlayStyle;
  difficulty: ChartDifficulty;
  level: number;
  title: string;
  title_qualifier: string;
  artist: string;
  genre: string;
  title_search_key: string;
}

export interface ChartSearchQuery {
  cursor?: string;
  limit?: number;
  play_style: PlayStyle;
  level_filter: LevelFilter;
  difficulty?: ChartDifficulty;
  level?: number;
  keyword?: string;
}

export interface ChartSearchResponse {
  charts: ChartSearchEntry[];
  next_cursor: string | null;
}
