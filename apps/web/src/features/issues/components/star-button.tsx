"use client";

import { StarIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleIssueStarAction, toggleProjectStarAction } from "../server/star-actions";

/** Star an issue or a project (shown first on the home page and project list). */
export function StarButton({
  target,
  starred,
  label,
}: {
  target: { issueId: string } | { slug: string; projectId: string };
  starred: boolean;
  label: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(starred);
  const [, start] = useTransition();
  const issue = useAction(toggleIssueStarAction);
  const project = useAction(toggleProjectStarAction);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Unstar ${label}` : `Star ${label}`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res =
            "issueId" in target
              ? await issue.executeAsync({ issueId: target.issueId, starred: !optimistic })
              : await project.executeAsync({ ...target, starred: !optimistic });
          if (res?.serverError) toast.error(res.serverError.message);
        })
      }
    >
      <StarIcon aria-hidden="true" className={cn(optimistic && "fill-amber-400 text-amber-500")} />
    </Button>
  );
}
