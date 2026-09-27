// tests/ward-movement-stage-changes.test.ts
//
// Task 4 of the ward-flow movement step-track plan (docs/superpowers/plans/2026-09-04-ward-flow-
// movement-step-track.md). Pure — no DOM, no rendering. Proves three things about
// `Movement.stageChanges` (ward-model.ts) and the reducer cases that write it — eleven when this
// line was written, and DERIVED rather than listed, which is the whole point of check 1 below
// (ward-flow-reducer.ts):
//
//   1. The set of reducer cases that assign a stage is DERIVED from the reducer's own source text,
//      never hand-listed — a hand-listed ten silently misses the eleventh somebody adds.
//   2. The per-field agreement rule between `stageChanges` and the scattered timestamps it does
//      NOT replace (`openedAt`, `referredAt`, `acceptedAt`, `transport.collectedAt`, `closure.at`)
//      is checked on a fixture BUILT BY DRIVING THE REDUCER, after first proving the same check is
//      VACUOUS against the 50 seeded movements alone (every one of which carries an empty
//      `stageChanges`, by design — see `StageChange`'s own doc comment on why that is never
//      backfilled).
//   3. An empty `stageChanges` has two different causes, decidable from `movement.stage` alone.
//
// This file imports `wardFlowReducer` and `MOVEMENT_STAGES` from the reducer/model modules (not
// only their source text as a string), so it lands in `vitest related`'s module graph and is
// selected by `npm run test:focused` — unlike a bare `readFileSync` check with no import, which
// that command silently never runs.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  MOVEMENT_STAGES,
  type Movement,
  type MovementStage,
  type StageChange,
} from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function movementIn(state: WardFlowState, id: string): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

/** No new rejection was raised by the step that produced `after` from `before`. Every driver
 *  below must pass this or the fixture proves nothing — a rejected event leaves `stage`
 *  (and `stageChanges`) exactly as they were, which would read as a false pass or fail. */
function assertStepAccepted(before: WardFlowState, after: WardFlowState, label: string) {
  expect(after.rejections.length, `${label} must not be rejected`).toBe(before.rejections.length);
}

// ---------------------------------------------------------------------------------------------
// 1. THE DERIVED CASE LIST — never hand-listed.
// ---------------------------------------------------------------------------------------------

/**
 * Reads `ward-flow-reducer.ts` as text and returns every `case "EVENT_TYPE":` inside the main
 * `wardFlowReducer` switch whose body assigns a literal `stage: "..."` value. This is how the
 * plan requires the case list be produced — derived from source, never hand-listed — so a new
 * stage-assigning case added later is FOUND here even though nothing in this file named it.
 *
 * `stage: "` is a plain regex literal, not built from a template string or `new RegExp(...)`, so
 * it carries no risk of the escape-loss failure mode that produced silent zero-counts elsewhere on
 * this branch.
 *
 * Comments are blanked first (same length, newlines kept, so every index still lines up). A comment
 * quoting an old `stage: "handover_ready"` made CANCEL_TRANSPORT read as stage-assigning after the
 * 2026-09-16 fix removed its only real stage write; a guard derived from source must read the code.
 */
function deriveStageAssigningCases(rawSource: string): string[] {
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank);
  const caseHeaderPattern = /^ {4}case "([A-Z_]+)":/gm;
  const headers: { name: string; index: number }[] = [];
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = caseHeaderPattern.exec(source)) !== null) {
    headers.push({ name: headerMatch[1], index: headerMatch.index });
  }

  const stageAssignmentPattern = /stage: "/g;
  const found = new Set<string>();
  let assignmentMatch: RegExpExecArray | null;
  while ((assignmentMatch = stageAssignmentPattern.exec(source)) !== null) {
    const assignmentIndex = assignmentMatch.index;
    let owner: string | undefined;
    for (const header of headers) {
      if (header.index <= assignmentIndex) owner = header.name;
      else break;
    }
    if (owner) found.add(owner);
  }
  return [...found];
}

const REDUCER_SOURCE_PATH = path.join(process.cwd(), "src/components/ward-management/ward-flow-reducer.ts");
const reducerSource = readFileSync(REDUCER_SOURCE_PATH, "utf8");
const derivedStageAssigningCases = deriveStageAssigningCases(reducerSource);

// ---------------------------------------------------------------------------------------------
// The driven fixture. One movement (WF-012 — seeded at `placement_requested`, never touched by
// any other test's dispatch) walked through every derived case, with three forks so RELEASE_PULL,
// CANCEL_TRANSPORT and WITHDRAW_ACCEPTANCE — each of which returns the movement to an
// earlier-visited stage, or is refused past one — are exercised without abandoning the walk to
// arrival.
//
// The count is deliberately not restated here. It was "ten" until WITHDRAW_ACCEPTANCE turned out
// to have no driver, and a number written into a comment beside a derived list is the one thing in
// this file that cannot go red when it stops being true.
// ---------------------------------------------------------------------------------------------

const MOVEMENT_ID = "WF-012";
const UNIT_DECLINED = "rgh-adult-secure";
const UNIT_ACCEPTED = "rph-adult-secure";

function t(offsetMinutes: number): Instant {
  return NOW_ANCHOR + offsetMinutes;
}

function buildDrivenFixture() {
  const s0 = seedWardFlowState();

  // T12 (item 9, owner answer 17 September 2026): WF-012 is Non-binary, so referring it needs a
  // reason and a recorded ward check — the fixture predates T12 and never carried either.
  const s1 = wardFlowReducer(s0, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: t(10),
    movementId: MOVEMENT_ID,
    unitIds: [UNIT_DECLINED],
    genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
    genderPlacementChecked: true,
  });
  assertStepAccepted(s0, s1, "REFER_TO_UNITS (first referral)");

  const s2 = wardFlowReducer(s1, {
    type: "DECLINE",
    role: "ward",
    now: t(20),
    movementId: MOVEMENT_ID,
    unitId: UNIT_DECLINED,
    // Owner ruling 2026-09-25: a DECLINE with reason "no_bed" now waitlists the patient instead of
    // declining, and would append zero stageChanges entries — capability_mismatch still declines,
    // which is what this fixture's own stageChanges-count and referredAt-agreement tests need.
    reason: "capability_mismatch",
  });
  assertStepAccepted(s1, s2, "DECLINE");

  // The re-referral: REFER_TO_UNITS a second time while already at destination_review. This is
  // what rewrites `referredAt`, and it is the case the referredAt-agreement test depends on —
  // the LAST entry with `to: destination_review` must be THIS one, not the decline before it.
  const s3 = wardFlowReducer(s2, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: t(30),
    movementId: MOVEMENT_ID,
    unitIds: [UNIT_ACCEPTED],
    genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
    genderPlacementChecked: true,
  });
  assertStepAccepted(s2, s3, "REFER_TO_UNITS (re-referral)");

  const s4 = wardFlowReducer(s3, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: t(40),
    movementId: MOVEMENT_ID,
    unitId: UNIT_ACCEPTED,
  });
  assertStepAccepted(s3, s4, "ACCEPT_IN_PRINCIPLE");

  // FORK C — withdraw the acceptance, then abandon this branch. This is the "eleventh case" the
  // discovery check above exists to catch: `WITHDRAW_ACCEPTANCE` assigns a stage in the reducer's
  // own source and had no driver here, so the test threw by name rather than passing over it.
  //
  // ⚠️ IT CAN ONLY FIRE FROM s4, AND THAT IS THE REASON IT IS A FORK RATHER THAN A STEP ON THE MAIN
  // WALK. The reducer refuses it at any stage OTHER THAN `accepted_awaiting_bed` — not merely at
  // stages past it — so s5 onwards is out of reach and so is everything before s4. Driving it from
  // s4 and discarding the result is the only shape that reaches the case without deflecting the
  // walk.
  //
  // 🔴 THIS COMMENT USED TO QUOTE THE REFUSAL SENTENCE, AND BOTH HALVES WERE WRONG. It described
  // the reducer as refusing only at stages PAST `accepted_awaiting_bed`; the guard is `!==`, so it
  // fires before that stage as well as after. And the sentence it quoted was itself false at the
  // two earliest stages and has since been replaced. The conclusion — only s4 reaches it — was
  // correct either way, which is exactly how a wrong justification survives under a right answer.
  //
  // ⚠️ THE OLD WORDING IS DELIBERATELY NOT SPELLED OUT, AND THIS LINE SAYS SO ON PURPOSE. A comment
  // that quotes the string it removed puts that string back in the file: a search for the false
  // claim then finds this file and cannot tell a removal from a survival. Do not restore it for
  // clarity. A quoted sentence also goes stale the moment it is reworded, invisibly to every gate.
  //
  // It is NOT the inverse of ACCEPT_IN_PRINCIPLE: the reducer deliberately does not push the unit
  // back into `referredUnitIds`, because reviving a "live referral" the ward never re-received
  // would be a false claim on that ward's own screen (owner ruling 3, 2026-09-04). What this
  // fixture asserts is only the one thing this file is about — exactly one `stageChanges` entry.
  const sWithdrawn = wardFlowReducer(s4, {
    type: "WITHDRAW_ACCEPTANCE",
    role: "coordinator",
    now: t(45),
    movementId: MOVEMENT_ID,
    reason: "the_decision_changed",
  });
  assertStepAccepted(s4, sWithdrawn, "WITHDRAW_ACCEPTANCE");

  // Main walk continues from s4 (FORK C above forked off it without mutating it).
  const s5 = wardFlowReducer(s4, {
    type: "PULL_PATIENT",
    role: "ward",
    now: t(50),
    movementId: MOVEMENT_ID,
    unitId: UNIT_ACCEPTED,
  });
  assertStepAccepted(s4, s5, "PULL_PATIENT");

  // FORK A — release the pull, then abandon this branch. Proves the SECOND `to:
  // accepted_awaiting_bed` entry does not disturb `acceptedAt`, which must still agree with the
  // FIRST one (from ACCEPT_IN_PRINCIPLE above).
  const sReleased = wardFlowReducer(s5, {
    type: "RELEASE_PULL",
    role: "coordinator",
    now: t(60),
    movementId: MOVEMENT_ID,
    reason: "pull_made_in_error",
  });
  assertStepAccepted(s5, sReleased, "RELEASE_PULL");

  // FORK D — release the pull AND reopen the search (ef1807cda1, 22 Sept): the movement goes back to
  // placement_requested. A separate fork off s5, like FORK A, and abandoned the same way.
  const sReopened = wardFlowReducer(s5, {
    type: "RELEASE_AND_REOPEN_SEARCH",
    role: "coordinator",
    now: t(60),
    movementId: MOVEMENT_ID,
    actingUnitId: UNIT_ACCEPTED,
    reason: "pull_made_in_error",
  });
  assertStepAccepted(s5, sReopened, "RELEASE_AND_REOPEN_SEARCH");

  // Main walk continues from s5 (RELEASE_PULL and FORK D above forked off it without mutating it).
  const s6 = wardFlowReducer(s5, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: t(60),
    movementId: MOVEMENT_ID,
    provider: "Ambulance service",
    escortRequired: true,
    cadNumber: "CAD-STUB-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: 0,
  });
  assertStepAccepted(s5, s6, "BOOK_TRANSPORT");

  const s7 = wardFlowReducer(s6, {
    type: "HANDOVER_READY",
    role: "ed",
    now: t(70),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(s6, s7, "HANDOVER_READY");

  // FORK B — cancel the transport, then abandon this branch too. CANCEL_TRANSPORT is refused once
  // `transport.collectedAt` is set, so it can only ever fire here, before collection.
  const sCancelled = wardFlowReducer(s7, {
    type: "CANCEL_TRANSPORT",
    role: "coordinator",
    now: t(80),
    movementId: MOVEMENT_ID,
    reason: "provider_unavailable",
  });
  assertStepAccepted(s7, sCancelled, "CANCEL_TRANSPORT");

  // Main walk continues from s7 to arrival.
  const s8 = wardFlowReducer(s7, {
    type: "TRANSPORT_ACCEPTED",
    role: "officer",
    now: t(80),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(s7, s8, "TRANSPORT_ACCEPTED");

  const s9 = wardFlowReducer(s8, {
    type: "TRANSPORT_EN_ROUTE",
    role: "officer",
    now: t(90),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(s8, s9, "TRANSPORT_EN_ROUTE");

  const s10 = wardFlowReducer(s9, {
    type: "PATIENT_COLLECTED",
    role: "officer",
    now: t(100),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(s9, s10, "PATIENT_COLLECTED");

  const s11 = wardFlowReducer(s10, {
    type: "PATIENT_ARRIVED",
    role: "officer",
    now: t(110),
    movementId: MOVEMENT_ID,
  });
  assertStepAccepted(s10, s11, "PATIENT_ARRIVED");

  const stepFixtures: Record<string, { before: WardFlowState; after: WardFlowState }> = {
    REFER_TO_UNITS: { before: s0, after: s1 },
    DECLINE: { before: s1, after: s2 },
    ACCEPT_IN_PRINCIPLE: { before: s3, after: s4 },
    WITHDRAW_ACCEPTANCE: { before: s4, after: sWithdrawn },
    PULL_PATIENT: { before: s4, after: s5 },
    RELEASE_PULL: { before: s5, after: sReleased },
    RELEASE_AND_REOPEN_SEARCH: { before: s5, after: sReopened },
    HANDOVER_READY: { before: s6, after: s7 },
    CANCEL_TRANSPORT: { before: s7, after: sCancelled },
    PATIENT_COLLECTED: { before: s9, after: s10 },
    PATIENT_ARRIVED: { before: s10, after: s11 },
  };

  return {
    s0,
    s1,
    s2,
    s3,
    s4,
    sWithdrawn,
    s5,
    sReleased,
    sReopened,
    s6,
    s7,
    sCancelled,
    s8,
    s9,
    s10,
    s11,
    stepFixtures,
  };
}

/**
 * RECORD_REPATRIATION (53105ca6ea, 25 Sept) creates a NEW return movement when the receiving ward has
 * agreed, like RAISE_REFERRAL creates one: so, like RAISE_REFERRAL, the check is that the created
 * movement carries exactly one stageChanges entry (its creation entry).
 */
function recordRepatriation(state: WardFlowState, now: Instant) {
  const admission = state.admissions[0];
  if (!admission) throw new Error("the seed has no admission to repatriate — this driver needs one");
  const next = wardFlowReducer(state, {
    type: "RECORD_REPATRIATION",
    role: "coordinator",
    now,
    admissionId: admission.id,
    homeHospital: "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: "Ambulance service",
    cadNumber: "CAD-STUB-0002",
    transportLegalStatus: "voluntary",
    estimatedAt: now,
  });
  assertStepAccepted(state, next, "RECORD_REPATRIATION");
  const created = next.movements.find((movement) => !state.movements.some((prior) => prior.id === movement.id));
  if (!created) throw new Error("RECORD_REPATRIATION with receivingWardAgreed created no return movement");
  return { before: state, after: next, created };
}

function raiseNewReferral(state: WardFlowState, now: Instant) {
  const next = wardFlowReducer(state, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now,
    edId: "jhc-ed",
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      specialling: false,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  assertStepAccepted(state, next, "RAISE_REFERRAL");
  return { before: state, after: next, created: next.movements[next.movements.length - 1] };
}

describe("the derived case list (Task 4, step 1's floor)", () => {
  it("finds at least ten reducer cases that assign a stage, naming the number found", () => {
    expect(
      derivedStageAssigningCases.length,
      `expected at least 10 stage-assigning cases derived from ward-flow-reducer.ts's own source, ` +
        `found ${derivedStageAssigningCases.length}: ${derivedStageAssigningCases.join(", ") || "(none)"}`,
    ).toBeGreaterThanOrEqual(10);
  });

  it("every derived case appends exactly one stageChanges entry", () => {
    const raised = raiseNewReferral(seedWardFlowState(), NOW_ANCHOR);
    const driven = buildDrivenFixture();

    for (const caseName of derivedStageAssigningCases) {
      if (caseName === "RAISE_REFERRAL") {
        expect(
          raised.created.stageChanges,
          `RAISE_REFERRAL must append exactly one stageChanges entry (the creation entry)`,
        ).toHaveLength(1);
        continue;
      }
      if (caseName === "RECORD_REPATRIATION") {
        expect(
          recordRepatriation(seedWardFlowState(), NOW_ANCHOR).created.stageChanges,
          `RECORD_REPATRIATION must give the return movement it creates exactly one stageChanges entry`,
        ).toHaveLength(1);
        continue;
      }

      const step = driven.stepFixtures[caseName];
      if (!step) {
        throw new Error(
          `ward-flow-reducer.ts's own source assigns a stage in case "${caseName}", but this test has no ` +
            `driver for it. This is exactly the "eleventh case" the plan warns a hand-listed set would miss ` +
            `silently — add a driver for "${caseName}" rather than widening this check to skip it.`,
        );
      }
      const before = movementIn(step.before, MOVEMENT_ID).stageChanges.length;
      const after = movementIn(step.after, MOVEMENT_ID).stageChanges.length;
      expect(after - before, `case "${caseName}" must append exactly one stageChanges entry`).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// 2. THE AGREEMENT RULE, PER FIELD — vacuous on the seed, real on the driven fixture.
// ---------------------------------------------------------------------------------------------

function lastEntryTo(stageChanges: StageChange[], to: MovementStage): Instant | undefined {
  for (let index = stageChanges.length - 1; index >= 0; index -= 1) {
    if (stageChanges[index].to === to) return stageChanges[index].at;
  }
  return undefined;
}

function firstEntryTo(stageChanges: StageChange[], to: MovementStage): Instant | undefined {
  return stageChanges.find((entry) => entry.to === to)?.at;
}

function creationEntryAt(stageChanges: StageChange[]): Instant | undefined {
  return stageChanges.find((entry) => entry.from === undefined)?.at;
}

describe("agreement between stageChanges and the fields it does not replace", () => {
  it("is VACUOUS on the seeded fixture alone — every seeded movement carries an empty stageChanges", () => {
    const { movements } = seedWardFlowState();
    const eligibleForComparison = movements.filter((movement) => movement.stageChanges.length > 0);
    expect(
      eligibleForComparison.length,
      `an agreement check of the form "where both stageChanges and the existing timestamp exist, they ` +
        `agree" has zero cases to check here — proving it vacuous — because every one of the ${movements.length} ` +
        `seeded movements carries an empty stageChanges by design (StageChange's own doc comment: never ` +
        `backfilled). Found ${eligibleForComparison.length} seeded movements with a non-empty stageChanges: ` +
        `${eligibleForComparison.map((movement) => movement.id).join(", ") || "(none)"}.`,
    ).toBe(0);
  });

  it("compares five field pairs on the driven fixture, all present — proving the check above is not vacuous here", () => {
    const raised = raiseNewReferral(seedWardFlowState(), NOW_ANCHOR);
    const driven = buildDrivenFixture();

    const referredMovement = movementIn(driven.s3, MOVEMENT_ID);
    const acceptedMovement = movementIn(driven.sReleased, MOVEMENT_ID);
    const collectedMovement = movementIn(driven.s10, MOVEMENT_ID);
    const arrivedMovement = movementIn(driven.s11, MOVEMENT_ID);

    const pairs: { field: string; existing: Instant | undefined; derived: Instant | undefined }[] = [
      { field: "openedAt", existing: raised.created.openedAt, derived: creationEntryAt(raised.created.stageChanges) },
      {
        field: "referredAt",
        existing: referredMovement.referredAt,
        derived: lastEntryTo(referredMovement.stageChanges, "destination_review"),
      },
      {
        field: "acceptedAt",
        existing: acceptedMovement.acceptedAt,
        derived: firstEntryTo(acceptedMovement.stageChanges, "accepted_awaiting_bed"),
      },
      {
        field: "transport.collectedAt",
        existing: collectedMovement.transport?.collectedAt,
        derived: lastEntryTo(collectedMovement.stageChanges, "moving"),
      },
      {
        field: "closure.at",
        existing: arrivedMovement.closure?.at,
        derived: lastEntryTo(arrivedMovement.stageChanges, "arrived"),
      },
    ];

    // The vacuity floor, restated on the fixture this test actually exercises: this run's pair
    // count must be greater than zero, and greater than the seeded run's (0), or the driven
    // fixture is not reaching the checks below either.
    expect(
      pairs.length,
      `expected more than zero field pairs on the driven fixture (found ${pairs.length}); the seeded-alone ` +
        `run above found 0 — equal counts here would mean this fixture never reaches the agreement check`,
    ).toBeGreaterThan(0);

    for (const pair of pairs) {
      expect(pair.existing, `${pair.field}: the existing field must be set on this driven fixture`).toBeDefined();
      expect(
        pair.derived,
        `${pair.field}: a corresponding stageChanges entry must exist on this driven fixture`,
      ).toBeDefined();
    }
  });

  it("openedAt agrees with the creation entry, whose from is absent", () => {
    const raised = raiseNewReferral(seedWardFlowState(), NOW_ANCHOR);
    const creation = raised.created.stageChanges[0];
    expect(creation.from, "the creation entry must carry no previous stage").toBeUndefined();
    expect(creation.at, "openedAt must agree with the creation entry").toBe(raised.created.openedAt);
  });

  it("🔴 REWRITTEN — RA1 (item 18, 2026-09-17): referredAt agrees with the FIRST entry to destination_review, because a re-referral adds no stage change at all", () => {
    // Until RA1, `REFER_TO_UNITS` REPLACED `referredUnitIds` on every call and rewrote `referredAt`
    // to `event.now` unconditionally, and this test named that "rewrites it on re-referral" and
    // pinned the LAST entry. RA1 made re-referring an ADD: `referredAt` keeps the FIRST referral's
    // own moment forever after, and a re-referral while already at `destination_review` is not a
    // fresh transition, so it appends NO stageChanges entry of its own — the re-referral step (s3)
    // below adds zero entries, where it used to add a third.
    const driven = buildDrivenFixture();
    const movement = movementIn(driven.s3, MOVEMENT_ID);
    // Two entries carry `to: destination_review` in this fixture (the first referral, then the
    // decline — DECLINE appends unconditionally, per its own doc comment) — proving "first", not
    // merely "the only one", is the correct rule now that the re-referral itself adds none.
    expect(
      movement.stageChanges.filter((entry) => entry.to === "destination_review").length,
      "this fixture must carry more than one entry with to: destination_review, or it cannot tell FIRST from the only one",
    ).toBeGreaterThan(1);
    expect(movement.referredAt).toBe(firstEntryTo(movement.stageChanges, "destination_review"));
    expect(movement.referredAt).toBe(t(10));
    // The negative check named in the old test's own title, stated directly: t(30) — the
    // re-referral's own `now` — is no longer what `referredAt` reads.
    expect(movement.referredAt).not.toBe(t(30));
  });

  it("acceptedAt agrees with the FIRST entry to accepted_awaiting_bed — RELEASE_PULL adds a later one and must not rewrite it", () => {
    const driven = buildDrivenFixture();
    const movement = movementIn(driven.sReleased, MOVEMENT_ID);
    expect(
      movement.stageChanges.filter((entry) => entry.to === "accepted_awaiting_bed").length,
      "this fixture must carry two entries with to: accepted_awaiting_bed (ACCEPT_IN_PRINCIPLE, then " +
        "RELEASE_PULL), or it cannot tell FIRST from LAST",
    ).toBe(2);
    expect(movement.acceptedAt, "acceptedAt must still be the FIRST entry's time, not RELEASE_PULL's").toBe(
      firstEntryTo(movement.stageChanges, "accepted_awaiting_bed"),
    );
    expect(movement.acceptedAt).toBe(t(40));
    expect(
      movement.acceptedAt,
      "acceptedAt must not equal the LAST entry's time — RELEASE_PULL never rewrites it",
    ).not.toBe(lastEntryTo(movement.stageChanges, "accepted_awaiting_bed"));
  });

  it("transport.collectedAt agrees with the entry to moving", () => {
    const driven = buildDrivenFixture();
    const movement = movementIn(driven.s10, MOVEMENT_ID);
    expect(movement.transport?.collectedAt).toBe(lastEntryTo(movement.stageChanges, "moving"));
  });

  it("closure.at agrees with the entry to arrived, for an arrived outcome", () => {
    const driven = buildDrivenFixture();
    const movement = movementIn(driven.s11, MOVEMENT_ID);
    expect(movement.closure?.outcome).toBe("arrived");
    expect(movement.closure?.at).toBe(lastEntryTo(movement.stageChanges, "arrived"));
  });
});

// ---------------------------------------------------------------------------------------------
// 3. AN EMPTY stageChanges HAS TWO CAUSES, DECIDABLE FROM `stage` ALONE.
// ---------------------------------------------------------------------------------------------

/**
 * A movement at `placement_requested` with no entries has made no transitions yet — the ordinary
 * case for the earliest step. A movement at any LATER stage with no entries predates this field
 * entirely (every hand-authored and generated movement in ward-movements.ts, none of which was
 * ever reached by dispatching an event). This is deliberately a small pure function local to this
 * test, proving the property is decidable from `stage` alone — it is not wired into any renderer
 * by Task 4, which is pure by its own file list.
 */
function stageChangesAbsenceMeaning(
  stage: MovementStage,
  stageChanges: StageChange[],
): "no_transitions_yet" | "predates_field" | undefined {
  if (stageChanges.length > 0) return undefined;
  return stage === "placement_requested" ? "no_transitions_yet" : "predates_field";
}

describe("an empty stageChanges has two causes, separable from stage alone", () => {
  it("WF-001 (placement_requested, empty stageChanges) reads as no transitions yet", () => {
    const movement = movementIn(seedWardFlowState(), "WF-001");
    expect(movement.stage).toBe("placement_requested");
    expect(movement.stageChanges).toEqual([]);
    expect(stageChangesAbsenceMeaning(movement.stage, movement.stageChanges)).toBe("no_transitions_yet");
  });

  it("WF-009 (destination_review, empty stageChanges) reads as predating the field, not as no transitions", () => {
    const movement = movementIn(seedWardFlowState(), "WF-009");
    expect(movement.stage).not.toBe("placement_requested");
    expect(movement.stageChanges).toEqual([]);
    expect(stageChangesAbsenceMeaning(movement.stage, movement.stageChanges)).toBe("predates_field");
  });

  it("the two classifications never collide for any stage later than placement_requested", () => {
    for (const stage of MOVEMENT_STAGES) {
      const meaning = stageChangesAbsenceMeaning(stage, []);
      if (stage === "placement_requested") {
        expect(meaning).toBe("no_transitions_yet");
      } else {
        expect(meaning).toBe("predates_field");
      }
    }
  });
});
