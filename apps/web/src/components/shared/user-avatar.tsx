import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface AvatarUser {
  name: string;
  image?: string | null;
}

export function UserAvatar({
  user,
  className,
  fallbackClassName,
}: {
  user: AvatarUser;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={cn("size-6", className)}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback className={cn("text-[10px]", fallbackClassName)}>
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
