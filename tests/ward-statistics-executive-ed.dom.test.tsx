import { act, render, screen, within } from "@testing-library/react";
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
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WF_PHONE_QUERY } from "@/components/wf";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";

/**
 * Executive Statistics on one ED (role access plan, Josh's yes 15 Oct 2026): counts only. A small
 * count reads "fewer than 5", a band beside a hidden one is not shown, and every list of people is
 * replaced by a note. The coordinator, and every desk with the flag off, sees today's screen.
 */

const DEPARTMENTS = allEmergencyDepartments();
const HERE = DEPARTMENTS[0]!;
const OTHER = DEPARTMENTS[1]!;

function movement(overrides: Partial<Movement> & Pick<Movement, "id" | "originEdId">): Movement {
  return {
    openedAt: NOW_ANCHOR - 60,
    flaggedUrgent: false,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    observation: GENERAL_OBSERVATION,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "placement_requested",
    owner: "Test owner",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

// Here: two under 4 hours and six at 5 hours, so the bands read 2 and 6 against a total of 8.
// One of the two declines for want of a bed. Another department has one person past 24 hours.
const MOVEMENTS: Movement[] = [
  movement({
    id: "WF-x1",
    originEdId: HERE.id,
    declines: [{ unitId: "unit-a", at: NOW_ANCHOR - 10, reason: "no_suitable_bed" }],
  }),
  movement({ id: "WF-x2", originEdId: HERE.id }),
  ...Array.from({ length: 6 }, (_, index) =>
    movement({ id: `WF-y${index}`, originEdId: HERE.id, openedAt: NOW_ANCHOR - 300 }),
  ),
  movement({ id: "WF-z1", originEdId: OTHER.id, openedAt: NOW_ANCHOR - 1500 }),
];

let executive = false;
function asDesk(role: "executive" | "coordinator", flag: boolean) {
  executive = role === "executive" && flag;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", flag);
    setWardAccess({ role, scope: { kind: "statewide" } });
  });
}

function renderExecutiveEd(edId = HERE.id) {
  const state = { ...seedWardFlowState(), movements: MOVEMENTS };
  const data = projectExecutiveReportingFoundation(
    state,
    { role: "executive", scope: { kind: "statewide" } },
    {
      now: NOW_ANCHOR,
      dayZero: "2026-10-24T00:00:00.000Z",
      startedAt: "2026-10-24T00:00:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
  const binding = { actorId: "synthetic-ed-report", accessContext: "b".repeat(64), epoch: 0, revision: 1 };
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={{ binding, receivedAt: 100, expiresAt: 200, data }}
      now={150}
    >
      <StatisticsEdScreen edId={edId} />
    </ExecutiveStatisticsProvider>,
  );
}
function renderEd() {
  if (executive) return renderExecutiveEd();
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsEdScreen edId={HERE.id} movements={MOVEMENTS} />
    </WardFlowProvider>,
  );
}

const text = (testId: string) => (screen.getByTestId(testId).textContent ?? "").trim();

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  vi.unstubAllGlobals();
});

describe("one ED on the executive desk, counts only", () => {
  it("words a small headline count", () => {
    asDesk("executive", true);
    renderExecutiveEd(OTHER.id);
    // One person waits at the other department.
    expect(text("ward-stat-ed-on-the-list")).toBe("fewer than 5");
  });

  it("words small counts in the comparison, the bands and the declines", () => {
    asDesk("executive", true);
    renderEd();

    // The complete release also withholds this total to protect the other ED's small count.
    expect(text(`ward-stat-ed-comparison-waiting-${HERE.id}`)).toBe("not shown");
    expect(text(`ward-stat-ed-comparison-waiting-${HERE.id}`)).not.toBe("8");
    expect(text(`ward-stat-ed-comparison-waiting-${OTHER.id}`)).toBe("fewer than 5");
    expect(text(`ward-stat-ed-comparison-over24h-${OTHER.id}`)).toBe("fewer than 5");
    // A duration, not a count of people, so it stays.
    expect(text(`ward-stat-ed-comparison-longest-${OTHER.id}`)).toBe("1d 1h");

    expect(text("ward-statistics-ed-band-count-under-4-hours")).toBe("fewer than 5");
    // The bands add up to the Waiting total, so the band beside the hidden one is hidden too.
    expect(text("ward-statistics-ed-band-count-4-to-8-hours")).toBe("not shown");
    expect(text("ward-statistics-ed-band-count-8-to-12-hours")).toBe("none");

    expect(text("ward-stat-ed-declined-no-free-bed")).toBe(
      "fewer than 5 declines name a ward that had no suitable bed.",
    );
  });

  it("replaces the wait table, next to cross and the swarm with the note", () => {
    asDesk("executive", true);
    renderEd();

    const wait = screen.getByTestId("ward-statistics-ed-wait");
    expect(within(wait).getByText("Open ED journeys")).toBeTruthy();
    expect(within(wait).queryByTestId("ward-stat-ed-wait-table")).toBeNull();
    expect(within(wait).getByTestId("ward-statistics-ed-wait-not-listed")).toBeTruthy();
    expect(screen.queryByTestId("ward-stat-ed-wait-row-WF-x1")).toBeNull();
    expect(screen.getByTestId("ward-statistics-ed-next-not-listed")).toBeTruthy();
    expect(screen.getByTestId("ward-statistics-ed-everyone-not-listed")).toBeTruthy();
    expect(
      within(screen.getByTestId("ward-statistics-ed-everyone")).queryByRole("link", { name: /Tier [123]/u }),
    ).toBeNull();
  });

  it("leaves the people out on a phone too", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === WF_PHONE_QUERY,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    asDesk("executive", true);
    renderEd();

    expect(screen.getByTestId("ward-statistics-ed-phone-not-listed")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-ed-phone-next")).toBeNull();
    expect(screen.queryByTestId("ward-stat-ed-phone-row-WF-x1")).toBeNull();
  });
});

describe.each([
  ["the coordinator", "coordinator", true],
  ["the executive with the flag off", "executive", false],
] as const)("one ED for %s", (_name, role, flag) => {
  it("shows exact counts and the list of people", () => {
    asDesk(role, flag);
    renderEd();

    expect(text(`ward-stat-ed-comparison-waiting-${OTHER.id}`)).toBe("1");
    expect(text(`ward-stat-ed-comparison-over24h-${OTHER.id}`)).toBe("1");
    expect(text("ward-statistics-ed-band-count-under-4-hours")).toBe("2");
    expect(text("ward-statistics-ed-band-count-4-to-8-hours")).toBe("6");
    expect(text("ward-stat-ed-declined-no-free-bed")).toBe("1 decline names a ward that had no suitable bed.");
    expect(screen.getByTestId("ward-stat-ed-wait-table")).toBeTruthy();
    expect(screen.getByTestId("ward-stat-ed-wait-row-WF-x1")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-people-not-listed")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ed-wait-not-listed")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ed-everyone-not-listed")).toBeNull();
  });
});
