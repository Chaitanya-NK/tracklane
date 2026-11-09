const DAY = 86_400_000;

/** YYYY-MM-DD in UTC. */
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Every day from start to end inclusive, as YYYY-MM-DD (UTC). */
export function daysBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const to = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  for (let t = from; t <= to && out.length < 3660; t += DAY) out.push(isoDay(new Date(t)));
  return out;
}

export interface BurndownPoint {
  date: string;
  /** Ideal remaining points (straight line from scope to 0). */
  ideal: number;
  /** Actual remaining points; null for days still ahead. */
  remaining: number | null;
  /** Sprint scope that day (shows scope creep). */
  scope: number | null;
}

/**
 * Sprint burndown from daily snapshots. Days without a snapshot carry the previous value
 * forward (the worker may have been down); days after `today` stay empty.
 */
export function burndown(input: {
  start: Date;
  end: Date;
  today: Date;
  snapshots: { date: string; remaining: number; scope: number }[];
}): BurndownPoint[] {
  const days = daysBetween(input.start, input.end);
  const byDay = new Map(input.snapshots.map((s) => [s.date, s]));
  const initialScope =
    input.snapshots.find((s) => s.date >= days[0]!)?.scope ?? input.snapshots[0]?.scope ?? 0;
  const today = isoDay(input.today);
  let last: { remaining: number; scope: number } | null = null;
  return days.map((date, i) => {
    const snap = byDay.get(date);
    if (snap) last = snap;
    const ideal = days.length > 1 ? initialScope * (1 - i / (days.length - 1)) : 0;
    const future = date > today;
    return {
      date,
      ideal: Math.round(ideal * 10) / 10,
      remaining: future ? null : (last?.remaining ?? null),
      scope: future ? null : (last?.scope ?? null),
    };
  });
}

export interface FlowPoint {
  date: string;
  todo: number;
  inProgress: number;
  done: number;
}

/** Cumulative flow: issue counts per status category per day, gaps carried forward. */
export function cumulativeFlow(input: {
  start: Date;
  end: Date;
  snapshots: FlowPoint[];
}): FlowPoint[] {
  const byDay = new Map(input.snapshots.map((s) => [s.date, s]));
  let last: FlowPoint | null = null;
  return daysBetween(input.start, input.end).flatMap((date) => {
    const snap = byDay.get(date);
    if (snap) last = snap;
    return last ? [{ ...last, date }] : [];
  });
}

export interface CreatedResolvedPoint {
  date: string;
  created: number;
  resolved: number;
  /** Open issues added minus closed since the start of the range (positive = growing). */
  trend: number;
}

/** Issues created vs resolved per day in a range. */
export function createdVsResolved(input: {
  start: Date;
  end: Date;
  created: Date[];
  resolved: Date[];
}): CreatedResolvedPoint[] {
  const count = (dates: Date[]) => {
    const map = new Map<string, number>();
    for (const d of dates) map.set(isoDay(d), (map.get(isoDay(d)) ?? 0) + 1);
    return map;
  };
  const created = count(input.created);
  const resolved = count(input.resolved);
  let trend = 0;
  return daysBetween(input.start, input.end).map((date) => {
    const c = created.get(date) ?? 0;
    const r = resolved.get(date) ?? 0;
    trend += c - r;
    return { date, created: c, resolved: r, trend };
  });
}

export interface VelocityPoint {
  sprint: string;
  committed: number;
  completed: number;
}

/** Average completed points over the last `window` sprints. */
export function averageVelocity(points: VelocityPoint[], window = 3) {
  const recent = points.slice(-window);
  if (!recent.length) return 0;
  return Math.round((recent.reduce((s, p) => s + p.completed, 0) / recent.length) * 10) / 10;
}
