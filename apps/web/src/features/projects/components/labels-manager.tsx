"use client";

import { LABEL_COLORS, type LabelColor } from "@tracklane/core";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelBadge, LABEL_SWATCH } from "@/features/issues";
import { cn } from "@/lib/utils";
import { createLabelAction } from "../server/actions";

export function LabelsManager({
  slug,
  projectKey,
  labels,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  labels: { id: string; name: string; color: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const { execute, isPending } = useAction(createLabelAction, {
    onSuccess: ({ data }) => {
      toast.success(`Added label "${data?.name}"`);
      setName("");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't add the label"),
  });

  return (
    <div className="space-y-4">
      {labels.length ? (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <LabelBadge key={label.id} label={label} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No labels yet.</p>
      )}
      {canEdit ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) execute({ slug, projectKey, name, color });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New label"
            aria-label="Label name"
            maxLength={40}
            className="h-8 w-48"
          />
          <div className="flex gap-1" role="radiogroup" aria-label="Label colour">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-5 rounded-full ring-offset-2 ring-offset-background",
                  LABEL_SWATCH[c],
                  color === c && "ring-2 ring-ring",
                )}
              />
            ))}
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={isPending || !name.trim()}>
            {isPending ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : (
              <PlusIcon aria-hidden="true" />
            )}
            Add label
          </Button>
        </form>
      ) : null}
    </div>
  );
}
