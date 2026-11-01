"use client";

import { useEffect, useRef, useState } from "react";

import { useOptionalToast } from "@/components/wf";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

/**
 * Clipboard copy for the Legal forms screen. `copied` names the last successful copy for two
 * seconds, and the result is announced; `copyNotice` explains a refused or unavailable clipboard. A newer attempt supersedes
 * an older one, so a slow write never shows "Copied" for the wrong button. A failure is also a
 * warning toast, because the phone sheet and tablet drawer cover the screen's own status line.
 */
export function useLegalFormsCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const copyAttemptRef = useRef(0);
  const copiedTimerRef = useRef<number | null>(null);
  const toast = useOptionalToast();
  // The "Copied" timer must not fire after the screen has gone.
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    },
    [],
  );
  const copyText = async (key: string, text: string) => {
    const attempt = ++copyAttemptRef.current;
    setCopied(null);
    setCopyNotice(null);
    try {
      await copyTextToClipboard(text);
      if (copyAttemptRef.current !== attempt) return;
      setCopied(key);
      // Said aloud as well as shown on the button (design audit, Josh 1 Nov 2026).
      announceToWardShell("Copied to the clipboard.");
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        if (copyAttemptRef.current === attempt) setCopied(null);
      }, 2000);
    } catch {
      if (copyAttemptRef.current !== attempt) return;
      setCopyNotice("Could not copy. Check clipboard access and try again.");
      // The toast region reads its own words out; without one, the announcer says the failure.
      if (toast)
        toast.push({ tone: "warning", title: "Could not copy", body: "Check clipboard access and try again." });
      else announceToWardShell("Could not copy. Check clipboard access and try again.");
    }
  };
  return { copied, copyNotice, copyText };
}
