import { describe, expect, it } from "vitest";
import {
  averageVelocity,
  burndown,
  createdVsResolved,
  cumulativeFlow,
  evaluateSla,
  formatDuration,
  formatElapsed,
  parseDuration,
} from "./index";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("durations", () => {
  it("parses Jira-style durations", () => {
    expect(parseDuration("1w 2d 3h 30m")).toBe(2400 + 960 + 180 + 30);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("2x")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("1d", { calendar: true })).toBe(1440);
  });
  it("formats", () => {
    expect(formatDuration(570)).toBe("1d 1h 30m");
    expect(formatDuration(0)).toBe("0m");
    expect(formatElapsed(1530)).toBe("1d 1h");
    expect(formatElapsed(-45)).toBe("-45m");
  });
});

describe("burndown", () => {
  it("draws the ideal line and carries gaps forward", () => {
    const points = burndown({
      start: d("2026-11-02"),
      end: d("2026-11-06"),
      today: d("2026-11-04"),
      snapshots: [
        { date: "2026-11-02", remaining: 20, scope: 20 },
        { date: "2026-11-04", remaining: 12, scope: 22 },
      ],
    });
    expect(points.map((p) => p.ideal)).toEqual([20, 15, 10, 5, 0]);
    expect(points.map((p) => p.remaining)).toEqual([20, 20, 12, null, null]);
    expect(points[2]!.scope).toBe(22);
  });
});

describe("flow and created vs resolved", () => {
  it("fills days and counts", () => {
    const flow = cumulativeFlow({
      start: d("2026-11-01"),
      end: d("2026-11-03"),
      snapshots: [{ date: "2026-11-02", todo: 3, inProgress: 1, done: 0 }],
    });
    expect(flow.map((f) => f.date)).toEqual(["2026-11-02", "2026-11-03"]);
    const cvr = createdVsResolved({
      start: d("2026-11-01"),
      end: d("2026-11-02"),
      created: [d("2026-11-01"), d("2026-11-01"), d("2026-11-02")],
      resolved: [d("2026-11-02")],
    });
    expect(cvr).toEqual([
      { date: "2026-11-01", created: 2, resolved: 0, trend: 2 },
      { date: "2026-11-02", created: 1, resolved: 1, trend: 2 },
    ]);
    expect(
      averageVelocity([
        { sprint: "1", committed: 10, completed: 8 },
        { sprint: "2", committed: 10, completed: 11 },
      ]),
    ).toBe(9.5);
  });
});

describe("SLA", () => {
  const start = new Date("2026-11-09T08:00:00Z");
  it("tracks running, at risk, breached, met and missed", () => {
    const at = (iso: string, stopped: string | null = null) =>
      evaluateSla({
        startedAt: start,
        stoppedAt: stopped ? new Date(stopped) : null,
        targetMinutes: 240,
        warnMinutes: 60,
        now: new Date(iso),
      }).state;
    expect(at("2026-11-09T09:00:00Z")).toBe("running");
    expect(at("2026-11-09T11:30:00Z")).toBe("at_risk");
    expect(at("2026-11-09T12:01:00Z")).toBe("breached");
    expect(at("2026-11-10T00:00:00Z", "2026-11-09T10:00:00Z")).toBe("met");
    expect(at("2026-11-10T00:00:00Z", "2026-11-09T13:00:00Z")).toBe("missed");
  });
});
