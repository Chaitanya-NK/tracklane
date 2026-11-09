/** Time tracking uses an 8-hour day and a 5-day week, like Jira. */
export const MINUTES_PER_DAY = 8 * 60;
export const MINUTES_PER_WEEK = 5 * MINUTES_PER_DAY;

/**
 * Parses "1w 2d 3h 30m", "1.5h", "90m" or a bare number of minutes. Returns minutes, or null
 * when the text isn't a duration.
 */
export function parseDuration(input: string, options: { calendar?: boolean } = {}): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  // Calendar durations (SLA targets) use real days; work durations use 8-hour days.
  const unit = options.calendar
    ? ({ w: 7 * 1440, d: 1440, h: 60, m: 1 } as const)
    : ({ w: MINUTES_PER_WEEK, d: MINUTES_PER_DAY, h: 60, m: 1 } as const);
  let total = 0;
  let rest = text;
  const part = /^\s*(\d+(?:\.\d+)?)\s*([wdhm])/;
  while (rest.trim()) {
    const match = part.exec(rest);
    if (!match) return null;
    total += Number(match[1]) * unit[match[2] as keyof typeof unit];
    rest = rest.slice(match[0].length);
  }
  return Math.round(total);
}

/** 570 → "1d 1h 30m". */
export function formatDuration(minutes: number): string {
  if (!minutes) return "0m";
  const sign = minutes < 0 ? "-" : "";
  let rest = Math.abs(Math.round(minutes));
  const parts: string[] = [];
  for (const [label, size] of [
    ["w", MINUTES_PER_WEEK],
    ["d", MINUTES_PER_DAY],
    ["h", 60],
    ["m", 1],
  ] as const) {
    if (rest >= size) {
      parts.push(`${Math.floor(rest / size)}${label}`);
      rest %= size;
    }
  }
  return sign + parts.join(" ");
}

/** Wall-clock durations for SLAs ("2d 4h" here means 52 real hours). */
export function formatElapsed(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const m = Math.abs(Math.round(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  return (
    sign +
    ([d ? `${d}d` : "", h ? `${h}h` : "", !d && mm ? `${mm}m` : ""].filter(Boolean).join(" ") ||
      "0m")
  );
}
