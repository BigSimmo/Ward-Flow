"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/wf";

/**
 * Export (feature 44): one list's "Export" button. `load` imports the list's own builder on the
 * click (so no screen carries it up front) and starts the download; a browser that refuses the
 * file gets the same words as the out-of-area export.
 */
export function ListExportButton({
  load,
  variant = "sec",
  className,
  disabled,
  testId,
}: {
  load: () => Promise<void>;
  variant?: "sec" | "ghost" | "onHero";
  className?: string;
  disabled?: boolean;
  testId?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        icon={Download}
        className={className}
        disabled={disabled}
        aria-label="Export this list as a spreadsheet"
        data-testid={testId}
        onClick={() => {
          setNote(null);
          load().catch(() => setNote("Export is not available in this browser"));
        }}
      >
        Export
      </Button>
      {note ? <span role="status">{note}</span> : null}
    </>
  );
}
