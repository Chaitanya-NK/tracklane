import type { Operator } from "./fields";

export type TqlValue =
  | { kind: "literal"; value: string; quoted: boolean }
  | { kind: "function"; name: string }
  | { kind: "list"; items: TqlValue[] }
  | { kind: "empty" };

export type TqlExpr =
  | { type: "and" | "or"; left: TqlExpr; right: TqlExpr }
  | { type: "not"; expr: TqlExpr }
  | { type: "clause"; field: string; op: Operator; value: TqlValue };

export interface TqlOrder {
  field: string;
  direction: "asc" | "desc";
}

export interface TqlQuery {
  where: TqlExpr | null;
  orderBy: TqlOrder[];
}
