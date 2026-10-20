import { readFileSync } from "node:fs";

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
import { BedMeetingTvScreen, WardTvView } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import {
  TV_ROW_LIMIT,
  edTvSheet,
  meetingTvExtras,
  tvHealthServices,
  tvServiceFromParam,
  tvServiceParam,
  wardTvSheet,
} from "@/components/ward-management/bed-meeting/tv-derivations";
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
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
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
  it("does not keep the screen awake while the page is out of sight, as under the phone card", async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release }));
    let report: (isIntersecting: boolean) => void = () => {};
    class FakeObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        report = (isIntersecting) => callback([{ isIntersecting }]);
      }
      observe() {}
      disconnect() {}
    }
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    try {
      renderTv();
      await act(async () => {});
      expect(request).not.toHaveBeenCalled();
      act(() => report(true));
      await act(async () => {});
      expect(request).toHaveBeenCalledWith("screen");
      act(() => report(false));
      await act(async () => {});
      expect(release).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(navigator, "wakeLock");
    }
  });

  it("keeps the screen awake while shown, asks again on return and lets go on leaving", async () => {
    const release = vi.fn(() => Promise.resolve());
    const lock = { released: false, release };
    const request = vi.fn(() => Promise.resolve(lock));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    try {
      const view = renderTv();
      await act(async () => {});
      expect(request).toHaveBeenCalledWith("screen");
      // A held lock is not asked for twice.
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(async () => {});
      expect(request).toHaveBeenCalledTimes(1);
      // The browser drops the lock when the tab is hidden, so it is asked for again on return.
      lock.released = true;
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(async () => {});
      expect(request).toHaveBeenCalledTimes(2);
      view.unmount();
      expect(release).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, "wakeLock");
    }
  });

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
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      service: null,
      nameOf: () => "",
    });
    expect(figure("bed-meeting-tv-ready")).toBe(shown(sheet.capacity.ready));
    expect(figure("bed-meeting-tv-ed")).toBe(shown(sheet.ed.waiting));
    const { heldUp, confirmed, expected } = sheet.discharges;
    // Held up discharges are listed in the panel, so the headline counts them.
    expect(heldUp).toBeGreaterThan(0);
    expect(figure("bed-meeting-tv-discharges")).toBe(shown(heldUp + confirmed + expected));
    expect(figure("bed-meeting-tv-delays")).toBe(shown(sheet.delays.total));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bed meeting · All services");
    // The state screen reads in handover order: waiting, longest, beds, discharges, delays.
    const labels = within(screen.getByTestId("bed-meeting-tv-tiles"))
      .getAllByRole("term")
      .map((term) => term.firstElementChild?.textContent);
    expect(labels).toEqual(["Waiting in ED", "Longest ED wait", "Beds ready now", "Discharges due", "Delayed"]);
    // Every box says its state in words as well as colour.
    for (const tile of within(screen.getByTestId("bed-meeting-tv-tiles")).getAllByRole("term")) {
      expect(tile.textContent).toMatch(/Act now|Watch|Good|Steady/);
    }
  });

  it("shows each health service on the state screen, from that service's own bed meeting sheet", () => {
    const { state, inputs } = seedInputs();
    renderTv({ service: "all" });
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-view", "network");
    const services = tvHealthServices(state.units);
    const rows = within(screen.getByTestId("bed-meeting-tv-services-panel")).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.querySelector("th")?.textContent)).toEqual(
      services.map((service) => tvServiceParam(service).toUpperCase()),
    );
    for (const [index, service] of services.entries()) {
      const sheet = bedMeetingSheet({ ...inputs, service, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
      const cells = within(rows[index])
        .getAllByRole("cell")
        .map((cell) => cell.textContent);
      expect(cells[0]).toBe(String(sheet.ed.waiting));
      expect(cells[2]).toBe(String(sheet.capacity.ready));
      expect(cells[3]).toBe(String(sheet.capacity.lockedReady));
    }
  });

  it("gives every health service its own bed meeting screen with its wards", () => {
    const { state, inputs } = seedInputs();
    // The service with the most wards, so its table has rows.
    const service = [...tvHealthServices(state.units)].sort(
      (a, b) =>
        meetingTvExtras({ ...inputs, service: b, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).wards.length -
        meetingTvExtras({ ...inputs, service: a, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).wards.length,
    )[0];
    if (!service) throw new Error("expected a service with wards");
    const param = tvServiceParam(service);
    expect(tvServiceFromParam(param.toUpperCase(), state.units)).toBe(service);
    expect(tvServiceFromParam("all", state.units)).toBeNull();
    expect(tvServiceFromParam("nowhere", state.units)).toBeUndefined();
    expect(bedMeetingTvHref({ service: param })).toBe(`${WARD_BED_MEETING_TV_HREF}?service=${param}`);

    renderTv({ service: param });
    const sheet = bedMeetingSheet({ ...inputs, service, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    const extras = meetingTvExtras({ ...inputs, service, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`Bed meeting · ${service}`);
    expect(figure("bed-meeting-tv-ready")).toBe(shown(sheet.capacity.ready));
    expect(figure("bed-meeting-tv-ed")).toBe(shown(sheet.ed.waiting));
    const wardRows = within(screen.getByTestId("bed-meeting-tv-wards-panel")).getAllByRole("row").slice(1);
    expect(wardRows.map((row) => row.querySelector("th")?.textContent)).toEqual(extras.wards.map((ward) => ward.name));
    for (const ward of extras.wards) {
      const unit = state.units.find((candidate) => candidate.id === ward.id);
      if (!unit) throw new Error("expected the ward");
      // The service table's one pass agrees with each ward's own TV sheet.
      const own = wardTvSheet({ ...inputs, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
      expect(ward.ready).toBe(own.capacity.ready);
      expect(ward.lockedReady).toBe(own.capacity.lockedReady);
      expect(ward.asked).toBe(own.askedCount);
      expect(ward.coming).toBe(own.incoming.total);
      expect(ward.going).toBe(own.discharges.heldUp + own.discharges.confirmed + own.discharges.expected);
    }
    expect(screen.queryByTestId("bed-meeting-tv-services-panel")).toBeNull();
    const fit = within(screen.getByTestId("bed-meeting-tv-fit-panel")).getAllByRole("row").slice(1);
    expect(fit).toHaveLength(extras.gaps.length);
    for (const [index, row] of extras.gaps.entries()) {
      expect(fit[index]).toHaveTextContent(
        row.gap < 0 ? `Short ${-row.gap}` : row.gap === 0 ? "Enough" : `Spare ${row.gap}`,
      );
    }
  });

  it("says so when a link names a health service the network does not have", () => {
    renderTv({ service: "nowhere" });
    expect(screen.getByTestId("bed-meeting-tv-missing")).toHaveTextContent("This health service is not in the network");
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

  it("opens clean, with its own way back to the app and its own prototype line (DA-23)", () => {
    renderTv();
    const tv = screen.getByTestId("bed-meeting-tv");
    // The layout hides the rail, top bar and phone dock while this mark is on the screen.
    expect(tv).toHaveAttribute("data-wf-tv-clean");
    expect(within(tv).getByRole("link", { name: "Leave TV view" })).toHaveAttribute("href", "/ward-flow/capacity");
    expect(tv).toHaveTextContent("Synthetic prototype");
    expect(tv).toHaveTextContent("Not approved for clinical use");
    // Overall review (20 Oct 2026): the footer names the shift the rest of the app shows, and the
    // standard scenario is a day, so it never reads "Standard night" beside "Day shift".
    expect(tv).toHaveTextContent("Day shift · Scenario: Standard day");
    expect(tv).not.toHaveTextContent("Standard night");
    const layoutCss = readFileSync("src/app/ward-flow/ward-flow-layout.module.css", "utf8");
    expect(layoutCss).toMatch(/\.shellRow:has\(\[data-wf-tv-clean\]\) > \[data-testid="ward-rail"\]/u);
    expect(layoutCss).toMatch(/\.shellContent:has\(\[data-wf-tv-clean\]\) > \[data-testid="ward-bar"\]/u);
  });

  it("keeps its prototype line on a screen that is not in the network", () => {
    renderTv({ ward: "no-such-ward" });
    const tv = screen.getByTestId("bed-meeting-tv");
    expect(tv).toHaveAttribute("data-wf-tv-clean");
    expect(tv).toHaveTextContent("Synthetic prototype");
  });

  it("leaves the app's menus on the switched-off notice", () => {
    act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", false));
    renderTv();
    expect(screen.getByTestId("bed-meeting-tv-off")).not.toHaveAttribute("data-wf-tv-clean");
  });

  it("is a desktop page: a phone gets the larger screen card", () => {
    expect(isPhoneDesktopOnlyPath(WARD_BED_MEETING_TV_HREF)).toBe(true);
  });
});

describe("the ward and ED TV views", () => {
  it("links every bed meeting, ward and ED from the screen picker", () => {
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
    expect(hrefs).toContain(bedMeetingTvHref({ service: "all" }));
    for (const service of tvHealthServices(state.units)) {
      expect(hrefs).toContain(bedMeetingTvHref({ service: tvServiceParam(service) }));
    }
  });

  it("shows one ward's figures from the Shift brief's and bed meeting's own selectors", () => {
    const { state, inputs } = seedInputs();
    // The ward with the most people coming in, so the panels have rows.
    const unit = [...state.units].sort(
      (a, b) =>
        wardTvSheet({ ...inputs, unit: b, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).incoming.total -
        wardTvSheet({ ...inputs, unit: a, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).incoming.total,
    )[0];
    const sheet = wardTvSheet({ ...inputs, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
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
    // Waiting on this ward's answer comes first, then the people already accepted.
    expect(sheet.coming.rows.length).toBe(Math.min(TV_ROW_LIMIT, sheet.askedCount + sheet.incoming.total));
    expect(within(screen.getByTestId("ward-tv-incoming-panel")).getAllByRole("listitem").length).toBe(
      sheet.coming.rows.length,
    );
    const labels = within(screen.getByTestId("bed-meeting-tv-tiles"))
      .getAllByRole("term")
      .map((term) => term.firstElementChild?.textContent);
    expect(labels).toEqual(["Beds ready now", "Asked of this ward", "Coming in", "Going out", "Past expected date"]);
  });

  it("does not count a person this ward has already waitlisted as waiting on its answer", () => {
    const { state, inputs } = seedInputs();
    const movement = state.movements.find(
      (candidate) =>
        candidate.acceptedUnitId === undefined && candidate.referredUnitIds.length > 0 && !candidate.closure,
    );
    if (!movement) throw new Error("expected an unanswered referral");
    const unit = state.units.find((candidate) => candidate.id === movement.referredUnitIds[0]);
    if (!unit) throw new Error("expected the referred ward");
    const before = wardTvSheet({ ...inputs, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    const waitlisted = { ...movement, waitlistedUnitIds: [...(movement.waitlistedUnitIds ?? []), unit.id] };
    const movements = inputs.movements.map((candidate) => (candidate.id === movement.id ? waitlisted : candidate));
    const after = wardTvSheet({ ...inputs, movements, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(after.askedCount).toBe(before.askedCount - 1);
    expect(after.coming.rows.map((row) => row.id)).not.toContain(movement.id);
  });

  it("counts a re-referral as waiting when this ward's earlier waitlist ended with a withdrawal", () => {
    const { state, inputs } = seedInputs();
    const movement = state.movements.find(
      (candidate) =>
        candidate.acceptedUnitId === undefined && candidate.referredUnitIds.length > 0 && !candidate.closure,
    );
    if (!movement) throw new Error("expected an unanswered referral");
    const unit = state.units.find((candidate) => candidate.id === movement.referredUnitIds[0]);
    if (!unit) throw new Error("expected the referred ward");
    const service = unitHealthService(unit);
    if (!service) throw new Error("expected the ward's health service");
    const askedRow = (movements: typeof inputs.movements) =>
      meetingTvExtras({ ...inputs, movements, service, thresholds: DEFAULT_DUE_SOON_THRESHOLDS }).wards.find(
        (row) => row.id === unit.id,
      )?.asked;
    const before = wardTvSheet({ ...inputs, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    // Waitlisted, then withdrawn, then referred to the same ward again: the reducer keeps the marker.
    const stale = {
      ...movement,
      waitlistedUnitIds: [...(movement.waitlistedUnitIds ?? []), unit.id],
      declines: [...movement.declines, { unitId: unit.id, at: NOW_ANCHOR - 120_000, reason: "no_bed" as const }],
      withdrawnReferrals: [
        ...movement.withdrawnReferrals,
        { unitId: unit.id, at: NOW_ANCHOR - 60_000, reason: "coordinator_withdrew" as const },
      ],
    };
    const movements = inputs.movements.map((candidate) => (candidate.id === movement.id ? stale : candidate));
    const after = wardTvSheet({ ...inputs, movements, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(after.askedCount).toBe(before.askedCount);
    expect(after.coming.rows.map((row) => row.id)).toContain(movement.id);
    expect(askedRow(movements)).toBe(askedRow(inputs.movements));
  });

  it("says how many ready beds are still being made ready, without taking them off the figure", () => {
    const { state, inputs } = seedInputs();
    const unit = state.units.find((candidate) => state.bedReleases.some((release) => release.unitId === candidate.id));
    if (!unit) throw new Error("expected a ward with a release");
    const target = state.bedReleases.find((release) => release.unitId === unit.id);
    const bedReleases = inputs.bedReleases.map((release) =>
      release === target ? { ...release, state: "discharged" as const, preparing: true } : release,
    );
    const sheet = wardTvSheet({ ...inputs, bedReleases, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(sheet.pendingPreparation).toBe(
      bedReleases.filter((release) => release.unitId === unit.id && release.state === "discharged" && release.preparing)
        .length,
    );
    expect(sheet.pendingPreparation).toBeGreaterThan(0);
    render(<WardTvView sheet={sheet} now={NOW_ANCHOR} scenario="Synthetic" />);
    expect(screen.getByTestId("ward-tv-ready")).toHaveTextContent(`${sheet.pendingPreparation} still being made ready`);
  });

  it("shows one ED's figures from the ED board's own selectors", () => {
    const { state, inputs } = seedInputs();
    const accessTargetMinutes = state.configuration.edAccessTargetMinutes;
    const ed = [...allEmergencyDepartments()].sort(
      (a, b) =>
        (edTvSheet({ ...inputs, edId: b.id, accessTargetMinutes, thresholds: DEFAULT_DUE_SOON_THRESHOLDS })?.summary
          .waiting ?? 0) -
        (edTvSheet({ ...inputs, edId: a.id, accessTargetMinutes, thresholds: DEFAULT_DUE_SOON_THRESHOLDS })?.summary
          .waiting ?? 0),
    )[0];
    const sheet = edTvSheet({ ...inputs, edId: ed.id, accessTargetMinutes, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    if (!sheet) throw new Error("expected an ED sheet");
    renderTv({ ed: ed.id });
    expect(screen.getByTestId("bed-meeting-tv")).toHaveAttribute("data-view", "ed");
    expect(figure("ed-tv-waiting")).toBe(shown(sheet.summary.waiting));
    expect(figure("ed-tv-past-target")).toBe(shown(sheet.summary.pastAccessTarget));
    expect(figure("ed-tv-no-bed")).toBe(shown(sheet.noBed));
    expect(figure("ed-tv-bed-found")).toBe(shown(sheet.held));
    expect(sheet.summary.waiting).toBeGreaterThan(0);
    // One row fewer than the other lists, so the busiest ED still fits a 1080p screen; the rest are counted.
    const peopleShown = Math.min(sheet.people.length, TV_ROW_LIMIT - 1);
    expect(within(screen.getByTestId("ed-tv-people-panel")).getAllByRole("listitem").length).toBe(peopleShown);
    const peopleMore = sheet.morePeople + sheet.people.length - peopleShown;
    if (peopleMore > 0) {
      expect(screen.getByTestId("ed-tv-people-panel")).toHaveTextContent(`and ${peopleMore} more waiting`);
    }
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
      expect(screen.getByTestId("ward-demo-reset-confirm")).toHaveTextContent(
        "replaces the demo data in this browser only",
      );
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
