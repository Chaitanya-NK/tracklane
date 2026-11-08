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

/** A coloured tile with the project key's first letters; colour is stable per key. */
export function ProjectAvatar({
  projectKey,
  className,
}: {
  projectKey: string;
  className?: string;
}) {
  const hash = [...projectKey].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white",
        TONES[hash % TONES.length],
        className,
      )}
    >
      {projectKey.slice(0, 3)}
    </span>
  );
}
