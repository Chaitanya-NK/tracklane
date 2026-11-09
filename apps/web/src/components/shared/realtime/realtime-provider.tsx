"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createContext, use, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

const RealtimeContext = createContext<{ socket: Socket | null; userId: string }>({
  socket: null,
  userId: "",
});

async function fetchToken() {
  const res = await fetch("/api/realtime-token", { cache: "no-store" });
  if (!res.ok) throw new Error("realtime token");
  return ((await res.json()) as { token: string }).token;
}

/**
 * One socket per tab, through the web app's own origin (/api/realtime is proxied to the
 * realtime server), so it works behind Codespaces port forwarding. Shows a toast for new
 * notifications and refreshes the page so counts update.
 */
export function RealtimeProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const s = io({
      path: "/api/realtime",
      addTrailingSlash: false,
      // Long-polling first: it works through every proxy; upgrades to WebSocket when possible.
      transports: ["polling", "websocket"],
      auth: (cb) => {
        fetchToken().then(
          (token) => cb({ token }),
          () => cb({}),
        );
      },
      reconnectionDelayMax: 10_000,
    });
    s.on("notification:new", (data: { title: string; url: string }) => {
      toast.info(data.title, {
        action: { label: "Open", onClick: () => routerRef.current.push(data.url as Route) },
      });
      routerRef.current.refresh();
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the socket lives as long as the tab
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  return <RealtimeContext value={{ socket, userId }}>{children}</RealtimeContext>;
}

export function useRealtime() {
  return use(RealtimeContext);
}
