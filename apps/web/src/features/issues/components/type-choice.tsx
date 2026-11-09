"use client";

import { ISSUE_TYPE_LABELS, ISSUE_TYPES, type IssueType } from "@tracklane/core";
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from "@/components/ui/select";
import type { IssueFormOptions } from "../types";
import { IssueTypeIcon } from "./issue-meta";

type CustomTypes = IssueFormOptions["customTypes"];

/** Select value for a type: the built-in name, or `custom:<id>` for a project's own type. */
export const typeValue = (type: IssueType, customTypeId: string | null | undefined) =>
  customTypeId ? `custom:${customTypeId}` : type;

export function parseTypeValue(value: string, customTypes: CustomTypes) {
  if (value.startsWith("custom:")) {
    const found = customTypes.find((t) => `custom:${t.id}` === value);
    if (found) return { type: found.baseType, customTypeId: found.id, label: found.name };
  }
  const type = value as IssueType;
  return { type, customTypeId: null, label: ISSUE_TYPE_LABELS[type] };
}

/** Built-in types, then the project's own (filtered by `allow`). */
export function TypeOptions({
  customTypes,
  allow = () => true,
}: {
  customTypes: CustomTypes;
  allow?: (type: IssueType) => boolean;
}) {
  const custom = customTypes.filter((t) => allow(t.baseType));
  return (
    <>
      {ISSUE_TYPES.filter(allow).map((t) => (
        <SelectItem key={t} value={t}>
          <IssueTypeIcon type={t} tooltip={false} /> {ISSUE_TYPE_LABELS[t]}
        </SelectItem>
      ))}
      {custom.length ? (
        <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>This project</SelectLabel>
            {custom.map((t) => (
              <SelectItem key={t.id} value={`custom:${t.id}`}>
                <IssueTypeIcon type={t.baseType} custom={t} tooltip={false} /> {t.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </>
      ) : null}
    </>
  );
}
