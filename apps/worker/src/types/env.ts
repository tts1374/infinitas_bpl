export interface DurableObjectIdLike {
  toString(): string;
}

export interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>;
}

export interface RoomDurableObjectNamespace {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface LobbyDirectoryDurableObjectNamespace {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}

export interface WorkerEnv {
  ROOM_DO: RoomDurableObjectNamespace;
  LOBBY_DIRECTORY_DO: LobbyDirectoryDurableObjectNamespace;
}
