import type { BedItem } from "./ward-beds-matrix";

/**
 * The Bed board's pick up and place helper (v10 pass 3, ward page). Pure: which beds a picked up
 * person fits, why a bed does not, and the sentence the board says. The engine still decides:
 * `PLACE_IN_BED` and `ACCEPT_REFERRAL` refuse anything these rules let through by mistake.
 */
export type BoardPick =
  /** A referral waiting for this ward's answer, placed with `ACCEPT_REFERRAL` and a bed number. */
  | { kind: "referral"; referralId: string; name: string; secureBedNeeded: boolean; accepted?: boolean }
  /** A person the coordinator referred to this ward, placed with `ACCEPT_IN_PRINCIPLE` and a bed number. */
  | { kind: "movement"; movementId: string; name: string; secureBedNeeded: boolean }
  /** A current stay moved to another bed with `PLACE_IN_BED`. */
  | { kind: "stay"; admissionId: string; fromBed: number; name: string };

export type BoardBed = Pick<BedItem, "bedNumber" | "status" | "designation" | "heldFor" | "preparing">;

/** A free bed, not held for anyone, not still being made ready, and locked when the referral needs a secure bed on a mixed ward. */
export function bedFits(bed: BoardBed, pick: BoardPick | null, isMixed: boolean): boolean {
  if (pick === null || bed.status !== "ready" || bed.heldFor !== undefined || bed.preparing) return false;
  if (pick.kind !== "stay" && pick.secureBedNeeded && isMixed && bed.designation !== "Locked") return false;
  return true;
}

/** The board and reducer preserve open-first selection when either numbered designation is offered. */
export function boardBedFits(
  beds: readonly BoardBed[],
  bed: BoardBed,
  pick: BoardPick | null,
  isMixed: boolean,
): boolean {
  if (!bedFits(bed, pick, isMixed)) return false;
  if (
    pick &&
    pick.kind !== "stay" &&
    !pick.secureBedNeeded &&
    isMixed &&
    bed.designation === "Locked" &&
    beds.some((candidate) => candidate.designation === "Open" && bedFits(candidate, pick, isMixed))
  )
    return false;
  return true;
}

/** Why `bed` does not fit, as the end of "Bed 07 does not fit, …". */
export function whyBedDoesNotFit(bed: BoardBed, pick: BoardPick, isMixed: boolean, beds?: readonly BoardBed[]): string {
  if (bed.status === "closed") return "it is closed";
  if (bed.heldFor !== undefined) return `it is pulled for ${bed.heldFor}`;
  if (bed.status !== "ready") return "it is taken";
  if (bed.preparing) return "it is still being made ready";
  if (pick.kind !== "stay" && pick.secureBedNeeded && isMixed && bed.designation !== "Locked")
    return `${pick.name} needs a locked bed`;
  if (beds && bedFits(bed, pick, isMixed) && !boardBedFits(beds, bed, pick, isMixed))
    return "an open bed is available and must be chosen first";
  return "it is not free";
}

export function fitCount(beds: readonly BoardBed[], pick: BoardPick | null, isMixed: boolean): number {
  return beds.filter((bed) => boardBedFits(beds, bed, pick, isMixed)).length;
}

export function bedNumberLabel(bed: number | string): string {
  return String(bed).padStart(2, "0");
}

/** What the board says after a pick up. */
export function pickedUpSay(pick: BoardPick, fits: number): string {
  const who = pick.kind === "stay" ? `${pick.name} from bed ${bedNumberLabel(pick.fromBed)}` : pick.name;
  if (fits === 0) return `Picked up ${who}. No free bed fits. Put down and answer from Ward flow.`;
  return `Picked up ${who}. ${fits} ${fits === 1 ? "bed fits" : "beds fit"}. Press a bright bed to place, or Put down.`;
}

export const BOARD_RESTING_SAY = "Pick up a waiting person, then press a bright bed. To move someone, open their bed.";
