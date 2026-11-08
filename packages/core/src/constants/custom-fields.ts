export const CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "multiselect",
  "user",
  "checkbox",
  "url",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<
  CustomFieldType,
  { label: string; description: string }
> = {
  text: { label: "Text", description: "A short line of text" },
  number: { label: "Number", description: "Any number, e.g. revenue impact" },
  date: { label: "Date", description: "A calendar date" },
  select: { label: "Select", description: "One option from a list" },
  multiselect: { label: "Multi-select", description: "Several options from a list" },
  user: { label: "Person", description: "A workspace member" },
  checkbox: { label: "Checkbox", description: "Yes or no" },
  url: { label: "URL", description: "A link" },
};
