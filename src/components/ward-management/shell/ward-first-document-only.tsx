"use client";

import { useEffect, useState, type ReactNode } from "react";

// The layout's early inline scripts (ward-early-tap.ts, ward-rail-early.ts) only do anything while
// the browser parses the first HTML. React never runs a <script> it creates itself, and in
// development it logs "Encountered a script tag while rendering React component" when it does, which
// shows as Next's "1 Issue" badge. That happens whenever the shell remounts on the client: a restored
// saved day or a shared-workspace sign-in changes WardFlowProvider's screen key. This wrapper renders
// its children for the server render and hydration only, so a later remount draws nothing. The
// script element itself stays server-built, so its CSP nonce handling is unchanged.

let firstDocumentCommitted = false;

export function WardFirstDocumentOnly({ children }: { children: ReactNode }) {
  const [inFirstDocument] = useState(() => !firstDocumentCommitted);
  useEffect(() => {
    firstDocumentCommitted = true;
  }, []);
  return inFirstDocument ? children : null;
}
