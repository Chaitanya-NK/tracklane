import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Dark enough for white initials to reach WCAG AA contrast.
const TONES = [
  "bg-sky-700",
  "bg-violet-600",
  "bg-emerald-700",
  "bg-amber-700",
  "bg-rose-600",
  "bg-teal-700",
  "bg-indigo-600",
  "bg-orange-700",
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
