import { ISSUE_TYPES, PRIORITIES, STATUS_CATEGORIES } from "../constants";

/** How a field's values are matched; decides the allowed operators and value forms. */
export type FieldKind =
  | "project"
  | "key"
  | "enum"
  | "status"
  | "user"
  | "label"
  | "sprint"
  | "issue"
  | "text"
  | "date"
  | "number";

export type Operator =
  "=" | "!=" | ">" | ">=" | "<" | "<=" | "~" | "!~" | "in" | "not in" | "is empty" | "is not empty";

export interface FieldDef {
  /** Canonical name used in the AST. */
  name: string;
  aliases: string[];
  kind: FieldKind;
  description: string;
  operators: Operator[];
  /** Allowed literal values (enums), lower-case. */
  values?: readonly string[];
  /** Allowed functions, e.g. currentUser(). */
  functions?: readonly string[];
  sortable: boolean;
}

const EQ: Operator[] = ["=", "!=", "in", "not in"];
const EMPTY: Operator[] = ["is empty", "is not empty"];
const ORDERED: Operator[] = [">", ">=", "<", "<="];

export const DATE_FUNCTIONS = [
  "now",
  "startOfDay",
  "endOfDay",
  "startOfWeek",
  "endOfWeek",
  "startOfMonth",
  "endOfMonth",
] as const;

export const TQL_FIELDS: FieldDef[] = [
  {
    name: "project",
    aliases: [],
    kind: "project",
    description: "Project key or name",
    operators: EQ,
    sortable: true,
  },
  {
    name: "key",
    aliases: ["issue", "issuekey", "id"],
    kind: "key",
    description: "Issue key, e.g. WEB-12",
    operators: [...EQ, ...ORDERED],
    sortable: true,
  },
  {
    name: "type",
    aliases: ["issuetype"],
    kind: "enum",
    description: "Issue type",
    operators: EQ,
    values: ISSUE_TYPES,
    sortable: true,
  },
  {
    name: "status",
    aliases: [],
    kind: "status",
    description: "Workflow status name",
    operators: EQ,
    sortable: true,
  },
  {
    name: "statusCategory",
    aliases: ["category"],
    kind: "enum",
    description: "To do, in progress or done",
    operators: EQ,
    values: STATUS_CATEGORIES,
    sortable: false,
  },
  {
    name: "priority",
    aliases: [],
    kind: "enum",
    description: "Priority (comparable: priority >= high)",
    operators: [...EQ, ...ORDERED],
    values: PRIORITIES,
    sortable: true,
  },
  {
    name: "assignee",
    aliases: [],
    kind: "user",
    description: "Email or name",
    operators: [...EQ, ...EMPTY],
    functions: ["currentUser"],
    sortable: true,
  },
  {
    name: "reporter",
    aliases: [],
    kind: "user",
    description: "Email or name",
    operators: [...EQ, ...EMPTY],
    functions: ["currentUser"],
    sortable: true,
  },
  {
    name: "labels",
    aliases: ["label"],
    kind: "label",
    description: "Label name",
    operators: [...EQ, ...EMPTY],
    sortable: false,
  },
  {
    name: "sprint",
    aliases: [],
    kind: "sprint",
    description: "Sprint name",
    operators: [...EQ, ...EMPTY],
    functions: ["openSprints", "activeSprint", "futureSprints", "closedSprints"],
    sortable: false,
  },
  {
    name: "parent",
    aliases: ["epic"],
    kind: "issue",
    description: "Parent issue key (epic or story)",
    operators: [...EQ, ...EMPTY],
    sortable: false,
  },
  {
    name: "text",
    aliases: [],
    kind: "text",
    description: "Summary and description contain",
    operators: ["~", "!~"],
    sortable: false,
  },
  {
    name: "summary",
    aliases: ["title"],
    kind: "text",
    description: "Summary contains",
    operators: ["~", "!~"],
    sortable: true,
  },
  {
    name: "description",
    aliases: [],
    kind: "text",
    description: "Description contains",
    operators: ["~", "!~", ...EMPTY],
    sortable: false,
  },
  {
    name: "created",
    aliases: ["createddate"],
    kind: "date",
    description: "When created",
    operators: ["=", ...ORDERED],
    functions: DATE_FUNCTIONS,
    sortable: true,
  },
  {
    name: "updated",
    aliases: ["updateddate"],
    kind: "date",
    description: "Last change",
    operators: ["=", ...ORDERED],
    functions: DATE_FUNCTIONS,
    sortable: true,
  },
  {
    name: "resolved",
    aliases: ["resolutiondate"],
    kind: "date",
    description: "When moved to done",
    operators: ["=", ...ORDERED, ...EMPTY],
    functions: DATE_FUNCTIONS,
    sortable: true,
  },
  {
    name: "due",
    aliases: ["duedate"],
    kind: "date",
    description: "Due date",
    operators: ["=", ...ORDERED, ...EMPTY],
    functions: DATE_FUNCTIONS,
    sortable: true,
  },
  {
    name: "start",
    aliases: ["startdate"],
    kind: "date",
    description: "Start date",
    operators: ["=", ...ORDERED, ...EMPTY],
    functions: DATE_FUNCTIONS,
    sortable: true,
  },
  {
    name: "points",
    aliases: ["estimate", "storypoints"],
    kind: "number",
    description: "Story points",
    operators: ["=", "!=", ...ORDERED, ...EMPTY],
    sortable: true,
  },
];

const byName = new Map<string, FieldDef>();
for (const field of TQL_FIELDS) {
  byName.set(field.name.toLowerCase(), field);
  for (const alias of field.aliases) byName.set(alias.toLowerCase(), field);
}

export function findField(name: string): FieldDef | undefined {
  return byName.get(name.toLowerCase());
}
