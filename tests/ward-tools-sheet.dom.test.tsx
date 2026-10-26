import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardFormTimes } from "@/components/ward-management/tools/ward-form-times";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import {
  DEFAULT_BED_FINDER_FILTERS,
  findBeds,
  WardBedFinder,
} from "@/components/ward-management/tools/ward-bed-finder";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderSheet(isPhone = false) {
  const onNavigate = vi.fn();
  const onNewReferral = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardToolsSheet
        isPhone={isPhone}
        roleLabel="Bed coordinator"
        onNavigate={onNavigate}
        onNewReferral={onNewReferral}
      />
    </WardFlowProvider>,
  );
  return { onNavigate, onNewReferral };
}

describe("Tools sheet mockup (Tools review, 15 Oct 2026)", () => {
  it("is one sheet in the reviewed groups, with the repeated items gone", () => {
    renderSheet();
    for (const group of ["Do now", "Look up", "Print and share", "More pages"]) {
      expect(screen.getByRole("region", { name: group })).toBeTruthy();
    }
    for (const gone of [
      "Service now",
      "Figures at a glance",
      "Appearance",
      "Ward Flow Digest",
      "Shift desk",
      "Utilities",
      "Directory",
    ]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.queryByRole("link", { name: /Settings/u })).toBeNull();
  });

  it("keeps working tools only on a desktop, as change 8 mocked (D-77)", () => {
    renderSheet();
    // Each has its own place already, and the demo controls open from the Synthetic pill.
    expect(screen.queryByRole("region", { name: "Demo" })).toBeNull();
    expect(screen.queryByTestId("ward-tools-toggle-demo")).toBeNull();
    for (const gone of [/New referral/u, /Handover sheet/u, /Bed meeting TV/u, /Out of area/u]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
      expect(screen.queryByRole("link", { name: gone })).toBeNull();
    }
    expect(screen.getByRole("link", { name: /Log a delay/u })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Legal forms/u })).toBeTruthy();
  });

  it("starts a referral from Do now on a phone, which has no Synthetic pill and keeps its Tools", () => {
    const { onNewReferral } = renderSheet(true);
    expect(screen.getByRole("region", { name: "Demo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Handover sheet/u })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Out of area/u })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /New referral/u }));
    expect(onNewReferral).toHaveBeenCalledTimes(1);
    expect(onNewReferral).toHaveBeenCalledWith();
  });

  it("starts a community referral from a catchment result", () => {
    const { onNewReferral } = renderSheet();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-catchment"));
    fireEvent.change(screen.getByLabelText("Search by Suburb or Postcode"), { target: { value: "Morley" } });
    fireEvent.click(screen.getByRole("button", { name: "Start a community referral" }));
    expect(onNewReferral).toHaveBeenCalledWith("community");
  });

  it("opens a tool in place and closes it again", () => {
    renderSheet();
    const toggle = screen.getByTestId("ward-tools-toggle-bed-finder");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // Audit 24-1 decision 1: no legal status is assumed, so the tool opens asking for one.
    expect(within(screen.getByTestId("ward-tools-bed-finder")).getByRole("status").textContent).toMatch(
      /Choose a legal status/u,
    );
    fireEvent.click(toggle);
    expect(screen.queryByTestId("ward-tools-bed-finder")).toBeNull();
  });

  // Audit 24-1 decision 1 replaced the six-ward shortlist: every ward in scope is listed.
  it.each([6, 7])("lists all %i wards in scope, with no shortlist", (count) => {
    function MatchingWards() {
      const flow = useWardFlow();
      const template = findBeds(flow.units, [], { ...DEFAULT_BED_FINDER_FILTERS, legalStatus: "voluntary" })[0]?.unit;
      if (!template) throw new Error("the fixture needs one matching adult ward");
      const units = Array.from({ length: count }, (_, index) => ({
        ...template,
        id: `finder-${index + 1}`,
        name: `Finder ward ${index + 1}`,
      }));
      // An override reaches the finder's field reads as well as whole-value readers.
      return (
        <WardFlowOverride value={{ ...flow, units, bedReleases: [] }}>
          <WardBedFinder onNavigate={vi.fn()} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MatchingWards />
      </WardFlowProvider>,
    );
    const finder = screen.getByTestId("ward-tools-bed-finder");
    fireEvent.click(
      within(within(finder).getByRole("group", { name: "Legal status" })).getByRole("button", { name: "Voluntary" }),
    );
    expect(within(finder).getByRole("status")).toHaveTextContent(`${count} wards`);
    expect(
      within(within(finder).getByRole("list", { name: "Ready beds by ward" })).getAllByRole("listitem"),
    ).toHaveLength(count);
    expect(within(finder).queryByText(/Showing 6 of/u)).not.toBeInTheDocument();
  });

  it("offers no unbuilt rows, and keeps Bed meeting TV off the phone", () => {
    renderSheet(true);
    // Escalation check stays out until its trigger values are signed (Tools polish, 15 Oct 2026).
    expect(screen.queryByRole("button", { name: /Escalation check/u })).toBeNull();
    expect(screen.queryByText("Not wired in this prototype.")).toBeNull();
    expect(screen.queryByRole("button", { name: /Bed meeting TV/u })).toBeNull();
    expect(screen.queryByRole("link", { name: /Bed meeting TV/u })).toBeNull();
  });

  it("opens a requested tool once, then tells the parent so a later open starts closed", async () => {
    const onRequestHandled = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet
          isPhone
          roleLabel="Bed coordinator"
          onNavigate={vi.fn()}
          onNewReferral={vi.fn()}
          openRequest={{ tool: "demo", seq: 1 }}
          onRequestHandled={onRequestHandled}
        />
      </WardFlowProvider>,
    );
    expect(await screen.findByTestId("ward-tools-demo-panel")).toBeTruthy();
    await vi.waitFor(() => expect(onRequestHandled).toHaveBeenCalledTimes(1));
  });

  it("keeps the phone's demo controls together behind one Demo row", () => {
    renderSheet(true);
    fireEvent.click(screen.getByTestId("ward-tools-toggle-demo"));
    const panel = screen.getByTestId("ward-tools-demo-panel");
    expect(within(panel).getByRole("radiogroup", { name: "Demo scenario" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "+15 min" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Reset demo" })).toBeTruthy();
    // The one tap Demo reset (#298) lives in the same panel, behind its own flag.
    expect(within(panel).getByTestId("ward-demo-reset-winter-surge")).toBeTruthy();
    // Its three scenarios load from the reset, after a confirm, so the picker does not repeat them.
    const picker = within(panel).getByRole("radiogroup", { name: "Demo scenario" });
    expect(within(picker).queryByRole("radio", { name: /Winter surge/u })).toBeNull();
    expect(within(picker).getByRole("radio", { name: /Standard day/u })).toBeTruthy();
  });

  it("opens every figure in place without repeating the headline figures (simplification A2)", () => {
    renderSheet();
    expect(screen.queryByTestId("ward-tools-service-now")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-figures"));
    expect(screen.getByTestId("ward-stats-drawer-content")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open statistics/u }).getAttribute("href")).toBe("/ward-flow/statistics");
  });
});

describe("Form times on the Perth clock", () => {
  afterEach(() => vi.useRealTimers());

  it("starts with no form, date or time, and shows a result only once all three are entered", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFormTimes />
      </WardFlowProvider>,
    );
    // Owner rule (19 Oct 2026): no MHA form type or form time is prefilled, and rule D5: the
    // result shows only what the person entered.
    expect(screen.getByRole("combobox", { name: "Form" })).toHaveValue("");
    expect(screen.getByLabelText("Date written on form")).toHaveValue("");
    expect(screen.getByLabelText("Time written on form")).toHaveValue("");
    expect(screen.getByRole("status").textContent).toBe("Not recorded");
    fireEvent.change(screen.getByLabelText("Time written on form"), { target: { value: "09:15" } });
    fireEvent.change(screen.getByLabelText("Date written on form"), { target: { value: "2026-09-26" } });
    expect(screen.getByRole("status").textContent).toBe("Not recorded");
    fireEvent.change(screen.getByRole("combobox", { name: "Form" }), { target: { value: "1A" } });
    expect(screen.getByRole("status").textContent).toContain("on the demo clock");
    // Any form a Legal forms record can carry, not only the ones with a clock.
    expect(screen.getByRole("option", { name: /^Form 4A/u })).toBeTruthy();
  });

  it("shows nothing for a cleared time rather than reading it as midnight", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFormTimes />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Form" }), { target: { value: "1A" } });
    fireEvent.change(screen.getByLabelText("Date written on form"), { target: { value: "2026-09-26" } });
    fireEvent.change(screen.getByLabelText("Time written on form"), { target: { value: "09:15" } });
    fireEvent.change(screen.getByLabelText("Time written on form"), { target: { value: "" } });
    expect(screen.getByRole("status").textContent).toBe("Not recorded");
  });
});
