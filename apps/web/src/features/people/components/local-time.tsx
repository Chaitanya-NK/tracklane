"use client";

import { useSyncExternalStore } from "react";
import { APP_LOCALE } from "@/config/locale";

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

/** "4:05 pm local time (Asia/Kolkata)", ticking. Renders nothing on the server. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const time = useSyncExternalStore(
    subscribe,
    () =>
      new Intl.DateTimeFormat(APP_LOCALE, { timeZone, hour: "numeric", minute: "2-digit" }).format(
        new Date(),
      ),
    () => null,
  );
  if (!time) return null;
  return (
    <span>
      {time} local time{" "}
      <span className="text-muted-foreground">({timeZone.replaceAll("_", " ")})</span>
    </span>
  );
}
