import {
  parseIssueKey,
  PRIORITIES,
  resolveDateFunction,
  resolveDateLiteral,
  type TqlExpr,
  type TqlOrder,
  type TqlQuery,
  type TqlValue,
} from "@tracklane/core";
import type { Prisma } from "@tracklane/db";

export interface CompileContext {
  workspaceId: string;
  userId: string;
  now: Date;
}

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

/** The filter for "field = value" (positive form); negation and lists are applied around it. */
function equals(field: string, value: TqlValue, ctx: CompileContext): Where {
  switch (field) {
    case "project": {
      const v = literal(value);
      return { project: { OR: [{ key: v.toUpperCase() }, { name: ci(v) }] } };
    }
    case "key":
      return issueRef(literal(value));
    case "type":
      return { type: literal(value) as Prisma.EnumIssueTypeFilter["equals"] };
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
  parent: { parentId: null },
  description: { description: "" },
  points: { estimate: null },
  resolved: { resolvedAt: null },
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

function compileExpr(expr: TqlExpr, ctx: CompileContext): Where {
  switch (expr.type) {
    case "and":
      return { AND: [compileExpr(expr.left, ctx), compileExpr(expr.right, ctx)] };
    case "or":
      return { OR: [compileExpr(expr.left, ctx), compileExpr(expr.right, ctx)] };
    case "not":
      return { NOT: compileExpr(expr.expr, ctx) };
    case "clause": {
      const { field, op, value } = expr;
      switch (op) {
        case "=":
          return equals(field, value, ctx);
        case "!=":
          return { NOT: equals(field, value, ctx) };
        case "in":
        case "not in": {
          if (value.kind !== "list") throw new CompileError("Expected a list");
          const any: Where = { OR: value.items.map((item) => equals(field, item, ctx)) };
          return op === "in" ? any : { NOT: any };
        }
        case "is empty":
        case "is not empty": {
          const empty = EMPTY[field];
          if (!empty) throw new CompileError(`${field} can't be empty`);
          return op === "is empty" ? empty : { NOT: empty };
        }
        case "~":
        case "!~": {
          const text = literal(value);
          const match: Where =
            field === "text"
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
