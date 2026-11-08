import { TimeAgo } from "@/components/shared/time-ago";
import { PROJECT_TYPE_LABELS } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectListItem } from "../server/queries";
import { ProjectAvatar } from "./project-avatar";

export function ProjectsTable({ slug, projects }: { slug: string; projects: ProjectListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead className="w-24">Key</TableHead>
            <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
            <TableHead className="hidden w-44 md:table-cell">Lead</TableHead>
            <TableHead className="w-32 text-right">Open issues</TableHead>
            <TableHead className="hidden w-32 lg:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id} className="group relative">
              <TableCell>
                <div className="flex items-center gap-3">
                  <ProjectAvatar projectKey={project.key} />
                  <Link
                    href={`/${slug}/projects/${project.key}` as Route}
                    className="font-medium group-hover:underline after:absolute after:inset-0"
                  >
                    {project.name}
                  </Link>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {project.key}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline">{PROJECT_TYPE_LABELS[project.type].label}</Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {project.lead ? (
                  <span className="flex items-center gap-2 text-sm">
                    <UserAvatar user={project.lead} /> {project.lead.name}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {project.openIssues}
                <span className="text-muted-foreground"> / {project.totalIssues}</span>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                <TimeAgo date={project.updatedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
