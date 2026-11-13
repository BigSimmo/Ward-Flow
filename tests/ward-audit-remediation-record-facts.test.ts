import { describe, expect, it } from "vitest";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

const seed = seedWardFlowState();
function record(movement: Movement, now = NOW_ANCHOR, admissions = seed.admissions) {
  return resolvePatientNowRecord(movement.id, seed.patients, [movement], seed.referrals, admissions, seed.units, now)!
    .record;
}

describe("audited patient history facts", () => {
  it("uses the community source rather than inventing an emergency department", () => {
    const movement = {
      ...seed.movements[0],
      originEdId: undefined,
      originCommunity: { teamName: "Synthetic team", siteCode: "BTY" },
    } as Movement;
    const presentation = record(movement).presentations[0];
    expect(presentation.where).toBe("Synthetic team (community)");
    expect(presentation.source).toBe("Synthetic team (community)");
  });

  it("uses a sending stay's ward rather than treating the transfer as ED or community", () => {
    const stay = seed.admissions.find((item) => item.state === "occupied")!;
    const movement = {
      ...seed.movements[0],
      sourceAdmissionId: stay.id,
      originEdId: undefined,
      originCommunity: undefined,
    } as Movement;
    const source = seed.units.find((unit) => unit.id === stay.unitId)!.name;
    expect(record(movement).presentations[0].where).toBe(source);
    expect(record(movement).presentations[0].source).toBe(source);
  });

  it("does not invent an origin when an ED identifier is unresolved", () => {
    const movement = { ...seed.movements[0], originEdId: "unknown-ed" } as Movement;
    expect(record(movement).presentations[0].where).toBe("Origin not recorded");
  });

  it("keeps a closed presentation duration unchanged when the clock advances", () => {
    const movement = {
      ...seed.movements[0],
      admissionId: undefined,
      openedAt: 100,
      closure: { at: 130, outcome: "did_not_proceed", reason: "Synthetic closure" },
    } as Movement;
    const before = record(movement, 160, []).presentations[0];
    const after = record(movement, 220, []).presentations[0];
    expect(after.los).toBe(before.los);
    expect(after.los).toBe("30m");
    expect(after.losFull).not.toContain(" at ");
  });

  it("caps a departed admission presentation at its recorded departure", () => {
    const stay = seed.admissions.find((item) => item.state === "departed" && item.patientId)!;
    const departed = { ...stay, movementId: "WF-AUDIT-ENDED" as const, leftAt: 160 };
    const movement = {
      ...seed.movements[0],
      id: "WF-AUDIT-ENDED",
      admissionId: departed.id,
      openedAt: 100,
    } as Movement;
    // RC 2.5 (F-35): the patient page uses the one duration format, "1h 00m".
    expect(record(movement, 220, [departed]).presentations[0].los).toBe("1h 00m");
  });

  it("retains declined and accepted ward answers after the outstanding queue empties", () => {
    const [declined, accepted] = seed.units;
    const movement = {
      ...seed.movements[0],
      referredUnitIds: [],
      declines: [{ unitId: declined.id, at: 110, reason: "no_suitable_bed" }],
      acceptedUnitId: accepted.id,
      acceptedAt: 120,
    } as Movement;
    const answers = record(movement).presentations[0].asked;
    expect(answers.some((answer) => answer.ward === declined.name && answer.outcome === "Declined")).toBe(true);
    expect(answers.some((answer) => answer.ward === accepted.name && answer.outcome === "Accepted")).toBe(true);
  });

  it("shows a waitlist answer once, as Waitlisted, never as a decline or still awaiting", () => {
    const [ward] = seed.units;
    const movement = {
      ...seed.movements[0],
      referredUnitIds: [ward.id],
      waitlistedUnitIds: [ward.id],
      declines: [{ unitId: ward.id, at: 110, reason: "no_suitable_bed" }],
      referralAnswerHistory: [{ unitId: ward.id, at: 110, answer: "waitlisted" }],
      acceptedUnitId: undefined,
    } as Movement;
    const rows = record(movement).presentations[0].asked.filter((answer) => answer.ward === ward.name);
    expect(rows.map((row) => row.outcome)).toEqual(["Waitlisted"]);
    expect(rows[0].why).toBe("No suitable bed");
  });
});

describe("audited discharge date consistency", () => {
  it("updates linked admission and pending release dates atomically while preserving release history", () => {
    const release = seed.bedReleases.find(
      (item) =>
        item.state !== "discharged" &&
        item.admissionId &&
        seed.admissions.some((stay) => stay.id === item.admissionId && stay.state !== "departed"),
    )!;
    const admission = seed.admissions.find((stay) => stay.id === release.admissionId)!;
    const expected = release.expectedAt + 120;
    const after = wardFlowReducer(seed, {
      type: "RECORD_DISCHARGE_PLAN_CHANGE",
      role: "ward",
      now: NOW_ANCHOR + 1,
      releaseId: release.id,
      actingUnitId: release.unitId,
      expectedAt: expected,
    });
    expect(after.rejections).toHaveLength(seed.rejections.length);
    const saved = after.admissions.find((stay) => stay.id === admission.id)!;
    expect(saved.expectedDischargeAt).toBe(expected);
    expect(saved.dischargeDateSetAt).toBe(NOW_ANCHOR + 1);
    expect(saved.dischargeDateMoves).toBe(
      admission.dischargeDateMoves +
        (admission.expectedDischargeAt !== null && admission.expectedDischargeAt !== expected ? 1 : 0),
    );
    expect(after.bedReleases.find((item) => item.id === release.id)?.planChanges?.at(-1)?.fact).toBe("expected_date");
    for (const old of seed.bedReleases.filter((item) => item.state === "discharged"))
      expect(after.bedReleases.find((item) => item.id === old.id)?.expectedAt).toBe(old.expectedAt);
  });
});
