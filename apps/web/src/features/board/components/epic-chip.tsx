import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The parent epic (or story, for subtasks) on a card or backlog row. The badge is a centred
 * flex box, so the text is truncated in its own span: long names end in "…" instead of being
 * clipped at both ends. The full name is in the tooltip.
 */
export function EpicChip({
  parent,
  className,
}: {
  parent: { key: string; title: string };
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "h-5 min-w-0 justify-start rounded px-1.5 text-violet-700 dark:text-violet-300",
            className,
          )}
        >
          <span className="truncate">{parent.title}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {parent.key} · {parent.title}
      </TooltipContent>
    </Tooltip>
  );
}
