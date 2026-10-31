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

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * One ward's statistics (core pages review, built 31 Oct 2026). The coordinator's page keeps Beds now
 * and the roster; the nurse in charge's own-ward page (D-80) moves Beds now's figures into the hero,
 * sets Referrals at the foot of the right column and leaves out the roster card a counts grant can
 * only say is empty.
 */

const state = seedWardFlowState();
const current = (unitId: string) =>
  state.admissions.filter((admission) => admission.unitId === unitId && admission.state !== "departed");
// The fullest synthetic ward, so its roster runs past the first eight rows.
const busiest = [...state.units].sort((a, b) => current(b.id).length - current(a.id).length)[0]!;

const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const wardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [busiest.id] } };

function renderAs(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsWardScreen unitId={busiest.id} />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("one ward's statistics, coordinator and ward desk", () => {
  it("gives the coordinator Beds now, referrals beside length of stay and the roster", () => {
    renderAs(coordinator);
    expect(screen.getByTestId("ward-statistics-ward-beds-now")).toBeTruthy();
    expect(screen.getByTestId("ward-statistics-ward-referrals-panel")).toBeTruthy();
    expect(screen.getByTestId("ward-statistics-ward-roster")).toBeTruthy();
    expect(screen.getByText("Due out, 7 days")).toBeTruthy();
  });

  it("opens the coordinator's roster on its first eight rows, then Show more", () => {
    expect(current(busiest.id).length).toBeGreaterThan(8);
    renderAs(coordinator);
    const roster = screen.getByTestId("ward-statistics-ward-roster");
    const rows = () => roster.querySelectorAll("tbody tr").length;
    expect(rows()).toBe(8);
    const more = within(roster).getByRole("button", { name: /^Show \d+ more$/u });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(rows()).toBeGreaterThan(8);
    expect(within(roster).getByRole("button", { name: "Show fewer" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("puts the ward desk's bed totals in the hero once, with no Beds now card", () => {
    renderAs(wardDesk);
    expect(screen.queryByTestId("ward-statistics-ward-beds-now")).toBeNull();
    expect(screen.getAllByTestId("ward-stat-capacity-allocatable")).toHaveLength(1);
    expect(screen.getAllByTestId("ward-stat-capacity-empty")).toHaveLength(1);
    expect(screen.queryByText("Due out, 7 days")).toBeNull();
    expect(screen.getByText(/due in the next 7 days/u)).toBeTruthy();
  });

  it("leaves the ward desk's roster card out and keeps its referrals counts", () => {
    renderAs(wardDesk);
    expect(screen.queryByTestId("ward-statistics-ward-roster")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ward-roster-not-listed")).toBeNull();
    expect(screen.getByTestId("ward-statistics-ward-referrals-panel")).toBeTruthy();
    // Referrals sits in the right column, after Expected discharges.
    const measures = screen.getByTestId("ward-statistics-ward-measures");
    const columns = [...measures.children];
    const right = columns[columns.length - 1]!;
    expect(within(right as HTMLElement).getByTestId("ward-statistics-ward-referrals-panel")).toBeTruthy();
  });
});
