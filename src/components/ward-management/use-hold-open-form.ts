"use client";

import { useEffect } from "react";
import { holdOpenForm } from "@/components/wf/sheet-focus";

/**
 * Audit CS3-01: while an inline edit form is open, a save from it is checked against the board it
 * opened on, as a popup's is, so another desk's change meanwhile is reported, not overwritten.
 * `scope` names the form's place on the page (mark it `data-held-form={scope}`), so a save made
 * elsewhere on the page is not checked against this form. One hold per form, so opening one never
 * moves another's basis to a newer board.
 */
export function useHoldOpenForm(open: boolean, scope?: string) {
  useEffect(() => (open ? holdOpenForm(scope) : undefined), [open, scope]);
}
