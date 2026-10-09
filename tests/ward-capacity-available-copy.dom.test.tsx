import type { ComponentProps } from "react";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ReadyNowSection } from "@/components/ward-management/capacity/capacity-screen";
import { networkTotals, networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { openBedsNow } from "@/components/ward-management/ward-bed-availability";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";

const units = allUnits();
const rows = networkWardRows(units, NOW_ANCHOR, bedReleases);
const cleaningRow = rows.find((row) => (row.pendingPreparation ?? 0) > 0 && row.ready > (row.pendingPreparation ?? 0));
if (!cleaningRow) throw new Error("The synthetic fixture must contain counted capacity still being made ready.");
const cleaningUnit = cleaningRow.unit;
const cleaningService = unitHealthService(cleaningUnit);

function propsFor(service: ComponentProps<typeof ReadyNowSection>["service"]): ComponentProps<typeof ReadyNowSection> {
  const totals = networkTotals(rows);
  const locked = rows.reduce((sum, row) => sum + row.lockedReady, 0);
  const scoped = rows.filter((row) => unitHealthService(row.unit) === service);
  const scopedReady = scoped.reduce((sum, row) => sum + row.ready, 0);
  const scopedLocked = scoped.reduce((sum, row) => sum + row.lockedReady, 0);
  return {
    service,
    netTotals: totals,
    totalLockedReady: locked,
    totalOpenReady: totals.ready - locked,
    scopedReady,
    scopedLockedReady: scopedLocked,
    scopedOpenReady: scopedReady - scopedLocked,
    scopedPendingPreparation: scoped.reduce((sum, row) => sum + (row.pendingPreparation ?? 0), 0),
  };
}

describe("Capacity wording preserves counted capacity and the preparation distinction", () => {
  it.each([null, cleaningService])("explains the included, not-yet-pullable capacity for scope %s", (service) => {
    const props = propsFor(service);
    render(<ReadyNowSection {...props} />);
    const summary = screen.getByRole("region", { name: "Available capacity" });
    expect(within(summary).getByRole("heading", { name: "Available capacity" })).toBeInTheDocument();
    expect(within(summary).queryByRole("heading", { name: "Ready now" })).not.toBeInTheDocument();
    const pending = service === null ? props.netTotals.pendingPreparation : props.scopedPendingPreparation;
    expect(pending).toBeGreaterThan(0);
    expect(summary).toHaveTextContent(
      `${pending} still being made ready. Included in capacity; cannot be pulled until ready.`,
    );
    const ready = service === null ? props.netTotals.ready : props.scopedReady;
    expect(
      within(summary).getByText(`${ready} beds ready ${service === null ? "across the network" : `in ${service}`}`),
    ).toBeInTheDocument();
  });

  it("does not imply that preparation is pending when none is recorded", () => {
    const props = propsFor(null);
    render(<ReadyNowSection {...props} netTotals={{ ...props.netTotals, pendingPreparation: 0 }} />);
    expect(screen.getByRole("region", { name: "Available capacity" })).not.toHaveTextContent("cannot be pulled");
  });

  it("keeps cleaning capacity counted while immediate pull availability excludes it", () => {
    const completed = bedReleases.map((release) => ({ ...release, preparing: false }));
    const countedBefore = networkTotals(rows).ready;
    expect(networkTotals(networkWardRows(units, NOW_ANCHOR, completed)).ready).toBe(countedBefore);
    expect(openBedsNow(cleaningUnit, bedReleases)).toBe(
      openBedsNow(cleaningUnit, completed) - (cleaningRow.pendingPreparation ?? 0),
    );
  });

  it("does not add a future expected release to available capacity or today's freeing figure", () => {
    const future: BedRelease = {
      ...bedReleases[0]!,
      id: "WR-CAPACITY-COPY-FUTURE",
      unitId: cleaningUnit.id,
      state: "expected",
      preparing: false,
      expectedAt: NOW_ANCHOR + 2 * MINUTES_PER_DAY,
    };
    const withFuture = networkWardRows(units, NOW_ANCHOR, [...bedReleases, future]);
    expect(networkTotals(withFuture).ready).toBe(networkTotals(rows).ready);
    expect(withFuture.find((row) => row.unit.id === cleaningUnit.id)?.freeing).toBe(cleaningRow.freeing);
    expect(openBedsNow(cleaningUnit, [...bedReleases, future])).toBe(openBedsNow(cleaningUnit, bedReleases));
  });
});
