// Equivalence harness for the stored-state fence (fix list 9.7, zod rewrite). The verdicts in
// `fixtures/ward-flow-storage-validation-verdicts.json` were recorded against the hand-written
// validator before it was rewritten with zod; the rewrite must reproduce every one of them.
// Re-record only for a deliberate, reviewed behaviour change: WARD_STORAGE_VERDICTS_RECORD=1.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import {
  isValidStoredWardFlowState,
  migrateStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
  withInboxStreamADefaults,
} from "@/components/ward-management/ward-flow-storage-validation";
import { ABSENCE_STEPS, REFERRAL_DECLINE_REASONS } from "@/components/ward-management/ward-model";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { SNOOZE_REASON_IDS } from "@/components/ward-management/ward-inbox-snooze";

type Json = Record<string, unknown>;
// Mutation targets are arbitrary JSON, reached by chains a static type would only obscure.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const without = (value: Row, ...keys: string[]): Row =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const FIXTURE = join(__dirname, "fixtures", "ward-flow-storage-validation-verdicts.json");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Rows the sweep walks beyond the first two and the last of each collection. */
const forced = new Set<string>();

/** The standard seed with every optional record shape the fence knows about filled in. */
function richState(): Json {
  const s = clone(seedWardFlowStateAt(0)) as Row;
  const unit = s.units[0];
  // An arrival recorded against a full ward keeps its bounded count disagreement.
  const arrivedIndex = s.movements.findIndex((m: Row) => m.stage === "arrived" && m.closure?.outcome === "arrived");
  const arrived = s.movements[arrivedIndex];
  const arrivalUnitIndex = s.units.findIndex((u: Row) => u.id === arrived.acceptedUnitId);
  s.units[arrivalUnitIndex].arrivalCapacityConflicts = [{ movementId: arrived.id, at: arrived.closure.at }];
  forced.add(`movements.${arrivedIndex}`);
  forced.add(`units.${arrivalUnitIndex}`);
  s.patients[0].communityTreatmentOrder = {
    form: "5A",
    recordedAt: 10,
    recordedBy: "Synthetic psychiatrist",
    endedAt: 20,
    earlier: [{ form: "5A", recordedAt: 1, recordedBy: "Synthetic psychiatrist", endedAt: 5 }],
  };
  s.patients[0].addedAt = 3;
  s.leaveBeds[0].absentWithoutLeave = { since: 0, steps: [{ step: ABSENCE_STEPS[0], at: 1 }] };
  unit.reservationReleaseCapacityConflicts = [
    {
      movementId: s.movements[0].id,
      at: 5,
      admissionId: s.admissions[0].id,
      allocatableBefore: unit.beds,
      allocatableLockedBefore: 0,
      lockedBedReleased: false,
    },
  ];
  s.movements[1].medicalDeterioration = { at: 1, by: "ed", resumedAt: 2 };
  s.auditEvents = [
    {
      id: "AE-1",
      sequence: 1,
      generation: 0,
      at: 5,
      actor: { role: "coordinator" },
      subject: { kind: "movement" },
      details: { kind: "note" },
      action: "RAISE_REFERRAL",
      category: "movement",
    },
    {
      id: "AE-2",
      sequence: 2,
      generation: 0,
      at: null,
      actor: { role: "coordinator" },
      subject: { kind: "admission" },
      details: { kind: "care", recorded: null },
      action: "RECORD_ADMISSION_CARE",
      category: "admission",
    },
  ];
  s.auditSequence = 2;
  s.auditReviews = [
    { id: "AR-1", eventId: "AE-1", at: 6, generation: 0 },
    { id: "AR-2", eventId: "audit-seed-synthetic", at: 7, generation: 0 },
  ];
  s.undoRecords = [
    {
      kind: "referral-decision",
      at: 1,
      role: "coordinator",
      referralId: s.referrals[0].id,
      action: "ACCEPT_REFERRAL",
      unitId: null,
      before: clone(s.referrals[0]),
      after: clone(s.referrals[0]),
      noticeIds: [],
    },
    {
      kind: "bed-placement",
      at: 1,
      role: "ward",
      admissionId: s.admissions[0].id,
      unitId: s.admissions[0].unitId,
      beforeBed: null,
      afterBed: 1,
    },
    {
      kind: "step",
      at: 1,
      role: "coordinator",
      undoType: "UNDO_REFER_TO_UNITS",
      action: "REFER_TO_UNITS",
      subjectId: s.movements[0].id,
      seq: 1,
      unitId: null,
      changes: [
        { slice: "movements", mode: "id", id: s.movements[0].id, index: 0, before: null },
        { slice: "notices", mode: "append", start: 0, rows: [] },
        { slice: "dischargeRevisions", mode: "whole", before: null },
      ],
    },
  ];
  s.notices = [
    { id: "N-1", raisedAt: 1, to: { role: "ed" }, about: { kind: "movement" }, kind: "note", sentence: "Synthetic" },
  ];
  s.dischargeRevisions = { [s.admissions[0].id]: 1 };
  s.inboxSnoozes = {
    "item-1": [
      { at: 1, by: "coordinator", kind: "snoozed", until: 5, reason: SNOOZE_REASON_IDS[0] },
      { at: 2, by: "coordinator", kind: "returned" },
    ],
  };
  s.inboxAcknowledgements = { "item-1": [{ at: 1, by: "coordinator" }] };
  s.inboxCompletions = { "item-1": [{ at: 1, by: "coordinator", kind: "completed" }] };
  s.inboxOwnership = { "item-1": [{ at: 1, by: "coordinator" }] };
  s.morningRollupConfirmations = { [unit.id]: { confirmedAt: 1, confirmedByRole: "ward", expectedDischarges: 2 } };
  s.handoverSignOffs = [{ at: 1, by: "coordinator" }];
  s.clinicalContacts = [{ at: 1, by: "coordinator", teamId: COMMUNITY_TEAM_PAGES[0].id }];
  s.refreshRequests = [{ unitId: unit.id, at: 1, byRole: "ward" }];
  s.broadcastAlerts = [
    {
      id: "BCAST-1",
      title: "Synthetic",
      message: "Synthetic fixture only",
      targetScopeLabel: "All demo wards",
      dispatchedByRole: "coordinator",
      dispatchedByName: "Demo coordinator",
      severity: "advisory",
      category: "ed_surge",
      targetScope: "all",
      status: "active",
      dispatchedAt: 1,
      expiresAt: 100,
      durationMinutes: 60,
      acknowledgedUnits: [],
      kind: "bed_call",
      replies: [
        { unitId: unit.id, answer: "can_take", at: 2, reason: REFERRAL_DECLINE_REASONS[0], beds: 1, readyAt: 3 },
      ],
      movementId: s.movements[0].id,
      targetUnitIds: [unit.id],
      answerBy: 50,
      stageChangesAtDispatch: 0,
    },
  ];
  s.broadcastSequence = 1;
  s.supportNotifications = [];
  return s;
}

const scalarMutations: [string, () => unknown][] = [
  ["undefined", () => undefined],
  ["null", () => null],
  ["NaN", () => NaN],
  ["Infinity", () => Infinity],
  ["neg", () => -1],
  ["frac", () => 1.5],
  ["zero", () => 0],
  ["unsafe", () => 2 ** 53],
  ["text", () => "x"],
  ["empty-text", () => ""],
  ["true", () => true],
  ["object", () => ({})],
  ["array", () => []],
];

interface Case {
  label: string;
  apply: (state: Row) => () => void;
}

/** In-place mutations with an undo, so a sweep does not clone the whole world per case. */
function sweep(base: Row, keepIndex: (path: string[], index: number, length: number) => boolean): Case[] {
  const out: Case[] = [];
  const resolve = (state: Row, path: string[]) => path.reduce((node: Row, key) => node[key], state);
  const visit = (node: unknown, path: string[]) => {
    if (path.length > 0) {
      const parentPath = path.slice(0, -1);
      const key = path[path.length - 1];
      const label = path.join(".");
      const set =
        (make: () => unknown) =>
        (state: Row): (() => void) => {
          const parent = resolve(state, parentPath);
          const before = parent[key];
          parent[key] = make();
          return () => {
            parent[key] = before;
          };
        };
      for (const [name, make] of scalarMutations) out.push({ label: `${label}=${name}`, apply: set(make) });
      if (!/^\d+$/.test(key))
        out.push({
          label: `${label}:delete`,
          apply: (state) => {
            const parent = resolve(state, parentPath);
            const before = parent[key];
            delete parent[key];
            return () => {
              parent[key] = before;
            };
          },
        });
    }
    if (Array.isArray(node)) {
      const label = path.join(".") || "<root>";
      const push = (make: (array: unknown[]) => unknown) => (state: Row) => {
        const array = resolve(state, path) as unknown[];
        array.push(make(array));
        return () => {
          array.pop();
        };
      };
      out.push({ label: `${label}+null`, apply: push(() => null) });
      out.push({ label: `${label}+text`, apply: push(() => "x") });
      out.push({ label: `${label}+object`, apply: push(() => ({})) });
      if (node.length > 0) out.push({ label: `${label}+dup`, apply: push((array) => clone(array[0])) });
      node.forEach((item, index) => {
        if (keepIndex(path, index, node.length)) visit(item, [...path, String(index)]);
      });
    } else if (typeof node === "object" && node !== null) {
      const label = path.join(".") || "<root>";
      for (const [name, value] of [
        ["extra-text", "x"],
        ["extra-number", 1],
        ["extra-object", {}],
      ] as const) {
        out.push({
          label: `${label}+${name}`,
          apply: (state) => {
            const target = resolve(state, path);
            target.zzExtra = value;
            return () => {
              delete target.zzExtra;
            };
          },
        });
      }
      for (const key of Object.keys(node)) visit((node as Row)[key], [...path, key]);
    }
  };
  visit(base, []);
  return out;
}

const keepFew = (path: string[], index: number, length: number) =>
  path.length > 1 || index < 2 || index === length - 1 || forced.has(`${path.join(".")}.${index}`);

function verdict(value: unknown): string {
  try {
    return isValidStoredWardFlowState(value) ? "1" : "0";
  } catch {
    return "T";
  }
}

const RECORD = process.env.WARD_STORAGE_VERDICTS_RECORD === "1";
// The full sweep takes about a minute; by default every tenth case runs. RECORD or
// WARD_STORAGE_VERDICTS_FULL=1 runs every case.
const STRIDE = RECORD || process.env.WARD_STORAGE_VERDICTS_FULL === "1" ? 1 : 10;

/** One verdict per case; "-" marks a case this run skipped. */
function run(base: Row, cases: Case[]): string {
  let verdicts = "";
  cases.forEach((entry, index) => {
    if (index % STRIDE !== 0) {
      verdicts += "-";
      return;
    }
    const undo = entry.apply(base);
    verdicts += verdict(base);
    undo();
  });
  return verdicts;
}

function bases(): [string, Row][] {
  const emhs = clone(seedWardFlowStateAt(0, "emhs-demo")) as Row;
  return [
    ["rich", richState()],
    ["emhs", emhs],
  ];
}

describe("stored ward flow state fence, equivalence harness", () => {
  it("accepts both base worlds", () => {
    for (const [, base] of bases()) expect(isValidStoredWardFlowState(base)).toBe(true);
  });

  it("reproduces the recorded accept/refuse verdict for every swept mutation", () => {
    const recorded: Record<string, string> = {};
    const labels: Record<string, string[]> = {};
    for (const [name, base] of bases()) {
      const cases = sweep(base, keepFew);
      labels[name] = cases.map((entry) => entry.label);
      recorded[name] = run(base, cases);
      // The sweep must hand every base back unchanged.
      expect(isValidStoredWardFlowState(base)).toBe(true);
    }
    if (RECORD) {
      writeFileSync(FIXTURE, `${JSON.stringify(recorded, null, 0)}\n`);
      return;
    }
    const expected = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, string>;
    for (const name of Object.keys(recorded)) {
      const differences = labels[name].filter(
        (_, index) => recorded[name][index] !== "-" && recorded[name][index] !== expected[name]?.[index],
      );
      expect(differences.slice(0, 20), `${name}: ${differences.length} changed verdicts`).toEqual([]);
      expect(recorded[name].length).toBe(expected[name].length);
    }
  }, 300_000);

  it("keeps the named privacy and shape refusals", () => {
    const s = richState() as Row;
    const check = (mutate: (state: Row) => void) => {
      const copy = clone(s);
      mutate(copy);
      return isValidStoredWardFlowState(copy);
    };
    expect(check(() => {})).toBe(true);
    // Refusals and repatriations are never restored.
    expect(check((x) => x.rejections.push({ id: "R-1" }))).toBe(false);
    expect(check((x) => x.repatriations.push({ id: "REP-1" }))).toBe(false);
    expect(check((x) => (x.supportNotifications = [{ id: "S-1" }]))).toBe(false);
    expect(check((x) => delete x.supportNotifications)).toBe(true);
    // Only fixed fields on a community treatment order and an absence.
    expect(check((x) => (x.patients[0].communityTreatmentOrder.note = "typed"))).toBe(false);
    expect(check((x) => (x.patients[0].communityTreatmentOrder.earlier[0].note = "typed"))).toBe(false);
    expect(check((x) => (x.leaveBeds[0].absentWithoutLeave.note = "typed"))).toBe(false);
    expect(check((x) => (x.leaveBeds[0].absentWithoutLeave.steps[0].note = "typed"))).toBe(false);
    // A patient holds text only, apart from the order and `addedAt`.
    expect(check((x) => (x.patients[1].extra = "text"))).toBe(true);
    expect(check((x) => (x.patients[1].extra = 1))).toBe(false);
    // Unknown keys elsewhere are tolerated today.
    expect(check((x) => (x.units[0].extra = 1))).toBe(true);
    expect(check((x) => (x.extra = { any: 1 }))).toBe(true);
    // Non-finite numbers and prototype keys are refused anywhere.
    expect(check((x) => (x.clockOffsetMinutes = NaN))).toBe(false);
    expect(check((x) => (x.units[0].extra = Infinity))).toBe(false);
    expect(check((x) => Object.defineProperty(x.units[0], "__proto__", { value: 1, enumerable: true }))).toBe(false);
    // A stored discharge barrier is a list value, never free text.
    expect(check((x) => (x.admissions[0].dischargeBarrier = "typed text"))).toBe(false);
    expect(check((x) => (x.scenario = "unknown"))).toBe(false);
    // An undo step type that names an Object.prototype member is refused. The hand-written
    // validator threw a TypeError here instead; the zod rewrite refuses it.
    for (const undoType of ["constructor", "toString", "__proto__", "hasOwnProperty"])
      expect(check((x) => (x.undoRecords[2].undoType = undoType))).toBe(false);
    expect(check((x) => (x.auditSequence = 1))).toBe(false);
    expect(isValidStoredWardFlowState(null)).toBe(false);
    expect(isValidStoredWardFlowState([])).toBe(false);
    expect(isValidStoredWardFlowState("state")).toBe(false);
  });

  it("migrates only a v6 shape and passes the current version through", () => {
    const s = richState();
    expect(WARD_FLOW_STORED_STATE_VERSION).toBe(7);
    expect(migrateStoredWardFlowState(s, 7)).toBe(s);
    expect(migrateStoredWardFlowState("anything", 7)).toBe("anything");
    const v6 = without(s, "plannedAdmissions", "plannedAdmissionSequence");
    const migrated = migrateStoredWardFlowState(v6, 6) as Row;
    expect(migrated.plannedAdmissions).toEqual([]);
    expect(migrated.plannedAdmissionSequence).toBe(0);
    expect(isValidStoredWardFlowState(migrated)).toBe(true);
    expect(migrateStoredWardFlowState(s, 6)).toBeNull();
    expect(migrateStoredWardFlowState({ ...v6, plannedAdmissions: [] }, 6)).toBeNull();
    expect(migrateStoredWardFlowState({ ...v6, plannedAdmissionSequence: 0 }, 6)).toBeNull();
    for (const version of [5, 8, "7", "6", null, undefined, 6.5, NaN])
      expect(migrateStoredWardFlowState(v6, version)).toBeNull();
    for (const state of [null, [], "state", 6]) expect(migrateStoredWardFlowState(state, 6)).toBeNull();
  });

  it("fills only the absent stream A inbox records", () => {
    const s = richState() as Row;
    const older = without(s, "inboxOwnership", "inboxSnoozes");
    expect(isValidStoredWardFlowState(older)).toBe(true);
    const filled = withInboxStreamADefaults(older as never) as Row;
    expect(filled.inboxOwnership).toEqual({});
    expect(filled.inboxSnoozes).toEqual({});
    expect((withInboxStreamADefaults(s as never) as Row).inboxSnoozes).toBe(s.inboxSnoozes);
  });
});
