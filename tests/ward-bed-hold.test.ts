// Audit 13 Oct 2026 (A4-1, A4-4, A1-3, A1-4, A4-3, A1-11): one bed-hold rule shared by Movement
// detail, ED, Handover, the Ward page and the Home patient sheet, and a departure never stamps the
// ward's figures as confirmed. Synthetic data only.
import { describe, expect, it } from "vitest";

import { bedHold, BED_HOLD_AT_RISK_MINUTES } from "@/components/ward-management/ward-bed-hold";
import {
  buildPatientStatus,
  type PatientStatusContext,
} from "@/components/ward-management/patients/patient-status-card";
import { dueParts, isActNow, nextStep, type HandoverRow } from "@/components/ward-management/handover/handover-model";
import { bedGlyphTone, type BedItem } from "@/components/ward-management/ward/ward-beds-matrix";
import { wardActNowCount } from "@/components/ward-management/ward/ward-home-tab";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import type { Movement } from "@/components/ward-management/ward-model";

const NOW = 600;

describe("bedHold: the one rule", () => {
  it("is lapsed once the hold time has passed, at risk under an hour, held otherwise", () => {
    expect(bedHold(undefined, NOW)).toBeNull();
    expect(bedHold(NOW - 10, NOW)).toMatchObject({
      state: "lapsed",
      label: "Pull expired 10m ago",
      nextStep: "Move or release",
    });
    expect(bedHold(NOW, NOW)?.state).toBe("lapsed");
    expect(bedHold(NOW + 27, NOW)).toMatchObject({ state: "at-risk", label: "Pull 27m left", short: "27m left" });
    expect(bedHold(NOW + BED_HOLD_AT_RISK_MINUTES, NOW)?.state).toBe("held");
    expect(bedHold(NOW + 130, NOW)).toMatchObject({ state: "held", label: "Pull 2h 10m left" });
  });
});

describe("Movement detail (A4-1)", () => {
  const ctx = (pullExpiresAt: number): PatientStatusContext =>
    ({
      movement: {
        id: "WF-T",
        stage: "pulled",
        pullExpiresAt,
        referredUnitIds: [],
        declines: [],
        security: "Secure",
        cohort: "Adult",
        acceptedAt: NOW - 120,
      } as unknown as Movement,
      acceptedUnitName: "Test Ward",
      hasBedHold: true,
      now: NOW,
      dayZero: new Date(2026, 9, 13),
      onOpenPlacement: () => undefined,
      onClearance: () => undefined,
      onBookTransport: () => undefined,
      onArrivalTime: () => undefined,
      onRecordReturn: () => undefined,
      onMarkAbsent: () => undefined,
      onAbsenceStep: () => undefined,
      onRecordCto: () => undefined,
      onEndCto: () => undefined,
    }) as PatientStatusContext;

  it("shows a lapsed hold as act now with Move or release, never a green tick", () => {
    const status = buildPatientStatus("held", ctx(NOW - 10));
    const bed = status.cells.find((cell) => cell.key === "bed")!;
    expect(status.tone).toBe("danger");
    expect(bed.tone).toBe("danger");
    expect(bed.sub).toBe("Pull expired 10m ago");
    expect(bed.clear).toBe(false);
    expect(bed.action).toMatchObject({ kind: "button", label: "Move or release" });
  });

  it("gives a hold ending within the hour the amber at-risk dot, not act now", () => {
    const status = buildPatientStatus("held", ctx(NOW + 27));
    const bed = status.cells.find((cell) => cell.key === "bed")!;
    expect(bed.tone).toBe("warning");
    expect(bed.sub).toBe("Bed pulled, 27m left");
    expect(status.tone).not.toBe("danger");
  });
});

describe("Handover (A4-3, A4-4)", () => {
  const row = (pullExpiresAt: number) =>
    ({ stage: "pulled", pullExpiresAt, urgent: false, asked: [], declines: [] }) as unknown as HandoverRow;

  it("words a lapsed hold the same way and keeps it in Act now", () => {
    expect(isActNow(row(NOW - 10), NOW)).toBe(true);
    expect(nextStep(row(NOW - 10), NOW, NOW + 300, () => 0).text).toBe("Pull expired 10m ago. Move or release");
  });

  it("marks a hold ending within the hour at risk without promoting it to Act now", () => {
    expect(isActNow(row(NOW + 20), NOW)).toBe(false);
    expect(dueParts(row(NOW + 20), NOW)).toMatchObject({ what: "Pull ends", atRisk: true });
    expect(dueParts(row(NOW + 200), NOW)?.atRisk).toBeUndefined();
  });
});

describe("Ward page (A1-3)", () => {
  const bed = (pullExpiresAt: number): BedItem => ({
    bedNumber: 3,
    bedLabel: "Bed 03",
    status: "incoming",
    statusText: "Inbound",
    bedHold: bedHold(pullExpiresAt, NOW),
  });

  it("makes a lapsed hold act now and a hold under an hour at risk", () => {
    expect(bedGlyphTone(bed(NOW - 10))).toBe("danger");
    expect(bedGlyphTone(bed(NOW + 20))).toBe("warning");
    expect(bedGlyphTone(bed(NOW + 200))).toBe("info");
  });

  it("counts lapsed holds as one Act now row", () => {
    expect(wardActNowCount({ alerts: 0, incoming: 0, heldUp: 0, rollupOverdue: false, lapsedHolds: 2 })).toBe(1);
    expect(wardActNowCount({ alerts: 0, incoming: 0, heldUp: 0, rollupOverdue: false, stoppedHolds: 2 })).toBe(1);
    expect(wardActNowCount({ alerts: 0, incoming: 0, heldUp: 0, rollupOverdue: false })).toBe(0);
    // Audit A3-1: each absence on an order is its own Act now row, as on the shared task list.
    expect(wardActNowCount({ alerts: 0, incoming: 0, heldUp: 0, rollupOverdue: false, absences: 2 })).toBe(2);
  });
});

describe("a departure never stamps the census as confirmed (A1-11)", () => {
  it("moves the figures and leaves the confirmed time alone", () => {
    const state = seedWardFlowState();
    const voluntary = new Set(wardPatients.filter((p) => p.legalStatus === "Voluntary").map((p) => p.id));
    const admission = state.admissions.find(
      (candidate) =>
        candidate.state === "occupied" &&
        candidate.patientId !== null &&
        voluntary.has(candidate.patientId) &&
        !state.movements.some((movement) => movement.admissionId === candidate.id),
    )!;
    const unitBefore = state.units.find((unit) => unit.id === admission.unitId)!;
    const after = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: unitBefore.allocatable.confirmedAt + 30,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      leavingDestination: "discharged-to-the-community",
    });
    expect(after.rejections.length).toBe(state.rejections.length);
    const unitAfter = after.units.find((unit) => unit.id === admission.unitId)!;
    expect(unitAfter.allocatable.confirmedAt).toBe(unitBefore.allocatable.confirmedAt);
    expect(unitAfter.empty.confirmedAt).toBe(unitBefore.empty.confirmedAt);
  });
});
