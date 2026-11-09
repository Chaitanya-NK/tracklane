"use client";

import "@excalidraw/excalidraw/index.css";
import type * as ExcalidrawLib from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { CloudCheckIcon, CloudUploadIcon, TriangleAlertIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useAction } from "next-safe-action/hooks";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "@/components/shared/realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { saveWhiteboardAction } from "../server/actions";

const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

type ExcalidrawModule = typeof ExcalidrawLib;
type Elements = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>["onChange"]>>[0];

const COLORS = ["#e8590c", "#1971c2", "#2f9e44", "#9c36b5", "#c2255c", "#0c8599"];
const colorFor = (id: string) =>
  COLORS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length]!;

/**
 * An Excalidraw board kept in step live: local changes go to everyone in the room through the
 * realtime server (merged with `reconcileElements`), and are saved a couple of seconds after
 * the last edit.
 */
export function WhiteboardCanvas({
  slug,
  id,
  room,
  initialScene,
  canEdit,
}: {
  slug: string;
  id: string;
  room: string;
  initialScene: { elements?: unknown[]; viewBackgroundColor?: string };
  canEdit: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const { socket, userId } = useRealtime();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const save = useAction(saveWhiteboardAction);
  const sentVersion = useRef(-1);
  const savedVersion = useRef(-1);
  const applyingRemote = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBroadcast = useRef(0);
  const helpers = useRef<ExcalidrawModule | null>(null);

  useEffect(() => {
    void import("@excalidraw/excalidraw").then((m) => {
      helpers.current = m;
    });
  }, []);

  const persist = useCallback(
    async (elements: Elements, background: string) => {
      setStatus("saving");
      const res = await save.executeAsync({
        slug,
        id,
        scene: {
          elements: elements as unknown as Record<string, unknown>[],
          viewBackgroundColor: background,
        },
      });
      setStatus(res?.data ? "saved" : "error");
    },
    [save, slug, id],
  );

  // Join the room, and merge what others draw.
  useEffect(() => {
    if (!socket || !api) return;
    const join = () => socket.emit("room:join", room);
    join();
    socket.on("connect", join);
    const onUpdate = (data: { room: string; elements: Elements }) => {
      const m = helpers.current;
      if (data.room !== room || !m) return;
      const merged = m.reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        data.elements as Parameters<typeof m.reconcileElements>[1],
        api.getAppState(),
      );
      applyingRemote.current = true;
      api.updateScene({ elements: merged, captureUpdate: m.CaptureUpdateAction.NEVER });
      sentVersion.current = m.getSceneVersion(merged);
      applyingRemote.current = false;
    };
    const collaborators = new Map<
      string,
      {
        username: string;
        pointer: { x: number; y: number; tool: "pointer" };
        color: { background: string; stroke: string };
      }
    >();
    const onPointer = (data: {
      room: string;
      from: { id: string; name: string };
      pointer: { x: number; y: number };
    }) => {
      if (data.room !== room || data.from.id === userId) return;
      const c = colorFor(data.from.id);
      collaborators.set(data.from.id, {
        username: data.from.name,
        pointer: { ...data.pointer, tool: "pointer" },
        color: { background: c, stroke: c },
      });
      api.updateScene({ collaborators: new Map(collaborators) as never });
    };
    socket.on("whiteboard:update", onUpdate);
    socket.on("whiteboard:pointer", onPointer);
    return () => {
      socket.off("connect", join);
      socket.off("whiteboard:update", onUpdate);
      socket.off("whiteboard:pointer", onPointer);
      socket.emit("room:leave", room);
    };
  }, [socket, api, room, userId]);

  // Save anything pending when leaving the page.
  const pending = useRef<{ elements: Elements; background: string } | null>(null);
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      if (pending.current)
        void persistRef.current(pending.current.elements, pending.current.background);
    },
    [],
  );

  return (
    <div className="relative h-full w-full">
      <div
        className="pointer-events-none absolute right-3 bottom-16 z-10 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm"
        role="status"
      >
        {status === "saving" ? (
          <>
            <CloudUploadIcon className="size-3.5" /> Saving…
          </>
        ) : status === "error" ? (
          <>
            <TriangleAlertIcon className="size-3.5 text-destructive" /> Not saved
          </>
        ) : (
          <>
            <CloudCheckIcon className="size-3.5" /> Saved
          </>
        )}
      </div>
      <Excalidraw
        excalidrawAPI={setApi}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        viewModeEnabled={!canEdit}
        isCollaborating
        initialData={{
          elements: (initialScene.elements ?? []) as never,
          appState: { viewBackgroundColor: initialScene.viewBackgroundColor ?? "#ffffff" },
          scrollToContent: true,
        }}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
        onPointerUpdate={({ pointer }) => {
          if (!socket) return;
          const now = Date.now();
          if (now - lastBroadcast.current < 50) return;
          lastBroadcast.current = now;
          socket.emit("whiteboard:pointer", { room, pointer: { x: pointer.x, y: pointer.y } });
        }}
        onChange={(elements, appState) => {
          const m = helpers.current;
          if (!m || applyingRemote.current || !canEdit) return;
          const version = m.getSceneVersion(elements);
          if (savedVersion.current === -1) {
            // First call is the initial scene.
            savedVersion.current = version;
            sentVersion.current = version;
            return;
          }
          if (version === sentVersion.current) return;
          sentVersion.current = version;
          socket?.emit("whiteboard:update", { room, elements });
          clearTimeout(saveTimer.current);
          setStatus("saving");
          pending.current = { elements, background: appState.viewBackgroundColor };
          saveTimer.current = setTimeout(() => {
            savedVersion.current = version;
            pending.current = null;
            void persist(elements, appState.viewBackgroundColor);
          }, 1500);
        }}
      />
    </div>
  );
}
