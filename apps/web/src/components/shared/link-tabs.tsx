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

/**
 * Route-backed tabs: shadcn Tabs whose triggers are links. The active tab follows the URL.
 * Triggers drop aria-controls: there is no tab panel to point at, the page itself changes.
 */
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
          <TabsTrigger key={tab.href} value={tab.href} asChild aria-controls={undefined}>
            <Link href={tab.href as Route}>{tab.title}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
      {extra}
    </Tabs>
  );
}

/**
 * One link-backed tab trigger, for server components that render their own Tabs. (A server
 * component can't pass `aria-controls={undefined}` itself: undefined props are dropped.)
 */
export function LinkTabTrigger({
  value,
  href,
  scroll,
  children,
}: {
  value: string;
  href: string;
  scroll?: boolean;
  children: ReactNode;
}) {
  return (
    <TabsTrigger value={value} asChild aria-controls={undefined}>
      <Link href={href as Route} scroll={scroll}>
        {children}
      </Link>
    </TabsTrigger>
  );
}
