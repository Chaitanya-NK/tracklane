"use client";

import { layoutDependencies } from "@tracklane/core";
import type { Route } from "next";
import Link from "next/link";
import { IssueTypeIcon, StatusBadge } from "@/features/issues";
import { cn } from "@/lib/utils";
import type { IssueLinkRow } from "../server/service";

type Node = IssueLinkRow["issue"];

const W = 220;
const H = 64;
const GAP_X = 72;
const GAP_Y = 20;

/**
 * "Blocks" links drawn left to right: blockers on the left, what they hold up to the right.
 * Cards are HTML positioned over an SVG layer of edges, so they stay links and readable text.
 */
export function DependencyGraph({
  slug,
  nodes,
  edges,
}: {
  slug: string;
  nodes: Node[];
  edges: { from: string; to: string }[];
}) {
  const layout = layoutDependencies(nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pos = new Map(
    layout.nodes.map((p) => [p.id, { x: p.layer * (W + GAP_X), y: p.row * (H + GAP_Y) }]),
  );
  const width = layout.layers * (W + GAP_X) - GAP_X;
  const height = Math.max(1, layout.rows) * (H + GAP_Y) - GAP_Y;
  const cycleKeys = layout.cycles.map((c) => `${byId.get(c.from)?.key} ↔ ${byId.get(c.to)?.key}`);

  return (
    <div className="space-y-3">
      {cycleKeys.length ? (
        <p className="text-sm text-destructive" role="status">
          Circular dependency: {cycleKeys.join(", ")}. Those links aren&apos;t drawn.
        </p>
      ) : null}
      <div className="overflow-auto rounded-lg border bg-muted/30 p-6">
        <div className="relative" style={{ width, height }}>
          <svg
            width={width}
            height={height}
            className="absolute inset-0 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="dep-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
              </marker>
            </defs>
            {layout.edges.map((e) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              const x1 = a.x + W;
              const y1 = a.y + H / 2;
              const x2 = b.x - 2;
              const y2 = b.y + H / 2;
              const mid = (x1 + x2) / 2;
              const blockerOpen = byId.get(e.from)?.status.category !== "done";
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  strokeWidth={1.5}
                  markerEnd="url(#dep-arrow)"
                  className={cn(
                    blockerOpen ? "stroke-destructive/70" : "stroke-muted-foreground/50",
                  )}
                  strokeDasharray={blockerOpen ? undefined : "4 3"}
                />
              );
            })}
          </svg>
          {layout.nodes.map((p) => {
            const n = byId.get(p.id)!;
            const { x, y } = pos.get(p.id)!;
            return (
              <Link
                key={n.id}
                href={`/${slug}/issues/${n.key}` as Route}
                className="absolute flex flex-col justify-between rounded-lg border bg-card p-2 text-sm shadow-xs transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                style={{ left: x, top: y, width: W, height: H }}
              >
                <span className="flex items-center gap-1.5">
                  <IssueTypeIcon type={n.type} custom={n.customType} tooltip={false} />
                  <span
                    className={cn(
                      "font-mono text-xs text-muted-foreground",
                      n.status.category === "done" && "line-through",
                    )}
                  >
                    {n.key}
                  </span>
                  <StatusBadge status={n.status} className="ml-auto" />
                </span>
                <span className="truncate">{n.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Arrows point from a blocker to the issue it blocks. Solid red: the blocker is still open.
        Dashed: the blocker is done.
      </p>
    </div>
  );
}
