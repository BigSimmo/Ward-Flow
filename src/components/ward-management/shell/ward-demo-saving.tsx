"use client";

import { createContext, useContext } from "react";

import { WardDemoSavingNote } from "./ward-demo-saving-note";

/**
 * Once this session holds typed text, whether its submitted demonstration state still saves on this
 * device (`undefined` before then, and outside the local demonstration). Since 21 Oct 2026 (Josh, fix
 * plan item 2) typed text no longer stops the save: the rest of the day is kept and typed fields read
 * "Typed text not kept on this device" after a reload. Saving stops only when that copy cannot be
 * made safely. Session draft recovery is separate.
 */
export const WardDemoNotSavedContext = createContext<boolean | undefined>(undefined);

// The note is part of the first load (Audit 4 A4-02, 13 Nov 2026). It used to load only once there
// was something to say, so with the connection down, which is when saving fails, the "not saved"
// note could not arrive. It is two short lines of text, so it costs the first load next to nothing.

/**
 * The note once saving has stopped. It outranks every other pinned note, broadcasts included (Josh,
 * 5 Nov 2026, audit SD-02): it warns of lost work, so the layout mounts it first.
 */
export function WardDemoNotSavedNote() {
  const saving = useContext(WardDemoNotSavedContext);
  return saving === false ? <WardDemoSavingNote saving={false} /> : null;
}

/** The quieter note while the day still saves except typed text. It keeps the lowest rank. */
export function WardDemoTypedTextNote() {
  const saving = useContext(WardDemoNotSavedContext);
  return saving === true ? <WardDemoSavingNote saving /> : null;
}
