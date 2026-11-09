"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoalDialog } from "./goal-dialog";

export function NewGoalButton({
  slug,
  people,
  currentUserId,
}: {
  slug: string;
  people: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        New goal
      </Button>
      {open ? (
        <GoalDialog
          slug={slug}
          people={people}
          currentUserId={currentUserId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
