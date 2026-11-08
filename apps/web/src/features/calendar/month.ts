/** Month grid maths (UTC, weeks start on Monday). Months are "YYYY-MM". */
const DAY = 86_400_000;

export function parseMonth(value: string | undefined, today: string): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const d = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** The 6×7 days shown for a month, starting on the Monday on or before the 1st. */
export function monthGrid(month: string): string[] {
  const first = Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1);
  const mondayOffset = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - mondayOffset * DAY;
  return Array.from({ length: 42 }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
