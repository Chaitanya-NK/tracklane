"use client";

import { formatDuration } from "@tracklane/core";
import { PauseIcon, PlayIcon, SquareIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { startTimerAction, stopTimerAction } from "../server/actions";

export interface RunningTimer {
  startedAt: string;
  issue: { id: string; key: string; title: string };
}

function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

const clock = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

/** A stopwatch on an issue: "Stop & log" records the time for today. */
export function TimerCard({ slug, timer }: { slug: string; timer: RunningTimer | null }) {
  const elapsed = useElapsed(timer?.startedAt ?? null);
  const [key, setKey] = useState("");
  const start = useAction(startTimerAction, {
    onSuccess: () => setKey(""),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't start the timer"),
  });
  const stop = useAction(stopTimerAction, {
    onSuccess: ({ data, input }) =>
      toast.success(input.log ? `Logged ${formatDuration(data?.minutes ?? 0)}` : "Timer discarded"),
  });

  return (
    <section
      aria-label="Timer"
      className={cn(
        "space-y-3 rounded-xl border p-4",
        timer && "border-foreground bg-foreground text-background",
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className={timer ? "text-background/70" : "text-muted-foreground"}>
          {timer ? "Timer running" : "Timer"}
        </span>
        {timer ? <span className="size-2 animate-pulse rounded-full bg-emerald-400" /> : null}
      </div>
      {timer ? (
        <>
          <p className="font-mono text-3xl font-semibold tabular-nums" aria-live="off">
            {clock(elapsed)}
          </p>
          <Link
            href={`/${slug}/issues/${timer.issue.key}` as Route}
            className="block truncate text-sm hover:underline"
          >
            <span className="font-mono text-background/70">{timer.issue.key}</span>{" "}
            {timer.issue.title}
          </Link>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={stop.isPending}
              onClick={() => stop.execute({ log: true })}
            >
              <SquareIcon aria-hidden="true" /> Stop &amp; log
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-background hover:bg-background/10 hover:text-background"
              disabled={stop.isPending}
              onClick={() => stop.execute({ log: false })}
            >
              <PauseIcon aria-hidden="true" /> Discard
            </Button>
          </div>
        </>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) start.execute({ slug, issueKey: key.trim().toUpperCase() });
          }}
        >
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Issue key"
            aria-label="Issue to time"
            className="h-8"
          />
          <Button type="submit" size="sm" disabled={start.isPending}>
            <PlayIcon aria-hidden="true" /> Start
          </Button>
        </form>
      )}
    </section>
  );
}

/** Start a timer from an issue page. */
export function StartTimerButton({
  slug,
  issueId,
  running,
}: {
  slug: string;
  issueId: string;
  running: boolean;
}) {
  const start = useAction(startTimerAction, {
    onSuccess: () => toast.success("Timer started"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't start the timer"),
  });
  const stop = useAction(stopTimerAction, {
    onSuccess: ({ data }) => toast.success(`Logged ${formatDuration(data?.minutes ?? 0)}`),
  });
  return running ? (
    <Button
      size="sm"
      variant="secondary"
      disabled={stop.isPending}
      onClick={() => stop.execute({ log: true })}
    >
      <SquareIcon aria-hidden="true" /> Stop timer
    </Button>
  ) : (
    <Button
      size="sm"
      variant="outline"
      disabled={start.isPending}
      onClick={() => start.execute({ slug, issueId })}
    >
      <PlayIcon aria-hidden="true" /> Start timer
    </Button>
  );
}
