import { describe, expect, it } from "vitest";
import { DECKS, summarizeVotes } from "../deck";

const fib = DECKS.fibonacci.cards;

describe("summarizeVotes", () => {
  it("suggests the deck card nearest the median", () => {
    expect(summarizeVotes(["3", "5", "8"], fib)).toMatchObject({
      suggestion: 5,
      min: 3,
      max: 8,
      average: 5.3,
      consensus: false,
    });
    // Median 4 sits between 3 and 5: round up.
    expect(summarizeVotes(["3", "5"], fib).suggestion).toBe(5);
    expect(summarizeVotes(["13", "13", "13"], fib)).toMatchObject({
      consensus: true,
      suggestion: 13,
    });
  });

  it("ignores ? and coffee cards, and can't agree with them", () => {
    expect(summarizeVotes(["5", "5", "?"], fib)).toMatchObject({
      consensus: false,
      suggestion: 5,
      count: 3,
    });
    expect(summarizeVotes(["?", "☕"], fib)).toMatchObject({ suggestion: null, average: null });
  });
});
