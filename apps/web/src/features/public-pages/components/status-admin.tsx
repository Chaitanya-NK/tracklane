"use client";

import { ExternalLinkIcon, MegaphoneIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TimeAgo } from "@/components/shared/time-ago";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addIncidentUpdateAction,
  createIncidentAction,
  deleteComponentAction,
  deleteIncidentAction,
  saveComponentAction,
  setStatusPagePublicAction,
} from "../server/actions";
import type { StatusAdmin as StatusAdminData } from "../server/status";
import {
  COMPONENT_STATUS_LABELS,
  COMPONENT_STATUS_TONE,
  IMPACT_LABELS,
  INCIDENT_STATUS_LABELS,
} from "../status-display";

type ComponentStatus = keyof typeof COMPONENT_STATUS_LABELS;
type IncidentStatus = keyof typeof INCIDENT_STATUS_LABELS;
type Impact = keyof typeof IMPACT_LABELS;

function StatusSelect({
  value,
  onChange,
  id,
  label,
  className,
}: {
  value: ComponentStatus;
  onChange: (v: ComponentStatus) => void;
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ComponentStatus)}>
      <SelectTrigger id={id} size="sm" className={cn("w-52", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(COMPONENT_STATUS_LABELS) as ComponentStatus[]).map((s) => (
          <SelectItem key={s} value={s}>
            <span
              className={cn("size-2 rounded-full", COMPONENT_STATUS_TONE[s])}
              aria-hidden="true"
            />
            {COMPONENT_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusAdmin({ slug, data }: { slug: string; data: StatusAdminData }) {
  const [newComponent, setNewComponent] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [deleting, setDeleting] = useState<{
    kind: "component" | "incident";
    id: string;
    name: string;
  } | null>(null);
  const togglePublic = useAction(setStatusPagePublicAction);
  const saveComponent = useAction(saveComponentAction);
  const removeComponent = useAction(deleteComponentAction);
  const removeIncident = useAction(deleteIncidentAction);
  const run = async (
    p: Promise<{ serverError?: { message: string } } | undefined>,
    ok?: string,
  ) => {
    const res = await p;
    if (res?.serverError) toast.error(res.serverError.message);
    else if (ok) toast.success(ok);
  };
  const open = data.incidents.filter((i) => !i.resolvedAt);
  const past = data.incidents.filter((i) => i.resolvedAt);

  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Status page</CardTitle>
          <CardDescription>
            Tell customers what&apos;s working and what isn&apos;t, at a public address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="status-public">Public</FieldLabel>
              <FieldDescription>
                Anyone with the link can see components and incidents. Nothing else is shown.
              </FieldDescription>
              {data.statusPagePublic ? (
                <Button variant="link" size="sm" className="h-auto self-start p-0" asChild>
                  <a href={`/status/${data.slug}`} target="_blank" rel="noreferrer">
                    /status/{data.slug}
                    <ExternalLinkIcon />
                  </a>
                </Button>
              ) : null}
            </FieldContent>
            <Switch
              id="status-public"
              checked={data.statusPagePublic}
              disabled={togglePublic.isPending}
              onCheckedChange={(value) =>
                run(
                  togglePublic.executeAsync({ slug, value }),
                  value ? "Status page is public" : "Status page is private",
                )
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>
            The parts of your service customers care about, like API, Website or Payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="divide-y rounded-lg border">
            {data.components.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                <span
                  className={cn("size-2.5 rounded-full", COMPONENT_STATUS_TONE[c.status])}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 font-medium">{c.name}</span>
                <StatusSelect
                  value={c.status}
                  label={`${c.name} status`}
                  onChange={(status) =>
                    run(
                      saveComponent.executeAsync({
                        slug,
                        id: c.id,
                        name: c.name,
                        description: c.description,
                        status,
                      }),
                      `${c.name}: ${COMPONENT_STATUS_LABELS[status]}`,
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => setDeleting({ kind: "component", id: c.id, name: c.name })}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
            {!data.components.length ? (
              <li className="p-3 text-sm text-muted-foreground">No components yet.</li>
            ) : null}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newComponent.trim()) return;
              await run(
                saveComponent.executeAsync({
                  slug,
                  id: null,
                  name: newComponent,
                  description: "",
                  status: "operational",
                }),
                `Added ${newComponent}`,
              );
              setNewComponent("");
            }}
          >
            <Input
              value={newComponent}
              onChange={(e) => setNewComponent(e.target.value)}
              placeholder="API"
              aria-label="New component name"
              maxLength={80}
              className="max-w-xs"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!newComponent.trim() || saveComponent.isPending}
            >
              <PlusIcon />
              Add component
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
          <CardDescription>
            Post what happened and keep people updated until it&apos;s resolved.
          </CardDescription>
          <CardAction>
            <Button onClick={() => setIncidentOpen(true)}>
              <MegaphoneIcon />
              Report incident
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open incidents.</p>
          ) : null}
          {open.map((incident) => (
            <IncidentCard
              key={incident.id}
              slug={slug}
              incident={incident}
              onDelete={() =>
                setDeleting({ kind: "incident", id: incident.id, name: incident.title })
              }
            />
          ))}
          {past.length ? (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Resolved ({past.length})
              </summary>
              <div className="mt-3 space-y-3">
                {past.map((incident) => (
                  <IncidentCard
                    key={incident.id}
                    slug={slug}
                    incident={incident}
                    onDelete={() =>
                      setDeleting({ kind: "incident", id: incident.id, name: incident.title })
                    }
                  />
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      {incidentOpen ? (
        <IncidentDialog
          slug={slug}
          components={data.components}
          onClose={() => setIncidentOpen(false)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description={
          deleting?.kind === "incident"
            ? "It disappears from the status page and its history."
            : "Its history on the status page goes too."
        }
        pending={removeComponent.isPending || removeIncident.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          await run(
            deleting.kind === "component"
              ? removeComponent.executeAsync({ slug, id: deleting.id })
              : removeIncident.executeAsync({ slug, incidentId: deleting.id }),
            `Deleted ${deleting.name}`,
          );
          setDeleting(null);
        }}
      />
    </div>
  );
}

function IncidentCard({
  slug,
  incident,
  onDelete,
}: {
  slug: string;
  incident: StatusAdminData["incidents"][number];
  onDelete: () => void;
}) {
  const [status, setStatus] = useState<IncidentStatus>(
    incident.status === "resolved" ? "resolved" : incident.status,
  );
  const [body, setBody] = useState("");
  const post = useAction(addIncidentUpdateAction);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{incident.title}</h3>
        <Badge variant="outline">{IMPACT_LABELS[incident.impact]}</Badge>
        <Badge variant={incident.resolvedAt ? "secondary" : "default"}>
          {INCIDENT_STATUS_LABELS[incident.status]}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          aria-label={`Delete ${incident.title}`}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </div>
      <ol className="space-y-2 border-l pl-3">
        {incident.updates.map((u) => (
          <li key={u.id} className="text-sm">
            <span className="font-medium">{INCIDENT_STATUS_LABELS[u.status]}</span>{" "}
            <span className="text-xs text-muted-foreground">
              · <TimeAgo date={u.createdAt} />
              {u.author ? ` · ${u.author.name}` : ""}
            </span>
            <p className="whitespace-pre-wrap text-muted-foreground">{u.body}</p>
          </li>
        ))}
      </ol>
      {!incident.resolvedAt ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await post.executeAsync({ slug, incidentId: incident.id, status, body });
            if (res?.serverError) return void toast.error(res.serverError.message);
            if (res?.validationErrors) return void toast.error("Write the update");
            toast.success(status === "resolved" ? "Incident resolved" : "Update posted");
            setBody("");
          }}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="What's the latest?"
            aria-label={`Update for ${incident.title}`}
            maxLength={5000}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus)}>
              <SelectTrigger size="sm" className="w-40" aria-label="New status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {INCIDENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" disabled={!body.trim() || post.isPending}>
              {post.isPending ? <Spinner /> : null}
              Post update
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function IncidentDialog({
  slug,
  components,
  onClose,
}: {
  slug: string;
  components: StatusAdminData["components"];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [impact, setImpact] = useState<Impact>("minor");
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [componentStatus, setComponentStatus] = useState<ComponentStatus>("degraded");
  const create = useAction(createIncidentAction);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await create.executeAsync({
      slug,
      title,
      impact,
      status: "investigating",
      body,
      componentIds: picked,
      componentStatus,
    });
    if (res?.serverError || res?.validationErrors) return;
    toast.success("Incident posted");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report an incident</DialogTitle>
          <DialogDescription>
            It appears on the status page straight away, as Investigating.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inc-title">Title</FieldLabel>
              <Input
                id="inc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Elevated API error rates"
                maxLength={160}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="inc-impact">Impact</FieldLabel>
              <Select value={impact} onValueChange={(v) => setImpact(v as Impact)}>
                <SelectTrigger id="inc-impact" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(IMPACT_LABELS) as Impact[]).map((i) => (
                    <SelectItem key={i} value={i}>
                      {IMPACT_LABELS[i]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="inc-body">First update</FieldLabel>
              <Textarea
                id="inc-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="We're looking into reports of…"
                maxLength={5000}
              />
            </Field>
            {components.length ? (
              <FieldSet>
                <FieldLegend variant="label">Affected components</FieldLegend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {components.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={picked.includes(c.id)}
                        onCheckedChange={(on) =>
                          setPicked((l) => (on ? [...l, c.id] : l.filter((x) => x !== c.id)))
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {picked.length ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Set them to</span>
                    <StatusSelect
                      value={componentStatus}
                      onChange={setComponentStatus}
                      label="Affected component status"
                    />
                  </div>
                ) : null}
              </FieldSet>
            ) : null}
            {create.result.serverError ? (
              <FieldError>{create.result.serverError.message}</FieldError>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || !body.trim() || create.isPending}>
              {create.isPending ? <Spinner /> : null}
              Post incident
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
