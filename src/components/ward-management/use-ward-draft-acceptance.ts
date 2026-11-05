"use client";

import { useLayoutEffect, useMemo, useRef } from "react";

/** A callback owns exactly this mounted opening and content revision, including A → B → A edits. */
export function useWardDraftAcceptance(content: string, open = true) {
  const revision = useMemo(() => ({ content, open }), [content, open]);
  const current = useRef<object | null>(null);
  useLayoutEffect(() => {
    current.current = open ? revision : null;
    return () => {
      current.current = null;
    };
  }, [revision, open]);
  return (onAccepted: () => void) => {
    let consumed = false;
    return () => {
      if (!consumed && current.current === revision) {
        consumed = true;
        onAccepted();
      }
    };
  };
}
