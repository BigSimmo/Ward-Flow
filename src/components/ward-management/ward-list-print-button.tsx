"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/wf";
import { printPage } from "@/components/ward-management/use-printing";

/**
 * A list's Print button: the browser's own print of the page as it shows, as Discharges, the call
 * sheet and the chronology already do. The page's print styles drop the controls; names print in
 * full, as on screen (D-102 keeps names out of downloaded files only). The kit's default size (36px),
 * as the Export beside it. Patients, which offers a choice of prints, uses its own print menu
 * (patient-search.tsx) instead, so the menu stays out of the other pages' scripts.
 */
export function ListPrintButton({
  variant = "sec",
  iconOnly = false,
  disabled,
  testId,
}: {
  variant?: "sec" | "ghost";
  /** The printer alone, named "Print this list": the one phone rule on Movements, Leave and Legal forms. */
  iconOnly?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const shared = {
    variant,
    icon: Printer,
    disabled,
    "aria-label": "Print this list",
    "data-print-hide": true,
    "data-testid": testId,
    onClick: () => printPage(),
  } as const;
  return iconOnly ? <Button {...shared} iconOnly /> : <Button {...shared}>Print</Button>;
}
