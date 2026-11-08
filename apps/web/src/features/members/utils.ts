import { emailSchema } from "@tracklane/core";

/** Splits pasted text ("a@x.dev, b@x.dev\nc@x.dev") into unique valid and invalid addresses. */
export function parseEmailList(text: string): { valid: string[]; invalid: string[] } {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const part of parts) {
    (emailSchema.safeParse(part).success ? valid : invalid).add(part);
  }
  return { valid: [...valid], invalid: [...invalid] };
}
