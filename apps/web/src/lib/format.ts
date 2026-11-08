/** Two-letter initials for avatars: "Chaitanya N" → "CN", "dev@acme.dev" → "DE". */
export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes("@") ? (nameOrEmail.split("@")[0] ?? "") : nameOrEmail;
  const parts = base
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

/** Compact number formatting for stat tiles: 1284 → "1.3K". */
export function compactNumber(value: number, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}
