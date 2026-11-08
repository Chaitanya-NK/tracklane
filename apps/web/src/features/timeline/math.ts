/** Date maths for the timeline. Dates are calendar days as "YYYY-MM-DD", computed in UTC. */
const DAY = 86_400_000;

export const toDay = (value: string) =>
  Date.UTC(+value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10));
export const fromDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (value: string, days: number) => fromDay(toDay(value) + days * DAY);
export const daysBetween = (from: string, to: string) =>
  Math.round((toDay(to) - toDay(from)) / DAY);

export type Zoom = "weeks" | "months" | "quarters";
export const DAY_WIDTH: Record<Zoom, number> = { weeks: 28, months: 8, quarters: 3 };

/** Visible range: all dated items plus today, padded and snapped to month starts. */
export function timelineRange(dates: string[], today: string): { start: string; end: string } {
  const all = [...dates, today].map(toDay);
  const min = new Date(Math.min(...all) - 21 * DAY);
  const max = new Date(Math.max(...all) + 60 * DAY);
  const start = Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1);
  const end = Date.UTC(max.getUTCFullYear(), max.getUTCMonth() + 1, 0);
  return { start: fromDay(start), end: fromDay(end) };
}

export interface ScaleSegment {
  label: string;
  /** Offset from range start, in days. */
  offset: number;
  days: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Header segments: months (top row) and weeks or months/quarters below, depending on zoom. */
export function timelineScale(range: { start: string; end: string }, zoom: Zoom) {
  const startMs = toDay(range.start);
  const endMs = toDay(range.end) + DAY;
  const months: ScaleSegment[] = [];
  for (
    let d = new Date(startMs);
    d.getTime() < endMs;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    const next = Math.min(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1), endMs);
    months.push({
      label:
        zoom === "quarters"
          ? MONTHS[d.getUTCMonth()]!
          : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      offset: Math.round((d.getTime() - startMs) / DAY),
      days: Math.round((next - d.getTime()) / DAY),
    });
  }
  const weeks: ScaleSegment[] = [];
  if (zoom === "weeks") {
    // First Monday on or after the range start.
    let d = startMs + ((8 - new Date(startMs).getUTCDay()) % 7) * DAY;
    for (; d < endMs; d += 7 * DAY) {
      weeks.push({
        label: String(new Date(d).getUTCDate()),
        offset: Math.round((d - startMs) / DAY),
        days: 7,
      });
    }
  }
  return { months, weeks, totalDays: Math.round((endMs - startMs) / DAY) };
}

/** Where a bar sits, in days from the range start. Missing ends fall back to the other end. */
export function barSpan(rangeStart: string, start: string | null, due: string | null) {
  const from = start ?? due;
  const to = due ?? start;
  if (!from || !to) return null;
  return { offset: daysBetween(rangeStart, from), days: daysBetween(from, to) + 1 };
}

export type DragMode = "move" | "start" | "end";

/** Applies a drag of `delta` days to an issue's dates, keeping start ≤ due. */
export function applyDrag(dates: { start: string; due: string }, mode: DragMode, delta: number) {
  if (mode === "move")
    return { start: addDays(dates.start, delta), due: addDays(dates.due, delta) };
  if (mode === "start") {
    const start = addDays(dates.start, delta);
    return { start: start > dates.due ? dates.due : start, due: dates.due };
  }
  const due = addDays(dates.due, delta);
  return { start: dates.start, due: due < dates.start ? dates.start : due };
}
