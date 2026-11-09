"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/wf";
import { DownloadRefusedError } from "./ward-download";

/**
 * Export (feature 44): one list's "Export" button. `load` imports the list's own builder on the
 * click (so no screen carries it up front) and starts the download; a browser that refuses the
 * file gets the same words as the out-of-area export, and any other failure says to try again.
 * The button is busy until the file is handed over, so a double-click exports once.
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
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        icon={Download}
        className={className}
        disabled={disabled}
        loading={pending}
        aria-label="Export this list as a spreadsheet"
        data-testid={testId}
        onClick={() => {
          if (pending) return;
          setNote(null);
          setPending(true);
          load()
            .catch((error: unknown) => {
              if (error instanceof DownloadRefusedError) {
                setNote("Export is not available in this browser");
                return;
              }
              console.error("List export failed", error);
              setNote("Export failed. Try again.");
            })
            .finally(() => setPending(false));
        }}
      >
        Export
      </Button>
      {/* Always present, so a screen reader announces the note when it arrives. */}
      <span role="status">{note}</span>
    </>
  );
}
