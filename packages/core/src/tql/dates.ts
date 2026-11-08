/**
 * Date values in TQL: ISO dates ("2026-11-30"), relative offsets ("-7d", "2w", "+3m", "-12h")
 * and functions (startOfWeek()). Weeks start on Monday. All arithmetic is in UTC.
 */
const RELATIVE = /^([+-]?)(\d+)([hdwm])$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateLiteral(value: string): boolean {
  return (
    RELATIVE.test(value) ||
    (ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
  );
}

const startOfDayUtc = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function resolveDateFunction(name: string, now: Date): Date {
  const day = startOfDayUtc(now);
  const DAY = 86_400_000;
  const mondayOffset = (day.getUTCDay() + 6) % 7;
  switch (name) {
    case "now":
      return now;
    case "startOfDay":
      return day;
    case "endOfDay":
      return new Date(day.getTime() + DAY - 1);
    case "startOfWeek":
      return new Date(day.getTime() - mondayOffset * DAY);
    case "endOfWeek":
      return new Date(day.getTime() + (7 - mondayOffset) * DAY - 1);
    case "startOfMonth":
      return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    case "endOfMonth":
      return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1) - 1);
    default:
      throw new Error(`Unknown date function ${name}()`);
  }
}

/** ISO date → that day's UTC midnight; relative value → now ± offset. Null if not a date. */
export function resolveDateLiteral(value: string, now: Date): Date | null {
  if (ISO_DATE.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = RELATIVE.exec(value);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const amount = Number(match[2]) * sign;
  const unit = match[3]!.toLowerCase();
  const d = new Date(now);
  if (unit === "h") d.setUTCHours(d.getUTCHours() + amount);
  if (unit === "d") d.setUTCDate(d.getUTCDate() + amount);
  if (unit === "w") d.setUTCDate(d.getUTCDate() + amount * 7);
  if (unit === "m") d.setUTCMonth(d.getUTCMonth() + amount);
  return d;
}
