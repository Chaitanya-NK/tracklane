/** Sprint capacity planning: who's around, and how many points the team can take on. */

export interface CapacityInput {
  userId: string;
  /** Working days away during the sprint. */
  daysOff: number;
  /** Manual points; null = derived from velocity. */
  points: number | null;
  /** Points already assigned to them in the sprint. */
  assigned: number;
}

export interface CapacityRow extends CapacityInput {
  capacity: number | null;
  over: boolean;
}

const DAY = 86_400_000;

/** Monday–Friday days from start to end (inclusive). Dates are YYYY-MM-DD. */
export function workingDays(start: string, end: string): number {
  const from = new Date(`${start}T00:00:00Z`).getTime();
  const to = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  let days = 0;
  for (let t = from; t <= to; t += DAY) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return days;
}

/**
 * Each person's capacity: their manual points, or an equal share of the team's velocity scaled
 * by the days they're around. Null when there's no velocity to go on.
 */
export function planCapacity(
  members: CapacityInput[],
  { velocity, days }: { velocity: number | null; days: number },
): { rows: CapacityRow[]; total: number | null; assigned: number } {
  const share = velocity !== null && members.length ? velocity / members.length : null;
  const rows = members.map((m): CapacityRow => {
    const daysOff = Math.max(0, Math.min(m.daysOff, days));
    const derived =
      share !== null && days > 0 ? Math.round((share * (days - daysOff)) / days) : null;
    const capacity = m.points ?? derived;
    return { ...m, daysOff, capacity, over: capacity !== null && m.assigned > capacity };
  });
  const known = rows.filter((r) => r.capacity !== null);
  return {
    rows,
    total: known.length ? known.reduce((sum, r) => sum + r.capacity!, 0) : null,
    assigned: rows.reduce((sum, r) => sum + r.assigned, 0),
  };
}

/** Average completed points of the last few sprints, or null with no history. */
export function averageVelocity(completed: (number | null)[], take = 3): number | null {
  const recent = completed.filter((p): p is number => p !== null).slice(0, take);
  return recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null;
}
