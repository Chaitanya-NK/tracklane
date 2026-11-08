"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavItem, primaryNav } from "@/config/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavMain() {
  const pathname = usePathname();
  const active = findNavItem(pathname);

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {primaryNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={active?.href === item.href} tooltip={item.title}>
                <Link href={item.href}>
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
