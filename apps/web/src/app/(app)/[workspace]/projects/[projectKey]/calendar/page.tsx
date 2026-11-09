import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { IssueCalendar, monthGrid, parseMonth, parseWeek, weekGrid } from "@/features/calendar";
import { getCalendar } from "@/features/calendar/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Calendar" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/calendar">;

async function ProjectCalendar({ params, searchParams }: Props) {
  const [{ workspace: slug, projectKey }, sp] = await Promise.all([params, searchParams]);
  const { project, role } = await getProjectAccess(slug, projectKey);
  const today = new Date().toISOString().slice(0, 10);
  const view = sp.view === "week" ? "week" : "month";
  const week = parseWeek(typeof sp.week === "string" ? sp.week : undefined, today);
  const month =
    view === "week"
      ? week.slice(0, 7)
      : parseMonth(typeof sp.month === "string" ? sp.month : undefined, today);
  const days = view === "week" ? weekGrid(week) : monthGrid(month);
  const data = await getCalendar(project, days[0]!, days.at(-1)!);
  return (
    <IssueCalendar
      key={`${view}:${view === "week" ? week : month}`}
      view={view}
      week={week}
      sprints={data.sprints}
      slug={slug}
      month={month}
      today={today}
      scheduled={data.scheduled}
      unscheduled={data.unscheduled}
      canEdit={can(role, "issues:update")}
    />
  );
}

export default function CalendarPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-lg" />}>
      <ProjectCalendar {...props} />
    </Suspense>
  );
}
