"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { getProjectAccess, getWorkspaceAccess } from "@/server/authz";
import { actionClient, authActionClient } from "@/server/safe-action";
import { setProjectPublicPages, submitPortalRequest } from "./service";
import {
  addIncidentUpdate,
  COMPONENT_STATUSES,
  createIncident,
  deleteComponent,
  deleteIncident,
  INCIDENT_IMPACTS,
  INCIDENT_STATUSES,
  saveComponent,
  setStatusPagePublic,
} from "./status";

export const setProjectPublicPagesAction = authActionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectKey: z.string(),
      portalEnabled: z.boolean(),
      roadmapPublic: z.boolean(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace, project } = await getProjectAccess(parsedInput.slug, parsedInput.projectKey);
    await setProjectPublicPages(workspace.id, ctx.user.id, project.id, parsedInput);
    refresh();
  });

/** Public: anyone can file a request through an enabled portal. */
export const submitPortalRequestAction = actionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectKey: z.string(),
      name: z.string().trim().min(1, "Tell us your name").max(100),
      email: z.string().trim().email("Enter a valid email"),
      kind: z.enum(["bug", "story"]),
      title: z.string().trim().min(3, "Summarise it in a few words").max(200),
      description: z.string().trim().min(10, "Add a little more detail").max(10_000),
      /** Honeypot: hidden from people, filled in by naive bots. */
      website: z.string().max(0).optional(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const h = await headers();
    const sender =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    return submitPortalRequest({ ...parsedInput, workspaceSlug: parsedInput.slug, sender });
  });

const slug = z.string();

export const setStatusPagePublicAction = authActionClient
  .inputSchema(z.object({ slug, value: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await setStatusPagePublic(workspace.id, ctx.user.id, parsedInput.value);
    refresh();
  });

export const saveComponentAction = authActionClient
  .inputSchema(
    z.object({
      slug,
      id: z.string().nullable(),
      name: z.string().trim().min(1, "Name the component").max(80),
      description: z.string().max(300),
      status: z.enum(COMPONENT_STATUSES),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await saveComponent(workspace.id, ctx.user.id, parsedInput.id, parsedInput);
    refresh();
  });

export const deleteComponentAction = authActionClient
  .inputSchema(z.object({ slug, id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteComponent(workspace.id, ctx.user.id, parsedInput.id);
    refresh();
  });

export const createIncidentAction = authActionClient
  .inputSchema(
    z.object({
      slug,
      title: z.string().trim().min(1, "Give it a title").max(160),
      impact: z.enum(INCIDENT_IMPACTS),
      status: z.enum(INCIDENT_STATUSES),
      body: z.string().trim().min(1, "Say what's happening").max(5000),
      componentIds: z.array(z.string()).max(30),
      componentStatus: z.enum(COMPONENT_STATUSES),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await createIncident(workspace.id, ctx.user.id, parsedInput);
    refresh();
  });

export const addIncidentUpdateAction = authActionClient
  .inputSchema(
    z.object({
      slug,
      incidentId: z.string(),
      status: z.enum(INCIDENT_STATUSES),
      body: z.string().trim().min(1, "Write the update").max(5000),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await addIncidentUpdate(workspace.id, ctx.user.id, parsedInput.incidentId, parsedInput);
    refresh();
  });

export const deleteIncidentAction = authActionClient
  .inputSchema(z.object({ slug, incidentId: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const { workspace } = await getWorkspaceAccess(parsedInput.slug);
    await deleteIncident(workspace.id, ctx.user.id, parsedInput.incidentId);
    refresh();
  });
