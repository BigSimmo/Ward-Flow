"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  bindWardPartialView,
  copyWardPartialView,
  type BoundWardPartialView,
  type LocalWardPartialDisplay,
  type WardPartialView,
} from "./ward-partial-view-contract";

const PartialViewContext = createContext<BoundWardPartialView | null>(null);
const PartialDisplayContext = createContext<WardPartialView | null>(null);
const PartialDisplayHostContext = createContext({ shared: false, previewAllowed: false });

/** Host capability only: supplied by the actual connection, never inferred from display metadata. */
export function useWardPartialDisplayHost() {
  return useContext(PartialDisplayHostContext);
}

/** Display-only response sibling. The lifetime must come from the current outer snapshot.
 * No retained state: role changes, missing data or a mismatched revision/context expose null
 * on that render. Neither this context nor a structurally valid response grants an action. */
export function WardPartialViewProvider({
  response,
  currentRevision,
  currentAccessContext,
  shared = true,
  previewAllowed = false,
  children,
}: {
  response: unknown;
  currentRevision: number | null;
  currentAccessContext: string | null;
  shared?: boolean;
  previewAllowed?: boolean;
  children?: ReactNode;
}) {
  const value = useMemo(
    () =>
      shared && !previewAllowed
        ? bindWardPartialView(response, { revision: currentRevision, accessContext: currentAccessContext })
        : null,
    [response, currentRevision, currentAccessContext, shared, previewAllowed],
  );
  // A coordinator legitimately receives no sibling. Its explicit preview capability comes
  // from the actual adopted full snapshot, not from a ward/manager's unavailable summary.
  const host = useMemo(
    () => ({
      shared,
      previewAllowed:
        shared &&
        previewAllowed &&
        response === undefined &&
        Number.isSafeInteger(currentRevision) &&
        currentRevision !== null &&
        currentRevision > 0 &&
        typeof currentAccessContext === "string" &&
        /^[a-f0-9]{64}$/u.test(currentAccessContext),
    }),
    [shared, previewAllowed, response, currentRevision, currentAccessContext],
  );
  return (
    <PartialDisplayHostContext.Provider value={host}>
      <PartialViewContext.Provider value={value}>
        <PartialDisplayContext.Provider value={value?.view ?? null}>{children}</PartialDisplayContext.Provider>
      </PartialViewContext.Provider>
    </PartialDisplayHostContext.Provider>
  );
}

export function useWardPartialView(): BoundWardPartialView | null {
  return useContext(PartialViewContext);
}

/** A shared ward/manager's unavailable host shadows local sources; only an authorised coordinator preview may
 * replace a shared display. The preview remains separate from the authenticated Bound hook. */
export function WardLocalPartialViewProvider({
  display,
  children,
}: {
  display: LocalWardPartialDisplay;
  children?: ReactNode;
}) {
  const host = useWardPartialDisplayHost();
  const allowed = !host.shared
    ? display.source === "local"
    : host.previewAllowed && display.source === "coordinator-preview";
  const value = useMemo(() => (allowed ? copyWardPartialView(display.view) : null), [allowed, display.view]);
  if (!allowed) return children;
  return (
    <PartialViewContext.Provider value={null}>
      <PartialDisplayContext.Provider value={value}>{children}</PartialDisplayContext.Provider>
    </PartialViewContext.Provider>
  );
}

export function useWardPartialDisplay(): WardPartialView | null {
  return useContext(PartialDisplayContext);
}
