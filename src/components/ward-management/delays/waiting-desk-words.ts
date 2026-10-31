"use client";

/**
 * Role views of Waiting (nurse in charge and ED clinician) as one more branch on the desk's role,
 * merged from the mock-up forks' `ward-desk-waiting.ts` and `as-ed-waiting-words.ts`.
 *
 * The shared Waiting wording is the bed coordinator's: "Waiting on you" is the coordinator's move
 * and "ED" is the referring department's. A ward desk reads the coordinator's move as the
 * coordinator's. An ED desk swaps the two sides: the coordinator's move is named, and the
 * department's own move is the desk's. Every other desk reads the words unchanged.
 */
import { useMemo } from "react";

import type { DueSoonThresholds } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { ownerName } from "./delays-board-model";
import type { DelayCause, DelayGroup, DelayOwnerId } from "./delays-derivations";
// Josh, 30 Oct 2026: this page's blocker titles ("Form due soon, as typed").
import { waitingCauseTitle } from "./wait-bands";
import { moveWord } from "./waiting-hero-bar";
import type { WaitingViewId } from "./waiting-href";
import { waitingViewHint, waitingViewLabel } from "./waiting-views";

export type WaitingDesk = {
  /** Role view (nurse in charge): the list is only the people coming to this ward. */
  readonly wardDesk: boolean;
  /** Role view (as ED clinician): the list is only this department's people. */
  readonly edDesk: boolean;
  /** The ward desk's own ward, when the desk holds one of the units given. */
  readonly ownWardName: string | undefined;
  /** The ED desk's department ("ARM ED", or "This ED"). */
  readonly place: string | undefined;
  readonly ownerName: (owner: DelayOwnerId) => string;
  readonly causeTitle: (cause: DelayCause) => string;
  /** The graphs' short blocker word ("On you"). */
  readonly shortCause: (cause: DelayCause, short: string) => string;
  readonly viewLabel: (view: WaitingViewId, thresholds: DueSoonThresholds) => string;
  readonly viewHint: (view: WaitingViewId, thresholds: DueSoonThresholds) => string;
  /** The blocker group's whose-move tag ("Your move", "Coordinator's move"). */
  readonly moveWord: (owner: DelayOwnerId) => string;
  /** Which owner the whose-move tag's accent reads as the desk's own ("yours"). */
  readonly tagOwner: (owner: DelayOwnerId) => string;
  /** The groups with the coordinator's own group named from the desk's side. */
  readonly groups: (groups: DelayGroup[]) => DelayGroup[];
  /** Longest quiet's line: the people not on the desk's coordinator move. */
  readonly notOnYou: string;
  readonly quietOnYou: string;
};

const COORDINATOR_DESK: WaitingDesk = {
  wardDesk: false,
  edDesk: false,
  ownWardName: undefined,
  place: undefined,
  ownerName,
  causeTitle: waitingCauseTitle,
  shortCause: (_cause, short) => short,
  viewLabel: waitingViewLabel,
  viewHint: waitingViewHint,
  moveWord,
  tagOwner: (owner) => owner,
  groups: (groups) => groups,
  notOnYou: "Not waiting on you",
  quietOnYou: "waiting on you",
};

/** "On you" on this board is the bed coordinator; a ward or ED desk reads that move as the coordinator's. */
function coordinatorWords(text: string): string {
  return text.replace(/on you\b/, "on the coordinator");
}

/** The coordinator's own group, named from a ward or ED desk's side. */
function coordinatorGroups(groups: DelayGroup[]): DelayGroup[] {
  return groups.map((group) =>
    group.cause === "awaiting_coordinator"
      ? { ...group, title: "Waiting on the coordinator", note: "the bed coordinator's move" }
      : group,
  );
}

/** Shared by both role views: the coordinator's move is named, never "you". */
const NOT_THE_COORDINATOR = {
  shortCause: (cause: DelayCause, short: string) => (cause === "awaiting_coordinator" ? "Coordinator" : short),
  groups: coordinatorGroups,
  notOnYou: "Not waiting on the coordinator",
  quietOnYou: "waiting on the coordinator",
} as const;

function wardDeskWords(ownWardName: string | undefined): WaitingDesk {
  // Role view (nurse in charge): "Waiting on you" is the coordinator's move, so a ward desk reads it
  // as the coordinator's. The ward's own move stays its owner's name ("Wards").
  return {
    ...COORDINATOR_DESK,
    ...NOT_THE_COORDINATOR,
    wardDesk: true,
    ownWardName,
    ownerName: (owner) => coordinatorWords(ownerName(owner)),
    causeTitle: (cause) => coordinatorWords(waitingCauseTitle(cause)),
    viewLabel: (view, thresholds) => coordinatorWords(waitingViewLabel(view, thresholds)),
    viewHint: (view, thresholds) => coordinatorWords(waitingViewHint(view, thresholds)),
    moveWord: (owner) => (owner === "yours" ? "Coordinator's move" : moveWord(owner)),
    tagOwner: (owner) => (owner === "yours" ? "coordinator" : owner),
  };
}

function edDeskWords(place: string): WaitingDesk {
  // Role view (as ED clinician): the same counts and groups, said from the ED's side.
  return {
    ...COORDINATOR_DESK,
    ...NOT_THE_COORDINATOR,
    edDesk: true,
    place,
    ownerName: (owner) => (owner === "yours" ? "Coordinator" : owner === "ed" ? "Waiting on you" : ownerName(owner)),
    causeTitle: (cause) => (cause === "awaiting_coordinator" ? "Waiting on the coordinator" : waitingCauseTitle(cause)),
    viewLabel: (view, thresholds) =>
      view === "needs-me" ? "Due soon or with the coordinator" : waitingViewLabel(view, thresholds),
    viewHint: (view, thresholds) => coordinatorWords(waitingViewHint(view, thresholds)),
    moveWord: (owner) => (owner === "yours" ? "Coordinator's move" : owner === "ed" ? "Your move" : moveWord(owner)),
    tagOwner: (owner) => (owner === "yours" ? "coordinator" : owner === "ed" ? "yours" : owner),
  };
}

/**
 * The Waiting words for the effective desk. Pass the units to name a ward desk's own ward; the
 * panels and graphs need only the words.
 */
export function useWaitingDeskWords(units?: readonly Unit[]): WaitingDesk {
  const access = useEffectiveWardAccess();
  const role = access.role;
  const scope = access.scope;
  const ownWardName =
    role === "ward" && scope.kind === "ward" ? units?.find((unit) => scope.unitIds.includes(unit.id))?.name : undefined;
  const edId = role === "ed" && scope.kind === "ed" ? scope.edId : undefined;
  return useMemo(() => {
    if (role === "ward") return wardDeskWords(ownWardName);
    if (role === "ed") return edDeskWords((edId === undefined ? "" : edShortName(edById(edId))) || "This ED");
    return COORDINATOR_DESK;
  }, [role, ownWardName, edId]);
}
