"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/** A secret shown once, with a copy button. */
export function CopySecret({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <InputGroup>
      <InputGroupInput
        readOnly
        value={value}
        aria-label={label}
        className="font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label="Copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              toast.success("Copied");
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error("Couldn't copy. Select the text instead.");
            }
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
