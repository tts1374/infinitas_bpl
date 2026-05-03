export function getAuthoritativePickingCountdownSeconds(
  pickingDeadline: string | null | undefined,
  nowMs: number,
): number | null {
  if (!pickingDeadline) {
    return null;
  }

  const deadlineMs = Date.parse(pickingDeadline);
  if (Number.isNaN(deadlineMs)) {
    return null;
  }

  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000));
}
