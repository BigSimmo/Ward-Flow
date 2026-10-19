import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { networkWardRows, type NetworkWardRow } from "@/components/ward-management/capacity/capacity-derivations";
import { ReadyByRoadTime } from "@/components/ward-management/capacity/capacity-road-time";
import { referenceDistance } from "@/components/ward-management/reference/ward-reference-distances";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * Ready beds by road time, moved to Capacity when the Network screen was retired (19 Oct 2026).
 * Expectations are read off the rendered list, never re-sorted in the test, so a swapped comparison
 * cannot agree with itself in both places.
 */

const rows = networkWardRows(allUnits(), NOW_ANCHOR, bedReleases, wardAdmissions, leaveBeds);
const departments = allEmergencyDepartments();

function routeFrom(edId: string, row: NetworkWardRow) {
  const ed = departments.find((d) => d.id === edId);
  return referenceDistance(ed?.referenceEdId, siteByCode(row.unit.siteCode)?.referenceSiteId);
}

function renderCard(cardRows: readonly NetworkWardRow[], defaultEdId = departments[0]?.id, onSelectUnit = vi.fn()) {
  render(
    <ReadyByRoadTime
      rows={cardRows}
      defaultEdId={defaultEdId}
      selectedUnitId={undefined}
      onSelectUnit={onSelectUnit}
    />,
  );
  const card = screen.getByTestId("capacity-road-time");
  return { card, onSelectUnit };
}

function listedNames(card: HTMLElement) {
  const list = within(card).queryByRole("list");
  return list === null
    ? []
    : within(list)
        .getAllByRole("button")
        .map((b) => b.textContent ?? "");
}

describe("Ready beds by road time", () => {
  it("lists at most five wards, nearest first, each with a ready bed", () => {
    const { card } = renderCard(rows);
    const buttons = within(within(card).getByRole("list")).getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(1);
    expect(buttons.length).toBeLessThanOrEqual(5);

    const minutes = buttons.map((button) => {
      const text = button.textContent ?? "";
      expect(text).toMatch(/[1-9]\d* ready/u);
      if (text.includes("On site")) return 0;
      const match = /(\d+)h|(\d+)m/gu;
      let total = 0;
      for (const m of text.matchAll(match)) total += m[1] ? Number(m[1]) * 60 : Number(m[2]);
      return total;
    });
    for (let i = 1; i < minutes.length; i += 1) expect(minutes[i]).toBeGreaterThanOrEqual(minutes[i - 1]!);
  });

  it("leaves out wards with no ready bed and wards with no measured route", () => {
    const edId = departments[0]!.id;
    const routed = rows.find((row) => routeFrom(edId, row) !== null)!;
    const unroutedUnit = { ...routed.unit, id: "synthetic-no-route", name: "No Route Ward", siteCode: "NOSUCH" };
    const cardRows: NetworkWardRow[] = [
      { ...routed, ready: 2 },
      { ...routed, unit: { ...routed.unit, id: "synthetic-empty", name: "Empty Ward" }, ready: 0 },
      { ...routed, unit: unroutedUnit, ready: 3 },
    ];
    const { card } = renderCard(cardRows, edId);
    const names = listedNames(card);
    expect(names).toHaveLength(1);
    expect(names[0]).toContain(routed.unit.name);
  });

  it("says On site when the ward is at the department's own hospital", () => {
    const pair = departments
      .flatMap((d) => rows.map((row) => ({ d, row, route: routeFrom(d.id, row) })))
      .find(({ route }) => route?.min === 0);
    expect(pair, "no ward shares a site with an emergency department in the fixture").toBeDefined();
    const { card } = renderCard([{ ...pair!.row, ready: 1 }], pair!.d.id);
    expect(listedNames(card)[0]).toContain("On site");
  });

  it("re-ranks when another department is chosen, and reports the ward picked", async () => {
    const user = userEvent.setup();
    const { card, onSelectUnit } = renderCard(rows);
    const select = within(card).getByLabelText("From") as HTMLSelectElement;
    expect(select.value).toBe(departments[0]!.id);
    const before = listedNames(card);

    const other = departments.find((d) => {
      const ranked = rows.filter((row) => row.ready > 0 && routeFrom(d.id, row) !== null);
      return d.id !== departments[0]!.id && ranked.length > 0;
    })!;
    await user.selectOptions(select, other.id);
    expect(select.value).toBe(other.id);
    expect(listedNames(card)).not.toEqual(before);

    await user.click(within(within(card).getByRole("list")).getAllByRole("button")[0]!);
    expect(onSelectUnit).toHaveBeenCalledTimes(1);
  });
});
