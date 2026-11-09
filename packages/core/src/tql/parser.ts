import type { TqlExpr, TqlOrder, TqlQuery, TqlValue } from "./ast";
import { isDateLiteral } from "./dates";
import {
  BUILTIN_CONDITION_FUNCTIONS,
  customFieldDef,
  type FieldDef,
  findField,
  type Operator,
  TQL_FIELDS,
  type TqlParseOptions,
} from "./fields";
import { type Token, tokenize, TqlError } from "./lexer";

const KEYWORDS = new Set([
  "and",
  "or",
  "not",
  "in",
  "is",
  "empty",
  "null",
  "order",
  "by",
  "asc",
  "desc",
]);

class Parser {
  private i = 0;
  private readonly customFields: Map<string, FieldDef>;
  constructor(
    private readonly tokens: Token[],
    private readonly options: TqlParseOptions = {},
  ) {
    this.customFields = new Map(
      (options.customFields ?? []).map((f) => [f.name.toLowerCase(), customFieldDef(f)]),
    );
  }

  private peek(offset = 0) {
    return this.tokens[Math.min(this.i + offset, this.tokens.length - 1)]!;
  }
  private next() {
    return this.tokens[this.i++]!;
  }
  private isWord(word: string, offset = 0) {
    const t = this.peek(offset);
    return t.type === "word" && t.value.toLowerCase() === word;
  }
  private expectWord(word: string) {
    if (!this.isWord(word)) {
      const t = this.peek();
      throw new TqlError(`Expected ${word.toUpperCase()}`, t.start, t.end);
    }
    return this.next();
  }

  parse(): TqlQuery {
    let where: TqlExpr | null = null;
    if (this.peek().type !== "eof" && !this.isWord("order")) where = this.or();
    const orderBy: TqlOrder[] = [];
    if (this.isWord("order")) {
      this.next();
      this.expectWord("by");
      do {
        const t = this.next();
        if (t.type !== "word") throw new TqlError("Expected a field to sort by", t.start, t.end);
        const field = this.field(t);
        if (!field.sortable) throw new TqlError(`Can't sort by ${field.name}`, t.start, t.end);
        let direction: "asc" | "desc" = "asc";
        if (this.isWord("asc") || this.isWord("desc"))
          direction = this.next().value.toLowerCase() as "asc" | "desc";
        orderBy.push({ field: field.name, direction });
      } while (this.peek().type === "comma" && this.next());
    }
    const t = this.peek();
    if (t.type !== "eof") {
      throw new TqlError(
        where ? `Expected AND, OR or ORDER BY, found "${t.value}"` : `Unexpected "${t.value}"`,
        t.start,
        t.end,
      );
    }
    return { where, orderBy };
  }

  private or(): TqlExpr {
    let left = this.and();
    while (this.isWord("or")) {
      this.next();
      left = { type: "or", left, right: this.and() };
    }
    return left;
  }

  private and(): TqlExpr {
    let left = this.not();
    while (this.isWord("and")) {
      this.next();
      left = { type: "and", left, right: this.not() };
    }
    return left;
  }

  private not(): TqlExpr {
    if (this.isWord("not")) {
      this.next();
      return { type: "not", expr: this.not() };
    }
    return this.primary();
  }

  private primary(): TqlExpr {
    const t = this.peek();
    if (t.type === "lparen") {
      this.next();
      const expr = this.or();
      const close = this.next();
      if (close.type !== "rparen")
        throw new TqlError("Missing closing parenthesis", close.start, close.end);
      return expr;
    }
    if (t.type === "eof")
      throw new TqlError("Expected a condition, e.g. status = Done", t.start, t.end);
    if (t.type !== "word" && t.type !== "string")
      throw new TqlError(`Expected a field name, found "${t.value}"`, t.start, t.end);
    this.next();
    if (t.type === "word" && this.peek().type === "lparen") return this.call(t);
    return this.clause(this.field(t));
  }

  /** A condition function call: name() or filter("Saved filter"). */
  private call(t: Token): TqlExpr {
    this.next(); // (
    let arg: string | undefined;
    if (this.peek().type === "string" || this.peek().type === "word") arg = this.next().value;
    const close = this.next();
    if (close.type !== "rparen")
      throw new TqlError("Missing closing parenthesis", close.start, close.end);
    const builtin = BUILTIN_CONDITION_FUNCTIONS.find(
      (f) => f.name.toLowerCase() === t.value.toLowerCase(),
    );
    if (builtin) {
      if (!arg)
        throw new TqlError(
          `${builtin.name}() needs a name, e.g. ${builtin.name}("Open bugs")`,
          t.start,
          close.end,
        );
      return { type: "call", name: builtin.name, arg, builtin: true };
    }
    const custom = this.options.functions?.find(
      (f) => f.kind === "condition" && f.name.toLowerCase() === t.value.toLowerCase(),
    );
    if (!custom) {
      const known =
        this.options.functions?.filter((f) => f.kind === "condition").map((f) => `${f.name}()`) ??
        [];
      throw new TqlError(
        `Unknown function ${t.value}()${known.length ? `. Defined conditions: ${known.join(", ")}` : ""}`,
        t.start,
        close.end,
      );
    }
    if (arg) throw new TqlError(`${custom.name}() doesn't take arguments`, t.start, close.end);
    return { type: "call", name: custom.name, builtin: false };
  }

  private field(t: Token): FieldDef {
    const field = findField(t.value) ?? this.customFields.get(t.value.toLowerCase());
    if (!field) {
      const known = TQL_FIELDS.map((f) => f.name).join(", ");
      throw new TqlError(`Unknown field "${t.value}". Try one of: ${known}`, t.start, t.end);
    }
    return field;
  }

  private operator(field: FieldDef): { op: Operator; at: Token } {
    const t = this.peek();
    let op: Operator | undefined;
    if (t.type === "op") {
      this.next();
      op = t.value as Operator;
    } else if (this.isWord("in")) {
      this.next();
      op = "in";
    } else if (this.isWord("not") && this.isWord("in", 1)) {
      this.next();
      this.next();
      op = "not in";
    } else if (this.isWord("is")) {
      this.next();
      const negated = this.isWord("not");
      if (negated) this.next();
      if (!this.isWord("empty") && !this.isWord("null")) {
        const n = this.peek();
        throw new TqlError("Expected EMPTY after IS", n.start, n.end);
      }
      this.next();
      op = negated ? "is not empty" : "is empty";
    }
    if (!op) throw new TqlError(`Expected an operator after ${field.name}`, t.start, t.end);
    if (!field.operators.includes(op)) {
      throw new TqlError(
        `${field.name} doesn't support "${op.toUpperCase()}". Use ${field.operators.map((o) => o.toUpperCase()).join(", ")}`,
        t.start,
        this.peek(-1).end,
      );
    }
    return { op, at: t };
  }

  private clause(field: FieldDef): TqlExpr {
    const { op } = this.operator(field);
    if (op === "is empty" || op === "is not empty")
      return { type: "clause", field: field.name, op, value: { kind: "empty" } };
    if (op === "in" || op === "not in") {
      // `assignee IN myTeam()` — a function standing for the whole list.
      if (this.peek().type === "word" && this.peek(1).type === "lparen") {
        const at = this.peek();
        const value = this.value(field);
        if (value.kind !== "function")
          throw new TqlError(`Expected "(" after ${op.toUpperCase()}`, at.start, at.end);
        return { type: "clause", field: field.name, op, value };
      }
      const open = this.next();
      if (open.type !== "lparen")
        throw new TqlError(`Expected "(" after ${op.toUpperCase()}`, open.start, open.end);
      const items: TqlValue[] = [];
      do items.push(this.value(field));
      while (this.peek().type === "comma" && this.next());
      const close = this.next();
      if (close.type !== "rparen")
        throw new TqlError("Missing closing parenthesis", close.start, close.end);
      return { type: "clause", field: field.name, op, value: { kind: "list", items } };
    }
    return { type: "clause", field: field.name, op, value: this.value(field) };
  }

  private value(field: FieldDef): TqlValue {
    const t = this.next();
    if (t.type === "string")
      return this.check(field, { kind: "literal", value: t.value, quoted: true }, t);
    if (
      t.type !== "word" ||
      (KEYWORDS.has(t.value.toLowerCase()) && t.value.toLowerCase() !== "empty")
    ) {
      throw new TqlError(`Expected a value for ${field.name}`, t.start, t.end);
    }
    if (this.peek().type === "lparen") {
      this.next();
      const close = this.next();
      if (close.type !== "rparen")
        throw new TqlError("Functions take no arguments: write name()", close.start, close.end);
      const allowed = field.functions ?? [];
      const name = allowed.find((f) => f.toLowerCase() === t.value.toLowerCase());
      const custom = this.options.functions?.find(
        (f) =>
          f.kind === "values" &&
          f.valueKind === field.kind &&
          f.name.toLowerCase() === t.value.toLowerCase(),
      );
      if (!name && custom) return { kind: "function", name: custom.name, custom: true };
      if (!name) {
        throw new TqlError(
          allowed.length
            ? `${t.value}() isn't valid for ${field.name}. Try ${allowed.map((f) => `${f}()`).join(", ")}`
            : `${field.name} doesn't take functions`,
          t.start,
          close.end,
        );
      }
      return { kind: "function", name };
    }
    return this.check(field, { kind: "literal", value: t.value, quoted: false }, t);
  }

  private check(
    field: FieldDef,
    value: Extract<TqlValue, { kind: "literal" }>,
    t: Token,
  ): TqlValue {
    if (field.values) {
      const normalized = value.value.toLowerCase().replace(/\s+/g, "_");
      if (!field.values.includes(normalized)) {
        // A project's own issue type, kept as written (matched case-insensitively).
        const own =
          field.name === "type"
            ? this.options.issueTypes?.find((n) => n.toLowerCase() === value.value.toLowerCase())
            : undefined;
        if (own) return { ...value, value: own };
        const allowed = [
          ...field.values,
          ...(field.name === "type" ? (this.options.issueTypes ?? []) : []),
        ];
        throw new TqlError(
          `"${value.value}" isn't a ${field.name}. Use ${allowed.join(", ")}`,
          t.start,
          t.end,
        );
      }
      return { ...value, value: normalized };
    }
    if (field.kind === "date" && !isDateLiteral(value.value)) {
      throw new TqlError(
        `"${value.value}" isn't a date. Use 2026-12-31, -7d, 2w or a function like startOfWeek()`,
        t.start,
        t.end,
      );
    }
    if (
      field.kind === "number" &&
      !(field.custom ? /^-?\d+(\.\d+)?$/ : /^\d+$/).test(value.value)
    ) {
      throw new TqlError(
        `${field.name} must be a ${field.custom ? "number" : "whole number"}`,
        t.start,
        t.end,
      );
    }
    if (field.kind === "option" && field.custom?.options) {
      const match = field.custom.options.find((o) => o.toLowerCase() === value.value.toLowerCase());
      if (!match) {
        throw new TqlError(
          `"${value.value}" isn't an option of ${field.custom.name}. Use ${field.custom.options.join(", ")}`,
          t.start,
          t.end,
        );
      }
      return { ...value, value: match };
    }
    return value;
  }
}

export type TqlParseResult = { ok: true; query: TqlQuery } | { ok: false; error: TqlError };

/** Parses TQL. An empty string is a valid query that matches everything. */
export function parseTql(input: string, options?: TqlParseOptions): TqlParseResult {
  try {
    return { ok: true, query: new Parser(tokenize(input), options).parse() };
  } catch (error) {
    if (error instanceof TqlError) return { ok: false, error };
    throw error;
  }
}
