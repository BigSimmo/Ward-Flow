import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/rph-adult-secure",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WF_PHONE_QUERY } from "@/components/wf";
import { daysInBed, LEAVING_DESTINATIONS, stayDayNumber } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";

/*
 * Audit P102: the bed drawer's Stay tile said "36d" while the patient page said "Day 37" for the
 * same person. Both were right (a duration and an ordinal, ward-admissions.ts `stayDayNumber`), but
 * side by side they read as a mismatch. The tile now gives the day the way the patient page does,
 * counting arrival as Day 1. Synthetic seed data only.
 *
 * Root-cause fix 2.4 (13 Nov 2026): the day is now the Perth calendar day of the stay, read from the
 * stay's own arrival, so the drawer renders a seeded stay rather than a bare duration.
 */
const SEEDED = seedWardFlowState().admissions.find(
  (admission) =>
    admission.unitId === allUnits()[0]!.id && admission.state === "occupied" && admission.arrivedAt !== null,
)!;

function show(phone: boolean, stayDays: number, admissionId = SEEDED.id) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: phone && query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  const item = {
    bedNumber: 3,
    bedLabel: "Bed 03",
    status: "occupied",
    statusText: "Inpatient",
    patientAlias: "Synthetic Person B",
    admissionId,
    stayAdmissionId: admissionId,
    stayDays,
  } as BedItem;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardBedDossierDrawer
        selectedBed={3}
        bedItem={item}
        unit={allUnits()[0]}
        onClose={() => {}}
        drawerLeavingDestination={LEAVING_DESTINATIONS[0].id}
        setDrawerLeavingDestination={() => {}}
        onRecordLeft={() => {}}
        bedDrawerRef={createRef<HTMLElement>()}
        onKeyDown={() => {}}
      />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("bed drawer stay day (audit P102)", () => {
  for (const phone of [false, true]) {
    it(`numbers the day as the patient page does, arrival as Day 1 (${phone ? "phone" : "desktop"})`, () => {
      const days = daysInBed(SEEDED, NOW_ANCHOR)!;
      show(phone, days);
      // Seeded arrivals sit before 10:42, so at the anchor the calendar day is the duration plus one.
      expect(stayDayNumber(SEEDED, NOW_ANCHOR)).toBe(days + 1);
      expect(screen.getAllByTitle(`Day ${days + 1}`).length).toBeGreaterThan(0);
      expect(screen.queryByTitle(`${days}d`)).toBeNull();
    });
  }

  it("never prints Day 0, and gives no day for a stay it cannot find", () => {
    show(false, 0, "adm-not-in-this-world");
    expect(screen.queryAllByTitle("Day 0")).toHaveLength(0);
    expect(screen.getAllByTitle("Not recorded").length).toBeGreaterThan(0);
  });
});
