"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { bindWardPartialView, type BoundWardPartialView } from "./ward-partial-view-contract";

const PartialViewContext = createContext<BoundWardPartialView | null>(null);

/** Display-only response sibling. The lifetime must come from the current outer snapshot.
 * No retained state: role changes, missing data or a mismatched revision/context expose null
 * on that render. Neither this context nor a structurally valid response grants an action. */
export function WardPartialViewProvider({
  response,
  currentRevision,
  currentAccessContext,
  children,
}: {
  response: unknown;
  currentRevision: number | null;
  currentAccessContext: string | null;
  children?: ReactNode;
}) {
  const value = useMemo(
    () => bindWardPartialView(response, { revision: currentRevision, accessContext: currentAccessContext }),
    [response, currentRevision, currentAccessContext],
  );
  return <PartialViewContext.Provider value={value}>{children}</PartialViewContext.Provider>;
}

export function useWardPartialView(): BoundWardPartialView | null {
  return useContext(PartialViewContext);
}
