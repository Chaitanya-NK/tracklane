import "server-only";
import { formatIssueKey } from "@tracklane/core";
import { db, type Prisma } from "@tracklane/db";
import type {
  TimelineEpic,
  TimelineItem,
  TimelineLink,
  TimelineRelease,
  TimelineSprint,
} from "../types";

const itemSelect = {
  id: true,
  number: true,
  title: true,
  type: true,
  parentId: true,
  startDate: true,
  dueDate: true,
  status: { select: { name: true, category: true } },
  assignee: { select: { name: true, image: true } },
} satisfies Prisma.IssueSelect;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Epics with their (non-subtask) children, plus top-level work that has dates but no epic,
 * and sprints with dates for the background bands.
 */
export async function getTimeline(project: { id: string; key: string }) {
  const [issues, sprints, releases, links] = await Promise.all([
    db.issue.findMany({
      where: { projectId: project.id, type: { not: "subtask" } },
      orderBy: [{ position: "asc" }, { number: "asc" }],
      select: itemSelect,
    }),
    db.sprint.findMany({
      where: { projectId: project.id, startDate: { not: null }, endDate: { not: null } },
      orderBy: { startDate: "asc" },
      select: { name: true, state: true, startDate: true, endDate: true },
    }),
    db.release.findMany({
      where: {
        projectId: project.id,
        status: { not: "archived" },
        OR: [{ releaseDate: { not: null } }, { releasedAt: { not: null } }],
      },
      select: { name: true, releaseDate: true, releasedAt: true, status: true },
    }),
    db.issueLink.findMany({
      where: {
        type: "blocks",
        source: { projectId: project.id },
        target: { projectId: project.id },
      },
      select: { sourceId: true, targetId: true },
    }),
  ]);
  const toItem = (i: (typeof issues)[number]): TimelineItem => ({
    id: i.id,
    key: formatIssueKey(project.key, i.number),
    title: i.title,
    type: i.type,
    status: i.status,
    assignee: i.assignee,
    start: day(i.startDate),
    due: day(i.dueDate),
  });
  const epics: TimelineEpic[] = issues
    .filter((i) => i.type === "epic")
    .map((epic) => ({
      ...toItem(epic),
      children: issues.filter((i) => i.parentId === epic.id).map(toItem),
    }));
  const epicIds = new Set(epics.map((e) => e.id));
  const loose = issues
    .filter(
      (i) =>
        i.type !== "epic" &&
        (!i.parentId || !epicIds.has(i.parentId)) &&
        (i.startDate || i.dueDate),
    )
    .map(toItem);
  const sprintBands: TimelineSprint[] = sprints.map((s) => ({
    name: s.name,
    state: s.state,
    start: day(s.startDate)!,
    end: day(s.endDate)!,
  }));
  const markers: TimelineRelease[] = releases.map((r) => ({
    name: r.name,
    date: day(r.releasedAt ?? r.releaseDate)!,
    released: r.status === "released",
  }));
  const deps: TimelineLink[] = links.map((l) => ({ from: l.sourceId, to: l.targetId }));
  return { epics, loose, sprints: sprintBands, releases: markers, links: deps };
}
