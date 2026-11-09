"use client";

import { CheckIcon, CopyIcon, PencilIcon, RocketIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  RELEASE_STATUS_LABELS,
  ReleaseDialog,
  type ReleaseRow,
  ShipDialog,
} from "./releases-manager";
import { ReleaseProgress } from "./release-progress";

/** Header, progress and release notes for one release; the issue table is rendered by the page. */
export function ReleaseDetail({
  slug,
  projectKey,
  release,
  counts,
  others,
  notes,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  release: Omit<ReleaseRow, "counts">;
  counts: ReleaseRow["counts"];
  others: { id: string; name: string }[];
  notes: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [copied, setCopied] = useState(false);
  const total = counts.todo + counts.in_progress + counts.done;

  async function copy() {
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      toast.success("Release notes copied as Markdown");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{release.name}</h2>
            <Badge variant={release.status === "released" ? "secondary" : "outline"}>
              {RELEASE_STATUS_LABELS[release.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[
              release.startDate ? `Started ${formatDate(release.startDate)}` : null,
              release.releasedAt
                ? `Released ${formatDate(release.releasedAt)}`
                : release.releaseDate
                  ? `Due ${formatDate(release.releaseDate)}`
                  : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No dates set"}
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit
            </Button>
            {release.status === "unreleased" ? (
              <Button onClick={() => setShipping(true)}>
                <RocketIcon />
                Release
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ReleaseProgress counts={counts} total={total} className="max-w-md" />
      <Card>
        <CardHeader>
          <CardTitle>Release notes</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              Copy Markdown
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Markdown>{notes}</Markdown>
        </CardContent>
      </Card>
      {editing ? (
        <ReleaseDialog
          slug={slug}
          projectKey={projectKey}
          row={release}
          onClose={() => setEditing(false)}
        />
      ) : null}
      {shipping ? (
        <ShipDialog
          slug={slug}
          projectKey={projectKey}
          row={{ id: release.id, name: release.name, counts }}
          others={others}
          onClose={() => setShipping(false)}
        />
      ) : null}
    </div>
  );
}
