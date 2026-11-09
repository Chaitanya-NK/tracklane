"use client";

import type { TqlCatalog } from "@tracklane/core";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Columns2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RectangleHorizontalIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { TqlEditor } from "@/features/search";
import { deleteDashboardAction, saveWidgetsAction, updateDashboardAction } from "../server/actions";
import {
  BREAKDOWN_FIELD_OPTIONS,
  type Widget,
  WIDGET_LABELS,
  WIDGET_TYPES,
  type WidgetType,
  widgetNeeds,
} from "../widgets";

const FIELD_LABELS: Record<(typeof BREAKDOWN_FIELD_OPTIONS)[number], string> = {
  status: "Status",
  statusCategory: "Status category",
  priority: "Priority",
  assignee: "Assignee",
  type: "Type",
  resolution: "Resolution",
  label: "Label",
};

export interface EditorContext {
  slug: string;
  dashboardId: string;
  widgets: Widget[];
  catalog: TqlCatalog;
  projects: { key: string; name: string; type: "scrum" | "kanban" }[];
}

function useSaveWidgets(ctx: EditorContext) {
  const save = useAction(saveWidgetsAction);
  return async (widgets: Widget[], message: string) => {
    const res = await save.executeAsync({ slug: ctx.slug, dashboardId: ctx.dashboardId, widgets });
    if (res?.serverError) toast.error(res.serverError.message);
    else if (res?.validationErrors) toast.error("That widget isn't valid");
    else toast.success(message);
  };
}

/** Header buttons: edit mode, add widget, dashboard settings, delete. */
export function DashboardToolbar({
  ctx,
  editing,
  meta,
}: {
  ctx: EditorContext;
  editing: boolean;
  meta: { name: string; description: string; shared: boolean };
}) {
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useAction(deleteDashboardAction);
  const save = useSaveWidgets(ctx);
  const base = `/${ctx.slug}/dashboards/${ctx.dashboardId}`;
  return (
    <div className="flex flex-wrap gap-2">
      {editing ? (
        <>
          <Button onClick={() => setAdding(true)}>
            <PlusIcon />
            Add widget
          </Button>
          <Button variant="outline" onClick={() => setSettings(true)}>
            <Settings2Icon />
            Settings
          </Button>
          <Button variant="ghost" className="text-destructive" onClick={() => setDeleting(true)}>
            <Trash2Icon />
            Delete
          </Button>
          <Button variant="secondary" asChild>
            <Link href={base as Route}>Done</Link>
          </Button>
        </>
      ) : (
        <Button variant="outline" asChild>
          <Link href={`${base}?edit=1` as Route}>
            <PencilIcon />
            Edit
          </Link>
        </Button>
      )}
      {adding ? (
        <WidgetDialog
          ctx={ctx}
          onClose={() => setAdding(false)}
          onSave={(widget) => save([...ctx.widgets, widget], `Added ${widget.title}`)}
        />
      ) : null}
      {settings ? (
        <DashboardSettingsDialog ctx={ctx} meta={meta} onClose={() => setSettings(false)} />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${meta.name}?`}
        description={
          meta.shared ? "Everyone loses this shared dashboard." : "This can't be undone."
        }
        pending={remove.isPending}
        onConfirm={() => remove.execute({ slug: ctx.slug, dashboardId: ctx.dashboardId })}
      />
    </div>
  );
}

/** Edit-mode menu on a widget: edit, move, resize, remove. */
export function WidgetMenu({ ctx, index }: { ctx: EditorContext; index: number }) {
  const [editing, setEditing] = useState(false);
  const save = useSaveWidgets(ctx);
  const widget = ctx.widgets[index]!;
  const replace = (next: Widget[], message: string) => void save(next, message);
  const move = (by: -1 | 1) => {
    const next = [...ctx.widgets];
    const [w] = next.splice(index, 1);
    next.splice(index + by, 0, w!);
    replace(next, `Moved ${widget.title}`);
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Widget options for ${widget.title}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              replace(
                ctx.widgets.map((w, i) =>
                  i === index ? { ...w, size: w.size === "full" ? "half" : "full" } : w,
                ),
                widget.size === "full" ? "Made it half width" : "Made it full width",
              )
            }
          >
            {widget.size === "full" ? <Columns2Icon /> : <RectangleHorizontalIcon />}
            {widget.size === "full" ? "Half width" : "Full width"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === 0} onSelect={() => move(-1)}>
            <ArrowUpIcon />
            Move earlier
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === ctx.widgets.length - 1} onSelect={() => move(1)}>
            <ArrowDownIcon />
            Move later
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              replace(
                ctx.widgets.filter((_, i) => i !== index),
                `Removed ${widget.title}`,
              )
            }
          >
            <Trash2Icon />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing ? (
        <WidgetDialog
          ctx={ctx}
          widget={widget}
          onClose={() => setEditing(false)}
          onSave={(next) =>
            save(
              ctx.widgets.map((w, i) => (i === index ? next : w)),
              `Saved ${next.title}`,
            )
          }
        />
      ) : null}
    </>
  );
}

function WidgetDialog({
  ctx,
  widget,
  onClose,
  onSave,
}: {
  ctx: EditorContext;
  widget?: Widget;
  onClose: () => void;
  onSave: (widget: Widget) => Promise<void>;
}) {
  const [type, setType] = useState<WidgetType>(widget?.type ?? "count");
  const [title, setTitle] = useState(widget?.title ?? "");
  const [query, setQuery] = useState(
    widget?.config.query ?? "assignee = currentUser() AND statusCategory != done",
  );
  const [field, setField] = useState(
    widget?.config.field ?? (widget?.type === "two_d" ? "assignee" : "status"),
  );
  const [field2, setField2] = useState(widget?.config.field2 ?? "statusCategory");
  const [limit, setLimit] = useState(String(widget?.config.limit ?? 5));
  const [days, setDays] = useState(String(widget?.config.days ?? 30));
  const [projectKey, setProjectKey] = useState(
    widget?.config.projectKey ?? ctx.projects[0]?.key ?? "",
  );
  const [saving, setSaving] = useState(false);
  const needs = widgetNeeds(type);
  const projects =
    type === "burndown" || type === "velocity" || type === "sprint_health"
      ? ctx.projects.filter((p) => p.type === "scrum")
      : ctx.projects;
  const valid = Boolean(
    (title.trim() || WIDGET_LABELS[type].label) &&
    (!needs.query || query.trim()) &&
    (!needs.project || projectKey),
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onSave({
      id: widget?.id ?? Math.random().toString(36).slice(2, 10),
      title: title.trim() || WIDGET_LABELS[type].label,
      size:
        widget?.size ??
        (type === "list" || type === "created_resolved" || type === "two_d" ? "full" : "half"),
      type,
      config: {
        ...(needs.query ? { query } : {}),
        ...(type === "breakdown" || type === "donut" || type === "two_d" ? { field } : {}),
        ...(type === "two_d" ? { field2 } : {}),
        ...(type === "list" || type === "resolved" ? { limit: Number(limit) } : {}),
        ...(type === "created_resolved" ? { days: Number(days) } : {}),
        ...(needs.project ? { projectKey } : {}),
      },
    });
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{widget ? `Edit ${widget.title}` : "Add widget"}</DialogTitle>
          <DialogDescription>
            Widgets show live data each time the dashboard opens.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="widget-type">Widget</FieldLabel>
              <Select
                value={type}
                onValueChange={(v) => setType(v as WidgetType)}
                disabled={Boolean(widget)}
              >
                <SelectTrigger id="widget-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WIDGET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {WIDGET_LABELS[t].label}
                      <span className="text-muted-foreground">
                        {" "}
                        — {WIDGET_LABELS[t].description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="widget-title">Title</FieldLabel>
              <Input
                id="widget-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={WIDGET_LABELS[type].label}
                maxLength={80}
              />
            </Field>
            {needs.query ? (
              <Field>
                <FieldLabel>Issues (TQL)</FieldLabel>
                <TqlEditor
                  value={query}
                  onChange={setQuery}
                  onSubmit={() => {}}
                  catalog={ctx.catalog}
                />
                <FieldDescription>
                  currentUser() means whoever is looking at the dashboard.
                </FieldDescription>
              </Field>
            ) : null}
            {type === "breakdown" || type === "donut" || type === "two_d" ? (
              <Field>
                <FieldLabel htmlFor="widget-field">
                  {type === "two_d" ? "Rows" : "Group by"}
                </FieldLabel>
                <Select value={field} onValueChange={(v) => setField(v as typeof field)}>
                  <SelectTrigger id="widget-field" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BREAKDOWN_FIELD_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FIELD_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {type === "two_d" ? (
              <Field>
                <FieldLabel htmlFor="widget-field2">Columns</FieldLabel>
                <Select value={field2} onValueChange={(v) => setField2(v as typeof field2)}>
                  <SelectTrigger id="widget-field2" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BREAKDOWN_FIELD_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FIELD_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {type === "list" || type === "resolved" ? (
              <Field>
                <FieldLabel htmlFor="widget-limit">Show</FieldLabel>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger id="widget-limit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["5", "10", "20"].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n} issues
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {type === "created_resolved" ? (
              <Field>
                <FieldLabel htmlFor="widget-days">Period</FieldLabel>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger id="widget-days" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["7", "14", "30", "90"].map((n) => (
                      <SelectItem key={n} value={n}>
                        Last {n} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {needs.project ? (
              <Field>
                <FieldLabel htmlFor="widget-project">Project</FieldLabel>
                <Select value={projectKey} onValueChange={setProjectKey}>
                  <SelectTrigger id="widget-project" className="w-full">
                    <SelectValue
                      placeholder={projects.length ? "Pick a project" : "No Scrum projects"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.name} ({p.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? <Spinner /> : null}
              {widget ? "Save" : "Add widget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DashboardSettingsDialog({
  ctx,
  meta,
  onClose,
}: {
  ctx: EditorContext;
  meta: { name: string; description: string; shared: boolean };
  onClose: () => void;
}) {
  const [name, setName] = useState(meta.name);
  const [description, setDescription] = useState(meta.description);
  const [shared, setShared] = useState(meta.shared);
  const update = useAction(updateDashboardAction);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await update.executeAsync({
      slug: ctx.slug,
      dashboardId: ctx.dashboardId,
      name,
      description,
      shared,
    });
    if (res?.serverError || res?.validationErrors) return;
    toast.success("Dashboard saved");
    onClose();
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dashboard settings</DialogTitle>
          <DialogDescription>
            Shared dashboards are visible to everyone in the workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <DashboardMetaFields
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            shared={shared}
            setShared={setShared}
          />
          {update.result.serverError ? (
            <FieldError className="mt-3">{update.result.serverError.message}</FieldError>
          ) : null}
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || update.isPending}>
              {update.isPending ? <Spinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardMetaFields(props: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  shared: boolean;
  setShared: (v: boolean) => void;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="dashboard-name">Name</FieldLabel>
        <Input
          id="dashboard-name"
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          maxLength={80}
          autoFocus
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="dashboard-description">Description</FieldLabel>
        <Input
          id="dashboard-description"
          value={props.description}
          onChange={(e) => props.setDescription(e.target.value)}
          maxLength={300}
        />
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="dashboard-shared">Share with the workspace</FieldLabel>
          <FieldDescription>
            Everyone can view it; only you and admins can change it.
          </FieldDescription>
        </FieldContent>
        <Switch id="dashboard-shared" checked={props.shared} onCheckedChange={props.setShared} />
      </Field>
    </FieldGroup>
  );
}

export function SharedBadge({ shared }: { shared: boolean }) {
  return shared ? (
    <Badge variant="secondary">Shared</Badge>
  ) : (
    <Badge variant="outline">Private</Badge>
  );
}
