"use client";

import { PRIORITIES, PRIORITY_LABELS, type TqlCatalog } from "@tracklane/core";
import { BotIcon, MoreHorizontalIcon, PlusIcon, XIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TqlEditor } from "@/features/search";
import {
  ACTION_LABELS,
  AUTOMATION_TRIGGERS,
  type AutomationAction,
  type AutomationTrigger,
  TRIGGER_LABELS,
} from "../rules";
import { deleteRuleAction, saveRuleAction, setRuleEnabledAction } from "../server/actions";

export interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  toStatusId: string | null;
  condition: string;
  actions: AutomationAction[];
  lastRun: { status: string; createdAt: Date } | null;
}

export interface RunRow {
  id: string;
  status: "success" | "skipped" | "failed";
  message: string;
  createdAt: Date;
  ruleName: string;
  issueKey: string | null;
}

interface Options {
  statuses: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  people: { id: string; name: string }[];
  catalog: TqlCatalog;
}

function describeAction(a: AutomationAction, o: Options) {
  switch (a.type) {
    case "set_assignee":
      return a.to === "reporter"
        ? "Assign to the reporter"
        : a.to === "none"
          ? "Unassign"
          : `Assign to ${o.people.find((p) => p.id === a.to)?.name ?? "someone"}`;
    case "set_priority":
      return `Set priority to ${PRIORITY_LABELS[a.priority]}`;
    case "transition":
      return `Move to ${o.statuses.find((s) => s.id === a.statusId)?.name ?? "a status"}`;
    case "add_label":
      return `Add label ${o.labels.find((l) => l.id === a.labelId)?.name ?? ""}`;
    case "add_comment":
      return "Add a comment";
    case "notify":
      return `Notify the ${a.to}`;
  }
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** "When an issue is created and it matches `…`: assign to Priya Raman, add a comment." */
function describeRule(rule: RuleRow, o: Options) {
  const daily = rule.trigger === "scheduled_daily";
  const when = daily
    ? "Every day at 06:00 UTC"
    : `When ${lowerFirst(TRIGGER_LABELS[rule.trigger])}${
        rule.trigger === "status_changed" && rule.toStatusId
          ? ` to ${o.statuses.find((s) => s.id === rule.toStatusId)?.name ?? "a status"}`
          : ""
      }`;
  return (
    <>
      {when}
      {rule.condition ? (
        <>
          {daily ? ", for issues matching " : " and it matches "}
          <code className="font-mono text-xs">{rule.condition}</code>
        </>
      ) : null}
      : {rule.actions.map((a) => lowerFirst(describeAction(a, o))).join(", ")}.
    </>
  );
}

export function AutomationManager({
  slug,
  projectKey,
  rules,
  runs,
  options,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  rules: RuleRow[];
  runs: RunRow[];
  options: Options;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<RuleRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<RuleRow | null>(null);
  const toggle = useAction(setRuleEnabledAction);
  const remove = useAction(deleteRuleAction);

  return (
    <div className="max-w-4xl space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Automation</h2>
            <p className="text-sm text-muted-foreground">
              When something happens and the issue matches a condition, do something. Rules act as
              the person who last saved them, and changes they make don&apos;t trigger other rules.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={() => setEditing("new")}>
              <PlusIcon />
              New rule
            </Button>
          ) : null}
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={BotIcon}
            title="No rules yet"
            description="For example: when a bug is created with priority Highest, assign it to the project lead and notify the watchers."
          />
        ) : (
          <ul className="divide-y rounded-lg border">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-3 p-3">
                <Switch
                  checked={rule.enabled}
                  disabled={!canEdit}
                  aria-label={`${rule.name} enabled`}
                  onCheckedChange={async (enabled) => {
                    const res = await toggle.executeAsync({
                      slug,
                      projectKey,
                      ruleId: rule.id,
                      enabled,
                    });
                    if (res?.serverError) toast.error(res.serverError.message);
                    else toast.success(enabled ? `${rule.name} is on` : `${rule.name} is off`);
                  }}
                />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-muted-foreground">{describeRule(rule, options)}</p>
                  {rule.lastRun ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Last ran <TimeAgo date={rule.lastRun.createdAt} /> · {rule.lastRun.status}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Actions for ${rule.name}`}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(rule)}>Edit</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(rule)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has run yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeAgo date={run.createdAt} />
                    </TableCell>
                    <TableCell>{run.ruleName}</TableCell>
                    <TableCell className="font-mono text-xs">{run.issueKey ?? "—"}</TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge
                        variant={
                          run.status === "failed"
                            ? "destructive"
                            : run.status === "skipped"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {run.status}
                      </Badge>{" "}
                      <span className="text-xs text-muted-foreground">{run.message}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {editing ? (
        <RuleDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          projectKey={projectKey}
          rule={editing === "new" ? undefined : editing}
          options={options}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Its run history is deleted too."
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await remove.executeAsync({ slug, projectKey, ruleId: deleting.id });
          if (res?.serverError) return void toast.error(res.serverError.message);
          toast.success(`Deleted ${deleting.name}`);
          setDeleting(null);
        }}
      />
    </div>
  );
}

const blankAction = (type: AutomationAction["type"], o: Options): AutomationAction => {
  switch (type) {
    case "set_assignee":
      return { type, to: "reporter" };
    case "set_priority":
      return { type, priority: "high" };
    case "transition":
      return { type, statusId: o.statuses[0]?.id ?? "" };
    case "add_label":
      return { type, labelId: o.labels[0]?.id ?? "" };
    case "add_comment":
      return { type, body: "" };
    case "notify":
      return { type, to: "assignee", message: "" };
  }
};

function RuleDialog({
  slug,
  projectKey,
  rule,
  options,
  onClose,
}: {
  slug: string;
  projectKey: string;
  rule?: RuleRow;
  options: Options;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [trigger, setTrigger] = useState<AutomationTrigger>(rule?.trigger ?? "issue_created");
  const [toStatusId, setToStatusId] = useState(rule?.toStatusId ?? "any");
  const [condition, setCondition] = useState(rule?.condition ?? "");
  const [actions, setActions] = useState<AutomationAction[]>(
    rule?.actions ?? [blankAction("set_assignee", options)],
  );
  const save = useAction(saveRuleAction);
  const error = save.result.serverError;
  const setAction = (i: number, next: AutomationAction) =>
    setActions((list) => list.map((a, j) => (j === i ? next : a)));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await save.executeAsync({
      slug,
      projectKey,
      ruleId: rule?.id ?? null,
      rule: {
        name,
        trigger,
        toStatusId: toStatusId === "any" ? null : toStatusId,
        condition,
        actions,
      },
    });
    if (res?.validationErrors) return void toast.error("Fill in every action");
    if (!res?.data) return;
    toast.success(rule ? `Saved ${res.data.name}` : `Created ${res.data.name}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? `Edit ${rule.name}` : "New automation rule"}</DialogTitle>
          <DialogDescription>
            When this happens, and the issue matches, do these things in order.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rule-name">Name</FieldLabel>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
                placeholder="Triage urgent bugs"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rule-trigger">When</FieldLabel>
                <Select value={trigger} onValueChange={(v) => setTrigger(v as AutomationTrigger)}>
                  <SelectTrigger id="rule-trigger" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOMATION_TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TRIGGER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {trigger === "status_changed" ? (
                <Field>
                  <FieldLabel htmlFor="rule-to">To status</FieldLabel>
                  <Select value={toStatusId} onValueChange={setToStatusId}>
                    <SelectTrigger id="rule-to" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any status</SelectItem>
                      {options.statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
            <Field data-invalid={error?.field === "condition" || undefined}>
              <FieldLabel>If the issue matches (optional)</FieldLabel>
              <TqlEditor
                value={condition}
                onChange={setCondition}
                onSubmit={() => {}}
                catalog={options.catalog}
              />
              <FieldDescription>
                TQL, e.g. type = bug AND priority = highest. Required for daily rules.
              </FieldDescription>
              {error?.field === "condition" ? <FieldError>{error.message}</FieldError> : null}
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Then</FieldLegend>
              <ol className="space-y-2">
                {actions.map((action, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-2 rounded-md border p-2">
                    <Select
                      value={action.type}
                      onValueChange={(t) =>
                        setAction(i, blankAction(t as AutomationAction["type"], options))
                      }
                    >
                      <SelectTrigger size="sm" className="w-44" aria-label={`Action ${i + 1}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ACTION_LABELS) as AutomationAction["type"][]).map((t) => (
                          <SelectItem key={t} value={t}>
                            {ACTION_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="min-w-48 flex-1">
                      <ActionParams
                        action={action}
                        options={options}
                        onChange={(next) => setAction(i, next)}
                        index={i}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Remove action ${i + 1}`}
                      disabled={actions.length === 1}
                      onClick={() => setActions((list) => list.filter((_, j) => j !== i))}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ol>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={actions.length >= 10}
                onClick={() => setActions((list) => [...list, blankAction("add_comment", options)])}
              >
                <PlusIcon />
                Add action
              </Button>
            </FieldSet>
            {error && error.field !== "condition" ? <FieldError>{error.message}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {rule ? "Save rule" : "Create rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActionParams({
  action,
  options,
  onChange,
  index,
}: {
  action: AutomationAction;
  options: Options;
  onChange: (a: AutomationAction) => void;
  index: number;
}) {
  const select = (
    value: string,
    set: (v: string) => void,
    items: { value: string; label: string }[],
    label: string,
  ) => (
    <Select value={value} onValueChange={set}>
      <SelectTrigger size="sm" className="w-full" aria-label={label}>
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  switch (action.type) {
    case "set_assignee":
      return select(
        action.to,
        (to) => onChange({ ...action, to }),
        [
          { value: "reporter", label: "The reporter" },
          { value: "none", label: "Nobody (unassign)" },
          ...options.people.map((p) => ({ value: p.id, label: p.name })),
        ],
        `Action ${index + 1} assignee`,
      );
    case "set_priority":
      return select(
        action.priority,
        (priority) => onChange({ ...action, priority: priority as typeof action.priority }),
        [...PRIORITIES].reverse().map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
        `Action ${index + 1} priority`,
      );
    case "transition":
      return select(
        action.statusId,
        (statusId) => onChange({ ...action, statusId }),
        options.statuses.map((s) => ({ value: s.id, label: s.name })),
        `Action ${index + 1} status`,
      );
    case "add_label":
      return select(
        action.labelId,
        (labelId) => onChange({ ...action, labelId }),
        options.labels.map((l) => ({ value: l.id, label: l.name })),
        `Action ${index + 1} label`,
      );
    case "add_comment":
      return (
        <Textarea
          rows={2}
          value={action.body}
          onChange={(e) => onChange({ ...action, body: e.target.value })}
          placeholder="Comment text (Markdown)"
          aria-label={`Action ${index + 1} comment`}
        />
      );
    case "notify":
      return (
        <div className="space-y-2">
          {select(
            action.to,
            (to) => onChange({ ...action, to: to as typeof action.to }),
            [
              { value: "assignee", label: "The assignee" },
              { value: "reporter", label: "The reporter" },
              { value: "watchers", label: "Everyone watching" },
            ],
            `Action ${index + 1} recipients`,
          )}
          <Input
            value={action.message}
            onChange={(e) => onChange({ ...action, message: e.target.value })}
            placeholder="Message"
            aria-label={`Action ${index + 1} message`}
            maxLength={300}
          />
        </div>
      );
  }
}
