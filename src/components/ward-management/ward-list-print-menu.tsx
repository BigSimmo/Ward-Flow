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
 * Patients' Print: a kit Menu headed "Print" offering the whole list or the short ED and placement
 * sheet (D-267, 18 Nov 2026). `look="chip"` draws the trigger as a hero quick chip, for the phone
 * header. Kept apart from `ListPrintButton` so the menu loads only on Patients.
 */
export function ListPrintMenu({
  variant = "sec",
  disabled,
  testId,
  choices,
  look = "button",
}: {
  variant?: "sec" | "ghost";
  disabled?: boolean;
  testId?: string;
  choices: readonly ListPrintChoice[];
  look?: "button" | "chip";
}) {
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
