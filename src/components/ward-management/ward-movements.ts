import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type {
  BedRelease,
  Cohort,
  LeaveBed,
  LegalStatus,
  Movement,
  MovementStage,
  Security,
} from "@/components/ward-management/ward-model";
import type { Patient, PatientId } from "@/components/ward-management/ward-patients";
import { generateSeedPatient } from "@/components/ward-management/ward-patients-seed";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits } from "@/components/ward-management/ward-sites";
import { unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import { generatedOccupantPatients, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { withSeededDischargeLogistics } from "@/components/ward-management/discharges/discharge-dependency-seed";
import { GENERAL_OBSERVATION, observationAt } from "@/components/ward-management/ward-observation";

/**
 * The transport-form name seeded onto `TransportJob.formRequired` below. This is a single fact
 * with one owner — the product owner may revise what this form is called — so it lives in one
 * place and both seed writes reference it, rather than each carrying its own copy of the string.
 */
const SEEDED_TRANSPORT_FORM_REQUIRED = "Form 1A";

/**
 * Hand-authored movements covering the states volume alone cannot guarantee: three declines
 * with nowhere eligible left, a status change mid-referral, a movement that never completed,
 * every stage in the pathway at least once, and the older-adult and specialling pressure that
 * is normal — not exceptional — on a busy metro night. (Earlier revisions of this fixture
 * authored two Form 1A "legal-form breaches" here; the 2026-08-23 product-owner correction
 * removed every `dueAt` from every Form 1A, so no legal-form breach exists in this fixture any
 * longer — see `LegalForm`'s doc comment in `ward-model.ts`.)
 *
 * ⚠️ **THE FRONT-DOOR LINK, OWNER RULING R-2026-09-04-D — READ THIS BEFORE ADDING OR REMOVING A
 * `referralId` HERE.** Until 2026-09-04 not one of these twenty movements carried one, so
 * `referralForMovement` returned `undefined` for every patient in every department and the link
 * looked identical to a link that did not work. The ruling asks for both halves: seed the pairs
 * that genuinely exist, AND make the reasons a movement has no referral distinguishable.
 *
 * **What is authored here, and the two conditions every seeded link satisfies.** `RAISE_REFERRAL`
 * refuses a referral that does not resolve, and refuses one that was never addressed to the
 * department raising the journey. A seeded link is written by hand and meets no reducer, so the
 * fixture holds itself to the same two conditions plus a third the reducer gets for free — the
 * referral must have been raised BEFORE the journey it produced. **No existing referral could
 * satisfy that third condition against any existing movement**: the only two referrals addressed
 * to an emergency department (`RF-009`, `RF-011`) were raised 35 and 50 minutes before the anchor,
 * and the youngest movement at either of their departments was opened 180 minutes before it. So
 * `RF-012` and `RF-013` were AUTHORED AS THE ORIGINS of `WF-002` and `WF-009` — a referral, then
 * a triage into that same department, then the department raising the journey — rather than an
 * existing referral being retro-fitted to a movement it could not have caused.
 * `tests/ward-movement-referral-link.test.ts` asserts all three conditions over the whole fixture
 * by name, so a later edit that breaks one fails there rather than rendering as a true join.
 *
 * **Eighteen carry no referral and that is not laziness.** Three of them (`WF-001`, `WF-013`,
 * `WF-019`) record `referralAbsence: none_raised` — the ASSERTION that nobody referred this
 * person, authored so the clinical state has data at three departments and three stages instead of
 * being a code path nothing exercises. The other fifteen record nothing at all and read as
 * `not_recorded`: nothing in their authored story says whether anybody referred them, and
 * answering for them would manufacture exactly the certainty the ruling's `⚠️` warns against.
 *
 * ⚠️ **AND NO MOVEMENT HERE CARRIES `transportNeed` (owner ruling R-2026-09-04-C).** "Not recorded"
 * is the required default for existing data, and every movement in this fixture is existing data.
 * The three-state field is exercised through the reducer in
 * `tests/ward-movement-transport-need.test.ts`, never by guessing an answer for a seeded record.
 */
const seededMovements: Movement[] = [
  {
    id: "WF-001",
    // Ward seed-audit follow-up, task T2 (D:/Temp/claude/seed-patient-link-audit.md, section 3):
    // this movement previously named no patient at all. PT-044 (Imogen Orrindale) is hand-authored
    // to agree with it — Adult Female, Form 1A — on `ward-patients-seed.ts` (task T0).
    patientId: "PT-044",
    originEdId: "arm-ed",
    openedAt: NOW_ANCHOR - 95,
    // Nobody referred this person — recorded 35 minutes after the department opened the journey,
    // which is when somebody actually looked. The ASSERTION, not the absence: see
    // `MovementReferralAbsence` for why the two are different facts.
    referralAbsence: { reason: "none_raised", at: NOW_ANCHOR - 60 },
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "examination" },
    formedAt: NOW_ANCHOR - 95,
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Confirming destination options",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-002",
    originEdId: "fsh-ed",
    openedAt: NOW_ANCHOR - 180,
    // Raised from `RF-012`, which was authored as this journey's origin: raised 240 minutes before
    // the anchor, addressed to THIS department (`fsh-ed`), and answered at the moment the
    // department opened the journey below. Ordering, department and resolution all hold — the
    // three conditions the fixture's own doc comment sets out.
    referralId: "RF-012",
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: observationAt("within_sight"),
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: ["fsh-older-adult"],
    declines: [],
    blocker: "Awaiting older-adult bed confirmation",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    formedAt: NOW_ANCHOR - 180 - 90,
    arrivalMode: "ambulance",
  },
  {
    id: "WF-003",
    // T2 (seed-audit follow-up, section 3): PT-045 (Keira Pellingworth), hand-authored to agree —
    // Adult Female, Form 3B.
    patientId: "PT-045",
    originEdId: "rph-ed",
    openedAt: NOW_ANCHOR - 260,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "3B",
      kind: "detention",
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "accepted_awaiting_bed",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "rph-adult-secure",
    declines: [],
    blocker: "Bed being made ready",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    arrivalMode: "ambulance",
    examination: { at: NOW_ANCHOR - 60, outcome: "inpatient_order" },
    // No arrival plan: the bed is not pulled yet, so no arrival can be expected. It used to carry an
    // ambulance "expected, late", which put "Accepted, awaiting bed" beside a late ambulance on the
    // ward screen (walkthrough 2026-09-25, T7; Josh approved the fix the same night).
  },
  {
    id: "WF-004",
    // T2: PT-046 (Rhys Cadwaller), hand-authored — also names `AD-BTYS-04` below, the pulled bed
    // this same journey is bound for, so one patient covers both records (T0's table).
    patientId: "PT-046",
    originEdId: "sjgm-ed",
    openedAt: NOW_ANCHOR - 410,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4C",
      kind: "transfer",
      dueAt: NOW_ANCHOR + 300,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "bty-adult-secure",
    admissionId: "AD-BTYS-04",
    declines: [],
    blocker: "Escort provider organising secure transport",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    pullExpiresAt: NOW_ANCHOR - 10,
  },
  {
    id: "WF-005",
    // T2: PT-047 (Noor Tremalow), hand-authored — Adult Female/Female.
    patientId: "PT-047",
    originEdId: "peel-ed",
    openedAt: NOW_ANCHOR - 330,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    // T10 (item 8, owner answer 17 September 2026): one of a handful of NAMED examples where
    // gender is authored — never copied from `sex` in bulk. Targets `ger-adult-open`, the
    // network's one Female-only ward, so `gender_designation` has a real Adult/Open/Female
    // pairing to accept.
    gender: "Female",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Detained awaiting examination",
    legalForm: { code: "1A", kind: "examination" },
    legalFormReceivedAt: NOW_ANCHOR - 40,
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "handover_ready",
    owner: "ED mental health team",
    referredUnitIds: [],
    acceptedUnitId: "fre-adult-open",
    declines: [],
    transport: {
      id: "TR-1005",
      provider: "Patient transport service",
      escortRequired: true,
      formRequired: SEEDED_TRANSPORT_FORM_REQUIRED,
      acceptedAt: NOW_ANCHOR - 30,
    },
    blocker: "Transport escort confirming departure time",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    formedAt: NOW_ANCHOR - 330 - 150,
  },
  {
    id: "WF-006",
    // T2: PT-048 (Owen Uskarby), hand-authored — Adult Male/Male.
    patientId: "PT-048",
    originEdId: "rgh-ed",
    openedAt: NOW_ANCHOR - 500,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    // T10 (item 8): a second named example — targets `fsh-adult-secure`, the network's one
    // Male-only ward, so `gender_designation` has a real Adult/Secure/Male pairing to accept.
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4A",
      kind: "transport",
      dueAt: NOW_ANCHOR + 90,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "moving",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "rgh-adult-secure",
    declines: [],
    transport: {
      id: "TR-1006",
      provider: "Patient transport service",
      escortRequired: true,
      acceptedAt: NOW_ANCHOR - 50,
      enRouteAt: NOW_ANCHOR - 15,
      // Collected 8 minutes after going en route (a short RGH-to-RGH-Adult-Secure hop), so at
      // NOW_ANCHOR the crew has been driving with the patient for 7 minutes — clearly still
      // mid-transfer, not close enough to arrival to also need `arrivedAt`.
      collectedAt: NOW_ANCHOR - 7,
    },
    blocker: "None — in transit",
    withdrawnReferrals: [
      {
        unitId: "fsh-adult-secure",
        at: NOW_ANCHOR - 470,
        // 🔴 FD-23. This read "Referral withdrawn once RGH Adult Secure confirmed the bed" and
        // rendered verbatim at /ward-flow/ward/fsh-adult-secure — FSH told, in plain
        // English, that RGH took the patient. Hand-authored, so fixing the reducer alone would
        // have left the DEMONSTRATION leaking while the generated path was clean.
        reason: "another_unit_accepted",
      },
    ],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-007",
    // T2: PT-049 (Winifred Ybarrow), hand-authored — Older adult Female.
    patientId: "PT-049",
    originEdId: "scgh-ed",
    openedAt: NOW_ANCHOR - 600,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "arrived",
    owner: "Ward nurse in charge",
    referredUnitIds: [],
    acceptedUnitId: "scgh-older-adult",
    declines: [],
    blocker: "None — handover complete",
    // ⚠️ Sweep R64's own defect class, found a third time (2026-09-04, alongside the generator's
    // identical gap in `stageFields`'s `case "arrived"`): `PATIENT_ARRIVED` refuses outright
    // unless `movement.stage === "moving" && movement.transport?.collectedAt`, so this
    // hand-authored record was a state the reducer could never have produced until this job was
    // added. Timestamps built backwards from `closure.at`, the same construction the generator
    // now uses.
    transport: {
      id: "TR-007",
      provider: "Patient transport service",
      escortRequired: false,
      acceptedAt: NOW_ANCHOR - 40,
      enRouteAt: NOW_ANCHOR - 25,
      collectedAt: NOW_ANCHOR - 10,
      arrivedAt: NOW_ANCHOR - 5,
    },
    closure: { at: NOW_ANCHOR - 5, outcome: "arrived", reason: "Handover complete at SCGH Older Adult" },
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-008",
    // T2: PT-050 (Declan Nettlecombe), hand-authored — Adult Male/Male.
    patientId: "PT-050",
    originEdId: "jhc-ed",
    openedAt: NOW_ANCHOR - 150,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    // Gap fixed 2026-09-17: T10's `gender_designation` gate (`ward-eligibility.ts`) reads this
    // field, distinct from `sex` above. Without it, `fsh-adult-secure` (Male only) fails the gate
    // as "not yet recorded" and drops out of `eligibleCandidatesAmong`'s eligible-first top-3 cut
    // entirely — this fixture's own test (`ward-console-controls.dom.test.tsx`, finding 2) needs
    // FSH present as a locked-ward alternative to prove the voluntary-on-locked warning renders on
    // every such row, not just the first. Recorded consistent with `sex: "Male"` above.
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    // Ruling R64: carries acceptedUnitId but no pullExpiresAt and no transport. PULL_PATIENT is the
    // only reducer transition that writes pullExpiresAt, and HANDOVER_READY (the only producer of
    // "handover_ready") requires stage "pulled" already — so a movement with an accepted unit
    // but neither of those later fields never reached pulled, let alone handover_ready. The
    // furthest stage its own fields honestly support is "accepted_awaiting_bed".
    stage: "accepted_awaiting_bed",
    owner: "ED mental health team",
    referredUnitIds: [],
    acceptedUnitId: "fre-adult-open",
    declines: [],
    blocker: "Patient declined transfer",
    // Seed gap fixed 2026-09-04: the closure sentence said "before transport arrived", but this
    // record carries no `transport` at all — the comment immediately above confirms the movement
    // never progressed past `accepted_awaiting_bed`, so no transport was ever booked for it to
    // arrive. Reworded to be true of the record beside it, without changing `outcome` or `at`.
    closure: {
      at: NOW_ANCHOR - 20,
      outcome: "did_not_proceed",
      reason: "Patient self-discharged from ED before transport was arranged",
    },
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-009",
    originEdId: "peel-ed",
    openedAt: NOW_ANCHOR - 420,
    // Raised from `RF-013` — a police referral to THIS department 470 minutes before the anchor,
    // matching this record's own `arrivalMode: "police"`. The second of the fixture's two seeded
    // links, at a different department from `WF-002`'s so a single-department bug cannot pass.
    referralId: "RF-013",
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    // Gap fixed 2026-09-17: T10's `gender_designation` gate reads this field, distinct from `sex`
    // above, and an absent gender now correctly refuses a single-gender ward
    // (`genderDesignationResult`, `ward-eligibility.ts`) rather than leaving it referable.
    // `fsh-adult-secure` (Male only) is one of this movement's declines below, and with no
    // `gender` recorded it fell out of the offerable shortlist entirely — a real, intended
    // behaviour change from T10, not a defect in the tests that rely on this fixture
    // (`ward-shortlist.dom.test.tsx`'s RA1 suite). Recorded consistent with `sex: "Male"` above.
    gender: "Male",
    observation: observationAt("within_sight"),
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "3B",
      kind: "detention",
    },
    // Seed gap fixed 2026-09-04: this record carried a `legalStatus` of "Involuntary inpatient"
    // and an examination whose outcome was an inpatient order (`examination.outcome:
    // "inpatient_order"`, below), while `statusChanges` sat empty — the page had no way to say
    // the status had changed and read the opposite. `CHANGE_LEGAL_STATUS` is the reducer's only
    // writer of both `legalStatus` and `statusChanges`, always in the same update, so a genuine
    // change leaves exactly this shape: one entry, timed at or after the examination it followed.
    statusChanges: [
      {
        at: NOW_ANCHOR - 95,
        from: "Detained awaiting examination",
        to: "Involuntary inpatient",
        by: "Duty psychiatrist",
        reason: "recorded_by_treating_team",
      },
    ],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: [],
    declines: [
      { unitId: "rph-adult-secure", at: NOW_ANCHOR - 90, reason: "no_suitable_bed" },
      {
        unitId: "gry-adult-secure",
        at: NOW_ANCHOR - 60,
        reason: "acuity_mix",
      },
      {
        unitId: "bty-adult-secure",
        at: NOW_ANCHOR - 30,
        reason: "bed_pulled_for_earlier_referral",
      },
      {
        unitId: "fsh-adult-secure",
        at: NOW_ANCHOR - 15,
        reason: "specialling_unavailable",
      },
      {
        unitId: "rgh-adult-secure",
        at: NOW_ANCHOR - 5,
        reason: "capability_mismatch",
      },
    ],
    // Every authorised secure adult unit in the network has now either declined this
    // referral or fails an eligibility gate on its own (Broome has zero allocatable beds;
    // SJGS Adult Secure is not MHA-authorised) — the search really is exhausted, not just
    // capped at three parallel referrals.
    blocker: "No secure adult bed available across the network",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    arrivalMode: "police",
    examination: { at: NOW_ANCHOR - 100, outcome: "inpatient_order" },
    escalation: {
      at: NOW_ANCHOR - 3,
      triedUnitIds: [
        "rph-adult-secure",
        "gry-adult-secure",
        "bty-adult-secure",
        "fsh-adult-secure",
        "rgh-adult-secure",
      ],
      contact: "State bed coordination desk",
    },
  },
  {
    id: "WF-010",
    // T2: PT-051 (Saoirse Loxbury), hand-authored — Adult Female.
    patientId: "PT-051",
    originEdId: "jhc-ed",
    openedAt: NOW_ANCHOR - 110,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Detained awaiting examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [
      {
        at: NOW_ANCHOR - 40,
        from: "Voluntary",
        to: "Detained awaiting examination",
        by: "Duty psychiatrist",
        reason: "recorded_by_treating_team",
      },
    ],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: ["sjgm-adult-open"],
    declines: [],
    blocker: "Awaiting destination response",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-011",
    // T2: PT-052 (Horace Iverstone), hand-authored — also names `AD-FREO-02` below, the pulled bed
    // this same journey is bound for, so one patient covers both records (T0's table).
    patientId: "PT-052",
    originEdId: "arm-ed",
    openedAt: NOW_ANCHOR - 360,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: observationAt("within_sight"),
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4C",
      kind: "transfer",
      dueAt: NOW_ANCHOR + 340,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "fre-older-adult",
    admissionId: "AD-FREO-02",
    declines: [],
    blocker: "Awaiting single-room clean",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    pullExpiresAt: NOW_ANCHOR + 20,
  },
  {
    id: "WF-012",
    // T2: PT-053 (Ari Grimsdale), hand-authored — Female, gender not recorded. Linking only; this
    // movement's own `sex`/`gender` fields below are left untouched (owner rule, option A, seed-
    // audit follow-up): `sex` here is a fixed `"Female" | "Male"` union and `gender` a fixed
    // `"Female" | "Male" | "Non-binary"` union, and neither can yet hold "Another term" or
    // "Different term"/"Not recorded" as an explicit value — that model change belongs to another
    // thread. See the session report for WF-012 and WF-026.
    patientId: "PT-053",
    originEdId: "rgh-ed",
    openedAt: NOW_ANCHOR - 70,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    // T10 (item 8): a third named example, deliberately DIFFERENT from `sex` above — proves
    // gender is read independently rather than defaulted from sex, the same discipline
    // `tests/ward-gender-gate.test.ts`'s PT-T02 fixture already holds `Patient.gender` to.
    gender: "Non-binary",
    observation: observationAt("within_sight"),
    highAcuity: false,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    // Was ["gry-adult-secure"] — fix for review C2. `RAISE_REFERRAL` is the only reducer branch
    // that produces "placement_requested" and it always writes `referredUnitIds: []`;
    // `REFER_TO_UNITS` is the only branch that ever populates `referredUnitIds`, and it always
    // does so in the same update that advances the stage to "destination_review". So a movement
    // that is still "placement_requested" — matching this record's own `blocker`, "Awaiting
    // specialling roster confirmation", which describes internal ED logistics before a referral
    // is raised, not a unit already sitting on one — can never honestly carry a live referral.
    // Coordinator screen showed "Parallel referral: Graylands Adult Secure" for a referral
    // Graylands' own ward screen could never see (its incoming list is keyed on
    // `stage === "destination_review"`), so nobody could ever accept or decline it. Clearing the
    // field to match the stage the fixture actually gives this record — rather than advancing
    // the stage to "destination_review" — is the smaller, more honest correction: nothing else on
    // this record (no coordinator note, no later referral history) supports a referral having
    // actually been raised.
    referredUnitIds: [],
    declines: [],
    blocker: "Awaiting specialling roster confirmation",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-013",
    patientId: "PT-018",
    originEdId: "sjgm-ed",
    openedAt: NOW_ANCHOR - 200,
    // Nobody referred this person. Recorded at a DIFFERENT stage from WF-001's — this movement is
    // already in `destination_review` with two live referrals to units — so the assertion cannot be
    // mistaken for "nothing is happening for this patient": the front door and the bed search are
    // separate facts, and this one is only about the front door.
    referralAbsence: { reason: "none_raised", at: NOW_ANCHOR - 150 },
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: ["bty-older-adult", "gry-older-adult"],
    declines: [],
    blocker: "Comparing two older-adult options",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    /**
     * ⚠️ **EQUAL TO `openedAt` ON PURPOSE — THIS IS THE BOUNDARY CASE, AND IT IS THE ONLY MOVEMENT
     * THAT DISCRIMINATES THE RULE `ed-screen.tsx`'s `isCommunityFormed` APPLIES.**
     *
     * Owner ruling, 2026-09-05: a form recorded at the very same minute as arrival IS community
     * formed, so the screen says *"since formed"*. He was asked precisely because the elapsed figure
     * is identical either way — both references are the same instant — so the ONLY thing the rule
     * changes here is which authority the screen names. Before this row the comparison was `<` and
     * nobody had chosen it.
     *
     * **Was `NOW_ANCHOR - 200 - 120` until 2026-09-05. Changed rather than adding a fourth movement
     * on purpose:** 73 test files import this fixture and 46 assert an exact count, so a new row
     * moves numbers under most of the ward suite. Editing this one moves none — the movement count
     * stays 50, and under the shipped `<=` rule WF-013 stays community formed, so that count stays 3
     * too. Under the old `<` rule it would drop to 2, which is exactly what makes it a discriminating
     * case rather than a decorative one.
     *
     * ⚠️ **ITS LEGAL CLOCK NOW EQUALS ITS TIME IN DEPARTMENT**, where every other community-formed
     * movement reads strictly older. A test asserting those two differ for WF-013 is a real second
     * consumer, not a broken assertion. `tests/ward-ed-legal-clock.dom.test.tsx` pins the intended
     * behaviour; `tests/ui-ward-roles.spec.ts` pins the strictly-older case at `peel-ed` on WF-005,
     * whose 150-minute gap must NOT be touched.
     */
    formedAt: NOW_ANCHOR - 200,
  },
  {
    id: "WF-014",
    patientId: "PT-013",
    originEdId: "fsh-ed",
    openedAt: NOW_ANCHOR - 480,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: observationAt("within_sight"),
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4A",
      kind: "transport",
      dueAt: NOW_ANCHOR + 60,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "moving",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "rph-adult-secure",
    declines: [],
    transport: {
      id: "TR-1014",
      provider: "Patient transport service",
      escortRequired: true,
      formRequired: SEEDED_TRANSPORT_FORM_REQUIRED,
      acceptedAt: NOW_ANCHOR - 45,
      enRouteAt: NOW_ANCHOR - 10,
      // A short secure-escort hop (FSH to Ward 2K): collected 6 minutes after going en
      // route, so only 4 minutes into the drive to the destination at NOW_ANCHOR.
      collectedAt: NOW_ANCHOR - 4,
    },
    blocker: "None — in transit",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-015",
    patientId: "PT-026",
    originEdId: "rgh-ed",
    openedAt: NOW_ANCHOR - 340,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Older adult",
    security: "Open",
    sex: "Male",
    gender: "Male", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: observationAt("within_sight"),
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "handover_ready",
    owner: "Ward nurse in charge",
    referredUnitIds: [],
    acceptedUnitId: "scgh-older-adult",
    declines: [],
    // Seed gap fixed 2026-09-04: this record carried `transport.escortRequired: false` alongside
    // a blocker reading "Awaiting transport escort" — the transport record said no escort was
    // needed while the page said the movement was stuck waiting for one. Resolved toward
    // `escortRequired: true`, not the blocker text: this movement's `specialling: true` (below)
    // already says the patient needs one-to-one observation, which is exactly the kind of patient
    // an escort exists for, and the blocker is specific, authored prose (this file's own
    // convention favours the richer, human-written signal — see `STAGE_TRANSITION_BLOCKERS`'s own
    // doc comment) rather than a value a generator could have gotten wrong by a coin flip.
    transport: {
      id: "TR-1015",
      provider: "Patient transport service",
      escortRequired: true,
      acceptedAt: NOW_ANCHOR - 15,
    },
    blocker: "Awaiting transport escort",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-016",
    patientId: "PT-014",
    originEdId: "peel-ed",
    openedAt: NOW_ANCHOR - 250,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "sjgm-adult-open",
    admissionId: "AD-SJGA-07",
    declines: [],
    blocker: "Ward finalising bed clean",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    pullExpiresAt: NOW_ANCHOR + 45,
  },
  {
    id: "WF-017",
    patientId: "PT-019",
    originEdId: "jhc-ed",
    openedAt: NOW_ANCHOR - 400,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    // 2026-09-17 sample-data pass: WF-017 carried `sex: "Male"` and no `gender`. Recorded
    // consistent with `sex` above — see RF-002/RF-006/RF-008's own comments in this file for the
    // discipline (T10, item 8): never copied from `sex` in bulk, only on the named rows this
    // change actually touches.
    gender: "Male",
    observation: observationAt("within_sight"),
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "3B",
      kind: "detention",
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "ED mental health team",
    referredUnitIds: ["bty-adult-secure"],
    declines: [
      {
        unitId: "gry-adult-secure",
        at: NOW_ANCHOR - 70,
        reason: "specialling_unavailable",
      },
    ],
    blocker: "Escalated to duty psychiatrist — due time close",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    examination: { at: NOW_ANCHOR - 260, outcome: "inpatient_order" },
  },
  {
    id: "WF-018",
    patientId: "PT-017",
    originEdId: "scgh-ed",
    openedAt: NOW_ANCHOR - 40,
    // THE ONE FLAGGED PATIENT IN THE FIXTURE (owner ruling, 2026-08-30). Chosen as the least
    // likely to reach the top any other way: tier 3, the shortest wait of any seeded movement at
    // 40 minutes, and the earliest stage. So when this sits above every tier-1 patient who has
    // waited hours, the flag is unmistakably what put it there and nothing else could have.
    //
    // Clinically ordinary rather than contrived: someone can become urgent shortly after arriving,
    // which is the case a flag exists for. Overall review (20 Oct 2026): the flag now carries who
    // raised it, when and the chosen reason, as `FLAG_MOVEMENT_URGENT` writes them, so the first
    // rows of Home no longer pair "Flagged urgent" with "who flagged this was not recorded".
    flaggedUrgent: true,
    urgentFlag: { at: NOW_ANCHOR - 25, by: "ed", reason: "cannot_be_observed_safely_here" },
    urgentFlagHistory: [{ raisedAt: NOW_ANCHOR - 25, raisedBy: "ed", reason: "cannot_be_observed_safely_here" }],
    urgency: 3,
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Awaiting family collateral before destination decision",
    // Was a one-entry withdrawnReferrals array naming scgh-older-adult — fix for review I6.
    // `ACCEPT_IN_PRINCIPLE` is the only reducer branch that ever writes `withdrawnReferrals`,
    // and it always does so in the same update that sets `acceptedUnitId` (withdrawing every
    // other unit this movement had a live referral at, because one unit just accepted). This
    // record has no `acceptedUnitId`, an empty `referredUnitIds`, and an empty `declines` — no
    // referral to SCGH Older Adult was ever raised for WF-018, so there is nothing for that unit
    // to have withdrawn. The ward's own screen rendered "Withdrawn from SCGH Older Adult /
    // Referral withdrawn — the unit filled the bed from an earlier request" for a referral that
    // never existed. Clearing the field to `[]` is the honest correction — the alternative,
    // inventing a real referral-then-acceptance-elsewhere history to justify the withdrawal,
    // would fabricate exactly the kind of state this prototype must never invent, and nothing
    // else in this record (blocker text, stage, other fields) supports that history.
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  /**
   * THE TWO LONG WAITS, added 2026-08-30 — and they exist to make a capability reachable rather
   * than to make the fixture prettier.
   *
   * Every other movement here waits hours. `routineMovements` caps at
   * `60 + ((index * 37) % 900)` minutes, so the longest wait anywhere in this fixture was about
   * SIXTEEN HOURS — which meant the day-scale clock work had nothing to display. `splitDuration`
   * could render `1d 6h`, `formatInstantWithDay` could say "yesterday", and no seeded record could
   * produce either. A capability nothing exercises is indistinguishable from one that does not
   * work, and the whole suite stays green either way.
   *
   * These two are the demonstration's evidence that a wait can outlast a day. Both are
   * `Voluntary`, deliberately: a voluntary patient waiting days for a bed is the access-block
   * story this prototype is about, and it introduces no legal form, no statutory deadline and no
   * Mental Health Act figure of any kind.
   *
   * They are hand-seeded rather than folded into the generator so the change is attributable. Widen
   * `routineMovements` instead and every measured figure in this project moves at once, with no way
   * to say which movement caused what.
   */
  {
    id: "WF-019",
    patientId: "PT-020",
    originEdId: "rgh-ed",
    // Two days and fourteen hours. Long enough that no reader can mistake it for a bad afternoon.
    openedAt: NOW_ANCHOR - (2 * 24 * 60 + 14 * 60),
    // Nobody referred this person either — the third `none_raised` record, on the longest wait in
    // the fixture. Recorded ten hours before the anchor, long after the journey opened: somebody
    // asked the question during the wait, which is when it actually gets asked.
    referralAbsence: { reason: "none_raised", at: NOW_ANCHOR - 600 },
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    // 2026-09-17 sample-data pass: WF-019 carried `sex: "Male"` and no `gender`. Recorded
    // consistent with `sex` above, same discipline as WF-017's own edit just above in this file.
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "No secure bed available within reach of home",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-020",
    patientId: "PT-022",
    originEdId: "peel-ed",
    // One day and five hours - deliberately just over the boundary, so a formatter that silently
    // truncates to hours is caught by the difference between "1d 5h" and "29h 00m".
    openedAt: NOW_ANCHOR - (24 * 60 + 5 * 60),
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "Waiting on an older-adult bed",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
];

/**
 * A deterministic destination for a generated movement. Prefers an exact cohort+security
 * match (the normal case); falls back to a cohort-only match, then to any unit, so the
 * synthetic model — which has no secure older-adult unit anywhere in the network — never
 * throws for a combination it cannot satisfy exactly. `index` is the only varying input, so
 * the pick is stable across runs.
 *
 * ⚠️ **AUTHORISATION IS NOT PART OF THAT CASCADE, AND THE DIFFERENCE IS THE POINT.** Cohort and
 * security are SUITABILITY — a bed of the wrong kind is a compromise a human could knowingly
 * make, so it is allowed to fall back. Authorisation under the Mental Health Act is LAWFULNESS —
 * a detained patient accepted at an unauthorised unit is not a compromise, it is a placement that
 * could not lawfully happen. So it filters the pool BEFORE the cascade runs, which means no
 * fallback level can reintroduce it. The old last resort — "then any unit" — is exactly where the
 * unlawful pick came from.
 *
 * This generator had never filtered on `authorised`; it merely happened not to land on either of
 * the network's two unauthorised units. `be5327210` changed the pool's size and order (whole-ward
 * flag to a bed-designation question) and WF-318, who is referred for psychiatric examination,
 * landed on `sjgs-adult-open` — measured 2026-09-05, and it is the only such record in the
 * fixture. The app was right to complain: `buildActionInbox` reported "Accepted destination no
 * longer lawful", which is a real defect in the DATA rather than in the derivation.
 *
 * It throws rather than degrading when nothing lawful exists, because a synthetic record that
 * silently states an unlawful placement is worse than a fixture that refuses to build. Measured
 * 2026-09-05: every cohort in this network has authorised units (Adult 14 of 16, Older adult 6 of
 * 6, Youth 1 of 1), so this cannot fire today — it exists for the day somebody removes one.
 */
function fallbackUnitId(
  cohort: Cohort,
  security: Security,
  index: number,
  legalStatus: LegalStatus,
  sex: Movement["sex"],
): string {
  // "is this ward of the right kind" for the security requested — mirrors the same locked/open
  // question `ward-eligibility.ts`'s `security` gate asks, not a whole-ward flag anymore.
  //
  // ⚠️ **AUTHORISATION IS PART OF "THE RIGHT KIND" AND WAS MISSING UNTIL 2026-09-04.** A generated
  // movement whose legal status requires an authorised destination must not be ACCEPTED at a unit
  // that cannot lawfully hold it. Two units in the network are `authorised: false`, and this
  // function used to be able to pick one for a detained patient.
  //
  // **It only surfaced when the locked/open change altered the POOL.** The pick is
  // `pool[index % pool.length]`, so changing which units qualify silently re-points every
  // generated acceptance — WF-318 landed on an unauthorised ward and `buildActionInbox` correctly
  // raised "Accepted destination no longer lawful". The app was right; the fixture was wrong.
  //
  // ⚠️ **AUTHORISATION FILTERS THE POOL BEFORE THE CASCADE, AND THAT ORDERING IS THE POINT.**
  // An earlier version applied it to `exact` and `sameCohort` but deliberately NOT to the final
  // `units` fallback, on the grounds that an empty pool is worse than an imperfect pick. That
  // reasoning does not survive the difference between the two kinds of constraint. Cohort and
  // security are SUITABILITY — a bed of the wrong kind is a compromise a human may knowingly make,
  // so those fall back. Authorisation is LAWFULNESS — an unauthorised bed for a detained patient is
  // not a compromise, it is a placement that could not lawfully happen — so it does not.
  //
  // ⚠️ **AND THE EXEMPTED FALLBACK IS ONE FIELD EDIT FROM FIRING.** Measured 2026-09-05: 23 units,
  // 21 authorised, and both unauthorised ones are cohort Adult — so a cohort with no authorised
  // unit does not exist today and the two versions behave identically. **Youth is a single ward.**
  // Mark `bty-youth` unauthorised and the exempted fallback silently places a detained young person
  // somewhere that cannot hold them. The throw below is loud instead: an empty pool is a fixture
  // that refuses to build, which is recoverable; an unlawful acceptance is silent, which is not.
  const lawful = requiresAuthorisedDestination(legalStatus) ? allUnits().filter((unit) => unit.authorised) : allUnits();
  if (lawful.length === 0) {
    throw new Error(
      `No unit in this network is recorded as an authorised hospital, so no destination can be generated for a ${legalStatus} movement.`,
    );
  }
  const exact = lawful.filter(
    (unit) => unit.cohort === cohort && (security === "Secure" ? unitHasLockedBeds(unit) : unitHasOpenBeds(unit)),
  );
  const sameCohort = lawful.filter((unit) => unit.cohort === cohort);
  const pool = exact.length > 0 ? exact : sameCohort.length > 0 ? sameCohort : lawful;
  // 26 Sept 2026: removing the Kununurra ward (owner-approved ward facts) shifted every pick, and
  // WF-317 (Male) landed on Geraldton's female-only ward, which the gender gate rightly refuses.
  // So the pick steps on past a single-sex ward that does not suit this movement. Only an index
  // that would land on such a ward moves; every other pick is exactly `pool[index % pool.length]`.
  const suits = (unit: (typeof pool)[number]) =>
    unit.sexDesignation === "Undesignated" ||
    (unit.sexDesignation === "Female only" && sex === "Female") ||
    (unit.sexDesignation === "Male only" && sex === "Male");
  for (let step = 0; step < pool.length; step += 1) {
    const unit = pool[(index + step) % pool.length];
    if (suits(unit)) return unit.id;
  }
  // Loud, like the lawfulness check above: a pool with no suitable ward is a fixture that refuses
  // to build, never a silent pick the gender gate would refuse.
  throw new Error(
    `No ward in the ${cohort}/${security} pool suits a ${sex} movement (every candidate is single-sex for the other sex).`,
  );
}

/**
 * Stage-dependent fields a generated movement needs to not contradict its own `stage` — the
 * same fields the hand-authored `seededMovements` above always carry together. Kept as a
 * switch, rather than folded into the field literals below, so each stage's requirement
 * reads as one block instead of being scattered across independent index checks.
 */
function stageFields(
  stage: MovementStage,
  cohort: Cohort,
  security: Security,
  index: number,
  legalStatus: LegalStatus,
  sex: Movement["sex"],
): Pick<Movement, "acceptedUnitId" | "transport" | "closure" | "pullExpiresAt" | "admissionId"> {
  switch (stage) {
    case "accepted_awaiting_bed":
      return { acceptedUnitId: fallbackUnitId(cohort, security, index, legalStatus, sex) };
    case "pulled":
      // Bounds match the hand-authored records: NOW_ANCHOR - 20 to NOW_ANCHOR + 45, so a
      // pull cannot be recorded without a time for it to expire at.
      // admissionId points at an in-unit pulled Admission (stayDays null) — never an extra row.
      return {
        // These generated holds name existing authored admissions. Their ward is fixed,
        // unlike fallback picks which shift when the network roster changes (WF-318).
        acceptedUnitId:
          index === 304
            ? "bty-older-adult"
            : index === 311
              ? "sjgm-adult-open"
              : index === 318
                ? "ger-adult-open"
                : index === 325
                  ? "alb-adult-open"
                  : fallbackUnitId(cohort, security, index, legalStatus, sex),
        pullExpiresAt: NOW_ANCHOR - 20 + (index % 66),
        admissionId:
          index === 304
            ? "AD-BTYO-01"
            : index === 311
              ? "AD-SJGA-02"
              : index === 318
                ? "AD-GERA-03"
                : index === 325
                  ? "AD-ALBA-03"
                  : `AD-GEN-PULL-${index}`,
      };
    case "moving": {
      const acceptedAt = NOW_ANCHOR - (40 + (index % 15));
      const enRouteAt = acceptedAt + (10 + (index % 10));
      // Stage "moving" means the crew already collected the patient — PATIENT_COLLECTED is the
      // only reducer transition that produces it, and it always sets `transport.collectedAt` in
      // the same update (ward-flow-reducer.ts). A generated "moving" record with no
      // `collectedAt` would be a state the reducer itself could never produce. The pickup-drive
      // offset varies by index (8-25 minutes) so generated in-transit journeys read as being at
      // different points, never one shared constant; the `Math.min` keeps `collectedAt` at or
      // before `NOW_ANCHOR` even for an index/gap combination narrower than the largest offset.
      const collectedAt = enRouteAt + Math.min(NOW_ANCHOR - enRouteAt, 8 + (index % 18));
      return {
        acceptedUnitId: fallbackUnitId(cohort, security, index, legalStatus, sex),
        transport: {
          id: `TR-${1300 + index}`,
          provider: "Patient transport service",
          escortRequired: index % 2 === 0,
          acceptedAt,
          enRouteAt,
          collectedAt,
        },
      };
    }
    case "arrived": {
      // ⚠️ Sweep R64's own defect class, found a third time while building the movement
      // step-track's Task 6 reachability test (2026-09-04): `PATIENT_ARRIVED` refuses outright
      // unless `movement.stage === "moving" && movement.transport?.collectedAt`
      // (ward-flow-reducer.ts), so an "arrived" record with no transport at all — what this case
      // returned until this fix — is a state the reducer could never produce. `arrived` is not
      // remapped the way `handover_ready`/`destination_review` above are, because the stage
      // GENUINELY implies a completed transport job; giving it one states what the stage already
      // means rather than inventing a fact the stage does not imply. Built backwards from the
      // closure instant, the same way `case "moving"` above builds forward from NOW_ANCHOR, so the
      // two stages tell one consistent story and every timestamp on the job is honestly in the
      // past relative to when the handover completed.
      const acceptedUnitId = fallbackUnitId(cohort, security, index, legalStatus, sex);
      const unitName = allUnits().find((unit) => unit.id === acceptedUnitId)?.name ?? acceptedUnitId;
      const closureAt = NOW_ANCHOR - (index % 10);
      const arrivedAt = closureAt;
      const collectedAt = arrivedAt - (5 + (index % 10));
      const enRouteAt = collectedAt - (8 + (index % 10));
      const acceptedAt = enRouteAt - (10 + (index % 10));
      return {
        acceptedUnitId,
        transport: {
          id: `TR-${1300 + index}`,
          provider: "Patient transport service",
          escortRequired: index % 2 === 0,
          acceptedAt,
          enRouteAt,
          collectedAt,
          arrivedAt,
        },
        closure: {
          at: closureAt,
          outcome: "arrived",
          reason: `Handover complete at ${unitName}`,
        },
      };
    }
    case "placement_requested":
    case "destination_review":
    case "handover_ready":
      // Nothing extra is honest at these three. A generated record here carries no accepted unit,
      // no reservation expiry and no transport, because none of those is a fact the stage implies.
      return {};
    default: {
      /*
       * ⚠️ **EXHAUSTIVE ON PURPOSE, AND IT REPLACED A BARE `default: return {}`.**
       *
       * A `MovementStage` renamed underneath this switch used to fall through to `{}` silently —
       * a generated movement that simply lost its accepted unit, its expiry and its transport, on
       * a stage the reducer can genuinely produce. Nothing failed: the record still typechecks,
       * still renders, and every test that looks the stage up in a map keyed by the OLD name gets
       * `undefined` on both sides of its assertion and passes.
       *
       * With the assignment below, an added or renamed stage is a COMPILE error at this line.
       */
      const unhandled: never = stage;
      throw new Error(`Unhandled movement stage: ${String(unhandled)}`);
    }
  }
}

/**
 * Routine movements filling out a busy metro night. Deterministic — index drives every
 * varying field — so screenshots and tests never shift between runs.
 */
/**
 * 🔴 THE TWO EDs THAT MUST NOT ORIGINATE AN ADULT MOVEMENT. King Edward Memorial is a specialist
 * women's hospital and Perth Children's is paediatric. Both are REAL public emergency departments
 * and belong on the board — they came from the WA reference register on 2026-09-18 — but this
 * generator walks `allEmergencyDepartments()` with `index % eds.length`, so adding them silently
 * gave adult and OLDER-ADULT psychiatric movements an origin at a children's hospital.
 *
 * ⚠️ NOBODY WOULD HAVE SEEN THAT ON A SCREEN. It renders as an ordinary row with a plausible
 * department name on it. `tests/ward-model.test.ts`'s "runs at realistic pressure" caught it only
 * because it pins the COUNT of distinct origin departments, which moved from 8 to 10 — a count
 * assertion catching a clinical nonsense it was not written for.
 *
 * Excluded here rather than by cohort, because the demo has no paediatric or perinatal pathway at
 * all: there is no correct movement for these departments to originate yet, not merely a
 * differently-shaped one.
 */
const EDS_WITH_NO_ADULT_PATHWAY = new Set(["kemh-ed", "pch-ed"]);

function routineMovements(count: number, startIndex: number): Movement[] {
  const eds = allEmergencyDepartments().filter((ed) => !EDS_WITH_NO_ADULT_PATHWAY.has(ed.id));
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const ed = eds[index % eds.length];
    const cohort: Cohort = index % 4 === 0 ? "Older adult" : "Adult";
    const security: Security = index % 7 === 0 ? "Secure" : "Open";
    const sex = index % 2 === 0 ? "Female" : "Male";
    const urgency = ((index % 3) + 1) as 1 | 2 | 3;
    const rawStage = MOVEMENT_STAGES[index % MOVEMENT_STAGES.length];
    // `stageFields` below has no case for "handover_ready" — and rightly so: giving it one would
    // mean fabricating the acceptedUnitId/pullExpiresAt/transport a real handover_ready movement
    // can only get by actually passing through accepted_awaiting_bed and pulled first
    // (ward-flow-reducer.ts's ACCEPT_IN_PRINCIPLE, PULL_PATIENT and HANDOVER_READY cases). Every
    // generated movement's `referredUnitIds` is unconditionally `[]` below, so a generated
    // "handover_ready" record — which the switch's `default` branch leaves with none of those
    // fields — is a state the reducer could never produce, exactly the ruling-R64 defect that
    // let WF-305/312/319/326 render as ready-for-handover-with-no-transport. The honest stage
    // for a record with an empty referredUnitIds and no acceptedUnitId is "placement_requested"
    // (ruling R64), so that index is remapped here rather than stageFields inventing fields —
    // this closes the defect for every index this generator can ever produce, not only today's.
    //
    // Sweep R64, defect 5a (Task 6, ward-flow movement step-track plan, 2026-09-04): the same
    // reasoning, one stage later. Every generated movement's `declines` is ALSO unconditionally
    // `[]` below, so a generated "destination_review" record carries neither a live referral nor a
    // decline. The remap stands — but ⚠️ **ITS ORIGINAL JUSTIFICATION WAS FALSE AND IS CORRECTED
    // HERE (2026-09-04), NOT QUIETLY BUMPED.**
    //
    // ⚠️ **WHAT THIS USED TO SAY, AND WHY IT WAS WRONG.** It claimed `destination_review` with an
    // empty `referredUnitIds` AND an empty `declines` is "a state `REFER_TO_UNITS`/`DECLINE` never
    // leave a movement in". That was true when written and `WITHDRAW_ACCEPTANCE` falsified it.
    // DRIVEN, not argued: `REFER_TO_UNITS` -> `ACCEPT_IN_PRINCIPLE` -> `WITHDRAW_ACCEPTANCE` on
    // WF-012 lands exactly that state — stage `destination_review`, `referredUnitIds: []`,
    // `declines: []`, `acceptedUnitId: undefined` — with zero rejections at every step. The
    // withdrawal deliberately does not push the unit back into `referredUnitIds` (owner ruling 3,
    // 2026-09-04), which is precisely what produces the shape this comment called impossible.
    //
    // ⚠️ **THE REMAP IS STILL RIGHT, FOR A NARROWER REASON — the combination is reachable, but not
    // WITHOUT A TRACE.** `WITHDRAW_ACCEPTANCE` writes a `stageChanges` entry and an `unwinds` entry
    // in the same update. A movement only ever arrives at empty-and-empty `destination_review` by
    // having had an acceptance withdrawn, and that always leaves both records behind. Every
    // generated movement carries `stageChanges: []` and `unwinds: []`, so the generated shape —
    // this stage, both lists empty, and no history saying how it got here — remains a state the
    // reducer cannot produce. The remap closes that, and `tests/ward-flow-contracts.test.ts:565`
    // (`matched` is 18, having been 14 before these four were remapped) pins it.
    //
    // ⚠️ **THE LESSON IS THE SHAPE, NOT THIS INSTANCE: a reachability claim in a comment is a
    // measurement with a shelf life, and this one expired when a new event was added.** It was not
    // wrong when written and nothing warned anyone when it stopped being true. `WF-302`, `WF-309`,
    // `WF-316` and `WF-323` are the four indices affected (`index % 7 === 1`).
    //
    // `WF-009` (empty referredUnitIds, two hand-authored declines — the every-ward-declined case)
    // is untouched by this remap, since it is HAND-AUTHORED (outside `routineMovements`) and its
    // `declines` is genuinely non-empty.
    const stage = rawStage === "handover_ready" || rawStage === "destination_review" ? "placement_requested" : rawStage;
    // Hoisted out of the literal below because `stageFields` needs it: a generated destination
    // must be lawful for THIS movement's status, and the status is what decides that. Passing the
    // STATUS rather than a caller-computed boolean keeps `requiresAuthorisedDestination` the one
    // place that decides what the status requires.
    //
    // Arrived slots that would have been "Referred for psychiatric examination" are instead
    // Involuntary inpatient: the carer/PSP/MHAS checklist only covers involuntary arrivals, and
    // "Referred for psychiatric examination" is not involuntary (9 Oct 2026).
    const referred = index % 3 === 0;
    const legalStatus: LegalStatus = referred
      ? stage === "arrived"
        ? "Involuntary inpatient"
        : "Referred for psychiatric examination"
      : "Voluntary";
    const id: `WF-${string}` = `WF-${String(index).padStart(3, "0")}`;
    // Ward seed-audit follow-up, task T2 (D:/Temp/claude/seed-patient-link-audit.md, section 3):
    // every routine movement now names a patient. WF-308 is the one exception — it re-uses the
    // existing PT-006 (Priya Oquinn), freed by RF-006's re-point elsewhere in this file, because
    // she is the seed's only free patient who genuinely fits (Older adult Female, Midland team,
    // East Metro). Every other index gets a deterministic `PT-G-<record id>` patient, matching
    // `generateSeedPatient`'s own id scheme (`ward-patients-seed.ts`, task T0) — referenced by id
    // only here, since T0 has not folded into this worktree; the actual `Patient` record for each
    // `PT-G-WF-3xx` id, and the reducer wiring that adds it to `state.patients`, is built once T0
    // lands (see the session report).
    const patientId: PatientId = id === "WF-308" ? "PT-006" : `PT-G-${id}`;
    return {
      id,
      patientId,
      originEdId: ed.id,
      openedAt: NOW_ANCHOR - (60 + ((index * 37) % 900)),
      flaggedUrgent: false,
      urgency,
      cohort,
      security,
      sex,
      // P2-7 (17 September 2026): WF-318 alone (index === 318), never a general rule for this
      // generator. Measured at the time: `fallbackUnitId` (below) had no sex-designation awareness
      // (since 26 Sept 2026 its pick also steps past a single-sex ward that does not suit) and landed
      // this one index on `ger-adult-open`, the network's only `Female only` ward, while
      // `routineMovements` otherwise never sets `gender` at all — a state no reducer path could
      // produce (`ACCEPT_IN_PRINCIPLE`/`PULL_PATIENT` both refuse an ungendered movement at a
      // designated ward). WF-318's own `sex` above is already `"Female"` at this index, so this is
      // the smaller of the two fixes the plan offered: recording the true match rather than
      // teaching the generator's cascade a new dimension every OTHER index already happens to
      // avoid by chance.
      // R7 (25 September 2026): authored demo data, not derived at runtime. Every generated movement
      // records a gender, except WF-329 (placement_requested), kept unrecorded on purpose as the seeded
      // "gender not recorded" case (it needs a coordinator's review before any allocation).
      gender: index === 329 ? undefined : sex,
      observation: index % 11 === 0 ? observationAt("within_sight") : GENERAL_OBSERVATION,
      // A DIFFERENT divisor from `observation` directly above, deliberately. Sharing one would make
      // every high-acuity movement a specialling movement too, and every screen, gate and statistic
      // that reads the pair would agree by construction — a correlation nobody authored, invisible
      // in the render, and exactly the shape that lets a defect in one field hide behind the other.
      highAcuity: index % 6 === 0,
      legalStatus,
      // 2026-08-23: no Form 1A in this model carries a dueAt (see LegalForm's own doc comment
      // in ward-model.ts) — the product owner's instruction was to drop the legal countdown
      // entirely, not to derive a corrected one, so this generator authors none.
      legalForm:
        index % 3 === 0
          ? {
              code: "1A",
              kind: "examination" as const,
            }
          : undefined,
      statusChanges: [],
      urgencyChanges: [],
      overrides: [],
      stage,
      owner: index % 2 === 0 ? "Bed coordinator" : "ED mental health team",
      referredUnitIds: [],
      declines: [],
      blocker: index % 5 === 0 ? "Awaiting destination response" : "No blocker",
      withdrawnReferrals: [],
      unwinds: [],
      stageChanges: [],
      ...stageFields(stage, cohort, security, index, legalStatus, sex),
    } satisfies Movement;
  });
}

/**
 * ⚠️ **JOURNEY-COVERAGE MOVEMENTS, ADDED 2026-09-17 AT THE OWNER'S REQUEST FOR MORE SAMPLE DATA,
 * PURELY ADDITIVE.** Every existing movement, id and count above is untouched (WF-017 and WF-019
 * only gained a `gender` field, recorded beside their own `sex`).
 *
 * **Why this is a separate array rather than more rows in `seededMovements`.** That array's own
 * top comment counts "twenty movements", "eighteen carry no referral" and "the other fifteen" —
 * exact figures about ITS OWN twenty rows. Appending here keeps every one of those counts true
 * rather than silently wrong the way a count written into a comment always goes stale the moment
 * the population beside it changes.
 *
 * **What this closes.** `movementHealthServices` (`ward-service-scope.ts`) gives a movement
 * membership in a service through its origin ED, its accepted ward, or any ward it was referred
 * to. A journey can only ever OPEN at an emergency department (owner ruling 8, 2026-09-01,
 * `Movement.originEdId`'s own doc comment) and WACHS and Private carry no emergency department at
 * all (`ward-sites.ts`) — so before this block, no movement anywhere in this fixture could ever
 * belong to WACHS or Private except by chance, through `routineMovements`' generated
 * `acceptedUnitId`. Measured 2026-09-17 against the real seed: East Metro, North Metro and South
 * Metro each already had an OPEN movement at every reachable stage (`destination_review` with a
 * live referral and no decline, `accepted_awaiting_bed`, `pulled`, `handover_ready` with transport
 * booked, and `moving`) except East Metro's own `handover_ready` — every one of those origins at a
 * real ED, so `placement_requested` (which a movement can only ever hold through its own origin
 * ED, since it has no referred or accepted ward yet) needs no help here and is not this block's
 * job. `arrived`/admitted is already covered everywhere by `ward-admissions-seed.ts`, whose
 * `unitOccupants` seeds an occupied bed at all 22 real units, WACHS and Private included — a
 * `Movement` at stage "arrived" is never "open" (`isOpen`, `ward-derivations.ts`, is
 * `!movement.closure && movement.stage !== "arrived"`), which is exactly why "arrived or admitted"
 * offers the admission as the alternative.
 *
 * So the ten rows below give East Metro its missing `handover_ready`, and give WACHS and Private
 * each of the five stages a movement can actually carry membership through: referred with a live
 * referral and no decline yet ("awaiting a ward answer"), `accepted_awaiting_bed`, `pulled`,
 * `handover_ready` with transport booked, and `moving` (in transit). Every one still opens at a
 * real emergency department — a WACHS or Private site is reached by referring or accepting a
 * movement onward from a metropolitan ED, the same shape `RF-006`/`RF-007`'s own out-of-area
 * referrals already establish for referrals rather than movements.
 *
 * 🔴 **T2r FIX ROUND, FINDING 5 (2026-09-17) — DROPPED WF-024 (WACHS `pulled`), THE ELEVENTH ROW
 * THIS BLOCK ORIGINALLY ADDED.** `ward-model.test.ts`'s "runs at realistic pressure, not
 * comfortable pressure" caps `wardMovements` at 40–60, pinned straight from the design spec
 * (`docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md` §14: "forty to sixty
 * movements") — a real ceiling, not a loose guess, so it is fixed by trimming a row rather than by
 * raising it. WACHS's `pulled` stage was never actually missing: `WF-318` and `WF-325`
 * (`routineMovements`' generated `acceptedUnitId`, exactly the "except by chance" this comment's
 * own paragraph above already flagged as possible) already gave WACHS two open `pulled` movements
 * before this block existed. WF-024 was measured, added and pinned without checking for that
 * chance coverage first; dropping it is a correction, not a loss — WACHS still keeps its `pulled`
 * membership through WF-318/WF-325, so every service still has a movement at every reachable
 * stage, and the fixture returns to 60, inside the spec's range.
 *
 * **Lawfulness, held to the same rule `fallbackUnitId`'s own comment states above.** `SJGS`'s two
 * units are `authorised: false` (`ward-sites.ts`) — private, and not authorised under the Mental
 * Health Act — so every Private-accepted row below is `legalStatus: "Voluntary"`; an involuntary
 * acceptance there would be a placement that could not lawfully happen, exactly the class of
 * defect that comment exists to prevent. WACHS's own units are all authorised, so those rows are
 * free to carry an involuntary status and a legal form, and two do.
 *
 * **The rest of the variety this pass asked for, folded into these same ten rows rather than
 * added as decoration on top of them:** both sexes; `gender` explicit on most, and left absent —
 * "not yet recorded" — on WF-021, WF-022 and WF-027; a second `gender: "Non-binary"` row (WF-026,
 * beside WF-012, this file's first); a Youth-cohort row (WF-021, `bty-youth`, the network's one
 * Youth unit — no WACHS or Private site carries an older-adult or Youth unit at all, a structural
 * fact of `ward-sites.ts` rather than an omission here, so the WACHS/Private rows below stay
 * `cohort: "Adult"`, the only cohort either network segment can lawfully accept); both `Security`
 * levels (`Open` throughout, `Secure` once at `sjgs-adult-secure`); two legal forms carrying a
 * typed `dueAt` (WF-023, WF-025 — never computed, the same discipline `ward-model.ts`'s own
 * `LegalForm` doc comment requires); a second `escalation` record (WF-022, beside WF-009, this
 * file's first) and a second `flaggedUrgent: true` (WF-030, beside WF-018, this file's first); and
 * an ED wait past the default 24-hour access target (WF-023, opened 1,500 minutes — 25 hours —
 * before the anchor, still open).
 */
const journeyCoverageMovements: Movement[] = [
  {
    id: "WF-021",
    patientId: "PT-024",
    originEdId: "arm-ed",
    openedAt: NOW_ANCHOR - 200,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Youth",
    security: "Open",
    // T2 (seed-audit follow-up, section 2 item 8): was "Female", contradicting linked PT-024
    // (Male). `bty-youth` is `"Undesignated"`, so `gender_designation` has nothing to gate on
    // sex here regardless — the fix is honesty, not a bed-matching consequence.
    sex: "Male",
    // R7 (25 Sept 2026): gender recorded to match linked PT-024 (Male). It was deliberately left
    // unrecorded ("a few"), but under R7 an unrecorded gender needs a coordinator's review before any
    // allocation, which a movement already past referral cannot get without being withdrawn. The
    // seeded unrecorded case is WF-329.
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "handover_ready",
    owner: "Ward nurse in charge",
    referredUnitIds: [],
    acceptedUnitId: "bty-youth",
    declines: [],
    transport: {
      id: "TR-1021",
      provider: "Patient transport service",
      escortRequired: false,
      acceptedAt: NOW_ANCHOR - 20,
    },
    blocker: "Transport booked, ward preparing the bed",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    // East Metro's own origin, referred on to a WACHS ward — the shape every WACHS row below
    // repeats: a journey opens at a real ED, then reaches a service with no ED of its own through
    // who it is referred to or accepted by.
    id: "WF-022",
    patientId: "PT-015",
    originEdId: "rph-ed",
    openedAt: NOW_ANCHOR - 260,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    // R7 (25 Sept 2026): was deliberately left unrecorded ("a few"). Under R7 an unrecorded gender needs a
    // coordinator's review before any allocation, which a movement already past referral cannot get
    // without being withdrawn, so this seed now records it. The seeded unrecorded case is WF-329.
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "examination" },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    // T2r fix round, finding 5 (2026-09-17): moved off alb-adult-open, whose single physically
    // empty bed WF-026 and the pre-existing WF-306 both already need to arrive at — a second
    // referral onto the same ward only worsened the read, and `ward-statistics-ward-referrals
    // -section.dom.test.tsx`'s premise is exactly one non-zero referral figure for alb-adult-open.
    // bun-adult-open is WACHS, Adult, Open and Undesignated (so Female sex here gates cleanly),
    // and independently verified via `eligibility()` to pass every gate.
    referredUnitIds: ["bun-adult-open"],
    declines: [],
    blocker: "Awaiting destination response",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    // A second escalation, beside WF-009's — a live referral can still be genuinely stuck.
    escalation: {
      at: NOW_ANCHOR - 5,
      triedUnitIds: ["bun-adult-open"],
      contact: "State bed coordination desk",
    },
  },
  {
    id: "WF-023",
    patientId: "PT-021",
    originEdId: "scgh-ed",
    // Past the default 24-hour ED access target (1,440 minutes) and still open.
    openedAt: NOW_ANCHOR - 1500,
    flaggedUrgent: false,
    urgency: 1,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4C",
      kind: "transfer",
      dueAt: NOW_ANCHOR + 400,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "accepted_awaiting_bed",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "bun-adult-open",
    declines: [],
    blocker: "Country transfer being organised",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-025",
    // T2 (seed-audit follow-up, section 2 item 2): moved off PT-023 — that id now belongs to
    // WF-009/RF-013 (Tobias Wren, Peel). PT-064 (Merrick Sedgewell) is hand-authored to agree with
    // this record instead — Adult Male/Male, Midland.
    patientId: "PT-064",
    originEdId: "sjgm-ed",
    openedAt: NOW_ANCHOR - 300,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Involuntary inpatient",
    legalForm: {
      code: "4A",
      kind: "transport",
      dueAt: NOW_ANCHOR + 150,
    },
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "handover_ready",
    owner: "Bed coordinator",
    referredUnitIds: [],
    // Was kun-adult-open. Kununurra has no ward (Josh, 26 Sept 2026), so this acceptance moved to
    // Broome, the other WACHS unit with no allocatable bed.
    acceptedUnitId: "brm-adult-secure",
    declines: [],
    transport: {
      id: "TR-1025",
      provider: "Patient transport service",
      escortRequired: true,
      formRequired: SEEDED_TRANSPORT_FORM_REQUIRED,
      acceptedAt: NOW_ANCHOR - 25,
    },
    blocker: "Escort provider organising secure transport",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-026",
    // T2 (seed-audit follow-up, section 2 item 9): already linked to PT-016 (sex "Non-binary" on
    // the free-text `Patient.sex`, no `Patient.gender`), so no re-point is needed here. Left
    // exactly as-is under the new owner rule (option A): `Movement.gender` below stays
    // "Non-binary" rather than being cleared or rewritten, because this model cannot yet express
    // "Different term"/"Not recorded" as an explicit gender value — that change belongs to another
    // thread. See the session report for WF-012 and WF-026.
    patientId: "PT-016",
    originEdId: "arm-ed",
    openedAt: NOW_ANCHOR - 150,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    // A second `Non-binary` example, beside WF-012 — deliberately a different `sex` value from
    // that one, same discipline as WF-012's own comment (gender read independently, never
    // defaulted from sex).
    gender: "Non-binary",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "moving",
    owner: "Bed coordinator",
    referredUnitIds: [],
    // T2r fix round, finding 5 (2026-09-17): moved off alb-adult-open. That ward's single
    // physically empty bed was already spoken for by the pre-existing WF-306, itself "moving" —
    // two movements in transit to occupy the same one empty bed is the logic breakdown a real
    // network cannot produce. bun-adult-open has TWO physically empty beds (`empty.value: 2`,
    // `ward-sites.ts`), is WACHS, Adult, Open and Undesignated (so a Non-binary gender here gates
    // cleanly), and independently verified via `eligibility()` to pass every gate.
    acceptedUnitId: "bun-adult-open",
    // P2-7 (17 September 2026): missing until now — `gender_designation` passes trivially at an
    // Undesignated ward, but the SEPARATE non-binary placement-record check
    // (`GENDER_PLACEMENT_REFUSAL` / `heldUnitGenderRefusal`, `ward-flow-reducer.ts`) is
    // unconditional for every `Non-binary` movement's accepted unit regardless of designation, and
    // this record carried none — a state no reducer path could actually produce (`ACCEPT_IN_PRINCIPLE`
    // and `PULL_PATIENT` both refuse without one). Dated before `transport.acceptedAt` below, the
    // moment a coordinator would genuinely have recorded it.
    genderPlacements: [
      {
        at: NOW_ANCHOR - 130,
        by: "coordinator",
        unitIds: ["bun-adult-open"],
        reason: "A single room is available on this ward",
        wardChecked: true,
      },
    ],
    declines: [],
    transport: {
      id: "TR-1026",
      provider: "Patient transport service",
      escortRequired: false,
      acceptedAt: NOW_ANCHOR - 40,
      enRouteAt: NOW_ANCHOR - 20,
      collectedAt: NOW_ANCHOR - 10,
    },
    blocker: "None — in transit",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    // Private's own first row — `SJGS`, St John of God Subiaco, `authorised: false`. Every row
    // accepted or referred there below stays `Voluntary`, for the reason this block's own top
    // comment gives.
    id: "WF-027",
    patientId: "PT-025",
    originEdId: "rgh-ed",
    openedAt: NOW_ANCHOR - 90,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female", // R7 (25 Sept 2026): authored demo data, not derived at runtime
    // R7 (25 Sept 2026): was deliberately left unrecorded ("a few"). Under R7 an unrecorded gender needs a
    // coordinator's review before any allocation, which a movement already past referral cannot get
    // without being withdrawn, so this seed now records it. The seeded unrecorded case is WF-329.
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: ["sjgs-adult-open"],
    declines: [],
    blocker: "Awaiting destination response",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-028",
    // T2: PT-054 (Callan Zennor), hand-authored — Adult Male/Male.
    patientId: "PT-054",
    originEdId: "peel-ed",
    openedAt: NOW_ANCHOR - 130,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Secure",
    sex: "Male",
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "accepted_awaiting_bed",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "sjgs-adult-secure",
    declines: [],
    blocker: "Confirming private admission funding",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-029",
    // T2: PT-055 (Tamsin Rookwell), hand-authored — also names `AD-SJSA-03` below, the pulled bed
    // this same journey is bound for, so one patient covers both records (T0's table).
    patientId: "PT-055",
    originEdId: "fsh-ed",
    openedAt: NOW_ANCHOR - 170,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "pulled",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "sjgs-adult-open",
    admissionId: "AD-SJSA-03",
    declines: [],
    blocker: "Ward finalising bed clean",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    pullExpiresAt: NOW_ANCHOR + 30,
  },
  {
    id: "WF-030",
    // T2: PT-056 (Jasper Embleton), hand-authored — Adult Male/Male.
    patientId: "PT-056",
    originEdId: "rph-ed",
    openedAt: NOW_ANCHOR - 60,
    // A second flagged-urgent patient, beside WF-018's — clinically ordinary rather than
    // contrived, same reasoning as that row's own comment, and with its provenance recorded too.
    flaggedUrgent: true,
    urgentFlag: { at: NOW_ANCHOR - 45, by: "coordinator", reason: "cannot_safely_prevent_leaving" },
    urgentFlagHistory: [
      { raisedAt: NOW_ANCHOR - 45, raisedBy: "coordinator", reason: "cannot_safely_prevent_leaving" },
    ],
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Male",
    gender: "Male",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "handover_ready",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "sjgs-adult-open",
    declines: [],
    transport: {
      id: "TR-1030",
      provider: "Patient transport service",
      escortRequired: false,
      acceptedAt: NOW_ANCHOR - 15,
    },
    blocker: "Transport booked, awaiting departure time",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
  {
    id: "WF-031",
    // T2: PT-057 (Mirela Pardoe), hand-authored — Adult Female/Female.
    patientId: "PT-057",
    originEdId: "scgh-ed",
    openedAt: NOW_ANCHOR - 100,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    gender: "Female",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "moving",
    owner: "Bed coordinator",
    referredUnitIds: [],
    acceptedUnitId: "sjgs-adult-open",
    declines: [],
    transport: {
      id: "TR-1031",
      provider: "Patient transport service",
      escortRequired: false,
      acceptedAt: NOW_ANCHOR - 35,
      enRouteAt: NOW_ANCHOR - 18,
      collectedAt: NOW_ANCHOR - 9,
    },
    blocker: "None — in transit",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
  },
];

export const wardMovements: Movement[] = [
  ...seededMovements,
  ...journeyCoverageMovements,
  ...routineMovements(30, 300),
];

/**
 * The generated people on routine movements (seed-link plan task T2 names them `PT-G-<movement
 * id>`), built here next to the records they describe. Their index carries on from the last
 * generated bed occupant's, so no generated movement patient shares a record number with one, nor
 * a full name while both groups together stay under the 400 name pairs `generateSeedPatient`
 * cycles through. CS-16 (Audit 1, Josh 20 Oct 2026): the old start of 1,000 wrapped round to the
 * names of occupants 200 onwards, so every movement patient shared an occupant's full name.
 */
export const generatedMovementPatients: Patient[] = wardMovements
  .filter((movement) => movement.patientId?.startsWith("PT-G-"))
  .map((movement, index) =>
    generateSeedPatient({
      recordId: (movement.patientId as string).slice("PT-G-".length),
      sex: movement.sex,
      gender: movement.gender,
      cohort: movement.cohort,
      index: generatedOccupantPatients.length + index,
    }),
  );

/** Returns `undefined` for an unknown id. Never falls back to a different movement. */
export function movementById(id: string): Movement | undefined {
  return wardMovements.find((movement) => movement.id === id);
}

export function movementsByStage(stage: MovementStage): Movement[] {
  return wardMovements.filter((movement) => movement.stage === stage);
}

/**
 * Beds expected to free up — DERIVED from the real seeded admissions, never hand-authored.
 *
 * ⚠️ **UNTIL 2026-09-25 THIS WAS NINE HAND-WRITTEN ROWS (`WR-001` .. `WR-009`), AND NOT ONE OF THEM
 * NAMED A REAL SEEDED PATIENT.** Owner decision, Josh, 25 September 2026: *a bed release is a named
 * patient's discharge* (`BedRelease.admissionId`, `ward-model.ts`). Once a release had to name an
 * `Admission.id`, none of the nine could — the units they pointed at had no occupant whose own
 * `expectedDischargeAt`/`dischargeConfirmedAt` matched what the row claimed. Two of the nine
 * (`WR-008`'s `"discharged"` state and the reducer's `AD-LEFT-` exclusion it required) existed only
 * to compensate for a ward-wide-count pairing heuristic the reducer no longer has — see
 * `departAdmission`'s and `RELEASE_BED`'s own comments.
 *
 * ⚠️ **OWNER RULING, Q4 AMENDED (25 Sept 2026, ~17:32): "remove any sample data that isn't linked
 * to a real patient; if you need more data, add more patients."** So this is not an empty array
 * either — it is every release the seeded admissions themselves actually support, and nothing
 * else: an occupied admission with `expectedDischargeAt` gives an `"expected"` release at that
 * time, and one that also carries `dischargeConfirmedAt` gives `"confirmed"` instead.
 * `deriveForwardRelease` (`ward-discharge-dates.ts`) already implements exactly this rule — it is
 * what a screen falls back to at read time when a ward has not yet flagged a release — so this
 * reuses that one function rather than restating its logic a second time. Nothing here invents a
 * blocker, a `waitingOn` reason, or a preparation note that no admission field supports; each is
 * `null` for the same reason `deriveForwardRelease` leaves it `null`.
 *
 * Since 25 September 2026 (coordinator decision, option A) this also carries one `"discharged"`
 * release per seeded admission that has actually left by `NOW_ANCHOR` (`derivedBedReleases`, the
 * same module's own rule for a departure: it needs a recorded `leftAt` and destination). Those
 * stays are real seeded facts, so the discharge board's recent-discharge group and the bed-release
 * lifecycle have something honest to show.
 *
 * One of them is AUTHORED as being made ready, and only one: Armadale's bed from the stay that left
 * (AD-LEFT-01), "Being cleaned". This keeps the hand-written seed's own fact (its WR-008, the same
 * ward and the same note) now that the release belongs to a named stay, so the screens that say how
 * many ready beds are still being cleaned have one real case to show. It is authored demo data, like
 * the seeded leave beds, never derived: no admission field says a bed is being cleaned.
 */
export const bedReleases: BedRelease[] = withSeededDischargeLogistics(
  derivedBedReleases(wardAdmissions, NOW_ANCHOR).map((release) =>
    release.id === "derived-discharged-AD-LEFT-01"
      ? { ...release, preparing: true, preparationNote: "Being cleaned" }
      : release,
  ),
  // Closing-the-loop package B (24 Oct 2026): authored discharge logistics on four seeded releases.
  NOW_ANCHOR,
);

/**
 * Beds held by someone on approved leave. Never merged into availability (spec D4). Each names the
 * stay it belongs to (`LeaveBed.admissionId`, owner ruling 2026-09-25). The two rows are authored
 * sample facts from "Build linked demo data" (Josh, "All A", 25 Sept): the old unnamed rows could not
 * be linked honestly, so these state who is on leave rather than guessing who the old rows meant.
 */
export const leaveBeds: LeaveBed[] = [
  {
    // Authored 2026-09-25: Luke Daviecroft (PT-036) is on leave from Ward 2K.
    id: "WL-001",
    unitId: "rph-adult-secure",
    admissionId: "AD-RPHS-11",
    expectedReturn: NOW_ANCHOR + 300,
    confirmedAt: NOW_ANCHOR - 60,
    confirmedBy: "NUM Dabakarn",
  },
  {
    // Authored 2026-09-25: Fiona Gallaglen (PT-038) is on leave from the SCGH Mental Health Unit.
    // ⚠️ Moves this leave bed from scgh-older-adult to scgh-adult-open: no named person is in an older
    // adult bed at SCGH. "On leave" becomes 0 on scgh-older-adult and 1 on scgh-adult-open.
    id: "WL-002",
    unitId: "scgh-adult-open",
    admissionId: "AD-SCGA-04",
    expectedReturn: NOW_ANCHOR + 180,
    confirmedAt: NOW_ANCHOR - 25,
    confirmedBy: "NUM Mental Health Unit",
  },
];

// The seeded referrals moved to `ward-movements-referrals.ts` (F-17); re-exported so importers are unchanged.
export { MIDLAND_DEMONSTRATION_ROWS, referrals } from "./ward-movements-referrals";
