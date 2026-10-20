import { describe, expect, it } from "vitest";

import { applyCommand, scopeWorld, seedWorld } from "../backend/ward-flow/engine";
import { alertGroupOf, isQueueItem } from "@/components/ward-management/alerts/alerts-model";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { boardRows } from "@/components/ward-management/delays/delays-board-model";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { edHomeSummaries, edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { deriveEdScreen } from "@/components/ward-management/ed/ed-screen-derivations";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { activeActNowItems, taskItems } from "@/components/ward-management/ward-act-now-items";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { openJourneySplit, waitingInEds, waitingSplit } from "@/components/ward-management/ward-shared-figures";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { RECEIVE_REFERRAL_CANDIDATE } from "./helpers/ward-legal-figure-sweep";

/**
 * Josh, 20 Oct 2026: "ensure everything is wired up correctly so that when I add new patients… all
 * the appropriate numbers align and they are present in all the correct places."
 *
 * Every figure below is read through the selector its screen calls, from the real reducer, starting
 * at the seeded day. A new person is added with the event the Add patient form raises
 * (`ADD_PATIENT`), then the ED board's Raise referral form opens their bed request
 * (`RAISE_REFERRAL`). Each place that should list them must, each count that should move must move
 * by exactly one, and every surface that shows the same measure must show the same number.
 * Synthetic records only.
 */
const now = NOW_ANCHOR;
const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
const ED_ID = "rph-ed";
const DAY_ZERO = new Date("2026-10-01T00:00:00+08:00");
const noop = () => {};

const ADD: Extract<WardFlowEvent, { type: "ADD_PATIENT" }> = {
  type: "ADD_PATIENT",
  role: "coordinator",
  now,
  umrn: "SYN-COUNTS-0001",
  givenName: "Synthetic",
  familyName: "Countcheck",
  dateOfBirth: "1984-02-03",
};

function raiseFor(patientId: PatientId): Extract<WardFlowEvent, { type: "RAISE_REFERRAL" }> {
  // The ED board's Raise referral form (`ed-screen.tsx`), for a patient found in the registry.
  return {
    type: "RAISE_REFERRAL",
    role: "ed",
    now,
    edId: ED_ID,
    patientId,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      specialling: false,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  };
}

/** Every figure and list the screens show, read the way each screen reads it. */
function surfaces(state: WardFlowState) {
  const counts = wardNavCounts({ ...state, now, sites: wardSites, thresholds });
  const waitingRows = boardRows(delayGroups(state.movements, state.units, now, thresholds), now);
  const queue = queueOrder(state.movements, now);
  const edBoard = deriveEdScreen({
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    registryPatients: state.patients,
    configuration: state.configuration,
    inboxSnoozes: state.inboxSnoozes,
    admissions: state.admissions,
    now,
    accessTarget: state.configuration.edAccessTargetMinutes,
    thisEdId: ED_ID,
    boardFilter: "all",
    patientQuery: "",
    patientSort: "longest",
    heroHighlight: null,
    selectedPatientId: null,
    arrivalPlanOpenFor: undefined,
    setSelectedPatientId: noop,
    setPhoneSheetFor: noop,
    setArrivalPlanOpenFor: noop,
    toggleBookTransport: noop,
    recordEdStep: noop,
  }).patients;
  const tv = bedMeetingSheet({
    units: state.units,
    movements: state.movements,
    bedReleases: state.bedReleases,
    admissions: state.admissions,
    leaveBeds: state.leaveBeds,
    now,
    thresholds,
    service: null,
    nameOf: (movement) => movement.id,
  });
  const census = buildCensus({ ...state, now, thresholds, dayZero: DAY_ZERO });
  const alertsAll = taskItems(
    { ...state, stuckHandoverMinutes: state.configuration.transportBookedTargetMinutes },
    now,
  ).filter(isQueueItem);
  const alertsActive = partitionSnoozed(alertsAll, state.inboxSnoozes, now).active;
  const rph = edOpenSummaries(state.movements, now).find((summary) => summary.ed.id === ED_ID)!;
  return {
    // "waiting in ED": one set, many places.
    waiting: {
      homeHero: waitingInEds(state.movements, now).total,
      menuBadge: counts.delays?.value,
      waitingTitle: waitingSplit(waitingRows.map((row) => row.movement)).waiting,
      edTiles: edOpenSummaries(state.movements, now).reduce((sum, summary) => sum + summary.waiting, 0),
      edIndex: edHomeSummaries(state.movements, now, 24 * 60).reduce((sum, summary) => sum + summary.waiting, 0),
      tv: tv.ed.waiting,
      homeQueueSplit: openJourneySplit(state.movements).waiting,
    },
    // "still open": every open journey, on Home's queue, Waiting, Movements and the TV.
    open: {
      homeQueue: queue.length,
      waitingList: waitingRows.length,
      movementsBadge: counts.movements?.value,
      movementsScreen: state.movements.filter(isOpen).length,
      tv: tv.delays.total,
    },
    rph: {
      tile: rph.waiting,
      // The header's service picker, for RPH's own service.
      servicePicker: waitingInEds(state.movements, now).byService.get(rph.service),
      board: edBoard.length,
      boardWaiting: waitingSplit(edBoard).waiting,
    },
    referrals: {
      menuBadge: counts.referrals?.value,
      homeTab: referralQueueOrder(state.referrals).length,
    },
    actNow: {
      menu: activeActNowItems(state, now).length,
      alerts: alertsActive.filter((item) => alertGroupOf(item) === "act").length,
    },
    lists: { queue, waitingRows, edBoard, census },
  };
}

function expectOneValue(group: Record<string, number | undefined>, label: string): number {
  const values = new Set(Object.values(group));
  expect(values.size, `${label} surfaces disagree: ${JSON.stringify(group)}`).toBe(1);
  const [value] = [...values];
  expect(value, `${label} must be measured`).toBeTypeOf("number");
  return value as number;
}

function plusOne(before: Record<string, number | undefined>, after: Record<string, number | undefined>) {
  for (const key of Object.keys(before)) {
    expect(after[key], `${key} must go up by exactly one`).toBe((before[key] ?? 0) + 1);
  }
}

describe("a new patient flows to every place and every count (local mode, real reducer)", () => {
  const seeded = seedWardFlowState();
  const added = wardFlowReducer(seeded, ADD);
  const patient = added.patients.at(-1)!;
  const raised = wardFlowReducer(added, raiseFor(patient.id));
  const movement = raised.movements.at(-1)!;

  it("the form events are accepted, and the bed request names the new person at their ED", () => {
    expect(added.rejections).toHaveLength(seeded.rejections.length);
    expect(raised.rejections).toHaveLength(added.rejections.length);
    expect(patient.umrn).toBe(ADD.umrn);
    expect(movement.patientId).toBe(patient.id);
    expect(movement.originEdId).toBe(ED_ID);
  });

  it("on the seed, each measure already reads the same on every surface", () => {
    const seed = surfaces(seeded);
    expectOneValue(seed.waiting, "waiting in ED");
    expectOneValue(seed.open, "still open");
    expectOneValue(seed.referrals, "awaiting a decision");
    expectOneValue(seed.actNow, "act now");
    expect(seed.rph.tile, "the RPH tile and the RPH board's waiting part").toBe(seed.rph.boardWaiting);
    // The board holds more than waiting (in transit), and says so: it is the waiting part plus the rest.
    expect(seed.rph.board).toBeGreaterThanOrEqual(seed.rph.tile);
  });

  it("adding the patient puts them in the Patients census and moves no ED or queue figure", () => {
    const before = surfaces(seeded);
    const after = surfaces(added);
    expect(after.lists.census.rows).toHaveLength(before.lists.census.rows.length + 1);
    expect(after.lists.census.rows.some((row) => row.patientRecordId === patient.id)).toBe(true);
    expect(after.waiting).toEqual(before.waiting);
    expect(after.open).toEqual(before.open);
  });

  it("raising the bed request lists them on Home, Waiting, the RPH board and the census", () => {
    const after = surfaces(raised);
    expect(after.lists.queue.map((row) => row.id)).toContain(movement.id);
    expect(after.lists.waitingRows.map((row) => row.movement.id)).toContain(movement.id);
    expect(after.lists.edBoard.map((row) => row.id)).toContain(movement.id);
    const censusRow = after.lists.census.rows.find((row) => row.patientRecordId === patient.id);
    expect(censusRow?.kind, "the census shows the person by their bed request").toBe("movement");
    expect(censusRow?.group).toBe("wait");
  });

  it("every count that should move goes up by exactly one, and the surfaces still agree", () => {
    const before = surfaces(added);
    const after = surfaces(raised);
    plusOne(before.waiting, after.waiting);
    plusOne(before.open, after.open);
    plusOne(before.rph, after.rph);
    expect(expectOneValue(after.waiting, "waiting in ED")).toBe(expectOneValue(before.waiting, "waiting in ED") + 1);
    expect(expectOneValue(after.open, "still open")).toBe(expectOneValue(before.open, "still open") + 1);
    expect(after.rph.tile).toBe(after.rph.boardWaiting);
    // A new request is no referral and no act-now task.
    expect(after.referrals).toEqual(before.referrals);
    expectOneValue(after.actNow, "act now");
  });
});

describe("a referral from the referral form reaches Referrals and Home's referrals tab", () => {
  it("RECEIVE_REFERRAL for a new patient moves the referral figures by one, together", () => {
    const added = wardFlowReducer(seedWardFlowState(), { ...ADD, umrn: "SYN-COUNTS-0002" });
    const patient = added.patients.at(-1)!;
    const sent = wardFlowReducer(added, {
      ...RECEIVE_REFERRAL_CANDIDATE,
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      patientId: patient.id,
    });
    expect(sent.rejections).toHaveLength(added.rejections.length);
    const referral = sent.referrals.at(-1)!;
    expect(referral.patientId).toBe(patient.id);
    const before = surfaces(added);
    const after = surfaces(sent);
    plusOne(before.referrals, after.referrals);
    expectOneValue(after.referrals, "awaiting a decision");
    expect(referralQueueOrder(sent.referrals).map((row) => row.id)).toContain(referral.id);
    // A referral is not yet a bed request: nobody is added to the waiting or open figures.
    expect(after.waiting).toEqual(before.waiting);
    expect(after.open).toEqual(before.open);
    expect(after.lists.census.rows.find((row) => row.patientRecordId === patient.id)?.kind).toBe("referral");
  });
});

describe("shared mode: the same commands through the shared engine flow the same way", () => {
  const at = new Date("2026-10-20T02:00:00Z");

  it("a person added and raised through applyCommand is counted by every selector, statewide and at their ED", () => {
    const world = seedWorld(at);
    const addResult = applyCommand(world, ADD, at);
    expect(addResult.outcome).toBe("accepted");
    const patient = addResult.world.state.patients.at(-1)!;
    const raiseResult = applyCommand(addResult.world, raiseFor(patient.id), at);
    expect(raiseResult.outcome).toBe("accepted");
    const movement = raiseResult.world.state.movements.at(-1)!;
    expect(movement.patientId).toBe(patient.id);

    // The statewide coordinator gets the world itself; an ED desk gets its scoped copy.
    const statewideBefore = scopeWorld(addResult.world, { role: "coordinator", scope: { kind: "statewide" } }, at);
    const statewideAfter = scopeWorld(raiseResult.world, { role: "coordinator", scope: { kind: "statewide" } }, at);
    const edDesk = { role: "ed" as const, scope: { kind: "ed" as const, edId: ED_ID } };
    const edBefore = scopeWorld(addResult.world, edDesk, at);
    const edAfter = scopeWorld(raiseResult.world, edDesk, at);

    const waitingAt = (state: WardFlowState) => waitingInEds(state.movements, now).total;
    const openAt = (state: WardFlowState) => queueOrder(state.movements, now).length;
    const badge = (state: WardFlowState) =>
      wardNavCounts({ ...state, now, sites: wardSites, thresholds }).delays?.value;

    expect(waitingAt(statewideAfter.state)).toBe(waitingAt(statewideBefore.state) + 1);
    expect(openAt(statewideAfter.state)).toBe(openAt(statewideBefore.state) + 1);
    expect(badge(statewideAfter.state)).toBe(waitingAt(statewideAfter.state));
    expect(queueOrder(statewideAfter.state.movements, now).map((row) => row.id)).toContain(movement.id);

    // At their own ED the desk sees the same person and the same one-step change.
    expect(edAfter.state.movements.map((row) => row.id)).toContain(movement.id);
    expect(edAfter.state.patients.map((row) => row.id)).toContain(patient.id);
    const rphWaiting = (state: WardFlowState) =>
      edOpenSummaries(state.movements, now).find((summary) => summary.ed.id === ED_ID)!.waiting;
    expect(rphWaiting(edAfter.state)).toBe(rphWaiting(edBefore.state) + 1);
    expect(rphWaiting(edAfter.state)).toBe(rphWaiting(statewideAfter.state));
  });
});
