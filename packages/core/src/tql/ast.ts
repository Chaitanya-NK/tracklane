import type { Operator } from "./fields";

export type TqlValue =
  | { kind: "literal"; value: string; quoted: boolean }
  /** `custom` marks a workspace value-list function. */
  | { kind: "function"; name: string; custom?: boolean }
  | { kind: "list"; items: TqlValue[] }
  | { kind: "empty" };

export type TqlExpr =
  | { type: "and" | "or"; left: TqlExpr; right: TqlExpr }
  | { type: "not"; expr: TqlExpr }
  | { type: "clause"; field: string; op: Operator; value: TqlValue }
  /** A condition function: isStale(), filter("Open bugs"). */
  | { type: "call"; name: string; arg?: string; builtin: boolean };

export interface TqlOrder {
  field: string;
  direction: "asc" | "desc";
}

export interface TqlQuery {
  where: TqlExpr | null;
  orderBy: TqlOrder[];
}
