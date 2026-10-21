"use client";

import dynamic from "next/dynamic";
import { createContext, useContext } from "react";

/** Presentation only: the provider still owns recovery and its exact explanatory wording. */
export const WardRecoveryNoticeContext = createContext<string | null>(null);

/** How long a routine restore notice stays before it fades. */
const ROUTINE_NOTICE_MS = 8_000;

// Most loads have no notice, so its code (`ward-recovery-notice-body.tsx`) loads only when there is
// one, which keeps it off every page's first load (Josh, 21 Oct 2026: no phone script budget raises).
const WardRecoveryNoticeBody = dynamic(() =>
  import("./ward-recovery-notice-body").then((module) => module.WardRecoveryNoticeBody),
);

/** Recovery feedback in the shell's existing status area (`ward-recovery-notice-body.tsx`). */
export function WardRecoveryNotice() {
  const notice = useContext(WardRecoveryNoticeContext);
  return notice ? <WardRecoveryNoticeBody notice={notice} fadeAfterMs={ROUTINE_NOTICE_MS} /> : null;
}
