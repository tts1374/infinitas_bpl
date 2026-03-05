import type { ISO8601String } from "./common";
import type { ExpectedKey } from "./expected-key";

export interface FrozenRoundDisplay {
  title: string;
  level: number | null;
}

export interface FrozenRound {
  round_index: number;
  expected_key: ExpectedKey;
  display: FrozenRoundDisplay;
  started_at: ISO8601String | null;
  soft_ttl_seconds: number;
}
