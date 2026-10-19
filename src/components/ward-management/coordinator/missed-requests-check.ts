import type { Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

/**
 * THE DAILY "NOBODY MISSED" CHECK — the coordinator's morning list for the pilot's second measure
 * (product brief, "Fewer missed or duplicate bed requests"). Fixed rules over what the record
 * already holds; nothing is stored, merged, cancelled or re-ordered.
 *
 * Coordinator only (F-19 ruling, 19 Oct 2026: duplicate warnings never appear on ward screens).
 * The list names records by their ids so the coordinator opens them; it never says two records
 * are the same person beyond the recorded person link.
 *
 * Four rules:
 *   - `no_ward_asked`: an open bed request with no ward asked, older than `missedRequestWindow`.
 *   - `no_bed_request`: an ED accepted a referral for a bed, and no bed request was raised from it
 *     within the window.
 *   - `two_requests`: the same recorded person has two open bed requests.
 *   - `bed_held_twice`: one numbered bed at one ward is held for two open requests.
 */

export type MissedRequestKind = "no_ward_asked" | "no_bed_request" | "two_requests" | "bed_held_twice";

export type MissedRequestItem = {
  kind: MissedRequestKind;
  /** Stable for React keys and for tests. */
  key: string;
  /** The bed requests involved, oldest first. Empty for `no_bed_request`. */
  movementIds: Movement["id"][];
  /** The referral involved, for `no_bed_request`. */
  referralId?: Referral["id"];
  /** When the item became due, for "for how long" wording. */
  since: Instant;
};

export const MISSED_REQUEST_LABELS: Record<MissedRequestKind, string> = {
  no_ward_asked: "No ward asked yet",
  no_bed_request: "Accepted by an ED, no bed request raised",
  two_requests: "Same person, two open bed requests",
  bed_held_twice: "One bed held for two people",
};

/** Stages where a bed request is still looking for, or holding, a bed. */
const OPEN_STAGES: ReadonlySet<Movement["stage"]> = new Set([
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
  "pulled",
  "handover_ready",
]);

/**
 * The recorded person a bed request is for, through the one resolver every screen uses (the
 * movement's own link, else its referral's). `undefined` when nothing links it: never a guess.
 */
export function movementPersonId(
  movement: Movement,
  records: { patients: readonly Patient[]; referrals: readonly Referral[]; movements: readonly Movement[] },
): string | undefined {
  return resolveSubjectPatient(movement, records).patient?.id;
}

function isOpen(movement: Movement): boolean {
  return movement.closure === undefined && OPEN_STAGES.has(movement.stage);
}

export function missedRequestCheck(input: {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  patients: readonly Patient[];
  now: Instant;
}): MissedRequestItem[] {
  const { movements, referrals, patients, now } = input;
  // One records object, so the resolver builds its index once for the whole check.
  const records = { patients, referrals, movements };
  const windowMinutes = CLINICAL_VALUES.missedRequestWindow.value;
  const open = movements.filter(isOpen).sort((a, b) => a.openedAt - b.openedAt);
  const items: MissedRequestItem[] = [];

  for (const movement of open) {
    const due = movement.openedAt + windowMinutes;
    const asked =
      movement.referredUnitIds.length > 0 ||
      (movement.waitlistedUnitIds?.length ?? 0) > 0 ||
      movement.acceptedUnitId !== undefined;
    if (!asked && now >= due) {
      items.push({
        kind: "no_ward_asked",
        key: `no_ward_asked:${movement.id}`,
        movementIds: [movement.id],
        since: due,
      });
    }
  }

  const raisedFrom = new Set(movements.map((movement) => movement.referralId).filter((id) => id !== undefined));
  for (const referral of referrals) {
    if (raisedFrom.has(referral.id)) continue;
    const bedAtEd = referral.destinations.find(
      (addressing) =>
        addressing.destination.kind === "emergency_department" &&
        addressing.destination.purpose === "bed" &&
        addressing.state === "accepted" &&
        addressing.decidedAt !== undefined,
    );
    if (!bedAtEd || bedAtEd.decidedAt === undefined) continue;
    const due = bedAtEd.decidedAt + windowMinutes;
    if (now >= due) {
      items.push({
        kind: "no_bed_request",
        key: `no_bed_request:${referral.id}`,
        movementIds: [],
        referralId: referral.id,
        since: due,
      });
    }
  }

  const byPerson = new Map<string, Movement[]>();
  for (const movement of open) {
    const personId = movementPersonId(movement, records);
    if (personId === undefined) continue;
    byPerson.set(personId, [...(byPerson.get(personId) ?? []), movement]);
  }
  for (const [personId, group] of byPerson) {
    if (group.length < 2) continue;
    items.push({
      kind: "two_requests",
      key: `two_requests:${personId}`,
      movementIds: group.map((movement) => movement.id),
      since: group[1].openedAt,
    });
  }

  const byBed = new Map<string, Movement[]>();
  for (const movement of open) {
    if (movement.acceptedUnitId === undefined || movement.heldBedNumber === undefined) continue;
    if (movement.stage !== "pulled" && movement.stage !== "handover_ready") continue;
    const bed = `${movement.acceptedUnitId}#${movement.heldBedNumber}`;
    byBed.set(bed, [...(byBed.get(bed) ?? []), movement]);
  }
  for (const [bed, group] of byBed) {
    if (group.length < 2) continue;
    items.push({
      kind: "bed_held_twice",
      key: `bed_held_twice:${bed}`,
      movementIds: group.map((movement) => movement.id),
      since: Math.max(...group.map((movement) => movement.openedAt)) as Instant,
    });
  }

  return items;
}
