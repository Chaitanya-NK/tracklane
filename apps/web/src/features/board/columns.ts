/** Column id → ordered item ids. Used by the board (columns = statuses) and backlog (lists = sprints). */
export type Columns = Record<string, string[]>;

export function findColumn(columns: Columns, itemId: string): string | undefined {
  if (itemId in columns) return itemId;
  return Object.keys(columns).find((key) => columns[key]!.includes(itemId));
}

/**
 * Moves `itemId` into `toColumn` at `index` (end if omitted), removing it from its current column.
 * Returns a new object; the input is not modified.
 */
export function moveItem(
  columns: Columns,
  itemId: string,
  toColumn: string,
  index?: number,
): Columns {
  const next: Columns = {};
  for (const [key, ids] of Object.entries(columns)) next[key] = ids.filter((id) => id !== itemId);
  const target = next[toColumn] ?? [];
  const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length));
  next[toColumn] = [...target.slice(0, at), itemId, ...target.slice(at)];
  return next;
}

/** The items directly above and below `itemId` in its column (for ranking after a drop). */
export function neighboursOf(
  columns: Columns,
  itemId: string,
): { beforeId: string | null; afterId: string | null } {
  const column = findColumn(columns, itemId);
  const ids = column ? columns[column]! : [];
  const index = ids.indexOf(itemId);
  return { beforeId: ids[index - 1] ?? null, afterId: ids[index + 1] ?? null };
}
