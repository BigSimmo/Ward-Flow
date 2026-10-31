import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { isConfirmationFresh } from "@/components/ward-management/capacity/capacity-gap-words";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { HealthService } from "@/components/ward-management/ward-model";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const scope = vi.hoisted(() => ({ service: null as HealthService | null }));
vi.mock("@/components/ward-management/shell/ward-service-store", async (importOriginal) => ({
  ...(await importOriginal()),
  useServiceScope: () => scope.service,
}));

/**
 * Capacity review corrections, carried onto the redesigned screen (Josh, 31 Oct 2026). The network
 * ward table, its filter chips and its compact-table scroll cue are gone; the bed map's highlight
 * chips and the hero's ready figures are the shortcuts now, and a chosen service narrows the bed map
 * behind `WardServiceScopeBar`. Every expected count is computed here from `networkWardRows` with
 * the screen model's own arguments, narrowed by `unitHealthService` exactly as the screen narrows it.
 */
const seed = seedWardFlowState();
const networkRows = networkWardRows(seed.units, NOW_ANCHOR, seed.bedReleases, seed.admissions, seed.leaveBeds);

function rowsIn(service: HealthService | null) {
  return service === null ? networkRows : networkRows.filter((row) => unitHealthService(row.unit) === service);
}

function wards(count: number): string {
  return `${count} ${count === 1 ? "ward" : "wards"}`;
}

function renderCapacity() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

function wardCards(): HTMLElement[] {
  const map = document.getElementById("capacity-bed-map");
  expect(map, "no bed map on the Capacity screen").not.toBeNull();
  return Array.from((map as HTMLElement).querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]'));
}

function highlightChip(label: string): HTMLElement {
  const group = within(screen.getByRole("group", { name: "Highlight wards" }));
  return group.getByRole("button", { name: new RegExp(`^${label} · \\d+ wards?$`, "u") });
}

describe("capacity review corrections", () => {
  beforeEach(() => {
    scope.service = null;
  });

  it("Space and Enter activate the hero's ready shortcuts and keep every ward on the bed map", async () => {
    const user = userEvent.setup();
    renderCapacity();
    const before = wardCards().length;
    expect(before).toBe(networkRows.length);
    const hero = within(screen.getByRole("group", { name: "Network beds" }));

    const open = hero.getByRole("button", { name: /Open ready/u });
    expect(open.tagName).toBe("BUTTON");
    open.focus();
    await user.keyboard(" ");
    expect(open).toHaveAttribute("aria-pressed", "true");
    expect(highlightChip("Open ready")).toHaveAttribute("aria-pressed", "true");
    expect(wardCards().filter((card) => /dimmed/u.test(card.className)).length).toBeGreaterThan(0);
    expect(wardCards()).toHaveLength(before);

    // Pressing the same hero figure a second time clears the highlight.
    open.focus();
    await user.keyboard("{Enter}");
    expect(open).toHaveAttribute("aria-pressed", "false");
    expect(wardCards().filter((card) => /dimmed/u.test(card.className))).toHaveLength(0);
    expect(wardCards()).toHaveLength(before);
  });

  it("counts only North Metro wards in the scope bar, the bed map and its highlight chips", () => {
    scope.service = "North Metro";
    const scoped = rowsIn("North Metro");
    expect(scoped.length, "no North Metro ward in the fixture — this guard proved nothing").toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(networkRows.length);
    renderCapacity();
    expect(screen.getByTestId("ward-service-scope-bar-summary")).toHaveTextContent(
      `Showing ${scoped.length} of ${networkRows.length} wards, in North Metro.`,
    );
    expect(wardCards()).toHaveLength(scoped.length);
    expect(highlightChip("Any ready")).toHaveTextContent(wards(scoped.filter((row) => row.ready > 0).length));
    expect(highlightChip("Locked ready")).toHaveTextContent(wards(scoped.filter((row) => row.lockedReady > 0).length));
    expect(highlightChip("Count not confirmed")).toHaveTextContent(
      wards(scoped.filter((row) => !isConfirmationFresh(row.unit, NOW_ANCHOR)).length),
    );
  });

  it("reports an empty service with zero wards shown and zero highlight counts", () => {
    scope.service = "CAHS";
    expect(rowsIn("CAHS"), "CAHS wards are not modelled, so this service is empty").toHaveLength(0);
    renderCapacity();
    expect(screen.getByTestId("ward-service-scope-bar-summary")).toHaveTextContent(
      `Showing 0 of ${networkRows.length} wards, in CAHS.`,
    );
    expect(wardCards()).toHaveLength(0);
    const chips = within(screen.getByRole("group", { name: "Highlight wards" })).getAllByRole("button");
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) expect(chip).toHaveTextContent(/ · 0 wards$/u);
  });

  /*
   * RETIRED 31 Oct 2026 with the network ward table (Capacity redesign): "shows a compact-table
   * scroll cue only while the table actually overflows". It pinned the table's "Scroll sideways to
   * see more ward details." cue and `data-overflowing`; the bed map that replaced the table has no
   * sideways-scrolling table.
   */
});
