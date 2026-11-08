"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface LinkTab {
  title: string;
  href: string;
  /** Match nested paths too (e.g. /settings/members under /settings). Default: exact. */
  prefix?: boolean;
}

/** Route-backed tabs: shadcn Tabs whose triggers are links. The active tab follows the URL. */
export function LinkTabs({
  tabs,
  label,
  extra,
}: {
  tabs: LinkTab[];
  label: string;
  extra?: ReactNode;
}) {
  const pathname = usePathname();
  const active =
    tabs.find((t) => (t.prefix ? pathname.startsWith(t.href) : pathname === t.href))?.href ??
    tabs[0]?.href;
  return (
    <Tabs value={active}>
      <TabsList aria-label={label}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.href} value={tab.href} asChild>
            <Link href={tab.href as Route}>{tab.title}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
      {extra}
    </Tabs>
  );
}
