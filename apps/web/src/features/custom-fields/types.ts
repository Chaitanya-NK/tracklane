import type { CustomFieldType } from "@tracklane/core";

export interface CustomFieldDef {
  id: string;
  name: string;
  description: string;
  type: CustomFieldType;
  required: boolean;
  options: { id: string; value: string; color: string }[];
  /** Issues with a value (shown in settings). */
  usage: number;
}

/** text/url/date → string, number, checkbox → boolean, user → user id, select/multiselect → option ids. */
export type CustomFieldValue = string | number | boolean | string[];
