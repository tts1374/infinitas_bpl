import type { ChartDifficulty, PlayStyle } from "../enums";

export interface ExpectedKey {
  play_style: PlayStyle;
  difficulty: ChartDifficulty | string;
  title_search_key: string;
  chart_id?: number | null;
}
