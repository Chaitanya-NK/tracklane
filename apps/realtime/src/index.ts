import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./env";
import { registerPresenceHandlers } from "./handlers/presence";
import { logger } from "./lib/logger";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, connections: io.engine.clientsCount }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server(httpServer, {
  cors: { origin: [env.NEXT_PUBLIC_APP_URL], credentials: true },
});

io.on("connection", (socket) => {
  logger.debug({ socketId: socket.id }, "connected");
  registerPresenceHandlers(io, socket);
});

httpServer.listen(env.REALTIME_PORT, () => {
  logger.info({ port: env.REALTIME_PORT }, "realtime server listening");
});

const shutdown = () => {
  io.close();
  httpServer.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
