import { describe, expect, it } from "vitest";
import { evenRanks, RANK_STEP, rankBetween } from "./rank";

describe("rankBetween", () => {
  it("handles empty lists and the ends", () => {
    expect(rankBetween(undefined, undefined)).toBe(RANK_STEP);
    expect(rankBetween(5000, undefined)).toBe(5000 + RANK_STEP);
    expect(rankBetween(undefined, 1000)).toBe(0);
  });

  it("uses the midpoint between neighbours", () => {
    expect(rankBetween(1000, 2000)).toBe(1500);
  });

  it("asks for renumbering when neighbours are too close", () => {
    expect(rankBetween(1, 1 + 1e-7)).toBeNull();
    expect(evenRanks(3)).toEqual([1000, 2000, 3000]);
  });
});
