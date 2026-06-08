import { describe, expect, it, vi } from "vitest";

describe("buildJoinDeepLink", () => {
  it("appends the encoded room reference to the configured scheme", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DEEP_LINK_SCHEME", "infinitas-arena://join");

    const { buildJoinDeepLink } = await import("./deeplink");

    expect(buildJoinDeepLink("room A")).toBe("infinitas-arena://join?r=room%20A");
  });

  it("uses ampersand when the configured scheme already has a query", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_DEEP_LINK_SCHEME", "infinitas-arena://join?mode=join");

    const { buildJoinDeepLink } = await import("./deeplink");

    expect(buildJoinDeepLink("room-1")).toBe("infinitas-arena://join?mode=join&r=room-1");
  });
});
