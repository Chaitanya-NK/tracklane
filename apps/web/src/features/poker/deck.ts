export const DECKS = {
  fibonacci: {
    label: "Fibonacci (1, 2, 3, 5, 8…)",
    cards: ["1", "2", "3", "5", "8", "13", "21", "?", "☕"],
  },
  powers: {
    label: "Powers of two (1, 2, 4, 8…)",
    cards: ["1", "2", "4", "8", "16", "32", "?", "☕"],
  },
  linear: {
    label: "1 to 10",
    cards: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?", "☕"],
  },
} as const;

export type DeckName = keyof typeof DECKS;

/** Cards that aren't a number: "not sure" and "need a break". */
export const isNumericCard = (value: string) => /^\d+$/.test(value);

/**
 * Summary of revealed votes: the numeric spread, whether everyone agreed, and a suggested
 * estimate (the deck card nearest the median, rounding up on a tie).
 */
export function summarizeVotes(values: string[], deck: readonly string[]) {
  const numbers = values
    .filter(isNumericCard)
    .map(Number)
    .sort((a, b) => a - b);
  if (!numbers.length)
    return {
      count: values.length,
      min: null,
      max: null,
      average: null,
      consensus: false,
      suggestion: null,
    };
  const mid = numbers.length / 2;
  const median =
    numbers.length % 2 ? numbers[Math.floor(mid)]! : (numbers[mid - 1]! + numbers[mid]!) / 2;
  const options = deck.filter(isNumericCard).map(Number);
  let suggestion = options[0] ?? Math.round(median);
  for (const o of options) {
    if (
      Math.abs(o - median) < Math.abs(suggestion - median) ||
      (Math.abs(o - median) === Math.abs(suggestion - median) && o > suggestion)
    ) {
      suggestion = o;
    }
  }
  const average = Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10;
  return {
    count: values.length,
    min: numbers[0]!,
    max: numbers.at(-1)!,
    average,
    consensus: numbers.length === values.length && numbers[0] === numbers.at(-1),
    suggestion,
  };
}
