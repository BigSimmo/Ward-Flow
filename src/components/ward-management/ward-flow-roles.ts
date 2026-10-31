/**
 * `WardFlowRole` and its display labels, in their own module.
 *
 * RELOCATED FROM `ward-flow-events.ts` (Spec D15 restoration, 2026-09-11). The declarations below
 * are unchanged — same name, same values, same doc comments — only their home moved. Before this
 * move, `ward-model.ts` reached `WardFlowRole` with `import type { WardFlowRole } from
 * "@/components/ward-management/ward-flow-events"`, and `ward-flow-events.ts` also declares the
 * bed-release event types (`FLAG_BED_RELEASE`, `CONFIRM_BED_RELEASE`, …) and imports
 * `BedReleaseWaitingOn` at its own top. A type-only import is erased before anything runs, so it
 * created no cycle — but it DID put the whole `ward-flow-events.ts` module, release types
 * included, inside the module graph the D15 contract in `tests/ward-referral-matching.test.ts`
 * walks from `ward-eligibility.ts`/`ward-referrals.ts`, purely to reach one role type that has
 * nothing to do with bed releases. This module exists so `ward-model.ts` can reach `WardFlowRole`
 * without reaching that union at all. `ward-flow-events.ts` now imports from here too, rather than
 * declaring these itself.
 */

/**
 * Who may raise an event. `demo` is the jump-forward / reset control on the coordinator screen —
 * it belongs to nobody's clinical role, which is exactly why it needs its own gate rather than
 * being nodded through as "coordinator". `community` is Task 3 (Phase 7, "The front door"): one
 * role covering every `ReferralSource` the front door has no seat for on its own (community,
 * crisis_service, ambulance, inter_hospital, and — owner answer 25, 2026-09-17 — `gp`) —
 * the source itself is recorded on the `Referral`, so a separate role per source would be six
 * things to maintain before anything is known to actually need them apart. `ed_medical` is the one
 * source with its own seat: R9 (owner item 23, 2026-09-17) has intake record role `ed` for it, and
 * the reducer's `RECEIVE_REFERRAL` case refuses role `ed` paired with any other source.
 */
export type WardFlowRole =
  "coordinator" | "ed" | "ward" | "officer" | "demo" | "community" | "bed_manager" | "executive";

/**
 * The ROLE a decision is recorded against — never a person, and never a name.
 *
 * Exists because `ACCEPT_REFERRAL` and `DECLINE_REFERRAL` were coordinator-only until FD-25
 * widened them to `["ward", "coordinator"]`, while the reducer wrote `decidedBy: "Flow
 * coordinator"` as a literal. A ward accepting would have been recorded as the coordinator having
 * decided — a false entry in the one field that says who answered, and precisely the fact the
 * override register (FD-27) exists to make accountable.
 *
 * Exhaustive over `WardFlowRole` on purpose: a new role cannot be added without deciding what a
 * decision by it is called, rather than silently inheriting somebody else's label.
 *
 * Distinct from `roleLabels` in `ward-derivations.ts`, which maps the three-value UI `WardRole`
 * ("flow" | "ed" | "ward"). The two vocabularies are not the same and must not be conflated —
 * `WardRole` has no `coordinator`, and this has no `flow`.
 */
// Q66 (Josh, 31 Oct 2026): new records save the new role names. Records saved before then hold the
// earlier words (`EARLIER_ROLE_LABELS`); they are never rewritten, and every reader accepts both.
export const WARD_FLOW_ROLE_LABELS: Record<WardFlowRole, string> = {
  coordinator: "Bed coordinator",
  ed: "ED clinician",
  ward: "Nurse in charge",
  officer: "Transport officer",
  demo: "Demonstration control",
  community: "Community team",
  bed_manager: "Site bed manager",
  executive: "Executive",
};

/**
 * Q66 (Josh, 31 Oct 2026): the role words records saved before 31 Oct 2026 hold, and the role each
 * names. Stored records keep them; anything that parses, matches, filters or compares stored role
 * text reads them through `roleOfRecordedLabel`, so an older record stays valid.
 */
export const EARLIER_ROLE_LABELS: Readonly<Record<string, WardFlowRole>> = {
  "Ward manager": "ward",
  "Community service": "community",
  "Community clinician": "community",
  "Bed manager": "bed_manager",
};

/** The role a stored role label names, in the current words or the earlier ones, or `null`. */
export function roleOfRecordedLabel(label: string): WardFlowRole | null {
  const roles = Object.keys(WARD_FLOW_ROLE_LABELS) as WardFlowRole[];
  const current = roles.find((role) => WARD_FLOW_ROLE_LABELS[role] === label);
  if (current !== undefined) return current;
  return Object.hasOwn(EARLIER_ROLE_LABELS, label) ? EARLIER_ROLE_LABELS[label]! : null;
}
