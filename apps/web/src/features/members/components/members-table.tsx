"use client";

import type { Route } from "next";
import Link from "next/link";
import {
  canAssignRole,
  canRemoveMember,
  ROLE_LABELS,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "@tracklane/core";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchIcon } from "lucide-react";
import { TimeAgo } from "@/components/shared/time-ago";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { initials } from "@/lib/format";
import { removeMemberAction, updateMemberRoleAction } from "../server/actions";
import { Spinner } from "@/components/ui/spinner";

export interface MemberRow {
  id: string;
  role: WorkspaceRole;
  joinedAt: string;
  lastActiveAt: string | null;
  user: { id: string; name: string; email: string; image: string | null };
}

function RoleCell({
  slug,
  member,
  actorRole,
  isSelf,
}: {
  slug: string;
  member: MemberRow;
  actorRole: WorkspaceRole;
  isSelf: boolean;
}) {
  const { execute, isPending } = useAction(updateMemberRoleAction, {
    onSuccess: ({ input }) =>
      toast.success(`${member.user.name} is now ${ROLE_LABELS[input.role]}`),
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't change the role"),
  });
  const options = WORKSPACE_ROLES.filter(
    (r) => r === member.role || canAssignRole(actorRole, member.role, r),
  );

  if (isSelf || options.length <= 1) {
    return <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>;
  }
  return (
    <div className="flex items-center gap-2">
      <Select
        value={member.role}
        disabled={isPending}
        onValueChange={(role) =>
          execute({ slug, memberId: member.id, role: role as WorkspaceRole })
        }
      >
        <SelectTrigger size="sm" className="w-32" aria-label={`Role for ${member.user.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending ? <Spinner aria-label="Saving" /> : null}
    </div>
  );
}

function RemoveButton({
  slug,
  member,
  isSelf,
  workspaceName,
}: {
  slug: string;
  member: MemberRow;
  isSelf: boolean;
  workspaceName: string;
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(removeMemberAction, {
    onSuccess: () => {
      setOpen(false);
      if (!isSelf) toast.success(`Removed ${member.user.name}`);
    },
    onError: ({ error }) => toast.error(error.serverError?.message ?? "Couldn't remove member"),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          {isSelf ? "Leave" : "Remove"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSelf ? `Leave ${workspaceName}?` : `Remove ${member.user.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSelf
              ? "You'll lose access to this workspace until someone invites you again."
              : `${member.user.name} will lose access to ${workspaceName}. Their past work stays.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => execute({ slug, memberId: member.id, leaving: isSelf })}
          >
            {isPending ? <Spinner /> : null}
            {isSelf ? "Leave workspace" : "Remove"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MembersTable({
  slug,
  workspaceName,
  members,
  currentUserId,
  actorRole,
}: {
  slug: string;
  workspaceName: string;
  members: MemberRow[];
  currentUserId: string;
  actorRole: WorkspaceRole;
}) {
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const [q, setQ] = useState("");
  const text = q.trim().toLowerCase();
  const shown = text
    ? members.filter(
        (m) =>
          m.user.name.toLowerCase().includes(text) || m.user.email.toLowerCase().includes(text),
      )
    : members;

  return (
    <div className="space-y-3">
      <InputGroup className="h-8 w-full sm:w-72">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search members"
        />
      </InputGroup>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              <TableHead className="hidden md:table-cell">Last active</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((member) => {
              const isSelf = member.user.id === currentUserId;
              const lastOwner = member.role === "owner" && ownerCount === 1;
              // The last owner can't leave (someone must own the workspace); hide the option.
              const removable = isSelf ? !lastOwner : canRemoveMember(actorRole, member.role);
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {member.user.image ? <AvatarImage src={member.user.image} alt="" /> : null}
                        <AvatarFallback>
                          {initials(member.user.name || member.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          <Link
                            href={`/${slug}/people/${member.user.id}` as Route}
                            className="hover:underline"
                          >
                            {member.user.name}
                          </Link>
                          {isSelf ? (
                            <span className="font-normal text-muted-foreground"> (you)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleCell slug={slug} member={member} actorRole={actorRole} isSelf={isSelf} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {dateFormat.format(new Date(member.joinedAt))}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {member.lastActiveAt ? <TimeAgo date={member.lastActiveAt} /> : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    {removable ? (
                      <RemoveButton
                        slug={slug}
                        member={member}
                        isSelf={isSelf}
                        workspaceName={workspaceName}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
