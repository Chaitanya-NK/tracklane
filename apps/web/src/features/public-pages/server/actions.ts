"use server";

import { cookies, headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { env } from "@/env";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { getProjectAccess, getWorkspaceAccess } from "@/server/authz";
import { actionClient, authActionClient } from "@/server/safe-action";
import { subscribeToRoadmap, toggleVote } from "./roadmap";
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
    const sender = clientIp(await headers());
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

const VOTER_COOKIE = "tl_voter";

/** Public: upvote a roadmap item (one vote per browser). */
export const toggleRoadmapVoteAction = actionClient
  .inputSchema(z.object({ slug: z.string(), projectKey: z.string(), issueId: z.string() }))
  .action(async ({ parsedInput }) => {
    rateLimit("roadmap-vote", clientIp(await headers()), { limit: 30, windowMs: 60_000 });
    const jar = await cookies();
    let voter = jar.get(VOTER_COOKIE)?.value;
    if (!voter || !/^[\w-]{20,60}$/.test(voter)) {
      voter = crypto.randomUUID();
      jar.set(VOTER_COOKIE, voter, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NEXT_PUBLIC_APP_URL.startsWith("https:"),
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    const result = await toggleVote({
      workspaceSlug: parsedInput.slug,
      projectKey: parsedInput.projectKey,
      issueId: parsedInput.issueId,
      voterKey: voter,
    });
    refresh();
    return result;
  });

/** Public: get an email when releases ship. */
export const subscribeRoadmapAction = actionClient
  .inputSchema(
    z.object({
      slug: z.string(),
      projectKey: z.string(),
      email: z.string().trim().email("Enter a valid email").max(200),
    }),
  )
  .action(async ({ parsedInput }) => {
    rateLimit("roadmap-subscribe", clientIp(await headers()), { limit: 5, windowMs: 10 * 60_000 });
    await subscribeToRoadmap({
      workspaceSlug: parsedInput.slug,
      projectKey: parsedInput.projectKey,
      email: parsedInput.email,
    });
  });
