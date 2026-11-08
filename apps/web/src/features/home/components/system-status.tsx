import { checkDatabase } from "@tracklane/db";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";

/** Streams in after the static shell: checks the database at request time. */
export async function SystemStatus() {
  await connection();
  const database = await checkDatabase();

  return (
    <ul className="space-y-3 text-sm">
      <li className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {database.ok ? (
            <CircleCheckIcon className="size-4 text-status-done" aria-hidden="true" />
          ) : (
            <CircleXIcon className="size-4 text-destructive" aria-hidden="true" />
          )}
          Database
        </span>
        {database.ok ? (
          <Badge variant="secondary" className="font-mono">
            {database.latencyMs} ms
          </Badge>
        ) : (
          <Badge variant="destructive">Unreachable</Badge>
        )}
      </li>
      {!database.ok ? (
        <li className="text-xs text-muted-foreground">
          Run <code className="font-mono">pnpm db:up</code> and check DATABASE_URL in .env.
        </li>
      ) : null}
    </ul>
  );
}
