"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { WardAuthorisedExecutivePreview } from "./shell/ward-chrome-frame";
import { wardShellLifetime } from "./shell/ward-shell-public-context";
import {
  useEffectiveWardAccess,
  readWardAccessSnapshot,
  endAccessPreview,
  setWardAccess,
} from "./shell/ward-access-store";
import { accessPlaceLabel } from "./shell/ward-access-labels";
import { wardPlaceLookup } from "./ward-access-places";
import { STATEWIDE_COORDINATOR } from "./ward-role-access";
import type { WardSharedConnection } from "./ward-shared-access";
import type { WardFlowState } from "./ward-flow-reducer";
import type { EventLogEntry } from "./ward-event-log";

/**
 * The public shell values (places, desk label, role switch, access lifetime) and the authorised
 * executive preview around a provider's children. Split from ward-flow-provider.tsx for its line limit.
 */
export function useWardShellValues({
  state,
  now,
  dayZero,
  startedAt,
  events,
  shared,
  children,
}: {
  state: WardFlowState;
  now: number;
  dayZero: Date;
  startedAt: string;
  events: readonly EventLogEntry[];
  shared: WardSharedConnection;
  children: ReactNode;
}) {
  const shellAccess = useEffectiveWardAccess();
  // The connection object is new on every poll; the shell reads only these fields of it, so its
  // value (and its sixteen readers) changes only when one of them does. The role switch reads the
  // latest connection through a ref.
  const latestShared = useRef(shared);
  useLayoutEffect(() => {
    latestShared.current = shared;
  });
  const authenticated = shared.enabled;
  const switchPublicRole = useCallback(() => {
    if (readWardAccessSnapshot().previewOf) endAccessPreview();
    else if (!authenticated) setWardAccess(STATEWIDE_COORDINATOR);
    else latestShared.current.switchRole?.();
  }, [authenticated]);
  const accessLifetime = wardShellLifetime(shared, state.scenario, state.worldGeneration, shellAccess);
  const places = useMemo(() => wardPlaceLookup(state.units), [state.units]);
  const placeLabel = accessPlaceLabel(shellAccess, state.units);
  const shellPublic = useMemo(
    () => ({ places, placeLabel, now, authenticated, switchRole: switchPublicRole, accessLifetime }),
    [places, placeLabel, now, authenticated, switchPublicRole, accessLifetime],
  );
  const previewSource = useMemo(
    () => ({ state, access: shellAccess, now, dayZero: dayZero.toISOString(), startedAt, events }),
    [state, shellAccess, now, dayZero, startedAt, events],
  );
  // Actual authority is checked above World construction. Only a coordinator can preview here.
  const previewAuthority = JSON.stringify([
    shared.actorId,
    shared.workingAs,
    shared.snapshot?.accessContext,
    shared.viewEpoch,
    shellAccess,
  ]);
  const previewChildren =
    shellAccess.role === "executive" ? (
      <WardAuthorisedExecutivePreview key={previewAuthority} source={previewSource}>
        {children}
      </WardAuthorisedExecutivePreview>
    ) : (
      children
    );
  return { shellPublic, previewChildren };
}
