"use client";

import { BanIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Shown on cards and rows blocked by open issues. */
export function BlockedBadge({ blockedBy }: { blockedBy: string[] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="destructive" className="relative z-10 h-5 rounded px-1.5">
          <BanIcon aria-hidden="true" />
          Blocked
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Blocked by {blockedBy.join(", ")}</TooltipContent>
    </Tooltip>
  );
}
