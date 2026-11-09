"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setWatchingAction } from "../server/actions";

/** Watch / stop watching an issue; watchers hear about comments and status changes. */
export function WatchButton({
  issueId,
  watching,
  count,
}: {
  issueId: string;
  watching: boolean;
  count: number;
}) {
  const action = useAction(setWatchingAction);
  async function toggle() {
    const res = await action.executeAsync({ issueId, watching: !watching });
    if (res?.serverError) toast.error(res.serverError.message);
    else toast.success(watching ? "You'll stop getting updates" : "You're watching this issue");
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={watching ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1.5"
          onClick={toggle}
          disabled={action.isPending}
          aria-pressed={watching}
          aria-label={`${watching ? "Watching" : "Watch"} (${count} watching)`}
        >
          {watching ? <EyeIcon /> : <EyeOffIcon />}
          <span className="tabular-nums">{count}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {watching ? "Watching — click to stop" : "Watch for comments and status changes"}
      </TooltipContent>
    </Tooltip>
  );
}
