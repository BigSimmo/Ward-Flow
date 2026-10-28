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

import whatsNew from "@/components/ward-management/help/whats-new.json";
import { WF_PHONE_QUERY } from "@/components/wf";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardBedDossierDrawer } from "@/components/ward-management/ward/ward-bed-dossier-drawer";
import type { BedItem } from "@/components/ward-management/ward/ward-bed-tone";

/*
 * Audit P102: the bed drawer's Stay tile said "36d" while the patient page said "Day 37" for the
 * same person. Both were right (a duration and an ordinal, ward-admissions.ts `stayDayNumber`), but
 * side by side they read as a mismatch. The tile now gives the day the way the patient page does,
 * counting arrival as Day 1. Synthetic seed data only.
 */
function show(phone: boolean, stayDays: number) {
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
    admissionId: "adm-stay",
    stayAdmissionId: "adm-stay",
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
      show(phone, 36);
      expect(screen.getAllByTitle("Day 37").length).toBeGreaterThan(0);
      expect(screen.queryByTitle("36d")).toBeNull();
    });
  }

  it("calls the day of arrival Day 1, not Day 0", () => {
    show(false, 0);
    expect(screen.getAllByTitle("Day 1").length).toBeGreaterThan(0);
  });
});

describe("What's new (P102)", () => {
  it("tells people the Stay tile now shows the day of the stay", () => {
    expect(whatsNew.map((entry) => entry.line)).toContain(
      'Bed drawer: the Stay tile now shows the day of the stay, for example "Day 37".',
    );
  });
});
