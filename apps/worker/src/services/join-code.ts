import { JOIN_CODE_CHARSET, JOIN_CODE_LENGTH } from "@infinitas/shared";

const JOIN_CODE_ALLOWED = new Set(JOIN_CODE_CHARSET.split(""));

function getRandomInt(maxExclusive: number): number {
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  const randomValue = randomBytes[0];
  if (randomValue === undefined) {
    throw new Error("Failed to get random value.");
  }

  return randomValue % maxExclusive;
}

export function generateJoinCode(): string {
  let generated = "";
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    const charIndex = getRandomInt(JOIN_CODE_CHARSET.length);
    generated += JOIN_CODE_CHARSET[charIndex]!;
  }

  return generated;
}

export function normalizeJoinCode(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const normalized = raw.trim().toUpperCase();
  return normalized.length === 0 ? null : normalized;
}

export function isValidJoinCode(joinCode: string): boolean {
  if (joinCode.length !== JOIN_CODE_LENGTH) {
    return false;
  }

  for (const character of joinCode) {
    if (!JOIN_CODE_ALLOWED.has(character)) {
      return false;
    }
  }

  return true;
}
