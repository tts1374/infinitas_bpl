import { WEB_RUNTIME } from "./config";

export type DeepLinkAttemptResult = "launched" | "fallback";

const resolveSeparator = (base: string): string => {
  if (!base.includes("?")) {
    return "?";
  }

  if (base.endsWith("?") || base.endsWith("&")) {
    return "";
  }

  return "&";
};

export const buildJoinDeepLink = (roomRef: string): string =>
  `${WEB_RUNTIME.deepLinkScheme}${resolveSeparator(WEB_RUNTIME.deepLinkScheme)}r=${encodeURIComponent(roomRef)}`;

export const attemptOpenDeepLink = (deepLinkUrl: string, timeoutMs = 1800): Promise<DeepLinkAttemptResult> =>
  new Promise((resolve) => {
    let settled = false;
    let timerId = 0;

    const cleanup = (): void => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.clearTimeout(timerId);
    };

    const settle = (result: DeepLinkAttemptResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleVisibility = (): void => {
      if (document.hidden) {
        settle("launched");
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);

    try {
      window.location.href = deepLinkUrl;
    } catch {
      settle("fallback");
      return;
    }

    timerId = window.setTimeout(() => {
      settle(document.hidden ? "launched" : "fallback");
    }, timeoutMs);
  });
