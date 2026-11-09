"use client";

import { LINK_CHOICES } from "@tracklane/core";
import { LinkIcon, PlusIcon, XIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
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
import { addLinkAction, removeLinkAction } from "../server/actions";
import type { IssueLinkRow } from "../server/service";

/** "Linked issues" on the issue page: grouped by how they relate, with add and remove. */
export function LinkedIssues({
  slug,
  issueId,
  issueKey,
  links,
  canEdit,
}: {
  slug: string;
  issueId: string;
  issueKey: string;
  links: IssueLinkRow[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState<string>("blocks");
  const [otherKey, setOtherKey] = useState("");
  const add = useAction(addLinkAction);
  const remove = useAction(removeLinkAction);
  const error =
    add.result.serverError ??
    (add.result.validationErrors ? { message: "Enter an issue key" } : null);
  const groups = [...new Set(links.map((l) => l.phrase))];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await add.executeAsync({ issueId, choice, otherKey });
    if (res?.serverError || res?.validationErrors) return;
    const label = LINK_CHOICES.find((c) => c.value === choice)?.label;
    toast.success(`${issueKey} ${label} ${otherKey.toUpperCase()}`);
    setOtherKey("");
    setAdding(false);
  }

  return (
    <section className="space-y-3" aria-labelledby={`links-${issueId}`}>
      <div className="flex items-center justify-between">
        <h2 id={`links-${issueId}`} className="text-sm font-semibold">
          Linked issues{" "}
          {links.length ? (
            <span className="font-normal text-muted-foreground">({links.length})</span>
          ) : null}
        </h2>
        {canEdit && !adding ? (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <PlusIcon />
            Link issue
          </Button>
        ) : null}
      </div>
      {adding ? (
        <form onSubmit={submit} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{issueKey}</span>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger size="sm" className="w-40" aria-label="Link type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_CHOICES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={otherKey}
              onChange={(e) => setOtherKey(e.target.value)}
              placeholder="WEB-12"
              aria-label="Issue key to link"
              className="h-8 w-32 font-mono uppercase"
              autoFocus
              aria-invalid={error ? true : undefined}
            />
            <Button type="submit" size="sm" disabled={!otherKey.trim() || add.isPending}>
              {add.isPending ? <Spinner /> : <LinkIcon />}
              Link
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
          {error ? <FieldError>{error.message}</FieldError> : null}
        </form>
      ) : null}
      {links.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((phrase) => (
            <div key={phrase} className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground first-letter:uppercase">
                {phrase}
              </h3>
              <ul className="divide-y rounded-lg border">
                {links
                  .filter((l) => l.phrase === phrase)
                  .map((l) => (
                    <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <IssueTypeIcon type={l.issue.type} custom={l.issue.customType} />
                      <Link
                        href={`/${slug}/issues/${l.issue.key}` as Route}
                        className={cn(
                          "shrink-0 font-mono text-xs text-muted-foreground hover:underline",
                          l.issue.status.category === "done" && "line-through",
                        )}
                      >
                        {l.issue.key}
                      </Link>
                      <span className="min-w-0 flex-1 truncate">{l.issue.title}</span>
                      <StatusBadge status={l.issue.status} />
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={`Remove link to ${l.issue.key}`}
                          disabled={remove.isPending}
                          onClick={async () => {
                            const res = await remove.executeAsync({ linkId: l.id });
                            if (res?.serverError) toast.error(res.serverError.message);
                            else toast.success(`Unlinked ${l.issue.key}`);
                          }}
                        >
                          <XIcon />
                        </Button>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
