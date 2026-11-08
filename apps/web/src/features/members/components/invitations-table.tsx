"use client";

import { ROLE_LABELS, type WorkspaceRole } from "@tracklane/core";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revokeInvitationAction } from "../server/actions";

export interface InvitationRow {
  id: string;
  email: string;
  role: WorkspaceRole;
  invitedByName: string;
  expiresAt: string;
}

function RevokeButton({ slug, invitation }: { slug: string; invitation: InvitationRow }) {
  const { execute, isPending } = useAction(revokeInvitationAction, {
    onSuccess: () => toast.success(`Revoked invitation for ${invitation.email}`),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't revoke invitation"),
  });
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => execute({ slug, invitationId: invitation.id })}
    >
      Revoke
    </Button>
  );
}

export function InvitationsTable({
  slug,
  invitations,
}: {
  slug: string;
  invitations: InvitationRow[];
}) {
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="hidden md:table-cell">Invited by</TableHead>
            <TableHead className="hidden md:table-cell">Expires</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell className="font-medium">{invitation.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {invitation.invitedByName}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {dateFormat.format(new Date(invitation.expiresAt))}
              </TableCell>
              <TableCell className="text-right">
                <RevokeButton slug={slug} invitation={invitation} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
