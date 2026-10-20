import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
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
    for (const group of ["Do now", "Look up", "Print and share", "More pages", "Demo"]) {
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

  it("starts a referral from Do now", () => {
    const { onNewReferral } = renderSheet();
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
    expect(within(screen.getByTestId("ward-tools-bed-finder")).getByRole("status").textContent).toMatch(
      /synthetic beds free on/u,
    );
    fireEvent.click(toggle);
    expect(screen.queryByTestId("ward-tools-bed-finder")).toBeNull();
  });

  it.each([6, 7])("discloses the six-ward shortlist only when %i wards match", (count) => {
    function MatchingWards() {
      const flow = useWardFlow();
      const template = findBeds(flow.units, [], DEFAULT_BED_FINDER_FILTERS)[0]?.unit;
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
    expect(within(finder).getByRole("status")).toHaveTextContent(`${count} wards`);
    expect(
      within(within(finder).getByRole("list", { name: "Wards with a free bed" })).getAllByRole("listitem"),
    ).toHaveLength(6);
    const disclosure = within(finder).queryByText(
      `Showing 6 of ${count} matching wards. Narrow the filters to see other wards.`,
    );
    if (count > 6) expect(disclosure).toBeInTheDocument();
    else expect(disclosure).not.toBeInTheDocument();
  });

  it("offers no unbuilt rows, and keeps Bed meeting TV off the phone", () => {
    renderSheet(true);
    // Escalation check stays out until its trigger values are signed (Tools polish, 15 Oct 2026).
    expect(screen.queryByRole("button", { name: /Escalation check/u })).toBeNull();
    expect(screen.queryByText("Not wired in this prototype.")).toBeNull();
    expect(screen.queryByRole("button", { name: /Bed meeting TV/u })).toBeNull();
    expect(screen.queryByRole("link", { name: /Bed meeting TV/u })).toBeNull();
  });

  it("links Bed meeting TV on desktop while its flag is on, and hides it while the flag is off", () => {
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet isPhone={false} roleLabel="Bed coordinator" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("link", { name: /Bed meeting TV/u }).getAttribute("href")).toBe("/ward-flow/bed-meeting");
    unmount();
    act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", false));
    try {
      renderSheet();
      expect(screen.queryByRole("link", { name: /Bed meeting TV/u })).toBeNull();
    } finally {
      act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", null));
    }
  });

  it("opens a requested tool once, then tells the parent so a later open starts closed", async () => {
    const onRequestHandled = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet
          isPhone={false}
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

  it("keeps the demo controls together behind one Demo row", () => {
    renderSheet();
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
