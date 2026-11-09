import { CheckCircle2Icon, CircleDashedIcon, LoaderCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalRequest } from "@/features/public-pages/server";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your request", robots: { index: false } };

type Props = PageProps<"/portal/[workspace]/[projectKey]/r/[token]">;

const STEPS = [
  { category: "todo", label: "Received", icon: CircleDashedIcon },
  { category: "in_progress", label: "In progress", icon: LoaderCircleIcon },
  { category: "done", label: "Done", icon: CheckCircle2Icon },
] as const;

async function Request({ params }: { params: Props["params"] }) {
  const { workspace, projectKey, token } = await params;
  const request = await getPortalRequest(workspace, projectKey, token);
  if (!request) notFound();
  const at = STEPS.findIndex((s) => s.category === request.issue.status.category);
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardDescription>
            {request.project.workspace.name} · {request.project.name} · {request.key}
          </CardDescription>
          <CardTitle className="text-xl">{request.issue.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="grid grid-cols-3 gap-2" aria-label="Progress">
            {STEPS.map((step, i) => (
              <li
                key={step.category}
                aria-current={i === at ? "step" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-3 text-center text-sm",
                  i <= at ? "border-primary/40 bg-primary/5 font-medium" : "text-muted-foreground",
                )}
              >
                <step.icon className="size-5" aria-hidden="true" />
                {step.label}
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant="secondary">{request.issue.status.name}</Badge>
              {request.issue.resolution ? (
                <span className="ml-2 text-muted-foreground">
                  ({request.issue.resolution.name})
                </span>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">Sent</dt>
            <dd>
              {formatDate(request.createdAt)} by {request.name}
            </dd>
            <dt className="text-muted-foreground">Last update</dt>
            <dd>{formatDate(request.issue.updatedAt)}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Keep this link private: anyone with it can see this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalRequestPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-2xl" />}>
      <Request params={params} />
    </Suspense>
  );
}
