import { FileTextIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Node {
  id: string;
  title: string;
  parentId: string | null;
}

/** Nested page list; the current page is highlighted. */
export function DocTree({
  slug,
  docs,
  currentId,
  parentId = null,
  depth = 0,
}: {
  slug: string;
  docs: Node[];
  currentId?: string;
  parentId?: string | null;
  depth?: number;
}) {
  const level = docs.filter((d) => d.parentId === parentId);
  if (!level.length) return null;
  return (
    <ul className={cn("space-y-0.5", depth > 0 && "ml-3 border-l pl-2")}>
      {level.map((d) => (
        <li key={d.id}>
          <Link
            href={`/${slug}/docs/${d.id}` as Route}
            aria-current={d.id === currentId ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent",
              d.id === currentId && "bg-accent font-medium",
            )}
          >
            <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{d.title}</span>
          </Link>
          <DocTree
            slug={slug}
            docs={docs}
            currentId={currentId}
            parentId={d.id}
            depth={depth + 1}
          />
        </li>
      ))}
    </ul>
  );
}
