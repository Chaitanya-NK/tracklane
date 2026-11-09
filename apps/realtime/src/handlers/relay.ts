import type { Socket } from "socket.io";

/** Whiteboard messages are relayed between people in the same room without touching the database. */
const RELAYED = ["whiteboard:update", "whiteboard:pointer"] as const;

/**
 * Forwards live-collaboration messages to everyone else in a room the sender has joined.
 * Saving is the web app's job (debounced server action); this only keeps screens in step.
 */
export function registerRelayHandlers(socket: Socket) {
  const { user } = socket.data as { user: { sub: string; name: string } };
  for (const event of RELAYED) {
    socket.on(event, (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const { room } = payload as { room?: unknown };
      if (typeof room !== "string" || !room.includes(":whiteboard:") || !socket.rooms.has(room))
        return;
      socket.to(room).emit(event, { ...payload, from: { id: user.sub, name: user.name } });
    });
  }
}
