"use client";

import { formatDateTime, relativeTime } from "@/lib/format";

/**
 * "5 minutes ago", with the exact time in the viewer's timezone on hover. The server renders
 * in UTC and the browser in local time, so the first paint may differ slightly; that's expected.
 */
export function TimeAgo({
  date,
  prefix,
  className,
}: {
  date: Date | string;
  prefix?: string;
  className?: string;
}) {
  const value = new Date(date);
  return (
    <time
      dateTime={value.toISOString()}
      title={formatDateTime(value)}
      className={className}
      suppressHydrationWarning
    >
      {prefix ? `${prefix} ` : null}
      {relativeTime(value)}
    </time>
  );
}
