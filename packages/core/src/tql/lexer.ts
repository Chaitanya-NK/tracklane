export type TokenType = "word" | "string" | "op" | "lparen" | "rparen" | "comma" | "eof";

export interface Token {
  type: TokenType;
  /** Raw text for words/ops; unescaped content for strings. */
  value: string;
  start: number;
  end: number;
}

export class TqlError extends Error {
  constructor(
    message: string,
    /** Character offset where the problem starts. */
    readonly position: number,
    readonly end: number = position,
  ) {
    super(message);
    this.name = "TqlError";
  }
}

const WORD = /[A-Za-z0-9_\-.@+:/]/;
const OPS = ["!=", "!~", ">=", "<=", "=", "~", ">", "<"];

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (ch === "(") tokens.push({ type: "lparen", value: ch, start, end: ++i });
    else if (ch === ")") tokens.push({ type: "rparen", value: ch, start, end: ++i });
    else if (ch === ",") tokens.push({ type: "comma", value: ch, start, end: ++i });
    else if (ch === '"' || ch === "'") {
      let value = "";
      i++;
      while (i < input.length && input[i] !== ch) {
        if (input[i] === "\\" && i + 1 < input.length) i++;
        value += input[i];
        i++;
      }
      if (i >= input.length) throw new TqlError("Unclosed quote", start, input.length);
      i++;
      tokens.push({ type: "string", value, start, end: i });
    } else {
      const op = OPS.find((o) => input.startsWith(o, i));
      if (op) {
        i += op.length;
        tokens.push({ type: "op", value: op, start, end: i });
      } else if (WORD.test(ch)) {
        while (i < input.length && WORD.test(input[i]!)) i++;
        tokens.push({ type: "word", value: input.slice(start, i), start, end: i });
      } else {
        throw new TqlError(`Unexpected character "${ch}"`, start, start + 1);
      }
    }
  }
  tokens.push({ type: "eof", value: "", start: input.length, end: input.length });
  return tokens;
}
