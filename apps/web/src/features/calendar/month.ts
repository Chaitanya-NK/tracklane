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

/** Monday of the week containing `day` (YYYY-MM-DD). */
export function mondayOf(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  const offset = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - offset * DAY).toISOString().slice(0, 10);
}

export function parseWeek(value: string | undefined, today: string): string {
  return mondayOf(
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : today,
  );
}

export function weekGrid(monday: string): string[] {
  const start = Date.parse(`${monday}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => new Date(start + i * DAY).toISOString().slice(0, 10));
}

export function shiftWeek(monday: string, delta: number): string {
  return new Date(Date.parse(`${monday}T00:00:00Z`) + delta * 7 * DAY).toISOString().slice(0, 10);
}

export function weekLabel(monday: string): string {
  const days = weekGrid(monday);
  const f = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f.format(new Date(`${days[0]}T00:00:00Z`))} – ${f.format(new Date(`${days[6]}T00:00:00Z`))}`;
}
