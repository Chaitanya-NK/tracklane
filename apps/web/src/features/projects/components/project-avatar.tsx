import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-orange-500",
];

/** shadcn Avatar showing the project key; colour is stable per key. */
export function ProjectAvatar({
  projectKey,
  className,
}: {
  projectKey: string;
  className?: string;
}) {
  const hash = [...projectKey].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <Avatar className={cn("size-7 rounded-md", className)} aria-hidden="true">
      <AvatarFallback
        className={cn("rounded-md text-[10px] font-bold text-white", TONES[hash % TONES.length])}
      >
        {projectKey.slice(0, 3)}
      </AvatarFallback>
    </Avatar>
  );
}
