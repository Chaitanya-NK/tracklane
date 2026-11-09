import { canJoinRoom, type RealtimeClaims } from "@tracklane/core";
import type { Server, Socket } from "socket.io";
import { logger } from "../lib/logger";

export interface SocketData {
  user: RealtimeClaims;
}

type AppServer = Server<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;
type AppSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

/** Who is in a room right now (one entry per person, however many tabs they have open). */
async function presenceOf(io: AppServer, room: string) {
  const sockets = await io.in(room).fetchSockets();
  const people = new Map<string, { id: string; name: string; image: string | null }>();
  for (const s of sockets)
    people.set(s.data.user.sub, {
      id: s.data.user.sub,
      name: s.data.user.name,
      image: s.data.user.image,
    });
  return [...people.values()];
}

async function broadcastPresence(io: AppServer, room: string) {
  // Only issue rooms show who's looking; project rooms can be busy and nobody needs the list.
  if (!room.includes(":issue:")) return;
  (io as Server).to(room).emit("presence:update", { room, users: await presenceOf(io, room) });
}

/**
 * Rooms: "user:<id>" (joined automatically), "ws:<workspace>:project:<id>" and
 * "ws:<workspace>:issue:<id>". A socket may only join rooms in the workspaces in its token.
 */
export function registerPresenceHandlers(io: AppServer, socket: AppSocket) {
  const { user } = socket.data;
  void socket.join(`user:${user.sub}`);

  (socket as Socket).on("room:join", async (room: unknown) => {
    if (typeof room !== "string" || room.length > 160 || !canJoinRoom(user, room)) {
      logger.warn({ room, userId: user.sub }, "room join refused");
      return;
    }
    await socket.join(room);
    await broadcastPresence(io, room);
  });

  (socket as Socket).on("room:leave", async (room: unknown) => {
    if (typeof room !== "string" || !socket.rooms.has(room)) return;
    await socket.leave(room);
    await broadcastPresence(io, room);
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms].filter((r) => r.includes(":issue:"));
    // After the socket has left, tell the rest who's still there.
    setTimeout(() => rooms.forEach((room) => void broadcastPresence(io, room)), 50);
  });
}
