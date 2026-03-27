type WebShareAnalyticsEvent = "join_page_viewed" | "deep_link_attempted";

interface WebShareAnalyticsPayload {
  roomRef: string;
  [key: string]: unknown;
}

export function logWebShareAnalytics(
  event: WebShareAnalyticsEvent,
  payload: WebShareAnalyticsPayload,
): void {
  const record = {
    ts: new Date().toISOString(),
    event,
    platform: "web",
    ...payload,
  };
  console.info("[share-analytics]", record);
}
