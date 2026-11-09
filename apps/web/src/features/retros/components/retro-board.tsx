"use client";

import {
  ArrowRightIcon,
  CheckIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ThumbsUpIcon,
  TicketIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addRetroCardAction,
  deleteRetroAction,
  deleteRetroCardAction,
  editRetroCardAction,
  retroCardToIssueAction,
  setRetroPhaseAction,
  toggleRetroVoteAction,
} from "../server/actions";
import type { RetroView } from "../server/service";
import { PHASE_HINTS, PHASE_LABELS, RETRO_PHASES, type RetroPhase } from "../templates";

type Card = RetroView["cards"][number];

export function RetroBoard({
  slug,
  retro,
  canFacilitate,
  canEdit,
}: {
  slug: string;
  retro: RetroView;
  canFacilitate: boolean;
  canEdit: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const setPhase = useAction(setRetroPhaseAction);
  const remove = useAction(deleteRetroAction);
  const phase = retro.phase as RetroPhase;
  const index = RETRO_PHASES.indexOf(phase);
  const next = RETRO_PHASES[index + 1];
  const sorted = phase === "discuss" || phase === "closed";

  async function move(to: RetroPhase) {
    const res = await setPhase.executeAsync({ slug, retroId: retro.id, phase: to });
    if (res?.serverError) toast.error(res.serverError.message);
    else toast.success(`${PHASE_LABELS[to]} phase`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <ol className="flex flex-wrap items-center gap-1 text-sm" aria-label="Phases">
          {RETRO_PHASES.map((p, i) => (
            <li key={p} className="flex items-center gap-1">
              {i > 0 ? (
                <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
              ) : null}
              <span
                aria-current={p === phase ? "step" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-0.5",
                  p === phase
                    ? "bg-primary text-primary-foreground"
                    : i < index
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {i < index ? <CheckIcon className="mr-1 inline size-3" aria-hidden="true" /> : null}
                {PHASE_LABELS[p]}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          {phase === "vote" ? (
            <Badge variant="secondary" className="tabular-nums">
              {retro.votesPerPerson - retro.votesUsed} of {retro.votesPerPerson} votes left
            </Badge>
          ) : null}
          {canFacilitate && next ? (
            <Button size="sm" onClick={() => move(next)} disabled={setPhase.isPending}>
              {setPhase.isPending ? <Spinner /> : null}
              {next === "closed" ? "Close retro" : `Start ${PHASE_LABELS[next].toLowerCase()}`}
            </Button>
          ) : null}
          {canFacilitate ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8" aria-label="Retro actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {index > 0 ? (
                  <DropdownMenuItem onSelect={() => move(RETRO_PHASES[index - 1]!)}>
                    Back to {PHASE_LABELS[RETRO_PHASES[index - 1]!].toLowerCase()}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  Delete retro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{PHASE_HINTS[phase]}</p>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 15rem), 1fr))` }}
      >
        {retro.columns.map((column) => {
          let cards = retro.cards.filter((c) => c.columnId === column.id);
          if (sorted) cards = [...cards].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
          const canAdd =
            canEdit && (phase === "brainstorm" || (column.actions && phase === "discuss"));
          return (
            <section
              key={column.id}
              aria-label={column.title}
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-muted/20 p-3",
                column.actions && "border-primary/30 bg-primary/5",
              )}
            >
              <h2 className="flex items-center justify-between text-sm font-semibold">
                {column.title}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {cards.length}
                </span>
              </h2>
              {canAdd ? (
                <AddCard
                  slug={slug}
                  retroId={retro.id}
                  columnId={column.id}
                  actions={column.actions}
                />
              ) : null}
              <ul className="space-y-2">
                {cards.map((card) => (
                  <RetroCard
                    key={card.id}
                    slug={slug}
                    card={card}
                    phase={phase}
                    actions={Boolean(column.actions)}
                    canEdit={canEdit}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${retro.name}?`}
        description="All cards and votes are deleted. Issues created from action items are kept."
        pending={remove.isPending}
        onConfirm={async () => {
          const res = await remove.executeAsync({ slug, retroId: retro.id });
          if (res?.serverError) toast.error(res.serverError.message);
        }}
      />
    </div>
  );
}

function AddCard({
  slug,
  retroId,
  columnId,
  actions,
}: {
  slug: string;
  retroId: string;
  columnId: string;
  actions?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const add = useAction(addRetroCardAction);

  async function submit() {
    if (!body.trim()) return;
    const res = await add.executeAsync({ slug, retroId, columnId, body });
    if (res?.serverError) return void toast.error(res.serverError.message);
    setBody("");
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        {actions ? "Add action item" : "Add card"}
      </Button>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        autoFocus
        maxLength={1000}
        aria-label={actions ? "New action item" : "New card"}
        placeholder={actions ? "Who does what by when?" : "What happened?"}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>
          {add.isPending ? <Spinner /> : null}
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
    </form>
  );
}

function RetroCard({
  slug,
  card,
  phase,
  actions,
  canEdit,
}: {
  slug: string;
  card: Card;
  phase: RetroPhase;
  actions: boolean;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(card.body ?? "");
  const vote = useAction(toggleRetroVoteAction);
  const edit = useAction(editRetroCardAction);
  const remove = useAction(deleteRetroCardAction);
  const toIssue = useAction(retroCardToIssueAction);

  if (card.body === null) {
    return (
      <li className="flex items-center gap-2 rounded-md border border-dashed bg-background/60 p-3 text-sm text-muted-foreground">
        <EyeOffIcon className="size-4" aria-hidden="true" />
        Hidden until voting
      </li>
    );
  }
  return (
    <li
      className={cn(
        "space-y-2 rounded-md border bg-background p-3 text-sm shadow-xs",
        card.myVote && phase === "vote" && "ring-2 ring-primary/50",
      )}
    >
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await edit.executeAsync({ slug, cardId: card.id, body });
            if (res?.serverError) return void toast.error(res.serverError.message);
            setEditing(false);
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            autoFocus
            aria-label="Card text"
            maxLength={1000}
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={!body.trim() || edit.isPending}>
              Save
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="break-words whitespace-pre-wrap">{card.body}</p>
      )}
      <div className="flex items-center gap-2">
        {card.author ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <UserAvatar user={card.author} className="size-4" />
            <span className="truncate">{card.mine ? "You" : card.author.name}</span>
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {phase === "vote" && canEdit ? (
            <Button
              size="sm"
              variant={card.myVote ? "default" : "outline"}
              className="h-7 px-2"
              aria-pressed={card.myVote}
              aria-label={card.myVote ? "Take back vote" : "Vote"}
              disabled={vote.isPending}
              onClick={async () => {
                const res = await vote.executeAsync({ slug, cardId: card.id });
                if (res?.serverError) toast.error(res.serverError.message);
              }}
            >
              <ThumbsUpIcon />
            </Button>
          ) : null}
          {card.votes !== null ? (
            <Badge
              variant={card.votes ? "secondary" : "outline"}
              className="tabular-nums"
              aria-label={`${card.votes} votes`}
            >
              <ThumbsUpIcon aria-hidden="true" />
              {card.votes}
            </Badge>
          ) : null}
          {card.issueKey ? (
            <Badge variant="outline" asChild>
              <Link href={`/${slug}/issues/${card.issueKey}` as Route}>
                <TicketIcon aria-hidden="true" />
                {card.issueKey}
              </Link>
            </Badge>
          ) : null}
          {actions && phase === "discuss" && !card.issueKey && canEdit ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={toIssue.isPending}
              onClick={async () => {
                const res = await toIssue.executeAsync({ slug, cardId: card.id });
                if (res?.serverError) return void toast.error(res.serverError.message);
                if (res?.data) toast.success(`Created ${res.data.key}`);
              }}
            >
              {toIssue.isPending ? <Spinner /> : <TicketIcon />}
              Turn into issue
            </Button>
          ) : null}
          {card.mine && phase !== "closed" && !editing ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7" aria-label="Card actions">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>Edit</DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={async () => {
                    const res = await remove.executeAsync({ slug, cardId: card.id });
                    if (res?.serverError) toast.error(res.serverError.message);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      </div>
    </li>
  );
}
