/** What a highlighted span of a TQL query is. */
export type TqlSpanKind =
  | "keyword"
  | "field"
  | "operator"
  | "string"
  | "function"
  | "value"
  | "punctuation"
  | "space"
  | "error";

export interface TqlSpan {
  kind: TqlSpanKind;
  text: string;
}

const KEYWORDS = new Set(["and", "or", "not", "in", "is", "empty", "null", "order", "by"]);
const DIRECTIONS = new Set(["asc", "desc"]);
const OPS = ["!=", "!~", ">=", "<=", "=", "~", ">", "<"];
const WORD = /[A-Za-z0-9_\-.@+:/]/;

/**
 * Splits a query into spans for syntax highlighting. Never throws: unclosed quotes run to the
 * end and unknown characters become "error" spans, so the editor can colour half-typed input.
 * Joining every span's text gives back the input exactly.
 */
export function highlightTql(input: string): TqlSpan[] {
  type Raw = { kind: TqlSpanKind; text: string; word?: string };
  const raw: Raw[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    const start = i;
    if (/\s/.test(ch)) {
      while (i < input.length && /\s/.test(input[i]!)) i++;
      raw.push({ kind: "space", text: input.slice(start, i) });
    } else if (ch === "(" || ch === ")" || ch === ",") {
      i++;
      raw.push({ kind: "punctuation", text: ch });
    } else if (ch === '"' || ch === "'") {
      i++;
      while (i < input.length && input[i] !== ch) i += input[i] === "\\" ? 2 : 1;
      i = Math.min(i + 1, input.length);
      raw.push({ kind: "string", text: input.slice(start, i) });
    } else {
      const op = OPS.find((o) => input.startsWith(o, i));
      if (op) {
        i += op.length;
        raw.push({ kind: "operator", text: op });
      } else if (WORD.test(ch)) {
        while (i < input.length && WORD.test(input[i]!)) i++;
        const text = input.slice(start, i);
        raw.push({ kind: "value", text, word: text.toLowerCase() });
      } else {
        i++;
        raw.push({ kind: "error", text: ch });
      }
    }
  }

  // Classify words by their neighbours (ignoring whitespace).
  const solid = raw.filter((r) => r.kind !== "space");
  let afterOrderBy = false;
  solid.forEach((token, index) => {
    if (token.word === undefined) return;
    const prev = solid[index - 1];
    const next = solid[index + 1];
    const nextWord = next?.word;
    if (token.word === "by" && prev?.word === "order") afterOrderBy = true;
    if (KEYWORDS.has(token.word)) token.kind = "keyword";
    else if (next?.text.startsWith("(")) token.kind = "function";
    else if (afterOrderBy && DIRECTIONS.has(token.word)) token.kind = "keyword";
    else if (
      next?.kind === "operator" ||
      nextWord === "in" ||
      nextWord === "is" ||
      (nextWord === "not" && solid[index + 2]?.word === "in") ||
      (afterOrderBy && token.word !== "by")
    )
      token.kind = "field";
  });

  // Merge neighbouring spans of the same kind to keep the DOM small.
  const spans: TqlSpan[] = [];
  for (const { kind, text } of raw) {
    const last = spans[spans.length - 1];
    if (last && last.kind === kind && kind !== "value" && kind !== "field") last.text += text;
    else spans.push({ kind, text });
  }
  return spans;
}
