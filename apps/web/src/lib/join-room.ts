import { WEB_LINKS, WEB_RUNTIME } from "./config";

export type RecruitmentStatus = "recruiting" | "full" | "closed" | "expired";

export interface JoinRoomSummary {
  roomName: string;
  status: RecruitmentStatus;
  isShareable: boolean;
  downloadUrl: string;
  updatedAtIso?: string;
}

interface JoinRoomApiResponse {
  room_name?: string;
  roomName?: string;
  recruitment_status?: string;
  status?: string;
  shareable?: boolean;
  download_url?: string;
  downloadUrl?: string;
  updated_at?: string;
  updatedAt?: string;
}

const toStatus = (value: string | undefined): RecruitmentStatus => {
  const normalized = value?.trim().toLowerCase() ?? "";
  switch (normalized) {
    case "recruiting":
    case "open":
      return "recruiting";
    case "full":
      return "full";
    case "closed":
      return "closed";
    case "expired":
    case "invalid":
      return "expired";
    default:
      return "expired";
  }
};

const buildExpiredSummary = (): JoinRoomSummary => ({
  roomName: "期限切れまたは無効な招待URL",
  status: "expired",
  isShareable: false,
  downloadUrl: WEB_LINKS.download,
});

const resolveEndpoint = (roomRef: string): string | null => {
  if (!WEB_RUNTIME.joinApiEndpoint) {
    return null;
  }

  const url = new URL(WEB_RUNTIME.joinApiEndpoint, window.location.origin);
  url.searchParams.set("r", roomRef);
  return url.toString();
};

const parseApiSummary = (payload: JoinRoomApiResponse): JoinRoomSummary => {
  const roomName = payload.room_name?.trim() || payload.roomName?.trim() || "INFINITAS ARENA Room";
  const status = toStatus(payload.recruitment_status || payload.status);
  const downloadUrl = payload.download_url?.trim() || payload.downloadUrl?.trim() || WEB_LINKS.download;
  const updatedAtIso = payload.updated_at?.trim() || payload.updatedAt?.trim();

  const summary: JoinRoomSummary = {
    roomName,
    status,
    isShareable: payload.shareable ?? status === "recruiting",
    downloadUrl,
  };

  if (updatedAtIso && updatedAtIso.length > 0) {
    summary.updatedAtIso = updatedAtIso;
  }

  return summary;
};

export const fetchJoinRoomSummary = async (
  roomRef: string,
  signal?: AbortSignal,
): Promise<JoinRoomSummary> => {
  const trimmedRef = roomRef.trim();
  if (!trimmedRef) {
    return buildExpiredSummary();
  }

  const endpoint = resolveEndpoint(trimmedRef);
  if (!endpoint) {
    return buildExpiredSummary();
  }

  try {
    const requestInit: RequestInit = {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    };
    if (signal) {
      requestInit.signal = signal;
    }

    const response = await fetch(endpoint, requestInit);

    if (!response.ok) {
      throw new Error(`Join status request failed: ${response.status}`);
    }

    const payload = (await response.json()) as JoinRoomApiResponse;
    return parseApiSummary(payload);
  } catch {
    return buildExpiredSummary();
  }
};
