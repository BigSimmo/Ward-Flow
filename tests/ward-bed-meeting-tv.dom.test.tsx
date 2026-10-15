import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BedMeetingTvScreen, tvTileDesign } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { edTvSheet, wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { WardDemoReset } from "@/components/ward-management/demo-reset/ward-demo-reset";
import { isPhoneDesktopOnlyPath } from "@/components/ward-management/shell/ward-phone-desktop-only";
import {
  WARD_FEATURE_FLAGS_STORAGE_KEY,
  setWardFeatureFlagOnDevice,
} from "@/components/ward-management/shell/ward-feature-flag-store";
import { railEntries } from "@/components/ward-management/shell/ward-rail-entries";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_BED_MEETING_TV_HREF, bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("bed-meeting-tv", null);
    setWardFeatureFlagOnDevice("demo-reset", null);
  });
  window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
  activateScenarioNetwork("standard");
});

function renderTv(props: Parameters<typeof BedMeetingTvScreen>[0] = {}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <BedMeetingTvScreen {...props} />
    </WardFlowProvider>,
  );
}

const figure = (testId: string) => within(screen.getByTestId(testId)).getAllByRole("definition")[0].textContent;
const shown = (value: number) => (value === 0 ? "None" : String(value));

function seedInputs() {
  const state = seedWardFlowStateAt(0);
  return {
    state,
    inputs: {
      units: state.units,
      movements: state.movements,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      now: NOW_ANCHOR,
      nameOf: () => "",
    },
  };
}

describe("the bed meeting TV view", () => {
  it("shows the same figures as the printed bed meeting sheet", () => {
    renderTv();
    const state = seedWardFlowStateAt(0);
    const sheet = bedMeetingSheet({
      units: state.units,
      movements: state.movements,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      now: NOW_ANCHOR,
      service: null,
      nameOf: () => "",
    });
    expect(figure("bed-meeting-tv-ready")).toBe(shown(sheet.capacity.ready));
    expect(figure("bed-meeting-tv-locked")).toBe(shown(sheet.capacity.lockedReady));
    expect(figure("bed-meeting-tv-ed")).toBe(shown(sheet.ed.waiting));
    const { heldUp, confirmed, expected } = sheet.discharges;
    // Held up discharges are listed in the panel, so the headline counts them.
    expect(heldUp).toBeGreaterThan(0);
    expect(figure("bed-meeting-tv-discharges")).toBe(shown(heldUp + confirmed + expected));
    expect(figure("bed-meeting-tv-delays")).toBe(shown(sheet.delays.total));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bed meeting · All services");
  });

  it("is read only and shows initials, never full names, on the shared screen", () => {
    renderTv();
    const tv = screen.getByTestId("bed-meeting-tv");
    // Only leaving the view or going full screen; nothing that changes a record.
    const buttons = within(tv).queryAllByRole("button");
    expect(buttons.every((button) => button.dataset.testid === "bed-meeting-tv-fullscreen")).toBe(true);
    expect(tv.querySelector("input, select, textarea, form")).toBeNull();

    const state = seedWardFlowStateAt(0);
    const resolve = createPatientResolver(state);
    const waits = within(screen.getByTestId("bed-meeting-tv-waits-panel")).getAllByRole("listitem");
    expect(waits.length).toBeGreaterThan(0);
    for (const movement of state.movements) {
      const { displayName } = resolve({ movementId: movement.id });
      if (displayName.length > 3) expect(tv.textContent).not.toContain(displayName);
    }
  });

  it("says it is switched off, and leaves the menu, when its flag is off", () => {
    act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", false));
    renderTv();
    expect(screen.queryByTestId("bed-meeting-tv")).toBeNull();
    expect(screen.getByTestId("bed-meeting-tv-off")).toHaveTextContent("Turn them on in Settings");
    const off = railEntries((flag) => flag === undefined).map((entry) => entry.href);
    expect(off).not.toContain(WARD_BED_MEETING_TV_HREF);
    expect(railEntries().map((entry) => entry.href)).toContain(WARD_BED_MEETING_TV_HREF);
  });

  it("is a desktop page: a phone gets the larger screen card", () => {
    expect(isPhoneDesktopOnlyPath(WARD_BED_MEETING_TV_HREF)).toBe(true);
  });

  it("shows the recommended big box design unless a review link asks for another", () => {
    expect(tvTileDesign(undefined)).toBe("recommended");
    expect(tvTileDesign("bold")).toBe("bold");
    expect(tvTileDesign("nonsense")).toBe("recommended");
    renderTv({ tiles: "conservative" });
    expect(screen.getByTestId("bed-meeting-tv-tiles")).toHaveAttribute("data-design", "conservative");
    // Every box says its state in words as well as colour.
    for (const tile of within(screen.getByTestId("bed-meeting-tv-tiles")).getAllByRole("term")) {
      expect(tile.textContent).toMatch(/Act now|Watch|Good|Steady/);
    }
  });
});

describe("the ward and ED TV views", () => {
  it("links every ward and every ED from the screen picker", () => {
    expect(bedMeetingTvHref({ ward: "a b" })).toBe(`${WARD_BED_MEETING_TV_HREF}?ward=a%20b`);
    expect(bedMeetingTvHref({ ed: "peel-ed" })).toBe(`${WARD_BED_MEETING_TV_HREF}?ed=peel-ed`);
    renderTv();
    const picker = screen.getByTestId("bed-meeting-tv-picker");
    const hrefs = within(picker)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    const { state } = seedInputs();
    for (const unit of state.units) expect(hrefs).toContain(bedMeetingTvHref({ ward: unit.id }));
    for (const ed of allEmergencyDepartments()) expect(hrefs).toContain(bedMeetingTvHref({ ed: ed.id }));
  });

  it("keeps a review link's box design when changing screen", () => {
    renderTv({ tiles: "bold" });
    const hrefs = within(screen.getByTestId("bed-meeting-tv-picker"))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/[?&]tiles=bold$/);
  });

  it("shows one ward's figures from the Shift brief's and bed meeting's own selectors", () => {
    const { state, inputs } = seedInputs();
    // The ward with the most people coming in, so the panels have rows.
    const unit = [...state.units].sort(
      (a, b) => wardTvSheet({ ...inputs, unit: b }).incoming.total - wardTvSheet({ ...inputs, unit: a }).incoming.total,
    )[0];
    const sheet = wardTvSheet({ ...inputs, unit });
    renderTv({ ward: unit.id });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(unit.name);
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-view", "ward");
    expect(figure("ward-tv-ready")).toBe(shown(sheet.capacity.ready));
    expect(figure("ward-tv-incoming")).toBe(shown(sheet.incoming.total));
    expect(figure("ward-tv-asked")).toBe(shown(sheet.askedCount));
    expect(figure("ward-tv-going")).toBe(
      shown(sheet.discharges.heldUp + sheet.discharges.confirmed + sheet.discharges.expected),
    );
    expect(figure("ward-tv-overdue")).toBe(shown(sheet.overdue.length));
    expect(sheet.incoming.total).toBeGreaterThan(0);
    expect(within(screen.getByTestId("ward-tv-incoming-panel")).getAllByRole("listitem").length).toBe(
      sheet.incoming.rows.length,
    );
  });

  it("shows one ED's figures from the ED board's own selectors", () => {
    const { state, inputs } = seedInputs();
    const accessTargetMinutes = state.configuration.edAccessTargetMinutes;
    const ed = [...allEmergencyDepartments()].sort(
      (a, b) =>
        (edTvSheet({ ...inputs, edId: b.id, accessTargetMinutes })?.summary.waiting ?? 0) -
        (edTvSheet({ ...inputs, edId: a.id, accessTargetMinutes })?.summary.waiting ?? 0),
    )[0];
    const sheet = edTvSheet({ ...inputs, edId: ed.id, accessTargetMinutes });
    if (!sheet) throw new Error("expected an ED sheet");
    renderTv({ ed: ed.id });
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-view", "ed");
    expect(figure("ed-tv-waiting")).toBe(shown(sheet.summary.waiting));
    expect(figure("ed-tv-past-target")).toBe(shown(sheet.summary.pastAccessTarget));
    expect(figure("ed-tv-no-bed")).toBe(shown(sheet.noBed));
    expect(figure("ed-tv-bed-found")).toBe(shown(sheet.held));
    expect(sheet.summary.waiting).toBeGreaterThan(0);
    expect(within(screen.getByTestId("ed-tv-people-panel")).getAllByRole("listitem").length).toBe(sheet.people.length);
    expect(within(screen.getByTestId("ed-tv-trend-panel")).getAllByRole("listitem").length).toBe(sheet.trend.length);
    expect(screen.getByTestId("ed-tv-beds-ready")).toHaveTextContent(String(sheet.readyInService));
  });

  it("is read only and shows initials, never full names, on a ward or ED screen too", () => {
    const { state } = seedInputs();
    const resolve = createPatientResolver(state);
    const ed = allEmergencyDepartments()[0];
    for (const props of [{ ward: state.units[0].id }, { ed: ed.id }]) {
      const { unmount } = renderTv(props);
      const tv = screen.getByTestId("bed-meeting-tv");
      expect(tv.querySelector("input, select, textarea, form")).toBeNull();
      for (const movement of state.movements) {
        const { displayName } = resolve({ movementId: movement.id });
        if (displayName.length > 3) expect(tv.textContent).not.toContain(displayName);
      }
      unmount();
    }
  });

  it("says so when a link names a ward or ED that is not in the network", () => {
    renderTv({ ward: "no-such-ward" });
    expect(screen.getByTestId("bed-meeting-tv-missing")).toHaveTextContent("This ward is not in the network");
  });
});

function ScenarioProbe() {
  const { scenario } = useWardFlow();
  return <output data-testid="scenario">{scenario}</output>;
}

describe("the one tap demo reset", () => {
  it("loads each scenario through the shared reducer after one confirm", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardDemoReset />
        <ScenarioProbe />
      </WardFlowProvider>,
    );
    for (const [testId, scenario] of [
      ["ward-demo-reset-winter-surge", "winter-surge"],
      ["ward-demo-reset-ed-crisis", "ed-crisis"],
      ["ward-demo-reset-quiet-day", "quiet-day"],
    ] as const) {
      const before = screen.getByTestId("scenario").textContent;
      fireEvent.click(screen.getByTestId(testId));
      // It asks first: the shared workspace has no undo.
      expect(screen.getByTestId("scenario")).toHaveTextContent(before ?? "");
      expect(screen.getByTestId("ward-demo-reset-confirm")).toHaveTextContent("replaces the demo data for everyone");
      expect(screen.getByTestId("ward-demo-reset-confirm-load")).toHaveFocus();
      fireEvent.click(screen.getByTestId("ward-demo-reset-confirm-load"));
      expect(screen.queryByTestId("ward-demo-reset-confirm")).toBeNull();
      expect(screen.getByTestId("scenario")).toHaveTextContent(scenario);
      expect(screen.getByTestId(testId)).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("changes nothing when the reset is cancelled", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ScenarioProbe />
        <WardDemoReset />
      </WardFlowProvider>,
    );
    const before = screen.getByTestId("scenario").textContent;
    fireEvent.click(screen.getByTestId("ward-demo-reset-ed-crisis"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-demo-reset-confirm")).toBeNull();
    expect(screen.getByTestId("ward-demo-reset-ed-crisis")).toHaveFocus();
    expect(screen.getByTestId("scenario").textContent).toBe(before);
  });

  it("is absent while its flag is off", () => {
    act(() => setWardFeatureFlagOnDevice("demo-reset", false));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardDemoReset />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-demo-reset")).toBeNull();
  });
});
