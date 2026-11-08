"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime, relativeTime } from "@/lib/format";

/**
 * "5 minutes ago", with the exact time (viewer's timezone) in a tooltip. Server and browser
 * render slightly different text, so hydration differences are expected here.
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
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={value.toISOString()} className={className} suppressHydrationWarning>
          {prefix ? `${prefix} ` : null}
          {relativeTime(value)}
        </time>
      </TooltipTrigger>
      <TooltipContent suppressHydrationWarning>{formatDateTime(value)}</TooltipContent>
    </Tooltip>
  );
}
