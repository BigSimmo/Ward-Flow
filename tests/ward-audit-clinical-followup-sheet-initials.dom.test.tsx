// Clinical follow-up to audit M103 (Josh, 10 Nov 2026, D-130): the printed Call sheet and the bed
// meeting and capacity meeting sheets name a person by initials and UMRN only, never in full.
// Synthetic seed only.
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BedMeetingSheetDialog } from "@/components/ward-management/capacity/capacity-meeting-sheet-dialog";
import { CallSheet } from "@/components/ward-management/coordinator/call-sheet";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { resolveSubjectPatient, sheetPatientLabel } from "@/components/ward-management/ward-patient-resolver";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/x",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
afterEach(cleanup);

const seed = seedWardFlowState();
const SHEET_LABEL = /[A-Z]{2} · UM\d{6}/u;
const familyNames = [...new Set(seed.patients.map((patient) => patient.familyName))].filter((name) => name.length > 2);
const namesAnybody = (text: string) => familyNames.filter((name) => text.includes(name));

describe("M103 follow-up: sheets show initials and UMRN only", () => {
  it("builds the label from initials and UMRN", () => {
    expect(sheetPatientLabel({ initials: "AP", umrn: "UM100026" })).toBe("AP · UM100026");
  });

  it("the Call sheet shows initials and UMRN, and no family name", () => {
    const { getByTestId } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CallSheet />
      </WardFlowProvider>,
    );
    const text = getByTestId("ward-call-sheet").textContent ?? "";
    expect(text).toMatch(SHEET_LABEL);
    expect(namesAnybody(text)).toEqual([]);
  });

  it("the bed meeting sheet, built the way the screens build it, names nobody in full", () => {
    const lookup = { patients: seed.patients, referrals: seed.referrals, movements: seed.movements };
    const sheet = bedMeetingSheet({
      units: allUnits(),
      movements: wardMovements,
      bedReleases,
      admissions: wardAdmissions,
      leaveBeds,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      service: null,
      nameOf: (movement) => sheetPatientLabel(resolveSubjectPatient(movement, lookup)),
    });
    const { baseElement } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingSheetDialog open onClose={() => {}} sheet={sheet} now={NOW_ANCHOR} />
      </WardFlowProvider>,
    );
    const text = baseElement.textContent ?? "";
    expect(text).toMatch(SHEET_LABEL);
    expect(namesAnybody(text)).toEqual([]);
  });

  it("Capacity and the bed meeting agenda build their sheets with the sheet label", () => {
    const dir = "src/components/ward-management";
    const capacity = readFileSync(join(dir, "capacity/capacity-screen.tsx"), "utf8");
    expect(capacity).toContain("nameOf: (movement) => sheetPatientLabel(patientOf(movement)),");
    const agenda = readFileSync(join(dir, "bed-meeting/bed-meeting-agenda-screen.tsx"), "utf8");
    expect(agenda).toContain("nameOf: (movement) => sheetPatientLabel(patientOf(movement)),");
    expect(agenda).toContain("name: sheetPatientLabel(patientOf(row.record)),");
    const callSheet = readFileSync(join(dir, "coordinator/call-sheet.tsx"), "utf8");
    expect(callSheet).not.toContain("formalName");
  });
});
