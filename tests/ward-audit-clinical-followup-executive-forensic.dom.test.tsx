// Review on PR #1599 (M118): the executive bed finders read the aggregate report, not the units, so
// the report carries each ward's forensic flag and both finders leave forensic wards out of their
// lists and Ready totals, as the operational finder does. Synthetic seed only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "executive", scope: { kind: "statewide" } }),
}));

import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { WardBedFinder } from "../src/components/ward-management/tools/ward-bed-finder";
import { ToolFindBed } from "../src/components/ward-management/tools/ward-tool-find-bed";
import { seedWardFlowState, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const binding = { actorId: "synthetic-report-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };

function project(state: WardFlowState) {
  return projectExecutiveReportingFoundation(
    state,
    { role: "executive", scope: { kind: "statewide" } },
    {
      now: NOW_ANCHOR,
      dayZero: "2026-09-22T16:00:00.000Z",
      startedAt: "2026-10-23T02:42:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
}

const seed = seedWardFlowState();
const plain = project(seed);
// An open, non-forensic adult ward with Ready beds in the report, then marked forensic.
const target = plain.wards.find(
  (ward) => !ward.isClosed && !ward.forensic && ward.cohort === "Adult" && ward.beds.ready > 0,
);
if (!target) throw new Error("the seed needs an open adult ward with Ready beds");
const forensic = project({
  ...seed,
  units: seed.units.map((unit) => (unit.id === target.id ? { ...unit, forensic: true } : unit)),
});

function renderWith(data: typeof plain, finder: "sheet" | "tool") {
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
      now={150}
      controls={{ executive: true, paused: false, togglePause: null }}
    >
      {finder === "sheet" ? <WardBedFinder onNavigate={vi.fn()} /> : <ToolFindBed onNavigate={vi.fn()} />}
    </ExecutiveStatisticsProvider>,
  );
}

/** The finder's Ready total and ward count, after choosing Voluntary. */
function totals(data: typeof plain, finder: "sheet" | "tool") {
  // The tool remembers its filters, so each render starts from none chosen.
  window.localStorage.clear();
  renderWith(data, finder);
  const body = screen.getByTestId("ward-tools-bed-finder");
  const legal =
    finder === "sheet"
      ? within(body).getByRole("group", { name: "Legal status" })
      : within(body).getByRole("radiogroup", { name: "Legal status" });
  fireEvent.click(within(legal).getByRole(finder === "sheet" ? "button" : "radio", { name: "Voluntary" }));
  const text = within(body).getByRole("status").textContent ?? "";
  const [ready, wards] = (text.match(/\d+/gu) ?? []).map(Number);
  const names = within(within(body).getByRole("list", { name: "Ready beds by ward" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
  cleanup();
  return { ready: ready!, wards: wards!, names };
}

afterEach(() => cleanup());

describe("executive bed finders leave forensic wards out (M118)", () => {
  it("the report carries each ward's forensic flag", () => {
    expect(plain.wards.find((ward) => ward.id === target.id)?.forensic).toBe(false);
    expect(forensic.wards.find((ward) => ward.id === target.id)?.forensic).toBe(true);
  });

  for (const finder of ["sheet", "tool"] as const) {
    it(`the ${finder} finder drops a forensic ward from its list and its Ready total`, () => {
      const before = totals(plain, finder);
      const after = totals(forensic, finder);
      expect(before.names.some((name) => name.includes(target.name))).toBe(true);
      expect(after.names.some((name) => name.includes(target.name))).toBe(false);
      expect(after.wards).toBe(before.wards - 1);
      expect(after.ready).toBe(before.ready - target.beds.ready);
    });
  }
});
