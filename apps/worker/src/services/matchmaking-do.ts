import type { MatchmakingQueueRequest, MatchmakingQueueTicket } from "@infinitas/shared";
import type { WorkerEnv } from "../types/env";

const INTERNAL_MATCHMAKING_QUEUE_URL = "https://matchmaking.internal/internal/queue";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const MATCHMAKING_GLOBAL_QUEUE_KEY = "global";

interface MatchmakingErrorPayload {
  error?: string;
}

function buildQueueTicketUrl(ticketId: string): string {
  const encodedTicketId = encodeURIComponent(ticketId);
  return `${INTERNAL_MATCHMAKING_QUEUE_URL}/${encodedTicketId}`;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as MatchmakingErrorPayload;
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // no-op
  }

  return `Matchmaking request failed (${response.status}).`;
}

function getMatchmakingStub(env: WorkerEnv) {
  const id = env.MATCHMAKING_DO.idFromName(MATCHMAKING_GLOBAL_QUEUE_KEY);
  return env.MATCHMAKING_DO.get(id);
}

export async function enqueueMatchmakingTicket(
  env: WorkerEnv,
  request: MatchmakingQueueRequest,
): Promise<MatchmakingQueueTicket> {
  const response = await getMatchmakingStub(env).fetch(
    new Request(INTERNAL_MATCHMAKING_QUEUE_URL, {
      method: "POST",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(request),
    }),
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as MatchmakingQueueTicket;
}

export async function fetchMatchmakingTicket(
  env: WorkerEnv,
  ticketId: string,
): Promise<MatchmakingQueueTicket> {
  const response = await getMatchmakingStub(env).fetch(
    new Request(buildQueueTicketUrl(ticketId), {
      method: "GET",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
    }),
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as MatchmakingQueueTicket;
}

export async function cancelMatchmakingTicket(
  env: WorkerEnv,
  ticketId: string,
): Promise<MatchmakingQueueTicket> {
  const response = await getMatchmakingStub(env).fetch(
    new Request(buildQueueTicketUrl(ticketId), {
      method: "DELETE",
      headers: {
        "content-type": JSON_CONTENT_TYPE,
      },
    }),
  );
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as MatchmakingQueueTicket;
}
