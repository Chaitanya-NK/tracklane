"use client";

import { formatElapsed, parseDuration, type TqlCatalog } from "@tracklane/core";
import { MoreHorizontalIcon, PlusIcon, TimerIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TqlEditor } from "@/features/search";
import { deleteSlaPolicyAction, saveSlaPolicyAction } from "../server/actions";

export interface SlaPolicyRow {
  id: string;
  name: string;
  query: string;
  metric: "first_response" | "resolution";
  targetMinutes: number;
  warnMinutes: number;
}

export const SLA_METRIC_LABELS = {
  first_response: "First response",
  resolution: "Resolution",
} as const;

export function SlaPoliciesManager({
  slug,
  projectKey,
  policies,
  catalog,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  policies: SlaPolicyRow[];
  catalog: TqlCatalog;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<SlaPolicyRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<SlaPolicyRow | null>(null);
  const remove = useAction(deleteSlaPolicyAction);

  async function confirmDelete() {
    if (!deleting) return;
    const res = await remove.executeAsync({ slug, projectKey, policyId: deleting.id });
    if (res?.serverError) return void toast.error(res.serverError.message);
    toast.success(`Deleted ${deleting.name}`);
    setDeleting(null);
  }

  return (
    <section className="max-w-4xl space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Service level agreements</h2>
          <p className="text-sm text-muted-foreground">
            Targets for how fast matching issues get a first response or get resolved, counted in
            calendar time from creation. Owners are notified when an issue is at risk and when it
            misses the target.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon />
            Add SLA
          </Button>
        ) : null}
      </div>
      {policies.length === 0 ? (
        <EmptyState
          icon={TimerIcon}
          title="No SLAs yet"
          description='For example: "Bugs resolved within 3 days" for type = bug, or "Urgent first response in 4h" for priority = highest.'
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SLA</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="max-w-72 font-mono text-xs break-all whitespace-normal text-muted-foreground">
                    {p.query}
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    {SLA_METRIC_LABELS[p.metric]} within {formatElapsed(p.targetMinutes)}
                    <div className="text-xs text-muted-foreground">
                      At risk {formatElapsed(p.warnMinutes)} before
                    </div>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`}>
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(p)}>Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {editing ? (
        <SlaDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          projectKey={projectKey}
          catalog={catalog}
          policy={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Issues stop showing this SLA and nobody is warned about it any more."
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function SlaDialog({
  slug,
  projectKey,
  catalog,
  policy,
  onClose,
}: {
  slug: string;
  projectKey: string;
  catalog: TqlCatalog;
  policy?: SlaPolicyRow;
  onClose: () => void;
}) {
  const [name, setName] = useState(policy?.name ?? "");
  const [query, setQuery] = useState(policy?.query ?? "");
  const [metric, setMetric] = useState<SlaPolicyRow["metric"]>(policy?.metric ?? "resolution");
  const [target, setTarget] = useState(policy ? formatElapsed(policy.targetMinutes) : "3d");
  const [warn, setWarn] = useState(policy ? formatElapsed(policy.warnMinutes) : "4h");
  const save = useAction(saveSlaPolicyAction);
  const serverError = save.result.serverError;
  const targetMinutes = parseDuration(target, { calendar: true });
  const warnMinutes = parseDuration(warn, { calendar: true });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!targetMinutes || warnMinutes === null) return;
    const res = await save.executeAsync({
      slug,
      projectKey,
      policyId: policy?.id,
      policy: { name, query, metric, targetMinutes, warnMinutes },
    });
    if (!res?.data) return;
    toast.success(policy ? `Saved ${res.data.name}` : `Added ${res.data.name}`);
    onClose();
  }

  const error = (field: string) =>
    serverError?.field === field ? <FieldError>{serverError.message}</FieldError> : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{policy ? `Edit ${policy.name}` : "Add SLA"}</DialogTitle>
          <DialogDescription>
            Counted from when the issue was created, nights and weekends included.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={serverError?.field === "name" || undefined}>
              <FieldLabel htmlFor="sla-name">Name</FieldLabel>
              <Input
                id="sla-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bugs resolved within 3 days"
                maxLength={60}
                autoFocus
              />
              {error("name")}
            </Field>
            <Field data-invalid={serverError?.field === "query" || undefined}>
              <FieldLabel>Applies to issues matching</FieldLabel>
              <TqlEditor value={query} onChange={setQuery} onSubmit={() => {}} catalog={catalog} />
              <FieldDescription>
                Any TQL condition; only this project&apos;s issues count.
              </FieldDescription>
              {error("query")}
            </Field>
            <Field>
              <FieldLabel>Measure</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={metric}
                onValueChange={(v) => v && setMetric(v as typeof metric)}
                className="w-full"
              >
                <ToggleGroupItem value="first_response" className="flex-1">
                  First response
                </ToggleGroupItem>
                <ToggleGroupItem value="resolution" className="flex-1">
                  Resolution
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {metric === "first_response"
                  ? "Stops at the first comment by someone other than the reporter."
                  : "Stops when the issue moves to a Done status."}
              </FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!targetMinutes || serverError?.field === "target" || undefined}>
                <FieldLabel htmlFor="sla-target">Target</FieldLabel>
                <Input
                  id="sla-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="3d, 4h, 30m"
                />
                <FieldDescription>
                  {targetMinutes ? `= ${formatElapsed(targetMinutes)}` : "e.g. 3d, 4h 30m"}
                </FieldDescription>
              </Field>
              <Field
                data-invalid={warnMinutes === null || serverError?.field === "warn" || undefined}
              >
                <FieldLabel htmlFor="sla-warn">Warn before</FieldLabel>
                <Input
                  id="sla-warn"
                  value={warn}
                  onChange={(e) => setWarn(e.target.value)}
                  placeholder="4h"
                />
                {error("warn")}
              </Field>
            </div>
            {serverError && !serverError.field ? (
              <FieldError>{serverError.message}</FieldError>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !targetMinutes || warnMinutes === null || save.isPending}
            >
              {save.isPending ? <Spinner /> : null}
              {policy ? "Save" : "Add SLA"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
