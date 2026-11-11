"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/wf";

/**
 * A list's Print button: the browser's own print of the page as it shows, as Discharges, the call
 * sheet and the chronology already do. The page's print styles drop the controls; names print in
 * full, as on screen (D-102 keeps names out of downloaded files only).
 */
export function ListPrintButton({
  variant = "sec",
  disabled,
  testId,
}: {
  variant?: "sec" | "ghost";
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      icon={Printer}
      disabled={disabled}
      aria-label="Print this list"
      data-print-hide
      data-testid={testId}
      onClick={() => window.print()}
    >
      Print
    </Button>
  );
}
