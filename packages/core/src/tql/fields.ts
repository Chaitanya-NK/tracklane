import { type CustomFieldType, ISSUE_TYPES, PRIORITIES, STATUS_CATEGORIES } from "../constants";

/** How a field's values are matched; decides the allowed operators and value forms. */
export type FieldKind =
  | "project"
  | "key"
  | "enum"
  | "status"
  | "user"
  | "label"
  | "component"
  | "sprint"
  | "resolution"
  | "release"
  | "issue"
  | "text"
  | "date"
  | "number"
  | "option"
  | "boolean";

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
  /** Set for project custom fields; the canonical name is `cf:<name>`. */
  custom?: { name: string; type: CustomFieldType; options?: readonly string[] };
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
    name: "component",
    aliases: ["components"],
    kind: "component",
    description: "Component name",
    operators: [...EQ, ...EMPTY],
    sortable: false,
  },
  {
    name: "flagged",
    aliases: ["flag"],
    kind: "boolean",
    description: "Flagged as blocked (true/false)",
    operators: ["=", "!="],
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
    name: "resolution",
    aliases: [],
    kind: "resolution",
    description: "How a resolved issue was closed (Fixed, Duplicate…)",
    operators: [...EQ, ...EMPTY],
    sortable: false,
  },
  {
    name: "release",
    aliases: ["fixVersion", "version"],
    kind: "release",
    description: "Fix version (release name)",
    operators: [...EQ, ...EMPTY],
    functions: ["unreleasedVersions", "releasedVersions"],
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

/** A project custom field as TQL sees it (any project in the workspace). */
export interface TqlCustomFieldSignature {
  name: string;
  type: CustomFieldType;
  /** Option values, for select/multi-select. */
  options?: readonly string[];
}

/** Builds the field definition for a custom field, so it parses like a built-in one. */
export function customFieldDef(sig: TqlCustomFieldSignature): FieldDef {
  const base = {
    name: `cf:${sig.name}`,
    aliases: [],
    description: `Custom field (${sig.type})`,
    sortable: false,
    custom: sig,
  };
  switch (sig.type) {
    case "number":
      return { ...base, kind: "number", operators: ["=", "!=", ...ORDERED, ...EMPTY] };
    case "date":
      return {
        ...base,
        kind: "date",
        operators: ["=", ...ORDERED, ...EMPTY],
        functions: DATE_FUNCTIONS,
      };
    case "select":
    case "multiselect":
      return { ...base, kind: "option", operators: [...EQ, ...EMPTY] };
    case "user":
      return { ...base, kind: "user", operators: [...EQ, ...EMPTY], functions: ["currentUser"] };
    case "checkbox":
      return { ...base, kind: "boolean", operators: ["=", "!="], values: ["true", "false"] };
    default:
      return { ...base, kind: "text", operators: ["~", "!~", "=", "!=", ...EMPTY] };
  }
}

/** Functions defined in the workspace (Settings → TQL functions). */
export interface TqlFunctionSignature {
  name: string;
  kind: "condition" | "values";
  /** For value lists: the field kind they apply to (user, label, project…). */
  valueKind?: string;
  description?: string;
}

/** Built-in condition functions. filter("Saved filter name") reuses a saved filter. */
export const BUILTIN_CONDITION_FUNCTIONS = [
  { name: "filter", description: "Matches a saved filter by name", arg: true },
] as const;

export interface TqlParseOptions {
  customFields?: readonly TqlCustomFieldSignature[];
  /** Names of projects' own issue types, accepted by type = … alongside the built-in ones. */
  issueTypes?: readonly string[];
  functions?: readonly TqlFunctionSignature[];
}

/** Field kinds a workspace value-list function can stand in for. */
export const TQL_VALUE_KINDS = ["user", "label", "project", "status", "sprint", "release"] as const;
export type TqlValueKind = (typeof TQL_VALUE_KINDS)[number];
export const TQL_VALUE_KIND_LABELS: Record<TqlValueKind, string> = {
  user: "People (assignee, reporter, user fields)",
  label: "Labels",
  project: "Projects",
  status: "Statuses",
  sprint: "Sprints",
  release: "Releases",
};

const RESERVED_WORDS = [
  "and",
  "or",
  "not",
  "in",
  "is",
  "empty",
  "null",
  "order",
  "by",
  "asc",
  "desc",
];

/** Why a name can't be used for a workspace function, or null when it can. */
export function tqlFunctionNameProblem(name: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_]{1,39}$/.test(name))
    return "Use 2–40 letters, digits or underscores, starting with a letter";
  const lower = name.toLowerCase();
  const builtins = [
    ...BUILTIN_CONDITION_FUNCTIONS.map((f) => f.name),
    ...TQL_FIELDS.flatMap((f) => [...(f.functions ?? []), f.name, ...f.aliases]),
    ...RESERVED_WORDS,
  ];
  if (builtins.some((b) => b.toLowerCase() === lower)) return `"${name}" is a built-in TQL name`;
  return null;
}
