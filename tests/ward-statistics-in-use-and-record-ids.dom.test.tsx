import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { StatisticsServicesIndexScreen } from "@/components/ward-management/statistics/statistics-services-index";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { NOW_ANCHOR, allUnits, wardSites } from "@/components/ward-management/ward-sites";
import { WF_PHONE_QUERY } from "@/components/wf";

/**
 * Remaining-pages audit, 13 Oct 2026.
 *
 * stats-1 and stats-2: every Statistics figure printed beside a % is the one in-use count
 * (Occupied + Pulled, `ward-occupancy.ts`), so Services, Overview and the ward page agree with
 * Home and Wards.
 *
 * stats-3 (Josh, 13 Oct 2026): Statistics shows record ids only, no patient name or UMRN, on phone
 * and desktop. Names stay on the live pages.
 */

const UMRN = /\bUM\d{6}\b/u;

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

type LiveState = ReturnType<typeof useWardFlow>;
let seed: LiveState;

function Probe({ capture }: { capture: (flow: LiveState) => void }) {
  capture(useWardFlow());
  return null;
}

function renderInProvider(node: ReactNode) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Probe
        capture={(flow) => {
          seed = flow;
        }}
      />
      {node}
    </WardFlowProvider>,
  );
}

function servicePercent(service: string): number | null {
  const codes = new Set(wardSites.filter((site) => site.service === service).map((site) => site.code));
  const units = seed.units.filter((unit) => codes.has(unit.siteCode));
  if (units.length === 0) return null;
  const figure = wardOccupancy(units, seed.admissions, seed.bedReleases);
  return Math.round(((figure.inUse ?? 0) / figure.beds) * 100);
}

describe("Statistics Services reads the one in-use figure (stats-1)", () => {
  it("prints each service's in-use percentage on the desktop hero", () => {
    renderInProvider(<StatisticsServicesIndexScreen />);
    for (const service of HEALTH_SERVICES) {
      const percent = servicePercent(service);
      if (percent === null) continue;
      expect(screen.getAllByText(`${percent}%`).length, service).toBeGreaterThan(0);
    }
  });

  it("prints each service's in-use count on phone", () => {
    asPhone();
    renderInProvider(<StatisticsServicesIndexScreen />);
    const body = screen.getByTestId("ward-statistics-services-phone");
    for (const service of HEALTH_SERVICES) {
      const codes = new Set(wardSites.filter((site) => site.service === service).map((site) => site.code));
      const units = seed.units.filter((unit) => codes.has(unit.siteCode));
      if (units.length === 0) continue;
      const figure = wardOccupancy(units, seed.admissions, seed.bedReleases);
      expect(body).toHaveTextContent(`${figure.inUse} of ${figure.beds} in use`);
    }
  });
});

describe("Statistics ward page (stats-2, stats-3)", () => {
  const unit = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
  if (!unit) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

  it("leads the hero with the in-use count beside its %", () => {
    renderInProvider(<StatisticsWardScreen unitId={unit.id} />);
    const figure = wardOccupancy([seed.units.find((each) => each.id === unit.id)!], seed.admissions, seed.bedReleases);
    const percent = Math.round((figure.inUse / figure.beds) * 100);
    expect(screen.getAllByText(`In use, ${percent}%`).length).toBeGreaterThan(0);
  });

  it("lists the phone roster by admission id, with no name or UMRN", () => {
    asPhone();
    renderInProvider(<StatisticsWardScreen unitId={unit.id} />);
    const roster = screen.getByRole("list", { name: "Admission roster" });
    const rows = within(roster).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.textContent).toMatch(/AD-/u);
    expect(roster.textContent).not.toMatch(UMRN);
  });
});

describe("Statistics community team (stats-3)", () => {
  it("shows no UMRN on the phone handover list", () => {
    asPhone();
    renderInProvider(<StatisticsCommunityScreen teamId="midland" />);
    const body = screen.getByTestId("ward-statistics-community-phone");
    expect(body.textContent).not.toMatch(UMRN);
  });
});
