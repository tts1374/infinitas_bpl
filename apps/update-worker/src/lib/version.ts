interface ParsedVersion {
  normalized: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const SEMVER_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/;

function parseVersion(version: string): ParsedVersion | null {
  const match = SEMVER_PATTERN.exec(version.trim());
  if (match === null) {
    return null;
  }

  const majorRaw = match[1];
  const minorRaw = match[2];
  const patchRaw = match[3];
  const prereleaseRaw = match[4];
  const buildRaw = match[5];
  if (majorRaw === undefined || minorRaw === undefined || patchRaw === undefined) {
    return null;
  }

  const normalized = `${majorRaw}.${minorRaw}.${patchRaw}${prereleaseRaw ? `-${prereleaseRaw}` : ""}${buildRaw ? `+${buildRaw}` : ""}`;

  return {
    normalized,
    major: Number.parseInt(majorRaw, 10),
    minor: Number.parseInt(minorRaw, 10),
    patch: Number.parseInt(patchRaw, 10),
    prerelease: prereleaseRaw ? prereleaseRaw.split(".") : [],
  };
}

function compareIdentifier(left: string, right: string): number {
  const leftIsNumeric = NUMERIC_IDENTIFIER_PATTERN.test(left);
  const rightIsNumeric = NUMERIC_IDENTIFIER_PATTERN.test(right);

  if (leftIsNumeric && rightIsNumeric) {
    return Number.parseInt(left, 10) - Number.parseInt(right, 10);
  }

  if (leftIsNumeric) {
    return -1;
  }

  if (rightIsNumeric) {
    return 1;
  }

  return left.localeCompare(right);
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }

  if (left.length === 0) {
    return 1;
  }

  if (right.length === 0) {
    return -1;
  }

  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftIdentifier = left[index];
    const rightIdentifier = right[index];

    if (leftIdentifier === undefined) {
      return -1;
    }

    if (rightIdentifier === undefined) {
      return 1;
    }

    const result = compareIdentifier(leftIdentifier, rightIdentifier);
    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

export function normalizeVersion(version: string): string {
  const parsed = parseVersion(version);
  if (parsed === null) {
    throw new Error("invalid version");
  }

  return parsed.normalized;
}

export function compareVersions(current: string, latest: string): number {
  const currentParsed = parseVersion(current);
  const latestParsed = parseVersion(latest);

  if (currentParsed === null || latestParsed === null) {
    throw new Error("invalid version");
  }

  if (currentParsed.major !== latestParsed.major) {
    return currentParsed.major - latestParsed.major;
  }

  if (currentParsed.minor !== latestParsed.minor) {
    return currentParsed.minor - latestParsed.minor;
  }

  if (currentParsed.patch !== latestParsed.patch) {
    return currentParsed.patch - latestParsed.patch;
  }

  return comparePrerelease(currentParsed.prerelease, latestParsed.prerelease);
}
