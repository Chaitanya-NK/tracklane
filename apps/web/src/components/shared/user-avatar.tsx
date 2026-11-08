import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AvatarUser {
  name: string;
  image?: string | null;
}

export function UserAvatar({ user, className }: { user: AvatarUser; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
    </Avatar>
  );
}
