import type { Movement, Referral } from "../ward-model";
import { encodeRecordAddress } from "../shell/ward-record-address";
import type { EdJourneyState } from "../ward-ed-wait-steps";
import { stageCopy } from "../ward-stage-copy";

/**
 * The ward referral still waiting on an answer for this person, if any: the newest referral for
 * them with a ward arm queued and not withdrawn. A2-5 (audit 13 Oct 2026): the ED board did not show
 * a referral the ED had just sent, so the row still read "In department".
 */
export function openWardReferralFor(
  patientId: string | undefined,
  referrals: readonly Referral[],
): { referral: Referral; unitIds: string[] } | undefined {
  if (patientId === undefined) return undefined;
  for (let index = referrals.length - 1; index >= 0; index -= 1) {
    const referral = referrals[index]!;
    if (referral.patientId !== patientId) continue;
    const unitIds = referral.destinations.flatMap((addressing) =>
      addressing.destination.kind === "psychiatric_ward" &&
      addressing.destination.unitId !== undefined &&
      addressing.state === "queued" &&
      addressing.withdrawnAt === undefined
        ? [addressing.destination.unitId]
        : [],
    );
    if (unitIds.length > 0) return { referral, unitIds };
  }
  return undefined;
}

/** A2-5: the Referrals board with this referral open (`ReferralBoard` reads `?referral=`). */
export function referralBoardHref(referralId: string): string {
  return `/ward-flow/referrals?${new URLSearchParams({ referral: encodeRecordAddress(referralId) }).toString()}`;
}

/** "Referred to Bentley Older Adult", or "Referred to 3 wards" when it went to several. */
export function referredToLabel(unitIds: readonly string[], unitName: (unitId: string) => string | undefined): string {
  if (unitIds.length === 1) return `Referred to ${(unitName(unitIds[0]!) ?? unitIds[0]!).split(" — ")[0]}`;
  return `Referred to ${unitIds.length} wards`;
}

/**
 * S-7 (audit 13 Oct 2026): once an examination ends in an inpatient treatment order, the ED's next
 * step is the bed search, not "Record outcome" (which offers discharge or community follow-up and
 * withdraws requests). `refer` when no ward has been asked yet; `underway` once one has, or a bed is
 * accepted or held; `undefined` otherwise, leaving the board's usual order.
 */
export function edBedSearchStep(
  movement: Pick<
    Movement,
    "examination" | "edOutcome" | "closure" | "acceptedUnitId" | "referredUnitIds" | "stage" | "transport"
  >,
  hasOpenWardReferral: boolean,
): "refer" | "underway" | undefined {
  if (movement.examination?.outcome !== "inpatient_order") return undefined;
  const journey = edJourneyState(movement, hasOpenWardReferral);
  if (journey === "closed" || journey === "left") return undefined;
  return journey === "not_asked" ? "refer" : "underway";
}

/**
 * 3.1 (K6, approved 13 Nov 2026): where this person's journey stands, the one reading both the row's
 * "Waiting on a ward" (`edBedSearchStep`) and the ED wait step (`edWaitStep`'s second input) take,
 * so the step never says "Ask wards" beside "Accepted". It reads only what is recorded.
 */
export function edJourneyState(
  movement: Pick<Movement, "edOutcome" | "closure" | "acceptedUnitId" | "referredUnitIds" | "stage" | "transport">,
  hasOpenWardReferral: boolean,
): EdJourneyState {
  if (movement.closure) return "closed";
  if (movement.edOutcome !== undefined) return "left";
  if (movement.transport !== undefined && movement.transport.cancelledAt === undefined) return "transport_booked";
  if (movement.stage === "pulled" || movement.stage === "handover_ready" || movement.stage === "moving")
    return "pulled";
  if (movement.acceptedUnitId !== undefined) return "accepted";
  if (hasOpenWardReferral || movement.referredUnitIds.length > 0) return "asked";
  return "not_asked";
}

/**
 * The journey's neutral words, shown in place of a wait step's suggested next step once that step's
 * action is recorded. Each is wording the ED screens already use: the row's "Withdrawn", "Left the
 * department" and "Waiting on a ward", the timeline's "Transport booked", and the stage names.
 */
export function edJourneyWords(journey: EdJourneyState): string | undefined {
  switch (journey) {
    case "closed":
      return "Withdrawn";
    case "left":
      return "Left the department";
    case "transport_booked":
      return "Transport booked";
    case "pulled":
      return stageCopy.pulled.label;
    case "accepted":
      return stageCopy.accepted_awaiting_bed.label;
    case "asked":
      return "Waiting on a ward";
    case "not_asked":
      return undefined;
  }
}
