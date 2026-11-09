/** Emoji people can react to comments with. */
export const REACTIONS = ["👍", "🎉", "❤️", "😄", "👀", "🚀"] as const;
export type Reaction = (typeof REACTIONS)[number];
