"use client";

import type { ReactNode } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { Button, Icon, Menu, heroChipClassName } from "@/components/wf";
import { printPage, type PrintScope } from "@/components/ward-management/use-printing";

/** One way to print a list, offered in the Print menu: the whole list, or a scope of it. */
export type ListPrintChoice = {
  id: string;
  label: string;
  /** Right-aligned, such as "411 people". */
  meta?: ReactNode;
  /** Absent for the whole list as the page shows it. */
  scope?: PrintScope;
};

/**
 * A list's Print button: the browser's own print of the page as it shows, as Discharges, the call
 * sheet and the chronology already do. The page's print styles drop the controls; names print in
 * full, as on screen (D-102 keeps names out of downloaded files only). The kit's default size (36px),
 * as the Export beside it.
 *
 * With `choices` it is a kit Menu headed "Print" (Patients, 18 Nov 2026: the whole list or the short
 * ED and placement sheet). `look="chip"` draws the trigger as a hero quick chip, for the phone header.
 */
export function ListPrintButton({
  variant = "sec",
  iconOnly = false,
  disabled,
  testId,
  choices,
  look = "button",
}: {
  variant?: "sec" | "ghost";
  /** The printer alone, named "Print this list": the one phone rule on Movements, Leave and Legal forms. */
  iconOnly?: boolean;
  disabled?: boolean;
  testId?: string;
  choices?: readonly ListPrintChoice[];
  look?: "button" | "chip";
}) {
  if (choices && choices.length > 0) {
    return (
      <Menu
        label="Print"
        align="end"
        items={[
          { kind: "heading", id: "print-heading", label: "Print" },
          ...choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            meta: choice.meta,
            onSelect: () => printPage(choice.scope ?? null),
          })),
        ]}
        trigger={(props) =>
          look === "chip" ? (
            <button {...props} type="button" className={heroChipClassName} data-print-hide data-testid={testId}>
              <Icon icon={Printer} size={16} />
              <span>Print</span>
              <Icon icon={ChevronDown} size={14} />
            </button>
          ) : (
            <Button
              {...props}
              variant={variant}
              icon={Printer}
              iconEnd={ChevronDown}
              disabled={disabled}
              data-print-hide
              data-testid={testId}
            >
              Print
            </Button>
          )
        }
      />
    );
  }
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
