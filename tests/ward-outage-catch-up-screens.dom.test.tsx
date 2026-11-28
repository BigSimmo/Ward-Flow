import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

/*
 * Batch 4 items 24 and 25 (Josh approved the design review and its recommendations, 11 Nov 2026,
 * D-142): the screens over the model in `ward-downtime-pack-prints.ts` and `ward-outage-catch-up.ts`.
 * Synthetic data only. The model's own rules are pinned in `ward-pilot-control.test.ts`.
 */

const desk = vi.hoisted(() => ({ role: "coordinator" as string }));
vi.mock("@/components/ward-management/ward-role-gate", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-role-gate")>()),
  useRouteRole: () => desk.role,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";
import { forgetDowntimePack } from "@/components/ward-management/reports/downtime-pack";
import { HomeOutageCatchUp } from "@/components/ward-management/coordinator/home-outage-catch-up";
import { DowntimeOldPacksBand, NEVER_PRINTED } from "@/components/ward-management/reports/downtime-pack-old-band";
import {
  DowntimeRecordOutage,
  SAVE_NEEDS_BOTH_TIMES,
  SAVE_NEEDS_START_DAY,
  typedOutageWindow,
} from "@/components/ward-management/reports/downtime-pack-record-outage";
import { formatInstant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlowSelect, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardsWithOldPack } from "@/components/ward-management/ward-downtime-pack-prints";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardPackPrintedLine } from "@/components/ward-management/ward/ward-pack-printed-line";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { ToastProvider } from "@/components/wf";

const seed = seedWardFlowState();
const ward = seed.units[0]!;
const DAY = 24 * 60;
// 19 Nov 2026 (item 6): the demo starts with most wards' packs printed earlier today and two wards
// left never printed. `never` is the first of those two; `printedWards` is every other ward.
const neverIds = wardsWithOldPack(
  seed.downtimePackPrints,
  seed.units.map((unit) => unit.id),
  NOW_ANCHOR,
).map((row) => row.unitId);
const never = seed.units.find((unit) => unit.id === neverIds[0])!;
const printedWards = seed.units.filter((unit) => unit.id !== never.id);
// Ends after every seeded ward's last confirmation (10:32 at the latest), so no ward starts caught up.
const OUTAGE = { from: NOW_ANCHOR - 120, to: NOW_ANCHOR - 5 };
// A ward's own print during the outage, later than any seeded print (19 Nov 2026, item 6).
const PACK_AT = NOW_ANCHOR - 20;

/** Holds the provider's dispatch, so a test can record what another desk did. */
const handle: { dispatch: ((event: WardFlowEvent) => unknown) | null } = { dispatch: null };
function Grab() {
  const { dispatch } = useWardFlowSelect("dispatch");
  useLayoutEffect(() => {
    handle.dispatch = dispatch as (event: WardFlowEvent) => unknown;
  });
  return null;
}
function renderIn(node: ReactNode) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Grab />
        {node}
      </ToastProvider>
    </WardFlowProvider>,
  );
}
function record(event: WardFlowEvent) {
  act(() => {
    void handle.dispatch!(event);
  });
}
function printed(unitIds: string[], at: number) {
  record({ type: "RECORD_DOWNTIME_PACK_PRINTED", role: "coordinator", now: at, unitIds });
}
function outage() {
  record({ type: "RECORD_OUTAGE_WINDOW", role: "coordinator", now: NOW_ANCHOR, ...OUTAGE });
}

afterEach(() => {
  cleanup();
  forgetDowntimePack();
  vi.restoreAllMocks();
  desk.role = "coordinator";
  handle.dispatch = null;
});

describe("item 24: outage packs older than 24 hours", () => {
  it("lists each old ward with its last print, and never-printed wards as Never printed", () => {
    renderIn(<DowntimeOldPacksBand now={NOW_ANCHOR} />);
    // Every ward but one printed just now; that one has never printed.
    printed(
      printedWards.map((unit) => unit.id),
      NOW_ANCHOR,
    );
    const band = screen.getByTestId("ward-downtime-old-packs");
    // Root-cause fix 3.3: "never printed" is worded apart from "over 24h old".
    expect(band).toHaveTextContent("Outage packs never printed");
    expect(band).toHaveTextContent(`1 outage pack never printed · all ${seed.units.length} wards`);
    expect(within(band).getByTestId(`ward-downtime-old-pack-${never.id}`)).toHaveTextContent(
      `${never.name} ${NEVER_PRINTED}`,
    );
    printed([never.id], NOW_ANCHOR - DAY - 30);
    expect(band).toHaveTextContent("Outage packs over 24h old");
    expect(band).toHaveTextContent(`1 outage pack over 24h old · all ${seed.units.length} wards`);
    expect(screen.getByTestId(`ward-downtime-old-pack-${never.id}`)).toHaveTextContent(
      `${never.name} ${formatInstant(NOW_ANCHOR - DAY - 30)} yesterday`,
    );
    // Printed within the last 24 hours: no ward is old, so no band. (A second ward keeps this print
    // apart from the first one's, which the repeat-tap guard would answer instead.)
    printed([never.id, printedWards[0]!.id], NOW_ANCHOR);
    expect(screen.queryByTestId("ward-downtime-old-packs")).toBeNull();
  });

  it("folds a long list of never-printed and old wards behind Show more", () => {
    // Two days on, every seeded print is old, so every ward is listed: never printed first.
    renderIn(<DowntimeOldPacksBand now={NOW_ANCHOR + 2 * DAY} />);
    const band = screen.getByTestId("ward-downtime-old-packs");
    expect(band).toHaveTextContent(
      `${neverIds.length} outage packs never printed, ${seed.units.length - neverIds.length} over 24h old · all ${seed.units.length} wards`,
    );
    const rows = () => band.querySelectorAll('[data-testid^="ward-downtime-old-pack-"]');
    expect(rows()).toHaveLength(6);
    expect(within(band).getAllByText(NEVER_PRINTED)).toHaveLength(neverIds.length);
    fireEvent.click(screen.getByTestId("ward-downtime-old-packs-more"));
    expect(rows()).toHaveLength(seed.units.length);
  });

  it("My ward's Checking line says when its outage pack was last printed", () => {
    renderIn(<WardPackPrintedLine unitId={never.id} now={NOW_ANCHOR} />);
    expect(screen.getByTestId("ward-hero-pack-printed")).toHaveTextContent("Outage pack never printed");
    printed([never.id], NOW_ANCHOR - 30);
    expect(screen.getByTestId("ward-hero-pack-printed")).toHaveTextContent(
      `Outage pack last printed ${formatInstant(NOW_ANCHOR - 30)}`,
    );
  });
});

describe("the downtime pack screen", () => {
  it("shows the coordinator's last print under Print, and opens Record an outage from its chip", async () => {
    vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderIn(<DowntimePackScreen />);
    const print = await screen.findByTestId("ward-downtime-print");
    expect(screen.queryByTestId("ward-downtime-last-printed")).toBeNull();
    expect(screen.getByTestId("ward-downtime-old-packs")).toHaveTextContent(NEVER_PRINTED);
    fireEvent.click(print);
    // Root-cause fix 3.3: nothing is recorded until the person says it printed.
    expect(screen.queryByTestId("ward-downtime-last-printed")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect(await screen.findByTestId("ward-downtime-last-printed")).toHaveTextContent(
      `Last printed ${formatInstant(NOW_ANCHOR)}`,
    );
    expect(screen.queryByTestId("ward-downtime-old-packs")).toBeNull();

    const chip = screen.getByTestId("ward-downtime-record-outage-chip");
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("ward-downtime-record-outage")).toBeNull();
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("ward-downtime-record-outage")).toBeInTheDocument();
  });

  it("offers neither the chip nor the old packs band to a ward", async () => {
    desk.role = "ward";
    renderIn(<DowntimePackScreen />);
    await screen.findByTestId("ward-downtime-print");
    expect(screen.queryByTestId("ward-downtime-record-outage-chip")).toBeNull();
    expect(screen.queryByTestId("ward-downtime-old-packs")).toBeNull();
  });
});

describe("item 25: record an outage", () => {
  it("opens blank, with no day chosen, and Save waits for both times and the day", () => {
    renderIn(<DowntimeRecordOutage now={NOW_ANCHOR} onDone={() => undefined} />);
    const from = screen.getByLabelText("We were down from");
    const to = screen.getByLabelText(/^to/);
    expect(from).toHaveValue("");
    expect(to).toHaveValue("");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toHaveAttribute("aria-checked", "false");
    const save = screen.getByTestId("ward-downtime-outage-save");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(SAVE_NEEDS_BOTH_TIMES)).toBeInTheDocument();

    fireEvent.change(from, { target: { value: "06:40" } });
    expect(save).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(to, { target: { value: "09:05" } });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(SAVE_NEEDS_START_DAY)).toBeInTheDocument();
    // A press before it is complete records nothing.
    fireEvent.click(save);
    expect(screen.queryByTestId("ward-downtime-outage-problem")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Today" }));
    expect(screen.getByRole("radio", { name: "Today" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("ward-downtime-outage-save")).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText(SAVE_NEEDS_BOTH_TIMES)).toBeNull();
  });

  // Build of audit four, item 85: real typing (keyboard events, not a set value) turns Save on.
  it("turns Save on after typing both times with the keyboard and picking Today", async () => {
    const user = userEvent.setup();
    renderIn(<DowntimeRecordOutage now={NOW_ANCHOR} onDone={() => undefined} />);
    const save = screen.getByTestId("ward-downtime-outage-save");
    await user.type(screen.getByLabelText("We were down from"), "0900");
    await user.type(screen.getByLabelText(/^to/), "1000");
    expect(save).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("radio", { name: "Today" }));
    expect(screen.getByTestId("ward-downtime-outage-save")).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText(SAVE_NEEDS_BOTH_TIMES)).toBeNull();
    expect(screen.queryByText(SAVE_NEEDS_START_DAY)).toBeNull();
  });

  it("saves the typed window as RECORD_OUTAGE_WINDOW and closes", () => {
    const done = vi.fn();
    renderIn(
      <>
        <DowntimeRecordOutage now={NOW_ANCHOR} onDone={done} />
        <HomeOutageCatchUp now={NOW_ANCHOR} />
      </>,
    );
    fireEvent.change(screen.getByLabelText("We were down from"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText(/^to/), { target: { value: "1040" } });
    fireEvent.click(screen.getByRole("radio", { name: "Today" }));
    fireEvent.click(screen.getByTestId("ward-downtime-outage-save"));
    expect(done).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("home-catch-up-summary")).toHaveTextContent(
      `Down 8:00 am to 10:40 am · 0 of ${seed.units.length} wards caught up`,
    );
  });

  it("refuses an end still to come, and reads Yesterday and a window past midnight", () => {
    renderIn(<DowntimeRecordOutage now={NOW_ANCHOR} onDone={() => undefined} />);
    fireEvent.change(screen.getByLabelText("We were down from"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText(/^to/), { target: { value: "23:00" } });
    fireEvent.click(screen.getByRole("radio", { name: "Today" }));
    fireEvent.click(screen.getByTestId("ward-downtime-outage-save"));
    expect(screen.getByTestId("ward-downtime-outage-problem")).toHaveTextContent("cannot be later than now");

    const today = Math.floor(NOW_ANCHOR / DAY) * DAY;
    expect(typedOutageWindow("22:00", "01:30", "yesterday", NOW_ANCHOR)).toEqual({
      from: today - DAY + 22 * 60,
      to: today + 90,
    });
    expect(typedOutageWindow("06:40", "09:05", "", NOW_ANCHOR)).toBeNull();
    expect(typedOutageWindow("", "09:05", "today", NOW_ANCHOR)).toBeNull();
  });
});

describe("item 25: catch up after the outage", () => {
  it("My ward shows the card and every bed's tag only after an outage, until the ward confirms", async () => {
    desk.role = "ward";
    renderIn(<WardScreen unitId={ward.id} />);
    expect(screen.queryByTestId("ward-outage-catch-up")).toBeNull();
    expect(screen.queryAllByText("Not confirmed since the outage")).toHaveLength(0);

    printed([ward.id], PACK_AT);
    outage();
    // The card loads on its own chunk (phone budget), so it arrives a moment later.
    const card = await screen.findByTestId("ward-outage-catch-up");
    expect(card).toHaveTextContent(
      `Since your pack at ${formatInstant(PACK_AT)}, enter admissions, discharges, moves and bed changes done on paper.`,
    );
    for (const action of ["Open arrivals", "Open discharges", "Open bed board", "Open bed list", "Beds still correct"])
      expect(within(card).getByRole("button", { name: action })).toBeInTheDocument();
    expect(within(card).getByTestId("ward-catch-up-beds")).toHaveTextContent(
      `${ward.beds} beds not confirmed since the outage`,
    );
    const tagged = screen.getAllByRole("button", { name: /Not confirmed since the outage$/ });
    expect(tagged.length).toBeGreaterThan(0);

    fireEvent.click(within(card).getByRole("button", { name: "Beds still correct" }));
    expect(screen.queryByTestId("ward-outage-catch-up")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Not confirmed since the outage$/ })).toHaveLength(0);
  });

  it("Home counts the wards caught up and lists the rest with their last pack time", () => {
    renderIn(<HomeOutageCatchUp now={NOW_ANCHOR} />);
    expect(screen.queryByTestId("home-outage-catch-up")).toBeNull();
    printed([ward.id], PACK_AT);
    outage();
    expect(screen.getByTestId("home-catch-up-summary")).toHaveTextContent(`0 of ${seed.units.length} wards caught up`);
    expect(screen.getByTestId(`home-catch-up-ward-${ward.id}`)).toHaveTextContent(
      `${ward.name}Beds not confirmed since the outagePack ${formatInstant(PACK_AT)}`,
    );
    // The never-printed example ward sits late in the list, behind Show more.
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ more$/ }));
    expect(screen.getByTestId(`home-catch-up-ward-${never.id}`)).toHaveTextContent("No pack printed");
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.getByRole("link", { name: "Change times" })).toHaveAttribute("href", "/bedchart/reports/downtime");

    // Only the ward's own confirmation counts: the coordinator's does not.
    record({
      type: "CONFIRM_CAPACITY",
      role: "coordinator",
      now: NOW_ANCHOR,
      unitId: ward.id,
      actingUnitId: ward.id,
      value: ward.allocatable.value,
      expectedRevision: ward.allocatable.revision ?? 0,
    });
    expect(screen.getByTestId("home-catch-up-summary")).toHaveTextContent(`0 of ${seed.units.length}`);
    record({
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: NOW_ANCHOR,
      unitId: ward.id,
      actingUnitId: ward.id,
      value: ward.allocatable.value,
      expectedRevision: (ward.allocatable.revision ?? 0) + 1,
    });
    expect(screen.getByTestId("home-catch-up-summary")).toHaveTextContent(`1 of ${seed.units.length}`);
    expect(screen.queryByTestId(`home-catch-up-ward-${ward.id}`)).toBeNull();
  });

  it("is the coordinator's card only", () => {
    desk.role = "ward";
    renderIn(<HomeOutageCatchUp now={NOW_ANCHOR} />);
    outage();
    expect(screen.queryByTestId("home-outage-catch-up")).toBeNull();
  });
});
