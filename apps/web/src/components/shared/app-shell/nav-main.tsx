"use client";

import Link from "next/link";
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
}: {
  items: NavItem[];
  slug: string;
  activeSegment: string | undefined;
  className?: string;
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
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function NavMain() {
  const pathname = usePathname();
  const { workspace } = useParams<{ workspace: string }>();
  const active = findNavItem(pathname)?.segment;

  return (
    <>
      <NavGroup items={primaryNav} slug={workspace} activeSegment={active} />
      <NavGroup items={secondaryNav} slug={workspace} activeSegment={active} className="mt-auto" />
    </>
  );
}
