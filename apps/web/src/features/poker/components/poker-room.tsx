"use client";

import {
  CheckIcon,
  CoffeeIcon,
  EyeIcon,
  ListPlusIcon,
  RotateCcwIcon,
  SquareIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Markdown } from "@/components/shared/markdown";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { IssueTypeIcon, StatusBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import { summarizeVotes } from "../deck";
import {
  acceptPokerEstimateAction,
  addPokerIssuesAction,
  castPokerVoteAction,
  endPokerSessionAction,
  revealPokerVotesAction,
  selectPokerIssueAction,
} from "../server/actions";
import type { PokerView } from "../server/service";

export function PokerRoom({
  slug,
  session,
  canVote,
  canFacilitate,
}: {
  slug: string;
  session: PokerView;
  canVote: boolean;
  canFacilitate: boolean;
}) {
  const [ending, setEnding] = useState(false);
  const [keys, setKeys] = useState("");
  const vote = useAction(castPokerVoteAction);
  const reveal = useAction(revealPokerVotesAction);
  const select = useAction(selectPokerIssueAction);
  const accept = useAction(acceptPokerEstimateAction);
  const add = useAction(addPokerIssuesAction);
  const end = useAction(endPokerSessionAction);
  const ended = Boolean(session.endedAt);
  const current = session.current;
  const summary = session.revealed
    ? summarizeVotes(
        session.votes.map((v) => v.value!),
        session.deck,
      )
    : null;
  const [chosen, setChosen] = useState<string | null>(null);
  const estimate = chosen ?? (summary?.suggestion != null ? String(summary.suggestion) : null);
  const done = session.queue.filter((i) => i.estimate !== null).length;

  const run = async (p: Promise<{ serverError?: { message: string } } | undefined>) => {
    const res = await p;
    if (res?.serverError) toast.error(res.serverError.message);
    return res;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        {ended ? (
          <Card>
            <CardHeader>
              <CardTitle>Session ended</CardTitle>
              <CardDescription>
                {done} of {session.queue.length} issues estimated.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : current ? (
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <IssueTypeIcon type={current.type} custom={current.customType} />
                <Link
                  href={`/${slug}/issues/${current.key}` as Route}
                  className="font-mono hover:underline"
                >
                  {current.key}
                </Link>
                <StatusBadge status={current.status} />
                {current.estimate !== null ? (
                  <Badge variant="outline">Currently {current.estimate} pts</Badge>
                ) : null}
              </CardDescription>
              <CardTitle className="text-xl">{current.title}</CardTitle>
            </CardHeader>
            {current.description ? (
              <CardContent className="max-h-48 overflow-y-auto">
                <Markdown>{current.description}</Markdown>
              </CardContent>
            ) : null}
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Everything&apos;s estimated</CardTitle>
              <CardDescription>Add more issues, or end the session.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {current && !ended ? (
          <>
            <section aria-label="Votes" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  {session.revealed ? "Votes" : `${session.votes.length} voted`}
                </h2>
                {canFacilitate ? (
                  <div className="flex gap-2">
                    {session.revealed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(reveal.executeAsync({ slug, sessionId: session.id, revealed: false }))
                        }
                      >
                        <RotateCcwIcon />
                        Vote again
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          run(reveal.executeAsync({ slug, sessionId: session.id, revealed: true }))
                        }
                        disabled={!session.votes.length || reveal.isPending}
                      >
                        <EyeIcon />
                        Reveal
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
              <ul className="flex flex-wrap gap-3">
                {session.votes.map((v) => (
                  <li key={v.user.id} className="flex w-20 flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "flex h-24 w-16 items-center justify-center rounded-lg border-2 text-2xl font-semibold tabular-nums transition-colors",
                        session.revealed
                          ? "border-primary bg-background"
                          : "border-primary/40 bg-primary/10",
                      )}
                      aria-label={
                        session.revealed ? `${v.user.name}: ${v.value}` : `${v.user.name} has voted`
                      }
                    >
                      {session.revealed || v.value ? (
                        v.value === "☕" ? (
                          <CoffeeIcon className="size-6" />
                        ) : (
                          v.value
                        )
                      ) : (
                        <CheckIcon className="size-6 text-primary" />
                      )}
                    </div>
                    <span className="flex max-w-full items-center gap-1 text-xs">
                      <UserAvatar user={v.user} className="size-4" />
                      <span className="truncate">{v.user.name.split(" ")[0]}</span>
                    </span>
                  </li>
                ))}
                {!session.votes.length ? (
                  <li className="text-sm text-muted-foreground">No votes yet.</li>
                ) : null}
              </ul>
              {summary ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  {summary.consensus ? <Badge>Consensus</Badge> : null}
                  {summary.average !== null ? (
                    <span className="text-muted-foreground">
                      Average{" "}
                      <strong className="text-foreground tabular-nums">{summary.average}</strong> ·
                      range{" "}
                      <span className="tabular-nums">
                        {summary.min}–{summary.max}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No numeric votes.</span>
                  )}
                  {canFacilitate ? (
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      <label htmlFor="poker-final" className="text-muted-foreground">
                        Estimate
                      </label>
                      <Select value={estimate ?? undefined} onValueChange={setChosen}>
                        <SelectTrigger id="poker-final" size="sm" className="w-20 tabular-nums">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {session.deck
                            .filter((c) => /^\d+$/.test(c))
                            .map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!estimate || accept.isPending}
                        onClick={async () => {
                          const res = await run(
                            accept.executeAsync({ slug, sessionId: session.id, value: estimate! }),
                          );
                          if (res && !res.serverError) {
                            toast.success(`${current.key} estimated at ${estimate}`);
                            setChosen(null);
                          }
                        }}
                      >
                        {accept.isPending ? <Spinner /> : <CheckIcon />}
                        Save &amp; next
                      </Button>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>

            {canVote && !session.revealed ? (
              <section aria-label="Your card" className="space-y-2">
                <h2 className="text-sm font-semibold">Your card</h2>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pick a card">
                  {session.deck.map((card) => (
                    <button
                      key={card}
                      type="button"
                      role="radio"
                      aria-checked={session.myVote === card}
                      aria-label={
                        card === "☕"
                          ? "Need a break"
                          : card === "?"
                            ? "Not sure"
                            : `${card} points`
                      }
                      disabled={vote.isPending}
                      onClick={() =>
                        run(vote.executeAsync({ slug, sessionId: session.id, value: card }))
                      }
                      className={cn(
                        "flex h-20 w-14 items-center justify-center rounded-lg border-2 text-xl font-semibold tabular-nums shadow-xs transition hover:-translate-y-1 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                        session.myVote === card
                          ? "-translate-y-1 border-primary bg-primary text-primary-foreground"
                          : "bg-card",
                      )}
                    >
                      {card === "☕" ? <CoffeeIcon className="size-5" /> : card}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <aside className="space-y-4">
        <div className="space-y-2">
          <h2 className="flex items-center justify-between text-sm font-semibold">
            Issues
            <span className="font-normal text-muted-foreground tabular-nums">
              {done}/{session.queue.length} estimated
            </span>
          </h2>
          <ul className="divide-y rounded-lg border">
            {session.queue.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  disabled={!canFacilitate || ended || issue.id === current?.id}
                  onClick={() =>
                    run(select.executeAsync({ slug, sessionId: session.id, issueId: issue.id }))
                  }
                  aria-current={issue.id === current?.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm enabled:hover:bg-accent",
                    issue.id === current?.id && "bg-accent font-medium",
                  )}
                >
                  {issue.estimate !== null ? (
                    <CheckIcon
                      className="size-4 shrink-0 text-status-done"
                      aria-label="Estimated"
                    />
                  ) : (
                    <SquareIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-label="Not estimated"
                    />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
                  <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                  {issue.estimate !== null ? (
                    <Badge variant="secondary" className="tabular-nums">
                      {issue.estimate}
                    </Badge>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {canFacilitate && !ended ? (
          <>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await add.executeAsync({ slug, sessionId: session.id, keys });
                if (res?.serverError) return void toast.error(res.serverError.message);
                toast.success(`Added ${res?.data?.added ?? 0}`);
                setKeys("");
              }}
            >
              <Input
                value={keys}
                onChange={(e) => setKeys(e.target.value)}
                placeholder={`${session.project.key}-12, ${session.project.key}-15`}
                aria-label="Issue keys to add"
                className="font-mono uppercase"
              />
              <Button type="submit" variant="outline" disabled={!keys.trim() || add.isPending}>
                <ListPlusIcon />
                Add
              </Button>
            </form>
            <Button
              variant="ghost"
              className="w-full text-destructive"
              onClick={() => setEnding(true)}
            >
              End session
            </Button>
          </>
        ) : null}
      </aside>
      <ConfirmDialog
        open={ending}
        onOpenChange={setEnding}
        title="End this session?"
        description="Estimates already saved stay on the issues."
        confirmLabel="End session"
        pending={end.isPending}
        onConfirm={async () => {
          await run(end.executeAsync({ slug, sessionId: session.id }));
          setEnding(false);
        }}
      />
    </div>
  );
}
