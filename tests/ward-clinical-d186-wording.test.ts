// @vitest-environment jsdom
/**
 * D-186 (Josh, 13 Nov 2026): wording only. An empty risk-flag list reads "None recorded" (Q2), a
 * hospital is "not set up for involuntary admissions (demo)" rather than "not authorised" (Q8),
 * legal-rule sentences describe app behaviour (Q9), and the record preview shows recorded gender
 * beside sex (Q13). Synthetic seed records and invented values only.
 */
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) =>
    createElement("a", { href, ...rest }, children),
}));

import { onceOnlyExtensionWarning } from "@/components/ward-management/legal-forms/legal-form-ledger";
import { attentionItems } from "@/components/ward-management/movements/movement-workspace-derivations";
import { PatientGlance } from "@/components/ward-management/patients/patient-glance";
import { handoverPackModel, type HandoverPackInput } from "@/components/ward-management/patients/patient-handover-pack";
import { RecordPreview } from "@/components/ward-management/search/record-preview";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import {
  CRITERIA_CTO_EXCLUDED,
  CRITERIA_VOLUNTARY_ONLY,
  criteriaEligibilityRefusal,
} from "@/components/ward-management/ward-discharge-criteria";
import { requiresAuthorisedDestination } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);

const WM = join(process.cwd(), "src", "components", "ward-management");
const source = (path: string) => readFileSync(join(WM, path), "utf8");

describe("Q2: an empty risk-flag list reads None recorded", () => {
  it("the patient band says None recorded for an empty referral flag list, never None flagged", () => {
    render(createElement(PatientGlance, { mode: "ward", riskFlags: [], riskFlagsWhen: "Sun 1 Nov" }));
    const risk = screen.getByTestId("ward-patient-glance-risk");
    expect(risk).toHaveTextContent("None recorded");
    expect(risk).toHaveTextContent("referral Sun 1 Nov");
    expect(risk).not.toHaveTextContent("None flagged");
  });

  it("the handover pack says None recorded on the referral", () => {
    const input = {
      movement: { id: "WF-SYNTH-1", legalStatus: "Voluntary", acceptedUnitId: "U-SYNTH" },
      patient: { name: "Testperson, Alex", umrn: "UM100001", ageSex: "41, female" },
      fromName: "Synthetic ED",
      wardName: "Synthetic Ward",
      riskFlags: [],
      clearance: undefined,
      edContacts: [],
      careContacts: [],
      checklist: [],
      now: 700,
    } as unknown as HandoverPackInput;
    const rows = handoverPackModel(input)
      .sections.flatMap((section) => section.rows)
      .filter((row) => row.label === "Risks");
    expect(rows.map((row) => row.value)).toEqual(["None recorded on the referral"]);
  });
});

describe("Q8: a hospital is not set up for involuntary admissions (demo)", () => {
  it("the movement workspace attention chip and sentence use the shared wording", () => {
    const seed = seedWardFlowState();
    const units = allUnits();
    const unauthorised = units.find((unit) => !unit.authorised)!;
    const base = seed.movements.find((m) => isOpen(m) && requiresAuthorisedDestination(m.legalStatus))!;
    expect(unauthorised, "fixture needs a unit that is not set up").toBeDefined();
    expect(base, "fixture needs an open movement that needs a set-up ward").toBeDefined();
    const movement: Movement = { ...base, acceptedUnitId: unauthorised.id };
    const item = attentionItems({
      movement,
      units,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      destination: unauthorised,
      open: true,
      blockerIsActive: false,
    }).find((entry) => entry.key === "unlawful");
    // D-189 item 9(a): every ward's authorisation is "not stated" until Q42 is signed, so the item is
    // not raised. Its wording, kept behind the switch, is still D-186 item 8's.
    expect(item).toBeUndefined();
    const text = source("movements/movement-workspace-derivations.ts");
    expect(text).toContain('chip: "Not set up for involuntary admissions (demo)"');
    expect(text).toMatch(/needs a ward set up for involuntary admissions \(demo\)/);
  });

  it.each([
    // D-189 items 6 and 8(a) replaced the hub pill (removed) and the drawer's Yes or No; D-209 item 9
    // shows the register reading there.
    ["capacity/capacity-ward-drawer.tsx", '["Involuntary admissions", authorisationValue(row.unit)]'],
    ["movements/movement-workspace-cockpit.tsx", "is not set up for involuntary admissions (demo), which"],
  ])("%s states the shared wording and no longer says not authorised", (path, wording) => {
    const text = source(path).replace(/\s+/g, " ");
    expect(text).toContain(wording);
    expect(text).not.toMatch(/Not authorised — |"Authorised hospital"|is not authorised to receive/);
  });
});

describe("Q9: sentences describe app behaviour, not a legal rule", () => {
  it("a second extension against the same 1A names the form as already recorded", () => {
    const movement = {
      id: "ZZ-SYNTH-1",
      legalForm: { code: "1A" },
      legalFormExpiryHistory: [{ at: 10, basis: "extension", dueAt: 100 }],
    } as unknown as Movement;
    const warning = onceOnlyExtensionWarning(movement);
    expect(warning).toBe("Form 1A already has an extension recorded. Form 1B is already recorded. Check the paper.");
    expect(warning).not.toMatch(/can only be made once/);
  });

  it("criteria led discharge refusals say what the app does", () => {
    expect(criteriaEligibilityRefusal("involuntary")).toBe(CRITERIA_VOLUNTARY_ONLY);
    expect(CRITERIA_VOLUNTARY_ONLY).toBe("Criteria led discharge is switched on for voluntary patients only.");
    expect(criteriaEligibilityRefusal("cto")).toBe(CRITERIA_CTO_EXCLUDED);
    expect(CRITERIA_CTO_EXCLUDED).toMatch(/It is switched on for voluntary patients only\.$/);
    for (const text of [CRITERIA_VOLUNTARY_ONLY, CRITERIA_CTO_EXCLUDED]) {
      expect(text).not.toMatch(/revoke|waits for/);
    }
  });
});

describe("Q13: the record preview shows recorded gender beside sex", () => {
  const seed = seedWardFlowState();
  type Patient = (typeof seed.patients)[number];
  const movement = seed.movements.find((candidate) => candidate.patientId !== undefined)!;
  const basePatient = seed.patients.find((candidate) => candidate.id === movement.patientId)!;

  function renderPreview(kind: "person" | "movement", gender: Patient["gender"]) {
    const patient = { ...basePatient, sex: "Male", gender } as Patient;
    render(
      createElement(RecordPreview, {
        selection: kind === "person" ? { kind, patient } : { kind, movement },
        referrals: [],
        movements: [movement],
        patients: [patient],
        units: allUnits(),
        now: NOW_ANCHOR,
        onClose: () => {},
      }),
    );
    return screen.getByTestId("ward-patient-search-preview");
  }

  for (const kind of ["person", "movement"] as const) {
    it(`${kind} branch: recorded gender sits beside sex`, () => {
      expect(renderPreview(kind, "Female")).toHaveTextContent(/Male · Gender: Female/);
    });

    it(`${kind} branch: no recorded gender reads Not recorded`, () => {
      expect(renderPreview(kind, undefined)).toHaveTextContent(/Male · Gender: Not recorded/);
    });
  }

  it("referral branch subtitle carries gender beside sex", () => {
    expect(source("search/record-preview.tsx")).toContain(
      '${linkedPatient.sex ?? "Sex unrecorded"} · Gender: ${linkedPatient.gender ?? "Not recorded"} · DOB',
    );
  });
});
