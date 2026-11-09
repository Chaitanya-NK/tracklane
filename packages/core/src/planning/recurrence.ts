export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

const DAY = 86_400_000;
const midnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * The next run strictly after `after`, at 00:00 UTC on a matching day.
 * daily: every day; weekly: ISO weekdays in `days` (1 = Monday); monthly: day of month in
 * `days[0]` (clamped to the month's length, so 31 means "last day").
 */
export function nextRun(frequency: RecurrenceFrequency, days: number[], after: Date): Date {
  let t = midnight(after) + DAY;
  for (let i = 0; i < 400; i++, t += DAY) {
    const d = new Date(t);
    if (frequency === "daily") return d;
    if (frequency === "weekly") {
      const iso = ((d.getUTCDay() + 6) % 7) + 1;
      if ((days.length ? days : [1]).includes(iso)) return d;
    } else {
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      const want = Math.min(Math.max(1, days[0] ?? 1), lastDay);
      if (d.getUTCDate() === want) return d;
    }
  }
  throw new Error("No matching day within a year");
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Every day", "Weekly on Mon, Thu", "Monthly on day 1". */
export function describeRecurrence(frequency: RecurrenceFrequency, days: number[]) {
  if (frequency === "daily") return "Every day";
  if (frequency === "weekly")
    return `Weekly on ${[...days]
      .sort()
      .map((d) => WEEKDAYS[d - 1])
      .join(", ")}`;
  return `Monthly on day ${days[0] ?? 1}`;
}
