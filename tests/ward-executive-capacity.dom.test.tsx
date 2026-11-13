import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({
  operational: vi.fn(() => {
    throw new Error("Executive capacity read operational rows");
  }),
}));
const phone = vi.hoisted(() => ({ value: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.value,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "executive", scope: { kind: "statewide" } }),
}));
// The signed-in executive has no operational provider (WF-06): any read of one fails the test.
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/ward-flow-provider")>()),
  useWardFlow: guard.operational,
  useWardFlowSelect: guard.operational,
  useWardFlowClock: guard.operational,
}));

import { CapacityRoute } from "../src/components/ward-management/capacity/capacity-route";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { wardServiceOrder } from "../src/components/ward-management/ward-derivations";

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

afterEach(() => {
  phone.value = false;
  cleanup();
  vi.clearAllMocks();
});

function renderReport() {
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
      now={150}
      controls={{ executive: true, paused: false, togglePause: null }}
    >
      <CapacityRoute />
    </ExecutiveStatisticsProvider>,
  );
}

describe("Capacity for a signed-in executive (WF-06)", () => {
  it("loads from the aggregate report, without the operational workspace", () => {
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        <CapacityRoute />
      </ExecutiveStatisticsProvider>,
    );
    // Wave 4 (C7): the band hero with count labels, as Capacity's.
    expect(screen.getByTestId("ward-capacity-executive")).toHaveTextContent(/Beds ready and in use/u);
    expect(screen.getByTestId("ward-capacity-executive-ready")).toHaveTextContent(/Ready · now/u);
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    expect(screen.getByRole("table", { name: /Beds by ward/u })).toBeInTheDocument();
    expect(screen.getByTestId("ward-capacity-executive-as-at")).toHaveTextContent(/^As at /u);
    expect(screen.getByTestId("ward-capacity-executive-as-at")).not.toHaveTextContent(/paused/u);
    expect(screen.getByTestId("ward-capacity-executive-footer")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("draws the band hero, the By service band and the grouped table with its totals row, and no actions", () => {
    renderReport();
    const { beds } = data.network;
    expect(screen.getByTestId("ward-capacity-executive-ready")).toHaveTextContent(
      `${beds.ready}/ ${beds.total} Ready · now`,
    );
    expect(screen.getByTestId("ward-capacity-executive-prep")).toHaveTextContent(
      `${beds.beingMadeReady} Being made ready · now`,
    );
    expect(screen.getByTestId("ward-capacity-executive-closed")).toHaveTextContent(`${beds.closed} Closed · now`);
    expect(screen.getByTestId("ward-capacity-executive-as-at")).toHaveTextContent(
      // PR C's time words (C owns time wording): day, year, clock and the clock's zone label.
      /^As at \w{3} \d{1,2} \w+ \d{4}, \d\d:\d\d (demo time|AWST) · bed counts only, no patient details$/u,
    );
    const band = screen.getByTestId("ward-capacity-executive-services");
    expect(band).toHaveTextContent(/By service · now/u);
    for (const service of data.services.filter((entry) => entry.wards > 0))
      expect(within(band).getByTestId(`ward-capacity-executive-service-${service.service}`)).toHaveTextContent(
        new RegExp(`^${service.service} ${service.beds.ready} ready .*in use · ${service.beds.closed} closed$`, "u"),
      );
    const table = screen.getByRole("table", { name: /Beds by ward/u });
    // F-51 (PR C): eight ward rows, then Show more; the totals row still counts every ward.
    expect(within(table).getAllByTestId("bed-squares-strip")).toHaveLength(Math.min(data.wards.length, 8));
    const more = screen.queryByRole("button", { name: /^Show \d+ more$/u });
    if (more) fireEvent.click(more);
    expect(within(table).getAllByRole("rowheader").length).toBeGreaterThanOrEqual(data.wards.length);
    expect(within(table).getAllByTestId("bed-squares-strip")).toHaveLength(data.wards.length);
    expect(screen.getByTestId("ward-capacity-executive-total")).toHaveTextContent(
      `All ${data.wards.length} wards${beds.ready}${beds.beingMadeReady}${beds.inUse}${beds.closed}${beds.total}`,
    );
    // Shared spec 6: the desk sees no action it cannot use (the Live chip's pause is the page's own).
    const main = screen.getByTestId("ward-capacity-executive");
    const buttons = within(main)
      .queryAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    // The list's own Show more / Show fewer (F-51) changes what is shown, not the record.
    expect(buttons.filter((name) => !/pause|resume|live|^Show (\d+ more|fewer)$/iu.test(name ?? ""))).toEqual([]);
  });

  it("orders the services as the coordinator's bed map does: North, East, South, WACHS, Private", () => {
    renderReport();
    const populated = new Set(data.wards.map((ward) => ward.service));
    const expected = wardServiceOrder.filter((service) => populated.has(service));
    // F-51 (PR C): eight ward rows, then Show more; open every row before reading the groups.
    const more = screen.queryByRole("button", { name: /^Show \d+ more$/u });
    if (more) fireEvent.click(more);
    const table = screen.getByRole("table", { name: /Beds by ward/u });
    const drawn = [...table.querySelectorAll<HTMLElement>("tbody[data-testid]")].map((group) =>
      (group.dataset.testid ?? "").replace("ward-capacity-executive-group-", ""),
    );
    expect(drawn).toEqual(expected);
    expect(expected.slice(0, 3)).toEqual(["North Metro", "East Metro", "South Metro"]);
  });

  it("on a phone lists wards in the bed-squares form, later service groups folded", () => {
    phone.value = true;
    renderReport();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = screen.getByTestId("ward-capacity-executive-list");
    const toggles = within(list).getAllByRole("button");
    expect(toggles.map((button) => button.getAttribute("aria-expanded"))).toEqual(
      toggles.map((_, index) => String(index < 2)),
    );
    const folded = toggles[2]!;
    fireEvent.click(folded);
    expect(folded).toHaveAttribute("aria-expanded", "true");
    const first = data.wards[0]!;
    expect(screen.getByTestId(`ward-capacity-executive-ward-${first.id}`)).toHaveTextContent(
      new RegExp(`^${first.beds.ready}ready of ${first.beds.total} beds`, "u"),
    );
  });

  it("marks a paused report beside its as-at time", () => {
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
        now={150}
        controls={{ executive: true, paused: true, togglePause: null }}
      >
        <CapacityRoute />
      </ExecutiveStatisticsProvider>,
    );
    expect(screen.getByTestId("ward-capacity-executive-as-at")).toHaveTextContent(/report paused/u);
  });

  it("names the chosen service on a service-scoped report, and the whole network otherwise (PR C's scope words)", () => {
    const service = data.wards[0].service;
    const scoped = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "service", service } },
      {
        now: NOW_ANCHOR,
        dayZero: "2026-09-22T16:00:00.000Z",
        startedAt: "2026-10-23T02:42:00.000Z",
        places: wardPlaceLookup(state.units),
      },
    );
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: scoped }}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        <CapacityRoute />
      </ExecutiveStatisticsProvider>,
    );
    expect(screen.getByRole("group", { name: `${service} beds` })).toBeInTheDocument();
    // The hero says the service above its title, on a phone too.
    const hero = document.querySelector('[data-phone-eyebrow="show"]');
    expect(hero?.querySelector("[data-wf-hero-title-line]")?.previousElementSibling).toHaveTextContent(service);
    cleanup();
    renderReport();
    expect(screen.getByRole("group", { name: "Network beds" })).toBeInTheDocument();
    expect(document.querySelector("[data-phone-eyebrow]")).toBeNull();
  });

  it("says the figures are unavailable when the report is absent", () => {
    render(
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={null}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        <CapacityRoute />
      </ExecutiveStatisticsProvider>,
    );
    expect(screen.queryByTestId("ward-capacity-executive")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-unavailable")).toHaveTextContent(/Statistics are unavailable/u);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByTestId("ward-capacity-executive-footer")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });
});
