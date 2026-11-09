/** Room names; keep in sync with server/realtime/publish.ts and @tracklane/core canJoinRoom. */
export const liveRooms = {
  project: (workspaceId: string, projectId: string) => `ws:${workspaceId}:project:${projectId}`,
  issue: (workspaceId: string, issueId: string) => `ws:${workspaceId}:issue:${issueId}`,
  item: (workspaceId: string, kind: "doc" | "whiteboard" | "retro" | "poker", id: string) =>
    `ws:${workspaceId}:${kind}:${id}`,
};
