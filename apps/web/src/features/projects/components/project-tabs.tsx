"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Issues", segment: "" },
  { title: "Settings", segment: "settings" },
] as const;

export function ProjectTabs() {
  const { workspace, projectKey } = useParams<{ workspace: string; projectKey: string }>();
  const pathname = usePathname();
  const base = `/${workspace}/projects/${projectKey}`;
  return (
    <nav aria-label="Project" className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href = (tab.segment ? `${base}/${tab.segment}` : base) as Route;
        const active = tab.segment ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.title}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.title}
          </Link>
        );
      })}
      <span className="ml-2 self-center text-xs text-muted-foreground">
        Board, backlog and timeline arrive in Phase 3–4
      </span>
    </nav>
  );
}
