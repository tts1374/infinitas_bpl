import {
  MODES,
  PLAY_STYLES,
  WIN_METRICS,
  type MatchmakingQueueRequest,
  type MatchmakingWaitingCountQuery,
} from "@infinitas/shared";
import {
  cancelMatchmakingTicket,
  enqueueMatchmakingTicket,
  fetchMatchmakingWaitingCount,
  fetchMatchmakingTicket,
} from "../services/matchmaking-do";
import type { WorkerEnv } from "../types/env";
import { badRequest, created, ok, parseJsonBody } from "../utils/http";
import { asEnumValue } from "../utils/validation";

const MATCHMAKING_QUEUE_TICKET_PATH_PATTERN = /^\/api\/matchmaking\/queue\/([^/]+)$/;

export function matchMatchmakingQueueTicketPath(pathname: string): string | null {
  const match = MATCHMAKING_QUEUE_TICKET_PATH_PATTERN.exec(pathname);
  if (!match) {
    return null;
  }

  const [, encodedTicketId] = match;
  if (!encodedTicketId) {
    return null;
  }

  return decodeURIComponent(encodedTicketId);
}

function parseWaitingCountQuery(request: Request): MatchmakingWaitingCountQuery | null {
  const url = new URL(request.url);
  const mode = asEnumValue(url.searchParams.get("mode"), MODES);
  const playStyle = asEnumValue(url.searchParams.get("play_style"), PLAY_STYLES);
  const winMetric = asEnumValue(url.searchParams.get("win_metric"), WIN_METRICS);

  if (mode === undefined || playStyle === undefined || winMetric === undefined) {
    return null;
  }

  return {
    mode,
    play_style: playStyle,
    win_metric: winMetric,
  };
}

export async function handlePostMatchmakingQueue(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    const payload = (await parseJsonBody(request)) as MatchmakingQueueRequest;
    const response = await enqueueMatchmakingTicket(env, payload);
    return created(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue matchmaking ticket.";
    return badRequest(message);
  }
}

export async function handleGetMatchmakingQueueTicket(
  _request: Request,
  env: WorkerEnv,
  ticketId: string,
): Promise<Response> {
  try {
    const response = await fetchMatchmakingTicket(env, ticketId);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch matchmaking ticket.";
    return badRequest(message);
  }
}

export async function handleDeleteMatchmakingQueueTicket(
  _request: Request,
  env: WorkerEnv,
  ticketId: string,
): Promise<Response> {
  try {
    const response = await cancelMatchmakingTicket(env, ticketId);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel matchmaking ticket.";
    return badRequest(message);
  }
}

export async function handleGetMatchmakingWaitingCount(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    const query = parseWaitingCountQuery(request);
    if (query === null) {
      return badRequest("Invalid waiting-count query.");
    }

    const response = await fetchMatchmakingWaitingCount(env, query);
    return ok(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch waiting count.";
    return badRequest(message);
  }
}
