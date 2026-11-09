/** Spreads open work over working days to show who's overloaded when. Pure, client-safe. */

export type WorkloadMetric = "hours" | "points" | "issues";

export interface PlanIssue {
  assigneeId: string | null;
  /** YYYY-MM-DD; null = not scheduled. */
  startDate: string | null;
  dueDate: string | null;
  points: number | null;
  /** Minutes. */
  timeEstimate: number | null;
}

export interface TimeOffRange {
  userId: string;
  start: string;
  end: string;
}

export interface PlanCell {
  value: number;
  off: boolean;
  over: boolean;
}

export interface PlanRow {
  userId: string | null;
  cells: PlanCell[];
  total: number;
  unscheduled: number;
}

const DAY = 86_400_000;
const time = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const weekday = (t: number) => {
  const d = new Date(t).getUTCDay();
  return d !== 0 && d !== 6;
};

/** Working days (Mon–Fri) from `from`, `count` of them. */
export function workingDaysFrom(from: string, count: number): string[] {
  const out: string[] = [];
  for (let t = time(from); out.length < count; t += DAY) if (weekday(t)) out.push(isoDay(t));
  return out;
}

/** Daily capacity per metric (points and issues have none: they only shade by load). */
export const DAILY_CAPACITY: Record<WorkloadMetric, number | null> = {
  hours: 8,
  points: null,
  issues: null,
};

function weight(issue: PlanIssue, metric: WorkloadMetric): number {
  if (metric === "issues") return 1;
  if (metric === "points") return issue.points ?? 0;
  return (issue.timeEstimate ?? 0) / 60;
}

/**
 * Per person and day: the share of each scheduled issue's estimate that falls on that day
 * (spread evenly over the issue's working days from start — or today — to due). Days off are
 * marked and carry nothing. Issues without a due date count as unscheduled.
 */
export function planWorkload(input: {
  days: string[];
  today: string;
  people: (string | null)[];
  issues: PlanIssue[];
  timeOff: TimeOffRange[];
  metric: WorkloadMetric;
}): PlanRow[] {
  const capacity = DAILY_CAPACITY[input.metric];
  const isOff = (userId: string | null, day: string) =>
    userId !== null &&
    input.timeOff.some((o) => o.userId === userId && o.start <= day && day <= o.end);

  return input.people.map((userId) => {
    const cells = input.days.map((day) => ({ value: 0, off: isOff(userId, day), over: false }));
    let unscheduled = 0;
    for (const issue of input.issues) {
      if (issue.assigneeId !== userId) continue;
      const w = weight(issue, input.metric);
      if (!issue.dueDate) {
        unscheduled += w;
        continue;
      }
      const from = [issue.startDate, input.today].filter(Boolean).sort().at(-1)!;
      // Overdue work lands on the first day.
      const start = issue.dueDate < from ? input.days[0]! : from;
      const span: number[] = [];
      for (let t = time(start); t <= time(issue.dueDate < from ? start : issue.dueDate); t += DAY) {
        const day = isoDay(t);
        if (weekday(t) && !isOff(userId, day)) span.push(t);
      }
      const share = span.length ? w / span.length : w;
      if (!span.length) {
        const index = input.days.indexOf(start);
        if (index >= 0) cells[index]!.value += w;
        continue;
      }
      for (const t of span) {
        const index = input.days.indexOf(isoDay(t));
        if (index >= 0) cells[index]!.value += share;
      }
    }
    for (const cell of cells) {
      cell.value = Math.round(cell.value * 10) / 10;
      cell.over = capacity !== null && cell.value > capacity;
    }
    return {
      userId,
      cells,
      total: Math.round(cells.reduce((s, c) => s + c.value, 0) * 10) / 10,
      unscheduled: Math.round(unscheduled * 10) / 10,
    };
  });
}
