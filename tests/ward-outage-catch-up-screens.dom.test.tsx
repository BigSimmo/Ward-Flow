import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

/*
 * Batch 4 items 24 and 25 (Josh approved the design review and its recommendations, 11 Nov 2026,
 * D-142): the screens over the model in `downtime-pack-prints.ts` and `ward-outage-catch-up.ts`.
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
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardPackPrintedLine } from "@/components/ward-management/ward/ward-pack-printed-line";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { ToastProvider } from "@/components/wf";

const seed = seedWardFlowState();
const ward = seed.units[0]!;
const others = seed.units.slice(1);
const DAY = 24 * 60;
// Ends after every seeded ward's last confirmation (10:32 at the latest), so no ward starts caught up.
const OUTAGE = { from: NOW_ANCHOR - 120, to: NOW_ANCHOR - 5 };

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
    // Every ward but one printed just now; the first printed more than 24 hours ago.
    printed(
      others.map((unit) => unit.id),
      NOW_ANCHOR,
    );
    const band = screen.getByTestId("ward-downtime-old-packs");
    expect(band).toHaveTextContent("Outage packs older than 24 hours");
    expect(band).toHaveTextContent(`1 of ${seed.units.length} wards`);
    expect(within(band).getByTestId(`ward-downtime-old-pack-${ward.id}`)).toHaveTextContent(
      `${ward.name} ${NEVER_PRINTED}`,
    );
    printed([ward.id], NOW_ANCHOR - DAY - 30);
    expect(screen.getByTestId(`ward-downtime-old-pack-${ward.id}`)).toHaveTextContent(
      `${ward.name} ${formatInstant(NOW_ANCHOR - DAY - 30)} yesterday`,
    );
    // Printed within the last 24 hours: no ward is old, so no band. (A second ward keeps this print
    // apart from the first one's, which the repeat-tap guard would answer instead.)
    printed([ward.id, others[0]!.id], NOW_ANCHOR);
    expect(screen.queryByTestId("ward-downtime-old-packs")).toBeNull();
  });

  it("folds a long list of never-printed wards behind Show more", () => {
    renderIn(<DowntimeOldPacksBand now={NOW_ANCHOR} />);
    const band = screen.getByTestId("ward-downtime-old-packs");
    expect(band).toHaveTextContent(`${seed.units.length} of ${seed.units.length} wards`);
    expect(within(band).getAllByText(NEVER_PRINTED)).toHaveLength(6);
    fireEvent.click(screen.getByTestId("ward-downtime-old-packs-more"));
    expect(within(band).getAllByText(NEVER_PRINTED)).toHaveLength(seed.units.length);
  });

  it("My ward's Checking line says when its outage pack was last printed", () => {
    renderIn(<WardPackPrintedLine unitId={ward.id} now={NOW_ANCHOR} />);
    expect(screen.getByTestId("ward-hero-pack-printed")).toHaveTextContent("Outage pack never printed");
    printed([ward.id], NOW_ANCHOR - 30);
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
    expect(screen.getByTestId("ward-downtime-last-printed")).toHaveTextContent(
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
      `Down 08:00 to 10:40 · 0 of ${seed.units.length} wards caught up`,
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
  it("My ward shows the card and every bed's tag only after an outage, until the ward confirms", () => {
    desk.role = "ward";
    renderIn(<WardScreen unitId={ward.id} />);
    expect(screen.queryByTestId("ward-outage-catch-up")).toBeNull();
    expect(screen.queryAllByText("Not confirmed since the outage")).toHaveLength(0);

    printed([ward.id], OUTAGE.from - 30);
    outage();
    const card = screen.getByTestId("ward-outage-catch-up");
    expect(card).toHaveTextContent(
      `Since your pack at ${formatInstant(OUTAGE.from - 30)}, enter admissions, discharges, moves and bed changes done on paper.`,
    );
    for (const action of ["Add admission", "Record discharge", "Record move", "Change a bed", "Beds still correct"])
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
    printed([ward.id], OUTAGE.from - 30);
    outage();
    expect(screen.getByTestId("home-catch-up-summary")).toHaveTextContent(`0 of ${seed.units.length} wards caught up`);
    expect(screen.getByTestId(`home-catch-up-ward-${ward.id}`)).toHaveTextContent(
      `${ward.name}Beds not confirmed since the outagePack ${formatInstant(OUTAGE.from - 30)}`,
    );
    expect(screen.getByTestId(`home-catch-up-ward-${others[0]!.id}`)).toHaveTextContent("No pack printed");
    expect(screen.getByRole("link", { name: "Change times" })).toHaveAttribute("href", "/ward-flow/reports/downtime");

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
