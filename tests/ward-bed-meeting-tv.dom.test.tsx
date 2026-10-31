import { readFileSync } from "node:fs";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, replace, ...rest }: { children: ReactNode; href: string; replace?: boolean }) => (
    <a href={href} data-replace={replace ? "true" : undefined} {...rest}>
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
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_BED_MEETING_TV_HREF, bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { activateScenarioNetwork } from "@/components/ward-management/ward-scenarios";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

import {
  DEFAULT_DUE_SOON_THRESHOLDS,
  formatInstantWithDay,
  splitDuration,
} from "@/components/ward-management/ward-clock";
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

  // #315: a return to the tab while a request is still in flight must not start a second one, and
  // a lock that only arrives after the page has gone is let go at once, so no sentinel is left holding
  // the screen awake.
  it("never overlaps wake lock requests, and lets go of a lock that arrives after leaving", async () => {
    const release = vi.fn(() => Promise.resolve());
    const resolvers: ((lock: { released: boolean; release: () => Promise<void> }) => void)[] = [];
    const request = vi.fn(
      () =>
        new Promise<{ released: boolean; release: () => Promise<void> }>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    try {
      const view = renderTv();
      await act(async () => {});
      expect(request).toHaveBeenCalledTimes(1);
      // Hidden and back again before the browser answers: still one request in flight.
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(async () => {});
      expect(request).toHaveBeenCalledTimes(1);
      // The page goes before the lock arrives; the late lock is released, not kept.
      view.unmount();
      await act(async () => {
        resolvers[0]!({ released: false, release });
      });
      expect(release).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
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
    // CS-10 (Audit 1): the ready figure says how old it is, on the checking line under the tiles
    // (core pages redesign, 31 Oct 2026: each tile is one figure and one short line).
    expect(screen.getByTestId("bed-meeting-tv-checking")).toHaveTextContent(
      /^(Oldest count confirmed|\d+ wards? not confirmed since) \d\d:\d\d/,
    );
    // P025: the network mixes 60 and 90 minute wards, so the TV names the range.
    expect(screen.getByTestId("bed-meeting-tv-checking")).toHaveTextContent(/late after \d+( to \d+)? min/);
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
    expect(labels).toEqual([
      "Waiting in ED",
      "Longest ED wait",
      "Beds ready now",
      "Due out today and tomorrow",
      "Open movements",
    ]);
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

  it("is read only and names each person in full on the shared screen (Josh, 26 Oct 2026)", () => {
    renderTv();
    const tv = screen.getByTestId("bed-meeting-tv");
    // Only going full screen or locking the screen as a TV; nothing that changes a record.
    const buttons = within(tv).queryAllByRole("button");
    expect(
      buttons.every((button) => ["bed-meeting-tv-fullscreen", "tv-lock"].includes(button.dataset.testid ?? "")),
    ).toBe(true);
    expect(tv.querySelector("input, select, textarea, form")).toBeNull();

    const state = seedWardFlowStateAt(0);
    const resolve = createPatientResolver(state);
    const waits = within(screen.getByTestId("bed-meeting-tv-waits-panel")).getAllByRole("listitem");
    expect(waits.length).toBeGreaterThan(0);
    const names = state.movements
      // Surname first (D-83, core pages redesign).
      .map((movement) => resolve({ movementId: movement.id }).formalName)
      .filter((name) => name.length > 3);
    expect(names.some((name) => tv.textContent?.includes(name))).toBe(true);
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
    expect(tv).toHaveTextContent("Day shift · Demo data: Standard day");
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
    // The agenda below it has its own phone layout, so the larger screen card leaves it alone.
    expect(isPhoneDesktopOnlyPath(`${WARD_BED_MEETING_TV_HREF}/agenda`)).toBe(false);
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

  // #1004 review: a screen change replaces the TV entry, so Leave TV view still goes back past it.
  it("changes screen without adding to the back history", () => {
    renderTv();
    const links = within(screen.getByTestId("bed-meeting-tv-picker")).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("data-replace", "true");
  });

  it("closes the screen picker once a screen is chosen (WT-21)", () => {
    renderTv();
    const picker = screen.getByTestId("bed-meeting-tv-picker") as HTMLDetailsElement;
    picker.open = true;
    const link = within(picker).getAllByRole("link")[0];
    if (!link) throw new Error("the picker has no screens");
    // Stop the link navigating in jsdom; the close runs on the click itself.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(picker.open).toBe(false);
  });

  it("says what each time measures: the whole wait, and for a collected patient, the time on the road", () => {
    const { state, inputs } = seedInputs();
    // Overall review (20 Oct 2026): "In transit · 8h 00m" read as 8 hours in an ambulance.
    const collected = state.movements.find(
      (movement) =>
        movement.acceptedUnitId !== undefined &&
        movement.transport?.collectedAt !== undefined &&
        movement.transport.cancelledAt === undefined &&
        movement.stage !== "arrived" &&
        movement.closure === undefined,
    );
    if (!collected?.acceptedUnitId || collected.transport?.collectedAt === undefined)
      throw new Error("the seed has no collected patient");
    const unit = state.units.find((candidate) => candidate.id === collected.acceptedUnitId);
    if (!unit) throw new Error("the collected patient's ward is missing");
    const sheet = wardTvSheet({ ...inputs, unit, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    const row = sheet.coming.rows.find((candidate) => candidate.id === collected.id);
    expect(row?.stage).toBe(`In transit ${splitDuration(NOW_ANCHOR - collected.transport.collectedAt)}`);
    renderTv({ ward: unit.id });
    const items = within(screen.getByTestId("ward-tv-incoming-panel")).getAllByRole("listitem");
    for (const item of items) expect(item).toHaveTextContent(/\d+m waiting/u);
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
      declines: [
        ...movement.declines,
        { unitId: unit.id, at: NOW_ANCHOR - 120_000, reason: "no_suitable_bed" as const },
      ],
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
    // TV-03: accepted, with or without a pulled bed, as one figure; never "Bed found".
    expect(figure("ed-tv-accepted")).toBe(shown(sheet.held));
    expect(screen.getByTestId("ed-tv-accepted")).toHaveTextContent("Accepted");
    expect(screen.getByTestId("bed-meeting-tv")).not.toHaveTextContent("Bed found");
    // TV-04: the ED board's own "under a form" count and words, never "detained".
    expect(screen.getByTestId("ed-tv-waiting")).toHaveTextContent(`${sheet.underForm} under a form`);
    expect(screen.getByTestId("ed-tv-waiting")).not.toHaveTextContent("detained");
    expect(sheet.summary.waiting).toBeGreaterThan(0);
    // DA-22 (Josh 20 Oct 2026): at 24 px the ED view names five people so the busiest ED still fits a
    // 1080p screen; the rest are counted.
    const peopleShown = Math.min(sheet.people.length, 5);
    expect(within(screen.getByTestId("ed-tv-people-panel")).getAllByRole("listitem").length).toBe(peopleShown);
    const peopleMore = sheet.morePeople + sheet.people.length - peopleShown;
    if (peopleMore > 0) {
      expect(screen.getByTestId("ed-tv-people-panel")).toHaveTextContent(`and ${peopleMore} more waiting`);
    }
    expect(within(screen.getByTestId("ed-tv-trend-panel")).getAllByRole("listitem").length).toBe(sheet.trend.length);
    expect(screen.getByTestId("ed-tv-beds-ready")).toHaveTextContent(String(sheet.readyInService));
  });

  it("is read only and names people in full on a ward or ED screen too", () => {
    const { state, inputs } = seedInputs();
    const resolve = createPatientResolver(state);
    const accessTargetMinutes = state.configuration.edAccessTargetMinutes;
    const ed = allEmergencyDepartments().find(
      (each) =>
        (edTvSheet({ ...inputs, edId: each.id, accessTargetMinutes, thresholds: DEFAULT_DUE_SOON_THRESHOLDS })?.summary
          .waiting ?? 0) > 0,
    );
    if (!ed) throw new Error("expected an ED with someone waiting");
    const ward = state.units.find((unit) => state.admissions.some((admission) => admission.unitId === unit.id));
    if (!ward) throw new Error("expected an occupied ward");
    for (const props of [{ ward: ward.id }, { ed: ed.id }]) {
      const { unmount } = renderTv(props);
      const tv = screen.getByTestId("bed-meeting-tv");
      expect(tv.querySelector("input, select, textarea, form")).toBeNull();
      const names = [
        ...state.movements.map((movement) => resolve({ movementId: movement.id }).formalName),
        ...state.admissions.map((admission) => resolve(admission).formalName),
      ].filter((name) => name.length > 3 && name !== "Name not recorded");
      expect(names.some((name) => tv.textContent?.includes(name))).toBe(true);
      unmount();
    }
  });

  it("says when the ready figure was last confirmed, and how many wards are late (CS-10)", () => {
    const { state, inputs } = seedInputs();
    const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
    const unit = state.units[0];
    const fresh = wardTvSheet({ ...inputs, unit, thresholds });
    expect(fresh.bedCount).toEqual({
      wards: 1,
      notConfirmed: 0,
      oldestAt: unit.allocatable.confirmedAt,
      staleAfter: { min: unit.allocatable.staleAfterMinutes, max: unit.allocatable.staleAfterMinutes },
    });
    const first = render(<WardTvView sheet={fresh} now={NOW_ANCHOR} scenario="Synthetic" />);
    expect(screen.getByTestId("ward-tv-ready-age")).toHaveTextContent(
      `Confirmed ${formatInstantWithDay(unit.allocatable.confirmedAt, NOW_ANCHOR)}`,
    );
    // P025 (Josh, 27 Oct 2026, option B): each ward keeps its own time, and the TV says it.
    expect(screen.getByTestId("ward-tv-ready-age")).toHaveTextContent(
      `late after ${unit.allocatable.staleAfterMinutes} min`,
    );
    first.unmount();

    // Past the ward's own staleAfterMinutes: Capacity's rule, so both screens call it late.
    const lateAt = NOW_ANCHOR - unit.allocatable.staleAfterMinutes - 30;
    const late = { ...unit, allocatable: { ...unit.allocatable, confirmedAt: lateAt } };
    const units = inputs.units.map((each) => (each.id === unit.id ? late : each));
    const sheet = wardTvSheet({ ...inputs, units, unit: late, thresholds });
    render(<WardTvView sheet={sheet} now={NOW_ANCHOR} scenario="Synthetic" />);
    expect(screen.getByTestId("ward-tv-ready-age")).toHaveTextContent(
      `Not confirmed since ${formatInstantWithDay(lateAt, NOW_ANCHOR)}`,
    );
    expect(screen.getByTestId("ward-tv-ready")).toHaveAttribute(
      "data-tone",
      sheet.capacity.ready === 0 ? "danger" : "warning",
    );

    const before = meetingTvExtras({ ...inputs, service: null, thresholds }).bedCount;
    const after = meetingTvExtras({ ...inputs, units, service: null, thresholds }).bedCount;
    expect(after.notConfirmed).toBe(before.notConfirmed + 1);
    expect(after.oldestAt).toBe(Math.min(lateAt, before.notConfirmed > 0 ? (before.oldestAt ?? lateAt) : lateAt));
  });

  it("stops saying it updates on its own while the shared refresh is unavailable (CS-13)", () => {
    function SharedDown({ children }: { children: ReactNode }) {
      const value = useWardFlow();
      return (
        <WardFlowOverride value={{ ...value, shared: { enabled: true, status: "unavailable", error: null } }}>
          {children}
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SharedDown>
          <BedMeetingTvScreen />
        </SharedDown>
      </WardFlowProvider>,
    );
    const asAt = screen.getByTestId("bed-meeting-tv-as-at");
    expect(asAt).toHaveTextContent(/^Last updated \d\d:\d\d · connection unavailable, not updating$/);
    expect(asAt).not.toHaveTextContent("updates on its own");
  });

  it("freezes its figures while not updating and warns in red with the figures' age (TV-06)", () => {
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    function Clock() {
      const { dispatch, now } = useWardFlow();
      return [2, 5].map((minutes) => (
        <button
          key={minutes}
          type="button"
          data-testid={`advance-${minutes}`}
          onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
        />
      ));
    }
    const advance = (minutes: number) => fireEvent.click(screen.getByTestId(`advance-${minutes}`));
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Clock />
        <BedMeetingTvScreen />
      </WardFlowProvider>,
    );
    const longest = () => screen.getByTestId("bed-meeting-tv-longest").textContent;
    const before = longest();
    online.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("bed-meeting-tv-stale")).toHaveAttribute("data-level", "danger");
    expect(screen.getByTestId("bed-meeting-tv-stale")).not.toHaveTextContent(/Figures are/u);
    act(() => advance(2));
    act(() => advance(5));
    // The figures stay where they were when the screen last updated; the warning says how old.
    expect(longest()).toBe(before);
    const stale = screen.getByTestId("bed-meeting-tv-stale");
    expect(stale).toHaveAttribute("data-level", "danger");
    expect(stale).toHaveTextContent(/Figures are 7m old/u);
    online.mockRestore();
  });

  it("says a local screen updates in this browser only (TV-07) and keeps its prototype mark in the header (TV-08)", () => {
    renderTv();
    expect(screen.getByTestId("bed-meeting-tv-as-at")).toHaveTextContent("updates on its own, this browser only");
    const header = screen.getByTestId("bed-meeting-tv").querySelector("header");
    expect(header).toHaveTextContent("Synthetic prototype, not for clinical use");
  });

  it("names a long wait in words, not by colour alone (TV-10)", () => {
    renderTv();
    const css = readFileSync("src/components/ward-management/bed-meeting/bed-meeting-tv.module.css", "utf8");
    // Core pages redesign (31 Oct 2026): a triangle marks a long wait, not an underline that read as a link.
    expect(css).toMatch(/\.table tr\[data-long\] td\[data-wait\]::before \{\s*content: "▲"/u);
    // Past the 24 hour mark the time reads in days, so the words say it as well as the colour.
    for (const row of screen.getByTestId("bed-meeting-tv").querySelectorAll("li[data-long]")) {
      expect(row.querySelector("svg")).not.toBeNull();
      expect(row).toHaveTextContent(/\d+d/u);
    }
  });

  it("keeps 40px controls, a Bed column with room, and full tile rows at 1024 (browser check, 31 Oct 2026)", () => {
    const css = readFileSync("src/components/ward-management/bed-meeting/bed-meeting-tv.module.css", "utf8");
    // Change screen, Full screen, Lock as TV and Leave TV view: 40px, not the 52px row touch.
    expect(css).not.toMatch(/var\(--wf-row-touch\)/u);
    expect(css).toMatch(/\.action \{[^}]*min-height: 40px;/u);
    // Beds that fit sizes its columns to their words, so "Bed" never runs into "Waiting".
    expect(css).toMatch(/\.panels \[data-area="fit"\] \.table \{\s*table-layout: auto;/u);
    // Five tiles at three a row: the last two take half a row each, so no row ends in a gap.
    expect(css).toMatch(
      /\.tile:nth-child\(3n \+ 1\):nth-last-child\(2\),\s*\.tile:nth-child\(3n \+ 2\):last-child \{\s*grid-column: span 3;/u,
    );
    renderTv();
    expect(screen.getByTestId("bed-meeting-tv-tiles").children).toHaveLength(5);
  });

  it("says the ready beds' locked share plainly and counts releases held up (TV-11, NA3-02)", () => {
    renderTv();
    expect(screen.getByTestId("bed-meeting-tv-discharges")).toHaveTextContent(/\d+ releases? held up/u);
    expect(screen.getByTestId("bed-meeting-tv-ready")).not.toHaveTextContent(/locked, of/u);
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
      // WP-11 (Audit 1): focus lands on Cancel, never on the Load that replaces the data.
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
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
