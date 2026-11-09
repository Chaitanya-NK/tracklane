import { PackageIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicRoadmap } from "@/features/public-pages/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Roadmap" };

type Props = PageProps<"/roadmap/[workspace]/[projectKey]">;

const COLUMNS = [
  { id: "now", title: "Now", hint: "Being built" },
  { id: "next", title: "Next", hint: "Planned" },
  { id: "later", title: "Later", hint: "On our list" },
  { id: "shipped", title: "Shipped", hint: "Recently done" },
] as const;

async function Roadmap({ params }: { params: Props["params"] }) {
  const { workspace, projectKey } = await params;
  const roadmap = await getPublicRoadmap(workspace, projectKey);
  if (!roadmap) notFound();
  const upcoming = roadmap.releases.filter((r) => r.status === "unreleased");
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{roadmap.project.workspace.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{roadmap.project.name} roadmap</h1>
        {roadmap.project.description ? (
          <p className="max-w-2xl text-muted-foreground">{roadmap.project.description}</p>
        ) : null}
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = roadmap.columns[col.id];
          return (
            <section
              key={col.id}
              aria-labelledby={`col-${col.id}`}
              className="space-y-3 rounded-xl bg-muted/40 p-3"
            >
              <h2 id={`col-${col.id}`} className="flex items-baseline justify-between">
                <span className="font-semibold">{col.title}</span>
                <span className="text-xs text-muted-foreground">{col.hint}</span>
              </h2>
              {cards.length ? (
                <ul className="space-y-2">
                  {cards.map((c) => {
                    const pct = c.total
                      ? Math.round((c.done / c.total) * 100)
                      : c.category === "done"
                        ? 100
                        : 0;
                    return (
                      <li key={c.id}>
                        <Card className="gap-3 py-4">
                          <CardHeader className="px-4">
                            <CardTitle className="text-sm leading-snug">{c.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 px-4">
                            {col.id !== "shipped" ? (
                              <>
                                <Progress value={pct} aria-label={`${c.title} progress`} />
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {pct}% done{c.dueDate ? ` · target ${formatDate(c.dueDate)}` : ""}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {c.resolvedAt ? `Shipped ${formatDate(c.resolvedAt)}` : "Shipped"}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-1 text-sm text-muted-foreground">Nothing here right now.</p>
              )}
            </section>
          );
        })}
      </div>
      {upcoming.length ? (
        <section className="space-y-3" aria-labelledby="releases">
          <h2 id="releases" className="text-lg font-semibold">
            Upcoming releases
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
                <PackageIcon className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {r.name}{" "}
                    {r.releaseDate ? (
                      <Badge variant="outline">{formatDate(r.releaseDate)}</Badge>
                    ) : null}
                  </p>
                  {r.description ? (
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default function RoadmapPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Roadmap params={params} />
    </Suspense>
  );
}
