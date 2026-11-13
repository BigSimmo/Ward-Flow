"use client";

import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/wf";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

/**
 * Item 27 (10 Nov 2026): the letter's "Copy to notes", for an acceptance or a transfer. The text is
 * built when pressed, from the record as it stands, through the one clipboard helper.
 */
export function CopyNotesButton({ text, testId }: { text: () => string; testId: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="sec"
      size="md"
      icon={Copy}
      data-testid={testId}
      onClick={() => {
        void copyTextToClipboard(text()).then(
          () => {
            setCopied(true);
            announceToWardShell("Copied for the notes");
          },
          () => announceToWardShell("Copy unavailable in this browser"),
        );
      }}
    >
      {copied ? "Copied" : "Copy to notes"}
    </Button>
  );
}
