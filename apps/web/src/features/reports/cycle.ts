/** Cycle time maths (pure, client-safe). */

export const CYCLE_BUCKETS = [
  { label: "< 1 day", max: 1 },
  { label: "1–2 days", max: 2 },
  { label: "2–4 days", max: 4 },
  { label: "4–7 days", max: 7 },
  { label: "1–2 weeks", max: 14 },
  { label: "2+ weeks", max: Infinity },
] as const;

export interface CycleStats {
  count: number;
  /** Days. */
  median: number | null;
  p85: number | null;
  average: number | null;
  buckets: { name: string; count: number }[];
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;

const round = (n: number) => Math.round(n * 10) / 10;

/** Median, 85th percentile, average and a histogram of cycle times in days. */
export function cycleStats(days: number[]): CycleStats {
  const sorted = [...days].filter((d) => d >= 0).sort((a, b) => a - b);
  const buckets = CYCLE_BUCKETS.map((b) => ({ name: b.label, count: 0 }));
  for (const d of sorted) {
    const index = CYCLE_BUCKETS.findIndex((b) => d < b.max);
    buckets[index]!.count++;
  }
  if (!sorted.length) return { count: 0, median: null, p85: null, average: null, buckets };
  return {
    count: sorted.length,
    median: round(percentile(sorted, 50)),
    p85: round(percentile(sorted, 85)),
    average: round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    buckets,
  };
}

/**
 * When the sprint will be done at the current pace: remaining ÷ average daily burn since the
 * start. Null when nothing has burned yet.
 */
export function forecastFinish(input: {
  start: string;
  today: string;
  initialScope: number;
  remaining: number;
}): string | null {
  const elapsed = (Date.parse(input.today) - Date.parse(input.start)) / 86_400_000;
  const burned = input.initialScope - input.remaining;
  if (elapsed <= 0 || burned <= 0) return null;
  if (input.remaining <= 0) return input.today;
  const daysLeft = Math.ceil(input.remaining / (burned / elapsed));
  return new Date(Date.parse(input.today) + daysLeft * 86_400_000).toISOString().slice(0, 10);
}
