"use client";

import { useEffect, useRef, useState } from "react";

import { useOptionalToast } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

/**
 * Clipboard copy for the Legal forms screen. `copied` names the last successful copy for two
 * seconds; `copyNotice` explains a refused or unavailable clipboard. A newer attempt supersedes
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
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        if (copyAttemptRef.current === attempt) setCopied(null);
      }, 2000);
    } catch {
      if (copyAttemptRef.current !== attempt) return;
      setCopyNotice("Could not copy. Check clipboard access and try again.");
      toast?.push({ tone: "warning", title: "Could not copy", body: "Check clipboard access and try again." });
    }
  };
  return { copied, copyNotice, copyText };
}
