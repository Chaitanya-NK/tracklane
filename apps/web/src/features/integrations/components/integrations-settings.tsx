"use client";

import { WEBHOOK_EVENT_LABELS, WEBHOOK_EVENTS } from "@tracklane/core";
import { FileUpIcon, GitBranchIcon, HashIcon, PlugIcon } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { CopySecret } from "@/features/api-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import {
  disconnectAction,
  importCsvAction,
  saveGitHubAction,
  saveSlackAction,
} from "../server/actions";

export interface IntegrationsState {
  github: {
    repo: string;
    autoTransition: boolean;
    smartCommits: boolean;
    enabled: boolean;
    webhookUrl: string;
  } | null;
  slack: {
    id: string;
    url: string;
    events: string[];
    active: boolean;
    failureCount: number;
  } | null;
}

function GitHubCard({
  slug,
  state,
  canEdit,
  webhookUrl,
}: {
  slug: string;
  state: IntegrationsState["github"];
  canEdit: boolean;
  webhookUrl: string;
}) {
  const [repo, setRepo] = useState(state?.repo ?? "");
  const [autoTransition, setAutoTransition] = useState(state?.autoTransition ?? true);
  const [smartCommits, setSmartCommits] = useState(state?.smartCommits ?? true);
  const [secret, setSecret] = useState<string | null>(null);
  const save = useAction(saveGitHubAction, {
    onSuccess: ({ data }) => {
      if (data?.secret) setSecret(data.secret);
      toast.success(state ? "GitHub settings saved" : "GitHub connected");
    },
  });
  const remove = useAction(disconnectAction, {
    onSuccess: () => toast.success("GitHub disconnected"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranchIcon className="size-4" aria-hidden="true" /> GitHub
          {state ? <Badge variant="secondary">Connected</Badge> : null}
        </CardTitle>
        <CardDescription>
          Link branches, pull requests and commits that mention an issue key. Optionally move issues
          when a PR opens or merges, and run smart commits like{" "}
          <code className="font-mono text-xs">WEB-12 #done</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="gh-repo">Repository</FieldLabel>
            <Input
              id="gh-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="acme/web"
              disabled={!canEdit}
            />
            {save.result.serverError ? (
              <FieldError>{save.result.serverError.message}</FieldError>
            ) : null}
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="gh-auto">Move issues with pull requests</FieldLabel>
              <FieldDescription>Opened → In progress, merged → Done.</FieldDescription>
            </FieldContent>
            <Switch
              id="gh-auto"
              checked={autoTransition}
              onCheckedChange={setAutoTransition}
              disabled={!canEdit}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="gh-smart">Smart commits</FieldLabel>
              <FieldDescription>
                #done, #in-progress, #comment text, #time 2h in commit messages.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="gh-smart"
              checked={smartCommits}
              onCheckedChange={setSmartCommits}
              disabled={!canEdit}
            />
          </Field>
        </FieldGroup>
        {state || secret ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Add a webhook in GitHub → Settings → Webhooks</p>
            <p className="text-muted-foreground">
              Payload URL, content type <span className="font-mono">application/json</span>, events:
              pushes, pull requests and branch creation.
            </p>
            <CopySecret value={webhookUrl} label="Payload URL" />
            {secret ? (
              <>
                <CopySecret value={secret} label="Secret (shown once)" />
                <p className="text-xs text-muted-foreground">
                  Copy it now — it won&apos;t be shown again.
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      {canEdit ? (
        <CardFooter className="gap-2">
          <Button
            disabled={save.isPending}
            onClick={() => save.execute({ slug, repo, autoTransition, smartCommits })}
          >
            {state ? "Save" : "Connect GitHub"}
          </Button>
          {state ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.execute({ slug, kind: "github" })}
            >
              Disconnect
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function SlackCard({
  slug,
  state,
  canEdit,
}: {
  slug: string;
  state: IntegrationsState["slack"];
  canEdit: boolean;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(
    state?.events ?? ["issue.created", "comment.created", "release.released"],
  );
  const save = useAction(saveSlackAction, {
    onSuccess: () => {
      setUrl("");
      toast.success("Slack notifications saved");
    },
  });
  const remove = useAction(disconnectAction, {
    onSuccess: () => toast.success("Slack disconnected"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HashIcon className="size-4" aria-hidden="true" /> Slack
          {state ? (
            <Badge variant="secondary">{state.active ? "Posting" : "Paused (failing)"}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Post updates to a channel with a Slack incoming webhook (Slack → Apps → Incoming
          WebHooks).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="slack-url">Webhook URL</FieldLabel>
            <Input
              id="slack-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={state ? state.url : "https://hooks.slack.com/services/…"}
              disabled={!canEdit}
            />
            {save.result.serverError ? (
              <FieldError>{save.result.serverError.message}</FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel>Post when</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={events.includes(e)}
                    disabled={!canEdit}
                    onCheckedChange={(on) =>
                      setEvents(on ? [...events, e] : events.filter((x) => x !== e))
                    }
                  />
                  {WEBHOOK_EVENT_LABELS[e]}
                </label>
              ))}
            </div>
          </Field>
        </FieldGroup>
      </CardContent>
      {canEdit ? (
        <CardFooter className="gap-2">
          <Button
            disabled={save.isPending}
            onClick={() => save.execute({ slug, url: url || null, events })}
          >
            {state ? "Save" : "Connect Slack"}
          </Button>
          {state ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => remove.execute({ slug, kind: "slack" })}
            >
              Disconnect
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function CsvImportCard({
  slug,
  projects,
}: {
  slug: string;
  projects: { key: string; name: string }[];
}) {
  const [projectKey, setProjectKey] = useState(projects[0]?.key ?? "");
  const [file, setFile] = useState<File | null>(null);
  const run = useAction(importCsvAction);
  const result = run.result.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUpIcon className="size-4" aria-hidden="true" /> Import from CSV
        </CardTitle>
        <CardDescription>
          Bring issues over from Jira, Trello or a spreadsheet. Columns: Summary (required),
          Description, Issue Type, Priority, Status, Assignee (email or name), Labels, Due date,
          Story points.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field className="w-56">
            <FieldLabel htmlFor="csv-project">Into project</FieldLabel>
            <Select value={projectKey} onValueChange={setProjectKey}>
              <SelectTrigger id="csv-project">
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="min-w-56 flex-1">
            <FieldLabel htmlFor="csv-file">CSV file</FieldLabel>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Button
            disabled={!file || !projectKey || run.isPending}
            onClick={async () => {
              if (!file) return;
              if (file.size > 2_000_000) return void toast.error("Files up to 2 MB");
              const res = await run.executeAsync({ slug, projectKey, csv: await file.text() });
              if (res?.serverError) toast.error(res.serverError.message);
              else if (res?.data)
                toast.success(`Imported ${res.data.created} of ${res.data.total} issues`);
            }}
          >
            {run.isPending ? "Importing…" : "Import"}
          </Button>
        </div>
        {result?.errors.length ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium">{result.errors.length} rows skipped</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.errors.slice(0, 10).map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const MORE = [
  { name: "GitLab", note: "Use the REST API and webhooks for now" },
  { name: "Figma", note: "Paste links in descriptions — they preview as links" },
  { name: "Sentry", note: "Point a Sentry webhook at the REST API to create issues" },
  { name: "Microsoft Teams", note: "Coming later" },
];

/** Settings → Integrations. */
export function IntegrationsSettings({
  slug,
  state,
  canEdit,
  projects,
  webhookUrl,
}: {
  slug: string;
  state: IntegrationsState;
  canEdit: boolean;
  projects: { key: string; name: string }[];
  webhookUrl: string;
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <GitHubCard slug={slug} state={state.github} canEdit={canEdit} webhookUrl={webhookUrl} />
      <SlackCard slug={slug} state={state.slack} canEdit={canEdit} />
      {canEdit ? <CsvImportCard slug={slug} projects={projects} /> : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugIcon className="size-4" aria-hidden="true" /> More integrations
          </CardTitle>
          <CardDescription>
            Everything else connects through the REST API and webhooks.
          </CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href="/developers">API docs</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {MORE.map((m) => (
              <li key={m.name} className="rounded-md border px-3 py-2 text-sm">
                <span className="font-medium">{m.name}</span>
                <span className="block text-xs text-muted-foreground">{m.note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
