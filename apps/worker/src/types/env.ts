export interface KvListKey {
  name: string;
}

export interface KvListResult {
  keys: KvListKey[];
  list_complete: boolean;
  cursor?: string;
}

export interface RoomLobbyKvNamespace {
  put(key: string, value: string): Promise<void>;
  get(key: string, type: "text"): Promise<string | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<KvListResult>;
}

export interface DurableObjectIdLike {
  toString(): string;
}

export interface RoomDurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface RoomDurableObjectNamespace {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): RoomDurableObjectStub;
}

export interface WorkerEnv {
  ROOM_LOBBY_KV: RoomLobbyKvNamespace;
  ROOM_DO: RoomDurableObjectNamespace;
}
