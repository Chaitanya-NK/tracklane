export interface GraphNode {
  id: string;
}
export interface GraphEdge {
  /** blocker */
  from: string;
  /** blocked */
  to: string;
}
export interface PlacedNode {
  id: string;
  layer: number;
  row: number;
}

/**
 * Layered layout for a dependency graph: each node sits one layer right of its furthest
 * blocker (longest path), so chains read left to right. Cycles are broken by ignoring the
 * edge that closes them (they're reported so the UI can flag them).
 */
export function layoutDependencies(nodes: GraphNode[], edges: GraphEdge[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
    out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
  }
  // Depth-first search to find back edges (cycles).
  const state = new Map<string, 0 | 1 | 2>();
  const cycles: GraphEdge[] = [];
  const acyclic: GraphEdge[] = [];
  const visit = (id: string) => {
    state.set(id, 1);
    for (const to of out.get(id) ?? []) {
      if (state.get(to) === 1) cycles.push({ from: id, to });
      else {
        acyclic.push({ from: id, to });
        if (!state.get(to)) visit(to);
      }
    }
    state.set(id, 2);
  };
  for (const n of nodes) if (!state.get(n.id)) visit(n.id);

  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  // Relax edges until stable (DAG, so at most |nodes| passes).
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of acyclic) {
      const next = (layer.get(e.from) ?? 0) + 1;
      if (next > (layer.get(e.to) ?? 0)) {
        layer.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rows = new Map<number, number>();
  const placed: PlacedNode[] = nodes.map((n) => {
    const l = layer.get(n.id) ?? 0;
    const row = rows.get(l) ?? 0;
    rows.set(l, row + 1);
    return { id: n.id, layer: l, row };
  });
  return {
    nodes: placed,
    edges: acyclic,
    cycles,
    layers: Math.max(0, ...placed.map((p) => p.layer)) + 1,
    rows: Math.max(0, ...rows.values()),
  };
}
