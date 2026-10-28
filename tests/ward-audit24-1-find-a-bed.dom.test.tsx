import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";
import { WardBedFinder } from "@/components/ward-management/tools/ward-bed-finder";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Audit 24-1 decision 1 (CS2-12): Find a bed lists every ward A to Z with its Ready count and when
// it was recorded. It must never rank wards, cap the list or assume a legal status.

/** Synthetic ward names with Ready counts chosen so a most-free-first sort would differ from A to Z. */
const WARDS: readonly [name: string, ready: number][] = [
  ["Wattle ward", 5],
  ["Banksia ward", 1],
  ["Karri ward", 4],
  ["Acacia ward", 2],
  ["Jarrah ward", 6],
  ["Marri ward", 3],
  ["Tuart ward", 7],
  ["Boronia ward", 2],
];

function renderFinder() {
  function Wards() {
    const flow = useWardFlow();
    const template = flow.units.find((unit) => !unit.isClosed && unit.cohort === "Adult" && unit.authorised);
    if (!template) throw new Error("the fixture needs one open authorised adult ward");
    const units: Unit[] = WARDS.map(([name, ready], index) => ({
      ...template,
      id: `finder-${index + 1}`,
      name,
      allocatable: { ...template.allocatable, value: ready },
      empty: { ...template.empty, value: ready },
    }));
    return (
      <WardFlowOverride value={{ ...flow, units, bedReleases: [] }}>
        <WardBedFinder onNavigate={vi.fn()} />
      </WardFlowOverride>
    );
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Wards />
    </WardFlowProvider>,
  );
  return screen.getByTestId("ward-tools-bed-finder");
}

function chooseVoluntary(finder: HTMLElement) {
  fireEvent.click(
    within(within(finder).getByRole("group", { name: "Legal status" })).getByRole("button", { name: "Voluntary" }),
  );
}

function listedNames(finder: HTMLElement) {
  return within(within(finder).getByRole("list"))
    .getAllByRole("listitem")
    .map((item) => item.querySelector("strong")?.textContent);
}

describe("Find a bed, audit 24-1 decision 1", () => {
  it("starts with no legal status chosen and lists no ward until one is", () => {
    const finder = renderFinder();
    const legal = within(finder).getByRole("group", { name: "Legal status" });
    for (const button of within(legal).getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
    expect(within(finder).queryByRole("list")).toBeNull();
    expect(within(finder).getByRole("status")).toHaveTextContent(
      "Choose Voluntary or Involuntary under Legal status to list wards. Involuntary lists only authorised wards.",
    );
  });

  it("lists wards A to Z by name, not by free beds", () => {
    const finder = renderFinder();
    chooseVoluntary(finder);
    const expected = WARDS.map(([name]) => name).sort((a, b) => a.localeCompare(b, "en-AU"));
    expect(listedNames(finder)).toEqual(expected);
  });

  it("shows every ward when more than six are in scope", () => {
    const finder = renderFinder();
    chooseVoluntary(finder);
    expect(WARDS.length).toBeGreaterThan(6);
    expect(within(within(finder).getByRole("list")).getAllByRole("listitem")).toHaveLength(WARDS.length);
    expect(within(finder).queryByText(/Showing 6 of/u)).toBeNull();
  });

  it("shows each ward's Ready count with the time it was recorded", () => {
    const finder = renderFinder();
    chooseVoluntary(finder);
    const first = within(within(finder).getByRole("list")).getAllByRole("listitem")[0]!;
    expect(first).toHaveTextContent("Acacia ward");
    expect(first).toHaveTextContent(/2 Ready/u);
    expect(first).toHaveTextContent(/Recorded \d{2}:\d{2}/u);
  });

  it("uses no fit, match, best or recommended wording", () => {
    const finder = renderFinder();
    chooseVoluntary(finder);
    expect(finder.textContent).not.toMatch(/\b(fits?|match(es|ing)?|best|recommended)\b/iu);
    expect(within(finder).getByRole("list", { name: "Ready beds by ward" })).toBeInTheDocument();
  });
});
