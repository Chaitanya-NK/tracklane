import { TQL_FIELDS } from "@tracklane/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EXAMPLES = [
  ['project = WEB AND status = "In Progress"', "Work in progress in one project"],
  ["assignee = currentUser() AND statusCategory != done", "My open work"],
  ["priority >= high AND type = bug ORDER BY priority DESC", "Important bugs, worst first"],
  ["due <= endOfWeek() AND due >= startOfWeek()", "Due this week"],
  ['text ~ "checkout" AND created >= -14d', "Mentions checkout, created in the last two weeks"],
  ["sprint in (openSprints()) AND assignee is empty", "Unassigned work in open sprints"],
  ["labels in (frontend, backend) AND NOT status = Done", "Labelled and not done"],
  [
    '"Team" = Growth AND "Customer facing" = true',
    "Custom fields, by name (quote names with spaces)",
  ],
  ['filter("Open bugs") AND assignee = currentUser()', "Reuse a saved filter"],
] as const;

/** Syntax reference shown under the results. Generated from the field registry. */
export function TqlReference() {
  return (
    <Card id="tql-help">
      <CardHeader>
        <CardTitle>TQL reference</CardTitle>
        <CardDescription>
          Combine conditions with AND, OR, NOT and parentheses; finish with ORDER BY field ASC|DESC.
          Quote values with spaces. Dates: 2026-12-31, relative -7d / 2w / 1m, or functions like
          startOfWeek().
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Operators</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TQL_FIELDS.map((field) => (
              <TableRow key={field.name}>
                <TableCell className="align-top">
                  <code className="text-xs font-semibold">{field.name}</code>
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                </TableCell>
                <TableCell className="align-top font-mono text-xs whitespace-normal">
                  {field.operators.map((o) => o.toUpperCase()).join("  ")}
                  {field.functions?.length ? (
                    <p className="mt-1 text-muted-foreground">
                      {field.functions.map((f) => `${f}()`).join(" ")}
                    </p>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Examples</h3>
          <ul className="space-y-2">
            {EXAMPLES.map(([query, meaning]) => (
              <li key={query}>
                <code className="block rounded bg-muted px-2 py-1 text-xs break-all">{query}</code>
                <span className="text-xs text-muted-foreground">{meaning}</span>
              </li>
            ))}
          </ul>
          <h3 className="pt-2 text-sm font-medium">Workspace functions</h3>
          <p className="text-xs text-muted-foreground">
            Admins can name a condition (<code>isStale()</code>) or a list of values (
            <code>assignee IN myTeam()</code>) under Settings → TQL functions. They show up in
            autocomplete as you type.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
