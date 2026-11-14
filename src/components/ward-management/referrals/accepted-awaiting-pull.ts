/**
 * The accepted-referral queries the shell reads (the bell, the phone Menu and the Alerts figures).
 * Q260 review (#1296): split out of `accepted-ward-referral.ts`, which re-exports them, so the
 * shell bundle carries these two queries and not the pull sheet's legal-form wording beside them.
 */
import type { Movement, Referral, ReferralSource, Unit } from "../ward-model";
import { acceptedAddressing } from "../ward-referrals";
import { allEmergencyDepartments } from "../ward-sites";

/**
 * A9-13: the sources whose referral is made from inside an emergency department, so an accepted
 * journey starts at the department the referral is recorded at: an ED referral, and a person the
 * ambulance brought in. A community referral starts at its referring service (D-76). Other
 * sources (GP, crisis service, another hospital) do not say the person is in an ED, so they keep
 * the ward board's pull until a ruling says where their journey starts.
 */
export function startsAcceptedJourneyAtEd(source: ReferralSource): boolean {
  return source === "ed_medical" || source === "ambulance";
}

/**
 * A9-13: an accepted referral the coordinator can start a journey from in one step, so a bed
 * pulled for it is the one kind of pull every screen reads (a movement), never a referral hold
 * only the ward's board sees. Mirrors RAISE_REFERRAL's direct continuation.
 */
export function startsAcceptedJourney(referral: Pick<Referral, "source" | "originSiteCode">): boolean {
  if (referral.source === "community" || referral.source === "ed_medical") return true;
  return (
    startsAcceptedJourneyAtEd(referral.source) &&
    allEmergencyDepartments().some((department) => department.siteCode === referral.originSiteCode)
  );
}

/**
 * S-9 (audit 13 Oct 2026): accepting a referral into a ward pulls no bed and creates no movement
 * (`ACCEPT_REFERRAL`, by design), so the referral and the patient record both read as a dead end.
 * This names the ward that accepted, so both can show the next step: hold the bed on that ward.
 * Callers build the link to that ward themselves.
 */
export function acceptedWardOf(
  referral: Referral,
  units: readonly Pick<Unit, "id" | "name">[],
): { unitId: string; unitName: string } | undefined {
  const accepted = acceptedAddressing(referral);
  if (!accepted) return undefined;
  const unitId =
    accepted.acceptedUnitId ??
    (accepted.destination.kind === "psychiatric_ward" ? accepted.destination.unitId : undefined);
  if (unitId === undefined) return undefined;
  const unitName = units.find((unit) => unit.id === unitId)?.name ?? "the accepting ward";
  return { unitId, unitName };
}

/**
 * An accepted ward referral the coordinator can pull a bed for, with the ward that accepted it.
 * `movementId` is set when its journey is already open without a bed because a pull was undone
 * (review P4-1): Pull the bed then pulls on that journey instead of starting a new one.
 */
export type AcceptedAwaitingPull = { referral: Referral; unitId: string; unitName: string; movementId?: string };

type PullJourney = Pick<Movement, "id" | "referralId" | "closure" | "stage" | "unwinds">;

/**
 * Review P4-1: a journey whose bed pull was undone. Undo releases the pull and leaves the journey
 * open at "accepted, awaiting a bed", so the person still needs a bed and stays on the list.
 */
function releasedPullJourney(movement: PullJourney): boolean {
  return (
    !movement.closure && movement.stage === "accepted_awaiting_bed" && movement.unwinds.at(-1)?.kind === "pull_released"
  );
}

/**
 * WS-02 (workflow speed audit, 26 Oct 2026): every referral a ward has accepted that still has no
 * bed pulled, oldest decision first. Only the referrals a journey can start from directly: an ED
 * referral, a community referral (D-76), or one recorded at an emergency department (A9-13), accepted on a ward arm that its referrer has not
 * withdrawn, with no bed held on that arm and no live journey raised from it. A journey that closed
 * "did not proceed" does not count, as `RAISE_REFERRAL` allows a new one then. Nor does a journey
 * whose pull was undone and that waits for a bed again (review P4-1): the item then names it.
 */
export function acceptedReferralsAwaitingPull(
  referrals: readonly Referral[],
  units: readonly Pick<Unit, "id" | "name">[],
  movements: readonly PullJourney[],
): AcceptedAwaitingPull[] {
  return referrals
    .flatMap((referral) => {
      if (!startsAcceptedJourney(referral)) return [];
      const accepted = acceptedAddressing(referral);
      if (!accepted || accepted.destination.kind !== "psychiatric_ward" || accepted.withdrawnAt !== undefined)
        return [];
      if (accepted.heldBedNumber !== undefined) return [];
      const live = movements.filter(
        (movement) => movement.referralId === referral.id && movement.closure?.outcome !== "did_not_proceed",
      );
      const released = live.length === 1 && releasedPullJourney(live[0]!) ? live[0] : undefined;
      if (live.length > 0 && !released) return [];
      const ward = acceptedWardOf(referral, units);
      return ward
        ? [
            {
              referral,
              ...ward,
              ...(released ? { movementId: released.id } : {}),
              decidedAt: accepted.decidedAt ?? referral.raisedAt,
            },
          ]
        : [];
    })
    .sort((a, b) => a.decidedAt - b.decidedAt)
    .map(({ referral, unitId, unitName, movementId }) => ({
      referral,
      unitId,
      unitName,
      ...(movementId === undefined ? {} : { movementId }),
    }));
}
