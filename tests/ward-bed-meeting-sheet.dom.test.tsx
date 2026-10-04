import { readFileSync } from "node:fs";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BED_MEETING_ROW_LIMIT, bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { BED_MEETING_PRINTING_CLASS } from "@/components/ward-management/capacity/bed-meeting-sheet";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
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

/**
 * The morning bed-meeting sheet (Capacity → "Bed-meeting sheet"). Two properties matter:
 *   1. Every figure on the paper is the figure its own screen shows — the sheet re-derives nothing.
 *   2. Printing while the sheet is open sends the sheet alone, on one page.
 */

const units = allUnits();
const input = {
  units,
  movements: wardMovements,
  bedReleases,
  admissions: wardAdmissions,
  leaveBeds,
  now: NOW_ANCHOR,
  service: null,
  nameOf: (movement: { id: string }) => `Person ${movement.id}`,
};

afterEach(() => {
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

  it("ED waiting matches the ED home's summaries and lists the longest wait first", () => {
    const waiting = edOpenSummaries(wardMovements, NOW_ANCHOR).reduce((sum, summary) => sum + summary.waiting, 0);
    expect(sheet.ed.waiting).toBe(waiting);
    expect(sheet.ed.longestWaits.length + sheet.ed.morePeople).toBe(waiting);
    const waits = sheet.ed.longestWaits.map((person) => person.waitMinutes);
    expect(waits).toEqual([...waits].sort((a, b) => b - a));
  });

  it("delays keep the Delays screen's causes and worst-first order", () => {
    const groups = delayGroups(wardMovements.filter(isOpen), units, NOW_ANCHOR);
    expect(sheet.delays.groups.map((group) => group.cause)).toEqual(groups.map((group) => group.cause));
    expect(sheet.delays.total).toBe(groups.reduce((sum, group) => sum + group.movements.length, 0));
  });

  it("a chosen service narrows capacity to that service's wards", () => {
    const service = unitHealthService(units[0]);
    expect(service).toBeDefined();
    const scoped = bedMeetingSheet({ ...input, service: service ?? null });
    expect(scoped.service).toBe(service);
    expect(scoped.capacity.wards).toBe(units.filter((unit) => unitHealthService(unit) === service).length);
    expect(scoped.capacity.wards).toBeLessThan(sheet.capacity.wards);
  });
});

describe("the sheet on Capacity", () => {
  function openSheet() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("bed-meeting-sheet-open"));
    return screen.getByRole("dialog", { name: /Morning bed meeting/u });
  }

  it("opens a dialog with all four sections, the as-at stamp and the synthetic disclosure", () => {
    const dialog = openSheet();
    for (const id of ["bed-meeting-capacity", "bed-meeting-discharges", "bed-meeting-ed", "bed-meeting-delays"]) {
      expect(within(dialog).getByTestId(id)).toBeTruthy();
    }
    expect(within(dialog).getByTestId("bed-meeting-sheet-as-at").textContent).toMatch(/^As at \d\d:\d\d$/u);
    expect(dialog.textContent).toMatch(/Synthetic prototype/u);
    expect(dialog.textContent).toMatch(/your default, not a legal limit/u);
  });

  it("marks the page for sheet-only printing while open, prints on request, and unmarks on close", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const dialog = openSheet();
    expect(document.documentElement.classList.contains(BED_MEETING_PRINTING_CLASS)).toBe(true);
    fireEvent.click(within(dialog).getByTestId("bed-meeting-sheet-print"));
    expect(print).toHaveBeenCalledTimes(1);
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog", { name: /Morning bed meeting/u })).toBeNull();
    expect(document.documentElement.classList.contains(BED_MEETING_PRINTING_CLASS)).toBe(false);
    print.mockRestore();
  });

  it("the print rules hide everything but the sheet and fit it to an A4 page", () => {
    const css = readFileSync("src/components/ward-management/capacity/bed-meeting-sheet.module.css", "utf8");
    expect(css).toContain(`:global(html.${BED_MEETING_PRINTING_CLASS}) :global(body) > :not(.portal)`);
    expect(css).toMatch(/size:\s*A4 portrait/u);
  });
});
