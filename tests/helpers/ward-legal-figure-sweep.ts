/**
 * The dueAt provenance sweep behind `tests/ward-legal-figure-guard.test.ts`, moved here unchanged
 * so the sweep can run in several test files at once (`ward-legal-figure-guard-sweep-*.test.ts`).
 * Every rule, candidate and assertion is the one the guard file carried; see its header for why
 * the guard exists.
 */
import { COMMUNITY_TEAM_PAGES } from "../../src/components/ward-management/community/community-derivations";
import {
  BROADCAST_CATEGORIES,
  BROADCAST_SEVERITIES,
  BROADCAST_TARGET_SCOPES,
} from "../../src/components/ward-management/alerts/ward-broadcast-model";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { activeSnooze, SNOOZE_REASON_IDS } from "@/components/ward-management/ward-inbox-snooze";
import { referralState } from "../../src/components/ward-management/ward-referrals";
import { expect } from "vitest";
import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  CANCEL_TRANSPORT_REASONS,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  LEGAL_STATUS_CHANGE_REASONS,
  RELEASE_PULL_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
  DIVERSION_REASONS,
  URGENCY_CHANGE_REASONS,
  URGENT_MARK_REASONS,
  WARD_INTAKE_CONSTRAINTS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
} from "../../src/components/ward-management/ward-change-reasons";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { ABSENCE_STEPS } from "@/components/ward-management/ward-model";
import { EVENT_ROLE, type WardFlowEvent } from "../../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../../src/components/ward-management/ward-flow-reducer";
import { SELECTABLE_LEGAL_FORMS } from "../../src/components/ward-management/ward-legal-forms";
import {
  BED_RELEASE_WAITING_ON,
  DECLINE_REASONS,
  MOVEMENT_STAGES,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_GENDERS,
  STEP_BACK_REASONS,
  TRANSPORT_PROVIDERS,
  type LegalStatus,
  type Notice,
} from "../../src/components/ward-management/ward-model";
import { WARD_SCENARIOS } from "../../src/components/ward-management/ward-scenarios";
import { allEmergencyDepartments, NOW_ANCHOR } from "../../src/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./ward-referral-history";

/**
 * 🔴 **DELETED 2026-09-17, T2 — `DEADLINE_BEARING_FORM_PROVENANCE`, THE CODE ALLOWLIST.** It stood
 * here from wave 3 (2026-08-24) until this date: `{ "4A": "…", "4C": "…" }`, and Part 1's rule was
 * "no form of ANY code carries a `dueAt` unless its code appears here". Owner answer 1,
 * 2026-09-17: the clinician types the expiry written on whichever form they hold, of any code —
 * so a real Form 1A, 3B or 3D carrying a `dueAt` is now correct, and a code allowlist that refused
 * it would be refusing the feature itself, not a fabrication. `KNOWN_DUE_AT_VALUES` and
 * `suppliedDueAt` below replace it with the PROVENANCE PROPERTY this file's own header now
 * describes: never mind which code a `dueAt` sits on — is the VALUE one this file supplied, or an
 * authored fixture value? Left here as a struck record rather than removed silently, so a reader
 * who has seen this name cited elsewhere in this codebase's history finds why it is gone.
 */

/**
 * THE PROVENANCE SET (Part 1's rule, since T2, 2026-09-17). Every `dueAt` VALUE this file has
 * asked, or is about to ask, the reducer to write — populated by `suppliedDueAt` at every
 * construction site below. `offendingFormsIn` flags a `dueAt` found in a resulting state exactly
 * when it is neither a member of this set NOR its own movement's authored fixture value (see
 * `AUTHORED_FIXTURE_DUE_AT` below) — whatever code it sits on.
 *
 * Global and mutable ON PURPOSE: the whole sweep below constructs many events across many rounds
 * with a shifting `now`, so a formula (`value === someNow + fixedOffset`) cannot recognise every
 * legitimate value without also having to know which `now` produced it. Recording the literal
 * value at the moment this file constructs it is simpler and cannot drift from what was actually
 * supplied.
 *
 * 🔴 **T2r FIX ROUND, FINDING 5 (2026-09-17) — NO LONGER SEEDED FROM THE WHOLE FIXTURE.** Until
 * this fix, this set was pre-populated with EVERY `dueAt` any seeded movement carries, which meant
 * any movement anywhere in the sweep's state could carry ANY fixture movement's value and pass —
 * a mutation that copied `WF-004`'s `NOW_ANCHOR + 300` onto an unrelated movement (say, a freshly
 * raised 3D the sweep itself created) would have been WAVED THROUGH, because the value existed
 * somewhere in the fixture, not because it belonged to that record. `AUTHORED_FIXTURE_DUE_AT`
 * closes that by tying each authored value to the ONE movement id that legitimately carries it.
 */
export const KNOWN_DUE_AT_VALUES = new Set<number>();

/**
 * Movement id → its own authored `dueAt`, pinned against `ward-movements.ts` directly (T2r fix
 * round, finding 5, 2026-09-17; two more added by the 2026-09-17 sample-data pass) — the six, and
 * only six, deadlines ever hand-authored into the fixture (`grep -n "dueAt: NOW_ANCHOR"
 * ward-movements.ts` finds exactly these six lines: WF-004, WF-006, WF-011, WF-014, and the sample
 * data pass's WF-023 and WF-025). A movement's `dueAt` is legitimate against THIS map only when it
 * equals its OWN id's entry — a value borrowed from a different movement's authored figure is not,
 * and `offendingFormsIn` is what makes that distinction bite.
 *
 * `seedWardFlowState` (`ward-flow-reducer.ts`) always builds `movements` from
 * `structuredClone(wardMovements)` regardless of `scenario` — `scenario` only selects
 * `scenarioUnits(scenario)` — so these six ids and values survive identically under both
 * `WARD_SCENARIOS` entries ("standard" and "scarce") and under `RESET_SCENARIO`/`SET_SCENARIO`.
 * Verified by reading `seedWardFlowState`'s own body rather than assumed, per this fix round's own
 * instruction to hand back if that did not hold.
 */
export const AUTHORED_FIXTURE_DUE_AT: Record<string, number> = {
  "WF-004": NOW_ANCHOR + 300,
  "WF-006": NOW_ANCHOR + 90,
  "WF-011": NOW_ANCHOR + 340,
  "WF-014": NOW_ANCHOR + 60,
  "WF-023": NOW_ANCHOR + 400,
  "WF-025": NOW_ANCHOR + 150,
};

/**
 * Registers a `dueAt` this file is about to ask the reducer to write, and returns it unchanged —
 * so a construction site reads as `dueAt: suppliedDueAt(now + 700_000)` rather than needing a
 * separate registration statement that could be forgotten. Every call site below uses a distinct,
 * clearly-artificial offset (`700_000`+ minutes — over 486 days) so a supplied sentinel can never
 * be mistaken for a plausible clinical figure, and so the offsets do not collide with each other
 * or with the mutation-proof figure named in this task's own brief (`event.now + 4320`).
 */
export function suppliedDueAt(value: number): number {
  KNOWN_DUE_AT_VALUES.add(value);
  return value;
}

/**
 * Every code the sweep drives, taken from `SELECTABLE_LEGAL_FORMS` rather than hand-listed.
 *
 * **INVERTED on 2026-08-24, and this is the whole point of the change.** This was
 * `EXAMINATION_TIMELINE_CODES = new Set(["1A", "3B"])` — a remembered pair. The intake picker
 * then made 3D, 4A and 4C runtime-authorable, and the sweep still drove only 1A and 3B, so a
 * branch keyed on any other code was invisible. Measured, not theorised: a
 * `movement.legalForm?.code === "3D" ? { ...movement.legalForm, dueAt: event.now + 10080 }` put
 * inside `TRANSPORT_ACCEPTED` left the entire ward suite green at 20 files / 252 passed, with a
 * seven-day fabricated deadline live on a Form 3D that the console would render as "due …" and
 * the shortlist as "due in N min".
 *
 * Deriving it from the picker's own list means **a code added later is checked by default rather
 * than by being remembered**. The rule the sweep applies is still `offendingFormsIn`'s — since
 * T2 (2026-09-17), no form of ANY code may carry a `dueAt` unless the VALUE is one this file
 * supplied or the fixture already carries — so widening the codes widens coverage without
 * widening what is permitted.
 */
export const SWEEP_CODES: readonly string[] = SELECTABLE_LEGAL_FORMS.map((form) => form.code);

/** Every event type in the union, taken from the role table so a new variant cannot be forgotten. */
export const ALL_EVENT_TYPES = Object.keys(EVENT_ROLE) as WardFlowEvent["type"][];

/** Every `LegalStatus` value, hand-listed — `ward-model.ts` exports the type but no runtime list
 *  of its members, the same reason `ed-screen.tsx` keeps its own `LEGAL_STATUS_OPTIONS`. */
export const LEGAL_STATUS_OPTIONS: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

/**
 * Task 3 (Phase 7, "The front door"): one always-valid candidate is enough to prove the branch is
 * reached — one candidate list, named so it can be emptied by a single mutation for Step 4's own
 * "traversal assertion names the event that stopped being reached" proof.
 *
 * Fix round B (review finding I2): `RECEIVE_REFERRAL` used to guard on role alone; it now also
 * membership-checks `ageBand`, `source` and `homeRegion`, validates `urgency`, and resolves
 * `originSiteCode` against the real site list (`ward-flow-reducer.ts`). Every field below must
 * stay valid against those checks for this candidate to keep being accepted — `homeRegion` was
 * added here for exactly that reason when the field was added to `Referral`. The three ward-arm
 * fields now sit under `destinations[0]` and are validated through it; the event takes a LIST
 * since FD-21, so this candidate addresses exactly one destination.
 */
export const RECEIVE_REFERRAL_CANDIDATE = {
  ageBand: "Adult" as const,
  // 2026-08-30, destination union: `sex`, `secureBedNeeded` and `involuntaryBedNeeded` sat flat
  // here until they moved onto the ward arm of `ReferralDestination`. A STRUCTURAL change only —
  // the same three values, the same always-valid candidate, and no figure, timeframe or threshold
  // anywhere near it. This file is touched as little as possible on purpose; the edit was forced
  // by the event type it constructs, not chosen.
  destinations: [
    {
      kind: "psychiatric_ward" as const,
      sex: "Female" as const,
      gender: "Female" as const, // R7 (2026-09-25): record gender so the walk needs no coordinator review
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    },
  ],
  homeRegion: "Perth Metropolitan" as const,
  // A real suburb from the catchment table, because the front door resolves it rather than
  // measuring its length. No figure, timeframe or threshold — this file stays touched as
  // little as possible and the edit is forced by the event type, not chosen.
  suburb: { kind: "named", name: "Armadale" } as const,
  source: "community" as const,
  urgency: 2 as const,
  originSiteCode: "SCGH",
  transportNeeded: false,
  ...FIXTURE_HISTORY,
};

/**
 * Candidate events of one type, generated against the CURRENT state rather than hard-coded, so a
 * fixture change cannot silently make the traversal untestable. Every candidate carries the role
 * the role table requires — a wrong role is refused before the reducer body runs, and a refused
 * event proves nothing about what the reducer body does.
 *
 * `supplyDueAt` (T2r fix round, finding 3, 2026-09-17): whether the two candidate generators that
 * can put a typed expiry on a movement (`RAISE_REFERRAL`'s `legalFormDueAt`,
 * `RECORD_LEGAL_FORM_EXPIRY`'s `dueAt`) are offered at all. Defaults to `true` so every existing
 * call site keeps behaving exactly as before. `false` is the pass that proves the guard is not
 * blind to a reducer that only FILLS IN a `dueAt` when one is absent — see this file's own
 * "supplyDueAt: false ... never leaves a movement with no dueAt to fill in" test for why that gap
 * was real: when every RAISE_REFERRAL candidate always supplied a sentinel, a movement never
 * reached later events with `legalForm.dueAt === undefined`, so a mutation that fabricates a value
 * ONLY in that absent case was never given the precondition it needed to fire.
 */
export function candidateEvents(
  type: WardFlowEvent["type"],
  state: WardFlowState,
  now: number,
  supplyDueAt = true,
): WardFlowEvent[] {
  // `EVENT_ROLE[type]` is a non-empty list of permitted roles (widened this task, spec D2); any
  // one of them is refused by the role check identically to any other, so the first is enough to
  // get past the gate and exercise the reducer body — the coverage this sweep is checking never
  // depends on which of two permitted roles raised the event.
  const role = EVENT_ROLE[type][0];
  const movementIds = state.movements.map((movement) => movement.id);
  const unitIds = state.units.map((unit) => unit.id);
  // Only the five placement/mismatch candidates need the Cartesian product. Constructing it
  // for all actions made the complete inventory sweep exceed its existing time limit.
  const pairs = () => movementIds.flatMap((movementId) => unitIds.map((unitId) => ({ movementId, unitId })));

  switch (type) {
    case "RECORD_ADMISSION_CARE":
      return state.admissions
        .filter((a) => a.patientId !== null && a.state === "occupied")
        .map((a) => ({
          type,
          role: "coordinator",
          now,
          admissionId: a.id,
          patientId: a.patientId!,
          expectedGeneration: state.worldGeneration,
          expectedRevision: state.dischargeRevisions[a.id] ?? 0,
          change: { kind: "plan", item: "crisis_plan", status: "in_progress" },
        }));
    case "RECORD_ADMISSION_FOLLOW_UP":
      return state.admissions
        .filter((admission) => admission.patientId !== null && admission.state === "occupied")
        .map((admission) => ({
          type,
          role: "ward",
          now,
          actingUnitId: admission.unitId,
          admissionId: admission.id,
          patientId: admission.patientId!,
          expectedGeneration: state.worldGeneration,
          expectedRevision: state.dischargeRevisions[admission.id] ?? 0,
          followUpState: "arranged",
        }));
    case "RECORD_PATIENT_DISCHARGE":
      // A protected linked departure: use only a uniquely linked occupied admission, carry the
      // current world/revision guards, and cross the same closed destination vocabulary as the
      // legacy RECORD_LEAVING candidate below.
      return state.admissions.flatMap((admission) => {
        const patientId = admission.patientId;
        if (
          admission.state !== "occupied" ||
          patientId === null ||
          !state.patients.some((patient) => patient.id === patientId) ||
          !state.units.some((unit) => unit.id === admission.unitId)
        )
          return [];
        return LEAVING_DESTINATIONS.map((destination) => ({
          type,
          role,
          now,
          actingUnitId: admission.unitId,
          admissionId: admission.id,
          patientId,
          expectedGeneration: state.worldGeneration,
          expectedRevision: state.dischargeRevisions[admission.id] ?? 0,
          leavingDestination: destination.id,
        }));
      });
    case "OPEN_DISCHARGE_RECORD":
      // Opening is a guarded read receipt, not a clinical transition. Coordinator is the first
      // permitted role today; retaining the ward scope arm keeps this candidate valid if that
      // declared role order changes.
      return state.admissions.map((admission) => ({
        type,
        role,
        now,
        ...(role === "ward" ? { actingUnitId: admission.unitId } : {}),
        admissionId: admission.id,
        expectedGeneration: state.worldGeneration,
        requestId: state.auditSequence + 1,
      }));
    case "REVIEW_AUDIT_EVENT":
      // Reviews target an existing non-review event in this generation and carry that event's
      // current review count. Both closed decisions are real stored values, so exercise both.
      return state.auditEvents
        .filter((entry) => entry.generation === state.worldGeneration && entry.category !== "review")
        .flatMap((entry) =>
          (["reviewed", "follow-up-required"] as const).map((decision) => ({
            type,
            role,
            now,
            eventId: entry.id,
            expectedGeneration: state.worldGeneration,
            expectedReviewCount: state.auditReviews.filter(
              (review) => review.generation === state.worldGeneration && review.eventId === entry.id,
            ).length,
            decision,
          })),
        );
    case "SET_ARRIVAL_DETAILS":
      return movementIds.map((movementId) => ({
        type,
        role,
        now,
        movementId,
        arrivalMode: "mental_health_transport",
        estimatedArrivalAt: now + 120,
      }));
    case "RECORD_MOVEMENT_MEDICAL_CLEARANCE":
      return movementIds.map((movementId) => ({
        type,
        role,
        now,
        movementId,
        cleared: true,
      }));
    case "UPLOAD_PATIENT_FORM":
      return movementIds.map((movementId) => ({
        type,
        role,
        now,
        movementId,
        formName: "MHA Form",
        fileName: "form.pdf",
        sizeBytes: 512,
      }));
    case "SET_STEP_DOWN_CANDIDATE":
      return state.admissions.map((admission) => ({
        type,
        role,
        now,
        admissionId: admission.id,
        // Mirrors the admission's own unit, the same claim-not-proof discipline the reducer's
        // ward-scoped guard now enforces.
        actingUnitId: admission.unitId,
        stepDownCandidate: true,
      }));
    case "SET_DISCHARGE_BARRIER":
      return state.admissions.map((admission) => ({
        type,
        role,
        now,
        admissionId: admission.id,
        actingUnitId: admission.unitId,
        barrier: "Accommodation / Housing",
      }));
    case "RAISE_REFERRAL":
      // Since 2026-08-24 the form is CHOSEN on the draft rather than derived from the status, so
      // the candidates now cross every selectable code (and "no form") with both
      // awaiting-examination statuses. RAISE_REFERRAL is the only remaining place a form is
      // authored at runtime, which makes this the one generator that can put a fabricated
      // `dueAt` on a live movement — it must therefore reach every code, not just the two the
      // deleted derivation used to produce.
      //
      // 🔴 T2 (2026-09-17): every candidate ALSO supplies a `legalFormDueAt` sentinel when
      // `supplyDueAt` is true, registered via `suppliedDueAt` at the moment it is constructed.
      // Before that date only 4A and 4C could acquire one, so the round-robin sweep never
      // exercised capture on the other three codes at all; owner answer 1 lifted that restriction,
      // so this generator proves the capture path for every code, not only the two that used to be
      // allowed one.
      //
      // 🔴 T2r fix round, finding 3 (2026-09-17): `supplyDueAt: false` omits the field entirely
      // (`undefined`, the caller-forgot-to-fill-it-in shape, never a computed default) rather than
      // supplying a sentinel — so a movement raised in that pass genuinely starts with no `dueAt`
      // for later events to find absent.
      return allEmergencyDepartments().flatMap((ed) =>
        (["Referred for psychiatric examination", "Detained awaiting examination"] as LegalStatus[]).flatMap(
          (legalStatus) =>
            [...SELECTABLE_LEGAL_FORMS.map((form) => form.code), null].map((legalFormCode) => ({
              type,
              role,
              now,
              edId: ed.id,
              draft: {
                cohort: "Adult" as const,
                security: "Open" as const,
                sex: "Female" as const,
                gender: "Female" as const, // R7 (2026-09-25): record gender so the walk needs no coordinator review
                specialling: false,
                highAcuity: false,
                legalStatus,
                urgency: 2 as const,
                legalFormCode,
                ...(supplyDueAt ? { legalFormDueAt: suppliedDueAt(now + 700_000) } : {}),
              },
            })),
        ),
      );
    // Referral-scoped, so it is driven from referral ids rather than movement ids. Both boolean
    // answers are generated: a sweep that only ever recorded `cleared: true` would leave the
    // "not cleared" path untraversed while reporting the event as covered.
    case "RECORD_MEDICAL_CLEARANCE":
      return state.referrals.flatMap((referral) =>
        [true, false].map((cleared) => ({ type, role, now, referralId: referral.id, cleared })),
      );
    // Referral-scoped like the clearance above, and driven from every referral rather than a
    // chosen one — the sweep's point is that no path through the reducer writes a legal figure,
    // and a candidate list narrowed to referrals that happen to be untriaged would leave the
    // already-present ones untraversed while still reporting the event as covered.
    case "RECORD_ARRIVED_IN_DEPARTMENT":
    // Referral-scoped for the same reason, and driven from every referral rather than only the
    // withdrawable ones: a candidate list narrowed to referrals with a queued destination would
    // leave the refusal paths untraversed while still reporting the event as covered, which is
    // exactly the shape the two comments above refuse.
    case "RECORD_REFERRER_WITHDRAWAL":
      return state.referrals.map((referral) => ({ type, role, now, referralId: referral.id }));
    // RB7 (build plan item 27, 2026-09-17). Referral-scoped for the same reason as
    // RECORD_REFERRER_WITHDRAWAL directly above, and driven from every referral: a note is refused
    // only for a referral id that does not resolve, blank text, or over-limit text, none of which
    // this fixed, short, real-referencing candidate can ever be.
    case "ADD_REFERRAL_CORRECTION":
      return state.referrals.map((referral) => ({
        type,
        role,
        now,
        referralId: referral.id,
        note: "Sweep-generated correction note.",
      }));
    case "RECORD_EXAMINATION":
      return movementIds.flatMap((movementId) =>
        (["inpatient_order", "community_order", "revoked"] as const).map((outcome) => ({
          type,
          role,
          now,
          movementId,
          outcome,
        })),
      );
    case "RECORD_LEGAL_FORM_WRITTEN":
      return state.movements.map((m) => ({
        type,
        role,
        now,
        movementId: m.id,
        formCode: m.legalForm?.code ?? "1A",
        writtenAt: now,
        ...(supplyDueAt ? { paperExpiresAt: suppliedDueAt(now + 710_000) } : {}),
      }));
    case "RECORD_LEGAL_FORM_CONTINUATION":
      return state.movements.map((m) => ({
        type,
        role,
        now,
        movementId: m.id,
        formCode: m.legalForm?.code ?? "5B",
        startedAt: now,
        ...(supplyDueAt ? { paperExpiresAt: suppliedDueAt(now + 720_000) } : {}),
      }));
    case "RECORD_COUNTRY_EXTENSION":
    case "EVALUATE_ARRIVAL_LATENESS":
    case "CLEAR_EXPECT_FLAG":
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    case "RAISE_EXPECT_FLAG":
      return movementIds.map((movementId) => ({ type, role, now, movementId, kind: "voluntary_48h" }));
    case "FLAG_LEGAL_MISMATCH":
      return pairs().map(({ movementId, unitId }) => ({
        type,
        role,
        now,
        movementId,
        unitId,
        kind: "involuntary_on_voluntary_ward",
      }));
    case "RELEASE_AND_REOPEN_SEARCH":
      return state.movements
        .filter((m) => m.acceptedUnitId !== undefined)
        .map((m) => ({
          type,
          role,
          now,
          movementId: m.id,
          actingUnitId: m.acceptedUnitId!,
          reason: RELEASE_PULL_REASONS[0],
        }));
    case "EVALUATE_LEAVE_BED_WARNINGS":
    case "RECORD_HANDOVER_SIGN_OFF":
      return [{ type, role, now }];
    case "CONFIRM_MORNING_ROLLUP":
      return unitIds.map((unitId) => ({ type, role, now, unitId, actingUnitId: unitId, expectedDischarges: 0 }));
    case "SEND_WARD_BUZZ":
      return unitIds.map((unitId) => ({ type, role, now, unitId, message: "Synthetic ward count request" }));
    case "RECORD_CLINICAL_CONTACT":
      return COMMUNITY_TEAM_PAGES.map((team) => ({ type, role, now, teamId: team.id }));
    case "RECORD_REPATRIATION":
      return state.admissions.map((admission) => ({
        type,
        role,
        now,
        admissionId: admission.id,
        homeHospital: state.units[0].siteCode,
        receivingWardAgreed: true,
        mode: "road",
        provider: TRANSPORT_PROVIDERS[0],
        cadNumber: "SYNTHETIC-GUARD",
        transportLegalStatus: "voluntary",
        estimatedAt: now + 30,
      }));
    case "RECORD_LEGAL_FORM_RECEIVED":
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    // T4 (2026-09-17). One candidate per movement, carrying the first fixed correction reason —
    // this sweep exercises every movement whether or not it actually carries a receipt to
    // correct, and the reducer's own "no recorded legal form receipt to correct" refusal handles
    // the rest exactly like every other precondition refusal here.
    case "CORRECT_LEGAL_FORM_RECEIPT":
      return movementIds.map((movementId) => ({
        type,
        role,
        now,
        movementId,
        reason: LEGAL_FORM_RECEIPT_CORRECTION_REASONS[0],
      }));
    // T2 (2026-09-17). One candidate per movement, carrying a registered sentinel `dueAt` — the
    // event this sweep exists to prove never lets an INVENTED value through, whatever movement it
    // lands on.
    //
    // T2r fix round, finding 3 (2026-09-17): this event's `dueAt` is required, not optional, so
    // there is no "supplied but empty" shape to fall back to when `supplyDueAt` is false — no
    // candidate is offered at all, the same "this pass introduces no dueAt sentinel through the
    // round-robin" guarantee `RAISE_REFERRAL`'s own case above holds to.
    case "RECORD_LEGAL_FORM_EXPIRY":
      return supplyDueAt
        ? movementIds.map((movementId) => ({ type, role, now, movementId, dueAt: suppliedDueAt(now + 800_000) }))
        : [];
    // Opus review round 2, 17 September 2026 (P2). One candidate per movement crossed with every
    // `REFERRAL_GENDERS` value — the same "one candidate per real domain value" precedent
    // CHANGE_URGENCY/CHANGE_LEGAL_STATUS set above, so whichever gender a movement already
    // carries (including none), at least one candidate differs from it and the reducer's own
    // "already recorded as" refusal cannot make this event look unreachable to the sweep.
    case "RECORD_MOVEMENT_GENDER":
      return movementIds.flatMap((movementId) =>
        REFERRAL_GENDERS.map((gender) => ({ type, role, now, movementId, gender })),
      );
    case "REFER_TO_COMMUNITY_TEAM":
      return movementIds.map((movementId) => ({
        type,
        role,
        now,
        movementId,
        team: "Armadale Adult Community Mental Health",
      }));
    case "REFER_TO_UNITS":
      return pairs().map(({ movementId, unitId }) => ({ type, role, now, movementId, unitIds: [unitId] }));
    case "ACCEPT_IN_PRINCIPLE":
    case "PULL_PATIENT":
      return pairs().map(({ movementId, unitId }) => ({ type, role, now, movementId, unitId }));
    case "DECLINE":
      return pairs().map(({ movementId, unitId }) => ({
        type,
        role,
        now,
        movementId,
        unitId,
        reason: DECLINE_REASONS[0],
      }));
    // RA1 (item 18, 2026-09-17). Same shape as DECLINE immediately above — one candidate per
    // (movement, unit) pair, reason fixed to the first `WARD_REQUEST_WITHDRAWAL_REASONS` entry
    // (same "the field this sweep needs varied is the pair, not the reason" precedent DECLINE
    // already sets) — the reducer's own `referredUnitIds` membership guard decides which pairs
    // actually succeed.
    case "WITHDRAW_WARD_REQUEST":
      return pairs().map(({ movementId, unitId }) => ({
        type,
        role,
        now,
        movementId,
        unitId,
        reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
      }));
    case "HANDOVER_READY":
    case "TRANSPORT_ACCEPTED":
    case "TRANSPORT_EN_ROUTE":
    case "PATIENT_COLLECTED":
    case "PATIENT_ARRIVED":
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    case "CONFIRM_CAPACITY":
      // `actingUnitId` mirrors `unitId`: the reducer refuses a mismatched pair outright, so a
      // generated mismatch would exercise the rejection path rather than this guard's subject.
      return unitIds.flatMap((unitId) =>
        [0, 1, 2].map((value) => ({
          type,
          role,
          now,
          unitId,
          actingUnitId: unitId,
          value,
          expectedRevision: state.units.find((unit) => unit.id === unitId)!.allocatable.revision ?? 0,
        })),
      );
    case "RECORD_WARD_INTAKE_CONSTRAINTS":
      // Same claim-not-proof discipline as CONFIRM_CAPACITY above: `actingUnitId` mirrors
      // `unitId`. Owner Answer 18 (second round, 2026-09-17) — `codes` may be empty (nothing
      // currently limiting intake) or a chosen subset of WARD_INTAKE_CONSTRAINTS, so both ends
      // are exercised rather than assuming either is reachable.
      return unitIds.flatMap((unitId) =>
        [[], [WARD_INTAKE_CONSTRAINTS[0]]].map((codes) => ({
          type,
          role,
          now,
          unitId,
          actingUnitId: unitId,
          codes,
        })),
      );
    case "RECORD_ESCALATION":
      return movementIds.map((movementId) => ({
        type,
        role,
        now,
        movementId,
        triedUnitIds: unitIds.slice(0, 1),
        contact: "State-wide bed coordination line",
      }));
    case "CHANGE_URGENCY":
      // One candidate per urgency tier — the same precedent SET_SCENARIO sets below — so the
      // sweep cannot silently leave two of the three tiers untested.
      return movementIds.flatMap((movementId) =>
        ([1, 2, 3] as const).map((urgency) => ({
          type,
          role,
          now,
          movementId,
          urgency,
          reason: URGENCY_CHANGE_REASONS[0],
        })),
      );
    case "CHANGE_LEGAL_STATUS":
      // One candidate per legal status, for the same reason.
      return movementIds.flatMap((movementId) =>
        LEGAL_STATUS_OPTIONS.map((legalStatus) => ({
          type,
          role,
          now,
          movementId,
          legalStatus,
          reason: LEGAL_STATUS_CHANGE_REASONS[0],
        })),
      );
    case "ADVANCE_CLOCK":
      return [{ type, role, now, minutes: 30 }];
    case "RESET_SCENARIO":
      return [{ type, role, now }];
    case "SET_SCENARIO":
      // Both scenarios, like RAISE_REFERRAL's real domain values above — not one hard-coded
      // choice that would leave the other half of `WARD_SCENARIOS` untested.
      return WARD_SCENARIOS.map((scenario) => ({ type, role, now, scenario }));
    case "RELEASE_PULL":
      // One candidate per reason, same precedent as CHANGE_URGENCY/CHANGE_LEGAL_STATUS above —
      // `role` is the first permitted role (coordinator), so `actingUnitId` is never needed here.
      return movementIds.flatMap((movementId) =>
        RELEASE_PULL_REASONS.map((reason) => ({ type, role, now, movementId, reason })),
      );
    case "BOOK_TRANSPORT":
      // One candidate per provider crossed with BOTH escort answers, the same "one candidate per
      // real domain value" precedent the reason-keyed events below set. Both booleans, because
      // `escortRequired` is the field this event exists to make somebody answer and a sweep that
      // only ever sent `true` would leave the other branch unentered.
      return movementIds.flatMap((movementId) =>
        TRANSPORT_PROVIDERS.flatMap((provider) =>
          [true, false].map((escortRequired) => ({
            type,
            role,
            now,
            movementId,
            provider,
            escortRequired,
            // Owner's third ruling, 2026-09-17: required and never defaulted on the real event, so
            // this sweep must supply stand-in values or every candidate is refused before the
            // legal-figure guard this sweep exists for is ever exercised.
            cadNumber: "CAD-SWEEP-0001",
            transportLegalStatus: "voluntary" as const,
            estimatedAt: now,
          })),
        ),
      );
    case "CANCEL_TRANSPORT":
      return movementIds.flatMap((movementId) =>
        CANCEL_TRANSPORT_REASONS.map((reason) => ({ type, role, now, movementId, reason })),
      );
    // WLQ-38 (owner, 2026-09-15). Same "one candidate per movement crossed with every reason"
    // precedent RELEASE_PULL/CANCEL_TRANSPORT above set — the reducer's own guards (transport must
    // be booked, collected, not yet arrived, movement open) decide which are accepted, and this
    // sweep offers every reason against every movement rather than pre-filtering to the ones that
    // will succeed.
    case "STOP_TRANSPORT":
      // `whereabouts` (T3, 2026-09-17) is fixed to the first `TRANSPORT_WHEREABOUTS` member, same
      // precedent `STEP_BACK_STAGE`'s fixed `reason` below sets: the dimension this sweep varies is
      // `reason`, not whereabouts, and every whereabouts value is membership-checked identically.
      return movementIds.flatMap((movementId) =>
        STOP_TRANSPORT_REASONS.map((reason) => ({
          type,
          role,
          now,
          movementId,
          reason,
          whereabouts: TRANSPORT_WHEREABOUTS[0],
        })),
      );
    // Task 5 (ward-flow movement step-track plan, 2026-09-04). Neither event ever touches
    // `movement.legalForm` — see the reducer's own two cases, whose entire side effect is
    // `stage`/`stageChanges`/`unwinds` (STEP_BACK_STAGE) or those plus `acceptedUnitId`/
    // `acceptedAt` (WITHDRAW_ACCEPTANCE) — so this sweep exercises them for the same reason it
    // exercises every other event: to prove the absence, not to assume it.
    case "STEP_BACK_STAGE":
      // One candidate per target stage — the same "one candidate per real domain value"
      // precedent CHANGE_URGENCY/CHANGE_LEGAL_STATUS above set, crossed with movement ids so the
      // sweep can find whichever movement is actually at a stage `to` sits strictly before.
      // `reason` is fixed to the first STEP_BACK_REASON, matching that same precedent: the field
      // this sweep needs varied is `to`, not the reason.
      return movementIds.flatMap((movementId) =>
        MOVEMENT_STAGES.map((to) => ({ type, role, now, movementId, to, reason: STEP_BACK_REASONS[0] })),
      );
    case "WITHDRAW_ACCEPTANCE":
      // One candidate per reason, same precedent as RELEASE_PULL/CANCEL_TRANSPORT above.
      return movementIds.flatMap((movementId) =>
        STEP_BACK_REASONS.map((reason) => ({ type, role, now, movementId, reason })),
      );
    case "FLAG_BED_RELEASE":
      // `actingUnitId` mirrors `unitId`, same reasoning as CONFIRM_CAPACITY above. One candidate
      // per waiting-on value crossed with every blocker — the same "one candidate per real
      // domain value" precedent CHANGE_URGENCY/CHANGE_LEGAL_STATUS/SET_SCENARIO set, so a branch
      // keyed on either dimension is entered rather than assumed reachable. The Q1 axis change
      // (2026-08-28) widened this dimension from two confidence levels to five waiting-on values,
      // so the sweep now covers strictly more of the vocabulary that reaches a screen.
      // A release names the occupant whose stay it belongs to, looked up in the CURRENT state the
      // same way the release cases below derive their subject; a unit with no occupant free of a
      // live release offers no candidate rather than an invented id.
      return unitIds.flatMap((unitId) => {
        const occupant = state.admissions.find(
          (a) =>
            a.unitId === unitId &&
            a.state === "occupied" &&
            !state.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
        );
        if (!occupant) return [];
        return BED_RELEASE_WAITING_ON.flatMap((waitingOn) =>
          BED_RELEASE_BLOCKERS.map((blocker) => ({
            type,
            role,
            now,
            unitId,
            actingUnitId: unitId,
            admissionId: occupant.id,
            waitingOn,
            expectedAt: now + 60,
            blocker,
          })),
        );
      });
    case "CONFIRM_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
      // `actingUnitId` must mirror the RELEASE's own unit, not merely any unit id — the reducer
      // compares against `release.unitId`, same claim-not-proof discipline FLAG_BED_RELEASE's own
      // doc comment sets out. One candidate per release already in `state.bedReleases`, generated
      // against the current state rather than hard-coded, so a fixture change cannot silently
      // make this untestable.
      return state.bedReleases.map((release) => ({
        type,
        role,
        now,
        releaseId: release.id,
        actingUnitId: release.unitId,
      }));
    case "REVERT_BED_RELEASE":
      // Bed-model rework (2026-08-28). One candidate per release crossed with every waiting-on
      // value — the same "one candidate per real domain value" precedent every list-valued event
      // above follows, so a branch keyed on the chosen value cannot go unentered.
      return state.bedReleases.flatMap((release) =>
        BED_RELEASE_WAITING_ON.map((waitingOn) => ({
          type,
          role,
          now,
          releaseId: release.id,
          actingUnitId: release.unitId,
          waitingOn,
        })),
      );
    case "SET_BED_PREPARATION":
      // One candidate per release crossed with BOTH `preparing` values AND every permitted note
      // (plus `undefined`, which is "being made ready, reason not stated"). The note dimension is
      // new: `BED_PREPARATION_NOTES` was empty pending the product owner's list, so there was no
      // permitted value to sweep, and the comment here said this case would gain the cross-product
      // the day the array was filled. It was filled on 2026-08-28 and this is that cross-product.
      return state.bedReleases.flatMap((release) =>
        [true, false].flatMap((preparing) =>
          [undefined, ...BED_PREPARATION_NOTES].map((note) => ({
            type,
            role,
            now,
            releaseId: release.id,
            actingUnitId: release.unitId,
            preparing,
            note,
          })),
        ),
      );
    case "BLOCK_BED_RELEASE":
      // One candidate per release crossed with every blocker — the same "one candidate per real
      // domain value" precedent CHANGE_URGENCY/CHANGE_LEGAL_STATUS/SET_SCENARIO/FLAG_BED_RELEASE
      // set, so a branch keyed on the chosen blocker cannot go unentered.
      return state.bedReleases.flatMap((release) =>
        BED_RELEASE_BLOCKERS.map((blocker) => ({
          type,
          role,
          now,
          releaseId: release.id,
          actingUnitId: release.unitId,
          blocker,
        })),
      );
    case "RELEASE_BED":
      return state.bedReleases.map((release) => ({
        type,
        role,
        now,
        releaseId: release.id,
        actingUnitId: release.unitId,
      }));
    case "RECORD_LEAVE_BED":
      // One candidate per unit. This used to cross BOTH `usable` values, because the ward's
      // usable/not-usable statement was a real domain value the reducer stored verbatim. The owner
      // removed that field on 2026-09-06 — a ward cannot know whether a bed is fillable while its
      // occupant is away — so there is no longer a second branch to cross, and the payload is the
      // unit plus an expected return. `RECORD_LEAVING` below still cites this case as its
      // precedent for crossing; the reasoning it cites is the reasoning, not this event's shape.
      // A leave bed names its stay (owner ruling 2026-09-25): one candidate per unit, for an occupant
      // not already on leave, and none for a unit without one rather than an invented id.
      return unitIds.flatMap((unitId) => {
        const occupant = state.admissions.find(
          (admission) =>
            admission.unitId === unitId &&
            admission.state === "occupied" &&
            !state.leaveBeds.some((bed) => bed.admissionId === admission.id),
        );
        if (!occupant) return [];
        return [{ type, role, now, unitId, actingUnitId: unitId, admissionId: occupant.id, expectedReturn: now }];
      });
    case "END_LEAVE_BED":
      // `actingUnitId` must mirror the found leave bed's own unit, same discipline as
      // CONFIRM_BED_RELEASE above. One candidate per leave bed already in `state.leaveBeds`.
      return state.leaveBeds.map((leaveBed) => ({
        type,
        role,
        now,
        leaveBedId: leaveBed.id,
        actingUnitId: leaveBed.unitId,
      }));
    case "RECORD_ABSENT_WITHOUT_LEAVE":
      // D-38. One candidate per occupied stay, unconditioned: the reducer refuses a second absence,
      // and a stay already on leave turns into an absence rather than gaining a second held bed.
      return state.admissions
        .filter((admission) => admission.state === "occupied")
        .map((admission) => ({ type, role, now, admissionId: admission.id, actingUnitId: admission.unitId }));
    case "RECORD_ABSENCE_STEP":
      // D-38. Every fixed step for every held bed that records an absence, crossed rather than
      // sampled: each step is a real domain value the reducer stores.
      return state.leaveBeds
        .filter((bed) => bed.absentWithoutLeave)
        .flatMap((bed) =>
          ABSENCE_STEPS.map((step) => ({
            type,
            role,
            now,
            admissionId: bed.admissionId,
            actingUnitId: bed.unitId,
            step,
          })),
        );
    case "RECORD_COMMUNITY_TREATMENT_ORDER":
      // D-38. One candidate per patient. The order holds a form code, a time and a role, never a
      // lapse time, so it cannot carry a legal figure onto a record.
      return state.patients.map((patient) => ({ type, role, now, patientId: patient.id }));
    case "END_COMMUNITY_TREATMENT_ORDER":
      return state.patients.map((patient) => ({ type, role, now, patientId: patient.id }));
    case "WITHDRAW_REFERRAL":
      // One candidate per movement, unconditioned. The reducer's own guards decide which are
      // refused — a movement that has closed, one already accepted, one holding no live referral —
      // and a generator that pre-filtered to only the acceptable ones would sweep the happy path
      // alone, which is the half least likely to smuggle a legal figure onto a record.
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    case "RECORD_LEAVING":
      // One candidate per admission already in `state.admissions`, crossed with EVERY leaving
      // destination. Crossed rather than sampled for the reason `RECORD_LEAVE_BED` used to cross
      // both `usable` values: the destination is a real domain value the reducer stores verbatim,
      // and exactly one of the five does not count as a statewide release — so a sweep that tried
      // only one destination would leave that asymmetry untested.
      //
      // `actingUnitId` mirrors the admission's own unit, the same discipline `END_LEAVE_BED` uses,
      // because a mismatched acting unit is refused before the reducer body runs and a refused
      // event proves nothing about what the body does.
      return state.admissions.flatMap((admission) =>
        LEAVING_DESTINATIONS.map((destination) => ({
          type,
          role,
          now,
          admissionId: admission.id,
          actingUnitId: admission.unitId,
          leavingDestination: destination.id,
        })),
      );
    case "RECORD_TRANSPORT_NEED":
      // Both boolean answers per movement, on `RECORD_MEDICAL_CLEARANCE`'s own reasoning above: a
      // sweep that only ever recorded `needed: true` would leave the "not needed" path untraversed
      // while reporting the event as covered.
      return movementIds.flatMap((movementId) =>
        [true, false].map((needed) => ({ type, role, now, movementId, needed })),
      );
    case "RECORD_ED_MEDICAL_DETERIORATION":
      // Explicit origin scope is part of this command, not supplied by the reducer. Generate
      // candidates for every movement; the reducer decides which pre-collection ones qualify.
      return state.movements.map((movement) => ({
        type,
        role,
        now,
        movementId: movement.id,
        actingPlaceId: movement.originEdId,
      }));
    case "RECORD_LEFT_DEPARTMENT":
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    case "WITHDRAW_WARD_REQUEST":
      return state.movements.flatMap((m) =>
        (m.referredUnitIds ?? []).map((unitId) => ({
          type,
          role,
          now,
          movementId: m.id,
          unitId,
          reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
        })),
      );
    // RB3, item 19: one candidate per movement crossed with both outcomes, the same
    // RECORD_TRANSPORT_NEED precedent above — a sweep that tried only one outcome would leave the
    // other untraversed while reporting the event as covered.
    case "RECORD_ED_OUTCOME":
      return movementIds.flatMap((movementId) =>
        (["for_discharge", "for_community_follow_up"] as const).map((outcome) => ({
          type,
          role,
          now,
          movementId,
          outcome,
        })),
      );
    case "RECORD_NO_REFERRAL":
      // One candidate per movement; the whole payload is a movement id. The reducer writes a fixed
      // reason and the event's own instant, so there is no caller-supplied value to cross against.
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    // Item 37 (2026-09-17): FLAG_MOVEMENT_URGENT now carries a reason, so it moves to the "one
    // candidate per movement crossed with every reason" precedent RELEASE_PULL/CANCEL_TRANSPORT/
    // STOP_TRANSPORT above set — the sweep must not silently leave any of the ten untested.
    // CLEAR_MOVEMENT_URGENT_FLAG still carries none: clearing needs no reason (see its own doc
    // comment in ward-flow-events.ts), so there is nothing to cross against for that one.
    case "FLAG_MOVEMENT_URGENT":
      return movementIds.flatMap((movementId) =>
        URGENT_MARK_REASONS.map((reason) => ({ type, role, now, movementId, reason })),
      );
    case "CLEAR_MOVEMENT_URGENT_FLAG":
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    case "CLEAR_MOVEMENT_BLOCKER":
      // One candidate per movement; the whole payload is a movement id. The reducer writes one
      // fixed sentinel, so there is no caller-supplied value to cross against.
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    case "RECORD_MOVEMENT_BLOCKER":
      // One candidate per movement, carrying a deliberately dull sentence. `Movement.blocker` is
      // free prose with no vocabulary to cross against (owner ruling, 2026-09-01), so there is no
      // "one candidate per real domain value" crossing to do here — and the value is chosen to
      // carry no duration, quantity or statutory figure, because this sweep exists to prove none
      // reaches a legal form and a candidate that smuggled one in would be testing the test.
      return movementIds.map((movementId) => ({ type, role, now, movementId, blocker: "Awaiting a bed" }));
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
      // One candidate per admission already in `state.admissions`, `actingUnitId` mirroring the
      // admission's own unit — the same discipline `RECORD_LEAVING` above uses, and for the same
      // reason: a mismatched acting unit is refused before the reducer body runs, and a refused
      // event proves nothing about what the body does. Not crossed with anything, because neither
      // event carries a chosen domain value: their whole payload is an admission and the unit the
      // caller claims to be.
      return state.admissions.map((admission) => ({
        type,
        role,
        now,
        admissionId: admission.id,
        actingUnitId: admission.unitId,
      }));
    case "REQUEST_CAPACITY_REFRESH":
      // Coordinator-scoped (spec D12): one candidate per unit, no `actingUnitId` field exists on
      // this event at all.
      return unitIds.map((unitId) => ({ type, role, now, unitId }));
    case "RECEIVE_REFERRAL":
      return [{ type, role, now, ...RECEIVE_REFERRAL_CANDIDATE }];
    case "ADD_PATIENT":
      // Adding a patient links to nothing — no movement, no referral, no unit — which is exactly
      // why this candidate is a bare literal rather than a crossing of existing state. A patient
      // exists before any of those, and a candidate that needed one of them would be testing a
      // different event from the one the owner's flow describes.
      return [
        {
          type,
          role,
          now,
          umrn: "UM900001",
          givenName: "Sweep",
          familyName: "Candidate",
          dateOfBirth: "1980-01-01",
        },
      ];
    case "SET_CONFIGURATION":
      // Task 3 of the audit-wiring plan (2026-09-16): a coordinator-only event carrying no
      // movement, unit or referral link — the same "bare literal" shape ADD_PATIENT above uses,
      // and for the same reason: a candidate crossed with existing state would be testing a
      // different event from the one this actually is.
      return [
        {
          type,
          role,
          now,
          payload: { edAccessTargetMinutes: 1200, parallelReferralCap: 2, pullHoldMinutes: 90 },
        },
      ];
    case "ACCEPT_REFERRAL":
      // Every QUEUED referral crossed with every unit — the reducer's own `referralEligibility`
      // gate decides which pairing is actually accepted, so this offers every legitimate
      // candidate rather than guessing which one currently matches (allocatable counts and sex
      // mix shift as the sweep runs other event types).
      return state.referrals
        .filter((referral) => referralState(referral) === "queued")
        .flatMap((referral) =>
          unitIds.map((unitId) => ({
            type,
            role,
            now,
            referralId: referral.id,
            destinationKind: "psychiatric_ward" as const,
            unitId,
          })),
        );
    case "DECLINE_REFERRAL":
      // Every queued referral crossed with every real decline reason, same "offer every
      // legitimate candidate" reasoning as ACCEPT_REFERRAL above.
      return state.referrals
        .filter((referral) => referralState(referral) === "queued")
        .flatMap((referral) =>
          REFERRAL_DECLINE_REASONS.map((reason) => ({
            type,
            role,
            now,
            referralId: referral.id,
            destinationKind: "psychiatric_ward" as const,
            reason,
          })),
        );
    // Phase 8 Task 2. Generated against the CURRENT state for the same reason every list above
    // is: the sweep applies other event types as it goes, so which referrals are still queued
    // shifts underneath this. It offers every legitimate candidate and lets the reducer's own
    // guards decide, exactly as ACCEPT_REFERRAL and DECLINE_REFERRAL do — and it is a single
    // named list, so emptying it is the one-line mutation that proves the traversal assertion
    // names the unreached event. (Task 2R removed `REFERRAL_ARRIVED`, which had the same shape.)
    case "RECORD_LOCAL_BED_SOUGHT":
      return state.referrals
        .filter((referral) => referralState(referral) === "queued" && referral.localBedSought === undefined)
        .map((referral) => ({ type, role, now, referralId: referral.id }));
    /*
     * The three inbox work-state events, added 2026-09-06 with the coordinator's to-do panel.
     *
     * ⚠️ THEIR SUBJECT IS A DERIVED ROW, NOT A STORED RECORD. `InboxItem.id` is produced by
     * `buildActionInbox` from the CURRENT movements and units, so the candidates have to be
     * generated against `state` as it stands rather than from a fixture list — exactly the reason
     * `RECORD_LOCAL_BED_SOUGHT` above reads live state, and for the same reason: this sweep applies
     * other events as it goes, so which rows exist shifts underneath it.
     *
     * `COMPLETE` and `REOPEN` are each refused by the reducer unless the row is in the opposite
     * state, so offering every row for all three is right: the reducer's own guards decide, and a
     * refused event is a body this sweep has legitimately exercised.
     */
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "COMPLETE_INBOX_ITEM":
    case "REOPEN_INBOX_ITEM":
    case "TAKE_INBOX_ITEM_OWNERSHIP":
      return buildActionInbox(state.movements, now, state.units).map((item) => ({
        type,
        role,
        now,
        inboxItemId: item.id,
      }));
    /*
     * Stream A, 9 Oct 2026: snooze / return against live inbox rows. `until` stays inside the
     * act-now cap so a red row is not refused on length alone; reason is the first closed id.
     */
    case "SNOOZE_INBOX_ITEM":
      return buildActionInbox(state.movements, now, state.units).map((item) => ({
        type,
        role,
        now,
        inboxItemId: item.id,
        until: now + 30,
        reason: SNOOZE_REASON_IDS[0],
      }));
    case "UNSNOOZE_INBOX_ITEM":
      return Object.keys(state.inboxSnoozes)
        .filter((inboxItemId) => activeSnooze(state.inboxSnoozes[inboxItemId], now) !== undefined)
        .map((inboxItemId) => ({ type, role, now, inboxItemId }));
    /*
     * Added 25 September 2026 (the four events had no candidate, so the Form sweep could never
     * accept them). UPDATE_EXPECTED_DISCHARGE: one per admission still on a ward, a day ahead.
     * The broadcast trio: a dispatch built from the model's own vocabularies, then acknowledge and
     * stand down against whatever alerts the sweep has dispatched by then — read from live state,
     * like the inbox events below, because the sweep applies events as it goes.
     */
    case "UPDATE_EXPECTED_DISCHARGE":
      return state.admissions
        .filter((admission) => admission.state !== "departed")
        .map((admission) => ({ type, role, now, admissionId: admission.id, expectedDischargeAt: now + 24 * 60 }));
    case "DISPATCH_BROADCAST_ALERT":
      return [
        {
          type,
          role,
          now,
          title: "Synthetic network notice",
          message: "Synthetic broadcast for the legal-figure sweep",
          severity: BROADCAST_SEVERITIES[0]!,
          category: BROADCAST_CATEGORIES[0]!,
          targetScope: BROADCAST_TARGET_SCOPES[0]!,
          targetScopeLabel: "Synthetic scope",
          durationMinutes: 60,
          dispatchedByName: "Synthetic coordinator",
        },
      ];
    case "ACKNOWLEDGE_BROADCAST_ALERT":
      return state.broadcastAlerts.flatMap((alert) =>
        unitIds.map((unitId) => ({ type, role, now, alertId: alert.id, unitId })),
      );
    case "STAND_DOWN_BROADCAST_ALERT":
      return state.broadcastAlerts.map((alert) => ({ type, role, now, alertId: alert.id }));
    // Global alerts (10 Oct 2026): a Pull now for every movement, then each ward answering every
    // live alert. Read from live state, like the broadcast trio above.
    case "RAISE_PULL_NOW":
      return state.movements.map((movement) => ({ type, role, now, movementId: movement.id }));
    case "REPLY_BROADCAST_ALERT":
      return state.broadcastAlerts.flatMap((alert) =>
        unitIds.map((unitId) => ({ type, role, now, alertId: alert.id, unitId, answer: "pulling_now" as const })),
      );
    /*
     * Stream D planned admissions (9 Oct 2026): a booking on each ward, a change, cancel and arrival
     * for each booking still waiting — read from live state, like the broadcast trio above.
     */
    case "BOOK_PLANNED_ADMISSION":
      return unitIds.map((unitId) => ({
        type,
        role,
        now,
        initials: "AB",
        sex: "Female" as const,
        reason: "respite" as const,
        unitId,
        expectedArrivalAt: now + 60,
        expectedStayDays: 3,
        legalStatus: "Voluntary" as const,
        ageBand: state.units.find((unit) => unit.id === unitId)?.cohort ?? ("Adult" as const),
      }));
    case "CHANGE_PLANNED_ADMISSION":
      return state.plannedAdmissions
        .filter((planned) => planned.state === "booked")
        .map((planned) => ({
          type,
          role,
          now,
          plannedAdmissionId: planned.id,
          reason: planned.reason,
          unitId: planned.unitId,
          expectedArrivalAt: Math.max(now, planned.expectedArrivalAt),
          expectedStayDays: planned.expectedStayDays,
          legalStatus: planned.legalStatus,
        }));
    case "CANCEL_PLANNED_ADMISSION":
      return state.plannedAdmissions
        .filter((planned) => planned.state === "booked")
        .map((planned) => ({
          type,
          role,
          now,
          plannedAdmissionId: planned.id,
          unitId: planned.unitId,
          reason: "rebooked" as const,
        }));
    case "CONVERT_PLANNED_ADMISSION":
      return state.plannedAdmissions
        .filter((planned) => planned.state === "booked")
        .map((planned) => ({
          type,
          role,
          now,
          plannedAdmissionId: planned.id,
          unitId: planned.unitId,
          actingUnitId: planned.unitId,
        }));
    // Advisory carer/PSP/MHAS checklist (9 Oct 2026). Targets one movement or one admission —
    // candidates are built from live subjects so the reducer's own guards decide acceptance.
    case "RECORD_SUPPORT_NOTIFICATION": {
      const arrivalCandidates = state.movements.flatMap((movement) => {
        if (
          movement.legalStatus !== "Involuntary inpatient" &&
          movement.legalStatus !== "Detained awaiting examination"
        )
          return [];
        if (movement.closure?.outcome !== "arrived" && movement.stage !== "arrived") return [];
        const occasion = movement.sourceAdmissionId !== undefined ? ("transfer" as const) : ("admission" as const);
        return (["carer", "personal_support_person", "mhas"] as const).map((party) => ({
          type,
          role,
          now,
          occasion,
          movementId: movement.id,
          party,
          outcome: "told" as const,
          who: "Synthetic carer",
          contactedAt: now,
        }));
      });
      const dischargeCandidates = state.admissions.flatMap((admission) => {
        if (admission.state !== "departed" || admission.leftAt === null) return [];
        if (admission.leavingDestination === "transferred-to-another-psychiatric-ward") return [];
        return (["carer", "personal_support_person", "mhas"] as const).map((party) => ({
          type,
          role,
          now,
          occasion: "discharge" as const,
          admissionId: admission.id,
          party,
          outcome: "not_applicable" as const,
          reason: "Synthetic not-applicable reason",
        }));
      });
      return [...arrivalCandidates, ...dischargeCandidates];
    }
    default:
      return [];
  }
}

/** Event types that act on one named movement. The rest act on a unit, or on the whole scenario. */
export const MOVEMENT_TARGETED_EVENTS: ReadonlySet<WardFlowEvent["type"]> = new Set([
  "RECORD_EXAMINATION",
  // D-34 targets one movement and claims its originating ED; it is not a whole-state command.
  "RECORD_ED_MEDICAL_DETERIORATION",
  "REFER_TO_UNITS",
  "ACCEPT_IN_PRINCIPLE",
  "PULL_PATIENT",
  "DECLINE",
  "HANDOVER_READY",
  "TRANSPORT_ACCEPTED",
  "TRANSPORT_EN_ROUTE",
  "PATIENT_COLLECTED",
  "PATIENT_ARRIVED",
  "RECORD_ESCALATION",
  "CHANGE_URGENCY",
  "CHANGE_LEGAL_STATUS",
  "RELEASE_PULL",
  "CANCEL_TRANSPORT",
  // WLQ-38 (owner, 2026-09-15). Same shape as CANCEL_TRANSPORT immediately above — a real
  // movement-targeted event, forced per code in the same block for the same reason (see that
  // block's own comment).
  "STOP_TRANSPORT",
  // Owner answer 8 (second round, 2026-09-17). Same shape as STOP_TRANSPORT immediately above —
  // forced per code in the same block, right after STOP_TRANSPORT, since it needs the exact
  // movement STOP_TRANSPORT just closed.
  "RELEASE_HELD_BED",
  // Build plan item 29 (T4a). Forced per code in the same block as STOP_TRANSPORT — needs a
  // collected movement; RELEASE_DIVERTED_BED needs the diversion that follows.
  "RECORD_DIVERSION",
  "RELEASE_DIVERTED_BED",
  "RECORD_MOVEMENT_BLOCKER",
  "CLEAR_MOVEMENT_BLOCKER",
  "FLAG_MOVEMENT_URGENT",
  "CLEAR_MOVEMENT_URGENT_FLAG",
  // Task 5 (2026-09-04). Both carry `movementId` and act on one named movement, same as
  // RELEASE_PULL/CANCEL_TRANSPORT above — and, like those two, STEP_BACK_STAGE is excluded from
  // the round-robin sweep (see that `continue` and its comment) and exercised in the dedicated
  // per-code block instead. WITHDRAW_ACCEPTANCE stays in the round-robin — its precondition
  // (`accepted_awaiting_bed`) and effect (reverts to exactly `destination_review`) are as narrow
  // and bounded as RELEASE_PULL's own, so it does not derail the sweep the way STEP_BACK_STAGE's
  // near-universal precondition does, and is accepted there naturally.
  "STEP_BACK_STAGE",
  "WITHDRAW_ACCEPTANCE",
  // RA1 (item 18, 2026-09-17). Same shape as WITHDRAW_ACCEPTANCE immediately above — carries
  // `movementId`, acts on one named movement, and its precondition (a live `referredUnitIds`
  // member) is exactly DECLINE's own, so it stays in the round-robin like DECLINE rather than
  // needing the dedicated per-code block STEP_BACK_STAGE does.
  "WITHDRAW_WARD_REQUEST",
  "RECORD_LEGAL_FORM_RECEIVED",
  "REFER_TO_COMMUNITY_TEAM",
  // RB3, item 19. Carries `movementId`, same shape as RECORD_LEFT_DEPARTMENT below in this same
  // set — the two are a pair (an outcome must exist before a department can be marked left) and
  // belong in the round-robin together so the sweep can discover that ordering itself.
  "RECORD_ED_OUTCOME",
  // T2 (2026-09-17). Carries `movementId`, same as `RECORD_LEGAL_FORM_RECEIVED` immediately
  // above, and exercised explicitly per code in the dedicated block below for the same reason:
  // it needs a movement genuinely carrying a legal form, which the round-robin sweep's fixed
  // ordering cannot reliably guarantee is still open and unclosed by the time this event's turn
  // comes round.
  "RECORD_LEGAL_FORM_EXPIRY",
  // Opus review round 2, 17 September 2026 (P2). Carries `movementId`, no special precondition
  // beyond an open movement and an off-list/unchanged-value refusal — the same shape
  // `RECORD_LEGAL_FORM_RECEIVED` above holds to, so it stays in the round-robin rather than
  // needing a dedicated per-code block.
  "RECORD_MOVEMENT_GENDER",
  "RECORD_LEFT_DEPARTMENT",
  // T4 (2026-09-17). Carries `movementId`, same as `RECORD_LEGAL_FORM_RECEIVED` above, and
  // exercised explicitly per code in the dedicated block below — it needs a movement that has
  // genuinely BEEN marked received first, which the round-robin sweep's fixed ordering cannot
  // reliably guarantee.
  "CORRECT_LEGAL_FORM_RECEIPT",
  "SET_ARRIVAL_DETAILS",
  "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
  "UPLOAD_PATIENT_FORM",
  // Advisory notification checklist (9 Oct 2026). Arrival path carries `movementId`; discharge
  // path carries `admissionId`. Scoped like other subject-targeted events so the unscoped
  // coverage assertion does not demand it as a whole-state command.
  "RECORD_SUPPORT_NOTIFICATION",
]);

/**
 * Event types that CANNOT apply to a movement already carrying a given code, because the reducer
 * structurally refuses them — not because the traversal failed to reach them.
 *
 * This is an exclusion from the coverage assertion, so it is exactly the shape that could be
 * abused to hide a real gap. Only structural impossibility belongs here — never "the sweep did
 * not happen to get there".
 *
 * THE CHECK ON THIS LIST IS WEAKER THAN IT LOOKS, and the limit is stated here rather than
 * discovered later. The test below confirms the reducer refuses each entry against ONE fixture
 * movement carrying that code, in the seeded state. That catches an entry the reducer plainly
 * accepts, but it does NOT establish structural impossibility: an event refused for that
 * movement's STAGE rather than its form code passes the check too. Measured directly — adding a
 * bogus `1A: PULL_PATIENT` entry left the guard green at 7 passed, because WF-001 sits at
 * `placement_requested` and PULL_PATIENT requires `accepted_awaiting_bed`.
 *
 * So the single entry below is justified by READING the reducer, not by this check:
 * `RECORD_EXAMINATION` opens with `if (movement.legalForm?.code !== "1A") return reject(...)`,
 * which is a guard on the code itself. Any future entry needs the same treatment — quote the
 * code-keyed guard that makes it impossible — and must not lean on the check alone.
 */
export const STRUCTURALLY_IMPOSSIBLE_FOR_CODE: Record<string, { type: WardFlowEvent["type"]; reason: string }[]> = {
  // Receipt is supported for the current receivable form set; typed expiry is supported for all
  // selectable forms. These three codes have no receipt writer, hence no receipt to correct.
  "3B": [
    { type: "RECORD_LEGAL_FORM_RECEIVED", reason: "not a supported receivable form" },
    { type: "CORRECT_LEGAL_FORM_RECEIPT", reason: "no receipt writer for this code" },
  ],
  "4A": [
    { type: "RECORD_LEGAL_FORM_RECEIVED", reason: "not a supported receivable form" },
    { type: "CORRECT_LEGAL_FORM_RECEIPT", reason: "no receipt writer for this code" },
  ],
  "4C": [
    { type: "RECORD_LEGAL_FORM_RECEIVED", reason: "not a supported receivable form" },
    { type: "CORRECT_LEGAL_FORM_RECEIPT", reason: "no receipt writer for this code" },
  ],
};

/** The movement an event acts on, or `undefined` for the unit- and scenario-scoped events. */
export function targetMovementId(event: WardFlowEvent): string | undefined {
  return "movementId" in event ? event.movementId : undefined;
}

/**
 * RA1 (item 18, 2026-09-17). `WITHDRAW_WARD_REQUEST` has the SAME round-robin gap RELEASE_PULL
 * has, and for the same reason: its precondition (a movement of THIS code holding a LIVE
 * `referredUnitIds` member) is a narrow, easily-consumed window — `ACCEPT_IN_PRINCIPLE` clears the
 * whole list the moment it succeeds and `DECLINE` shrinks it by one, and both sit earlier than this
 * event in `ALL_EVENT_TYPES`'s fixed cyclic order, so by the time this event's turn comes round in
 * any single pass nothing is reliably still live to withdraw. The first half of
 * `buildHeldMovementFor` below — raise, then refer — is exactly the precondition needed, so this
 * stops there rather than duplicating it.
 */
export function buildReferredMovementFor(
  code: string,
  now: number,
): { state: WardFlowState; movementId: string; unitId: string } {
  const seeded = seedWardFlowState();
  const ed = allEmergencyDepartments()[0];
  const raised = wardFlowReducer(seeded, {
    type: "RAISE_REFERRAL",
    role: EVENT_ROLE.RAISE_REFERRAL[0],
    now,
    edId: ed.id,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
      specialling: false,
      highAcuity: false,
      legalStatus: "Referred for psychiatric examination",
      urgency: 2,
      legalFormCode: code,
    },
  });
  expect(raised.rejections, `RAISE_REFERRAL for Form ${code} was refused: ${raised.rejections.at(-1)?.reason}`).toEqual(
    [],
  );
  const movement = raised.movements.at(-1)!;
  const unit = raised.units.find((candidate) => candidate.allocatable.value > 0);
  expect(unit, `no unit with allocatable capacity was found for Form ${code}`).toBeDefined();

  const referred = wardFlowReducer(raised, {
    type: "REFER_TO_UNITS",
    role: EVENT_ROLE.REFER_TO_UNITS[0],
    now,
    movementId: movement.id,
    unitIds: [unit!.id],
  });
  expect(
    referred.rejections,
    `REFER_TO_UNITS for Form ${code} was refused: ${referred.rejections.at(-1)?.reason}`,
  ).toEqual([]);

  return { state: referred, movementId: movement.id, unitId: unit!.id };
}

/**
 * Fix round 1 (2026-08-25). `RELEASE_PULL` only ever succeeds at stage `pulled`, and once the
 * round-robin sweep above lets `HANDOVER_READY` (or a transport-progression event) fire first, a
 * movement is past `pulled` for good — the only way back is `RELEASE_PULL` itself, the very
 * event under test. That is a limitation of the SWEEP's fixed cyclic ordering, not of the domain:
 * a movement of any legal-form code can genuinely sit at `pulled` with a live transport job, the
 * same as a Form 1A can (see `WF-016`/`WF-005`, the pre-seeded fixture movements that let 1A pass
 * without needing this helper at all). Excusing the gap via `STRUCTURALLY_IMPOSSIBLE_FOR_CODE`
 * would therefore be a FALSE claim about the domain — exactly what that list's own doc comment
 * forbids ("never 'the sweep did not happen to get there'"). So this builds the precondition
 * explicitly instead, the same way `RESET_SCENARIO`/`SET_SCENARIO` are exercised on their own
 * below, and every step asserts it was NOT refused — a genuinely impossible step fails loudly with
 * the reducer's own reason quoted, rather than the construction silently stopping early and
 * reporting nothing.
 */
export function buildHeldMovementFor(code: string, now: number): { state: WardFlowState; movementId: string } {
  const seeded = seedWardFlowState();
  const ed = allEmergencyDepartments()[0];
  const raised = wardFlowReducer(seeded, {
    type: "RAISE_REFERRAL",
    role: EVENT_ROLE.RAISE_REFERRAL[0],
    now,
    edId: ed.id,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
      specialling: false,
      highAcuity: false,
      legalStatus: "Referred for psychiatric examination",
      urgency: 2,
      legalFormCode: code,
    },
  });
  expect(raised.rejections, `RAISE_REFERRAL for Form ${code} was refused: ${raised.rejections.at(-1)?.reason}`).toEqual(
    [],
  );
  const movement = raised.movements.at(-1)!;

  // Neither REFER_TO_UNITS, ACCEPT_IN_PRINCIPLE nor PULL_PATIENT gate on cohort, security or sex —
  // that eligibility scoring lives in the protected `ward-eligibility.ts`, a UI-facing concern the
  // reducer itself never consults — so any unit with spare allocatable capacity is a genuine,
  // reachable destination for this construction, not a fabricated shortcut.
  const unit = raised.units.find((candidate) => candidate.allocatable.value > 0);
  expect(unit, `no unit with allocatable capacity was found to hold a bed for Form ${code}`).toBeDefined();

  const referred = wardFlowReducer(raised, {
    type: "REFER_TO_UNITS",
    role: EVENT_ROLE.REFER_TO_UNITS[0],
    now,
    movementId: movement.id,
    unitIds: [unit!.id],
  });
  expect(
    referred.rejections,
    `REFER_TO_UNITS for Form ${code} was refused: ${referred.rejections.at(-1)?.reason}`,
  ).toEqual([]);

  const acceptedInPrinciple = wardFlowReducer(referred, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: EVENT_ROLE.ACCEPT_IN_PRINCIPLE[0],
    now,
    movementId: movement.id,
    unitId: unit!.id,
  });
  expect(
    acceptedInPrinciple.rejections,
    `ACCEPT_IN_PRINCIPLE for Form ${code} was refused: ${acceptedInPrinciple.rejections.at(-1)?.reason}`,
  ).toEqual([]);

  const held = wardFlowReducer(acceptedInPrinciple, {
    type: "PULL_PATIENT",
    role: EVENT_ROLE.PULL_PATIENT[0],
    now,
    movementId: movement.id,
    unitId: unit!.id,
  });
  expect(held.rejections, `PULL_PATIENT for Form ${code} was refused: ${held.rejections.at(-1)?.reason}`).toEqual([]);

  return { state: held, movementId: movement.id };
}

/**
 * Applies the first candidate of this type that the reducer ACCEPTS, optionally restricted to
 * candidates acting on a movement whose legal form carries `code`.
 *
 * Acceptance is measured by `state.rejections` not growing — the reducer records every refusal
 * there, so this cannot mistake a silently-refused event for an applied one.
 *
 * The `code` restriction is the whole point of fix wave 3. Without it this took whichever
 * movement the reducer happened to accept first — a fixture Form 3B — so a branch keyed on
 * `movement.legalForm?.code === "1A"` was never entered, and a seven-day fabrication written
 * there passed the entire suite.
 */
export function applyFirstAccepted(
  type: WardFlowEvent["type"],
  state: WardFlowState,
  now: number,
  code?: string,
  supplyDueAt = true,
): { applied: WardFlowState; event: WardFlowEvent } | undefined {
  // Match the same first movement as Array.find, once per action rather than rescanning the
  // growing state for every Cartesian candidate. Candidate order and coverage stay identical.
  const targetCodes = new Map<string, string | undefined>();
  if (code !== undefined && MOVEMENT_TARGETED_EVENTS.has(type)) {
    for (const movement of state.movements) {
      if (!targetCodes.has(movement.id)) targetCodes.set(movement.id, movement.legalForm?.code);
    }
  }
  for (const event of candidateEvents(type, state, now, supplyDueAt)) {
    if (code !== undefined && MOVEMENT_TARGETED_EVENTS.has(type)) {
      const movementId = targetMovementId(event);
      if (movementId === undefined || targetCodes.get(movementId) !== code) continue;
    }
    // RAISE_REFERRAL is not movement-targeted, but since 2026-08-24 it is the ONLY reducer path
    // that authors a form, so the sweep for a code has to raise referrals carrying that code.
    // Without this the sweep would only ever create movements of whichever code sorts first,
    // and — worse — could never hold a FRESH, un-examined movement of the other code to drive
    // RECORD_EXAMINATION against, since every fixture 3B already carries an examination.
    if (code !== undefined && event.type === "RAISE_REFERRAL" && event.draft.legalFormCode !== code) continue;
    const next = wardFlowReducer(state, event);
    if (next.rejections.length === state.rejections.length) return { applied: next, event };
  }
  return undefined;
}

/**
 * Drives the reducer repeatedly against movements carrying `code`. Sweeping rather than following
 * a hand-written script means the clinical pathway's ordering (PULL_PATIENT must precede
 * HANDOVER_READY, which must precede TRANSPORT_ACCEPTED) is discovered rather than assumed, so a
 * reordering of the pathway cannot silently drop a branch from coverage.
 *
 * Each round ROTATES the order the event types are tried in. A fixed order is itself an
 * assumption, and a wrong one: with the role table's natural order, ACCEPT_IN_PRINCIPLE always
 * ran before DECLINE and consumed the only live referral, so DECLINE was never once accepted
 * against a Form 1A — the coverage assertion below caught that while this fix was being written.
 * Rotating over at least as many rounds as there are event types tries every relative ordering.
 *
 * `supplyDueAt` (T2r fix round, finding 3, 2026-09-17): threaded straight to `applyFirstAccepted`
 * and, through it, to `candidateEvents` — see that function's own doc comment for what `false`
 * proves and why it was missing.
 */
export function driveEveryEventAgainst(
  code: string,
  supplyDueAt = true,
  rounds = ALL_EVENT_TYPES.length + 2,
): {
  accepted: Set<WardFlowEvent["type"]>;
  offenders: string[];
  finalState: WardFlowState;
} {
  let state = seedWardFlowState();
  const accepted = new Set<WardFlowEvent["type"]>();
  const offenders: string[] = [];

  for (let round = 0; round < rounds; round += 1) {
    const now = NOW_ANCHOR + round;
    const pivot = round % ALL_EVENT_TYPES.length;
    const order = [...ALL_EVENT_TYPES.slice(pivot), ...ALL_EVENT_TYPES.slice(0, pivot)];
    for (const type of order) {
      // RESET_SCENARIO and SET_SCENARIO would both discard the movement the sweep is building —
      // seedWardFlowState() replaces `state.movements` wholesale either way. Both are exercised on
      // their own below, where the invariant is checked against the resulting state directly.
      if (type === "RESET_SCENARIO" || type === "SET_SCENARIO") continue;
      // Task 5 (ward-flow movement step-track plan, 2026-09-04). STEP_BACK_STAGE's candidate
      // generator (above) crosses every movement id with every `MOVEMENT_STAGES` target, and
      // `applyFirstAccepted` takes the FIRST the reducer accepts — which, for a movement anywhere
      // past `placement_requested`, is a candidate targeting `placement_requested` itself
      // (`MOVEMENT_STAGES[0]`, tried first). Left in this round-robin, it resets whichever
      // code-matching movement it finds all the way back almost every round it is due, starving
      // the very forward-progression events this sweep exists to reach (TRANSPORT_ACCEPTED and
      // later, for a Form 3B, measured directly while writing this fix) — the SAME "the round-robin
      // sweep can never reliably produce this precondition" limitation `RELEASE_PULL`,
      // `CANCEL_TRANSPORT` and `HANDOVER_READY` already have (see `buildHeldMovementFor`'s own
      // doc comment), only far more disruptive: those three each require one narrow, late-stage
      // precondition; this one matches almost any movement at almost any stage. Not in
      // `MOVEMENT_TARGETED_EVENTS`, so nothing requires it to be counted here — and this file's
      // own guarantee (neither of Task 5's two events ever touches `movement.legalForm`, see the
      // reducer's own cases) does not depend on exercising it inside THIS traversal to hold.
      if (type === "STEP_BACK_STAGE") continue;
      const result = applyFirstAccepted(type, state, now, code, supplyDueAt);
      if (!result) continue;
      accepted.add(type);
      state = result.applied;
      offenders.push(...offendingFormsIn(state, `${code} / ${type} / supplyDueAt=${supplyDueAt}`));
    }
  }

  return { accepted, offenders, finalState: state };
}

/**
 * Every form in a state carrying an offence, in either of two independent senses. Since T2
 * (2026-09-17) the first rule is the PROVENANCE of the VALUE, never the form's code: any code may
 * legitimately carry a clinician-typed `dueAt`, so a real one is no longer an offence by itself.
 *
 *   1. UNKNOWN PROVENANCE — the `dueAt` is neither a sentinel this file supplied
 *      (`KNOWN_DUE_AT_VALUES`, filled by `suppliedDueAt`) nor THIS MOVEMENT'S OWN authored fixture
 *      value (`AUTHORED_FIXTURE_DUE_AT[movement.id]` — finding 5, 2026-09-17: keyed by id, not by
 *      "any fixture value anywhere", so a value borrowed from a DIFFERENT movement's authored
 *      figure does not pass). The signature of a reducer computing a value on its own rather than
 *      copying what a caller supplied.
 *   2. HISTORY MISMATCH — `legalFormExpiryHistory` exists and is non-empty, but its last entry's
 *      `dueAt` disagrees with `legalForm.dueAt` (T2r fix round, finding 2, 2026-09-17). The
 *      signature of a writer that set one without the other — the exact gap `RAISE_REFERRAL`'s own
 *      capture had until this fix.
 *
 * The two checks are independent: a movement can fail either, both, or neither, and each is
 * reported separately so a failure names which invariant broke.
 */
export function offendingFormsIn(state: WardFlowState, label: string): string[] {
  const offenders: string[] = [];
  for (const movement of state.movements) {
    const legalForm = movement.legalForm;
    if (legalForm === undefined || legalForm.dueAt === undefined) continue;
    const dueAt = legalForm.dueAt;

    const authored = AUTHORED_FIXTURE_DUE_AT[movement.id];
    const isKnown = (authored !== undefined && dueAt === authored) || KNOWN_DUE_AT_VALUES.has(dueAt);
    if (!isKnown) {
      offenders.push(`${label}: ${movement.id} (Form ${legalForm.code}, dueAt ${dueAt}, UNKNOWN PROVENANCE)`);
    }

    const history = movement.legalFormExpiryHistory;
    if (history !== undefined && history.length > 0 && history[history.length - 1]!.dueAt !== dueAt) {
      offenders.push(
        `${label}: ${movement.id} (Form ${legalForm.code}, dueAt ${dueAt} != last history entry ` +
          `${history[history.length - 1]!.dueAt}, HISTORY MISMATCH)`,
      );
    }
  }
  return offenders;
}

/**
 * How many test files the dueAt sweep is split across. The sweep makes about eight million reducer
 * calls per pass; in one file it ran over five minutes and timed out under load. Split by code, the
 * same work runs in parallel workers. Each shard takes every DUE_AT_SWEEP_SHARD_COUNT-th code, so
 * every code lands in exactly one shard and a code added later is swept without being remembered.
 */
export const DUE_AT_SWEEP_SHARD_COUNT = 4;

export function dueAtSweepCodes(shard: number): readonly string[] {
  return SWEEP_CODES.filter((_, index) => index % DUE_AT_SWEEP_SHARD_COUNT === shard);
}

/**
 * Fix wave 3, finding 1 — the traversal, now driven PER FORM CODE.
 *
 * Wave 2's version applied whichever candidate the reducer accepted first. That was a fixture
 * Form 3B, so a branch keyed on the other code was never entered, and this variant of the
 * TRANSPORT_ACCEPTED bypass passed the whole suite at 227:
 *
 *     legalForm: movement.legalForm?.code === "1A"
 *       ? { ...movement.legalForm, dueAt: event.now + 10080 }
 *       : movement.legalForm,
 *
 * It is genuinely reachable — raise referral, refer, accept in principle, hold bed, handover
 * ready, transport accepted puts a seven-day `dueAt` on a real Form 1A. So every event type is
 * now driven against a movement carrying EACH code, and acceptance is asserted per code so the
 * traversal cannot pass by quietly failing to reach one of them.
 *
 * 🔴 **CORRECTED 2026-09-17, T2 — THIS CASE'S TITLE USED TO SAY "puts no dueAt on a form of any
 * code".** That claim is now false BY DESIGN: `RAISE_REFERRAL`'s own candidates in this sweep
 * (above) supply a `legalFormDueAt` on every code, and a real 1A/3B/3D carrying one is now the
 * intended outcome of owner answer 1. What this case still proves, and what its title now says,
 * is narrower and just as load-bearing: every `dueAt` the sweep produces, on any code, through
 * any event, traces to a value this file itself supplied — never one the reducer invented.
 */
export function runDueAtSweep(supplyDueAt: boolean, codes: readonly string[]): void {
  // Non-vacuity 1: the union is non-trivial and drawn from the role table, not hand-listed.
  expect(ALL_EVENT_TYPES.length, "the event union looks empty").toBeGreaterThan(10);

  /*
   * 🔴 T2r FIX ROUND, FINDING 3 (2026-09-17) — THE WHOLE BODY BELOW NOW RUNS TWICE, ONCE PER
   * VALUE OF `supplyDueAt`.
   *
   * Measured, not theorised: with every RAISE_REFERRAL candidate always supplying a sentinel
   * `legalFormDueAt`, a freshly-raised movement never reached a LATER event with
   * `legalForm.dueAt === undefined` — so a mutation that fabricates a value only in that absent
   * case (e.g. a "fill in the deadline if the clinician hasn't typed one yet" branch) had no
   * precondition to fire against and passed the whole sweep unnoticed. `supplyDueAt: false`
   * closes that: `RAISE_REFERRAL` and `RECORD_LEGAL_FORM_EXPIRY` supply no sentinel at all in
   * this pass (see their own `candidateEvents` cases), so a freshly raised movement of any code
   * genuinely carries no `dueAt` until something legitimately writes one — restoring the
   * precondition a fill-in mutation needs to be given a chance to fire.
   *
   * `supplyDueAt: true` is kept as the second pass, unchanged from before this fix, because it
   * is what proves capture ITSELF works (a typed value really does survive) — `false` alone
   * would prove only that nothing fabricates a value, never that a real one is honoured.
   */
  expect(codes.length, `this sweep shard drives no code`).toBeGreaterThan(0);

  const offenders: string[] = [];
  const coverage = new Map<string, Set<WardFlowEvent["type"]>>();

  for (const code of codes) {
    const { accepted, offenders: found, finalState } = driveEveryEventAgainst(code, supplyDueAt);
    coverage.set(code, accepted);
    offenders.push(...found);

    // Non-vacuity 2: the sweep really held a movement of this code to act on. Without this, a
    // code that vanished from the model would make its whole pass silently vacuous.
    const carrying = finalState.movements.filter((movement) => movement.legalForm?.code === code);
    expect(carrying.length, `the sweep never held a Form ${code}`).toBeGreaterThan(0);
  }

  // RELEASE_PULL / CANCEL_TRANSPORT, exercised explicitly per code (fix round 1, 2026-08-25) —
  // see `buildHeldMovementFor`'s own doc comment for why the round-robin sweep above can never
  // reach these two for a code without a pre-seeded fixture movement, and why that is a
  // traversal limitation rather than grounds for a `STRUCTURALLY_IMPOSSIBLE_FOR_CODE` entry.
  // Mutates the SAME `Set` instances already stored in `coverage` above, so this genuinely
  // satisfies the "Non-vacuity 3" check below rather than sidestepping it.
  for (const code of codes) {
    const accepted = coverage.get(code)!;

    // RECORD_SUPPORT_NOTIFICATION needs an involuntary completed arrival (or discharge). The
    // round-robin often mutates those seed subjects before this event's turn, so exercise it
    // against a fresh seed — same "traversal gap, not structural impossibility" shape as
    // RELEASE_PULL. Does not invent a legal figure; only records an advisory notification.
    const supportSeed = seedWardFlowState();
    const supportArrival = supportSeed.movements.find(
      (movement) =>
        (movement.legalStatus === "Involuntary inpatient" ||
          movement.legalStatus === "Detained awaiting examination") &&
        (movement.closure?.outcome === "arrived" || movement.stage === "arrived"),
    );
    expect(
      supportArrival,
      `no involuntary arrived movement in the seed for RECORD_SUPPORT_NOTIFICATION (${code})`,
    ).toBeDefined();
    const supportRecorded = wardFlowReducer(supportSeed, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: EVENT_ROLE.RECORD_SUPPORT_NOTIFICATION[0],
      now: NOW_ANCHOR,
      occasion: supportArrival!.sourceAdmissionId !== undefined ? "transfer" : "admission",
      movementId: supportArrival!.id,
      party: "carer",
      outcome: "told",
      who: "Synthetic carer",
      contactedAt: NOW_ANCHOR,
    });
    expect(
      supportRecorded.rejections,
      `RECORD_SUPPORT_NOTIFICATION for Form ${code} was refused: ${supportRecorded.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RECORD_SUPPORT_NOTIFICATION");
    offenders.push(...offendingFormsIn(supportRecorded, `RECORD_SUPPORT_NOTIFICATION(${code})`));

    // D-34 needs an accepted pre-collection ED referral. Build that real producer chain for
    // every legal code instead of treating a round-robin traversal gap as an exclusion.
    const forDeterioration = buildHeldMovementFor(code, NOW_ANCHOR);
    if (supplyDueAt) {
      forDeterioration.state = wardFlowReducer(forDeterioration.state, {
        type: "RECORD_LEGAL_FORM_EXPIRY",
        role: "ed",
        now: NOW_ANCHOR,
        movementId: forDeterioration.movementId,
        dueAt: suppliedDueAt(NOW_ANCHOR + 900_000),
      });
      expect(forDeterioration.state.rejections).toEqual([]);
    }
    const beforeDeterioration = forDeterioration.state.movements.find(
      (movement) => movement.id === forDeterioration.movementId,
    )!;
    expect(beforeDeterioration.acceptedUnitId).toBeDefined();
    expect(beforeDeterioration.transport?.collectedAt).toBeUndefined();
    const deteriorated = wardFlowReducer(forDeterioration.state, {
      type: "RECORD_ED_MEDICAL_DETERIORATION",
      role: "ed",
      now: NOW_ANCHOR,
      movementId: forDeterioration.movementId,
      actingPlaceId: beforeDeterioration.originEdId,
    });
    expect(deteriorated.rejections, `D-34 for Form ${code} was refused`).toEqual([]);
    const paused = deteriorated.movements.find((movement) => movement.id === forDeterioration.movementId)!;
    expect(paused.medicalDeterioration?.at).toBe(NOW_ANCHOR);
    expect(paused.acceptedUnitId).toBeUndefined();
    expect(paused.legalForm).toEqual(beforeDeterioration.legalForm);
    accepted.add("RECORD_ED_MEDICAL_DETERIORATION");
    offenders.push(...offendingFormsIn(deteriorated, `RECORD_ED_MEDICAL_DETERIORATION(${code})`));

    const forRelease = buildHeldMovementFor(code, NOW_ANCHOR);
    const released = wardFlowReducer(forRelease.state, {
      type: "RELEASE_PULL",
      role: EVENT_ROLE.RELEASE_PULL[0],
      now: NOW_ANCHOR,
      movementId: forRelease.movementId,
      reason: "pull_made_in_error",
    });
    expect(
      released.rejections,
      `RELEASE_PULL for Form ${code} was refused: ${released.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RELEASE_PULL");
    offenders.push(...offendingFormsIn(released, `RELEASE_PULL(${code})`));

    const forWithdrawAcceptance = wardFlowReducer(released, {
      type: "WITHDRAW_ACCEPTANCE",
      role: EVENT_ROLE.WITHDRAW_ACCEPTANCE[0],
      now: NOW_ANCHOR,
      movementId: forRelease.movementId,
      reason: STEP_BACK_REASONS[0],
    });
    expect(
      forWithdrawAcceptance.rejections,
      `WITHDRAW_ACCEPTANCE for Form ${code} was refused: ${forWithdrawAcceptance.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("WITHDRAW_ACCEPTANCE");
    offenders.push(...offendingFormsIn(forWithdrawAcceptance, `WITHDRAW_ACCEPTANCE(${code})`));

    // RA1 (item 18, 2026-09-17) — exercised explicitly per code, same reason as RELEASE_PULL
    // above: see `buildReferredMovementFor`'s own doc comment.
    const forWithdrawWardRequest = buildReferredMovementFor(code, NOW_ANCHOR);
    const wardRequestWithdrawn = wardFlowReducer(forWithdrawWardRequest.state, {
      type: "WITHDRAW_WARD_REQUEST",
      role: EVENT_ROLE.WITHDRAW_WARD_REQUEST[0],
      now: NOW_ANCHOR,
      movementId: forWithdrawWardRequest.movementId,
      unitId: forWithdrawWardRequest.unitId,
      reason: WARD_REQUEST_WITHDRAWAL_REASONS[0],
    });
    expect(
      wardRequestWithdrawn.rejections,
      `WITHDRAW_WARD_REQUEST for Form ${code} was refused: ${wardRequestWithdrawn.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("WITHDRAW_WARD_REQUEST");
    offenders.push(...offendingFormsIn(wardRequestWithdrawn, `WITHDRAW_WARD_REQUEST(${code})`));

    const forFormReceived = buildHeldMovementFor(code, NOW_ANCHOR);
    if (supplyDueAt) {
      forFormReceived.state = wardFlowReducer(forFormReceived.state, {
        type: "RECORD_LEGAL_FORM_EXPIRY",
        role: EVENT_ROLE.RECORD_LEGAL_FORM_EXPIRY[0],
        now: NOW_ANCHOR,
        movementId: forFormReceived.movementId,
        dueAt: suppliedDueAt(NOW_ANCHOR + 900_000),
      });
      expect(forFormReceived.state.rejections).toEqual([]);
    }
    const formReceived = wardFlowReducer(forFormReceived.state, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: EVENT_ROLE.RECORD_LEGAL_FORM_RECEIVED[0],
      now: NOW_ANCHOR,
      movementId: forFormReceived.movementId,
    });
    // Owner's current receipt rule, reconciled 23 September: receipt preserves paper facts
    // for supported forms, including 3A. It never creates or replaces an expiry.
    const receivable = ["1A", "3A", "3D", "5A", "6A"].includes(code);
    if (receivable) {
      expect(formReceived.rejections).toEqual([]);
      const before = forFormReceived.state.movements.find((m) => m.id === forFormReceived.movementId)!;
      const after = formReceived.movements.find((m) => m.id === forFormReceived.movementId)!;
      expect(after.legalForm).toEqual(before.legalForm);
      expect(after.legalFormExpiryHistory).toEqual(before.legalFormExpiryHistory);
      expect(after.legalFormReceivedAt).toBe(NOW_ANCHOR);
      accepted.add("RECORD_LEGAL_FORM_RECEIVED");
    } else {
      expect(formReceived.rejections.length).toBeGreaterThan(forFormReceived.state.rejections.length);
      expect(formReceived.rejections.at(-1)?.reason).toContain("does not carry a receivable legal form");
    }
    offenders.push(...offendingFormsIn(formReceived, `RECORD_LEGAL_FORM_RECEIVED(${code})`));

    // Every supported receipt can be corrected without changing entered expiry or history.
    if (receivable) {
      const receiptCorrected = wardFlowReducer(formReceived, {
        type: "CORRECT_LEGAL_FORM_RECEIPT",
        role: EVENT_ROLE.CORRECT_LEGAL_FORM_RECEIPT[0],
        now: NOW_ANCHOR,
        movementId: forFormReceived.movementId,
        reason: LEGAL_FORM_RECEIPT_CORRECTION_REASONS[0],
      });
      expect(
        receiptCorrected.rejections,
        `CORRECT_LEGAL_FORM_RECEIPT for Form ${code} was refused: ${receiptCorrected.rejections.at(-1)?.reason}`,
      ).toEqual([]);
      accepted.add("CORRECT_LEGAL_FORM_RECEIPT");
      offenders.push(...offendingFormsIn(receiptCorrected, `CORRECT_LEGAL_FORM_RECEIPT(${code})`));
    }

    // T2 (2026-09-17). Unlike `RECORD_LEGAL_FORM_RECEIVED` immediately above, this event is
    // accepted for EVERY code — owner answer 1 lifted the "only 4A/4C" restriction entirely, so
    // there is no per-code exclusion to branch on here.
    const forExpiry = buildHeldMovementFor(code, NOW_ANCHOR);
    const expiryRecorded = wardFlowReducer(forExpiry.state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: EVENT_ROLE.RECORD_LEGAL_FORM_EXPIRY[0],
      now: NOW_ANCHOR,
      movementId: forExpiry.movementId,
      dueAt: suppliedDueAt(NOW_ANCHOR + 900_000),
    });
    expect(
      expiryRecorded.rejections,
      `RECORD_LEGAL_FORM_EXPIRY for Form ${code} was refused: ${expiryRecorded.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RECORD_LEGAL_FORM_EXPIRY");
    offenders.push(...offendingFormsIn(expiryRecorded, `RECORD_LEGAL_FORM_EXPIRY(${code})`));

    // F1 fix (coordinator, 2026-09-17): a movement from `buildHeldMovementFor` has never been
    // examined. A sibling helper is adding a reducer refusal — no community referral before the
    // examination outcome — so REFER_TO_COMMUNITY_TEAM must be driven from an EXAMINED movement
    // here, or it (and the RECORD_LEFT_DEPARTMENT assertion right below, which is built on its
    // result) will start failing the moment that refusal lands. `"inpatient_order"` is chosen,
    // matching this file's own precedent above (`RECORD_EXAMINATION` before `RAISE_REFERRAL`
    // never runs here): unlike `"community_order"`/`"revoked"` at a `pulled` stage it does not
    // itself close the movement (`ward-flow-reducer.ts`'s own `RECORD_EXAMINATION` case), which
    // would otherwise make the very next `REFER_TO_COMMUNITY_TEAM` refuse on "cannot refer a
    // closed movement" before the rule this block exists to satisfy is even reached.
    const forCommunity = buildHeldMovementFor(code, NOW_ANCHOR);
    const examinedForCommunity = wardFlowReducer(forCommunity.state, {
      type: "RECORD_EXAMINATION",
      role: EVENT_ROLE.RECORD_EXAMINATION[0],
      now: NOW_ANCHOR,
      movementId: forCommunity.movementId,
      outcome: "inpatient_order",
    });
    expect(
      examinedForCommunity.rejections,
      `RECORD_EXAMINATION (ahead of REFER_TO_COMMUNITY_TEAM) for Form ${code} was refused: ${examinedForCommunity.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RECORD_EXAMINATION");
    offenders.push(...offendingFormsIn(examinedForCommunity, `RECORD_EXAMINATION(pre-community)(${code})`));

    const communityReferred = wardFlowReducer(examinedForCommunity, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: EVENT_ROLE.REFER_TO_COMMUNITY_TEAM[0],
      now: NOW_ANCHOR,
      movementId: forCommunity.movementId,
      team: "Armadale",
    });
    expect(
      communityReferred.rejections,
      `REFER_TO_COMMUNITY_TEAM for Form ${code} was refused: ${communityReferred.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("REFER_TO_COMMUNITY_TEAM");
    offenders.push(...offendingFormsIn(communityReferred, `REFER_TO_COMMUNITY_TEAM(${code})`));

    // RECORD_LEFT_DEPARTMENT requires `movement.edOutcome`, which only `REFER_TO_COMMUNITY_TEAM`
    // above ever writes — chained here explicitly, the same discipline `RECORD_LEGAL_FORM_EXPIRY`
    // and every other event in this per-code block already holds to, rather than leaving this
    // event's coverage to the round-robin sweep's rotation, which the T4 pass measured as
    // order-sensitive: adding `CORRECT_LEGAL_FORM_RECEIPT` to the event union shifted
    // `ALL_EVENT_TYPES.length` and, with it, which movement the round-robin's fixed pivot
    // happened to reach this event against for Form 1A.
    const departed = wardFlowReducer(communityReferred, {
      type: "RECORD_LEFT_DEPARTMENT",
      role: EVENT_ROLE.RECORD_LEFT_DEPARTMENT[0],
      now: NOW_ANCHOR,
      movementId: forCommunity.movementId,
    });
    expect(
      departed.rejections,
      `RECORD_LEFT_DEPARTMENT for Form ${code} was refused: ${departed.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RECORD_LEFT_DEPARTMENT");
    offenders.push(...offendingFormsIn(departed, `RECORD_LEFT_DEPARTMENT(${code})`));

    // STEP_BACK_STAGE, exercised explicitly per code for the same reason RELEASE_PULL is right
    // above — see the round-robin's own `continue` for STEP_BACK_STAGE and its comment for why
    // that sweep can never reach it usefully. `buildHeldMovementFor` gives a movement at
    // `pulled`, so stepping back to `destination_review` is a genuine backward transition,
    // proving what this whole file exists to prove: this event, too, never touches
    // `movement.legalForm`.
    const forStepBack = buildHeldMovementFor(code, NOW_ANCHOR);
    const steppedBack = wardFlowReducer(forStepBack.state, {
      type: "STEP_BACK_STAGE",
      role: EVENT_ROLE.STEP_BACK_STAGE[0],
      now: NOW_ANCHOR,
      movementId: forStepBack.movementId,
      to: "destination_review",
      reason: STEP_BACK_REASONS[0],
    });
    expect(
      steppedBack.rejections,
      `STEP_BACK_STAGE for Form ${code} was refused: ${steppedBack.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("STEP_BACK_STAGE");
    offenders.push(...offendingFormsIn(steppedBack, `STEP_BACK_STAGE(${code})`));

    const forCancel = buildHeldMovementFor(code, NOW_ANCHOR);
    // Booking is its own step since 2026-08-31: HANDOVER_READY no longer fabricates a transport
    // job, nor answers the escort question by deriving it from legal status. This file is touched
    // as little as possible, and the edit is forced by the event sequence rather than chosen — no
    // figure, timeframe or threshold is involved.
    const booked = wardFlowReducer(forCancel.state, {
      type: "BOOK_TRANSPORT",
      role: EVENT_ROLE.BOOK_TRANSPORT[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: true,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(
      booked.rejections,
      `BOOK_TRANSPORT for Form ${code} was refused: ${booked.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const readyForHandover = wardFlowReducer(booked, {
      type: "HANDOVER_READY",
      role: EVENT_ROLE.HANDOVER_READY[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
    });
    expect(
      readyForHandover.rejections,
      `HANDOVER_READY for Form ${code} was refused: ${readyForHandover.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    // HANDOVER_READY joined RELEASE_PULL and CANCEL_TRANSPORT in this block on 2026-08-31, when it
    // stopped fabricating a transport job and began REQUIRING one. It now needs a movement already
    // carrying a booking, which the round-robin sweep above cannot reliably produce — the same
    // traversal limitation those two have, not grounds for a STRUCTURALLY_IMPOSSIBLE entry, and
    // the reason it must be recorded here or "Non-vacuity 3" reports it as never accepted.
    accepted.add("HANDOVER_READY");
    accepted.add("BOOK_TRANSPORT");
    const cancelled = wardFlowReducer(readyForHandover, {
      type: "CANCEL_TRANSPORT",
      role: EVENT_ROLE.CANCEL_TRANSPORT[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
      reason: "provider_unavailable",
    });
    expect(
      cancelled.rejections,
      `CANCEL_TRANSPORT for Form ${code} was refused: ${cancelled.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("CANCEL_TRANSPORT");
    offenders.push(...offendingFormsIn(cancelled, `CANCEL_TRANSPORT(${code})`));

    // WLQ-38 (owner, 2026-09-15): STOP_TRANSPORT, exercised explicitly per code for the same
    // reason CANCEL_TRANSPORT immediately above needs forcing — it needs a movement whose
    // transport has been COLLECTED, which the round-robin sweep cannot reliably produce for every
    // code. Reuses `readyForHandover` (the same booked-and-ready movement CANCEL_TRANSPORT above
    // exercises — `cancelled` above is a SEPARATE branch off it and never mutates it) rather than
    // building a fourth movement, driving it the rest of the way through the transport chain.
    const stopAccepted = wardFlowReducer(readyForHandover, {
      type: "TRANSPORT_ACCEPTED",
      role: EVENT_ROLE.TRANSPORT_ACCEPTED[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
    });
    expect(
      stopAccepted.rejections,
      `TRANSPORT_ACCEPTED for Form ${code} was refused: ${stopAccepted.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("TRANSPORT_ACCEPTED");
    offenders.push(...offendingFormsIn(stopAccepted, `TRANSPORT_ACCEPTED(${code})`));

    const stopEnRoute = wardFlowReducer(stopAccepted, {
      type: "TRANSPORT_EN_ROUTE",
      role: EVENT_ROLE.TRANSPORT_EN_ROUTE[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
    });
    expect(
      stopEnRoute.rejections,
      `TRANSPORT_EN_ROUTE for Form ${code} was refused: ${stopEnRoute.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("TRANSPORT_EN_ROUTE");
    offenders.push(...offendingFormsIn(stopEnRoute, `TRANSPORT_EN_ROUTE(${code})`));

    const stopCollected = wardFlowReducer(stopEnRoute, {
      type: "PATIENT_COLLECTED",
      role: EVENT_ROLE.PATIENT_COLLECTED[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
    });
    expect(
      stopCollected.rejections,
      `PATIENT_COLLECTED for Form ${code} was refused: ${stopCollected.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("PATIENT_COLLECTED");
    offenders.push(...offendingFormsIn(stopCollected, `PATIENT_COLLECTED(${code})`));

    // Build plan item 29 (T4a): RECORD_DIVERSION + RELEASE_DIVERTED_BED, a SEPARATE branch off
    // `stopCollected` (the same shape CANCEL_TRANSPORT uses off `readyForHandover`) so it does
    // not close the movement STOP_TRANSPORT below still needs.
    const diverted = wardFlowReducer(stopCollected, {
      type: "RECORD_DIVERSION",
      role: EVENT_ROLE.RECORD_DIVERSION[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[0],
    });
    expect(
      diverted.rejections,
      `RECORD_DIVERSION for Form ${code} was refused: ${diverted.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RECORD_DIVERSION");
    offenders.push(...offendingFormsIn(diverted, `RECORD_DIVERSION(${code})`));

    const divertedReleased = wardFlowReducer(diverted, {
      type: "RELEASE_DIVERTED_BED",
      role: EVENT_ROLE.RELEASE_DIVERTED_BED[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
    });
    expect(
      divertedReleased.rejections,
      `RELEASE_DIVERTED_BED for Form ${code} was refused: ${divertedReleased.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RELEASE_DIVERTED_BED");
    offenders.push(...offendingFormsIn(divertedReleased, `RELEASE_DIVERTED_BED(${code})`));

    const stopped = wardFlowReducer(stopCollected, {
      type: "STOP_TRANSPORT",
      role: EVENT_ROLE.STOP_TRANSPORT[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
      reason: STOP_TRANSPORT_REASONS[0],
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(
      stopped.rejections,
      `STOP_TRANSPORT for Form ${code} was refused: ${stopped.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("STOP_TRANSPORT");
    offenders.push(...offendingFormsIn(stopped, `STOP_TRANSPORT(${code})`));

    // Owner answer 8 (second round, 2026-09-17): RELEASE_HELD_BED, forced right after
    // STOP_TRANSPORT immediately above — it needs the exact movement STOP_TRANSPORT just closed
    // with a bed still held, which nothing else in this sweep produces.
    const heldBedReleased = wardFlowReducer(stopped, {
      type: "RELEASE_HELD_BED",
      role: EVENT_ROLE.RELEASE_HELD_BED[0],
      now: NOW_ANCHOR,
      movementId: forCancel.movementId,
    });
    expect(
      heldBedReleased.rejections,
      `RELEASE_HELD_BED for Form ${code} was refused: ${heldBedReleased.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("RELEASE_HELD_BED");
    offenders.push(...offendingFormsIn(heldBedReleased, `RELEASE_HELD_BED(${code})`));

    /*
     * 🔴 PATIENT_ARRIVED, NOW ALSO FORCED EXPLICITLY — a regression STOP_TRANSPORT's own
     * addition above introduced, not a pre-existing gap. Before STOP_TRANSPORT existed, the
     * general round-robin sweep reliably drove SOME movement all the way to `PATIENT_ARRIVED`
     * for every code on its own. Once STOP_TRANSPORT became a candidate the round-robin can also
     * raise, it can now CLOSE a collected movement (`did_not_proceed`) instead of letting the
     * sweep carry it on to arrival — for whichever movement the round-robin happened to be using
     * to reach `PATIENT_ARRIVED` for a given code, so it silently starved that code's own
     * coverage (measured against Form 3B). A fourth, separate movement removes the dependency on
     * the round-robin's now-competing paths, the same fix RELEASE_PULL/STEP_BACK_STAGE/
     * HANDOVER_READY/BOOK_TRANSPORT/CANCEL_TRANSPORT/STOP_TRANSPORT above already needed for the
     * identical reason: a precondition the shared sweep cannot reliably reach for every code.
     */
    const forArrival = buildHeldMovementFor(code, NOW_ANCHOR);
    const arrivalBooked = wardFlowReducer(forArrival.state, {
      type: "BOOK_TRANSPORT",
      role: EVENT_ROLE.BOOK_TRANSPORT[0],
      now: NOW_ANCHOR,
      movementId: forArrival.movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: true,
      cadNumber: "CAD-STUB-0001",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(
      arrivalBooked.rejections,
      `BOOK_TRANSPORT (arrival chain) for Form ${code} was refused: ${arrivalBooked.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const arrivalReady = wardFlowReducer(arrivalBooked, {
      type: "HANDOVER_READY",
      role: EVENT_ROLE.HANDOVER_READY[0],
      now: NOW_ANCHOR,
      movementId: forArrival.movementId,
    });
    expect(
      arrivalReady.rejections,
      `HANDOVER_READY (arrival chain) for Form ${code} was refused: ${arrivalReady.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const arrivalAccepted = wardFlowReducer(arrivalReady, {
      type: "TRANSPORT_ACCEPTED",
      role: EVENT_ROLE.TRANSPORT_ACCEPTED[0],
      now: NOW_ANCHOR,
      movementId: forArrival.movementId,
    });
    expect(
      arrivalAccepted.rejections,
      `TRANSPORT_ACCEPTED (arrival chain) for Form ${code} was refused: ${arrivalAccepted.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const arrivalEnRoute = wardFlowReducer(arrivalAccepted, {
      type: "TRANSPORT_EN_ROUTE",
      role: EVENT_ROLE.TRANSPORT_EN_ROUTE[0],
      now: NOW_ANCHOR,
      movementId: forArrival.movementId,
    });
    expect(
      arrivalEnRoute.rejections,
      `TRANSPORT_EN_ROUTE (arrival chain) for Form ${code} was refused: ${arrivalEnRoute.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const arrivalCollected = wardFlowReducer(arrivalEnRoute, {
      type: "PATIENT_COLLECTED",
      role: EVENT_ROLE.PATIENT_COLLECTED[0],
      now: NOW_ANCHOR,
      movementId: forArrival.movementId,
    });
    expect(
      arrivalCollected.rejections,
      `PATIENT_COLLECTED (arrival chain) for Form ${code} was refused: ${arrivalCollected.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    const arrived = wardFlowReducer(arrivalCollected, {
      type: "PATIENT_ARRIVED",
      role: EVENT_ROLE.PATIENT_ARRIVED[0],
      now: NOW_ANCHOR,
      movementId: forArrival.movementId,
    });
    expect(
      arrived.rejections,
      `PATIENT_ARRIVED for Form ${code} was refused: ${arrived.rejections.at(-1)?.reason}`,
    ).toEqual([]);
    accepted.add("PATIENT_ARRIVED");
    offenders.push(...offendingFormsIn(arrived, `PATIENT_ARRIVED(${code})`));
  }

  // Non-vacuity 3: every movement-targeted event type was ACCEPTED against a movement carrying
  // each code. This is the assertion wave 2 lacked. Reported by name, never counted — and it is
  // what proves the `code === "1A"` branch above is actually entered rather than merely
  // believed to be reachable.
  for (const [code, accepted] of coverage) {
    const excluded = new Set((STRUCTURALLY_IMPOSSIBLE_FOR_CODE[code] ?? []).map((entry) => entry.type));
    const missing = [...MOVEMENT_TARGETED_EVENTS].filter((type) => !accepted.has(type) && !excluded.has(type));
    expect(missing, `never accepted against a Form ${code}`).toEqual([]);
  }

  // The exclusions above get a PARTIAL check, whose limit is documented at the declaration: for
  // each entry, confirm the reducer refuses the event against a fixture movement carrying that
  // code. This catches an entry the reducer plainly accepts. It does NOT prove structural
  // impossibility — an event refused for that movement's stage passes too — so the entry itself
  // must be justified by a code-keyed guard read out of the reducer.
  const seededForExclusions = seedWardFlowState();
  for (const [code, entries] of Object.entries(STRUCTURALLY_IMPOSSIBLE_FOR_CODE)) {
    for (const entry of entries) {
      const carrier = seededForExclusions.movements.find((movement) => movement.legalForm?.code === code);
      // `3D` ALONE carries no seeded fixture movement at all (see that entry's own comment on
      // the declaration above) — skip THIS supplementary check for 3D only, rather than failing
      // on an absent fixture the seed was never going to hold. The per-code block earlier in
      // this test already drives a freshly-raised `3D` movement through the same event and
      // asserts the refusal, so 3D's exclusion is not left unchecked — only this weaker,
      // seed-only check is.
      //
      // Every OTHER code in this list (`3B`, `4A`, `4C`) DOES have a seeded carrier today, and
      // the bare `if (!carrier) continue;` this replaced skipped the check silently for any of
      // them too — so a future seed change that quietly dropped, say, the seeded 3B movement
      // would have this whole check go on passing for the wrong reason (nothing left to assert
      // against) rather than failing. Asserted here instead, so that stays a red test.
      if (!["3D", "3A", "5A", "6A"].includes(code)) {
        expect(
          carrier,
          `Form ${code} has no seeded fixture movement to run this exclusion check against`,
        ).toBeDefined();
      }
      if (!carrier) continue;
      const refusedEvents = candidateEvents(entry.type, seededForExclusions, NOW_ANCHOR).filter(
        (event) => targetMovementId(event) === carrier!.id,
      );
      expect(refusedEvents.length, `no ${entry.type} candidate targets ${carrier!.id}`).toBeGreaterThan(0);
      for (const event of refusedEvents) {
        const next = wardFlowReducer(seededForExclusions, event);
        expect(
          next.rejections.length,
          `${entry.type} was NOT refused against Form ${code} — the exclusion is wrong: ${entry.reason}`,
        ).toBeGreaterThan(seededForExclusions.rejections.length);
      }
    }
  }

  // The non-movement-scoped events (RAISE_REFERRAL, CONFIRM_CAPACITY, ADVANCE_CLOCK) are not
  // code-targetable, but must still be exercised and must still leave the invariant intact.
  for (const [code, accepted] of coverage) {
    /*
     * 🔴 TWO EVENTS THIS SWEEP CANNOT ACCEPT, AND THE REASON IS A PRODUCT FINDING RATHER THAN A
     * TEST PROBLEM. Recorded 2026-09-06 with its expiry condition, in the idiom this file's
     * sibling `ward-event-reachability.test.ts` uses for the same class of gap.
     *
     * `COMPLETE_INBOX_ITEM` ticks an inbox row off; `REOPEN_INBOX_ITEM` un-ticks one. The reducer
     * refuses BOTH against any row whose `kind` is `"fact"` — that refusal is the safety property
     * the whole package exists for: a breached statutory form cannot be dismissed by anybody.
     *
     * ⚠️ AND EVERY CATEGORY `buildActionInbox` EMITS IS CURRENTLY A FACT. The action inbox is an
     * exception list end to end — unlawful destination, breached legal form, lapsed bed hold,
     * destinations declined, transport not departed. Each one leaves when the SITUATION changes,
     * never because somebody ticked it. So there is at present nothing these two events may
     * lawfully be applied to, and "never accepted" is the correct behaviour rather than a gap in
     * the sweep.
     *
     * ✅ RULED BY THE OWNER, 2026-09-06: THE PANEL IS ACKNOWLEDGE-ONLY. Both arguable categories
     * were put to him and he chose neither — a coordinator may record that they are dealing with
     * a row, and nothing on this panel can be marked done. So "never accepted" is now the settled
     * behaviour rather than a state awaiting a decision.
     *
     * 🔴 THE EXPIRY IS STILL NAMED, because this repository has been bitten by deferrals whose
     * trigger nothing watches: this exclusion ends the day a genuinely task-shaped category
     * exists — a human undertaking that leaves when a person says it is done. That would be new
     * work with its own ruling, NOT a reclassification of one of the five facts. When it lands,
     * delete these two names and this test goes green on its own terms rather than on an
     * exception.
     *
     * ⚠️ Deliberately NOT weakened to "at most N unaccepted": that would let a third event go
     * unexercised silently. Named events only, so a new one still fails here.
     */
    const NO_COMMITMENT_ROW_TO_ACT_ON = new Set(["COMPLETE_INBOX_ITEM", "REOPEN_INBOX_ITEM", "MARK_NOTICE_READ"]);
    // OA-1/OA-5 (17 September): country extensions need an entered paper expiry. This
    // old calculation-only event must refuse, preserving all business state, for every code.
    const countryBase = buildHeldMovementFor(code, NOW_ANCHOR).state;
    const countryTarget = countryBase.movements.find((m) => m.legalForm?.code === code)!;
    const country = wardFlowReducer(countryBase, {
      type: "RECORD_COUNTRY_EXTENSION",
      role: "ed",
      now: NOW_ANCHOR,
      movementId: countryTarget.id,
    });
    expect(country.rejections.at(-1)?.reason).toContain("recorded as a typed expiry");
    expect(country.movements).toBe(countryBase.movements);
    expect(country.units).toBe(countryBase.units);
    expect(country.admissions).toBe(countryBase.admissions);
    expect(country.referrals).toBe(countryBase.referrals);
    expect(country.notices).toBe(countryBase.notices);
    // Owner ruling 25 September 2026: a bed release names its stay and completes when the ward
    // records the person leaving; that departure discharges the release in the same write, and
    // RELEASE_BED refuses while the person is still in the bed. So no event sequence leaves a
    // release RELEASE_BED can accept. Named, not "at most N", for the reason given above; its
    // refusal while occupied is pinned in tests/ward-bed-release-lifecycle.test.ts (4 and 13).
    const UNREACHABLE_SINCE_DEPARTURE_COMPLETES_THE_RELEASE = new Set(["RELEASE_BED"]);
    const unscoped = ALL_EVENT_TYPES.filter(
      (type) =>
        !MOVEMENT_TARGETED_EVENTS.has(type) &&
        type !== "RESET_SCENARIO" &&
        type !== "SET_SCENARIO" &&
        type !== "RECORD_COUNTRY_EXTENSION" && // explicit unchanged-state refusal proof above
        !NO_COMMITMENT_ROW_TO_ACT_ON.has(type) &&
        !UNREACHABLE_SINCE_DEPARTURE_COMPLETES_THE_RELEASE.has(type),
    );
    expect(
      unscoped.filter((type) => !accepted.has(type)),
      `unscoped events never accepted during the Form ${code} sweep`,
    ).toEqual([]);
  }

  // RESET_SCENARIO on its own: it discards the sweep's movements, so it is exercised here and
  // the invariant checked against the state it restores.
  const reset = applyFirstAccepted("RESET_SCENARIO", seedWardFlowState(), NOW_ANCHOR);
  expect(reset, "RESET_SCENARIO was never accepted").toBeDefined();
  offenders.push(...offendingFormsIn(reset!.applied, "RESET_SCENARIO"));

  // SET_SCENARIO on its own, same reason as RESET_SCENARIO above — and against BOTH scenarios,
  // since `candidateEvents` offers one candidate per entry in `WARD_SCENARIOS` and this loop must
  // not silently exercise only the first one it is handed.
  for (const scenario of WARD_SCENARIOS) {
    const setScenario = wardFlowReducer(seedWardFlowState(), {
      type: "SET_SCENARIO",
      role: EVENT_ROLE.SET_SCENARIO[0],
      now: NOW_ANCHOR,
      scenario,
    });
    expect(setScenario.rejections, `SET_SCENARIO to ${scenario} was refused`).toEqual([]);
    offenders.push(...offendingFormsIn(setScenario, `SET_SCENARIO(${scenario})`));
  }

  // MARK_NOTICE_READ on its own: seedWardFlowState().notices is empty, so the sweep has no notices
  // to mark read. Exercised here against a seeded notice to prove it never touches legal forms.
  const sampleNotice: Notice = {
    id: "notice:test:guard",
    raisedAt: NOW_ANCHOR,
    to: { role: "officer" },
    about: { movementId: "WF-001" },
    kind: "transport_cancelled_officer",
    sentence: "Test notice",
  };
  const noticeRead = wardFlowReducer(
    { ...seedWardFlowState(), notices: [sampleNotice] },
    {
      type: "MARK_NOTICE_READ",
      role: "officer",
      now: NOW_ANCHOR,
      noticeId: sampleNotice.id,
    },
  );
  expect(noticeRead.rejections, "MARK_NOTICE_READ was refused").toEqual([]);
  offenders.push(...offendingFormsIn(noticeRead, "MARK_NOTICE_READ"));

  expect(offenders, `offenders found with supplyDueAt=${supplyDueAt}`).toEqual([]);
}
