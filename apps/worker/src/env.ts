import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Used to build absolute links in emails and push notifications. */
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  /** Web Push (VAPID) keys; push delivery is skipped when they're missing. */
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:no-reply@tracklane.local"),
  /** Where the worker reaches the web app's internal endpoints (SLA checks). */
  INTERNAL_APP_URL: z.string().url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  /** Let webhooks reach localhost and private networks (development only). */
  WEBHOOK_ALLOW_PRIVATE_URLS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/** Validated environment. Fails fast at startup with a readable message. */
export const env = (() => {
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")),
  );
  if (!parsed.success) {
    console.error("Invalid worker environment:", z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
})();
