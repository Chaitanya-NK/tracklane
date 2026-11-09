import type { OpenApiSpec } from "@/server/api/v1/openapi";
import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Schema = {
  $ref?: string;
  type?: string | string[];
  enum?: readonly string[];
  description?: string;
  format?: string;
  default?: unknown;
  example?: unknown;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: readonly string[];
};

const METHOD_TONE: Record<string, string> = {
  get: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  post: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  patch: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  delete: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const refName = (ref: string) => ref.split("/").at(-1)!;

function typeLabel(s: Schema): string {
  if (s.$ref) return refName(s.$ref);
  if (s.enum) return s.enum.map((e) => `"${e}"`).join(" | ");
  const t = Array.isArray(s.type) ? s.type.join(" | ") : (s.type ?? "any");
  if (t.startsWith("array") && s.items) return `${typeLabel(s.items)}[]`;
  return s.format ? `${t} (${s.format})` : t;
}

function Fields({ schema, spec }: { schema: Schema; spec: OpenApiSpec }) {
  const resolved = schema.$ref
    ? (spec.components.schemas as Record<string, Schema>)[refName(schema.$ref)]!
    : schema;
  const props = Object.entries(resolved.properties ?? {});
  if (!props.length) return <p className="text-sm text-muted-foreground">{typeLabel(schema)}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.map(([name, p]) => (
          <TableRow key={name}>
            <TableCell className="font-mono text-xs">
              {name}
              {resolved.required?.includes(name) ? (
                <span className="text-destructive"> *</span>
              ) : null}
            </TableCell>
            <TableCell className="max-w-56 font-mono text-xs whitespace-normal text-muted-foreground">
              {typeLabel(p)}
            </TableCell>
            <TableCell className="text-xs whitespace-normal">
              {p.description}
              {p.default !== undefined ? (
                <span className="text-muted-foreground"> Default {String(p.default)}.</span>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Renders the OpenAPI spec as a readable reference, generated from the same object the API serves. */
export function ApiReference({ spec }: { spec: OpenApiSpec }) {
  type Op = {
    tags: string[];
    summary: string;
    description?: string;
    operationId: string;
    parameters?: {
      name: string;
      in: string;
      description?: string;
      schema: Schema;
      example?: string;
    }[];
    requestBody?: { content: { "application/json": { schema: Schema } } };
    responses: Record<string, { description: string }>;
  };
  const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
    Object.entries(item as Record<string, unknown>)
      .filter(([method]) => ["get", "post", "patch", "delete"].includes(method))
      .map(([method, op]) => ({
        path,
        method,
        op: op as Op,
        pathParams: ((item as { parameters?: Op["parameters"] }).parameters ?? []) as NonNullable<
          Op["parameters"]
        >,
      })),
  );
  const base = spec.servers[0]!.url;

  return (
    <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="API sections" className="hidden lg:block">
        <ul className="sticky top-6 space-y-3 text-sm">
          <li>
            <a href="#auth" className="font-medium hover:underline">
              Authentication
            </a>
          </li>
          {spec.tags.map((tag) => (
            <li key={tag.name}>
              <p className="font-medium">{tag.name}</p>
              <ul className="mt-1 space-y-1 border-l pl-3">
                {operations
                  .filter((o) => o.op.tags.includes(tag.name))
                  .map((o) => (
                    <li key={o.op.operationId}>
                      <a
                        href={`#${slugify(o.op.operationId)}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {o.op.summary}
                      </a>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
          <li>
            <a href="#webhooks" className="font-medium hover:underline">
              Webhooks
            </a>
          </li>
        </ul>
      </nav>
      <div className="min-w-0 space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{spec.info.title}</h1>
          <Markdown className="max-w-3xl text-muted-foreground">{spec.info.description}</Markdown>
          <p className="text-sm">
            Base URL{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{base}</code> ·{" "}
            <a
              href="/api/v1/openapi.json"
              className="font-medium text-primary underline underline-offset-4"
            >
              OpenAPI 3.1 JSON
            </a>
          </p>
        </header>
        <section id="auth" className="scroll-mt-6 space-y-3">
          <h2 className="text-xl font-semibold">Authentication</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Create a token in your workspace under Settings → API tokens. Tokens are per person and
            per workspace, can be read-only, can expire, and can be revoked at any time.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs">{`curl ${base}/issues?q=assignee%20%3D%20currentUser() \\
  -H "Authorization: Bearer tl_…"`}</pre>
        </section>
        {operations.map(({ path, method, op, pathParams }) => {
          const params = [...pathParams, ...(op.parameters ?? [])];
          const body = op.requestBody?.content["application/json"].schema;
          return (
            <Card key={op.operationId} id={slugify(op.operationId)} className="scroll-mt-6">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn("font-mono uppercase", METHOD_TONE[method])}
                    variant="secondary"
                  >
                    {method}
                  </Badge>
                  <code className="font-mono text-sm">{path}</code>
                </CardTitle>
                <CardDescription className="text-base text-foreground">
                  {op.summary}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {op.description ? (
                  <Markdown className="text-muted-foreground">{op.description}</Markdown>
                ) : null}
                {params.length ? (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Parameters</h3>
                    <Table>
                      <TableBody>
                        {params.map((p) => (
                          <TableRow key={p.name}>
                            <TableCell className="w-32 font-mono text-xs">
                              {p.name} <span className="text-muted-foreground">({p.in})</span>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {typeLabel(p.schema)}
                            </TableCell>
                            <TableCell className="text-xs whitespace-normal">
                              {p.description}
                              {p.example ? (
                                <code className="mt-1 block font-mono text-[11px] text-muted-foreground">
                                  {p.example}
                                </code>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
                {body ? (
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">JSON body</h3>
                    <Fields schema={body} spec={spec} />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(op.responses).map(([code, r]) => (
                    <span key={code} className="rounded border px-2 py-0.5">
                      <span className="font-mono font-medium">{code}</span>{" "}
                      <span className="text-muted-foreground">{r.description}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Issue object</h2>
          <Fields schema={{ $ref: "#/components/schemas/Issue" }} spec={spec} />
        </section>
        <section id="webhooks" className="scroll-mt-6 space-y-3">
          <h2 className="text-xl font-semibold">Webhooks</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Admins add webhooks under Settings → Webhooks. Each delivery is a POST with a JSON body,
            an <code className="font-mono text-xs">X-Tracklane-Event</code> header, and a signature
            you should check before trusting the payload. Failed deliveries are retried after 1, 5,
            30, 120 and 360 minutes.
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.keys(spec.webhooks).map((e) => (
              <Badge key={e} variant="outline" className="font-mono">
                {e}
              </Badge>
            ))}
          </div>
          <Fields schema={{ $ref: "#/components/schemas/WebhookPayload" }} spec={spec} />
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs">{`// Node.js: verify a delivery
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`}</pre>
        </section>
      </div>
    </div>
  );
}
