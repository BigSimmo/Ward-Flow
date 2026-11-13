"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { createContext, useContext } from "react";

/**
 * Once this session holds typed text, whether its submitted demonstration state still saves on this
 * device (`undefined` before then, and outside the local demonstration). Since 21 Oct 2026 (Josh, fix
 * plan item 2) typed text no longer stops the save: the rest of the day is kept and typed fields read
 * "Typed text not kept on this device" after a reload. Saving stops only when that copy cannot be
 * made safely. Session draft recovery is separate.
 */
export const WardDemoNotSavedContext = createContext<boolean | undefined>(undefined);

// The note's code (`ward-demo-saving-note.tsx`) loads only once there is something to say, which
// keeps it off every page's first load (Josh, 21 Oct 2026: no phone script budget raises). `loading`
// gives it its own Suspense boundary: without one, the first typed entry suspended the whole page
// while the note's code arrived, and the control just pressed could briefly show twice.
const WardDemoSavingNote = dynamic(
  withLoadRetry(() => import("./ward-demo-saving-note").then((module) => module.WardDemoSavingNote)),
  { loading: () => null },
);

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
