import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow/bed-meeting",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { ExecutiveCapacityScreen } from "@/components/ward-management/capacity/capacity-executive-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

/** Fix package J3 (Audit 9, approved by Josh 13 Nov 2026). Synthetic seed only. */
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    setWardFeatureFlagOnDevice("bed-meeting-tv", null);
    resetWardAccessStoreForTests();
  });
});

describe("A9-16 (Q12): a site bed manager's TV is that site's bed meeting", () => {
  it("names the site even on an all-services link, and offers only that site's screens", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardFeatureFlagOnDevice("bed-meeting-tv", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingTvScreen service="all" />
      </WardFlowProvider>,
    );
    const site = siteByCode("RPH")!;
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(`Bed meeting · ${site.name}`);
    expect(heading).not.toHaveTextContent("All services");
    expect(screen.getByTestId("bed-meeting-tv-wards-panel")).toHaveTextContent("Wards in RPH");
    // No network brief or "By health service" table on a site's screen.
    expect(screen.queryByTestId("bed-meeting-tv-services-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bed-meeting-tv-brief-panel")).not.toBeInTheDocument();
    const picker = within(screen.getByRole("navigation", { name: "TV screens" }));
    expect(picker.queryByRole("link", { name: "All services" })).not.toBeInTheDocument();
    const links = picker.getAllByRole("link");
    const meetings = links.filter((link) => link.getAttribute("href")?.includes("service="));
    expect(meetings.map((link) => link.textContent)).toEqual([site.name]);
    expect(meetings[0]).toHaveAttribute("aria-current", "page");
    const eds = links.filter((link) => link.getAttribute("href")?.includes("ed="));
    expect(eds.map((link) => link.getAttribute("href"))).toEqual([
      `/ward-flow/bed-meeting?ed=${site.emergencyDepartment!.id}`,
    ]);
    const wardLinks = links.filter((link) => link.getAttribute("href")?.includes("ward="));
    const own = new Set(
      seedWardFlowState()
        .units.filter((unit) => unit.siteCode === "RPH")
        .map((unit) => unit.id),
    );
    expect(wardLinks.length).toBe(own.size);
    for (const link of wardLinks)
      expect(own.has(new URL(link.getAttribute("href")!, "http://x").searchParams.get("ward")!)).toBe(true);
  });

  it("leaves a statewide coordinator's all-services screen as it was", () => {
    act(() => {
      setWardFeatureFlagOnDevice("bed-meeting-tv", true);
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingTvScreen service="all" />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bed meeting · All services");
    expect(screen.getByTestId("bed-meeting-tv-services-panel")).toBeInTheDocument();
  });
});

describe("A9-17: the Executive desk's Capacity is drawn with the kit", () => {
  it("has the page wrapper, the hero, the kit table and a totals row that adds up", () => {
    const state = seedWardFlowState();
    const data = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: NOW_ANCHOR,
        dayZero: "2026-09-22T16:00:00.000Z",
        startedAt: "2026-10-23T02:42:00.000Z",
        places: wardPlaceLookup(state.units),
      },
    );
    const binding = { actorId: "synthetic-report-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        <ExecutiveCapacityScreen />
      </ExecutiveStatisticsProvider>,
    );
    const main = screen.getByTestId("ward-capacity-executive");
    // A styled page: inside Capacity's page wrapper, with a class on main and the band hero.
    expect(main.className).not.toBe("");
    expect(main.parentElement?.getAttribute("data-ward-design")).toBe("redesign-2026-10");
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(/Beds ready and in use/u);
    expect(screen.getByTestId("ward-capacity-executive-figures")).toHaveTextContent(String(data.network.beds.ready));
    const table = screen.getByRole("table", { name: /Beds by ward/u });
    expect(table.className).not.toBe("");
    const total = screen.getByTestId("ward-capacity-executive-total");
    // Wave 4 (C7, PR F): the first cell is the bed-picture column, empty on the totals row; the
    // figures then read Ready, Being made ready, In use, Closed, Beds.
    const cells = within(total)
      .getAllByRole("cell")
      .slice(1)
      .map((cell) => Number(cell.textContent));
    const sum = (pick: (beds: (typeof data.network.wards)[number]["beds"]) => number) =>
      data.network.wards.reduce((acc, ward) => acc + pick(ward.beds), 0);
    expect(cells).toEqual([
      sum((b) => b.ready),
      sum((b) => b.beingMadeReady),
      sum((b) => b.inUse),
      sum((b) => b.closed),
      sum((b) => b.total),
    ]);
    // The totals agree with the report's own network figures (Statistics' totals).
    expect(cells[0]).toBe(data.network.beds.ready);
    expect(cells[2]).toBe(data.network.beds.inUse);
    expect(cells[3]).toBe(data.network.beds.closed);
    expect(cells[4]).toBe(data.network.beds.total);
  });
});
