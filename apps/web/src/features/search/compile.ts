import {
  type CustomFieldType,
  ISSUE_TYPES,
  parseIssueKey,
  parseTql,
  PRIORITIES,
  resolveDateFunction,
  resolveDateLiteral,
  type TqlExpr,
  type TqlOrder,
  type TqlParseOptions,
  type TqlQuery,
  type TqlValue,
} from "@tracklane/core";
import type { Prisma } from "@tracklane/db";

/** A custom field name across the workspace's projects (same name and type = same field for TQL). */
export interface CompileCustomField {
  type: CustomFieldType;
  fieldIds: string[];
  /** Lower-cased option value → option ids (one per project defining it). */
  options: Map<string, string[]>;
}

export interface CompileFunction {
  name: string;
  kind: "condition" | "values";
  body: string;
  values: string[];
}

export interface CompileContext {
  workspaceId: string;
  userId: string;
  now: Date;
  /** Keyed by lower-cased name. */
  functions?: Map<string, CompileFunction>;
  /** Keyed by lower-cased name. */
  customFields?: Map<string, CompileCustomField>;
  /** Saved filters the user can see, lower-cased name → query, for filter("…"). */
  savedFilters?: Map<string, string>;
  /** Used to parse function bodies and saved filters. */
  parseOptions?: TqlParseOptions;
}

/** How deep condition functions and filter() may nest. */
export const MAX_EXPANSION_DEPTH = 5;

/** Calls being expanded, outermost first, for cycle detection. */
type Stack = readonly string[];

type Where = Prisma.IssueWhereInput;
const ci = (value: string) => ({ equals: value, mode: "insensitive" as const });
const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

class CompileError extends Error {}

function literal(value: TqlValue): string {
  if (value.kind !== "literal") throw new CompileError("Expected a value");
  return value.value;
}

function issueRef(value: string): Where {
  const key = parseIssueKey(value);
  if (!key) throw new CompileError(`"${value}" isn't an issue key like WEB-12`);
  return { number: key.number, project: { key: key.projectKey } };
}

function dateValue(value: TqlValue, now: Date): { date: Date; dayOnly: boolean } {
  if (value.kind === "function")
    return { date: resolveDateFunction(value.name, now), dayOnly: false };
  const raw = literal(value);
  const date = resolveDateLiteral(raw, now);
  if (!date) throw new CompileError(`"${raw}" isn't a date`);
  return { date, dayOnly: /^\d{4}-\d{2}-\d{2}$/.test(raw) };
}

const DATE_COLUMNS = {
  created: "createdAt",
  updated: "updatedAt",
  resolved: "resolvedAt",
  due: "dueDate",
  start: "startDate",
} as const;

const SPRINT_FUNCTIONS: Record<string, Where> = {
  openSprints: { sprint: { state: { in: ["active", "planned"] } } },
  activeSprint: { sprint: { state: "active" } },
  futureSprints: { sprint: { state: "planned" } },
  closedSprints: { sprint: { state: "completed" } },
};

const RELEASE_FUNCTIONS: Record<string, Where> = {
  unreleasedVersions: { release: { status: "unreleased" } },
  releasedVersions: { release: { status: "released" } },
};

function customField(field: string, ctx: CompileContext): CompileCustomField | undefined {
  if (!field.startsWith("cf:")) return undefined;
  const def = ctx.customFields?.get(field.slice(3).toLowerCase());
  if (!def) throw new CompileError(`Unknown field "${field.slice(3)}"`);
  return def;
}

const someValue = (def: CompileCustomField, where: Prisma.IssueFieldValueWhereInput): Where => ({
  fieldValues: { some: { fieldId: { in: def.fieldIds }, ...where } },
});

const startOfDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

function customEquals(def: CompileCustomField, value: TqlValue, ctx: CompileContext): Where {
  switch (def.type) {
    case "number":
      return someValue(def, { numberValue: Number(literal(value)) });
    case "date": {
      const start = startOfDay(dateValue(value, ctx.now).date);
      return someValue(def, {
        dateValue: { gte: start, lt: new Date(start.getTime() + 86_400_000) },
      });
    }
    case "select":
    case "multiselect":
      return someValue(def, {
        optionIds: { hasSome: def.options.get(literal(value).toLowerCase()) ?? [] },
      });
    case "user":
      if (value.kind === "function") return someValue(def, { userId: ctx.userId });
      return someValue(def, {
        user: { OR: [{ email: ci(literal(value)) }, { name: ci(literal(value)) }] },
      });
    case "checkbox":
      // Unset checkboxes count as false.
      return literal(value) === "true"
        ? someValue(def, { boolValue: true })
        : { NOT: someValue(def, { boolValue: true }) };
    default:
      return someValue(def, { textValue: ci(literal(value)) });
  }
}

/** The filter for "field = value" (positive form); negation and lists are applied around it. */
function equals(field: string, value: TqlValue, ctx: CompileContext): Where {
  const custom = customField(field, ctx);
  if (custom) return customEquals(custom, value, ctx);
  switch (field) {
    case "project": {
      const v = literal(value);
      return { project: { OR: [{ key: v.toUpperCase() }, { name: ci(v) }] } };
    }
    case "key":
      return issueRef(literal(value));
    case "type": {
      const v = literal(value);
      // Built-in names match issues without a project type; other names are project types.
      return (ISSUE_TYPES as readonly string[]).includes(v)
        ? { type: v as (typeof ISSUE_TYPES)[number], customTypeId: null }
        : { customType: { name: ci(v) } };
    }
    case "release":
      if (value.kind === "function") return RELEASE_FUNCTIONS[value.name]!;
      return { release: { name: ci(literal(value)) } };
    case "statusCategory":
      return { status: { category: literal(value) as "todo" | "in_progress" | "done" } };
    case "priority":
      return { priority: literal(value) as (typeof PRIORITIES)[number] };
    case "status":
      return { status: { name: ci(literal(value)) } };
    case "assignee":
    case "reporter": {
      const idField = field === "assignee" ? "assigneeId" : "reporterId";
      if (value.kind === "function") return { [idField]: ctx.userId };
      const v = literal(value);
      return { [field]: { OR: [{ email: ci(v) }, { name: ci(v) }] } };
    }
    case "labels":
      return { labels: { some: { label: { name: ci(literal(value)) } } } };
    case "sprint":
      if (value.kind === "function") return SPRINT_FUNCTIONS[value.name]!;
      return { sprint: { name: ci(literal(value)) } };
    case "resolution":
      return { resolution: { name: ci(literal(value)) } };
    case "parent":
      return { parent: issueRef(literal(value)) };
    case "points":
      return { estimate: Number(literal(value)) };
    default: {
      if (field in DATE_COLUMNS) {
        const column = DATE_COLUMNS[field as keyof typeof DATE_COLUMNS];
        const { date } = dateValue(value, ctx.now);
        const start = new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
        );
        return { [column]: { gte: start, lt: new Date(start.getTime() + 86_400_000) } };
      }
      throw new CompileError(`${field} can't be compared with =`);
    }
  }
}

const EMPTY: Record<string, Where> = {
  assignee: { assigneeId: null },
  reporter: { reporterId: null },
  labels: { labels: { none: {} } },
  sprint: { sprintId: null },
  release: { releaseId: null },
  parent: { parentId: null },
  description: { description: "" },
  points: { estimate: null },
  resolved: { resolvedAt: null },
  resolution: { resolutionId: null },
  due: { dueDate: null },
  start: { startDate: null },
};

const RANGE_OP = { ">": "gt", ">=": "gte", "<": "lt", "<=": "lte" } as const;

function ordered(
  field: string,
  op: keyof typeof RANGE_OP,
  value: TqlValue,
  ctx: CompileContext,
): Where {
  if (value.kind === "function" && value.custom)
    throw new CompileError(`${value.name}() is a list; use it with = or IN`);
  const custom = customField(field, ctx);
  if (custom?.type === "number")
    return someValue(custom, { numberValue: { [RANGE_OP[op]]: Number(literal(value)) } });
  if (custom?.type === "date") {
    const { date, dayOnly } = dateValue(value, ctx.now);
    const bound = dayOnly ? startOfDay(date) : date;
    // Stored as dates: compare by day.
    const day =
      op === "<=" || op === ">"
        ? new Date(startOfDay(bound).getTime() + 86_400_000)
        : startOfDay(bound);
    const prismaOp = op === "<=" ? "lt" : op === ">" ? "gte" : RANGE_OP[op];
    return someValue(custom, { dateValue: { [prismaOp]: day } });
  }
  if (field === "priority") {
    const index = PRIORITIES.indexOf(literal(value) as (typeof PRIORITIES)[number]);
    const matches = PRIORITIES.filter((_, i) =>
      op === ">" ? i > index : op === ">=" ? i >= index : op === "<" ? i < index : i <= index,
    );
    return { priority: { in: [...matches] } };
  }
  if (field === "points") return { estimate: { [RANGE_OP[op]]: Number(literal(value)) } };
  if (field === "key") {
    const ref = parseIssueKey(literal(value));
    if (!ref) throw new CompileError(`"${literal(value)}" isn't an issue key like WEB-12`);
    return { project: { key: ref.projectKey }, number: { [RANGE_OP[op]]: ref.number } };
  }
  const column = DATE_COLUMNS[field as keyof typeof DATE_COLUMNS];
  const { date, dayOnly } = dateValue(value, ctx.now);
  // "due <= 2026-11-30" includes that whole day.
  const bound =
    dayOnly && (op === "<=" || op === ">") ? new Date(date.getTime() + 86_400_000) : date;
  const prismaOp = dayOnly && op === "<=" ? "lt" : dayOnly && op === ">" ? "gte" : RANGE_OP[op];
  return { [column]: { [prismaOp]: bound } };
}

/** Expands workspace value-list functions into their literal values. */
function expandValues(value: TqlValue, ctx: CompileContext): TqlValue[] {
  if (value.kind === "list") return value.items.flatMap((item) => expandValues(item, ctx));
  if (value.kind !== "function" || !value.custom) return [value];
  const fn = ctx.functions?.get(value.name.toLowerCase());
  if (!fn || fn.kind !== "values") throw new CompileError(`Unknown function ${value.name}()`);
  return fn.values.map((v) => ({ kind: "literal", value: v, quoted: true }));
}

function anyOf(field: string, value: TqlValue, ctx: CompileContext): Where {
  const values = expandValues(value, ctx);
  // An empty list matches nothing.
  if (!values.length) return { id: { in: [] } };
  if (values.length === 1) return equals(field, values[0]!, ctx);
  return { OR: values.map((item) => equals(field, item, ctx)) };
}

/** Expands a condition function or filter("…") into the query it stands for. */
function compileCall(
  expr: Extract<TqlExpr, { type: "call" }>,
  ctx: CompileContext,
  stack: Stack,
): Where {
  const label = expr.builtin ? `filter("${expr.arg}")` : `${expr.name}()`;
  const id = expr.builtin ? `filter:${expr.arg!.toLowerCase()}` : `fn:${expr.name.toLowerCase()}`;
  if (stack.includes(id)) {
    throw new CompileError(
      `${label} refers back to itself (${[...stack, id].map((s) => s.split(":")[1]).join(" → ")})`,
    );
  }
  if (stack.length >= MAX_EXPANSION_DEPTH) {
    throw new CompileError(
      `Functions and filters nest more than ${MAX_EXPANSION_DEPTH} levels deep at ${label}`,
    );
  }
  let body: string | undefined;
  if (expr.builtin) {
    body = ctx.savedFilters?.get(expr.arg!.toLowerCase());
    if (body === undefined) throw new CompileError(`No saved filter named "${expr.arg}"`);
  } else {
    const fn = ctx.functions?.get(expr.name.toLowerCase());
    if (!fn || fn.kind !== "condition") throw new CompileError(`Unknown function ${label}`);
    body = fn.body;
  }
  const parsed = parseTql(body, ctx.parseOptions);
  if (!parsed.ok) throw new CompileError(`In ${label}: ${parsed.error.message}`);
  // ORDER BY inside a function or saved filter is ignored; the outer query decides the order.
  return parsed.query.where ? compileExpr(parsed.query.where, ctx, [...stack, id]) : {};
}

function compileExpr(expr: TqlExpr, ctx: CompileContext, stack: Stack = []): Where {
  switch (expr.type) {
    case "and":
      return { AND: [compileExpr(expr.left, ctx, stack), compileExpr(expr.right, ctx, stack)] };
    case "or":
      return { OR: [compileExpr(expr.left, ctx, stack), compileExpr(expr.right, ctx, stack)] };
    case "not":
      return { NOT: compileExpr(expr.expr, ctx, stack) };
    case "call":
      return compileCall(expr, ctx, stack);
    case "clause": {
      const { field, op, value } = expr;
      switch (op) {
        case "=":
        case "in":
          return anyOf(field, value, ctx);
        case "!=":
        case "not in":
          return { NOT: anyOf(field, value, ctx) };
        case "is empty":
        case "is not empty": {
          const custom = customField(field, ctx);
          const empty = custom ? { NOT: someValue(custom, {}) } : EMPTY[field];
          if (!empty) throw new CompileError(`${field} can't be empty`);
          return op === "is empty" ? empty : { NOT: empty };
        }
        case "~":
        case "!~": {
          const text = literal(value);
          const custom = customField(field, ctx);
          const match: Where = custom
            ? someValue(custom, { textValue: contains(text) })
            : field === "text"
              ? { OR: [{ title: contains(text) }, { description: contains(text) }] }
              : field === "summary"
                ? { title: contains(text) }
                : { description: contains(text) };
          return op === "~" ? match : { NOT: match };
        }
        default:
          return ordered(field, op, value, ctx);
      }
    }
  }
}

const ORDER: Record<string, (dir: "asc" | "desc") => Prisma.IssueOrderByWithRelationInput[]> = {
  project: (d) => [{ project: { key: d } }],
  key: (d) => [{ project: { key: d } }, { number: d }],
  type: (d) => [{ type: d }],
  status: (d) => [{ status: { position: d } }],
  priority: (d) => [{ priority: d }],
  assignee: (d) => [{ assignee: { name: d } }],
  reporter: (d) => [{ reporter: { name: d } }],
  summary: (d) => [{ title: d }],
  created: (d) => [{ createdAt: d }],
  updated: (d) => [{ updatedAt: d }],
  resolved: (d) => [{ resolvedAt: { sort: d, nulls: "last" } }],
  due: (d) => [{ dueDate: { sort: d, nulls: "last" } }],
  start: (d) => [{ startDate: { sort: d, nulls: "last" } }],
  points: (d) => [{ estimate: { sort: d, nulls: "last" } }],
};

export type CompileResult =
  | { ok: true; where: Where; orderBy: Prisma.IssueOrderByWithRelationInput[] }
  | { ok: false; message: string };

/** TQL AST → Prisma filter, always scoped to the workspace. */
export function compileTql(query: TqlQuery, ctx: CompileContext): CompileResult {
  try {
    const filter = query.where ? compileExpr(query.where, ctx) : null;
    const where: Where = filter
      ? { AND: [{ workspaceId: ctx.workspaceId }, filter] }
      : { workspaceId: ctx.workspaceId };
    const orderBy = query.orderBy.length
      ? query.orderBy.flatMap((o: TqlOrder) => ORDER[o.field]?.(o.direction) ?? [])
      : [{ updatedAt: "desc" as const }];
    return { ok: true, where, orderBy: [...orderBy, { id: "asc" }] };
  } catch (error) {
    if (error instanceof CompileError) return { ok: false, message: error.message };
    throw error;
  }
}
