type ClientShareAnalyticsEvent =
  | "share_url_generated"
  | "join_page_deep_link_received"
  | "join_page_deep_link_ignored"
  | "join_page_join_succeeded";

export function logClientShareAnalytics(
  event: ClientShareAnalyticsEvent,
  payload: Record<string, unknown>,
): void {
  console.info("[share-analytics]", {
    ts: new Date().toISOString(),
    platform: "client",
    event,
    ...payload,
  });
}
