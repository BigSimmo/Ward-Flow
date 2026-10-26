"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  bindWardPartialView,
  copyWardPartialView,
  filterWardPartialViewAt,
  type BoundWardPartialView,
  type LocalWardPartialDisplay,
  type WardPartialView,
} from "./ward-partial-view-contract";
import { accessIsValid } from "./ward-role-access";
import type { SenderReadSource } from "./ward-sender-read-collection";

const PartialViewContext = createContext<BoundWardPartialView | null>(null);
const PartialDisplayContext = createContext<WardPartialView | null>(null);
const PartialDisplayHostContext = createContext<{
  shared: boolean;
  previewAllowed: boolean;
  senderRequired: boolean;
  readSource: SenderReadSource | null;
}>({ shared: false, previewAllowed: false, senderRequired: false, readSource: null });

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
  currentNow = null,
  shared = true,
  previewAllowed = false,
  senderRequired = false,
  readSource = null,
  children,
}: {
  response: unknown;
  currentRevision: number | null;
  currentAccessContext: string | null;
  /** The actual current world clock, including cheap clock-only shared polls. */
  currentNow?: number | null;
  shared?: boolean;
  previewAllowed?: boolean;
  /** Presentation requirement from the actual shared role, retained when its data is unavailable. */
  senderRequired?: boolean;
  /** Genuine already-adopted shared source supplied by the connection host, never status data. */
  readSource?: SenderReadSource | null;
  children?: ReactNode;
}) {
  const bound = useMemo(
    () =>
      shared && !previewAllowed
        ? bindWardPartialView(response, { revision: currentRevision, accessContext: currentAccessContext })
        : null,
    [response, currentRevision, currentAccessContext, shared, previewAllowed],
  );
  const value = useMemo(() => {
    if (!bound) return null;
    const view = filterWardPartialViewAt(bound.view, currentNow);
    return view === bound.view ? bound : Object.freeze({ ...bound, view });
  }, [bound, currentNow]);
  const currentReadSource = useMemo(() => {
    if (
      !shared ||
      !readSource ||
      !accessIsValid(readSource.access) ||
      !Number.isSafeInteger(currentRevision) ||
      currentRevision === null ||
      currentRevision <= 0 ||
      typeof currentAccessContext !== "string" ||
      !/^[a-f0-9]{64}$/u.test(currentAccessContext) ||
      readSource.snapshot.revision !== currentRevision ||
      readSource.snapshot.accessContext !== currentAccessContext
    )
      return null;
    // A coordinator legitimately receives no sibling. Its explicit preview capability comes
    // from the actual adopted full snapshot, never a ward/manager's unavailable summary.
    if (readSource.access.role === "coordinator") return previewAllowed && response === undefined ? readSource : null;
    return (readSource.access.role === "ward" || readSource.access.role === "bed_manager") && bound ? readSource : null;
  }, [shared, readSource, currentRevision, currentAccessContext, previewAllowed, response, bound]);
  const host = useMemo(
    () => ({
      shared,
      previewAllowed: currentReadSource?.access.role === "coordinator",
      senderRequired:
        shared &&
        (senderRequired ||
          currentReadSource?.access.role === "ward" ||
          currentReadSource?.access.role === "bed_manager"),
      readSource: currentReadSource,
    }),
    [shared, currentReadSource, senderRequired],
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
