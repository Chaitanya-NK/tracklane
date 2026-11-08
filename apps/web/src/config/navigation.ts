import type { Route } from "next";
import {
  BellIcon,
  FilterIcon,
  FolderIcon,
  HomeIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: Route;
  icon: LucideIcon;
  /** Phase in which the destination becomes functional; earlier it shows a "coming soon" page. */
  availableInPhase: number;
}

/**
 * Primary navigation. One source of truth for the sidebar, the command menu and breadcrumbs.
 * Project-level navigation (board, backlog, timeline…) is added in Phase 2 when projects exist.
 */
export const primaryNav: NavItem[] = [
  { title: "For you", href: "/", icon: HomeIcon, availableInPhase: 0 },
  { title: "Inbox", href: "/inbox", icon: BellIcon, availableInPhase: 6 },
  { title: "Projects", href: "/projects", icon: FolderIcon, availableInPhase: 2 },
  { title: "Goals", href: "/goals", icon: TargetIcon, availableInPhase: 8 },
  { title: "Filters", href: "/filters", icon: FilterIcon, availableInPhase: 4 },
  { title: "Dashboards", href: "/dashboards", icon: LayoutDashboardIcon, availableInPhase: 7 },
  { title: "Teams", href: "/teams", icon: UsersIcon, availableInPhase: 7 },
];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return primaryNav[0];
  return primaryNav.find((item) => item.href !== "/" && pathname.startsWith(item.href));
}
