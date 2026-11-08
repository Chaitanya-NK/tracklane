# TQL — Tracklane Query Language

TQL finds issues across every project in a workspace. It is used on the **Filters** page,
in saved filters, and (from Phase 11) by the REST API.

```
project = WEB AND status in ("To Do", "In Progress") AND assignee = currentUser()
  ORDER BY priority DESC, updated DESC
```

## Syntax

- **Conditions:** `field operator value`. Combine with `AND`, `OR`, `NOT` and parentheses.
  `AND` binds tighter than `OR`.
- **Values:** bare words (`WEB`, `bug`, `priya@tracklane.dev`) or quoted strings
  (`"In Progress"`). Keywords are case-insensitive.
- **Lists:** `field IN (a, b)` / `field NOT IN (a, b)`.
- **Empty:** `field IS EMPTY` / `field IS NOT EMPTY` (`NULL` works too).
- **Sorting:** `ORDER BY field [ASC|DESC], …` at the end. Default: most recently updated.

## Fields

| Field                      | Aliases                                  | Operators                          | Values                                                                        |
| -------------------------- | ---------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `project`                  |                                          | `= != IN NOT IN`                   | key or name                                                                   |
| `key`                      | `issue`, `issuekey`, `id`                | `= != IN NOT IN > >= < <=`         | `WEB-12` (comparisons stay in that project)                                   |
| `type`                     | `issuetype`                              | `= != IN NOT IN`                   | story, task, bug, epic, subtask                                               |
| `status`                   |                                          | `= != IN NOT IN`                   | status name                                                                   |
| `statusCategory`           | `category`                               | `= != IN NOT IN`                   | todo, "in progress", done                                                     |
| `priority`                 |                                          | `= != IN NOT IN > >= < <=`         | lowest … highest (`priority >= high`)                                         |
| `assignee`, `reporter`     |                                          | `= != IN NOT IN`, `IS [NOT] EMPTY` | email, name, `currentUser()`                                                  |
| `labels`                   | `label`                                  | `= != IN NOT IN`, `IS [NOT] EMPTY` | label name                                                                    |
| `sprint`                   |                                          | `= != IN NOT IN`, `IS [NOT] EMPTY` | name, `openSprints()`, `activeSprint()`, `futureSprints()`, `closedSprints()` |
| `parent`                   | `epic`                                   | `= != IN NOT IN`, `IS [NOT] EMPTY` | issue key                                                                     |
| `text`                     |                                          | `~ !~`                             | summary or description contains                                               |
| `summary`                  | `title`                                  | `~ !~`                             |                                                                               |
| `description`              |                                          | `~ !~`, `IS [NOT] EMPTY`           |                                                                               |
| `created`, `updated`       |                                          | `= > >= < <=`                      | date                                                                          |
| `resolved`, `due`, `start` | `resolutiondate`, `duedate`, `startdate` | `= > >= < <=`, `IS [NOT] EMPTY`    | date                                                                          |
| `points`                   | `estimate`, `storypoints`                | `= != > >= < <=`, `IS [NOT] EMPTY` | whole number                                                                  |

## Dates

- Calendar dates: `2026-12-31` (that whole day for `=`, `<=` and `>`).
- Relative to now: `-7d`, `2w`, `+3m` (months), `-12h`.
- Functions: `now()`, `startOfDay()`, `endOfDay()`, `startOfWeek()`, `endOfWeek()`,
  `startOfMonth()`, `endOfMonth()`. Weeks start on Monday; times are UTC.

## Examples

| Query                                                    | Finds                                            |
| -------------------------------------------------------- | ------------------------------------------------ |
| `assignee = currentUser() AND statusCategory != done`    | My open work                                     |
| `priority >= high AND type = bug ORDER BY priority DESC` | Important bugs, worst first                      |
| `due <= endOfWeek() AND statusCategory != done`          | Due this week (or overdue)                       |
| `sprint in (openSprints()) AND assignee is empty`        | Unassigned work in open sprints                  |
| `text ~ "checkout" AND created >= -14d`                  | Mentions checkout, created in the last two weeks |
| `labels in (frontend, backend) AND NOT status = Done`    | Labelled and not done                            |

## Implementation

- `packages/core/src/tql` — lexer, recursive-descent parser (errors carry character
  positions), field registry, date handling and autocomplete (`suggestTql`). Pure and tested.
- `apps/web/src/features/search/compile.ts` — AST → Prisma `where`/`orderBy`, always scoped to
  the workspace. Values are passed as Prisma parameters, never concatenated into SQL.
