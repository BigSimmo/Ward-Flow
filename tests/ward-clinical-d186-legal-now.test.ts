import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  resolvePatientNowRecord,
  type PatientLegalNow,
  type ResolvedPatientNow,
} from "@/components/ward-management/patients/patient-now-adapter";
import { PatientLegalNowCard } from "@/components/ward-management/patients/patient-now-cards";
import { PatientGlance } from "@/components/ward-management/patients/patient-glance";
import { patientMode, type PatientMode } from "@/components/ward-management/patients/patient-mode";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { applyHardCasesOverlay, HARD_CASE_IDS } from "@/components/ward-management/ward-hard-cases-demo";
import type { Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-186 Q7 (audit A9-31, Josh 13 Nov 2026): the patient page's top band and its Legal now card read
 * one legal reading and show only recorded facts. Before, a patient gone to ED read "Involuntary
 * inpatient" in the band and "No form in force" in the card. Synthetic seed data only.
 */
type State = ReturnType<typeof seedWardFlowState>;

function text(html: string): string {
  return html
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** What the screen hands the band and the card, by the screen's own rules (patient-now-screen.tsx). */
function page(state: State, patientId: string) {
  const resolved = resolvePatientNowRecord(
    patientId,
    state.patients,
    state.movements,
    state.referrals,
    state.admissions,
    state.units,
    NOW_ANCHOR,
  ) as ResolvedPatientNow;
  expect(resolved, `${patientId} resolves`).toBeDefined();
  const live = resolved.liveMovement;
  const leaveBed = resolved.liveAdmission
    ? state.leaveBeds.find((bed) => bed.admissionId === resolved.liveAdmission?.id)
    : undefined;
  const mode: PatientMode = patientMode({
    movement: live,
    admission: resolved.liveAdmission,
    leaveBed,
    patient: resolved.livePatient,
  });
  const stayCurrent = mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed";
  const movementInForce = Boolean(
    live && mode !== "idle" && mode !== "cto" && (!live.closure || (live.closure.outcome === "arrived" && stayCurrent)),
  );
  const heroMovement =
    stayCurrent && resolved.liveAdmission?.movementId
      ? state.movements.find((m) => m.id === resolved.liveAdmission?.movementId)
      : undefined;
  // The band's source movement by the rule the screen held before D-186 Q7, kept to prove the one
  // reading did not change which movement the band reads.
  const glanceMovement = movementInForce ? live : stayCurrent ? heroMovement : live;
  return { resolved, mode, glanceMovement, cardMovement: movementInForce ? live : undefined };
}

function render(state: State, patientId: string) {
  const { resolved, mode, glanceMovement, cardMovement } = page(state, patientId);
  const legalNow = resolved.legalNow;
  // The screen now hands the band legalNow.movement; it is the movement the band read before.
  expect(legalNow.movement).toBe(glanceMovement);
  const band = text(
    renderToStaticMarkup(
      createElement(PatientGlance, {
        mode,
        patient: resolved.livePatient,
        movement: legalNow.movement,
        legalNow,
        admission: resolved.liveAdmission,
      }),
    ),
  );
  const card = text(
    renderToStaticMarkup(
      createElement(PatientLegalNowCard, {
        movement: cardMovement,
        patient: resolved.livePatient,
        legalNow,
        onAllForms: () => undefined,
        absent: mode === "awol",
      }),
    ),
  );
  return { band, card, legalNow, mode };
}

/** A seed with one patient's legal status set, and nothing else changed. */
function withStatus(patientId: string, legalStatus: Patient["legalStatus"]): State {
  const state = seedWardFlowState();
  return {
    ...state,
    patients: state.patients.map((p) => (p.id === patientId ? { ...p, legalStatus } : p)),
  };
}

const seed = seedWardFlowState();

describe("D-186 Q7: the band and Legal now read one legal reading", () => {
  it("a ward inpatient on an order: both name the same status and the same form", () => {
    const onOrder = seed.patients.find((patient) => {
      const { mode, glanceMovement } = page(seed, patient.id);
      const movement = glanceMovement as Movement | undefined;
      return (
        mode === "ward" &&
        movement?.legalForm !== undefined &&
        movement.legalStatus !== undefined &&
        movement.legalStatus !== "Voluntary"
      );
    });
    expect(onOrder, "the seed has a ward inpatient on an order with a form").toBeDefined();
    const { band, card, legalNow } = render(seed, onOrder!.id);
    expect(legalNow.current).toBe(true);
    expect(legalNow.statusSource).toBe("movement");
    expect(legalNow.formSource).toBe("movement");
    expect(band).toContain(legalNow.status!);
    expect(band).toContain(`Form ${legalNow.form!.code}`);
    expect(card).toContain(`Form ${legalNow.form!.code}`);
    expect(card).not.toContain("No form in force");
    expect(card).not.toContain("No form recorded");
  });

  it("a patient gone to ED: the band's recorded status stands and the card no longer says no form is in force", () => {
    // PT-029 is at ED from a ward stay with no movement; the status is the patient record's own.
    const { band, card, legalNow, mode } = render(seed, "PT-029");
    expect(mode).toBe("ed");
    expect(legalNow).toMatchObject({ current: true, statusSource: "patient", formSource: "none" });
    expect(band).toContain(legalNow.status!);
    expect(legalNow.status).toBe("Involuntary inpatient");
    expect(card).toContain("No form recorded");
    expect(card).not.toContain("No form in force");
  });

  it("a missing person on an order: both name the status, and the card shows only what is recorded (D-187 item 8)", () => {
    // Nobody is absent without leave in the ordinary seed since PR C (the worked examples that held
    // one are opt-in, A16-14). The hard cases add one involuntary inpatient absent without leave;
    // the person is found through that leave bed, never a hard-coded id, and only the status is set.
    const withHardCases = applyHardCasesOverlay(seed, NOW_ANCHOR);
    const absentBed = withHardCases.leaveBeds.find((bed) => bed.id === HARD_CASE_IDS.involuntaryAwolLeaveBed);
    expect(absentBed?.absentWithoutLeave, "the hard cases hold an involuntary absence").toBeDefined();
    const patientId = withHardCases.admissions.find((admission) => admission.id === absentBed!.admissionId)?.patientId;
    expect(patientId, "the absent stay names its person").toBeTruthy();
    const state = {
      ...withHardCases,
      patients: withHardCases.patients.map((p) =>
        p.id === patientId ? { ...p, legalStatus: "Involuntary inpatient" as const } : p,
      ),
    };
    const { band, card, legalNow, mode } = render(state, patientId!);
    expect(mode).toBe("awol");
    expect(band).toContain("Involuntary inpatient");
    expect(card).toContain("Involuntary inpatient");
    expect(card).not.toContain("Order stays in force");
    expect(card).not.toContain("No form in force");
    expect(legalNow.statusSource).toBe("patient");
  });

  it("a voluntary patient: both read Voluntary and the card claims no order", () => {
    const state = withStatus("PT-029", "Voluntary");
    const { band, card, legalNow } = render(state, "PT-029");
    expect(legalNow.status).toBe("Voluntary");
    expect(band).toContain("Voluntary");
    expect(card).toContain("No form recorded");
    expect(card).not.toContain("Order stays in force");
    expect(card).not.toContain("No form in force");
  });

  it("nothing recorded on a current stay: the band says Not recorded and the card invents no form or status", () => {
    // PT-G-AD-RPHS-04 is at ED from a ward stay; neither the record nor a movement holds a status.
    const { band, card, legalNow } = render(seed, "PT-G-AD-RPHS-04");
    expect(legalNow).toMatchObject({ current: true, status: undefined, statusSource: "none", formSource: "none" });
    expect(band).toContain("Not recorded");
    expect(card).toContain("No form recorded");
    expect(card).not.toMatch(/Involuntary|Voluntary|in force/u);
  });

  it("nothing current and nothing recorded: the band says no order is in force and the card agrees", () => {
    const idle = seed.patients.find((patient) => {
      if (patient.legalStatus !== undefined || patient.communityTreatmentOrder !== undefined) return false;
      const { mode, glanceMovement } = page(seed, patient.id);
      return mode === "idle" && glanceMovement === undefined;
    });
    expect(idle, "the seed has a patient with nothing current or recorded").toBeDefined();
    const { band, card, legalNow } = render(seed, idle!.id);
    expect(legalNow).toMatchObject({ current: false, statusSource: "none", formSource: "none" });
    expect(band).toContain("No order in force");
    expect(card).toContain("No form in force");
  });

  it("the band's legal words come from legalNow, not from its own movement or patient", () => {
    const { resolved, mode } = page(seed, "PT-029");
    const reading: PatientLegalNow = {
      ...resolved.legalNow,
      status: "Synthetic status from the one reading",
      statusSource: "movement",
      form: { code: "3A" } as PatientLegalNow["form"],
      formSource: "movement",
    };
    const band = text(
      renderToStaticMarkup(
        createElement(PatientGlance, {
          mode,
          patient: { ...resolved.livePatient!, legalStatus: "Voluntary" },
          legalNow: reading,
          admission: resolved.liveAdmission,
        }),
      ),
    );
    expect(band).toContain("Synthetic status from the one reading");
    expect(band).toContain("Form 3A in force");
    expect(band).not.toContain("Voluntary");
    const card = text(
      renderToStaticMarkup(
        createElement(PatientLegalNowCard, {
          patient: { ...resolved.livePatient!, legalStatus: "Voluntary" },
          legalNow: { ...reading, form: undefined, movement: undefined },
          onAllForms: () => undefined,
          absent: true,
        }),
      ),
    );
    expect(card).toContain("Synthetic status from the one reading");
    expect(card).not.toContain("Voluntary");
  });
});
