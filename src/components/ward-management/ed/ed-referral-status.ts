import { bedHold, type BedHold } from "@/components/ward-management/ward-bed-hold";
import type { Instant } from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import type { Movement, MovementStage } from "@/components/ward-management/ward-model";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";

/**
 * WHERE AN ED'S REFERRAL STANDS, IN THE ED'S OWN WORDS (bigger changes, change 2, D-77, Josh
 * 21 Oct 2026). The board's Referral column, each phone row's second line and the row sheet's
 * "Where the referral is" list all read this, so the three never disagree.
 *
 * Every line comes from the movement's own stage and records. The ED does not record which wards
 * the coordinator asked, so a referral still being placed says "Coordinator finding a ward" rather
 * than naming or counting wards it cannot see.
 *
 * ⚠️ "Bed held" is the ED's word for the `pulled` stage (D-77: "ED sees Bed held"). Coordinator
 * screens keep `stageCopy`'s "Bed pulled"; this module is the only place the ED wording lives.
 */
export type EdReferralTone = "good" | "warn" | "danger" | "quiet";

export type EdReferralStep = { label: string; detail: string; done: boolean };

export type EdReferralStatus = {
  /** Line one on the board: the accepting ward, or how far the referral has got. */
  title: string;
  /** Line two on the board, absent when there is no referral under way. */
  line?: string;
  tone: EdReferralTone;
  /** The bed hold, on a held bed only, so the board can mark one about to lapse. */
  hold?: BedHold | null;
  /** The phone row's second line, after the bay. */
  phone: string;
  /** The row sheet's list, absent when there is no referral under way. */
  steps?: EdReferralStep[];
};

/** The stage name the ED reads: "Bed held" for a pulled bed, otherwise the shared label. */
export function edStageLabel(stage: MovementStage): string {
  return stage === "pulled" ? "Bed held" : stageCopy[stage].label;
}

/** How many of the four steps (sent, accepted, bed held, transport) each stage has done. */
const STEPS_DONE: Record<MovementStage, number> = {
  placement_requested: 1,
  destination_review: 1,
  accepted_awaiting_bed: 2,
  pulled: 3,
  handover_ready: 4,
  moving: 4,
  arrived: 4,
};

export function edReferralStatus(
  movement: Movement,
  {
    acceptedUnitName,
    fallback,
    referredTo,
    holdLabel,
    now,
  }: {
    /** The accepting ward's name, when one has accepted. */
    acceptedUnitName: string | undefined;
    /** The row's destination words, used whenever no referral is under way. */
    fallback: string;
    /** "Referred to …", when the ED sent the referral to named wards itself. */
    referredTo: string | undefined;
    /** The configured hold length, said when no hold end is recorded. */
    holdLabel: string;
    now: Instant;
  },
): EdReferralStatus {
  // A withdrawn, closed or decided record keeps the row's own words ("Withdrawn", "For discharge").
  if (movement.closure !== undefined || movement.edOutcome !== undefined)
    return { title: fallback, tone: "quiet", phone: fallback };

  const ward = acceptedUnitName?.split(" — ")[0];
  const wardShort = ward?.split(" ")[0];
  const stage = movement.stage;
  const declinedBy = new Set(movement.declines.map((decline) => decline.unitId)).size;
  const hold = stage === "pulled" ? bedHold(movement.pullExpiresAt, now) : undefined;
  const done = STEPS_DONE[stage];

  const sentDetail =
    stage === "placement_requested"
      ? (referredTo ?? "Coordinator finding a ward")
      : stage === "destination_review"
        ? `Declined by ${declinedBy} ${declinedBy === 1 ? "ward" : "wards"}, coordinator reviewing`
        : "Coordinator asked wards";
  const heldDetail =
    stage === "pulled" ? (hold ? hold.short : `${holdLabel} hold`) : done > 3 ? "Bed held" : "No bed yet";
  const transportDetail =
    stage === "moving"
      ? "On the way"
      : stage === "handover_ready"
        ? "Handover ready"
        : stage === "arrived"
          ? "Arrived"
          : movement.transport !== undefined
            ? "Booked"
            : "Not booked yet";
  const steps: EdReferralStep[] = [
    { label: "Referral sent", detail: sentDetail, done: true },
    ward
      ? { label: `${ward} accepted`, detail: "Accepted in principle", done: done >= 2 }
      : { label: "A ward accepts", detail: "Waiting for a ward", done: false },
    { label: "Bed held for this patient", detail: heldDetail, done: done >= 3 },
    { label: "Transport", detail: transportDetail, done: done >= 4 },
  ];

  if (stage === "placement_requested") {
    const line = referredTo ?? "Coordinator finding a ward";
    return { title: "Referral sent", line, tone: "quiet", phone: line, steps };
  }
  if (stage === "destination_review") {
    const title =
      declinedBy > 0 ? `Declined by ${declinedBy} ${declinedBy === 1 ? "ward" : "wards"}` : stageCopy[stage].label;
    return { title, line: "Coordinator reviewing", tone: "warn", phone: "Coordinator reviewing", steps };
  }

  const accepted =
    stage === "accepted_awaiting_bed"
      ? "no bed yet"
      : stage === "pulled"
        ? "bed held"
        : stage === "handover_ready"
          ? "handover ready"
          : stage === "moving"
            ? "on the way"
            : "arrived";
  const heldTail =
    stage !== "pulled"
      ? ""
      : !hold
        ? `, ${holdLabel} hold`
        : hold.state === "lapsed"
          ? `, ${hold.short.toLowerCase()}`
          : ` ${hold.short}`;
  return {
    title: ward ?? edStageLabel(stage),
    line: `Accepted, ${accepted}${heldTail}`,
    tone: hold?.state === "lapsed" ? "danger" : done >= 3 ? "good" : "quiet",
    hold,
    phone: wardShort ? `${wardShort} accepted, ${accepted}` : `Accepted, ${accepted}`,
    steps,
  };
}

/** One board row's status, from what the row model already resolved. */
export function edRowReferralStatus(
  row: Pick<EdBoardRowModel, "movement" | "acceptedUnit" | "destinationLabel" | "referredTo">,
  ctx: Pick<EdScreenContext, "holdLabel" | "now">,
): EdReferralStatus {
  return edReferralStatus(row.movement, {
    acceptedUnitName: row.acceptedUnit?.name,
    fallback: row.destinationLabel,
    referredTo: row.referredTo,
    holdLabel: ctx.holdLabel,
    now: ctx.now,
  });
}
