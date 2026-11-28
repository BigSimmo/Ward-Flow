"use client";

import type { ReactNode } from "react";
import type { PrintScope } from "@/components/ward-management/use-printing";

/** One way to print a list, offered in the Print menu: the whole list, or a scope of it. */
export type ListPrintChoice = {
  id: string;
  label: string;
  /** Right-aligned, such as "411 people". */
  meta?: ReactNode;
  /** Absent for the whole list as the page shows it. */
  scope?: PrintScope;
  /** Nobody to print: the choice stays in the menu and says why in `meta`, and does not print. */
  disabled?: boolean;
};

/**
 * Patients' two print choices with their people counts (D-267). A choice with nobody in it is not
 * printable and says "Nobody to print" instead of "0 people". At phone width only the short sheet
 * is offered: the phone list folds each group to its first rows, so a whole-list print from a phone
 * would leave people out (19 Nov 2026 audit).
 */
export function patientPrintChoices({
  wholePeople,
  shortPeople,
  phone,
}: {
  wholePeople: number;
  shortPeople: number;
  phone: boolean;
}): ListPrintChoice[] {
  const choice = (id: string, label: string, people: number, scope?: PrintScope): ListPrintChoice => ({
    id,
    label,
    meta: people === 0 ? "Nobody to print" : `${people} ${people === 1 ? "person" : "people"}`,
    scope,
    disabled: people === 0,
  });
  const short = choice("ed-placement", "ED and placement only", shortPeople, "ed-placement");
  return phone ? [short] : [choice("whole", "Whole list", wholePeople), short];
}
