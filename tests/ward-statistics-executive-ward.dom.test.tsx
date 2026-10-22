import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: the section frame renders next/link anchors and jsdom
// cannot provide an App Router context.
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
import { WF_PHONE_QUERY } from "@/components/wf/use-is-phone";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

/**
 * Executive Statistics on one ward (role access plan, Josh's yes 15 Oct 2026): below the headline,
 * a count of people under 5 reads "fewer than 5", lists of people give way to a note, and bed
 * figures stay exact. Every other desk sees the page as before.
 */

const UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

/** Three synthetic admissions with no discharge date, two of them blocked. */
const THREE = ["ADM-exec-a", "ADM-exec-b", "ADM-exec-c"].map(
  (id, index) =>
    ({
      id,
      unitId: UNIT.id,
      state: "occupied",
      sex: "Female",
      homeRegion: "Perth Metropolitan",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      referralId: null,
      tentativeDiagnosis: null,
      awayAtEmergencyDepartmentSince: null,
      pulledAt: NOW_ANCHOR - 60,
      arrivedAt: NOW_ANCHOR - 60,
      expectedDischargeAt: null,
      dischargeDateMoves: 0,
      dischargeDateSetAt: null,
      dischargeDateSetBy: null,
      leftAt: null,
      blockReason: index === 2 ? null : index === 0 ? "Awaiting transport" : "Awaiting clean",
    }) as unknown as Admission,
);

function renderWard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsWardScreen unitId={UNIT!.id} units={[UNIT!]} admissions={THREE} />
    </WardFlowProvider>,
  );
}

function asExecutive() {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "executive", scope: { kind: "statewide" } });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    // The store reloads the desk from session storage, so that goes too.
    window.sessionStorage.clear();
    resetWardAccessStoreForTests();
  });
});

describe("ward statistics on the executive desk", () => {
  it("words small counts of people, hides the roster and keeps bed figures exact", () => {
    asExecutive();
    const { container } = renderWard();

    expect(screen.getByTestId("ward-stat-discharge-date-not-recorded")).toHaveTextContent("fewer than 5");
    expect(screen.getByTestId("ward-stat-discharge-date-share")).toHaveTextContent("not shown");
    const reasonCounts = screen
      .getAllByTestId(/^ward-stat-blocked-by-reason-.+-count$/)
      .map((element) => element.textContent);
    expect(reasonCounts).toContain("fewer than 5");
    expect(reasonCounts).not.toContain("1");

    expect(screen.getByTestId("ward-statistics-ward-roster-not-listed")).toHaveTextContent(
      "Counts only on this desk, so people are not listed.",
    );
    // No admission number anywhere, the bed map's hover titles included.
    expect(container.innerHTML).not.toContain("ADM-exec-");
    expect(container.querySelector("[data-admission-id]")).toBeNull();

    expect(screen.getByTestId("ward-stat-capacity-empty")).toHaveTextContent(String(UNIT!.empty.value));
    expect(screen.getByTestId("ward-stat-capacity-allocatable")).toHaveTextContent(String(UNIT!.allocatable.value));
  });

  it("shows the executive the same bed figures as the coordinator", () => {
    const BEDS = ["ready", "empty", "allocatable", "pending-preparation"].map((key) => `ward-stat-capacity-${key}`);
    const beds = () => BEDS.map((testId) => screen.getByTestId(testId).textContent);
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    const { unmount } = renderWard();
    const coordinator = beds();
    unmount();

    asExecutive();
    renderWard();
    expect(beds()).toEqual(coordinator);
    for (const value of coordinator) expect(value).toMatch(/^\d+$/);
  });

  it("hides the phone's per-admission lists too", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === WF_PHONE_QUERY,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    asExecutive();
    const { container } = renderWard();
    expect(screen.getByTestId("ward-statistics-ward-phone-not-listed")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Ward list" })).toBeNull();
    expect(container.innerHTML).not.toContain("ADM-exec-");
    expect(screen.getByTestId("ward-statistics-ward-phone-beds")).toBeInTheDocument();
  });

  it("leaves the coordinator, and the flag off, with exact counts and the roster", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    const { unmount } = renderWard();
    expect(screen.getByTestId("ward-stat-discharge-date-not-recorded")).toHaveTextContent("3");
    expect(screen.queryByTestId("ward-statistics-ward-roster-not-listed")).toBeNull();
    expect(screen.getByTestId("ward-statistics-ward-roster")).toHaveTextContent("ADM-exec-a");
    unmount();

    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    renderWard();
    expect(screen.getByTestId("ward-stat-discharge-date-not-recorded")).toHaveTextContent("3");
    expect(screen.getByTestId("ward-statistics-ward-roster")).toHaveTextContent("ADM-exec-a");
  });
});
