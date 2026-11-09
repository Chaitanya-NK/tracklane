export type SlaState = "running" | "at_risk" | "breached" | "met" | "missed";

export interface SlaResult {
  state: SlaState;
  /** When the clock started and its target. */
  startedAt: Date;
  dueAt: Date;
  /** When it stopped (first response / resolution), if it has. */
  stoppedAt: Date | null;
  /** Minutes left (negative once past the target). For stopped clocks, at the stop. */
  remainingMinutes: number;
}

/**
 * Evaluates one SLA clock. Calendar time: a 4h target is four real hours, nights included.
 * `met` / `missed` are final; `running` / `at_risk` / `breached` are still counting.
 */
export function evaluateSla(input: {
  startedAt: Date;
  stoppedAt: Date | null;
  targetMinutes: number;
  warnMinutes: number;
  now: Date;
}): SlaResult {
  const dueAt = new Date(input.startedAt.getTime() + input.targetMinutes * 60_000);
  const at = input.stoppedAt ?? input.now;
  const remainingMinutes = Math.round((dueAt.getTime() - at.getTime()) / 60_000);
  let state: SlaState;
  if (input.stoppedAt) state = remainingMinutes >= 0 ? "met" : "missed";
  else if (remainingMinutes < 0) state = "breached";
  else if (remainingMinutes <= input.warnMinutes) state = "at_risk";
  else state = "running";
  return { state, startedAt: input.startedAt, dueAt, stoppedAt: input.stoppedAt, remainingMinutes };
}

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  running: "On track",
  at_risk: "At risk",
  breached: "Breached",
  met: "Met",
  missed: "Missed",
};
