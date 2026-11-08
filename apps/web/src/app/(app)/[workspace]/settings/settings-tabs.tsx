"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { workspacePath } from "@/config/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "General", segment: "settings" },
  { title: "Members", segment: "settings/members" },
] as const;

export function SettingsTabs() {
  const { workspace } = useParams<{ workspace: string }>();
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href = workspacePath(workspace, tab.segment);
        const active = pathname === href;
        return (
          <Link
            key={tab.segment}
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
    </nav>
  );
}
