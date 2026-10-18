"use client";

import { useRef, useState } from "react";

/**
 * Clipboard copy for the Legal forms screen. `copied` names the last successful copy for two
 * seconds; `copyNotice` explains a refused or unavailable clipboard. A newer attempt supersedes
 * an older one, so a slow write never shows "Copied" for the wrong button.
 */
export function useLegalFormsCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const copyAttemptRef = useRef(0);
  const copyText = async (key: string, text: string) => {
    const attempt = ++copyAttemptRef.current;
    setCopied(null);
    setCopyNotice(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (copyAttemptRef.current !== attempt) return;
      setCopied(key);
      window.setTimeout(() => {
        if (copyAttemptRef.current === attempt) setCopied(null);
      }, 2000);
    } catch {
      if (copyAttemptRef.current === attempt) setCopyNotice("Could not copy. Check clipboard access and try again.");
    }
  };
  return { copied, copyNotice, copyText };
}
