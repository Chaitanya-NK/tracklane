/** Built-in filters everyone gets, like Jira's default filters. */
export const PRESET_FILTERS = [
  {
    id: "my-open",
    name: "My open issues",
    query:
      "assignee = currentUser() AND statusCategory != done ORDER BY priority DESC, updated DESC",
  },
  {
    id: "reported",
    name: "Reported by me",
    query: "reporter = currentUser() ORDER BY created DESC",
  },
  {
    id: "recent",
    name: "Updated in the last 7 days",
    query: "updated >= -7d ORDER BY updated DESC",
  },
  {
    id: "due-week",
    name: "Due this week",
    query: "due <= endOfWeek() AND statusCategory != done ORDER BY due ASC",
  },
  {
    id: "open-bugs",
    name: "Open bugs",
    query: "type = bug AND statusCategory != done ORDER BY priority DESC",
  },
  { id: "all", name: "All issues", query: "ORDER BY created DESC" },
] as const;
