"use client";

import { useCallback, useEffect, useState } from "react";

import { readWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { lookedThisShift } from "@/components/ward-management/coordinator/shift-first-look";
import type { Instant } from "@/components/ward-management/ward-clock";

import type { HandoverDigestInput } from "./handover-digest-model";
import type { HandoverScope } from "./handover-scope";
import { handoverSinceItems } from "./handover-since-items";
import { nightMovementChanges } from "@/components/ward-management/coordinator/night-movement-changes";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

/**
 * Item 11: when the Shift digest was last read, in this browser tab only. A board-clock instant,
 * no patient or record; a preview of another desk reads it but never writes it.
 */
export const DIGEST_LAST_READ_KEY = "ward-flow-digest-last-read";

function readLastRead(): Instant | null {
  try {
    const raw = window.sessionStorage.getItem(DIGEST_LAST_READ_KEY);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastRead(at: Instant): void {
  if (readWardAccessSnapshot().previewOf !== null) return;
  try {
    window.sessionStorage.setItem(DIGEST_LAST_READ_KEY, String(at));
  } catch {
    // Private browsing or a full quota: the next read counts as a first read again.
  }
}

/**
 * Whether this opening of the digest is its first read this shift. Fixed when the digest opens, so
 * the read recorded at opening does not narrow the window while it is still open.
 */
export function useDigestFirstLookOfShift(open: boolean, now: Instant): boolean {
  const [held, setHeld] = useState<{ open: boolean; first: boolean }>({ open: false, first: false });
  if (held.open !== open) setHeld({ open, first: open ? !lookedThisShift(readLastRead(), now) : held.first });
  useEffect(() => {
    if (open) writeLastRead(now);
  }, [open, now]);
  return open && held.open && held.first;
}

type SinceArgs = Omit<Parameters<typeof handoverSinceItems>[0], "newSince" | "scopeKind"> & {
  scope: Pick<HandoverScope, "kind">;
};

/**
 * The digest input's since fields for item 11: the hero's since items, whether this is the first
 * read this shift, the same list for a wider window, and the window's absences without leave and
 * transfers. Spread into the digest input.
 */
export function useDigestNight(
  open: boolean,
  sinceItems: HandoverDigestInput["sinceItems"],
  { scope, ...args }: SinceArgs,
): Pick<HandoverDigestInput, "sinceItems" | "firstLookOfShift" | "sinceItemsFor" | "nightMovesFor"> {
  const firstLookOfShift = useDigestFirstLookOfShift(open, args.now);
  const { admissions, wards, units, rows, now, edDesk } = args;
  const scopeKind = scope.kind;
  const sinceItemsFor = useCallback(
    (since: Instant) => handoverSinceItems({ admissions, wards, units, rows, scopeKind, newSince: since, now, edDesk }),
    [admissions, wards, units, rows, scopeKind, now, edDesk],
  );
  // Absences and transfers for the hero's wards; an ED desk holds no ward, as its since items do.
  const { leaveBeds } = useWardFlowSelect("leaveBeds");
  const nightMovesFor = useCallback(
    (since: Instant) =>
      edDesk
        ? []
        : nightMovementChanges({ admissions, leaveBeds, units }, since, now).filter((move) =>
            wards.some((ward) => ward.id === move.unitId),
          ),
    [admissions, leaveBeds, units, now, edDesk, wards],
  );
  return { sinceItems, firstLookOfShift, sinceItemsFor, nightMovesFor };
}
