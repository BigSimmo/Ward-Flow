import { causeTitle } from "@/components/ward-management/delays/delays-board-parts";
import { originLabel } from "@/components/ward-management/delays/delays-board-rows";
import type { DelayCause, DelayGroup } from "@/components/ward-management/delays/delays-derivations";
import type { BoardRow } from "@/components/ward-management/delays/delays-board-model";
import type { Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, edShortName } from "@/components/ward-management/ward-sites";
import { notWaitingParts, waitingSplit } from "@/components/ward-management/ward-shared-figures";

export type WaitBandId = "over24" | "over8" | "under8";
/**
 * Longest wait, grouped (redesign): over a day all shown, 8 to 24 hours the first four, the rest
 * folded. The bands count everyone on the list, in transit too, so the middle band is "8 to 24
 * hours" rather than "Over 8 hours", which the header uses for people still in an ED (Josh, 30 Oct).
 */
export const WAIT_BANDS: readonly {
  id: WaitBandId;
  title: string;
  note: string;
  tone: "danger" | "warning" | undefined;
  limit: number;
  test: (row: BoardRow) => boolean;
}[] = [
  {
    id: "over24",
    title: "Over 24 hours",
    note: "past the access target",
    tone: "danger",
    limit: Number.POSITIVE_INFINITY,
    test: (row) => row.waited >= 24 * 60,
  },
  {
    id: "over8",
    title: "8 to 24 hours",
    note: "longest first",
    tone: "warning",
    limit: 4,
    test: (row) => row.waited >= 8 * 60 && row.waited < 24 * 60,
  },
  {
    id: "under8",
    title: "Under 8 hours",
    note: "longest first",
    tone: undefined,
    limit: 0,
    test: (row) => row.waited < 8 * 60,
  },
];

/** "ARM ED" rather than the department's full name, which pushed each row to three lines. */
export function originCode(movement: Movement): string {
  const ed = movement.originEdId
    ? allEmergencyDepartments().find((candidate) => candidate.id === movement.originEdId)
    : undefined;
  return ed ? edShortName(ed) || originLabel(movement) : originLabel(movement);
}

/** "1h", not "1 h": the hours read as the header's "8h" does (Josh, 30 Oct 2026). */
export function windowText(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes} min`;
}

/** Shared view words with their hour figures closed up the same way ("within 3h"). */
export function tightHours(text: string): string {
  return text.replace(/(\d) h\b/g, "$1h");
}

/**
 * The blocker titles on this page. The "due soon" form group's real title reads "Form due time (as
 * written) running out"; Josh (30 Oct 2026) renamed it here, keeping "as typed" beside legal times.
 * Its people are those whose typed time falls within the urgent window (a setting, so the title names
 * no hours); a passed time moves the person to the "Form overdue" group above it.
 */
export function waitingCauseTitle(cause: DelayCause): string {
  return cause === "legal_expiring" ? "Form due soon, as typed" : causeTitle(cause);
}

/** The groups with this page's titles. */
export function retitledGroups(groups: DelayGroup[]): DelayGroup[] {
  return groups.map((group) =>
    group.cause === "legal_expiring" ? { ...group, title: waitingCauseTitle(group.cause) } : group,
  );
}

/**
 * Josh, 30 Oct 2026: the bands count everyone on the list, so each says who is not in an ED
 * ("includes 3 in transit") and is not read against the header's Over 8h (people still in an ED).
 */
export function bandIncludes(list: readonly BoardRow[]): string | undefined {
  const notInEd = notWaitingParts(waitingSplit(list.map((row) => row.movement)));
  return notInEd.length > 0 ? `includes ${notInEd.join(", ")}` : undefined;
}
