import type { Movement, Referral } from "../ward-model";

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
  movement: Pick<Movement, "examination" | "edOutcome" | "closure" | "acceptedUnitId" | "referredUnitIds" | "stage">,
  hasOpenWardReferral: boolean,
): "refer" | "underway" | undefined {
  if (movement.examination?.outcome !== "inpatient_order") return undefined;
  if (movement.edOutcome !== undefined || movement.closure) return undefined;
  if (
    hasOpenWardReferral ||
    movement.acceptedUnitId !== undefined ||
    movement.referredUnitIds.length > 0 ||
    movement.stage === "pulled"
  ) {
    return "underway";
  }
  return "refer";
}
