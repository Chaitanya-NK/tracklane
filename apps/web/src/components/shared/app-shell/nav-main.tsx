"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  findNavItem,
  type NavItem,
  primaryNav,
  secondaryNav,
  workspacePath,
} from "@/config/navigation";

function NavGroup({
  items,
  slug,
  activeSegment,
  className,
  badges,
}: {
  items: NavItem[];
  slug: string;
  activeSegment: string | undefined;
  className?: string;
  badges?: Partial<Record<string, ReactNode>>;
}) {
  return (
    <SidebarGroup className={className}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.segment}>
              <SidebarMenuButton
                asChild
                isActive={activeSegment === item.segment}
                tooltip={item.title}
              >
                <Link href={workspacePath(slug, item.segment)}>
                  <item.icon aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {badges?.[item.segment]}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** `badges` are server-rendered extras keyed by segment (e.g. the inbox unread count). */
export function NavMain({ badges }: { badges?: Partial<Record<string, ReactNode>> }) {
  const pathname = usePathname();
  const { workspace } = useParams<{ workspace: string }>();
  const active = findNavItem(pathname)?.segment;

  return (
    <>
      <NavGroup items={primaryNav} slug={workspace} activeSegment={active} badges={badges} />
      <NavGroup items={secondaryNav} slug={workspace} activeSegment={active} className="mt-auto" />
    </>
  );
}
