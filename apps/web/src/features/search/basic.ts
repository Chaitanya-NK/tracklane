import { parseTql, type TqlExpr, type TqlParseOptions, type TqlValue } from "@tracklane/core";

/** Fields the Basic (visual) builder can edit. Each is "field IN (values)". */
export const BASIC_FIELDS = [
  "project",
  "type",
  "status",
  "assignee",
  "priority",
  "labels",
] as const;
export type BasicField = (typeof BASIC_FIELDS)[number];

/** Special values the builder shows as choices; stored in TQL as written here. */
export const CURRENT_USER = "currentUser()";
export const EMPTY = "EMPTY";

export interface BasicQuery {
  values: Record<BasicField, string[]>;
  text: string;
  /** ORDER BY clause kept as written ("" when none). */
  orderBy: string;
}

export const emptyBasic = (): BasicQuery => ({
  values: { project: [], type: [], status: [], assignee: [], priority: [], labels: [] },
  text: "",
  orderBy: "",
});

const quote = (value: string) =>
  value === CURRENT_USER || value === EMPTY || /^[A-Za-z0-9_\-.@+]+$/.test(value)
    ? value
    : `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Builds TQL from builder state. */
export function basicToTql(basic: BasicQuery): string {
  const parts: string[] = [];
  for (const field of BASIC_FIELDS) {
    const values = basic.values[field];
    if (values.length === 0) continue;
    const hasEmpty = values.includes(EMPTY);
    const rest = values.filter((v) => v !== EMPTY).map(quote);
    const clauses = [
      ...(rest.length === 1 ? [`${field} = ${rest[0]}`] : []),
      ...(rest.length > 1 ? [`${field} IN (${rest.join(", ")})`] : []),
      ...(hasEmpty ? [`${field} IS EMPTY`] : []),
    ];
    parts.push(clauses.length > 1 ? `(${clauses.join(" OR ")})` : clauses[0]!);
  }
  if (basic.text.trim()) parts.push(`text ~ ${quote(basic.text.trim())}`);
  const where = parts.join(" AND ");
  const order = basic.orderBy.trim();
  return [where, order ? `ORDER BY ${order}` : ""].filter(Boolean).join(" ");
}

function valuesOf(value: TqlValue): string[] | null {
  if (value.kind === "literal") return [value.value];
  if (value.kind === "function") return value.name === "currentUser" ? [CURRENT_USER] : null;
  if (value.kind === "list") {
    const out: string[] = [];
    for (const item of value.items) {
      const inner = valuesOf(item);
      if (!inner) return null;
      out.push(...inner);
    }
    return out;
  }
  return null;
}

/** "field = x", "field IN (…)" or "field IS EMPTY" on a basic field → [field, values]. */
function clauseValues(expr: TqlExpr): [BasicField, string[]] | null {
  if (expr.type !== "clause") return null;
  const field = BASIC_FIELDS.find((f) => f === expr.field);
  if (!field) return null;
  if (expr.op === "is empty") return [field, [EMPTY]];
  if (expr.op !== "=" && expr.op !== "in") return null;
  const values = valuesOf(expr.value);
  return values ? [field, values] : null;
}

/**
 * Reads TQL back into builder state, or null when the query uses anything the builder can't
 * show (OR across fields, NOT, other fields, functions…) — then only TQL mode can edit it.
 */
export function tqlToBasic(query: string, options?: TqlParseOptions): BasicQuery | null {
  if (!query.trim()) return emptyBasic();
  const parsed = parseTql(query, options);
  if (!parsed.ok) return null;
  const basic = emptyBasic();
  const seen = new Set<string>();

  const visit = (expr: TqlExpr): boolean => {
    if (expr.type === "and") return visit(expr.left) && visit(expr.right);
    if (expr.type === "or") {
      // Only "field IN (…) OR field IS EMPTY" for the same field.
      const left = clauseValues(expr.left);
      const right = clauseValues(expr.right);
      if (!left || !right || left[0] !== right[0] || seen.has(left[0])) return false;
      seen.add(left[0]);
      basic.values[left[0]] = [...left[1], ...right[1]];
      return true;
    }
    if (expr.type === "clause" && expr.field === "text" && expr.op === "~") {
      if (expr.value.kind !== "literal" || seen.has("text")) return false;
      seen.add("text");
      basic.text = expr.value.value;
      return true;
    }
    const clause = clauseValues(expr);
    if (!clause || seen.has(clause[0])) return false;
    seen.add(clause[0]);
    basic.values[clause[0]] = clause[1];
    return true;
  };

  if (parsed.query.where && !visit(parsed.query.where)) return null;
  basic.orderBy = parsed.query.orderBy
    .map((o) => `${o.field} ${o.direction.toUpperCase()}`)
    .join(", ");
  return basic;
}
