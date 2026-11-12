"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";

import type { HandoverDigestAction, HandoverDigestInput } from "./handover-digest-model";

/* Feature 15: the Shift digest loads only when opened, so the Handover first load stays as it was. */
const HandoverDigestSheet = dynamic(
  withLoadRetry(() => import("./handover-digest-sheet").then((m) => m.HandoverDigestSheet)),
  {
    loading: () => null,
  },
);

/**
 * Whether the Shift digest is open. `?digest=1` (the rail's "Read digest" near handover) opens it,
 * on arrival and when the link is followed while already on Handover.
 */
export function useHandoverDigestOpen(digestParam: boolean): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(digestParam);
  const [seenParam, setSeenParam] = useState(digestParam);
  if (digestParam !== seenParam) {
    setSeenParam(digestParam);
    if (digestParam) setOpen(true);
  }
  const set = useCallback((next: boolean) => {
    setOpen(next);
    if (next) return;
    // Closing drops `?digest=1`, so following "Read digest" again reopens it.
    const url = new URL(window.location.href);
    if (!url.searchParams.has("digest")) return;
    url.searchParams.delete("digest");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  return [open, set];
}

/** The digest sheet, mounted only while open. Showing replies scrolls to the promises card. */
export function HandoverDigestSlot({
  input,
  onClose,
  onAction,
}: {
  input: HandoverDigestInput | null;
  onClose: () => void;
  onAction: (action: HandoverDigestAction) => void;
}) {
  if (input === null) return null;
  return (
    <HandoverDigestSheet
      open
      input={input}
      onClose={onClose}
      onAction={(action) => {
        onClose();
        onAction(action);
        if (action.kind !== "replies") return;
        window.requestAnimationFrame(() =>
          document
            .querySelector('[data-testid="ward-handover-open-promises"]')
            ?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() }),
        );
      }}
    />
  );
}
