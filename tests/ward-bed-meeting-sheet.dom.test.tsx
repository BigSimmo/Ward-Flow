import { readFileSync } from "node:fs";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BED_MEETING_ROW_LIMIT, bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BED_MEETING_PRINTING_CLASS } from "@/components/ward-management/capacity/bed-meeting-sheet";
import {
  bedKindGaps,
  bedKindTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { BED_MEETING_SHEET_BODY_LABEL } from "@/components/ward-management/capacity/capacity-meeting-sheet-dialog";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
/**
 * The morning bed-meeting sheet (Capacity → "Bed meeting sheet", one tap since wave 4). Two
 * properties matter:
 *   1. Every figure on the paper is the figure its own screen shows — the sheet re-derives nothing.
 *   2. Printing while the sheet is open sends the sheet alone on A4.
 */

const phone = vi.hoisted(() => ({ value: false }));
vi.mock("@/components/wf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/wf")>()),
  useIsPhone: () => phone.value,
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

const units = allUnits();
const input = {
  units,
  movements: wardMovements,
  bedReleases,
  admissions: wardAdmissions,
  leaveBeds,
  now: NOW_ANCHOR,
  thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
  service: null,
  nameOf: (movement: { id: string }) => `Person ${movement.id}`,
};

afterEach(() => {
  phone.value = false;
  document.documentElement.classList.remove(BED_MEETING_PRINTING_CLASS);
});

describe("bedMeetingSheet agrees with the screens it summarises", () => {
  const sheet = bedMeetingSheet(input);

  it("capacity matches the Capacity screen's own rows", () => {
    const rows = networkWardRows(units, NOW_ANCHOR, bedReleases, wardAdmissions, leaveBeds);
    expect(sheet.capacity.wards).toBe(rows.length);
    expect(sheet.capacity.ready).toBe(rows.reduce((sum, row) => sum + row.ready, 0));
    expect(sheet.capacity.beds).toBe(rows.reduce((sum, row) => sum + row.unit.beds, 0));
    expect(sheet.capacity.occupied).toBe(rows.reduce((sum, row) => sum + row.occupied, 0));
    expect(sheet.capacity.pulled).toBe(rows.reduce((sum, row) => sum + row.pulled, 0));
    expect(sheet.capacity.closed).toBe(rows.reduce((sum, row) => sum + row.closed, 0));
  });

  it("discharges match the Discharges board's groups, held up first", () => {
    const groups = groupDischarges(bedReleases, NOW_ANCHOR);
    expect(sheet.discharges.heldUp).toBe(groups.blocked.length);
    expect(sheet.discharges.confirmed).toBe(groups.confirmed.length);
    expect(sheet.discharges.expected).toBe(groups.expected.length);
    const total = groups.blocked.length + groups.confirmed.length + groups.expected.length;
    expect(sheet.discharges.rows.length + sheet.discharges.moreRows).toBe(total);
    expect(sheet.discharges.rows.length).toBeLessThanOrEqual(BED_MEETING_ROW_LIMIT);
    if (groups.blocked.length > 0) expect(sheet.discharges.rows[0].status).toBe("Held up");
  });

  it("held up · by tomorrow lists the held-up group by ward, with no names, oldest due first", () => {
    const blocked = groupDischarges(bedReleases, NOW_ANCHOR).blocked;
    const { heldUpRows, moreHeldUpRows } = sheet.discharges;
    expect(heldUpRows.length + moreHeldUpRows).toBe(blocked.length);
    expect(heldUpRows.length).toBeLessThanOrEqual(BED_MEETING_ROW_LIMIT);
    const due = heldUpRows.map((row) => row.dueAt);
    expect(due).toEqual([...due].sort((a, b) => a - b));
    for (const row of heldUpRows) {
      expect(Object.keys(row).sort()).toEqual(["dueAt", "id", "reason", "ward"]);
      expect(row.reason.length).toBeGreaterThan(0);
    }
  });

  it("short reads Capacity's own bed-type selector", () => {
    // PR C (P4-7): Capacity passes its bed releases, so a bed being made ready is not counted as supply.
    const kinds = bedKindGaps(wardMovements, units, NOW_ANCHOR, wardAdmissions, [], bedReleases);
    const totals = bedKindTotals(kinds);
    expect(sheet.short.gap).toBe(totals.gap);
    expect(sheet.short.waiting).toBe(totals.waiting);
    expect(sheet.short.spare.map((kind) => kind.id)).toEqual(kinds.filter((k) => k.gap > 0).map((k) => k.id));
  });

  it("ED waiting matches the ED home's summaries and lists the longest wait first", () => {
    const waiting = edOpenSummaries(wardMovements, NOW_ANCHOR).reduce((sum, summary) => sum + summary.waiting, 0);
    expect(sheet.ed.waiting).toBe(waiting);
    expect(sheet.ed.longestWaits.length + sheet.ed.morePeople).toBe(waiting);
    const waits = sheet.ed.longestWaits.map((person) => person.waitMinutes);
    expect(waits).toEqual([...waits].sort((a, b) => b - a));
  });

  it("delays keep the Delays screen's causes and worst-first order", () => {
    const groups = delayGroups(wardMovements.filter(isOpen), units, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
    expect(sheet.delays.groups.map((group) => group.cause)).toEqual(groups.map((group) => group.cause));
    expect(sheet.delays.total).toBe(groups.reduce((sum, group) => sum + group.movements.length, 0));
  });

  it("lists the waiting people once, longest first, across ED waits and delays", () => {
    const { people, morePeople } = sheet.waitingLongest;
    const ids = people.map((person) => person.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(people.length).toBeLessThanOrEqual(BED_MEETING_ROW_LIMIT);
    const waits = people.map((person) => person.waitMinutes);
    expect(waits).toEqual([...waits].sort((a, b) => b - a));
    const everyone = new Set([
      ...edOpenSummaries(wardMovements, NOW_ANCHOR).flatMap((summary) => summary.open.map((movement) => movement.id)),
      ...delayGroups(wardMovements.filter(isOpen), units, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS).flatMap((group) =>
        group.movements.map((movement) => movement.id),
      ),
    ]);
    expect(people.length + morePeople).toBe(everyone.size);
  });

  it("a chosen service narrows capacity to that service's wards", () => {
    const service = unitHealthService(units[0]);
    expect(service).toBeDefined();
    const scoped = bedMeetingSheet({ ...input, service: service ?? null, thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(scoped.service).toBe(service);
    expect(scoped.capacity.wards).toBe(units.filter((unit) => unitHealthService(unit) === service).length);
    expect(scoped.capacity.wards).toBeLessThan(sheet.capacity.wards);
  });
});

describe("the sheet on Capacity", () => {
  function renderCapacity(openOnLoad?: string) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={Date.parse("2026-12-30T16:00:00Z")}>
        <CapacityScreen openOnLoad={openOnLoad} />
      </WardFlowProvider>,
    );
  }
  /** Wave 4 (C6, D-191): the hero's one action, "Bed meeting sheet", opens the sheet in one tap. */
  function chooseSheet() {
    fireEvent.click(screen.getByRole("button", { name: "Bed meeting sheet" }));
    return screen.getByTestId("bed-meeting-sheet-dialog");
  }

  it("opens a dialog with all four sections, the as-at stamp and the synthetic disclosure", () => {
    renderCapacity();
    const dialog = chooseSheet();
    // Wave 4 (C8): a neutral "Synthetic data" tag, and the as-at line says the figures agree.
    expect(within(dialog).getByText("Synthetic data")).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/Same figures as Capacity and the TV view/u);
    // The printed copy is the full sheet; the dialog is its on-screen summary.
    const copy = screen.getByTestId("bed-meeting-sheet-print-copy");
    for (const id of ["bed-meeting-capacity", "bed-meeting-discharges", "bed-meeting-ed", "bed-meeting-delays"]) {
      expect(within(copy).getByTestId(id)).toBeTruthy();
    }
    // RC 2.6 (F-113, D-190): the local demo's scripted clock reads "demo time", never AWST.
    expect(within(copy).getByTestId("bed-meeting-sheet-as-at").textContent).toMatch(
      /^As at Thu,? 31 Dec 2026, \d\d:\d\d demo time$/u,
    );
    expect(copy.textContent).toMatch(/Synthetic data\. Not approved for clinical use/u);
    expect(copy.textContent).toMatch(/your default/u);
    // D-218 (Josh, 14 Nov 2026): no legal-limit disclaimer on the sheet.
    expect(copy.textContent).not.toMatch(/legal limit|not checked/u);
    expect(within(copy).getByTestId("ward-print-attribution").textContent).toBe(
      "Printed by Bed coordinator, Statewide, at 10:42 board time. Synthetic data.",
    );
  });

  it("carries windows on its figures, lists held up by tomorrow by ward, and has a named, focusable body", () => {
    renderCapacity();
    const dialog = chooseSheet();
    const label = (id: string) =>
      within(dialog).getByTestId(`bed-meeting-sheet-figure-${id}`).querySelector("dt")?.textContent ?? "";
    expect(label("ready")).toBe("Ready · now");
    expect(label("short")).toMatch(/^(Short|Spare) · now$/u);
    expect(label("discharges")).toBe("Discharges · today");
    expect(label("ed")).toBe("Waiting in ED · now");
    // Review P4-5: the gap is network-wide; only a one-service sheet says so, so the statewide one does not.
    expect(within(dialog).getByTestId("bed-meeting-sheet-figure-short")).not.toHaveTextContent(/Network-wide/u);
    expect(within(dialog).getByTestId("bed-meeting-sheet-figure-discharges")).toHaveTextContent(
      /held up · by tomorrow/u,
    );
    const held = within(dialog).getByTestId("bed-meeting-sheet-held-up");
    expect(held.querySelectorAll("li").length).toBeGreaterThan(0);
    const body = within(dialog).getByRole("region", { name: BED_MEETING_SHEET_BODY_LABEL });
    expect(body).toHaveAttribute("tabindex", "0");
    // The footer: Close (beside the header's close cross), then Print sheet, the one filled button.
    expect(within(dialog).getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("button", { name: "Print sheet" })).toBeInTheDocument();
  });

  it("marks the page for sheet-only printing while open, prints on request, and unmarks on close", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderCapacity();
    const dialog = chooseSheet();
    expect(document.documentElement.classList.contains(BED_MEETING_PRINTING_CLASS)).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Print sheet" }));
    expect(print).toHaveBeenCalledTimes(1);
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByTestId("bed-meeting-sheet-dialog")).toBeNull();
    expect(screen.queryByTestId("bed-meeting-sheet-print-copy")).toBeNull();
    expect(document.documentElement.classList.contains(BED_MEETING_PRINTING_CLASS)).toBe(false);
    print.mockRestore();
  });

  it.each([false, true])("keeps the open sheet when print media changes the phone layout from %s", (initialPhone) => {
    phone.value = initialPhone;
    // The phone hero has no Bed meeting menu, so the phone start opens the sheet on load.
    const openOnLoad = initialPhone ? "sheet" : undefined;
    const content = () => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen openOnLoad={openOnLoad} />
      </WardFlowProvider>
    );
    const view = render(content());
    if (!initialPhone) chooseSheet();
    const copy = screen.getByTestId("bed-meeting-sheet-print-copy");
    phone.value = !initialPhone;
    view.rerender(content());
    expect(screen.getByTestId("bed-meeting-sheet-print-copy")).toBe(copy);
    expect(document.documentElement.classList.contains(BED_MEETING_PRINTING_CLASS)).toBe(true);
    phone.value = initialPhone;
    view.rerender(content());
    expect(screen.getByTestId("bed-meeting-sheet-print-copy")).toBe(copy);
  });

  it("the print rules hide everything but the sheet and fit it to an A4 page", () => {
    const css = readFileSync("src/components/ward-management/capacity/bed-meeting-sheet.module.css", "utf8");
    expect(css).toContain(`:global(html.${BED_MEETING_PRINTING_CLASS}) :global(body) > :not(.portal)`);
    expect(css).toMatch(/size:\s*A4 portrait/u);
  });
});
