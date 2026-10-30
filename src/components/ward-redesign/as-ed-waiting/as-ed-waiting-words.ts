"use client";

// New for the role view (as ED clinician): the Waiting page's "you" words, said from the desk's side.
import { useMemo } from "react";

import type { DueSoonThresholds } from "@/components/ward-management/ward-clock";
import type { DelayCause, DelayOwnerId } from "@/components/ward-management/delays/delays-derivations";
import { causeTitle } from "@/components/ward-management/delays/delays-board-parts";
import { ownerName } from "@/components/ward-management/delays/delays-board-model";
import { waitingViewLabel } from "@/components/ward-management/delays/waiting-views";
import type { WaitingViewId } from "@/components/ward-management/delays/waiting-href";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { edById, edShortName } from "@/components/ward-management/ward-sites";

/**
 * The shared Waiting wording is the coordinator's: "Waiting on you" is the coordinator's move and
 * "ED" is the referring department's. On an ED desk those two swap sides: the coordinator's move is
 * named, and the department's own move is the desk's. Every other desk reads the words unchanged.
 */
export function useWaitingWords() {
  const access = useEffectiveWardAccess();
  const edDesk = access.role === "ed";
  const edName = edDesk && access.scope.kind === "ed" ? edShortName(edById(access.scope.edId)) : undefined;
  return useMemo(() => {
    if (!edDesk)
      return {
        edDesk,
        place: undefined,
        ownerName,
        causeTitle,
        viewLabel: waitingViewLabel,
        notOnYou: "Not waiting on you",
      };
    // Role view (as ED clinician): the same counts and groups, said from the ED's side.
    return {
      edDesk,
      place: edName || "This ED",
      ownerName: (owner: DelayOwnerId) =>
        owner === "yours" ? "Coordinator" : owner === "ed" ? "Waiting on you" : ownerName(owner),
      causeTitle: (cause: DelayCause) =>
        cause === "awaiting_coordinator" ? "Waiting on the coordinator" : causeTitle(cause),
      viewLabel: (view: WaitingViewId, thresholds: DueSoonThresholds) =>
        view === "needs-me" ? "Due soon or with the coordinator" : waitingViewLabel(view, thresholds),
      notOnYou: "Not waiting on the coordinator",
    };
  }, [edDesk, edName]);
}
