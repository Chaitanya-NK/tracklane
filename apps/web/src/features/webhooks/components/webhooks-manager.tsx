"use client";

import { WEBHOOK_EVENT_LABELS, WEBHOOK_EVENTS } from "@tracklane/core";
import {
  ChevronDownIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCwIcon,
  WebhookIcon,
} from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeAgo } from "@/components/shared/time-ago";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { CopySecret } from "@/features/api-tokens";
import {
  createWebhookAction,
  deleteWebhookAction,
  pingWebhookAction,
  redeliverAction,
  rotateWebhookSecretAction,
  updateWebhookAction,
} from "../server/actions";
import type { WebhookItem } from "../server/service";

export function WebhooksManager({ slug, hooks }: { slug: string; hooks: WebhookItem[] }) {
  const [editing, setEditing] = useState<WebhookItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<WebhookItem | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const update = useAction(updateWebhookAction);
  const remove = useAction(deleteWebhookAction);
  const ping = useAction(pingWebhookAction);
  const rotate = useAction(rotateWebhookSecretAction);
  const resend = useAction(redeliverAction);

  return (
    <section className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Tracklane POSTs JSON to your URL when things happen, signed with the hook&apos;s secret
            in the
            <code className="mx-1 font-mono text-xs">X-Tracklane-Signature</code>header. Failed
            deliveries are retried for about 9 hours.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          New webhook
        </Button>
      </div>
      {hooks.length === 0 ? (
        <EmptyState
          icon={WebhookIcon}
          title="No webhooks"
          description="Send issue and sprint events to Slack bots, CI, or your own services."
        />
      ) : (
        <ul className="space-y-3">
          {hooks.map((hook) => (
            <li key={hook.id} className="rounded-lg border">
              <div className="flex items-start gap-3 p-3">
                <Switch
                  checked={hook.active}
                  aria-label={`${hook.url} active`}
                  onCheckedChange={async (active) => {
                    const res = await update.executeAsync({
                      slug,
                      id: hook.id,
                      url: hook.url,
                      events: hook.events,
                      active,
                    });
                    if (res?.serverError) toast.error(res.serverError.message);
                  }}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-mono text-sm">{hook.url}</p>
                  <div className="flex flex-wrap gap-1">
                    {hook.events.map((e) => (
                      <Badge key={e} variant="outline" className="font-mono text-[11px]">
                        {e}
                      </Badge>
                    ))}
                  </div>
                  {!hook.active && hook.failureCount >= 20 ? (
                    <p className="text-xs text-destructive">
                      Switched off after {hook.failureCount} failed deliveries in a row.
                    </p>
                  ) : null}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Actions for ${hook.url}`}
                    >
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(hook)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={async () => {
                        const res = await ping.executeAsync({ slug, id: hook.id });
                        if (res?.serverError) toast.error(res.serverError.message);
                        else toast.success("Ping queued. It's sent within a minute.");
                      }}
                    >
                      Send test ping
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={async () => {
                        const res = await rotate.executeAsync({ slug, id: hook.id });
                        if (res?.serverError) toast.error(res.serverError.message);
                        else if (res?.data) setSecret(res.data.secret);
                      }}
                    >
                      Rotate secret
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(hook)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="group w-full justify-start rounded-t-none border-t text-muted-foreground"
                  >
                    <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" />
                    Recent deliveries ({hook.deliveries.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {hook.deliveries.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Attempts</TableHead>
                          <TableHead>When</TableHead>
                          <TableHead className="w-0" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hook.deliveries.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-mono text-xs">{d.event}</TableCell>
                            <TableCell className="whitespace-normal">
                              <Badge
                                variant={
                                  d.status === "delivered"
                                    ? "secondary"
                                    : d.status === "failed"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {d.status === "pending" && d.attempts ? "retrying" : d.status}
                              </Badge>{" "}
                              <span className="text-xs text-muted-foreground">
                                {d.responseStatus ? `HTTP ${d.responseStatus}` : ""}
                                {d.error && !d.error.startsWith("HTTP") ? ` ${d.error}` : ""}
                              </span>
                            </TableCell>
                            <TableCell className="tabular-nums">{d.attempts}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <TimeAgo date={d.createdAt} />
                            </TableCell>
                            <TableCell>
                              {d.status !== "pending" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  aria-label="Send again"
                                  onClick={async () => {
                                    const res = await resend.executeAsync({
                                      slug,
                                      deliveryId: d.id,
                                    });
                                    if (res?.serverError) toast.error(res.serverError.message);
                                    else toast.success("Queued again");
                                  }}
                                >
                                  <RotateCwIcon />
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">Nothing sent yet.</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <WebhookDialog
          key={editing === "new" ? "new" : editing.id}
          slug={slug}
          hook={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onCreated={setSecret}
        />
      ) : null}
      <Dialog open={secret !== null} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Signing secret</DialogTitle>
            <DialogDescription>
              Shown once. Use it to check the X-Tracklane-Signature header on each request.
            </DialogDescription>
          </DialogHeader>
          {secret ? <CopySecret value={secret} label="Signing secret" /> : null}
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this webhook?"
        description={deleting?.url}
        pending={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await remove.executeAsync({ slug, id: deleting.id });
          if (res?.serverError) return void toast.error(res.serverError.message);
          toast.success("Webhook deleted");
          setDeleting(null);
        }}
      />
    </section>
  );
}

function WebhookDialog({
  slug,
  hook,
  onClose,
  onCreated,
}: {
  slug: string;
  hook?: WebhookItem;
  onClose: () => void;
  onCreated: (secret: string) => void;
}) {
  const [url, setUrl] = useState(hook?.url ?? "");
  const [events, setEvents] = useState<string[]>(
    hook?.events ?? ["issue.created", "issue.updated"],
  );
  const create = useAction(createWebhookAction);
  const update = useAction(updateWebhookAction);
  const error = (hook ? update : create).result.serverError;
  const pending = create.isPending || update.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (hook) {
      const res = await update.executeAsync({
        slug,
        id: hook.id,
        url,
        events,
        active: hook.active,
      });
      if (res?.serverError) return;
      toast.success("Webhook saved");
      onClose();
    } else {
      const res = await create.executeAsync({ slug, url, events });
      if (!res?.data) return;
      onClose();
      onCreated(res.data.secret);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{hook ? "Edit webhook" : "New webhook"}</DialogTitle>
          <DialogDescription>
            Any 2xx response counts as delivered. Respond within 10 seconds.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={error?.field === "url" || undefined}>
              <FieldLabel htmlFor="hook-url">Payload URL</FieldLabel>
              <Input
                id="hook-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/tracklane"
                autoFocus
                inputMode="url"
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Events</FieldLegend>
              <div className="grid gap-2 sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={events.includes(e)}
                      onCheckedChange={(on) =>
                        setEvents((list) => (on ? [...list, e] : list.filter((x) => x !== e)))
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-mono text-xs">{e}</span>
                      <span className="text-xs text-muted-foreground">
                        {WEBHOOK_EVENT_LABELS[e]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <FieldDescription>
                Payloads include the full issue, so receivers rarely need to call back.
              </FieldDescription>
            </FieldSet>
            {error ? <FieldError>{error.message}</FieldError> : null}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || !events.length || pending}>
              {pending ? <Spinner /> : null}
              {hook ? "Save" : "Create webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
