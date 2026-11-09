"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRealtime } from "./realtime-provider";

/**
 * Joins realtime rooms while mounted and re-fetches the page when someone else changes something
 * in them (debounced, so a bulk edit is one refresh). Renders nothing.
 */
export function LiveRefresh({ rooms }: { rooms: string[] }) {
  const { socket, userId } = useRealtime();
  const router = useRouter();
  const key = rooms.join("|");

  useEffect(() => {
    if (!socket) return;
    const list = key.split("|").filter(Boolean);
    const join = () => list.forEach((room) => socket.emit("room:join", room));
    join();
    socket.on("connect", join);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (data: { actorId: string | null }) => {
      if (data.actorId === userId) return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    socket.on("issue:changed", onChange);
    socket.on("room:changed", onChange);
    return () => {
      clearTimeout(timer);
      socket.off("connect", join);
      socket.off("issue:changed", onChange);
      socket.off("room:changed", onChange);
      list.forEach((room) => socket.emit("room:leave", room));
    };
  }, [socket, key, router, userId]);

  return null;
}

interface Viewer {
  id: string;
  name: string;
  image: string | null;
}

/** Avatars of other people in the same room (issue, doc, retro…) right now. */
export function Viewers({ room }: { room: string }) {
  const { socket, userId } = useRealtime();
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    if (!socket) return;
    const onPresence = (data: { room: string; users: Viewer[] }) => {
      if (data.room === room) setViewers(data.users);
    };
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("presence:update", onPresence);
    };
  }, [socket, room]);

  const others = viewers.filter((v) => v.id !== userId);
  if (!others.length) return null;
  const names = others.map((v) => v.name).join(", ");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex -space-x-1.5 pr-1" aria-label={`Also viewing: ${names}`} role="group">
          {others.slice(0, 4).map((v) => (
            <UserAvatar key={v.id} user={v} className="size-6 ring-2 ring-background" />
          ))}
          {others.length > 4 ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] ring-2 ring-background">
              +{others.length - 4}
            </span>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent>Also viewing: {names}</TooltipContent>
    </Tooltip>
  );
}
