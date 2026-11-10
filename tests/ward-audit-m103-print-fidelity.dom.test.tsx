// M103 (master audit, 10 Nov 2026): print fidelity, read from the rendered page. The static matrix in
// ward-audit-m103-print-fidelity.test.ts reads each sheet's source. This file renders the sheets that
// source-read flagged and checks what a printed copy actually carries: the time it was made and a
// second identifier beside every name (D-113). Page-break rules are CSS, which jsdom cannot prove, so
// "rows kept whole" stays a static lead. Synthetic seed only.

import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardDailySheet } from "@/components/ward-management/board/ward-daily-sheet";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BedMeetingSheetDialog } from "@/components/ward-management/capacity/capacity-meeting-sheet-dialog";
import { CallSheet } from "@/components/ward-management/coordinator/call-sheet";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { useWardReferralDrawerState } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import { ReferralLetterPreview } from "@/components/ward-management/referrals/ward-referral-drawer-letter";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { resolveSubjectPatient, sheetPatientLabel } from "@/components/ward-management/ward-patient-resolver";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
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

const inProvider = (ui: ReactNode) => <WardFlowProvider initialNow={NOW_ANCHOR}>{ui}</WardFlowProvider>;
const UMRN = /UM\d{6}/u;
/** The seeded people's family names, to tell whether a sheet names anybody. */
const FAMILY_NAMES = [...new Set(seedWardFlowState().patients.map((patient) => patient.familyName))];
const text = (root: HTMLElement) => root.textContent ?? "";
const namesAnybody = (value: string) => FAMILY_NAMES.some((name) => value.includes(name));

function Letter() {
  const s = useWardReferralDrawerState({
    onClose: () => {},
    onViewChange: () => {},
    onRestart: () => {},
    view: "new",
    initialPatientId: "PT-023",
  });
  return <ReferralLetterPreview s={s} />;
}

function meetingSheet() {
  const seed = seedWardFlowState();
  const lookup = { patients: seed.patients, referrals: seed.referrals, movements: seed.movements };
  return bedMeetingSheet({
    units: allUnits(),
    movements: wardMovements,
    bedReleases,
    admissions: wardAdmissions,
    leaveBeds,
    now: NOW_ANCHOR,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    service: null,
    // Built the way the screens build it (D-130): initials and UMRN.
    nameOf: (movement) => sheetPatientLabel(resolveSubjectPatient(movement, lookup)),
  });
}

describe("M103 rendered sheets: print time", () => {
  it("the call sheet says when it was prepared", () => {
    const { container } = render(inProvider(<CallSheet />));
    expect(text(container)).toMatch(/Prepared \d{2}:\d{2}/u);
  });

  it("the patient chronology says when it was generated, with the full date and zone", () => {
    const { container } = render(inProvider(<PatientChronologyScreen initialPatientId="PT-026" />));
    expect(text(container)).toMatch(/Generated \w{3} \d{1,2} \w{3} \d{4}, \d{2}:\d{2} AWST/u);
  });

  it("the weekly report says when it was generated", () => {
    const { container } = render(inProvider(<WeeklyReportScreen />));
    expect(text(container)).toMatch(/Generated \w{3} \d{1,2} \w{3} \d{4}\s*,?\s*\d{2}:\d{2} AWST/u);
  });

  it("the discharge board says when its list is as of", () => {
    const { container } = render(inProvider(<DischargeBoard />));
    expect(text(container)).toMatch(/As of \w{3} \d{1,2} \w{3} \d{4}, \d{2}:\d{2} AWST/u);
  });

  it("the referral letter carries its draft time", () => {
    const { container } = render(inProvider(<Letter />));
    expect(text(container)).toMatch(/Draft \d{2}:\d{2} AWST/u);
  });

  it("the daily sheet carries a shift timestamp", () => {
    const { container } = render(inProvider(<WardDailySheet now={NOW_ANCHOR} people={[]} />));
    expect(text(container)).toMatch(/Shift timestamp: \w{3} \d{1,2} \w{3} \d{4}, \d{2}:\d{2} AWST/u);
  });
});

describe("M103 rendered sheets: second identifier beside a name", () => {
  it("the chronology and the referral letter show the UMRN beside the name", () => {
    const chronology = render(inProvider(<PatientChronologyScreen initialPatientId="PT-026" />));
    expect(text(chronology.container)).toMatch(/Pendelbury, Alastair\s*UM100026/u);
    cleanup();
    const letter = render(inProvider(<Letter />));
    expect(text(letter.container)).toMatch(/Wren, Tobias\s*UMRN UM\d{6}/u);
  });

  it("the weekly report and the daily sheet name nobody, so need no second identifier", () => {
    const weekly = render(inProvider(<WeeklyReportScreen />));
    expect(namesAnybody(text(weekly.container))).toBe(false);
    cleanup();
    const daily = render(inProvider(<WardDailySheet now={NOW_ANCHOR} people={[]} />));
    expect(namesAnybody(text(daily.container))).toBe(false);
  });

  it("the discharge board shows a UMRN on the rows it names", () => {
    const { container } = render(inProvider(<DischargeBoard />));
    expect(text(container)).toMatch(UMRN);
  });

  // Fixed 10 Nov 2026 (D-130): the call sheet prints initials and UMRN, as D-113 asks.
  it("the call sheet shows a UMRN beside each name", () => {
    const { container } = render(inProvider(<CallSheet />));
    expect(text(container)).toMatch(UMRN);
  });

  // Fixed 10 Nov 2026 (D-130): the screens pass initials and UMRN as each row's name.
  it("the bed meeting sheet shows a UMRN beside each name", () => {
    const { baseElement } = render(
      inProvider(<BedMeetingSheetDialog open onClose={() => {}} sheet={meetingSheet()} now={NOW_ANCHOR} />),
    );
    expect(text(baseElement)).toMatch(UMRN);
  });
});
