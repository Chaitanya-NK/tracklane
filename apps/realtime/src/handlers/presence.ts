import type { Server, Socket } from "socket.io";
import { logger } from "../lib/logger";

/**
 * Room naming: one room per board/project/doc, e.g. "project:PAY". Clients join the rooms for
 * the page they're on; Phase 6 adds auth, presence lists and issue change broadcasts.
 */
export function registerPresenceHandlers(io: Server, socket: Socket) {
  socket.on("room:join", (room: unknown) => {
    if (typeof room !== "string" || room.length > 120) return;
    void socket.join(room);
    socket.to(room).emit("presence:joined", { socketId: socket.id });
    logger.debug({ room, socketId: socket.id }, "joined room");
  });

  socket.on("room:leave", (room: unknown) => {
    if (typeof room !== "string") return;
    void socket.leave(room);
    socket.to(room).emit("presence:left", { socketId: socket.id });
  });

  socket.on("disconnect", () => {
    logger.debug({ socketId: socket.id, rooms: io.of("/").adapter.rooms.size }, "disconnected");
  });
}
