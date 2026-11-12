// #816 (Josh, 26 Oct 2026: archive only, coordinator only): a patient record added in error can
// leave every list, but only by the coordinator and only while nothing else names the record.
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import { patientArchiveProblem } from "@/components/ward-management/ward-patient-archive";
import { UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const now = 642;
type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;

function withNewPatient() {
  let state: WardFlowState = seedWardFlowState();
  const send = (event: WithoutNow<WardFlowEvent>) => {
    state = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
    return state;
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn: "SYN-ARCHIVE-001",
    givenName: "Demo",
    familyName: "Archive",
    dateOfBirth: "1980-01-01",
  });
  const patient = state.patients.at(-1)!;
  return {
    send,
    patient,
    get state() {
      return state;
    },
  };
}

describe("ARCHIVE_PATIENT", () => {
  it("lets the coordinator archive a record nothing else names", () => {
    const world = withNewPatient();
    const before = world.state.patients.length;
    world.send({ type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "test" });
    expect(world.state.patients).toHaveLength(before - 1);
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(false);
    // The id is never reused.
    world.send({
      type: "ADD_PATIENT",
      role: "coordinator",
      umrn: "SYN-ARCHIVE-002",
      givenName: "Demo",
      familyName: "Second",
      dateOfBirth: "1981-01-01",
    });
    expect(world.state.patients.at(-1)!.id).not.toBe(world.patient.id);
  });

  it("archives a record that only holds the optional details Add patient records (RF7)", () => {
    let state: WardFlowState = seedWardFlowState();
    state = wardFlowReducer(state, {
      now,
      type: "ADD_PATIENT",
      role: "coordinator",
      umrn: "SYN-ARCHIVE-003",
      givenName: "Demo",
      familyName: "Details",
      dateOfBirth: "1982-01-01",
      preferredName: "Dee",
      address: "1 Example Street",
      generalPractitioner: "Example Clinic",
      catchmentCommunityTeam: "Example Team",
      interpreterLanguage: "Example",
    } as WardFlowEvent);
    const added = state.patients.at(-1)!;
    expect(added.address).toBe("1 Example Street");
    state = wardFlowReducer(state, {
      now,
      type: "ARCHIVE_PATIENT",
      role: "coordinator",
      patientId: added.id,
      reason: "test",
    } as WardFlowEvent);
    expect(state.patients.some((patient) => patient.id === added.id)).toBe(false);
  });

  it("refuses every other desk", () => {
    const world = withNewPatient();
    world.send({ type: "ARCHIVE_PATIENT", role: "ward", patientId: world.patient.id, reason: "test" } as never);
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
  });

  it("refuses a record with care recorded against it", () => {
    const world = withNewPatient();
    world.send({
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: "jhc-ed",
      patientId: world.patient.id,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female",
        observation: GENERAL_OBSERVATION,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    world.send({ type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "duplicate" });
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
    expect(world.state.rejections.at(-1)?.reason).toMatch(/care recorded against them/);
  });

  it("refuses a reason off the list, here and on the server", () => {
    const world = withNewPatient();
    const bad = { type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "because" };
    world.send(bad as never);
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
    expect(validSharedCommand({ ...bad, now })).toBe(false);
    expect(validSharedCommand({ ...bad, now, reason: "test" })).toBe(true);
    expect(validSharedCommand({ ...bad, now, reason: "test", role: "ed" })).toBe(false);
  });

  it("refuses a record carrying a fact recorded on the person, such as a treatment order", () => {
    const world = withNewPatient();
    const marked = {
      ...world.state,
      patients: world.state.patients.map((patient) =>
        patient.id === world.patient.id ? { ...patient, communityTreatmentOrder: {} as never } : patient,
      ),
    };
    const after = wardFlowReducer(marked, {
      type: "ARCHIVE_PATIENT",
      role: "coordinator",
      now,
      patientId: world.patient.id,
      reason: "test",
    });
    expect(after.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
    expect(after.rejections.at(-1)?.reason).toMatch(/care recorded against them/);
  });

  it("keeps an audit row naming the archived record and reason, and a refused try does not block it", () => {
    const world = withNewPatient();
    world.send({ type: "ARCHIVE_PATIENT", role: "ward", patientId: world.patient.id, reason: "test" } as never);
    world.send({ type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "duplicate" });
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(false);
    const row = world.state.auditEvents.filter((entry) => entry.action === "ARCHIVE_PATIENT").at(-1);
    expect(row).toMatchObject({
      category: "patient-record",
      outcome: "accepted",
      details: { patientId: world.patient.id, umrn: "SYN-ARCHIVE-001", reason: "duplicate" },
    });
  });
});

// D-149 (Josh, 11 Nov 2026): a record whose only links are withdrawn or cancelled front-door
// referrals, audit rows and spent Undo records can be archived; anything else still keeps it.
describe("ARCHIVE_PATIENT after a withdrawn referral (D-149)", () => {
  function referred() {
    const world = withNewPatient();
    world.send({
      type: "RECEIVE_REFERRAL",
      role: "ed",
      ageBand: "Adult",
      patientId: world.patient.id,
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Male",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Perth" },
      source: "ed_medical",
      originSiteCode: "RPH",
      urgency: 3,
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    } as never);
    const referral = world.state.referrals.find((entry) => entry.patientId === world.patient.id);
    expect(
      referral,
      `the referral was refused (${world.state.rejections.at(-1)?.reason}), so this suite would assert nothing`,
    ).toBeDefined();
    // Not a spread: `state` is a getter, and a spread would freeze it at this moment.
    return Object.assign(world, { referralId: referral!.id });
  }
  const later = (minutes: number) => now + minutes;

  it("refuses while the referral is still open, and says why", () => {
    const world = referred();
    expect(patientArchiveProblem(world.state, world.patient.id, later(60))).toMatch(/open or answered referral/);
    world.send({ type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "test" });
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
  });

  it("archives once the referrer withdrew it", () => {
    const world = referred();
    world.send({ type: "RECORD_REFERRER_WITHDRAWAL", role: "coordinator", referralId: world.referralId } as never);
    const withdrawn = world.state.referrals.find((entry) => entry.id === world.referralId)!;
    expect(
      withdrawn.destinations.every((addressing) => addressing.withdrawnAt !== undefined),
      `the withdrawal was refused (${world.state.rejections.at(-1)?.reason})`,
    ).toBe(true);
    // A referrer's withdrawal is not an Undo step, so nothing is left that could bring it back.
    expect(patientArchiveProblem(world.state, world.patient.id, now)).toBeUndefined();
    world.send({ type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "test" });
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(false);
    // The withdrawn referral stays, no longer linked to the archived record, and the archived
    // state is still one the server accepts.
    const kept = world.state.referrals.find((entry) => entry.id === world.referralId);
    expect(kept).toBeDefined();
    expect(kept!.patientId).toBeUndefined();
    expect(isValidSharedWardFlowState(JSON.parse(JSON.stringify(world.state)))).toBe(true);
  });

  it("waits out the Undo window while a step naming the record could still be taken back", () => {
    const world = referred();
    world.send({ type: "RECORD_REFERRER_WITHDRAWAL", role: "coordinator", referralId: world.referralId } as never);
    const withUndo = {
      ...world.state,
      undoRecords: [
        ...(world.state.undoRecords ?? []),
        { kind: "step", undoType: "UNDO_BED_STEP", subjectId: world.patient.id, seq: 1, at: now },
      ],
    } as unknown as WardFlowState;
    expect(patientArchiveProblem(withUndo, world.patient.id, now)).toMatch(/can still be undone/);
    // At exactly the window Undo is still allowed (`undoWindowRefusal` refuses only past it).
    expect(patientArchiveProblem(withUndo, world.patient.id, later(UNDO_WINDOW_MINUTES))).toMatch(
      /can still be undone/,
    );
    expect(patientArchiveProblem(withUndo, world.patient.id, later(UNDO_WINDOW_MINUTES + 1))).toBeUndefined();
    // A step stamped after the board's time (left by a clock step back, D-150) cannot be undone
    // (`undoWindowRefusal`), so it does not hold the record either.
    expect(patientArchiveProblem(withUndo, world.patient.id, (now - 60) as typeof now)).toBeUndefined();
    const inside = wardFlowReducer(withUndo, {
      type: "ARCHIVE_PATIENT",
      role: "coordinator",
      now,
      patientId: world.patient.id,
      reason: "test",
    });
    expect(inside.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
    const after = wardFlowReducer(withUndo, {
      type: "ARCHIVE_PATIENT",
      role: "coordinator",
      now: later(UNDO_WINDOW_MINUTES + 1),
      patientId: world.patient.id,
      reason: "test",
    });
    expect(after.patients.some((patient) => patient.id === world.patient.id)).toBe(false);
  });

  it("drops a future-stamped Undo step on archive, so it cannot come back once the clock reaches it", () => {
    const world = referred();
    world.send({ type: "RECORD_REFERRER_WITHDRAWAL", role: "coordinator", referralId: world.referralId } as never);
    const otherStep = { kind: "step", undoType: "UNDO_BED_STEP", subjectId: "PT-OTHER", seq: 2, at: now };
    const withUndo = {
      ...world.state,
      undoRecords: [
        ...(world.state.undoRecords ?? []),
        { kind: "step", undoType: "UNDO_BED_STEP", subjectId: world.patient.id, seq: 1, at: later(60) },
        otherStep,
      ],
    } as unknown as WardFlowState;
    // The step is stamped an hour after the board's time (a D-150 clock step back), so archive is allowed.
    const archived = wardFlowReducer(withUndo, {
      type: "ARCHIVE_PATIENT",
      role: "coordinator",
      now,
      patientId: world.patient.id,
      reason: "test",
    });
    expect(archived.patients.some((patient) => patient.id === world.patient.id)).toBe(false);
    // The future-stamped step on the record is gone, so it cannot bring a step on it back later.
    // The archive's own Undo record, which restores the record itself, is the only one naming it.
    const naming = (archived.undoRecords ?? []).filter((entry) =>
      JSON.stringify(entry).includes(JSON.stringify(world.patient.id)),
    );
    expect(naming.map((entry) => (entry as { action?: string }).action)).toEqual(["ARCHIVE_PATIENT"]);
    // An Undo record about anything else is kept.
    expect(archived.undoRecords).toContainEqual(otherStep);
  });

  it("still refuses a referral a ward answered", () => {
    const world = referred();
    const answered = {
      ...world.state,
      referrals: world.state.referrals.map((entry) =>
        entry.id === world.referralId
          ? {
              ...entry,
              destinations: entry.destinations.map((addressing) => ({ ...addressing, state: "declined" as const })),
            }
          : entry,
      ),
    };
    expect(patientArchiveProblem(answered, world.patient.id, later(60))).toMatch(/care recorded against them/);
  });
});
