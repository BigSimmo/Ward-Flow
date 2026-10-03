// tests/ward-referral-model.test.ts
import { describe, expect, it } from "vitest";

import { unitHasLockedBeds } from "../src/components/ward-management/ward-bed-designation";
import { GENDER_PLACEMENT_REASONS, OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { referralEligibility } from "../src/components/ward-management/ward-eligibility";
import { EVENT_ROLE, type WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import {
  HOME_REGIONS,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_SOURCES,
  REFERRAL_STATES,
  SEX_DESIGNATIONS,
  type Referral,
  type Unit,
  type WardAddressing,
  REFERRAL_DESTINATION_KINDS,
  type ReferralDestination,
  type ReferralDestinationKind,
} from "../src/components/ward-management/ward-model";
import { referrals } from "../src/components/ward-management/ward-movements";
import {
  referralState,
  referralDecidedAt,
  declinedAddressings,
  acceptedAddressing,
  DECLINE_REASON_LABELS,
  hasConfirmedCapacity,
  matchReason,
  networkHasCohort,
  recentlyDecidedReferrals,
  referralCandidates,
  referralQueueOrder,
  referralWaitLabel,
} from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits, siteByCode, unitById } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { madeUpForensicWard, withMadeUpForensicWard } from "./helpers/ward-made-up-forensic-ward";
/**
 * Narrows a seeded referral to the ward arm, throwing if it is not one.
 *
 * An assertion, never a cast. `as WardReferral` would compile just as well and would go on
 * compiling on the day a fixture referral is re-addressed to a community team — at which point the
 * bed gates below would be asked a question that referral never posed, and would answer it.
 */
function wardOf(subject: Referral): WardAddressing {
  const found = subject.destinations.find(
    (addressing): addressing is WardAddressing => addressing.destination.kind === "psychiatric_ward",
  );
  if (!found) throw new Error(`${subject.id} has no psychiatric ward destination`);
  return found;
}

describe("bed category — SexDesignation", () => {
  it("SEX_DESIGNATIONS is exactly the three designations, Undesignated first", () => {
    expect(SEX_DESIGNATIONS).toEqual(["Undesignated", "Female only", "Male only"]);
  });

  /**
   * Seed rule 1. `sexDesignation` is a CONSTRAINT on who may occupy a bed, never a value to
   * compare a referral's `sex` against for equality — a matching rule of the shape
   * `bed.sexDesignation === referral.sex` would exclude every undesignated bed, which is most of
   * the network, while looking entirely reasonable in review. This floor is deliberately not
   * "more than half": a fixture where every bed carries a designation would let that exact
   * equality bug pass every other test in this file, so the majority must be overwhelming and at
   * least one bed of each named designation must exist to prove the constraint is genuinely
   * expressible, not merely declared in the type.
   */
  it("seeds a clear majority of units Undesignated, with at least one Female only and one Male only", () => {
    const units = allUnits();
    const undesignated = units.filter((unit) => unit.sexDesignation === "Undesignated");
    const femaleOnly = units.filter((unit) => unit.sexDesignation === "Female only");
    const maleOnly = units.filter((unit) => unit.sexDesignation === "Male only");

    expect(femaleOnly.length).toBeGreaterThanOrEqual(1);
    expect(maleOnly.length).toBeGreaterThanOrEqual(1);
    // Every unit's designation is exactly one of the three — non-vacuity for the partition below.
    expect(undesignated.length + femaleOnly.length + maleOnly.length).toBe(units.length);
    // "Clear majority", not a bare majority: undesignated units must be the overwhelming norm.
    expect(undesignated.length).toBeGreaterThan(units.length * 0.8);
  });

  /**
   * Seed rule 2, superseded by the owner's ruling of 2026-09-25 (answer 1A): Broome, the network's
   * only forensic ward, is not forensic, so the sample network has none. The forensic gate is
   * tested against a made-up forensic ward (`tests/helpers/ward-made-up-forensic-ward.ts`).
   */
  it("seeds no forensic ward: the forensic gate is tested against a made-up one", () => {
    expect(allUnits().filter((unit) => unit.forensic)).toEqual([]);
    expect(madeUpForensicWard().forensic).toBe(true);
  });

  it("never merges `forensic` with locked-bed designation — a forensic unit here has locked beds, but that varies independently of forensic elsewhere in the fixture", () => {
    const units = allUnits();
    const forensicUnits = units.filter((unit) => unit.forensic);
    expect(forensicUnits.every((unit) => unitHasLockedBeds(unit))).toBe(true);
    // Plenty of non-forensic units also have locked beds — that is not derived from `forensic`.
    const nonForensicLocked = units.filter((unit) => !unit.forensic && unitHasLockedBeds(unit));
    expect(nonForensicLocked.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * M1 fix: `brm-adult-secure` used to be simultaneously the network's only forensic unit, its
   * only Male-only unit, AND `allocatable: 0` — so deleting either the `forensic` gate or the
   * `sex_designation` gate would not have changed a single candidate list, because the other
   * (allocatable) already excluded that unit for every referral. Fixed by giving
   * `brm-adult-secure` a usable allocatable count (making `forensic` the one thing that excludes
   * it) and moving Male-only to `fsh-adult-secure`, a real, usable, non-forensic unit (making
   * `sex_designation` load-bearing there instead). These two tests prove each gate is now the
   * SOLE reason its unit is excluded, for a referral every other gate accepts — not merely that
   * the designation/forensic flag is set.
   */
  it("the made-up forensic ward is excluded by the forensic gate alone, not also by unavailability", () => {
    const unit = madeUpForensicWard();
    expect(unit.forensic).toBe(true);
    expect(unit.allocatable.value).toBeGreaterThan(0);
    const compatible: Referral = {
      id: "RF-CHECK-FORENSIC",
      ageBand: "Adult",
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Male",
            secureBedNeeded: true,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "queued",
        },
      ],
      homeRegion: "Kimberley",
      suburb: { kind: "named", name: "Broome" },
      source: "community",
      raisedAt: NOW_ANCHOR - 10,
      urgency: 2,
      originSiteCode: "BRM",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    };
    const verdict = referralEligibility(compatible, wardOf(compatible).destination, unit, NOW_ANCHOR);
    const forensicGate = verdict.gates.find((gate) => gate.gate === "forensic");
    expect(forensicGate?.pass).toBe(false);
    expect(verdict.gates.filter((gate) => gate.gate !== "forensic").every((gate) => gate.pass)).toBe(true);
  });

  it("fsh-adult-secure's Male-only designation alone excludes a Female-gender referral every other gate accepts", () => {
    const unit = unitById("fsh-adult-secure")!;
    expect(unit.sexDesignation).toBe("Male only");
    expect(unit.forensic).toBe(false);
    const compatible: Referral = {
      id: "RF-CHECK-DESIGNATION",
      ageBand: "Adult",
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            // T10 (item 8): the gate reads `gender`, recorded AT REFERRAL, never `sex`.
            gender: "Female",
            secureBedNeeded: true,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "queued",
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      raisedAt: NOW_ANCHOR - 10,
      urgency: 2,
      originSiteCode: "FSH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    };
    const verdict = referralEligibility(compatible, wardOf(compatible).destination, unit, NOW_ANCHOR);
    const designationGate = verdict.gates.find((gate) => gate.gate === "gender_designation");
    expect(designationGate?.pass).toBe(false);
    expect(verdict.gates.filter((gate) => gate.gate !== "gender_designation").every((gate) => gate.pass)).toBe(true);
  });
});

describe("bed category — the Youth unit", () => {
  /**
   * Seed rule 3. The East Metropolitan Youth Unit (EMyU) at Bentley Health Service is a real
   * unit supplied by the product owner on 2026-08-27, not an invention — this test pins the name
   * verbatim, capitalisation included, and its site. Without it, every youth referral fails the
   * cohort gate in `ward-eligibility.ts` against the whole network for a structural reason.
   */
  it("seeds exactly one Youth unit: the East Metropolitan Youth Unit (EMyU) at Bentley Health Service (BTY)", () => {
    const youthUnits = allUnits().filter((unit) => unit.cohort === "Youth");
    expect(youthUnits).toHaveLength(1);
    expect(youthUnits[0]?.name).toBe("East Metropolitan Youth Unit (EMyU)");
    expect(youthUnits[0]?.siteCode).toBe("BTY");

    const bentley = siteByCode("BTY");
    expect(bentley?.name).toBe("Bentley Health Service");
    expect(bentley?.units.some((unit) => unit.id === youthUnits[0]?.id)).toBe(true);
  });
});

describe("front-door contract — fixed lists", () => {
  /**
   * ⚠️ THE CONTRACT MOVED AGAIN, BY OWNER DECISION, AND THIS PIN MOVED WITH IT — the same
   * distinction the `REFERRAL_DECLINE_REASONS` docblock below draws, applied a second time.
   * **The pin moves when the agreement moves; what must never happen is somebody editing it
   * because it has become inconvenient.** So the decision is recorded here and not only in a
   * commit message.
   *
   * Owner, 2026-09-06, asked whether ED medical staff should be a referral source, given that a
   * referral raised inside the emergency department to ED psychiatry had no honest source to
   * record: *"ED medical staff will refer a patient and ED psychiatry staff will add it to the
   * referral board. The patient were officially referred from ED in the referral location."*
   *
   * ⚠️ **`ed_medical`, NOT `emergency_department`** — that string is already taken on this same
   * record as a `REFERRAL_DESTINATION_KINDS` value meaning something else, and its own comment
   * says the referral does not go to an ED. Only the LABEL is the owner's: "ED medical staff" is
   * quoted from him verbatim and lives in the two `SOURCE_LABELS` maps. The identifier reaches no
   * screen.
   *
   * 🔴 **THIS RED WAS FOUND BY THE FOLD, NOT BY EITHER AUTHOR.** The source was added on one
   * branch and this pin lives on another; both suites were green in isolation and the two met for
   * the first time in the integration tree. A contract pin is precisely the guard that CANNOT be
   * satisfied by the chat changing the thing it pins — which is what it is for.
   *
   * **The pin moved a second time, owner answer 25, 2026-09-17, verbatim:** *"GP referrals: the GP
   * is told by phone or letter for now; add 'GP' as a referral source."* This supersedes his
   * earlier 2026-09-11 answer ("NO. They come through ED or community.") recorded on
   * `WARD_NEW_REFERRAL_MENU` (`ward-nav.ts`) and `ward-facade.ts`'s own `ReferralSource` — neither
   * of which this answer reopens: there is still no navigation shortcut for a GP referral, only a
   * real place to record one once raised. `gp` resolves no referrer either, exactly like four of
   * the other five members — see `referralReferrer`'s own doc comment in `ward-flow-reducer.ts`.
   */
  it("REFERRAL_SOURCES and REFERRAL_STATES match the front-door contract exactly", () => {
    expect(REFERRAL_SOURCES).toEqual([
      "community",
      "crisis_service",
      "police",
      "ambulance",
      "inter_hospital",
      "ed_medical",
      "gp",
      "psychiatric_ward",
    ]);
    expect(REFERRAL_STATES).toEqual(["queued", "accepted", "declined"]);
  });

  /**
   * ⚠️ THE CONTRACT MOVED, BY OWNER DECISION, AND THIS PIN MOVED WITH IT — WHICH IS THE TEST
   * WORKING RATHER THAN THE TEST BEING CIRCUMVENTED.
   *
   * A contract test pins an agreement. When the agreement changes, the pin changes; what must
   * never happen is somebody editing it because it has become inconvenient. So the decision is
   * recorded here rather than only in a commit message.
   *
   * Owner, 2026-09-02, asked what a ward should do when its real reason is not on the list, given
   * that it must now state one: he chose a CHOSEN CATCH-ALL over free text and over leaving the
   * ward unable to decline. `"another_reason"` is that catch-all.
   */
  it("REFERRAL_DECLINE_REASONS matches the front-door contract exactly", () => {
    expect(REFERRAL_DECLINE_REASONS).toEqual([
      "no_suitable_bed",
      "age_band_not_provided_here",
      "sex_designation_unavailable",
      "secure_bed_unavailable",
      "belongs_to_another_service",
      "referred_elsewhere",
      "another_reason",
    ]);
  });

  /**
   * Phase 8 Task 6. `"out_of_catchment"` claimed a check the system cannot perform: nothing in
   * this model holds a catchment for anybody, and `homeRegion` cannot supply one (a catchment is
   * a service's boundary, a home region is where a person lives, and ten WA regions do not map
   * onto five health services). The reason was RENAMED, not removed — "this request belongs to
   * another service" is a real administrative answer a coordinator can give and can know, and
   * removing it would push coordinators onto a reason that means something else.
   *
   * Which is why distinctness is asserted here rather than left implied by the array pin above:
   * `"belongs_to_another_service"` (another service should answer this request) and
   * `"referred_elsewhere"` (this request has already been sent on) are two different answers, and
   * collapsing them into one is the cheap "tidy-up" this test exists to refuse.
   */
  it("renames the catchment reason and keeps it distinct from referred_elsewhere", () => {
    expect(REFERRAL_DECLINE_REASONS).toContain("belongs_to_another_service");
    expect(REFERRAL_DECLINE_REASONS).toContain("referred_elsewhere");
    expect(REFERRAL_DECLINE_REASONS).not.toContain("out_of_catchment" as never);
    expect(new Set(REFERRAL_DECLINE_REASONS).size).toBe(REFERRAL_DECLINE_REASONS.length);

    // The labels a coordinator actually reads must stay two different sentences too — a shared
    // label collapses the two answers on screen even when the enum keeps them apart.
    expect(DECLINE_REASON_LABELS.belongs_to_another_service).toBe("Belongs to another service");
    expect(DECLINE_REASON_LABELS.belongs_to_another_service).not.toBe(DECLINE_REASON_LABELS.referred_elsewhere);

    // And the renamed reason must not reintroduce the claim it was renamed to drop.
    for (const reason of REFERRAL_DECLINE_REASONS) {
      expect(reason).not.toMatch(/catchment/i);
      expect(DECLINE_REASON_LABELS[reason]).not.toMatch(/catchment/i);
    }
  });

  /**
   * Every decline reason must describe the SERVICE's answer or the NETWORK's state, never the
   * person referred — the same bar `BED_RELEASE_BLOCKERS` holds to, which is why "Pending case
   * review outcome" was excluded there ("case review" reads as about the patient's own case, not
   * the bed). A denylist only catches an anticipated wording, so this checks for the recognisable
   * shapes a person-describing reason would take, not just one literal phrase.
   */
  it("REFERRAL_DECLINE_REASONS contains no entry describing a person", () => {
    const personDescribingFragments = [
      "not appropriate",
      "not unwell",
      "not ready",
      "behaviour",
      "behavior",
      "engagement",
      "risk",
      "presentation",
      "diagnosis",
      "history",
      "capacity to consent",
      "insight",
      "compliance",
      "non-compliant",
    ];
    for (const reason of REFERRAL_DECLINE_REASONS) {
      const words = reason.replace(/_/g, " ");
      for (const fragment of personDescribingFragments) {
        expect(words).not.toContain(fragment);
      }
    }
  });

  it("no Mental Health Act figure, timeframe or threshold appears in any decline reason", () => {
    for (const reason of REFERRAL_DECLINE_REASONS) {
      expect(reason).not.toMatch(/\d/);
    }
  });

  /**
   * Review finding M2: the check above sweeps the ENUM KEYS, which nobody reads. The strings a
   * coordinator actually picks from in the decline `<select>` (and now reads back on the board's
   * decided row) are `DECLINE_REASON_LABELS`' VALUES, and nothing swept those — so changing
   * `no_suitable_bed`'s label to "No suitable bed within 24 hours" left the key untouched, passed
   * the digit check above, and rendered the figure on a clinical surface.
   *
   * The key-set pin is the other half: a label map that silently loses a key falls back to the
   * raw enum value at every consumer, and a label map that gains one puts a string on screen that
   * no reason can ever produce. Both halves are asserted here rather than in a DOM test, because
   * this is a property of the copy itself and must hold before any screen renders it.
   */
  it("no digit appears in any decline reason LABEL, and the label map covers exactly the reasons", () => {
    expect(Object.keys(DECLINE_REASON_LABELS).sort()).toEqual([...REFERRAL_DECLINE_REASONS].sort());
    for (const reason of REFERRAL_DECLINE_REASONS) {
      expect(DECLINE_REASON_LABELS[reason]).not.toMatch(/\d/);
    }
  });

  /**
   * Fix round B (this task's new field): `HOME_REGIONS` is the fixed list `homeRegion` is
   * membership-checked against — real Western Australian regions, never an address, never free
   * text. See `docs/ward-flow-phase-6-7-decisions.md` ("A sixth answer, given mid-build").
   */
  it("HOME_REGIONS is exactly the ten WA regions, Perth Metropolitan first", () => {
    expect(HOME_REGIONS).toEqual([
      "Perth Metropolitan",
      "Peel",
      "South West",
      "Great Southern",
      "Wheatbelt",
      "Goldfields-Esperance",
      "Mid West",
      "Gascoyne",
      "Pilbara",
      "Kimberley",
    ]);
  });
});

/**
 * Owner ruling 2026-08-30: **only close to all.** An emergency department may close to all
 * admissions; it may never refuse a named patient. Refusing a named person means recording a
 * judgement about that individual; closing to everyone is a fact about the department.
 *
 * Today that ruling holds by ABSENCE — no event, no reducer path and no decline reason lets a
 * department refuse one named individual on grounds that are about that individual. An absence is
 * not a guarantee: nothing fails if somebody adds one. This is the guard, built in the same shape
 * as `REFERRAL_DECLINE_REASONS contains no entry describing a person` above.
 *
 * WHAT IT ENUMERATES, and why it can fail on a path nobody here anticipated:
 *
 *   - **Every event type**, taken from `Object.keys(EVENT_ROLE)` rather than written out.
 *     `EVENT_ROLE` is typed `Record<WardFlowEvent["type"], …>`, so the compiler forces a NEW
 *     event variant to be added there, and it therefore turns up in this sweep whether or not
 *     anyone remembered this file. The table below must classify every one of them by name, and
 *     the key-set assertion fails on any type the table does not carry — so adding an event is a
 *     decision somebody takes here rather than something a later diff reveals. That is the part
 *     that fails on TOMORROW's path, not only on the ones listed today.
 *   - **Every referral decline reason**, taken from `REFERRAL_DECLINE_REASONS` itself, each of
 *     which must be listed below against the department-level or network-level fact it states.
 *
 * Reducer paths need no third sweep, and this guard does not pretend to perform one:
 * `wardFlowReducer` switches on `event.type` over this same discriminated union, so a `case`
 * label that is not an event type does not compile. That is the compiler's guarantee, restated
 * here — not this test's.
 *
 * WHAT IT DOES NOT COVER — stated plainly rather than left to be inferred:
 *
 *   - It cannot tell whether a classification somebody writes into the table is HONEST. An author
 *     who adds an individual-refusing event and marks it `false` walks straight past this guard.
 *     What it catches is adding one SILENTLY.
 *   - It says nothing about the movement-side `DECLINE`, which is one unit declining one
 *     patient's placement and which carries an optional free-text `note`. That is a different
 *     surface from the referral front door this ruling is about, and that free-text field is a
 *     finding to raise, not something this guard closes.
 *   - It reads the model only, never a screen. A refusal expressed in UI copy alone, or through
 *     data (a unit configured so that exactly one referral fails the eligibility gate), is
 *     outside its reach entirely.
 *   - The reason-membership half is not this guard's own proof:
 *     `tests/ward-referral-reducer.test.ts` already refuses an off-list `DECLINE_REFERRAL` reason
 *     at runtime, by membership rather than truthiness, and this file does not duplicate it.
 */
describe("front-door contract — an ED may close to all admissions, never refuse a named patient", () => {
  /**
   * Every event in the model, and whether it can record the refusal of ONE named referral or
   * placement. Written out by name so a new event is classified deliberately; the assertion below
   * is what makes leaving it out impossible.
   */
  const EVENT_REFUSES_ONE_NAMED_SUBJECT: Record<WardFlowEvent["type"], boolean> = {
    // Records that a referred person is physically in the department. NOT a refusal, and the
    // reason is worth stating rather than assuming: it is the ONLY event whose effect is to move
    // somebody INTO this department's own list, which is the opposite of turning them away. It
    // cannot decline, cannot close a door, and carries no reason field to hold one.
    RECORD_ARRIVED_IN_DEPARTMENT: false,
    // Records whether a patient's medical workup is done. NOT a refusal: "not cleared" is a
    // clinical status about the patient's own state, not a decision to decline them a bed or a
    // review, and nothing in the reducer treats it as one.
    // ⚠️ Classified `false` with this guard's own caveat in view — it cannot tell whether a
    // classification is HONEST, and a department could in principle USE "not cleared" as a soft
    // refusal. That would be a refusal expressed through data, which the doc block above already
    // places outside its reach. Written down so the reasoning is visible rather than assumed.
    RECORD_MEDICAL_CLEARANCE: false,
    // Records whether a patient needs transport. NOT a refusal: `needed: false` says this patient
    // can travel without a booked job, which decides nothing about whether anybody will have them.
    RECORD_TRANSPORT_NEED: false,
    // Records that NOBODY referred this patient — an answer about the front door, not a decision
    // about a named referral or placement. There is no referral here to refuse: that is the fact.
    RECORD_NO_REFERRAL: false,
    // Both discharge paths record that somebody LEFT a ward. They refuse nobody — each is the end
    // of a stay, not a decision about a named referral or placement.
    RECORD_ADMISSION_FOLLOW_UP: false,
    RECORD_PATIENT_DISCHARGE: false,
    RECORD_LEAVING: false,
    RECORD_LEFT_DEPARTMENT: false,
    // RB3, item 19: the department recording that a patient no longer needs a bed search (going
    // home, or needing community follow-up instead). Not a refusal by a RECEIVING unit — no unit
    // is declining a placement, the department is stating its own disposition of the patient, the
    // same reasoning RECORD_LEFT_DEPARTMENT and RECORD_PATIENT_DISCHARGE are classified `false` for
    // immediately above.
    RECORD_ED_OUTCOME: false,
    // Opening a discharge record is a guarded, audited read attempt. It changes no referral,
    // placement or clinical decision and therefore refuses no named subject.
    OPEN_DISCHARGE_RECORD: false,
    // Administrative review appends a decision about an audit event. It cannot rewrite the event
    // or the clinical record and is not a refusal of the person that event may concern.
    REVIEW_AUDIT_EVENT: false,
    // The REFERRER taking its own referral back, for every destination at once. Not a refusal of
    // anybody: no receiving unit is deciding anything, and the patient is not being turned away —
    // the request simply no longer stands.
    WITHDRAW_REFERRAL: false,
    // 🔴 THE SAME ACT AS THE LINE ABOVE, ON A DIFFERENT SUBJECT, AND CLASSIFIED THE SAME WAY FOR THE
    // SAME REASON. `WITHDRAW_REFERRAL` withdraws a bed search for a person already inside a
    // department (`movementId`); this one withdraws a REFERRAL before any movement exists
    // (`referralId`). ⚠️ Two events, one meaning, two subjects — deliberate per `ward-model.ts`, and
    // the payload is the only thing keeping them apart at a call site.
    // Not a refusal of anybody: nobody is deciding about this person, and nobody is turned away —
    // the referrer took the request back and it no longer stands.
    RECORD_REFERRER_WITHDRAWAL: false,
    // RB7, build plan item 27 (2026-09-17): appends a note to `Referral.corrections`. Not a
    // refusal of anybody — nobody is deciding on this referral's outcome, and no unit or network
    // is turning the person away. It is a clarification added on top of whatever has already
    // happened, and carries no reason field that could hold one.
    ADD_REFERRAL_CORRECTION: false,
    // A ward recording that one of its own occupants has gone out to an emergency department,
    // and that they are back. Neither refuses anybody: no referral or placement is being decided
    // on, and the bed is held throughout — nothing is turned away by either.
    // Recording what is holding a movement up. Not a refusal of anybody: it describes an
    // obstruction, and describing one is the opposite of a unit deciding against a patient.
    // Putting a patient above every urgency tier, and taking them back down. Neither refuses
    // anybody: raising one patient's place in a queue is not a decision against another, and no
    // unit is declining a placement.
    FLAG_MOVEMENT_URGENT: false,
    CLEAR_MOVEMENT_URGENT_FLAG: false,
    RECORD_MOVEMENT_BLOCKER: false,
    // Saying nothing is holding a movement up. Refuses nobody, for the same reason recording a
    // blocker does not.
    CLEAR_MOVEMENT_BLOCKER: false,
    RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: false,
    RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: false,
    RAISE_REFERRAL: false,
    RECORD_EXAMINATION: false,
    RECORD_LEGAL_FORM_RECEIVED: false,
    // T2 (2026-09-17 build plan). Records a typed expiry or extension against a legal form
    // already on the movement. Not a refusal of a named referral or placement, on the same
    // reasoning as RECORD_LEGAL_FORM_RECEIVED immediately above: it neither declines a patient
    // nor closes a door, and carries no reason field that could hold one.
    RECORD_LEGAL_FORM_EXPIRY: false,
    // Opus review round 2, 17 September 2026 (P2). Records or corrects the gender recorded at
    // referral. Not a refusal of a named referral or placement: it neither declines a patient nor
    // closes a door, and carries no reason field that could hold one — the same reasoning as
    // RECORD_LEGAL_FORM_EXPIRY immediately above.
    RECORD_MOVEMENT_GENDER: false,
    // T4 (2026-09-17 build plan). Corrects a mistaken receipt record. Its `reason` names why the
    // CORRECTION was made (recorded in error, against the wrong movement, form not yet arrived),
    // never a decision against a person — the same reasoning as its two siblings immediately
    // above.
    CORRECT_LEGAL_FORM_RECEIPT: false,
    REFER_TO_COMMUNITY_TEAM: false,
    REFER_TO_UNITS: false,
    ACCEPT_IN_PRINCIPLE: false,
    PULL_PATIENT: false,
    // One unit declining one patient's placement, with a reason from `DECLINE_REASONS`.
    DECLINE: true,
    HANDOVER_READY: false,
    TRANSPORT_ACCEPTED: false,
    TRANSPORT_EN_ROUTE: false,
    PATIENT_COLLECTED: false,
    PATIENT_ARRIVED: false,
    CONFIRM_CAPACITY: false,
    // A ward restating what is currently limiting its own intake, from a fixed list. Not a
    // refusal of any named referral or placement — it carries no subject at all.
    RECORD_WARD_INTAKE_CONSTRAINTS: false,
    RECORD_ESCALATION: false,
    ADVANCE_CLOCK: false,
    RESET_SCENARIO: false,
    SET_SCENARIO: false,
    // Saves the coordinator-tunable ED access target/parallel cap/pull hold. Not a refusal: it
    // names no referral, movement or unit, and its own subject kind is "configuration" —
    // ward-configuration.ts/ward-audit.ts, Task 3 of the audit-wiring plan, 2026-09-16.
    SET_CONFIGURATION: false,
    ADD_PATIENT: false,
    CHANGE_URGENCY: false,
    CHANGE_LEGAL_STATUS: false,
    RELEASE_PULL: false,
    // Books a transport job; refuses nothing and names no subject.
    BOOK_TRANSPORT: false,
    CANCEL_TRANSPORT: false,
    // WLQ-38 (owner, 2026-09-15): the referrer or the coordinator stopping a collected journey.
    // Same shape as CANCEL_TRANSPORT and RELEASE_PULL above: it unwinds an earlier reservation of
    // this movement's OWN journey and closes it, and no OTHER unit is deciding anything about the
    // person — a bed given back and a transport stopped are not a placement refusal.
    STOP_TRANSPORT: false,
    // Owner answer 8 (second round, 2026-09-17): gives back a bed STOP_TRANSPORT left held. Same
    // shape as STOP_TRANSPORT immediately above — it unwinds this movement's OWN reservation and
    // refuses nothing about any OTHER person or unit.
    RELEASE_HELD_BED: false,
    // Build plan item 29 (T4a): diversion / release of a diverted bed — same "own journey unwind"
    // shape as STOP_TRANSPORT / RELEASE_HELD_BED above, not a front-door refusal of another person.
    RECORD_DIVERSION: false,
    RELEASE_DIVERTED_BED: false,
    FLAG_BED_RELEASE: false,
    CONFIRM_BED_RELEASE: false,
    REVERT_BED_RELEASE: false,
    BLOCK_BED_RELEASE: false,
    CLEAR_BED_RELEASE_BLOCK: false,
    SET_BED_PREPARATION: false,
    RELEASE_BED: false,
    RECORD_LEAVE_BED: false,
    END_LEAVE_BED: false,
    REQUEST_CAPACITY_REFRESH: false,
    RECEIVE_REFERRAL: false,
    ACCEPT_REFERRAL: false,
    RECORD_LOCAL_BED_SOUGHT: false,
    // The referral front door's own refusal, with a reason from `REFERRAL_DECLINE_REASONS`.
    DECLINE_REFERRAL: true,
    // The coordinator's own record correction (Task 5, 2026-09-04) — moves `stage` strictly
    // backwards and touches nothing else. Same shape as RELEASE_PULL/CANCEL_TRANSPORT above:
    // refuses nobody, names no subject, and carries a reason from STEP_BACK_REASONS rather than a
    // decline-reason list.
    STEP_BACK_STAGE: false,
    // The coordinator undoes a WARD's earlier "yes" — not the same act as DECLINE or
    // DECLINE_REFERRAL. The movement returns to destination_review, open to referral again; no
    // unit is declining anything and no subject is named as refused.
    WITHDRAW_ACCEPTANCE: false,
    // RA1 (item 18, 2026-09-17): the same act as `WITHDRAW_REFERRAL` above, on ONE ward rather than
    // all of them. The COORDINATOR takes back its own request against a named ward — no receiving
    // unit is deciding anything, and the patient is not being turned away; the request against that
    // one ward simply no longer stands. Not a refusal by the ward being named.
    WITHDRAW_WARD_REQUEST: false,
    // Item 48, Q2 (owner answer 48, 2026-09-17): the addressee marking its own notice read. Its
    // subject is a NOTICE, not a referral or a placement — no unit declines anybody, and the
    // patient a notice is about is entirely unaffected by whether the notice has been read.
    MARK_NOTICE_READ: false,
    // The three inbox work-state events, added 2026-09-06 with the coordinator's to-do panel.
    // NOT refusals, and the distinction is the whole point of this map: their subject is a ROW ON A
    // BOARD, not a person. Acknowledging says who is on a problem; completing says a piece of work
    // is done; reopening undoes that. None of them declines anybody a bed, a review or a placement,
    // and the reducer stores them in maps keyed by `InboxItem.id` that no placement path reads.
    //
    // ⚠️ Worth stating because the tempting reading is the other one: COMPLETE_INBOX_ITEM makes a row
    // stop demanding attention, which LOOKS like a refusal. It is not — the row is a description of
    // work, and the patient it concerns is unaffected by the tick. The safety rule that a live
    // clinical or legal fact can never be ticked away is enforced elsewhere, by classification, and
    // is a different property from this one.
    ACKNOWLEDGE_INBOX_ITEM: false,
    COMPLETE_INBOX_ITEM: false,
    REOPEN_INBOX_ITEM: false,
    SET_ARRIVAL_DETAILS: false,
    SET_STEP_DOWN_CANDIDATE: false,
    SET_DISCHARGE_BARRIER: false,
    RECORD_MOVEMENT_MEDICAL_CLEARANCE: false,
    UPLOAD_PATIENT_FORM: false,
    RECORD_LEGAL_FORM_WRITTEN: false,
    RECORD_COUNTRY_EXTENSION: false,
    RECORD_LEGAL_FORM_CONTINUATION: false,
    EVALUATE_ARRIVAL_LATENESS: false,
    RELEASE_AND_REOPEN_SEARCH: false,
    CLEAR_EXPECT_FLAG: false,
    RAISE_EXPECT_FLAG: false,
    FLAG_LEGAL_MISMATCH: false,
    EVALUATE_LEAVE_BED_WARNINGS: false,
    CONFIRM_MORNING_ROLLUP: false,
    SEND_WARD_BUZZ: false,
    // These append a repatriation phone-log, shift sign-off, or team-contact record.
    // Even "receiving ward agreed: false" records a phone-call fact; none of these
    // handlers changes a referral or placement decision or declines a named subject.
    RECORD_REPATRIATION: false,
    RECORD_HANDOVER_SIGN_OFF: false,
    RECORD_CLINICAL_CONTACT: false,
    DISPATCH_BROADCAST_ALERT: false,
    ACKNOWLEDGE_BROADCAST_ALERT: false,
    STAND_DOWN_BROADCAST_ALERT: false,
    UPDATE_EXPECTED_DISCHARGE: false,
  };

  /**
   * The events above that CAN refuse one named subject, written out separately from the table.
   * The table says what each event is; this says how many of them there are, so a third cannot
   * arrive by flipping one `false` in a long list nobody reads twice.
   */
  const REFUSES_ONE_NAMED_SUBJECT = ["DECLINE", "DECLINE_REFERRAL"];

  it("classifies every event in the model, so a new refusal path cannot arrive unclassified", () => {
    // Non-vacuity: the role table really was read, or every assertion below compares two empties.
    expect(Object.keys(EVENT_ROLE).length).toBeGreaterThan(0);

    expect(
      Object.keys(EVENT_REFUSES_ONE_NAMED_SUBJECT).sort(),
      "an event exists that nobody has weighed against the close-to-all ruling — classify it here",
    ).toEqual(Object.keys(EVENT_ROLE).sort());

    expect(
      Object.entries(EVENT_REFUSES_ONE_NAMED_SUBJECT)
        .filter(([, refuses]) => refuses)
        .map(([type]) => type)
        .sort(),
      "another event can now refuse one named subject — the ruling permits closing to everyone, never refusing a person",
    ).toEqual([...REFUSES_ONE_NAMED_SUBJECT].sort());
  });

  /**
   * A denylist over event NAMES, in the same shape as the person-describing check on the decline
   * reasons above and with the same acknowledged limit: it catches only a wording somebody
   * anticipated. It earns its place because the words an individual-refusal event would reach for
   * are exactly the ones the classification table's own author would nod through, and because the
   * name is the part a reviewer skims.
   */
  it("names no event after refusing a person", () => {
    for (const type of Object.keys(EVENT_ROLE)) {
      const words = type.toLowerCase().replace(/_/g, " ");
      for (const fragment of ["refuse", "reject", "unsuitable", "not appropriate", "unacceptable", "barred"]) {
        expect(words, `${type} is named after refusing somebody`).not.toContain(fragment);
      }
    }
  });

  /**
   * The half of the ruling that carries its meaning: a refusal at the front door must state a
   * fact about the DEPARTMENT or the NETWORK — something that would be just as true of the next
   * referral through the door — never a judgement about the person named on this one. Each reason
   * is written out here against the subject it is a fact about.
   *
   * This overlaps the exact-array pin above, deliberately: that pin catches a new reason, and
   * this catches what it cannot, where the author who adds a reason also updates the obvious list
   * and never asks whose fact the new reason states.
   */
  it("states every decline reason as a fact about the department or the network, never about the person", () => {
    const PERMITTED_SUBJECTS = ["the network", "this department", "the request"];
    const SUBJECT_OF_EACH_REASON: Record<string, string> = {
      no_suitable_bed: "the network",
      age_band_not_provided_here: "this department",
      sex_designation_unavailable: "the network",
      secure_bed_unavailable: "the network",
      belongs_to_another_service: "the request",
      referred_elsewhere: "the request",
      // ⚠️ "this department", and the guard is right to have made me say so. A catch-all is the
      // easiest place in this list to smuggle a judgement about the person: "another reason" could
      // mean "this ward has a reason of its own" or it could mean "there is something about this
      // patient we would rather not write down". It is entered here as the FIRST, and the label a
      // ward reads names the department's next action rather than the person — it says see the
      // coordinator, not something about who was referred.
      another_reason: "this department",
    };

    expect(
      Object.keys(SUBJECT_OF_EACH_REASON).sort(),
      "a decline reason exists whose subject nobody has stated — say whose fact it is, and it must not be the person's",
    ).toEqual([...REFERRAL_DECLINE_REASONS].sort());

    for (const reason of REFERRAL_DECLINE_REASONS) {
      expect(
        PERMITTED_SUBJECTS,
        `${reason} is a fact about the person referred, which is the one thing a refusal may never be`,
      ).toContain(SUBJECT_OF_EACH_REASON[reason]);
    }
  });
});

describe("referrals fixture — the awkward cases (seed rule 4)", () => {
  it("is non-empty, so every check below is not vacuously true", () => {
    expect(referrals.length).toBeGreaterThan(0);
  });

  /**
   * Seed rule 4(a). Proved structurally against the real fixture — not asserted against a
   * specific id alone — so this stays true even if the exact referral that satisfies it changes.
   * A referral is structurally unmatchable when no unit anywhere shares its `ageBand` cohort, or
   * (when a secure bed is needed) no unit sharing that cohort is `"Secure"`.
   */
  it("seeds at least one queued referral that no unit in the whole network could structurally satisfy", () => {
    const structurallyImpossible = referrals.filter((referral) => {
      if (referralState(referral) !== "queued") return false;
      const candidates = allUnits().filter((unit) => unit.cohort === referral.ageBand);
      // A secure bed is a ward-arm requirement; a referral addressed anywhere else never asked
      // for one, so it is filtered by cohort alone exactly as an open-bed ward referral is.
      const secureNeeded = referral.destinations.some(
        (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.destination.secureBedNeeded,
      );
      const viable = secureNeeded ? candidates.filter((unit) => unitHasLockedBeds(unit)) : candidates;
      return viable.length === 0;
    });
    expect(structurallyImpossible.length).toBeGreaterThanOrEqual(1);
  });

  it("RF-001 is exactly that case: Youth + a secure bed needed, and the network's only Youth unit is Open", () => {
    const rf001 = referrals.find((referral) => referral.id === "RF-001");
    expect(rf001).toMatchObject({
      ageBand: "Youth",
      destinations: [{ destination: { kind: "psychiatric_ward", secureBedNeeded: true }, state: "queued" }],
    });
    expect(referralState(rf001!)).toBe("queued");
    const youthUnits = allUnits().filter((unit) => unit.cohort === "Youth");
    expect(youthUnits.every((unit) => !unitHasLockedBeds(unit))).toBe(true);
  });

  /** Seed rule 4(b). */
  it("seeds at least one declined referral, with a decline reason drawn from the fixed list", () => {
    const declined = referrals.filter((referral) => referralState(referral) === "declined");
    expect(declined.length).toBeGreaterThanOrEqual(1);
    for (const referral of declined) {
      const reasons = declinedAddressings(referral).map((addressing) => addressing.declineReason);
      expect(reasons.length).toBeGreaterThan(0);
      for (const reason of reasons) {
        expect(reason).toBeDefined();
        expect(REFERRAL_DECLINE_REASONS).toContain(reason);
      }
    }
  });

  /** Seed rule 4(c). */
  it("seeds at least one youth referral", () => {
    expect(referrals.filter((referral) => referral.ageBand === "Youth").length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Seed rule 4(d) — the fixture shape that catches the equality-shaped matching bug before
   * Task 2 can even write it: a referral whose sex a DESIGNATED bed correctly excludes, while an
   * UNDESIGNATED bed correctly accepts the same referral. `bed.sexDesignation === referral.sex`
   * would (wrongly) refuse this referral everywhere, because `"Undesignated" !== "Male"` reads as
   * a mismatch even though an undesignated bed accepts every sex.
   */
  it("seeds at least one referral whose sex a designated bed would exclude, but an undesignated bed accepts", () => {
    const found = referrals.find((referral) => {
      const acceptedHere = acceptedAddressing(referral);
      if (!acceptedHere?.acceptedUnitId) return false;
      const acceptedUnit = allUnits().find((unit) => unit.id === acceptedHere.acceptedUnitId);
      if (acceptedUnit?.sexDesignation !== "Undesignated") return false;
      // A designated bed elsewhere in the network that names the OTHER sex — it would correctly
      // exclude this referral by name, proving the designation is a real, working constraint.
      // Only a ward referral carries a sex for a designation to exclude; anything else cannot
      // be the case this test is looking for.
      const wardHere = referral.destinations.find((a) => a.destination.kind === "psychiatric_ward");
      if (wardHere?.destination.kind !== "psychiatric_ward") return false;
      const oppositeDesignation = wardHere.destination.sex === "Male" ? "Female only" : "Male only";
      return allUnits().some((unit) => unit.sexDesignation === oppositeDesignation);
    });
    expect(found).toBeDefined();
  });

  it("RF-003 is exactly that case: Male, accepted at an Undesignated bed, while the network's Female-only bed exists and would exclude it", () => {
    const rf003 = referrals.find((referral) => referral.id === "RF-003");
    expect(rf003).toMatchObject({
      destinations: [
        {
          destination: { kind: "psychiatric_ward", sex: "Male" },
          state: "accepted",
          acceptedUnitId: "scgh-adult-open",
        },
      ],
    });
    expect(referralState(rf003!)).toBe("accepted");
    const acceptedUnit = allUnits().find(
      (unit) => unit.id === (rf003 ? acceptedAddressing(rf003)?.acceptedUnitId : undefined),
    );
    expect(acceptedUnit?.sexDesignation).toBe("Undesignated");
    expect(allUnits().some((unit) => unit.sexDesignation === "Female only")).toBe(true);
  });

  /**
   * H2 fix: `originSiteCode` used to be checked with `not.toMatch(/^$/)` — a non-empty check, not
   * a resolution. `"123 Wellington Street, Perth"` survives a non-empty check just as easily as
   * a real code does, and so does `"NOT-A-SITE"` — this file already imports `siteByCode`, which
   * is the real check that was one call away. `homeRegion` gets the equivalent membership check,
   * the field this task adds.
   */
  it("every acceptedUnitId, originSiteCode and homeRegion in the fixture resolves to a real unit/site/region — no dangling reference, no address", () => {
    for (const referral of referrals) {
      const acceptedUnitId = acceptedAddressing(referral)?.acceptedUnitId;
      if (acceptedUnitId) {
        expect(allUnits().some((unit) => unit.id === acceptedUnitId)).toBe(true);
      }
      expect(
        siteByCode(referral.originSiteCode),
        `${referral.id} originSiteCode does not resolve to a real site`,
      ).toBeDefined();
      expect(HOME_REGIONS, `${referral.id} homeRegion is not a member of HOME_REGIONS`).toContain(referral.homeRegion);
    }
  });

  /**
   * C1 fix (Critical, fix round A's own review): the seed used to record RF-006 as `accepted` at
   * `brm-adult-secure`, a forensic unit `referralEligibility` refuses unconditionally (D7) — an
   * acceptance the live reducer (`ACCEPT_REFERRAL`, which calls this same function) would have
   * refused. This is the four-line test the review named as the one that would have caught it at
   * Task 1: every referral this fixture records as accepted must actually be eligible for the
   * unit it is recorded as accepted into, checked against the real function, not re-derived.
   */
  /**
   * ⚠️ **SCOPED TO A WARD ACCEPTANCE SINCE 2026-09-01, AND THE NARROWING IS THE MODEL'S OWN RULE
   * RATHER THAN A CONVENIENCE.** `ReferralAddressing.acceptedUnitId` is documented as "only ever
   * set on a `psychiatric_ward` addressing — the other three are answered by a person or a team,
   * and have no unit to name". `RF-010` is a community-only referral accepted by a clinic, so it
   * is `referralState === "accepted"` with no unit, correctly, and the unscoped filter below read
   * that as a fixture defect. The vacuity guard is what stops the narrowing from emptying the
   * test: it counts WARD acceptances, so a seed that lost them all fails here by name.
   */
  it("every accepted referral's acceptedUnitId is a unit referralEligibility actually says yes to", () => {
    const accepted = referrals.filter(
      (referral) =>
        referralState(referral) === "accepted" && acceptedAddressing(referral)!.destination.kind === "psychiatric_ward",
    );
    expect(accepted.length).toBeGreaterThan(0);
    for (const referral of accepted) {
      const unit = unitById(acceptedAddressing(referral)!.acceptedUnitId!);
      expect(
        unit,
        `${referral.id} acceptedUnitId ${acceptedAddressing(referral)?.acceptedUnitId} does not resolve to a real unit`,
      ).toBeDefined();
      const verdict = referralEligibility(referral, wardOf(referral).destination, unit!, NOW_ANCHOR);
      expect(
        verdict.eligible,
        `${referral.id} is recorded accepted at ${unit!.name} but referralEligibility refuses it: ${JSON.stringify(verdict.gates.filter((g) => !g.pass))}`,
      ).toBe(true);
    }
  });
});

/**
 * Task 1's privacy discipline, from the binding phase spec: a referral carries exactly five
 * facts about the person referred — `ageBand`, `sex`, `secureBedNeeded`, `involuntaryBedNeeded`,
 * `homeRegion` — and nothing else. No free text anywhere, unlike `Decline` (which carries an
 * optional `note`). Following the Phase 4/5 pattern (`tests/ward-flow-reducer.test.ts`'s
 * `BedRelease` allowlist, `tests/ward-bed-availability-model.test.ts`'s `LeaveBed` allowlist): an
 * ALLOWLIST of the exact field set, checked against the type's own shape via a fully-populated
 * canonical instance — never against what a single partial fixture entry happens to show — so a
 * future field named `patientId`, `notes`, `diagnosis` or `dob` is caught rather than merely
 * discouraged.
 *
 * `involuntaryBedNeeded` was added mid-build, deliberately, once (Task 2, "A fifth answer, given
 * mid-build") and `homeRegion` a second time in Phase 7 fix round B (this task, "A sixth answer,
 * given mid-build") — both recorded in `docs/ward-flow-phase-6-7-decisions.md`. This list widens
 * from four to five fields here on purpose; widening it again is a governance decision, not an
 * implementation one, and this test is what makes that true rather than aspirational.
 *
 * H3 fix (this task): the canonical-literal test below is real, but it is checked by TypeScript,
 * not by this test — `Required<Referral>` forces the literal to supply every field, so an extra
 * field added to `Referral` and left off the literal is a COMPILE error, invisible to `vitest run`
 * (vitest does not typecheck). `npm run test:focused` on this file, which is what an implementer
 * runs while working, could not fail on a new field — confirmed twice by two different people
 * before this fix. The "runtime companion" test after it closes that gap by building a REAL
 * referral through the reducer's own `RECEIVE_REFERRAL` write path and checking its keys under
 * plain vitest, no `tsc` involved. Both halves are kept, deliberately: the canonical-literal test
 * is the exhaustive, type-checked half (catches a missing field, under `tsc` only); the
 * reducer-built test is the runtime half (catches a field the reducer actually starts WRITING,
 * under vitest, which is the shape I2's fix and the intake-form risk both describe).
 *
 * ⚠️ CAVEAT AN ADVERSARIAL REVIEW SURFACED: BOTH HALVES BITE ON POPULATION, NOT DECLARATION.
 * Every assertion below reads `Object.keys()` of a runtime object — the canonical literal, or a
 * `Referral` the reducer actually built — never the `Referral` TYPE itself. So a field added to
 * the type alone, with nothing anywhere that ever SETS it, changes what TypeScript allows and
 * changes nothing this guard can see: `Required<Referral>` forces the canonical literal to supply
 * every declared field (a `tsc` failure, covered above), but nothing here goes red until some code
 * path actually writes a value into that field on a real referral. That is a defensible line — an
 * unwritten field carries no data and leaks nothing on its own — but it means "add a field to the
 * type and this guard catches it" is the wrong mental model. The guard catches the WRITE, not the
 * DECLARATION, and the gap between the two is exactly as wide as the code that never got written.
 */
describe("Referral privacy — structural", () => {
  const ALLOWED_REFERRAL_FIELDS = [
    "id",
    /*
     * ⚠️ ADDED 2026-09-02 BY OWNER RULING, AND THIS LIST'S OWN PROSE FORBIDS IT — WHICH IS WHY THE
     * DECISION IS RECORDED HERE RATHER THAN LEFT TO BE INFERRED FROM THE CODE.
     *
     * Until this date a `Referral` carried NO link to a person, and `patientId` was named in this
     * guard's own commentary as an example of exactly what it existed to catch. The owner ruled
     * otherwise — "Yes to the referral remembering its patient" — and confirmed it directly to
     * Ward Builder Two before a line was written, because the comment above says in terms that
     * widening this list is a GOVERNANCE decision and not an implementation one.
     *
     * ⚠️ THE NEXT PERSON TO READ THIS MEETS A FIELD THE SURROUNDING PROSE REFUSES. It was a
     * decision, not a leak.
     *
     * ⚠️ AND IT IS A POINTER, NOT A COPY. `patientId` alone. No name, date of birth, record number,
     * address or diagnosis followed it, and the assertions below still fail on every one of them —
     * adding a member is not relaxing the guard. A `patientName` stored beside this id "for
     * convenience" would pass a list-membership check and destroy the reason for the list.
     */
    "patientId",
    "ageBand",
    // 2026-08-30, destination union. `sex`, `secureBedNeeded` and `involuntaryBedNeeded` left this
    // list and now sit on the ward arm inside `destination`. That is a MOVE, not a narrowing, and
    // on its own it would have punched a hole straight through this guard: `destination` is one
    // permitted key, and nothing here looks inside it, so a `notes` or `diagnosis` field added to
    // an arm would pass every assertion in this block. `ALLOWED_DESTINATION_FIELDS` below closes
    // that, and is checked for every referral the same way this list is.
    "destinations",
    "homeRegion",
    "source",
    "raisedAt",
    // Operational, not a person fact: whether this department has finished the MEDICAL workup.
    // It says nothing about who the patient is, what is wrong with them, or where they live — the
    // three things this allowlist exists to keep off a referral.
    "medicalClearance",
    "urgency",
    "originSiteCode",
    "transportNeeded",
    // `state`, `acceptedUnitId`, `declineReason`, `decidedAt` and `decidedBy` left this list on
    // 2026-08-30 and moved onto each destination (FD-21) -- with several destinations there is no
    // longer one thing to decide. They are checked by ALLOWED_ADDRESSING_FIELDS below, not dropped:
    // a decision field that lost its guard is exactly the hole this block exists to prevent.
    // Phase 8 Task 2 widened this list by two; Task 2R NARROWED IT BACK BY ONE. `arrivedAt` is
    // gone from `Referral` entirely — a referral no longer records arriving anywhere, because
    // `Admission` (`ward-admissions.ts`) is the one record of a person occupying a bed and it is
    // the only thing that closes. Removing the entry here is a TIGHTENING: this list is compared
    // for exact equality against a `Required<Referral>` literal below, so leaving a stale
    // `"arrivedAt"` in it would fail rather than quietly permit a field, and the literal itself
    // stops compiling if the field is not also dropped there. Nothing was loosened to make the
    // removal pass.
    //
    // `localBedSought` STAYS. It answers a different question — that somebody looked for a bed
    // closer to home, at a time, by a ROLE — which no admission records and Task 2R does not
    // touch. It is a fact about the REFERRAL, in the same operational family as `raisedAt`,
    // `decidedAt` and `decidedBy`, which is why it does not widen the five person-facts this type
    // holds, and why `homeAddress`, `notes` or `diagnosis` still fails here. It deliberately has
    // no note, reason or outcome field; the runtime companion below drives that write path so a
    // reducer that started writing one anyway fails under plain vitest, with no `tsc` step.
    "localBedSought",
    // 2026-08-30. Widened by one, deliberately, and the note above is why this needs its own
    // sentence rather than a quiet append: Task 2R REMOVED an `arrivedAt` from this type, and this
    // is not that field coming back. That one meant arriving at a BED, and `Admission` owns it.
    // `triagedAt` is arriving in the DEPARTMENT — a different event, at a different place, for a
    // person who may never get a bed at all, and it starts the second of the two clocks the owner
    // asked for in `P9-D2`. A reader who sees an arrival instant here and remembers the deletion
    // should find the distinction stated rather than have to reconstruct it.
    //
    // It does not widen the person facts this type holds. Like `raisedAt`, `decidedAt` and
    // `localBedSought` it is operational: it says where a body is and when, never who they are.
    // `homeAddress`, `notes` and `diagnosis` still fail here exactly as before.
    //
    // CORRECTED 2026-09-12: this sentence named `patientId` and was FALSE THE DAY IT WAS TYPED.
    // `patientId` is on the allowlist a few lines above -- owner ruling 2026-09-02 -- and on the
    // canonical Required<Referral> literal below. The wording was copied from its twin of
    // 2026-08-30, which was true then and had stopped being true ten days before the copy.
    // A privacy sentence listing a field it does not refuse claims a stronger guarantee than the
    // type gives, and the field it wrongly named is the one that links a referral to a person.
    //
    // Provenance: owner ruling RELAYED via the orchestrator (`P9-F3`), not heard first-hand by the
    // session that built it — recorded that way because `R55` exists precisely to stop a relay
    // hardening into "(OWNER)" once it has been written down twice.
    "triagedAt",
    // 2026-09-07. Widened by one, and it needs its own sentence for the same reason `triagedAt`
    // did: Task 2R removed an `arrivedAt` from this type and this is not that field returning.
    // That one meant arriving at a BED, which `Admission` owns; `TransportJob.arrivedAt` still
    // exists for a transport leg ending. This is the ED psychiatry team RECORDING that a person is
    // physically in the department — the door an "expect" walks through to become a referral
    // (product owner, 2026-09-07). Deliberately not named `arrivedAt`, because a third meaning for
    // one word would collide with a live field and read as reversing a deliberate deletion.
    //
    // It does not widen the person facts this type holds. Like `raisedAt`, `triagedAt` and
    // `localBedSought` it is operational: it says where a body is and when, never who they are.
    // `homeAddress`, `notes` and `diagnosis` still fail here
    // (`patientId` does NOT -- see the correction on the `sendingTeamName` entry below; this
    // sentence carried it wrongly in all three of its copies) exactly as before.
    "inDepartmentAt",
    // 2026-09-12. Widened by one, and it needs its own sentence for the same reason `triagedAt`
    // and `inDepartmentAt` did. Owner, asked directly: "Should a referral record which team or
    // service sent it, not just which hospital?" -- "Yes it should."
    //
    // IT DOES NOT WIDEN THE PERSON FACTS THIS TYPE HOLDS, and the distinction is the whole reason
    // it is permitted: it names the SENDER, an organisation, never the person referred. Like
    // `source`, `originSiteCode` and `raisedAt` it is operational -- where the referral came from,
    // not who the patient is. `homeAddress`, `notes` and `diagnosis` still fail here
    // (`patientId` does NOT -- see the correction on the `sendingTeamName` entry below; this
    // sentence carried it wrongly in all three of its copies)
    // exactly as before.
    //
    // AND IT IS NOT A REFERRER. `referral-referrer.ts` answers WHO, a person, and D-12 forbids an
    // organisation standing in a field labelled as one. A service is not a human being;
    // `tests/ward-referral-sending-team.test.ts` fails if `referralReferrerName` starts reading it.
    "sendingTeamName",
    // 2026-08-30, and the second widening in one night — which is exactly the pace this list exists
    // to slow down, so it gets its own reason rather than riding on the one above.
    //
    // `CM-4`: the SUBURB is the recorded fact. It is the coarsest fact the owner's catchment
    // documents are keyed on and the finest one that is stable, so it survives whichever way the
    // five deferred catchment questions are answered. `PD-3` is what lets it through this guard at
    // all: ⚠️ **a suburb is not an address** — it names a service area, not a dwelling. `address`
    // remains UNRULED and still fails here, and a ruling permitting a suburb must never be read as
    // permitting the category.
    //
    // Resolved against the catchment table by `RECEIVE_REFERRAL`, never checked for non-emptiness:
    // "12 Wellington St, Perth" is a non-empty string and a length check would have put the very
    // thing this field is coarser than into the field itself.
    "suburb",
    /*
     * ⚠️ THE WRITTEN HISTORY — 2026-09-05, OWNER INSTRUCTION, AND THE LARGEST WIDENING THIS LIST
     * HAS EVER TAKEN. Recorded here at length because the prose above forbids exactly this.
     *
     * Every other member of this list is a closed union, a boolean, a code or an id. These three
     * are **whatever a person typed**. The list's own commentary says its job is to keep "who the
     * patient is, what is wrong with them, and where they live" off a referral — and a free-text
     * clinical history can contain all three, by design, because that is what a referral is for.
     *
     * ⚠️ **SO THIS GUARD NO LONGER PROVES WHAT IT USED TO PROVE.** Before today, membership in
     * this list was very nearly a privacy proof: nothing on a `Referral` could hold a name because
     * no field had a shape that could. That is over. The list still does a real job — it stops a
     * `patientName`, an `address` or a `diagnosis` field appearing, and it still fails on every one
     * of them — but it can no longer be cited as evidence that a referral holds no identifying
     * text. **Anyone quoting this guard in a privacy argument must say which half it covers.**
     *
     * ⚠️ **THREE FLAT KEYS, NOT ONE NESTED `history` OBJECT, AND THAT IS A DECISION ABOUT THIS
     * GUARD.** A `history: {...}` object would be one permitted member with an unchecked shape
     * behind it — precisely the hole that opened when the decision fields moved inside
     * `destinations` and needed `ALLOWED_ADDRESSING_FIELDS` and `ALLOWED_DESTINATION_FIELDS` to
     * close. A flat key is a thing this list names out loud, and a second history field cannot
     * appear without failing here.
     *
     * ⚠️ **THIS WAS THREE MEMBERS UNTIL THE OWNER'S RULING OF 2026-09-05** — one story box,
     * optional — which collapsed `historyWhyNow`, `historyBackground` and `historyRiskAndSafety`
     * into one `history`. The list shrinking is the ruling landing; **a list shrinking on its own
     * would be a field leaving the guard**, which is why the count is asserted rather than the
     * membership being spot-checked.
     *
     * The countervailing control is that nothing may READ it: no gate, no ranking, no derivation.
     * That is stated on `Referral.history` and enforced by the probes in
     * `ward-board-derivations.ts` and `referral-destination-options.ts`, which pass `""`.
     */
    "history",
    /*
     * RB7, build plan item 27 (2026-09-17). A SECOND free-text member joins this list, and it is
     * kept apart from `history` on purpose rather than folded into it — see `Referral.corrections`'s
     * own doc comment. Each entry is a typed note ATTRIBUTED to a role and a time; nothing here
     * widens the three person-facts this list's own prose forbids (`homeAddress`, `notes` and
     * `diagnosis` still fail here exactly as before), and `ALLOWED_CORRECTION_FIELDS` below closes
     * the same one-level-down hole `ALLOWED_ADDRESSING_FIELDS` already closes for `destinations`: an
     * unguarded object behind one permitted key.
     */
    "corrections",
    // 2026-09-17, T15 (item 12, owner answer 17 September 2026): "An admission from a referral
    // carries the referral's broad diagnosis category, marked tentative." A GOVERNANCE decision,
    // stated explicitly rather than left to be inferred — this list's own prose elsewhere still
    // says "diagnosis" fails here, and this is the one named exception to it, the same shape
    // `patientId` and `sendingTeamName` above each record their own widening. `tentativeDiagnosis`
    // is one of eleven ICD-10-AM Chapter V BLOCK codes (`TENTATIVE_DIAGNOSIS_BLOCKS`,
    // `ward-diagnosis.ts`), never a free-text diagnosis — `homeAddress` and `notes` still fail
    // here exactly as before, and a `diagnosisDetail` or a specific condition code would too.
    "tentativeDiagnosis",
    // 2026-09-17, T12 (item 9, owner answer 9): "Non-binary patient: coordinator places with a
    // recorded reason after checking with the ward, preferring a single room." Another named
    // governance exception, the same shape as `tentativeDiagnosis` immediately above:
    // `genderPlacements` holds ONLY a role, an instant, unit ids and a chosen reason from
    // `GENDER_PLACEMENT_REASONS` — never free text, never a name — so `homeAddress` and `notes`
    // still fail here exactly as before.
    "genderPlacements",
    // Ward-to-ward stepdown transfer: originUnitId identifies the transferring ward.
    "originUnitId",
  ].sort();

  /**
   * The permitted fields on ONE correction entry (`Referral.corrections[number]`) — the same
   * one-level-down guard `ALLOWED_ADDRESSING_FIELDS` already is for `destinations`, so a `note`
   * field gaining a stray extra key (a person's name, say) cannot pass merely by `corrections`
   * itself being on the outer list.
   */
  const ALLOWED_CORRECTION_FIELDS = ["at", "by", "note"].sort();

  /**
   * The permitted field set INSIDE each destination arm.
   *
   * Keyed by every member of `REFERRAL_DESTINATION_KINDS`, and the first test below fails if a
   * kind is ever added without an entry here — an unlisted arm would otherwise be an arm nothing
   * checks, which is the same silent hole the outer list exists to prevent, one level down.
   *
   * The three arms that carry only `kind` carry only `kind` ON PURPOSE. An ED, a medical ward and
   * a community team are asked a question no bed property answers, so a `secureBedNeeded`
   * appearing on one of them is not a widening of privacy but a category error — and this is what
   * makes "a community team is never asked about bed security" a fact about the type rather than
   * something a screen remembers.
   */
  /**
   * The permitted fields on the WRAPPER around a destination — where the decision now lives.
   *
   * A third level, and it exists for the same reason as the second. When the five decision fields
   * moved off `Referral`, `destinations` became one permitted key holding objects nothing checked;
   * a `notes` or `patientId` added to `ReferralAddressing` would have passed both the outer list
   * and the arm list, because neither looks here.
   */
  const ALLOWED_ADDRESSING_FIELDS = [
    "destination",
    "state",
    "decidedAt",
    "decidedBy",
    "declineReason",
    "acceptedUnitId",
  ].sort();

  const ALLOWED_DESTINATION_FIELDS: Record<ReferralDestinationKind, string[]> = {
    // WIDENED ON PURPOSE, 2026-09-10 — owner ruling: high-acuity nursing is marked by the
    // REFERRING CLINICIAN at referral. Like `secureBedNeeded` and `involuntaryBedNeeded` beside
    // it, and unlike `sex`, it is a fact about the REQUEST and never one stored about the person,
    // so the governed facts-about-a-person set is unchanged at three.
    //
    // WIDENED AGAIN, 2026-09-17, T10 (item 8, owner answer 17 September 2026): `gender`, the fact
    // recorded AT REFERRAL that the `gender_designation` gate now checks — a fourth, SEPARATE fact
    // about the person, deliberately wider than `sex` (see `ReferralGender`'s own doc comment,
    // `ward-model.ts`, for why it carries a third value `sex` cannot).
    psychiatric_ward: [
      "kind",
      "sex",
      "gender",
      "secureBedNeeded",
      "involuntaryBedNeeded",
      "highAcuityNursingNeeded",
    ].sort(),
    emergency_department: ["kind", "edId", "purpose"].sort(),
    community_team: ["kind", "teamName"].sort(),
  };

  /**
   * ⚠️ TIED TO THE TYPE, BECAUSE THE HAND-WRITTEN LIST WENT STALE AND NOTHING FAILED.
   *
   * `ALLOWED_DESTINATION_FIELDS.emergency_department` read `["kind"]` for hours after the arm
   * gained `edId` and `purpose` (FD-15/FD-11), and the whole ward suite stayed green — 93 files,
   * 1311 tests. The runtime check below walks real referrals' destinations, and **no seeded
   * referral has an ED destination**, so that arm's list was never compared with anything. A guard
   * with nothing to inspect does not report that it inspected nothing; it reports a pass.
   *
   * `Required<Extract<...>>` forces each literal to supply every field its arm declares, so the
   * key set below IS the type's field set rather than somebody's memory of it. A field added to an
   * arm now fails to compile here until the list moves with it — whether or not any fixture
   * happens to exercise that arm.
   */
  it("⚠️ MATCHES THE TYPE ITSELF, not just whatever the fixture happens to contain", () => {
    const canonicalWard: Required<Extract<ReferralDestination, { kind: "psychiatric_ward" }>> = {
      kind: "psychiatric_ward",
      sex: "Female",
      gender: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    };
    const canonicalEd: Required<Extract<ReferralDestination, { kind: "emergency_department" }>> = {
      kind: "emergency_department",
      edId: "peel-ed",
      purpose: "psychiatric_review",
    };
    const canonicalCommunity: Required<Extract<ReferralDestination, { kind: "community_team" }>> = {
      kind: "community_team",
      teamName: "Inner City Clinic",
    };

    for (const canonical of [canonicalWard, canonicalEd, canonicalCommunity]) {
      expect(
        Object.keys(canonical).sort(),
        `${canonical.kind}'s allowed-field list no longer matches the arm it guards. Move the list ` +
          "with the type: a stale entry here understates the arm and CANNOT fail through the " +
          "runtime walk below, because no fixture need contain that arm at all.",
      ).toEqual([...ALLOWED_DESTINATION_FIELDS[canonical.kind]].sort());
    }
  });

  it("guards every destination kind that exists, so a new arm cannot arrive unchecked", () => {
    expect([...REFERRAL_DESTINATION_KINDS].sort()).toEqual(Object.keys(ALLOWED_DESTINATION_FIELDS).sort());
    // And the guard discriminates: the ward arm permits more than the others, so a single shared
    // list could not be standing in for all four.
    expect(ALLOWED_DESTINATION_FIELDS.psychiatric_ward.length).toBeGreaterThan(
      ALLOWED_DESTINATION_FIELDS.community_team.length,
    );
  });

  it("keeps a bed property off every arm that is not a bed", () => {
    for (const kind of REFERRAL_DESTINATION_KINDS) {
      if (kind === "psychiatric_ward") continue;
      for (const bedProperty of ["sex", "gender", "secureBedNeeded", "involuntaryBedNeeded"]) {
        expect(
          ALLOWED_DESTINATION_FIELDS[kind],
          `${kind} would be permitted to carry ${bedProperty}. Capacity, sex mix, security and ` +
            "authorisation are properties of a BED; an arm answered by a person or a team has no " +
            "such property, and permitting one here is how a screen comes to ask a community team " +
            "whether it has a secure bed.",
        ).not.toContain(bedProperty);
      }
    }
  });

  it("a fully-populated Referral (every optional field set) has exactly the allowed field set", () => {
    // `Required<Referral>` forces this literal to supply every field the type has, including the
    // optional ones — so its key set is the type's COMPLETE field set, not a subset any one real
    // (partly-decided) referral would show. TYPE-CHECKED half of the guard — see this describe
    // block's own doc comment for why a runtime companion follows.
    const canonical: Required<Referral> = {
      // The pointer, present here because `Required<Referral>` forces every field to be
      // supplied — which is what makes this literal a guard rather than a sample.
      patientId: "PT-A1",
      id: "REF-CANON",
      // Present because `Required<Referral>` demands every optional field. ⚠️ On a REAL referral
      // its absence means nobody has assessed clearance — NOT "not cleared" — so this literal is
      // the one place the field appears without carrying that distinction.
      medicalClearance: { cleared: true, at: 0 },
      ageBand: "Adult",
      destinations: [
        // Fully populated, including every optional field, for the same reason the outer literal is:
        // this is the exhaustive half of the guard and it has to reach the fields it is guarding.
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            gender: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "accepted",
          acceptedUnitId: "rph-adult-secure",
          declineReason: "no_suitable_bed",
          decidedAt: NOW_ANCHOR + 5,
          decidedBy: "Flow coordinator",
        },
      ],
      homeRegion: "Perth Metropolitan",
      source: "community",
      // Present because `Required<Referral>` demands every optional field. On a REAL referral its
      // absence means no sending team was recorded -- a police or ambulance referral legitimately
      // has none -- so this literal is another place the field appears without that distinction.
      sendingTeamName: "Armadale Community Mental Health Service",
      raisedAt: NOW_ANCHOR,
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
      // A role, never a person — and no note, reason or outcome field exists to populate.
      localBedSought: { at: NOW_ANCHOR + 2, by: "coordinator" },
      // Before `raisedAt`: this canonical referral is somebody already in the department when
      // mental health was called, which is the case where BOTH clocks run.
      triagedAt: NOW_ANCHOR - 90,
      // Later than triage and that ordering is deliberate, not decorative: this canonical referral
      // is somebody triaged and then observed still present. A value EARLIER than `triagedAt` would
      // assert somebody was recorded in the department before being triaged, which is possible in
      // reality and would make this literal a worse example of the ordinary case.
      inDepartmentAt: NOW_ANCHOR - 80,
      // A real suburb from the catchment table, for the same reason the ED arm's `edId` is a real
      // department: this literal is the exhaustive half of the guard and a fictional value here
      // would be a fixture the front door itself would refuse.
      suburb: { kind: "named", name: "Armadale" },
      // RB7 (build plan item 27, 2026-09-17). Present because `Required<Referral>` demands every
      // optional field; on a REAL referral its absence means nobody has ever added a correction.
      corrections: [{ at: NOW_ANCHOR + 10, by: "coordinator", note: "A canonical correction note." }],
      // T15 (item 12): present because `Required<Referral>` demands every optional field — a real
      // block code from `TENTATIVE_DIAGNOSIS_BLOCKS`, never a fictional one, for the same reason
      // `suburb` above is real.
      tentativeDiagnosis: "F30–F39",
      // T12 (item 9): present because `Required<Referral>` demands every optional field — a real
      // reason from `GENDER_PLACEMENT_REASONS`, for the same reason `suburb` and
      // `tentativeDiagnosis` above are real.
      genderPlacements: [
        {
          at: NOW_ANCHOR,
          by: "coordinator",
          unitIds: ["rph-adult-secure"],
          reason: GENDER_PLACEMENT_REASONS[0],
          // Ward Lead's Opus review of T12, 17 September 2026: the tick is now its own stored
          // field on `GenderPlacement`, never implied by the reason text.
          wardChecked: true,
        },
      ],
      originUnitId: "rph-adult-secure",
    };
    expect(Object.keys(canonical).sort()).toEqual(ALLOWED_REFERRAL_FIELDS);
    // Exact equality on the arm as well: `Required<Referral>` forces every OUTER field to be
    // supplied, but it says nothing about the fields inside `destination`, so without this the
    // exhaustive half of the guard would stop being exhaustive exactly where the union begins.
    expect(Object.keys(canonical.destinations[0].destination).sort()).toEqual(
      ALLOWED_DESTINATION_FIELDS.psychiatric_ward,
    );
    // And the wrapper's own fields, which is where the decision moved to.
    expect(Object.keys(canonical.destinations[0]).sort()).toEqual(ALLOWED_ADDRESSING_FIELDS);
    // And one correction entry's own fields, the same one-level-down discipline as the two checks
    // above — an unguarded object behind `corrections` would otherwise let a stray key through.
    expect(Object.keys(canonical.corrections[0]).sort()).toEqual(ALLOWED_CORRECTION_FIELDS);
  });

  it("gives every real referral in the fixture only keys drawn from that same allowed set", () => {
    expect(referrals.length).toBeGreaterThan(0);
    for (const referral of referrals) {
      for (const key of Object.keys(referral)) {
        expect(ALLOWED_REFERRAL_FIELDS).toContain(key);
      }
      // The arm too, or `destination` would be a permitted key with an unchecked object behind it.
      for (const addressing of referral.destinations) {
        for (const key of Object.keys(addressing)) {
          expect(
            ALLOWED_ADDRESSING_FIELDS,
            `${referral.id}'s ${addressing.destination.kind} addressing carries "${key}"`,
          ).toContain(key);
        }
        for (const key of Object.keys(addressing.destination)) {
          expect(
            ALLOWED_DESTINATION_FIELDS[addressing.destination.kind],
            `${referral.id}'s ${addressing.destination.kind} arm carries "${key}"`,
          ).toContain(key);
        }
      }
    }
  });

  /**
   * RUNTIME half of the guard (H3 fix) — see this describe block's own doc comment. Built through
   * `RECEIVE_REFERRAL`, the real write path a future intake form (Task 4) will use, rather than a
   * hand-built object: if that path is ever extended to accept and store a sixth fact — the exact
   * failure scenario I2 closes, a text field whose value lands on a live referral — this test
   * fails under plain `vitest run`, with no `tsc` step required, because the new key would not be
   * a member of `ALLOWED_REFERRAL_FIELDS`.
   */
  it("a referral the reducer actually builds carries only keys drawn from the allowed set (runtime companion to the type-checked guard above)", () => {
    const state = seedWardFlowState();
    const after = wardFlowReducer(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    expect(after.rejections).toEqual([]);
    const created = after.referrals.at(-1)!;
    for (const key of Object.keys(created)) {
      expect(ALLOWED_REFERRAL_FIELDS).toContain(key);
    }
  });

  /**
   * Phase 8 Task 2 — the SAME runtime half, extended to the write path that task added. Task 2R
   * removed the other one: `REFERRAL_ARRIVED` no longer exists, so the arrival half of this test
   * went with it rather than being kept as a test of nothing.
   *
   * The type-checked guard above cannot fail under `vitest run` (`Required<Referral>` is checked
   * by `tsc`, and vitest does not typecheck), so widening the allowlist without this would have
   * recorded the new field as deliberate while proving nothing at runtime about what the reducer
   * actually writes. This event is exactly where an extra key would appear: a local-bed record
   * that grew a note or an outcome would fail here by key name under plain vitest.
   */
  it("a referral the reducer records a local bed search against carries only keys drawn from the allowed set", () => {
    const seeded = seedWardFlowState();

    const queued = seeded.referrals.filter(
      (referral) => referralState(referral) === "queued" && referral.localBedSought === undefined,
    );
    expect(queued.length, "the seed holds no queued referral without a local-bed record").toBeGreaterThan(0);
    const sought = wardFlowReducer(seeded, {
      type: "RECORD_LOCAL_BED_SOUGHT",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: queued[0].id,
    });
    expect(sought.rejections).toEqual([]);
    const afterSearch = sought.referrals.find((referral) => referral.id === queued[0].id)!;
    // A role and a time, and nothing else — no note, no reason, no outcome.
    expect(Object.keys(afterSearch.localBedSought!).sort()).toEqual(["at", "by"]);
    for (const key of Object.keys(afterSearch)) {
      expect(ALLOWED_REFERRAL_FIELDS).toContain(key);
    }
  });
});

/**
 * Task 5 (Phase 7, "The front door"): pure-function coverage for the board/match-view
 * derivations in `ward-referrals.ts`. `referral-board.tsx`/`referral-match.tsx` themselves are
 * covered by the DOM suite (`tests/ward-referral-screens.dom.test.tsx`); this file covers the
 * logic those components render, independent of React.
 */
describe("Task 5 — referral board ordering (referralQueueOrder, recentlyDecidedReferrals)", () => {
  it("orders the real fixture's queued referrals by urgency, then by longest wait — RF-001 (raised 40 min ago) before RF-005 (raised 20 min ago), both tier 2", () => {
    const queuedIds = referralQueueOrder(referrals).map((referral) => referral.id);
    // RF-009 joined the fixture on 2026-08-30 as the FIRST referral addressed to an emergency
    // department — before it, the ED hub's inbox was empty for every department and its screen was
    // indistinguishable from a working one with nothing to show. It is queued and urgency 2, so it
    // sorts by wait: raised 35 minutes ago, after RF-001 (40) and before RF-005 (20).
    // RF-011 joined 2026-09-02 as the seed's one multi-destination referral (`{psychiatric_ward,
    // emergency_department}`, FD-23's demonstration fixture — see `ward-movements.ts`). It is
    // urgency 3, the lowest tier, specifically so it sorts LAST here rather than disturbing the
    // three tier-2 referrals' relative order above.
    // RF-014 and RF-015 joined 2026-09-07 as the seed's two EXPECTS — referred to an emergency
    // department and not yet arrived, which this fixture could not previously express at all. Both
    // took urgency 3 for the reason RF-011 did, stated above: the lowest tier sorts last and leaves
    // the three tier-2 referrals' relative order untouched. Within that tier they sort by wait,
    // which is why RF-015 (raised 4,500 minutes ago, deliberately past the owner's 72-hour
    // reconsider threshold) precedes RF-014 (150), and both precede RF-011.
    expect(queuedIds).toEqual(["RF-001", "RF-009", "RF-005", "RF-015", "RF-014", "RF-011"]);
  });

  it("never includes an accepted or declined referral in the queued order", () => {
    const queued = referralQueueOrder(referrals);
    // M4 (fix round C): `.every()` on an EMPTY array is `true`, so `filter(() => false)` — which
    // drops every referral including the queued ones — passed this test untouched. The sibling
    // test above catches that by pinning `["RF-001","RF-005"]`, but this guard proved nothing on
    // its own. A non-empty result is what makes the `every` mean anything.
    expect(queued.length).toBeGreaterThan(0);
    expect(queued.every((referral) => referralState(referral) === "queued")).toBe(true);
  });

  /**
   * Urgency must win over wait time even when wait time alone would suggest the opposite order —
   * otherwise a test built only from fixture data that happens to already agree on both keys
   * could pass with either key driving the sort alone. A synthetic pair proves urgency is the
   * primary key: the tier-1 referral raised MOST RECENTLY still sorts before the tier-3 referral
   * raised LONGEST ago.
   */
  it("ranks a more urgent, more recently raised referral ahead of a less urgent, longer-waiting one", () => {
    const urgentRecent: Referral = { ...referrals[0], id: "RF-SYNTH-URGENT", urgency: 1, raisedAt: NOW_ANCHOR - 5 };
    const calmOld: Referral = { ...referrals[0], id: "RF-SYNTH-CALM", urgency: 3, raisedAt: NOW_ANCHOR - 500 };
    const ordered = referralQueueOrder([calmOld, urgentRecent]).map((referral) => referral.id);
    expect(ordered).toEqual(["RF-SYNTH-URGENT", "RF-SYNTH-CALM"]);
  });

  it("orders the real fixture's decided referrals most-recently-decided first", () => {
    const decided = recentlyDecidedReferrals(referrals);
    expect(decided.length).toBeGreaterThan(0);
    expect(decided.every((referral) => referralState(referral) !== "queued")).toBe(true);
    const decidedAts = decided.map((referral) => referralDecidedAt(referral));
    const sorted = [...decidedAts].sort((a, b) => (b ?? -Infinity) - (a ?? -Infinity));
    expect(decidedAts).toEqual(sorted);
  });
});

describe("Task 5 — referral wait label (referralWaitLabel)", () => {
  it("renders a plain elapsed-wait duration, never a countdown/overdue phrasing", () => {
    const referral: Referral = { ...referrals[0], raisedAt: NOW_ANCHOR - 65 };
    expect(referralWaitLabel(referral, NOW_ANCHOR)).toBe("1h 05m waiting");
  });
});

describe("Task 5 — match view failure branches (referralCandidates, matchReason, networkHasCohort, hasConfirmedCapacity)", () => {
  const units = allUnits();

  /**
   * RF-001 in the real fixture: Youth, Female, secureBedNeeded true. The network's one Youth
   * unit (EMyU, `bty-youth`) is Open, not Secure — so RF-001 fails the age gate everywhere except
   * EMyU, and fails the security gate at EMyU itself. Zero units accept it, on the real,
   * unmodified fixture — a genuine "no bed accepts" case, not a fabricated one.
   */
  it("RF-001: no bed accepts, and the full network is still listed — never a truncated or empty candidate list", () => {
    const referral = referrals.find((candidate) => candidate.id === "RF-001")!;
    const candidates = referralCandidates(referral, wardOf(referral).destination, units, NOW_ANCHOR);
    expect(candidates).toHaveLength(units.length);
    const accepting = candidates.filter((candidate) => candidate.verdict.eligible);
    expect(accepting).toHaveLength(0);
    // Every declining unit still carries its own real reason — never a blank.
    for (const candidate of candidates) {
      expect(matchReason(candidate).length).toBeGreaterThan(0);
    }
  });

  it("RF-001's age band (Youth) genuinely exists in the network — the real fixture's own zero-match case is operational (security), not structural", () => {
    const referral = referrals.find((candidate) => candidate.id === "RF-001")!;
    expect(networkHasCohort(referral, units)).toBe(true);
  });

  it("a synthetic age band with no unit anywhere in the network is reported as a structural gap, distinct from the operational 'no bed accepts' case", () => {
    const referral: Referral = { ...referrals[0], ageBand: "Youth" };
    const unitsWithNoYouthBed = units.filter((unit) => unit.cohort !== "Youth");
    expect(networkHasCohort(referral, unitsWithNoYouthBed)).toBe(false);
    // Non-vacuity: the same referral against the REAL, unmodified network does have a Youth unit.
    expect(networkHasCohort(referral, units)).toBe(true);
  });

  it("a forensic bed is excluded from every accepting list, for every real referral in the fixture", () => {
    // Every referral's cohort, sex, security and legal-status requirements differ — a forensic
    // unit whose OWN cohort does not match a given referral fails the `age` gate first, never
    // reaching the `forensic` gate at all (gates are evaluated in a fixed order, and only the
    // FIRST failing one is ever shown as "the" reason). This test asserts the one thing that is
    // true regardless of gate order: a forensic unit is NEVER eligible and NEVER in the accepting
    // list, for any referral. The next test below proves the forensic gate's own wording
    // specifically, for the one referral shape where it is genuinely the first gate to fail.
    // Narrowed to referrals that ASK for a ward, since 2026-08-30: `RF-009` addresses an emergency
    // department and has no ward arm at all, so `wardOf` would throw rather than fail. The canary
    // below matters more than the narrowing — a filter that matched nothing would leave this loop
    // asserting about an empty list and passing.
    const wardReferrals = referrals.filter((referral) =>
      referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward"),
    );
    expect(wardReferrals.length, "no seeded referral asks for a ward, so this proves nothing").toBeGreaterThan(1);
    for (const referral of wardReferrals) {
      const candidates = referralCandidates(
        referral,
        wardOf(referral).destination,
        withMadeUpForensicWard(units),
        NOW_ANCHOR,
      );
      const forensicCandidates = candidates.filter((candidate) => candidate.unit.forensic);
      expect(forensicCandidates.length).toBeGreaterThan(0);
      for (const candidate of forensicCandidates) {
        expect(candidate.verdict.eligible).toBe(false);
      }
      const acceptingIds = candidates.filter((candidate) => candidate.verdict.eligible).map((c) => c.unit.id);
      const forensicIds = forensicCandidates.map((candidate) => candidate.unit.id);
      expect(acceptingIds.some((id) => forensicIds.includes(id))).toBe(false);
    }
  });

  it("a forensic bed's stated reason names the forensic exclusion when every earlier gate would otherwise pass", () => {
    const forensicUnit = madeUpForensicWard();
    // Matches the forensic unit's own cohort/security/authorisation exactly, and needs neither a
    // secure nor an involuntary bed — every gate ahead of `forensic` in evaluation order (age,
    // legal_status, sex_designation) passes, so `forensic` is genuinely the first gate to fail,
    // and the reason text this referral sees is the forensic gate's own wording, not a stand-in.
    const referral: Referral = {
      ...referrals[0],
      ageBand: forensicUnit.cohort,
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "queued",
        },
      ],
    };
    const [candidate] = referralCandidates(referral, wardOf(referral).destination, [forensicUnit], NOW_ANCHOR);
    expect(candidate.verdict.eligible).toBe(false);
    expect(matchReason(candidate)).toMatch(/forensic/i);
  });

  it("a unit that has never confirmed its allocatable capacity reads 'Never confirmed', never zero or a fabricated number, and is not offered", () => {
    const base = unitById("scgh-adult-open")!;
    // `confirmedAt` deleted entirely (absent), same convention `tests/ward-morning-rollup.test.ts`
    // uses for "never confirmed" — never a sentinel like `0` or a fabricated timestamp. `empty`
    // stays a real, fresh figure so `capacity_freshness` is the ONLY gate this unit fails —
    // proving the override is actually reached, rather than masked by an earlier gate.
    const neverConfirmedUnit: Unit = {
      ...base,
      id: "synth-never-confirmed",
      allocatable: { value: 2, source: "ward", staleAfterMinutes: 90 } as Unit["allocatable"],
    };
    delete (neverConfirmedUnit.allocatable as Partial<Unit["allocatable"]>).confirmedAt;
    expect(hasConfirmedCapacity(neverConfirmedUnit)).toBe(false);

    const referral: Referral = {
      ...referrals[0],
      ageBand: "Adult",
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "queued",
        },
      ],
    };
    const [candidate] = referralCandidates(referral, wardOf(referral).destination, [neverConfirmedUnit], NOW_ANCHOR);
    expect(candidate.verdict.eligible).toBe(false);
    const reason = matchReason(candidate);
    expect(reason).toMatch(/never confirmed/i);
    expect(reason).not.toContain("NaN");
    expect(reason).not.toContain(" 0 ");
  });

  it("matchReason reports 'Eligible now' for a genuinely eligible pairing", () => {
    const unit = unitById("scgh-adult-open")!;
    const referral: Referral = {
      ...referrals[0],
      ageBand: "Adult",
      destinations: [
        {
          destination: {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          state: "queued",
        },
      ],
    };
    const [candidate] = referralCandidates(referral, wardOf(referral).destination, [unit], NOW_ANCHOR);
    expect(candidate.verdict.eligible).toBe(true);
    expect(matchReason(candidate)).toBe("Eligible now");
  });
});

/**
 * ⚠️ THE PATIENT LINK — A DELIBERATE WIDENING OF A PRIVACY GUARD, AND THESE ARE THE ASSERTIONS
 * THAT KEEP IT A WIDENING RATHER THAN A HOLE.
 *
 * Owner ruling 2026-09-02, confirmed directly before a line was written: a referral may remember
 * its patient. `ALLOWED_REFERRAL_FIELDS` gained ONE member, and the list's own prose had named
 * `patientId` as an example of what it existed to catch — so the decision is recorded in that
 * list and the limits are pinned here.
 */
describe("the patient link is a pointer, and the guard still refuses everything else", () => {
  it("⚠️ a referral carries the id and NOT ONE identifying fact beside it", () => {
    const referral = referrals[0];
    // The whole point: what identity means lives in one place. A name copied here "for
    // convenience" would pass a list-membership check and destroy the reason for the list.
    for (const forbidden of [
      "patientName",
      "givenName",
      "familyName",
      "name",
      "dateOfBirth",
      "dob",
      "umrn",
      "recordNumber",
      "address",
      "diagnosis",
      "notes",
      "narrative",
    ]) {
      expect(
        Object.keys(referral),
        `a referral carries ${forbidden} — the pointer was widened into a copy, which is the one ` +
          `thing the ruling that permitted it did not permit`,
      ).not.toContain(forbidden);
    }
  });

  it("is OPTIONAL, so a referral raised without a person on file is legal rather than invented", () => {
    // A required field would force something to be supplied, and the something would be made up.
    const withoutPatient: Referral = { ...referrals[0] };
    delete (withoutPatient as { patientId?: unknown }).patientId;
    expect(withoutPatient.patientId).toBeUndefined();
  });

  it("⚠️ the reducer writes the pointer through, and writes NOTHING when there is none", () => {
    // Built through the real `RECEIVE_REFERRAL` path rather than asserted against a literal — a
    // literal cannot show what the write path actually stores.
    const base = {
      type: "RECEIVE_REFERRAL" as const,
      role: "community" as const,
      now: NOW_ANCHOR,
      ageBand: "Adult" as const,
      destinations: [{ kind: "community_team" as const, teamName: "Inner City Clinic" }],
      homeRegion: HOME_REGIONS[0],
      suburb: { kind: "named" as const, name: "Cannington" },
      source: "community" as const,
      urgency: 2 as const,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    };

    // ⚠️ THE ID MUST NAME A REAL SEEDED PATIENT, AND THIS TEST USED TO USE A MADE-UP ONE.
    //
    // It passed `"PT-A1"`, which names nobody, and went green — because `RECEIVE_REFERRAL` stored
    // whatever it was handed without checking the person existed. When that hole was closed (the
    // owner's ruling: a pointer to a person who is not on file is a FABRICATED LINK and is now
    // refused), this test went red, and the red was correct: the reducer refused the event, so no
    // referral was created and the assertion read `undefined`.
    //
    // ⚠️ THIS TEST WAS RELYING ON THE ENGINE NOT LOOKING — the same defect this file catalogues
    // elsewhere, in this file's own author's work. Sourcing the id from the seed means it exercises
    // the resolution path rather than sailing past it, so it now proves MORE than it did before.
    const seeded = seedWardFlowState();
    const realPatientId = seeded.patients[0]?.id;
    if (realPatientId === undefined) {
      throw new Error(
        "the seed holds no patients, so this test cannot show a pointer surviving the write path — " +
          "it must not fall back to an invented id, which is what made it vacuous before",
      );
    }

    const withId = wardFlowReducer(seeded, { ...base, patientId: realPatientId });
    const created = withId.referrals[withId.referrals.length - 1];
    expect(withId.rejections, "the seeded patient must be accepted, or the assertion below is vacuous").toEqual([]);
    expect(created.patientId, "the pointer was dropped between the event and the record").toBe(realPatientId);

    const withoutId = wardFlowReducer(seedWardFlowState(), base);
    const createdWithout = withoutId.referrals[withoutId.referrals.length - 1];
    expect(
      createdWithout.patientId,
      "a referral raised with nobody on file was given a patient anyway — an invented link is worse " +
        "than an absent one, because it points at a real person who was never referred",
    ).toBeUndefined();
  });

  /**
   * ⚠️ THE THIRD STATE, ASSERTED AGAINST THE REDUCER ITSELF, NOT THROUGH THE SCREEN.
   *
   * `referral-intake.tsx` now refuses at load — before a clinician answers a single question —
   * when the `?patientId=` in the URL names nobody, so this exact reducer guard is no longer
   * reachable through ordinary use of that screen. An unreachable guard is exactly what somebody
   * deletes six months later after grepping for callers, so this test dispatches
   * `RECEIVE_REFERRAL` directly with an id naming nobody and proves the rejection independently of
   * the UI that now stands in front of it. See `tests/ward-referral-destinations.dom.test.tsx`'s
   * "the referral intake refuses at load for a patientId naming nobody" for the screen-level half.
   */
  it("⚠️ refuses RECEIVE_REFERRAL outright when patientId names nobody the reducer already holds", () => {
    const seeded = seedWardFlowState();
    const fabricatedId = "PT-does-not-exist";
    expect(
      seeded.patients.some((patient) => patient.id === fabricatedId),
      "the fabricated id must actually be absent from the seed, or this test proves nothing",
    ).toBe(false);

    const base = {
      type: "RECEIVE_REFERRAL" as const,
      role: "community" as const,
      now: NOW_ANCHOR,
      ageBand: "Adult" as const,
      destinations: [{ kind: "community_team" as const, teamName: "Inner City Clinic" }],
      homeRegion: HOME_REGIONS[0],
      suburb: { kind: "named" as const, name: "Cannington" },
      source: "community" as const,
      urgency: 2 as const,
      originSiteCode: "RPH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    };

    const before = seeded.referrals.length;
    const after = wardFlowReducer(seeded, { ...base, patientId: fabricatedId as Referral["patientId"] });

    expect(after.referrals, "a fabricated patient link must not create a referral").toHaveLength(before);
    const rejection = after.rejections[after.rejections.length - 1];
    expect(rejection?.attempted, "the rejection recorded is not the RECEIVE_REFERRAL attempt").toBe("RECEIVE_REFERRAL");
    expect(rejection?.reason).toBe(
      `RECEIVE_REFERRAL patientId must name a patient this system already holds, and ${fabricatedId} names none`,
    );
  });
});

/**
 * Opus review round 2, 17 September 2026 (P2), item 5(b): `GenderPlacement`'s own doc comment
 * (`ward-model.ts`) names its allowed fields in prose, but nothing checked a real ENTRY against
 * that list — the addressing-level and movement-level sweeps above check `genderPlacements`
 * itself is a permitted FIELD, never what is inside each of its own entries. A stray free-text
 * key on one entry (a coordinator's typed note, say) would carry clinical prose into an
 * accountability record this codebase treats as chosen-not-typed throughout, and pass every
 * existing check silently.
 *
 * `wardChecked` is included in the allowed set ahead of its own landing, per this task's brief —
 * coordinated with the parallel task adding it — so this remains a subset check (every key an
 * entry carries must be a MEMBER of the five) rather than an exact-equality check demanding all
 * five appear on every entry today.
 */
describe("GenderPlacement — an exact-key check on every real entry, so no free-text key can slip inside one", () => {
  const ALLOWED_GENDER_PLACEMENT_KEYS = ["at", "by", "reason", "unitIds", "wardChecked"];

  it("vacuity check: the allowed set really does exclude an invented key", () => {
    expect(ALLOWED_GENDER_PLACEMENT_KEYS).not.toContain("note");
    expect(ALLOWED_GENDER_PLACEMENT_KEYS).not.toContain("comment");
  });

  it("a genuine coordinator record (WF-012, REFER_TO_UNITS) carries only the allowed keys", () => {
    const seeded = seedWardFlowState();
    const movement = seeded.movements.find((candidate) => candidate.id === "WF-012");
    if (!movement || movement.gender !== "Non-binary") {
      throw new Error("WF-012 is no longer seeded Non-binary — this test must name a real one");
    }
    const after = wardFlowReducer(seeded, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-012",
      unitIds: ["rph-adult-secure"],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
      overrideReason: OVERRIDE_REASONS[0],
    } as never);

    const updated = after.movements.find((candidate) => candidate.id === "WF-012")!;
    const entries = updated.genderPlacements ?? [];
    // Anti-vacuity: a check that never finds an entry to examine proves nothing about its keys.
    expect(entries.length, "REFER_TO_UNITS must have written a real GenderPlacement entry").toBeGreaterThan(0);
    for (const entry of entries) {
      for (const key of Object.keys(entry)) {
        expect(ALLOWED_GENDER_PLACEMENT_KEYS, `a genderPlacements entry carries "${key}"`).toContain(key);
      }
    }
  });

  it("catches a stray free-text key that does not belong on the type", () => {
    const contaminated = {
      at: NOW_ANCHOR,
      by: "coordinator",
      unitIds: ["rph-adult-secure"],
      reason: GENDER_PLACEMENT_REASONS[0],
      note: "typed clinical prose",
    };
    const offendingKeys = Object.keys(contaminated).filter((key) => !ALLOWED_GENDER_PLACEMENT_KEYS.includes(key));
    expect(offendingKeys, "the check above must actually be able to fail on a contaminated entry").toEqual(["note"]);
  });
});
