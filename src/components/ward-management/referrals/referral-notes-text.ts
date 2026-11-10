import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/ward-clipboard";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { ARRIVAL_MODE_LABELS } from "@/components/ward-management/ward-model-vocabulary";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { edById } from "@/components/ward-management/ward-sites";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";

/**
 * "COPY TO NOTES, WIDER" (item 27, 10 Nov 2026). The referral letter's Copy to notes, as two more
 * short templates: one for a ward's acceptance, one for a transfer. Each goes through the same
 * clipboard helper (`copyTextToClipboard`), so each starts with the synthetic line and loses any
 * UMRN or date of birth on the way out.
 *
 * ⚠️ PLAIN RECORDED FACTS ONLY. No typed free text ever reaches these lines: no reason for referral,
 * history, summary, diagnosis, blocker, decline or reassessment note, arrival tracking reference or
 * typed mode of arrival. No risk detail at all: risk flags stay on the referral (Josh, 25 Sep 2026,
 * "Real details"). A fact the record does not hold reads "not recorded", never a guess.
 */

const NOT_RECORDED = "not recorded";

function unitName(units: readonly Pick<Unit, "id" | "name">[], unitId: string | undefined): string {
  if (unitId === undefined) return "Ward not recorded";
  return units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";
}

/** The acceptance a ward recorded on this referral, as lines for the notes. `undefined` when none. */
export function referralAcceptanceNotesText(
  referral: Referral,
  context: { patientName: string; units: readonly Pick<Unit, "id" | "name">[]; now: Instant },
): string | undefined {
  const accepted = acceptedAddressing(referral);
  if (!accepted || accepted.destination.kind !== "psychiatric_ward") return undefined;
  const ward = unitName(context.units, accepted.acceptedUnitId ?? accepted.destination.unitId);
  const when = accepted.decidedAt === undefined ? "" : `, ${formatInstantWithDay(accepted.decidedAt, context.now)}`;
  return [
    SYNTHETIC_COPY_LINE,
    `Ward Flow acceptance: ${context.patientName}.`,
    `Referral ${referral.id} accepted by ${ward}${when}.`,
    `Bed: ${accepted.heldBedNumber === undefined ? "no bed held yet" : `bed ${accepted.heldBedNumber} held`}.`,
    `Urgency: Tier ${referral.urgency}.`,
  ].join("\n");
}

/** A movement to an accepting ward, as lines for the notes. `undefined` until a ward has accepted. */
export function movementTransferNotesText(
  movement: Movement,
  context: { patientName: string; units: readonly Pick<Unit, "id" | "name">[]; now: Instant },
): string | undefined {
  if (movement.acceptedUnitId === undefined) return undefined;
  const from = edById(movement.originEdId)?.name ?? "Origin not recorded";
  const to = unitName(context.units, movement.acceptedUnitId);
  const arrival = movement.arrivalDetails;
  const arrived = movement.closure?.outcome === "arrived" ? movement.closure.at : undefined;
  return [
    SYNTHETIC_COPY_LINE,
    `Ward Flow transfer: ${context.patientName}.`,
    `From ${from} to ${to}.`,
    `Stage: ${stageCopy[movement.stage].label}.`,
    `Bed: ${movement.heldBedNumber === undefined ? "no bed held yet" : `bed ${movement.heldBedNumber} held`}.`,
    `Transport: ${
      arrival
        ? `${ARRIVAL_MODE_LABELS[arrival.mode]}, expected ${formatInstantWithDay(arrival.estimatedArrivalAt, context.now)}`
        : NOT_RECORDED
    }.`,
    `Legal status: ${movement.legalStatus || NOT_RECORDED}.`,
    ...(arrived === undefined ? [] : [`Arrived ${formatInstantWithDay(arrived, context.now)}.`]),
  ].join("\n");
}
