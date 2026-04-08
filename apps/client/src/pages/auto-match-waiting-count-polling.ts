export interface WaitingCountPollGuardInput {
  disposed: boolean;
  requestId: number;
  latestRequestId: number;
}

export function canApplyWaitingCountPollResult(input: WaitingCountPollGuardInput): boolean {
  return !input.disposed && input.requestId === input.latestRequestId;
}

export function resolveWaitingCountPollValue(
  input: WaitingCountPollGuardInput,
  value: number | null,
): number | null | undefined {
  if (!canApplyWaitingCountPollResult(input)) {
    return undefined;
  }
  return value;
}
