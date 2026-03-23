const envOrDefault = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const withTrailingSlash = (path: string): string => (path.endsWith("/") ? path : `${path}/`);

const basePath = withTrailingSlash(import.meta.env.BASE_URL || "/");

export const WEB_LINKS = Object.freeze({
  download: envOrDefault(
    import.meta.env.VITE_DOWNLOAD_URL,
    "https://github.com/tts1374/infinitas_arena/releases/latest",
  ),
  releaseNotes: envOrDefault(
    import.meta.env.VITE_RELEASE_NOTES_URL,
    "https://github.com/tts1374/infinitas_arena/releases",
  ),
  support: envOrDefault(
    import.meta.env.VITE_SUPPORT_URL,
    "https://github.com/tts1374/infinitas_arena/issues",
  ),
  github: envOrDefault(import.meta.env.VITE_GITHUB_URL, "https://github.com/tts1374/infinitas_arena"),
  knownIssues: envOrDefault(
    import.meta.env.VITE_KNOWN_ISSUES_URL,
    "https://github.com/tts1374/infinitas_arena/issues?q=is%3Aissue+is%3Aopen",
  ),
});

export const WEB_RUNTIME = Object.freeze({
  basePath,
  deepLinkScheme: envOrDefault(import.meta.env.VITE_DEEP_LINK_SCHEME, "infinitas-arena://join"),
  joinApiEndpoint: import.meta.env.VITE_JOIN_API_ENDPOINT?.trim() ?? "",
});

export const JOIN_DEMO_QUERY = "demo-open";

export const assetPath = (relativePath: string): string =>
  `${basePath}${relativePath.replace(/^\/+/, "")}`;
