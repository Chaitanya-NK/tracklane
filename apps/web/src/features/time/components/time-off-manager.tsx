"use client";

import { PalmtreeIcon, Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/shared/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addTimeOffAction, removeTimeOffAction } from "../server/actions";

export interface TimeOffRow {
  id: string;
  startDate: string;
  endDate: string;
  note: string;
  user: { id: string; name: string; image: string | null };
}

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** Teams → Time off: upcoming absences, add your own (admins: anyone's). */
export function TimeOffManager({
  slug,
  items,
  people,
  currentUserId,
  isAdmin,
}: {
  slug: string;
  items: TimeOffRow[];
  people: { id: string; name: string }[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [userId, setUserId] = useState(currentUserId);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const add = useAction(addTimeOffAction, {
    onSuccess: () => {
      toast.success("Time off added");
      setStart(null);
      setEnd(null);
      setNote("");
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't add time off"),
  });
  const remove = useAction(removeTimeOffAction, {
    onSuccess: () => toast.success("Time off removed"),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't remove it"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-label="Upcoming time off" className="space-y-2">
        {items.length === 0 ? (
          <EmptyState
            icon={PalmtreeIcon}
            title="Nobody is away"
            description="Upcoming holidays and leave show up here."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <UserAvatar user={t.user} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {fmt(t.startDate)}
                    {t.endDate !== t.startDate ? ` – ${fmt(t.endDate)}` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </span>
                </span>
                {t.user.id === currentUserId || isAdmin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={remove.isPending}
                    onClick={() => remove.execute({ slug, id: t.id })}
                  >
                    <Trash2Icon aria-hidden="true" />
                    <span className="sr-only">Remove time off for {t.user.name}</span>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <form
        className="space-y-4 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!start) return void toast.error("Pick the first day");
          add.execute({ slug, userId, startDate: start, endDate: end ?? start, note });
        }}
      >
        <h2 className="text-sm font-semibold">Add time off</h2>
        <FieldGroup>
          {isAdmin ? (
            <Field>
              <FieldLabel htmlFor="off-person">Person</FieldLabel>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="off-person">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="off-start">First day</FieldLabel>
            <DatePicker
              id="off-start"
              value={start}
              onChange={setStart}
              placeholder="Pick a date"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="off-end">Last day</FieldLabel>
            <DatePicker id="off-end" value={end} onChange={setEnd} placeholder="Same day" />
          </Field>
          <Field>
            <FieldLabel htmlFor="off-note">Note</FieldLabel>
            <Input
              id="off-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Holiday, conference…"
            />
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={add.isPending} className="w-full">
          Add time off
        </Button>
      </form>
    </div>
  );
}
