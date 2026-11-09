import { ISSUE_TYPES, PRIORITIES, WEBHOOK_EVENTS } from "@tracklane/core";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, description = "OK") => ({
  description,
  content: { "application/json": { schema } },
});
const data = (schema: object) => ({
  type: "object",
  required: ["data"],
  properties: { data: schema },
});
const errors = {
  "422": json(ref("Error"), "Invalid input (code validation_failed)"),
  "401": json(ref("Error"), "Missing, invalid or revoked token"),
  "403": json(ref("Error"), "Read-only token, or your role can't do this"),
  "404": json(ref("Error"), "Not found"),
  "429": json(ref("Error"), "Rate limited (300 requests a minute per token)"),
};
const keyParam = {
  name: "key",
  in: "path",
  required: true,
  description: "Issue key, e.g. WEB-12",
  schema: { type: "string" },
};

/** OpenAPI 3.1 description of /api/v1, served at /api/v1/openapi.json and rendered at /developers. */
export function openApiSpec(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Tracklane API",
      version: "1.0.0",
      description:
        "Read and change issues in one workspace. Create a token in Settings → API tokens and send it as `Authorization: Bearer tl_…`. A token acts as you, with your role; read-only tokens can't change anything. Responses wrap results in `data` (lists add `meta`); errors are `{ error: { code, message, field? } }`.",
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    security: [{ bearer: [] }],
    tags: [
      { name: "Account", description: "The token's owner and workspace." },
      { name: "Projects" },
      { name: "Issues", description: "Search with TQL, create, read, update and delete." },
      { name: "Comments" },
    ],
    paths: {
      "/me": {
        get: {
          tags: ["Account"],
          summary: "Who am I",
          operationId: "getMe",
          responses: { "200": json(data(ref("Me"))), "401": errors["401"] },
        },
      },
      "/projects": {
        get: {
          tags: ["Projects"],
          summary: "List projects",
          description: "Active projects with their workflow statuses and labels.",
          operationId: "listProjects",
          responses: {
            "200": json(data({ type: "array", items: ref("Project") })),
            "401": errors["401"],
          },
        },
      },
      "/issues": {
        get: {
          tags: ["Issues"],
          summary: "Search issues",
          description: "Runs a TQL query, the same language as the Filters page.",
          operationId: "searchIssues",
          parameters: [
            {
              name: "q",
              in: "query",
              description: "TQL query. Defaults to `ORDER BY updated DESC`.",
              schema: { type: "string" },
              example: "project = WEB AND statusCategory != done ORDER BY priority DESC",
            },
            { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
            {
              name: "perPage",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            },
          ],
          responses: {
            "200": json({
              type: "object",
              properties: {
                data: { type: "array", items: ref("Issue") },
                meta: {
                  type: "object",
                  properties: {
                    page: { type: "integer" },
                    perPage: { type: "integer" },
                    total: { type: "integer" },
                    hasMore: { type: "boolean" },
                  },
                },
              },
            }),
            "422": errors["422"],
            "401": errors["401"],
          },
        },
        post: {
          tags: ["Issues"],
          summary: "Create an issue",
          operationId: "createIssue",
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("IssueCreate") } },
          },
          responses: { "201": json(data(ref("Issue")), "Created"), ...errors },
        },
      },
      "/issues/{key}": {
        parameters: [keyParam],
        get: {
          tags: ["Issues"],
          summary: "Get an issue",
          operationId: "getIssue",
          responses: {
            "200": json(data(ref("Issue"))),
            "401": errors["401"],
            "404": errors["404"],
          },
        },
        patch: {
          tags: ["Issues"],
          summary: "Update an issue",
          description:
            "Send only the fields to change. Status moves follow the project's workflow; if the move needs approval, the issue stays put and `meta.approvalRequested` names the target status.",
          operationId: "updateIssue",
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("IssueUpdate") } },
          },
          responses: { "200": json(data(ref("Issue"))), ...errors },
        },
        delete: {
          tags: ["Issues"],
          summary: "Delete an issue",
          description: "Needs an admin role. Subtasks and attachments are deleted too.",
          operationId: "deleteIssue",
          responses: { "204": { description: "Deleted" }, ...errors },
        },
      },
      "/issues/{key}/comments": {
        parameters: [keyParam],
        get: {
          tags: ["Comments"],
          summary: "List comments",
          operationId: "listComments",
          responses: {
            "200": json(data({ type: "array", items: ref("Comment") })),
            "404": errors["404"],
          },
        },
        post: {
          tags: ["Comments"],
          summary: "Add a comment",
          description: "Markdown. Mention people with `@[Name](user:<id>)`.",
          operationId: "addComment",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["body"],
                  properties: { body: { type: "string", maxLength: 20000 } },
                },
              },
            },
          },
          responses: { "201": json(data(ref("Comment")), "Created"), ...errors },
        },
      },
    },
    webhooks: Object.fromEntries(
      WEBHOOK_EVENTS.map((event) => [
        event,
        {
          post: {
            summary: event,
            description:
              "Signed with HMAC-SHA256: header `X-Tracklane-Signature: t=<unix>,v1=<hex>` over `<t>.<raw body>` with the hook's secret. Reject timestamps older than 5 minutes.",
            requestBody: { content: { "application/json": { schema: ref("WebhookPayload") } } },
            responses: { "200": { description: "Any 2xx acknowledges the delivery" } },
          },
        },
      ]),
    ),
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", description: "API token (tl_…)" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: {
                  type: "string",
                  enum: [
                    "unauthorized",
                    "forbidden",
                    "not_found",
                    "validation_failed",
                    "conflict",
                    "rate_limited",
                    "internal",
                  ],
                },
                message: { type: "string" },
                field: { type: "string" },
              },
            },
          },
        },
        Person: {
          type: ["object", "null"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
          },
        },
        Me: {
          type: "object",
          properties: {
            user: ref("Person"),
            workspace: {
              type: "object",
              properties: {
                id: { type: "string" },
                slug: { type: "string" },
                name: { type: "string" },
              },
            },
            role: { type: "string", enum: ["owner", "admin", "member", "viewer", "guest"] },
            scope: { type: "string", enum: ["read", "write"] },
          },
        },
        Status: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            category: { type: "string", enum: ["todo", "in_progress", "done"] },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string" },
            key: { type: "string", example: "WEB" },
            name: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["scrum", "kanban"] },
            lead: ref("Person"),
            statuses: { type: "array", items: ref("Status") },
            labels: { type: "array", items: { type: "string" } },
          },
        },
        Issue: {
          type: "object",
          properties: {
            id: { type: "string" },
            key: { type: "string", example: "WEB-12" },
            url: { type: "string", format: "uri" },
            title: { type: "string" },
            description: { type: "string", description: "Markdown" },
            type: { type: "string", description: "Built-in type, or the project's own type name" },
            baseType: { type: "string", enum: [...ISSUE_TYPES] },
            priority: { type: "string", enum: [...PRIORITIES] },
            status: ref("Status"),
            resolution: { type: ["string", "null"] },
            estimate: { type: ["integer", "null"], description: "Story points" },
            startDate: { type: ["string", "null"], format: "date" },
            dueDate: { type: ["string", "null"], format: "date" },
            project: {
              type: "object",
              properties: {
                id: { type: "string" },
                key: { type: "string" },
                name: { type: "string" },
              },
            },
            assignee: ref("Person"),
            reporter: ref("Person"),
            sprint: {
              type: ["object", "null"],
              properties: { id: { type: "string" }, name: { type: "string" } },
            },
            release: {
              type: ["object", "null"],
              properties: { id: { type: "string" }, name: { type: "string" } },
            },
            parent: { type: ["string", "null"], description: "Parent issue key" },
            labels: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            resolvedAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        IssueCreate: {
          type: "object",
          required: ["project", "title"],
          properties: {
            project: { type: "string", description: "Project key", example: "WEB" },
            title: { type: "string", maxLength: 255 },
            type: { type: "string", enum: [...ISSUE_TYPES], default: "task" },
            priority: { type: "string", enum: [...PRIORITIES], default: "medium" },
            description: { type: "string" },
            status: { type: "string", description: "Status name; defaults to the first status" },
            assignee: { type: ["string", "null"], format: "email" },
            parent: { type: ["string", "null"], description: "Parent issue key" },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Existing label names",
            },
            estimate: { type: ["integer", "null"] },
            startDate: { type: ["string", "null"], format: "date" },
            dueDate: { type: ["string", "null"], format: "date" },
          },
        },
        IssueUpdate: {
          type: "object",
          minProperties: 1,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: [...ISSUE_TYPES] },
            priority: { type: "string", enum: [...PRIORITIES] },
            status: { type: "string", description: "Status name" },
            assignee: { type: ["string", "null"], format: "email" },
            parent: { type: ["string", "null"] },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Replaces all labels",
            },
            estimate: { type: ["integer", "null"] },
            startDate: { type: ["string", "null"], format: "date" },
            dueDate: { type: ["string", "null"], format: "date" },
          },
        },
        Comment: {
          type: "object",
          properties: {
            id: { type: "string" },
            body: { type: "string" },
            author: ref("Person"),
            createdAt: { type: "string", format: "date-time" },
            editedAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        WebhookPayload: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Delivery id (also in X-Tracklane-Delivery); use it to de-duplicate",
            },
            event: { type: "string", enum: [...WEBHOOK_EVENTS, "ping"] },
            createdAt: { type: "string", format: "date-time" },
            workspaceId: { type: "string" },
            data: {
              type: "object",
              description:
                "issue.* events: `{ issue }` (issue.updated adds `changes: [{ field, from, to }]`); comment.created: `{ comment, issue }`; release.released: `{ release, movedOpenIssues }`; sprint.*: `{ sprint, project }`.",
            },
          },
        },
      },
    },
  };
}

export type OpenApiSpec = ReturnType<typeof openApiSpec>;
