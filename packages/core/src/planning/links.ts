export const ISSUE_LINK_TYPES = ["blocks", "relates", "duplicates", "clones"] as const;
export type IssueLinkType = (typeof ISSUE_LINK_TYPES)[number];

/** How a link reads from each end: [from the source, from the target]. */
export const LINK_PHRASES: Record<IssueLinkType, [outward: string, inward: string]> = {
  blocks: ["blocks", "is blocked by"],
  relates: ["relates to", "relates to"],
  duplicates: ["duplicates", "is duplicated by"],
  clones: ["clones", "is cloned by"],
};

/** Options for the "link issue" picker; each maps to a stored type and direction. */
export const LINK_CHOICES = [
  { value: "blocks", label: "blocks", type: "blocks", outward: true },
  { value: "blocked_by", label: "is blocked by", type: "blocks", outward: false },
  { value: "relates", label: "relates to", type: "relates", outward: true },
  { value: "duplicates", label: "duplicates", type: "duplicates", outward: true },
  { value: "duplicated_by", label: "is duplicated by", type: "duplicates", outward: false },
  { value: "clones", label: "clones", type: "clones", outward: true },
] as const;
export type LinkChoice = (typeof LINK_CHOICES)[number]["value"];
