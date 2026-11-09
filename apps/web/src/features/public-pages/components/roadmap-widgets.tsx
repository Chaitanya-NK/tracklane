"use client";

import { ChevronUpIcon, MailCheckIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { subscribeRoadmapAction, toggleRoadmapVoteAction } from "../server/actions";

export function VoteButton(props: {
  slug: string;
  projectKey: string;
  issueId: string;
  title: string;
  count: number;
  voted: boolean;
}) {
  const [state, setOptimistic] = useOptimistic({ count: props.count, voted: props.voted }, (s) => ({
    voted: !s.voted,
    count: s.count + (s.voted ? -1 : 1),
  }));
  const [pending, start] = useTransition();
  const vote = useAction(toggleRoadmapVoteAction);
  return (
    <Button
      type="button"
      variant={state.voted ? "secondary" : "outline"}
      size="sm"
      className={cn("h-auto shrink-0 flex-col gap-0 px-2 py-1", state.voted && "text-primary")}
      aria-pressed={state.voted}
      aria-label={`${state.voted ? "Remove vote for" : "Vote for"} ${props.title} (${state.count} votes)`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(null);
          await vote.executeAsync({
            slug: props.slug,
            projectKey: props.projectKey,
            issueId: props.issueId,
          });
        })
      }
    >
      <ChevronUpIcon aria-hidden="true" />
      <span className="text-xs tabular-nums">{state.count}</span>
    </Button>
  );
}

export function RoadmapSubscribe({ slug, projectKey }: { slug: string; projectKey: string }) {
  const [email, setEmail] = useState("");
  const subscribe = useAction(subscribeRoadmapAction);
  const errors = subscribe.result.validationErrors as
    Record<string, { _errors?: string[] }> | undefined;
  if (subscribe.hasSucceeded) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <MailCheckIcon className="size-4 text-primary" aria-hidden="true" />
        You&apos;re subscribed. We&apos;ll email you when a release ships.
      </p>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        subscribe.execute({ slug, projectKey, email });
      }}
    >
      <Field className="flex-1">
        <FieldLabel htmlFor="roadmap-email" className="sr-only">
          Email
        </FieldLabel>
        <Input
          id="roadmap-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors?.email}
        />
        {errors?.email?._errors?.[0] ? (
          <FieldError>{errors.email._errors[0]}</FieldError>
        ) : subscribe.result.serverError ? (
          <FieldError>{String(subscribe.result.serverError)}</FieldError>
        ) : (
          <FieldDescription>Release notes only. Unsubscribe any time.</FieldDescription>
        )}
      </Field>
      <Button type="submit" disabled={subscribe.isPending}>
        {subscribe.isPending ? <Spinner /> : null}
        Subscribe
      </Button>
    </form>
  );
}
