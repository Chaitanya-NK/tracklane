"use client";

import { PROJECT_TYPE_LABELS } from "@tracklane/core";
import {
  KanbanSquareIcon,
  LayoutGridIcon,
  LinkIcon,
  ListIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Settings2Icon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StarButton } from "@/features/issues";
import { useStoredState } from "@/hooks/use-stored-state";
import type { ProjectListItem } from "../server/queries";
import { ProjectAvatar } from "./project-avatar";

function People({ people }: { people: ProjectListItem["people"] }) {
  return (
    <span className="flex -space-x-1.5">
      {people.map((p) => (
        <UserAvatar key={p.id} user={p} className="size-6 ring-2 ring-background" />
      ))}
      {people.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : null}
    </span>
  );
}

function RowMenu({ slug, project }: { slug: string; project: ProjectListItem }) {
  const base = `/${slug}/projects/${project.key}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative z-10 size-7">
          <MoreHorizontalIcon aria-hidden="true" />
          <span className="sr-only">Actions for {project.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`${base}/board` as Route}>
            <KanbanSquareIcon aria-hidden="true" /> Open board
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}/settings` as Route}>
            <Settings2Icon aria-hidden="true" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}${base}`);
              toast.success("Link copied");
            } catch {
              toast.error("Couldn't copy the link");
            }
          }}
        >
          <LinkIcon aria-hidden="true" /> Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const progressOf = (p: ProjectListItem) =>
  p.totalIssues ? Math.round(((p.totalIssues - p.openIssues) / p.totalIssues) * 100) : 0;

/** All projects: search, filter by type and lead, table or grid, star favourites. */
export function ProjectsTable({ slug, projects }: { slug: string; projects: ProjectListItem[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [lead, setLead] = useState("all");
  const [view, setView] = useStoredState<"table" | "grid">("tl.projects.view", "table");
  const leads = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) if (p.lead) m.set(p.lead.id, p.lead.name);
    return [...m];
  }, [projects]);
  const shown = projects
    .filter((p) => {
      const text = q.trim().toLowerCase();
      if (text && !p.name.toLowerCase().includes(text) && !p.key.toLowerCase().includes(text))
        return false;
      if (type !== "all" && p.type !== type) return false;
      if (lead !== "all" && (p.lead?.id ?? "none") !== lead) return false;
      return true;
    })
    .sort((a, b) => Number(b.starred) - Number(a.starred));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
          />
        </InputGroup>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger size="sm" className="w-36" aria-label="Project type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="scrum">Scrum</SelectItem>
            <SelectItem value="kanban">Kanban</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lead} onValueChange={setLead}>
          <SelectTrigger size="sm" className="w-44" aria-label="Lead">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any lead</SelectItem>
            {leads.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
            <SelectItem value="none">No lead</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="ml-auto"
          value={view}
          onValueChange={(v) => v && setView(v as "table" | "grid")}
          aria-label="Layout"
        >
          <ToggleGroupItem value="table" aria-label="Table">
            <ListIcon aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid">
            <LayoutGridIcon aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No projects match" description="Try other filters." />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((project) => (
            <Card key={project.id} className="group relative gap-3 p-4">
              <div className="flex items-start gap-3">
                <ProjectAvatar projectKey={project.key} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${slug}/projects/${project.key}` as Route}
                    className="block truncate font-medium group-hover:underline after:absolute after:inset-0"
                  >
                    {project.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{project.key}</span> ·{" "}
                    {PROJECT_TYPE_LABELS[project.type].label}
                  </p>
                </div>
                <span className="relative z-10 flex">
                  <StarButton
                    target={{ slug, projectId: project.id }}
                    starred={project.starred}
                    label={project.name}
                  />
                  <RowMenu slug={slug} project={project} />
                </span>
              </div>
              <div className="space-y-1">
                <Progress
                  value={progressOf(project)}
                  className="h-1.5"
                  aria-label={`${progressOf(project)}% done`}
                />
                <p className="flex justify-between text-xs text-muted-foreground">
                  <span>{project.openIssues} open</span>
                  <span>{progressOf(project)}% done</span>
                </p>
              </div>
              <div className="flex items-center justify-between">
                <People people={project.people} />
                <span className="text-xs text-muted-foreground">
                  <TimeAgo date={project.updatedAt} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <span className="sr-only">Star</span>
                </TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="w-24">Key</TableHead>
                <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
                <TableHead className="hidden w-44 md:table-cell">Lead</TableHead>
                <TableHead className="hidden w-36 lg:table-cell">People</TableHead>
                <TableHead className="w-40">Progress</TableHead>
                <TableHead className="hidden w-28 lg:table-cell">Updated</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((project) => (
                <TableRow key={project.id} className="group relative">
                  <TableCell className="relative z-10">
                    <StarButton
                      target={{ slug, projectId: project.id }}
                      starred={project.starred}
                      label={project.name}
                    />
                  </TableCell>
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
                  <TableCell className="hidden lg:table-cell">
                    <People people={project.people} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Progress
                        value={progressOf(project)}
                        className="h-1.5 flex-1"
                        aria-label={`${progressOf(project)}% done`}
                      />
                      <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                        {project.openIssues} open
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    <TimeAgo date={project.updatedAt} />
                  </TableCell>
                  <TableCell>
                    <RowMenu slug={slug} project={project} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
