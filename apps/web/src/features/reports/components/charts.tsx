"use client";

import type {
  BurndownPoint,
  CreatedResolvedPoint,
  FlowPoint,
  VelocityPoint,
} from "@tracklane/core";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** "2026-11-09" → "Nov 9" (UTC, so the label matches the stored day). */
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const axis = { tickLine: false, axisLine: false, tickMargin: 8, fontSize: 11 } as const;

/** Every chart has its numbers as a table too (screen readers, low contrast, copying). */
function DataTable({ columns, rows }: { columns: string[]; rows: (string | number | null)[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
        View data
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c} className="h-8 text-xs">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j} className="py-1 text-xs tabular-nums">
                    {cell ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}

const burndownConfig = {
  remaining: { label: "Remaining", color: "var(--viz-1)" },
  scope: { label: "Scope", color: "var(--viz-2)" },
  ideal: { label: "Ideal", color: "var(--viz-reference)" },
} satisfies ChartConfig;

export function BurndownChart({
  points,
  height = 260,
}: {
  points: BurndownPoint[];
  height?: number;
}) {
  return (
    <div>
      <ChartContainer
        config={burndownConfig}
        className="w-full"
        style={{ height }}
        aria-label="Sprint burndown chart"
      >
        <LineChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis dataKey="date" tickFormatter={shortDay} {...axis} minTickGap={24} />
          <YAxis width={32} {...axis} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(v) => shortDay(String(v))} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            isAnimationActive={false}
            dataKey="ideal"
            stroke="var(--color-ideal)"
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={false}
          />
          <Line
            isAnimationActive={false}
            dataKey="scope"
            type="stepAfter"
            stroke="var(--color-scope)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            isAnimationActive={false}
            dataKey="remaining"
            type="stepAfter"
            stroke="var(--color-remaining)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>
      <DataTable
        columns={["Day", "Remaining", "Scope", "Ideal"]}
        rows={points.map((p) => [p.date, p.remaining, p.scope, p.ideal])}
      />
    </div>
  );
}

const velocityConfig = {
  committed: { label: "Committed", color: "var(--viz-1)" },
  completed: { label: "Completed", color: "var(--viz-2)" },
} satisfies ChartConfig;

export function VelocityChart({
  points,
  height = 260,
}: {
  points: VelocityPoint[];
  height?: number;
}) {
  return (
    <div>
      <ChartContainer
        config={velocityConfig}
        className="w-full"
        style={{ height }}
        aria-label="Velocity chart"
      >
        <BarChart data={points} margin={{ left: 4, right: 12, top: 16 }} barGap={2}>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis dataKey="sprint" {...axis} />
          <YAxis width={32} {...axis} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            isAnimationActive={false}
            dataKey="committed"
            fill="var(--color-committed)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            isAnimationActive={false}
            dataKey="completed"
            fill="var(--color-completed)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          >
            <LabelList
              dataKey="completed"
              position="top"
              className="fill-foreground"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <DataTable
        columns={["Sprint", "Committed", "Completed"]}
        rows={points.map((p) => [p.sprint, p.committed, p.completed])}
      />
    </div>
  );
}

const flowConfig = {
  todo: { label: "To do", color: "var(--viz-1)" },
  inProgress: { label: "In progress", color: "var(--viz-2)" },
  done: { label: "Done", color: "var(--viz-3)" },
} satisfies ChartConfig;

export function FlowChart({ points, height = 260 }: { points: FlowPoint[]; height?: number }) {
  return (
    <div>
      <ChartContainer
        config={flowConfig}
        className="w-full"
        style={{ height }}
        aria-label="Cumulative flow chart"
      >
        <AreaChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis dataKey="date" tickFormatter={shortDay} {...axis} minTickGap={24} />
          <YAxis width={32} {...axis} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(v) => shortDay(String(v))} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {(["done", "inProgress", "todo"] as const).map((key) => (
            <Area
              isAnimationActive={false}
              key={key}
              dataKey={key}
              stackId="flow"
              type="linear"
              fill={`var(--color-${key})`}
              fillOpacity={0.85}
              stroke={`var(--color-${key})`}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ChartContainer>
      <DataTable
        columns={["Day", "To do", "In progress", "Done"]}
        rows={points.map((p) => [p.date, p.todo, p.inProgress, p.done])}
      />
    </div>
  );
}

const createdResolvedConfig = {
  created: { label: "Created", color: "var(--viz-1)" },
  resolved: { label: "Resolved", color: "var(--viz-2)" },
} satisfies ChartConfig;

export function CreatedResolvedChart({
  points,
  height = 240,
}: {
  points: CreatedResolvedPoint[];
  height?: number;
}) {
  return (
    <div>
      <ChartContainer
        config={createdResolvedConfig}
        className="w-full"
        style={{ height }}
        aria-label="Created versus resolved chart"
      >
        <BarChart data={points} margin={{ left: 4, right: 12, top: 8 }} barGap={2}>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis dataKey="date" tickFormatter={shortDay} {...axis} minTickGap={24} />
          <YAxis width={28} {...axis} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(v) => shortDay(String(v))} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            isAnimationActive={false}
            dataKey="created"
            fill="var(--color-created)"
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
          />
          <Bar
            isAnimationActive={false}
            dataKey="resolved"
            fill="var(--color-resolved)"
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
          />
        </BarChart>
      </ChartContainer>
      <DataTable
        columns={["Day", "Created", "Resolved", "Open change"]}
        rows={points.map((p) => [p.date, p.created, p.resolved, p.trend])}
      />
    </div>
  );
}

const breakdownConfig = { count: { label: "Issues", color: "var(--viz-1)" } } satisfies ChartConfig;

/** Horizontal bars with the value at the end of each (one series, so no legend). */
export function BreakdownChart({
  rows,
  label,
}: {
  rows: { name: string; count: number }[];
  label: string;
}) {
  const height = Math.max(120, rows.length * 32 + 16);
  return (
    <div>
      <ChartContainer
        config={breakdownConfig}
        className="w-full"
        style={{ height }}
        aria-label={`Issues by ${label}`}
      >
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 36 }} barCategoryGap={6}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={120} {...axis} />
          <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
          <Bar
            isAnimationActive={false}
            dataKey="count"
            fill="var(--color-count)"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          >
            <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={11} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <DataTable columns={[label, "Issues"]} rows={rows.map((r) => [r.name, r.count])} />
    </div>
  );
}
