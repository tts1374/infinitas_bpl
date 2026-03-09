export interface UpdateCheckQuery {
  currentVersion: string;
  target: string;
}

export interface UpdateResponse {
  version: string;
  url: string;
  signature: string;
  notes?: string;
  pub_date?: string;
}
