export interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
}

export interface R2ObjectBody {
  text(): Promise<string>;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

export interface Env {
  APP_KV: KVNamespace;
  APP_BUCKET: R2Bucket;
  DOWNLOAD_BASE_URL: string;
}
