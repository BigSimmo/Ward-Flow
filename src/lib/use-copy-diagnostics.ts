"use client";

import { useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { redactLogValue } from "@/lib/privacy";

/**
 * Clipboard diagnostics for the error boundaries. The payload is redacted so
 * clinical `?q=` query text and secrets never leave via the clipboard, and the
 * "Copied" flag resets itself without leaking a timer when the boundary
 * unmounts. Shared by `app/global-error.tsx` (which cannot use app styling or
 * components) and `RouteErrorBoundary`, so both surfaces stay identical in what
 * they emit.
 */
export function useCopyDiagnostics(error: Error & { digest?: string }) {
  const copiedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    return () => {
      if (copiedResetTimerRef.current) clearTimeout(copiedResetTimerRef.current);
    };
  }, []);

  const copyDiagnostics = () => {
    const diagnosticPayload = {
      name: error.name,
      // Owner ruling 13 Oct 2026: copied diagnostics carry IDs only. An error message can quote a
      // patient's name, and no pattern can reliably find every name, so the message is left out;
      // the digest identifies the server-side log entry instead.
      digest: error.digest,
      url: typeof window !== "undefined" ? redactLogValue(window.location.href) : "unknown",
      userAgent: typeof window !== "undefined" ? redactLogValue(window.navigator.userAgent) : "unknown",
      timestamp: new Date().toISOString(),
    };
    void copyTextToClipboard(JSON.stringify(diagnosticPayload, null, 2))
      .then(() => {
        setCopyFailed(false);
        setCopied(true);
        if (copiedResetTimerRef.current) clearTimeout(copiedResetTimerRef.current);
        copiedResetTimerRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopied(false);
        setCopyFailed(true);
      });
  };

  return { copied, copyFailed, copyDiagnostics };
}
