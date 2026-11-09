import pg from "pg";
import type { Server } from "socket.io";
import { env } from "./env";
import { logger } from "./lib/logger";

/** Keep in sync with apps/web/src/server/realtime/publish.ts. */
const CHANNEL = "tracklane_events";

interface Envelope {
  rooms: string[];
  event: string;
  data: unknown;
}

/**
 * Forwards events the web app publishes with pg_notify (delivered only when its transaction
 * commits) to the rooms they name. Reconnects with backoff if the database goes away.
 */
export function startBridge(io: Server) {
  let client: pg.Client | null = null;
  let stopped = false;
  let attempt = 0;

  async function connect() {
    client = new pg.Client({ connectionString: env.DATABASE_URL });
    client.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      try {
        const envelope = JSON.parse(message.payload) as Envelope;
        if (!Array.isArray(envelope.rooms) || typeof envelope.event !== "string") return;
        io.to(envelope.rooms).emit(envelope.event, envelope.data);
      } catch (error) {
        logger.warn({ error }, "bad realtime payload");
      }
    });
    client.on("error", (error) => {
      logger.error({ error }, "realtime bridge lost the database");
      void retry();
    });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    attempt = 0;
    logger.info("listening for database events");
  }

  async function retry() {
    if (stopped) return;
    await client?.end().catch(() => {});
    client = null;
    attempt++;
    const delay = Math.min(30_000, 500 * 2 ** attempt);
    setTimeout(() => void connect().catch(() => retry()), delay);
  }

  void connect().catch(() => retry());
  return () => {
    stopped = true;
    void client?.end();
  };
}
