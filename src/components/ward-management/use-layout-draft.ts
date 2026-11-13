"use client";

import { useEffect, useState } from "react";

/**
 * C19 (design critique v2, Josh 13 Nov 2026): a form's unsaved entries survive the screen crossing
 * the phone width. The phone and wide layouts are separate component trees, so the switch unmounts
 * one form and mounts its twin, and each kept its entries in its own local state.
 *
 * The open form writes its draft here on every render. The twin reads it while it renders, which
 * React does before it runs the old form's clean-up, and the clean-up then deletes the entry. So a
 * draft lives only across that one switch: closing the form, saving it or leaving the page drops
 * it, as before, and nothing is written to the browser's storage. Changes no clinical rule.
 */
const drafts = new Map<string, unknown>();

/**
 * The draft the same form left at the moment of a layout switch, or `undefined`. Call it before the
 * form's own `useState`s and start them from it. `key` names one form for one record (for example
 * `observation:<stay id>`), or is `undefined` where the form has no twin.
 */
export function useKeptLayoutDraft<T>(key: string | undefined): T | undefined {
  const [kept] = useState(() => (key === undefined ? undefined : (drafts.get(key) as T | undefined)));
  useEffect(
    () => () => {
      if (key !== undefined) drafts.delete(key);
    },
    [key],
  );
  return kept;
}

/** Keeps the form's current entries while it is open (`draft`), and drops them while it is closed (`undefined`). */
export function useKeepLayoutDraft<T>(key: string | undefined, draft: T | undefined): void {
  useEffect(() => {
    if (key === undefined) return;
    if (draft === undefined) drafts.delete(key);
    else drafts.set(key, draft);
  });
}
