"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FileText } from "lucide-react";

import { Button } from "@/components/wf";

import type { HandoverDigestAction, HandoverDigestInput } from "./handover-digest-model";

/* Feature 15: the Shift digest loads only when opened, so the Handover first load stays as it was. */
const HandoverDigestSheet = dynamic(() => import("./handover-digest-sheet").then((m) => m.HandoverDigestSheet), {
  loading: () => null,
});

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
  return [open, setOpen];
}

/** The hero's secondary Digest button, beside Start meeting. */
export function HandoverDigestButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <Button
      variant="onHero"
      size="sm"
      icon={FileText}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
      data-testid="ward-handover-digest-open"
    >
      Digest
    </Button>
  );
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
            ?.scrollIntoView({ block: "start", behavior: "smooth" }),
        );
      }}
    />
  );
}
