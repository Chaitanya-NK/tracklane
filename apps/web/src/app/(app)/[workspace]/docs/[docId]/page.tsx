import { can } from "@tracklane/core";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { liveRooms, LiveRefresh, Viewers } from "@/components/shared/realtime";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DocEditor, DocTree, NewDocButton } from "@/features/docs";
import { getDoc, listDocs } from "@/features/docs/server";
import { getWorkspaceAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Doc" };

type Props = PageProps<"/[workspace]/docs/[docId]">;

async function Doc({ params, searchParams }: Props) {
  const [{ workspace: slug, docId }, query] = await Promise.all([params, searchParams]);
  const { workspace, role } = await getWorkspaceAccess(slug);
  const doc = await getDoc(workspace.id, docId);
  if (!doc) notFound();
  const siblings = await listDocs(workspace.id, doc.projectId);
  const canEdit = can(role, "issues:update");
  const room = liveRooms.item(workspace.id, "doc", doc.id);
  // Ancestors, nearest last, for the breadcrumb.
  const byId = new Map(siblings.map((d) => [d.id, d]));
  const trail: { id: string; title: string }[] = [];
  for (
    let p = doc.parentId ? byId.get(doc.parentId) : undefined;
    p;
    p = p.parentId ? byId.get(p.parentId) : undefined
  ) {
    trail.unshift({ id: p.id, title: p.title });
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <LiveRefresh rooms={[room]} />
      <aside className="hidden space-y-3 lg:block" aria-label="Pages">
        <p className="px-2 text-xs font-medium text-muted-foreground">
          {doc.project ? doc.project.name : "Workspace"} pages
        </p>
        <DocTree slug={slug} docs={siblings} currentId={doc.id} />
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/${slug}/docs` as Route}>Docs</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {trail.map((t) => (
                <span key={t.id} className="contents">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href={`/${slug}/docs/${t.id}` as Route}>{t.title}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </span>
              ))}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{doc.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex items-center gap-2">
            <Viewers room={room} />
            {canEdit ? (
              <NewDocButton
                slug={slug}
                projects={[]}
                parent={{ id: doc.id, title: doc.title }}
                variant="outline"
              />
            ) : null}
          </div>
        </div>
        <DocEditor
          key={doc.id}
          slug={slug}
          doc={doc}
          canEdit={canEdit}
          startEditing={query.edit === "1"}
        />
        {doc.children.length ? (
          <section className="border-t pt-4" aria-label="Sub-pages">
            <h2 className="mb-2 text-sm font-semibold">Sub-pages</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {doc.children.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/${slug}/docs/${c.id}` as Route}
                    className="block rounded-lg border p-3 text-sm font-medium hover:bg-accent"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function DocPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Doc {...props} />
    </Suspense>
  );
}
