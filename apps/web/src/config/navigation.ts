import type { Route } from "next";
import {
  BellIcon,
  FileTextIcon,
  FilterIcon,
  FolderIcon,
  HomeIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MessagesSquareIcon,
  PenToolIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SpadeIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  /** Path inside the workspace, without a leading slash ("" is the workspace home). */
  segment: string;
  icon: LucideIcon;
  /** Phase in which the destination becomes functional; earlier it shows a "coming soon" page. */
  availableInPhase: number;
}

/** Builds a URL inside a workspace: workspacePath("acme", "projects") → "/acme/projects". */
export function workspacePath(slug: string, segment = ""): Route {
  return (segment ? `/${slug}/${segment}` : `/${slug}`) as Route;
}

/**
 * Primary navigation. One source of truth for the sidebar, the command menu and breadcrumbs.
 * Project-level navigation (board, backlog, timeline…) is added in Phase 2 when projects exist.
 */
export const primaryNav: NavItem[] = [
  { title: "For you", segment: "", icon: HomeIcon, availableInPhase: 0 },
  { title: "Inbox", segment: "inbox", icon: BellIcon, availableInPhase: 6 },
  { title: "Approvals", segment: "approvals", icon: ShieldCheckIcon, availableInPhase: 8 },
  { title: "Projects", segment: "projects", icon: FolderIcon, availableInPhase: 2 },
  { title: "Goals", segment: "goals", icon: TargetIcon, availableInPhase: 8 },
  { title: "Filters", segment: "filters", icon: FilterIcon, availableInPhase: 4 },
  { title: "Dashboards", segment: "dashboards", icon: LayoutDashboardIcon, availableInPhase: 7 },
  { title: "Team", segment: "teams", icon: UsersIcon, availableInPhase: 7 },
];

/** Shown under a "Collaborate" heading. */
export const collaborateNav: NavItem[] = [
  { title: "Docs", segment: "docs", icon: FileTextIcon, availableInPhase: 9 },
  { title: "Whiteboards", segment: "whiteboards", icon: PenToolIcon, availableInPhase: 9 },
  { title: "Retros", segment: "retros", icon: MessagesSquareIcon, availableInPhase: 9 },
  { title: "Planning poker", segment: "poker", icon: SpadeIcon, availableInPhase: 9 },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings", segment: "settings", icon: SettingsIcon, availableInPhase: 1 },
];

const allNav = [...primaryNav, ...collaborateNav, ...secondaryNav];

/** Matches a pathname like "/acme/projects/web" to its nav item. */
export function findNavItem(pathname: string): NavItem | undefined {
  const [, , first = ""] = pathname.split("/");
  // Issue pages (/acme/issues/PAY-1) belong to Projects; profiles to Team.
  const segment =
    first === "issues" ? "projects" : first === "people" || first === "profile" ? "teams" : first;
  return allNav.find((item) => item.segment === segment);
}
