/** Rewrites (or adds) the ORDER BY clause of a TQL query: clicking a column header. */
export function withOrderBy(query: string, field: string, direction: "asc" | "desc"): string {
  const index = query.search(/\border\s+by\b/i);
  const base = (index >= 0 ? query.slice(0, index) : query).trim();
  return `${base}${base ? " " : ""}ORDER BY ${field} ${direction.toUpperCase()}`;
}

/** The first ORDER BY field and direction, if any (for the header arrow). */
export function currentOrder(query: string): { field: string; direction: "asc" | "desc" } | null {
  const match = /\border\s+by\s+([A-Za-z]+)(?:\s+(asc|desc))?/i.exec(query);
  if (!match) return null;
  return {
    field: match[1]!.toLowerCase(),
    direction: (match[2]?.toLowerCase() as "asc" | "desc") ?? "asc",
  };
}
