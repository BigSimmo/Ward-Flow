// The network view's pure helpers: the shortlist candidates for a movement, the capability line,
// and the service, setting and transport fits. Moved out of `ward-management-network.tsx`.
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import {
  eligibleCandidatesAmong,
  movementHealthService,
  transportStatusLabel,
} from "@/components/ward-management/ward-derivations";
import { type Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";

export type Connector = { id: string; path: string; kind: "demand" | "route" };
export type Candidate = { unit: Unit; rank: number; etaLabel: string; verdict: ReturnType<typeof eligibility> };

export function capabilityLabel(unit: Unit) {
  const cohortLabel = unit.cohort === "Older adult" ? "Older" : unit.cohort;
  return `${designationSummary(unit)} · ${cohortLabel}`;
}

export function candidatesFor(patient: Movement, units: Unit[], now: Instant): Candidate[] {
  // Only the movement's actual recorded destination may show a real transport state — the
  // other two candidates are computed shortlist entries the movement was never referred to,
  // and must not inherit a transport job that belongs to a different unit (Task 6 Important 3).
  /*
   * ACCEPTED-ONLY, not `destinationUnit`. This id decides which candidate is allowed to display
   * the movement's REAL transport state; every other candidate shows "Not yet booked". Because
   * `destinationUnit` is `acceptedUnitId ?? referredUnitIds[0]`, a movement with an outstanding
   * referral and no acceptance handed its transport job to the FIRST WARD ASKED — a ward with no
   * claim on it at all, displayed beside that ward's name as though the vehicle were coming there.
   *
   * The rule cannot lose anything by narrowing: a transport job only exists on a movement at stage
   * `pulled` or beyond, and `PULL_PATIENT` requires an `acceptedUnitId`. So a movement with a
   * transport job ALWAYS has an accepted unit, and the fallback could only ever fire on a movement
   * whose transport was `undefined` — where it labelled the wrong ward "Not yet requested" rather
   * than leaving it as a plain candidate.
   */
  const recordedDestinationId = patient.acceptedUnitId;
  return eligibleCandidatesAmong(patient, units, now, 3).map((candidate, index) => ({
    unit: candidate.unit,
    verdict: candidate.verdict,
    rank: index + 1,
    etaLabel: candidate.unit.id === recordedDestinationId ? transportStatusLabel(patient.transport) : "Not yet booked",
  }));
}

/**
 * Compares the candidate unit's health service against the *origin ED's* health service —
 * this is NOT catchment. Catchment is where the patient lives, not where they presented, and
 * `Movement` has no catchment field (see the doc comment on `movementHealthService` and the
 * glossary's Catchment entry). Naming this `catchmentFit` previously collapsed exactly the
 * distinction Accepted ADR 3 exists to keep separate.
 *
 * The two labels are the fact this function computes and nothing more. They were "Best" and
 * "Escalation" until Phase 8 Task 6. "Best" was the defect: on screen it read as the system's
 * opinion about which bed this person should have, when all that was compared was two health
 * service names — the doc comment above already said so at length, and the label did not.
 * Phase 8 puts honest travel bands on this same screen, which would have made the superlative
 * look as though it had been checked too.
 *
 * THIS FUNCTION sorts, ranks and hides nothing: it answers one yes/no comparison about one
 * candidate and returns a label for it. That is a claim about this function alone, and it is
 * deliberately not a claim about the file. `candidatesFor` above orders the shortlist and cuts it
 * to three (`eligibleCandidatesAmong` sorts it twice), and the compare table renders a positional
 * rank beside each column heading. Those predate Phase 8, are a deliberate three-of-many
 * shortlist on this screen rather than a truncation bug, and are out of scope here — the point is
 * only that the LABEL must not stack a ranking claim of its own on top of them, which is exactly
 * what "Best" did. Neither label may ever carry a comparative word
 * (`tests/ward-management.test.ts` pins that, the same guard `tests/ward-travel-bands.test.ts`
 * holds over the band labels). The tones are unchanged — a colour is not a claim in the way a
 * word is.
 */
export function originServiceFit(patient: Movement, unit: Unit) {
  const unitService = siteByCode(unit.siteCode)?.service;
  if (unitService && unitService === movementHealthService(patient)) {
    return { label: "Same health service", tone: "good" as const };
  }
  return { label: "Different health service", tone: "warning" as const };
}

export function settingFit(patient: Movement, unit: Unit, now: Instant) {
  const verdict = eligibility(patient, unit, now);
  const cohortOk = verdict.gates.find((gate) => gate.gate === "cohort")?.pass ?? false;
  const securityOk = verdict.gates.find((gate) => gate.gate === "security")?.pass ?? false;
  if (cohortOk && securityOk) return { label: "Exact match", tone: "good" as const };
  if (cohortOk || securityOk) return { label: "Partial match", tone: "warning" as const };
  return { label: "Not eligible", tone: "danger" as const };
}

export function transportTone(etaLabel: string) {
  return /requested|awaiting|not yet/i.test(etaLabel) ? "warning" : "good";
}
