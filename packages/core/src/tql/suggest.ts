import {
  BUILTIN_CONDITION_FUNCTIONS,
  customFieldDef,
  DATE_FUNCTIONS,
  type FieldDef,
  findField,
  TQL_FIELDS,
  type TqlCustomFieldSignature,
  type TqlFunctionSignature,
} from "./fields";
import { type Token, tokenize, TqlError } from "./lexer";

/** Values that exist in the workspace, for completing project/status/user/label/sprint values. */
export interface TqlCatalog {
  projects: { key: string; name: string }[];
  statuses: string[];
  users: { name: string; email: string }[];
  labels: string[];
  sprints: string[];
  /** Custom fields across the workspace's projects. */
  customFields?: TqlCustomFieldSignature[];
  /** Workspace-defined functions (Settings → TQL functions). */
  functions?: TqlFunctionSignature[];
  /** Saved filter names visible to the user, for filter("…"). */
  savedFilters?: string[];
}

export interface TqlSuggestion {
  label: string;
  /** Text inserted in place of [from, to). */
  insert: string;
  detail?: string;
  kind: "field" | "operator" | "value" | "keyword" | "function";
}

export interface TqlSuggestions {
  from: number;
  to: number;
  items: TqlSuggestion[];
}

const quote = (value: string) =>
  /^[A-Za-z0-9_\-.@+]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`;

function valueSuggestions(field: FieldDef, catalog: TqlCatalog): TqlSuggestion[] {
  const fn = (name: string): TqlSuggestion => ({
    label: `${name}()`,
    insert: `${name}()`,
    kind: "function",
  });
  const v = (label: string, insert = quote(label), detail?: string): TqlSuggestion => ({
    label,
    insert,
    detail,
    kind: "value",
  });
  const custom = (catalog.functions ?? [])
    .filter((f) => f.kind === "values" && f.valueKind === field.kind)
    .map((f) => ({ ...fn(f.name), detail: f.description || "Custom value list" }));
  const functions = [...(field.functions ?? []).map(fn), ...custom];
  switch (field.kind) {
    case "enum":
      return (field.values ?? []).map((value) =>
        v(value.replace(/_/g, " "), quote(value.replace(/_/g, " "))),
      );
    case "project":
      return catalog.projects.map((p) => v(p.key, p.key, p.name));
    case "status":
      return catalog.statuses.map((s) => v(s));
    case "user":
      return [...functions, ...catalog.users.map((u) => v(u.name, quote(u.email), u.email))];
    case "label":
      return catalog.labels.map((l) => v(l));
    case "sprint":
      return [...functions, ...catalog.sprints.map((s) => v(s))];
    case "option":
      return (field.custom?.options ?? []).map((o) => v(o));
    case "boolean":
      return [v("true"), v("false")];
    case "date":
      return [
        v("-1d", "-1d", "since yesterday"),
        v("-7d", "-7d", "in the last week"),
        v("7d", "7d", "within a week from now"),
        ...DATE_FUNCTIONS.map(fn),
      ];
    default:
      return functions;
  }
}

const savedFilterValue = (label: string): TqlSuggestion => ({
  label,
  insert: `"${label.replace(/"/g, '\\"')}")`,
  kind: "value",
});

const OPERATOR_LABEL: Record<string, string> = {
  "is empty": "IS EMPTY",
  "is not empty": "IS NOT EMPTY",
  in: "IN (…)",
  "not in": "NOT IN (…)",
};

/**
 * Suggestions for the cursor position in a TQL string. Works on incomplete input; it never
 * throws. The result's [from, to) is the partial word under the cursor that a pick replaces.
 */
export function suggestTql(input: string, cursor: number, catalog: TqlCatalog): TqlSuggestions {
  const customFields = new Map(
    (catalog.customFields ?? []).map((f) => [f.name.toLowerCase(), customFieldDef(f)]),
  );
  const resolve = (name: string) => findField(name) ?? customFields.get(name.toLowerCase());
  const before = input.slice(0, cursor);
  // The word being typed (or an unclosed quoted value).
  const quoteMatch = /(["'])([^"']*)$/.exec(before);
  const wordMatch = /[A-Za-z0-9_\-.@+:/]*$/.exec(before)!;
  const partialStart =
    quoteMatch && (before.split(quoteMatch[1]!).length - 1) % 2 === 1
      ? quoteMatch.index
      : wordMatch.index;
  const partial = before.slice(partialStart).replace(/^["']/, "").toLowerCase();

  let tokens: Token[];
  try {
    tokens = tokenize(before.slice(0, partialStart)).filter((t) => t.type !== "eof");
  } catch (error) {
    if (error instanceof TqlError) return { from: cursor, to: cursor, items: [] };
    throw error;
  }

  const filter = (items: TqlSuggestion[]) =>
    items
      .filter(
        (item) =>
          !partial ||
          item.label.toLowerCase().includes(partial) ||
          item.insert.toLowerCase().startsWith(partial),
      )
      .slice(0, 30);
  const result = (items: TqlSuggestion[]) => ({
    from: partialStart,
    to: cursor,
    items: filter(items),
  });

  const fields = (sortable = false): TqlSuggestion[] => [
    ...TQL_FIELDS.filter((f) => !sortable || f.sortable).map((f) => ({
      label: f.name,
      insert: f.name,
      detail: f.description,
      kind: "field" as const,
    })),
    ...(sortable
      ? []
      : [...customFields.values()].map((f) => ({
          label: f.custom!.name,
          insert: `"${f.custom!.name.replace(/"/g, '\\"')}"`,
          detail: f.description,
          kind: "field" as const,
        }))),
  ];
  const conditions = (): TqlSuggestion[] => [
    ...BUILTIN_CONDITION_FUNCTIONS.map((f) => ({
      label: `${f.name}("…")`,
      insert: `${f.name}("`,
      detail: f.description,
      kind: "function" as const,
    })),
    ...(catalog.functions ?? [])
      .filter((f) => f.kind === "condition")
      .map((f) => ({
        label: `${f.name}()`,
        insert: `${f.name}()`,
        detail: f.description || "Custom condition",
        kind: "function" as const,
      })),
  ];
  const kw = (...words: string[]) =>
    words.map((w) => ({ label: w, insert: w, kind: "keyword" as const }));

  const lower = (t?: Token) => t?.value.toLowerCase();
  const last = tokens.at(-1);
  const prev = tokens.at(-2);

  // ORDER BY section.
  const orderIndex = tokens.findIndex(
    (t, i) => lower(t) === "order" && lower(tokens[i + 1]) === "by",
  );
  if (orderIndex >= 0) {
    if (last && (lower(last) === "by" || last.type === "comma")) return result(fields(true));
    if (last && last.type === "word" && findField(last.value)) return result(kw("ASC", "DESC"));
    return result([{ label: ",", insert: ",", kind: "keyword" }]);
  }

  // Inside filter("…"): saved filter names.
  if (
    last?.type === "lparen" &&
    prev &&
    BUILTIN_CONDITION_FUNCTIONS.some((f) => f.name === lower(prev))
  ) {
    return result((catalog.savedFilters ?? []).map(savedFilterValue));
  }

  // Start of a condition.
  if (!last || last.type === "lparen" || ["and", "or", "not"].includes(lower(last) ?? "")) {
    if (!last || last.type !== "lparen" || !prev || !isListOperator(prev, tokens.at(-3))) {
      return result([...fields(), ...conditions(), ...kw("NOT", "ORDER BY")]);
    }
  }

  // Inside an IN (…) list: find the clause's field.
  const listField = currentListField(tokens, resolve);
  if (listField) return result(valueSuggestions(listField, catalog));

  // Right after a field name: operators.
  if (last?.type === "word" || last?.type === "string") {
    const field = resolve(last.value);
    const isValue = prev && (prev.type === "op" || ["in"].includes(lower(prev) ?? ""));
    if (field && !isValue && !(prev?.type === "word" && resolve(prev.value))) {
      return result(
        field.operators.map((op) => ({
          label: OPERATOR_LABEL[op] ?? op,
          insert: insertForOperator(op),
          kind: "operator" as const,
        })),
      );
    }
  }

  // Right after an operator: values.
  if (last?.type === "op" && prev) {
    const field = resolve(prev.value);
    if (field) return result(valueSuggestions(field, catalog));
  }

  // After "is": EMPTY / NOT EMPTY.
  if (lower(last) === "is") return result(kw("EMPTY", "NOT EMPTY"));
  if (lower(last) === "not" && lower(prev) === "is") return result(kw("EMPTY"));

  // A complete condition: connectives.
  return result(kw("AND", "OR", "ORDER BY"));
}

function insertForOperator(op: string) {
  if (op === "in" || op === "not in") return `${op.toUpperCase()} (`;
  return op.toUpperCase();
}

function isListOperator(t: Token, before?: Token) {
  return (
    t.value.toLowerCase() === "in" ||
    (t.value.toLowerCase() === "in" && before?.value.toLowerCase() === "not")
  );
}

/** If the cursor is inside "field IN (a, b, |", returns that field. */
function currentListField(
  tokens: Token[],
  resolve: (name: string) => FieldDef | undefined,
): FieldDef | undefined {
  let depth = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (t.type === "rparen") depth++;
    if (t.type === "lparen") {
      if (depth > 0) {
        depth--;
        continue;
      }
      const op = tokens[i - 1];
      if (op?.value.toLowerCase() !== "in") return undefined;
      const fieldToken =
        tokens[i - 2]?.value.toLowerCase() === "not" ? tokens[i - 3] : tokens[i - 2];
      return fieldToken ? resolve(fieldToken.value) : undefined;
    }
  }
  return undefined;
}
