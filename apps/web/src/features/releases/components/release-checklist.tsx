"use client";

import { ListChecksIcon, PlusIcon, XIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { addChecklistItemsAction, setChecklistItemAction } from "../server/actions";

/** Readiness steps for a release: tick them off before shipping. */
export function ReleaseChecklist({
  slug,
  projectKey,
  releaseId,
  items,
  defaults,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  releaseId: string;
  items: { id: string; text: string; done: boolean }[];
  defaults: string[];
  canEdit: boolean;
}) {
  const [text, setText] = useState("");
  const onError = ({ error }: { error: { serverError?: { message: string } } }) =>
    toast.error(error.serverError?.message ?? "Couldn't update the checklist");
  const add = useAction(addChecklistItemsAction, { onSuccess: () => setText(""), onError });
  const set = useAction(setChecklistItemAction, { onError });
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecksIcon className="size-4" aria-hidden="true" /> Readiness
        </CardTitle>
        <CardDescription>
          {items.length ? `${done} of ${items.length} steps done` : "No checklist yet"}
        </CardDescription>
        {canEdit && items.length === 0 ? (
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              disabled={add.isPending}
              onClick={() => add.execute({ slug, projectKey, releaseId, texts: defaults })}
            >
              Use the standard checklist
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          <Progress value={pct} className="h-1.5" aria-label={`${pct}% ready`} />
        ) : null}
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
            >
              <Checkbox
                id={`step-${item.id}`}
                checked={item.done}
                disabled={!canEdit || set.isPending}
                onCheckedChange={(on) =>
                  set.execute({ slug, projectKey, itemId: item.id, done: on === true })
                }
              />
              <label
                htmlFor={`step-${item.id}`}
                className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}
              >
                {item.text}
              </label>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => set.execute({ slug, projectKey, itemId: item.id, remove: true })}
                >
                  <XIcon aria-hidden="true" />
                  <span className="sr-only">Remove {item.text}</span>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) add.execute({ slug, projectKey, releaseId, texts: [text.trim()] });
            }}
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a step"
              aria-label="New checklist step"
              className="h-8"
              maxLength={200}
            />
            <Button type="submit" size="sm" variant="outline" disabled={add.isPending}>
              <PlusIcon aria-hidden="true" /> Add
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
