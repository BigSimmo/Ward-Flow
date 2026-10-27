"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { isTypingTarget } from "./ward-rail-preferences";

const WardShortcutSheet = dynamic(() => import("./ward-shortcut-sheet"));

/**
 * "?" opens the shortcut sheet on any desktop screen (P13). A page with its own "?" list
 * (Handover, Referrals) calls preventDefault, so this waits until every listener has run and
 * leaves those pages alone: there is never a second "?" handler on them.
 */
function shouldOpenShortcutSheet(event: KeyboardEvent): boolean {
  if (event.key !== "?" || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return false;
  if (!areCharacterShortcutsEnabled()) return false;
  return document.querySelector('[role="dialog"][aria-modal="true"]') === null;
}

export function WardShortcutKey() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?") return;
      setTimeout(() => {
        if (shouldOpenShortcutSheet(event)) setOpen(true);
      }, 0);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return open ? <WardShortcutSheet onClose={() => setOpen(false)} /> : null;
}
