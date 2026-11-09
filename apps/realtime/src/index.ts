import { createServer } from "node:http";
import { verifyRealtimeToken } from "@tracklane/core";
import { Server, type Socket } from "socket.io";
import { startBridge } from "./bridge";
import { env } from "./env";
import { registerPresenceHandlers, type SocketData } from "./handlers/presence";
import { registerRelayHandlers } from "./handlers/relay";
import { logger } from "./lib/logger";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, connections: io.engine.clientsCount }));
    return;
  }
  res.writeHead(404).end();
});

// Browsers reach this through the web app (same origin, /api/realtime), so CORS only matters
// for direct connections in development.
const io = new Server<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>(httpServer, {
  path: "/api/realtime",
  addTrailingSlash: false,
  // Whiteboard scenes are relayed whole; leave room for large boards.
  maxHttpBufferSize: 5e6,
  cors: { origin: [env.NEXT_PUBLIC_APP_URL], credentials: true },
});

io.use(async (socket, next) => {
  const token = (socket.handshake.auth as { token?: unknown }).token;
  const claims =
    typeof token === "string" ? await verifyRealtimeToken(token, env.BETTER_AUTH_SECRET) : null;
  if (!claims) return next(new Error("unauthorized"));
  socket.data.user = claims;
  next();
});

io.on("connection", (socket) => {
  logger.debug({ socketId: socket.id, userId: socket.data.user.sub }, "connected");
  registerPresenceHandlers(io, socket);
  registerRelayHandlers(socket as unknown as Socket);
});

const stopBridge = startBridge(io as unknown as Server);

httpServer.listen(env.REALTIME_PORT, () => {
  logger.info({ port: env.REALTIME_PORT }, "realtime server listening");
});

const shutdown = () => {
  stopBridge();
  void io.close();
  httpServer.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
