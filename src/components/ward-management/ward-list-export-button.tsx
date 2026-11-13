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
  iconOnly = false,
  className,
  disabled,
  testId,
}: {
  load: () => Promise<void>;
  variant?: "sec" | "ghost" | "onHero";
  /** The download icon alone, keeping its spoken name: the one phone rule beside an icon-only Print. */
  iconOnly?: boolean;
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
        icon={Download}
        iconOnly={iconOnly}
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
        {iconOnly ? null : "Export"}
      </Button>
      {/* Always present, so a screen reader announces the note when it arrives. Visually hidden while
          empty, so it takes no gap in a flex row and the button sits flush with the row's right edge. */}
      <span role="status" className={note ? undefined : "sr-only"}>
        {note}
      </span>
    </>
  );
}
