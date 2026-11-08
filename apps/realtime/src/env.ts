import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REALTIME_PORT: z.coerce.number().int().positive().default(4001),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const env = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid realtime environment:", z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
})();
