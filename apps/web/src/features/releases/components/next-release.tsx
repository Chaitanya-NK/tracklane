import { CalendarClockIcon, RocketIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReleaseProgress } from "./release-progress";

/** Summary of the next unreleased release: when, how far along, and what's left. */
export function NextRelease({
  href,
  release,
  today,
}: {
  href: string;
  release: {
    name: string;
    releaseDate: string | null;
    counts: { todo: number; in_progress: number; done: number };
    checklist: { done: number; total: number };
  };
  today: string;
}) {
  const total = release.counts.todo + release.counts.in_progress + release.counts.done;
  const open = release.counts.todo + release.counts.in_progress;
  const days = release.releaseDate
    ? Math.round((Date.parse(release.releaseDate) - Date.parse(today)) / 86_400_000)
    : null;
  const ready = open === 0 && release.checklist.done === release.checklist.total;
  return (
    <Card className={cn(days !== null && days < 0 && !ready && "border-destructive/40")}>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <RocketIcon className="size-3.5" aria-hidden="true" /> Next release
        </CardDescription>
        <CardTitle className="text-lg">{release.name}</CardTitle>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <Link href={href as Route}>Open</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Due</p>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarClockIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {days === null
              ? "No date"
              : days === 0
                ? "Today"
                : days > 0
                  ? `In ${days} day${days === 1 ? "" : "s"}`
                  : `${-days} day${days === -1 ? "" : "s"} late`}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {release.counts.done} of {total} issues done · {open} open
          </p>
          <ReleaseProgress counts={release.counts} total={total} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Readiness</p>
          <p className="text-sm font-medium">
            {release.checklist.total
              ? `${release.checklist.done}/${release.checklist.total} steps`
              : "No checklist"}
            {ready && total ? <span className="ml-2 text-emerald-600">Ready to ship</span> : null}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
