import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/ward-flow/statistics",
}));

import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { StatisticsJourneyView } from "@/components/ward-management/statistics/statistics-journey-view";
import { countInSentence } from "@/components/ward-management/statistics/statistics-small-numbers";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { SMALL_NUMBER_NOT_SHOWN } from "@/components/ward-management/ward-access-scope";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * F-55 (A9-36, approved by Josh 13 Nov 2026): Executive Statistics showed a withheld count as the word
 * "not": "0 of not shown refused so far" in a sentence, and "not" cut short on the Journey ribbon. The
 * small number rule itself is unchanged (D-179 item 9). Synthetic data only.
 */
afterEach(() => cleanup());

describe("F-55: a withheld count reads as words, never a cut-off 'not'", () => {
  it("words a withheld count in a sentence and leaves real figures as they are", () => {
    expect(countInSentence(SMALL_NUMBER_NOT_SHOWN)).toBe("an unstated number");
    expect(countInSentence(SMALL_NUMBER_NOT_SHOWN, "person", "people")).toBe("an unstated number of people");
    expect(`${countInSentence(0)} of ${countInSentence(SMALL_NUMBER_NOT_SHOWN)} refused so far`).toBe(
      "0 of an unstated number refused so far",
    );
    expect(countInSentence(1, "person", "people")).toBe("1 person");
    expect(countInSentence(7, "person", "people")).toBe("7 people");
    // A "fewer than" count takes the plural, so the grammar never gives a 1 away.
    expect(countInSentence("fewer than 5", "person", "people")).toBe("fewer than 5 people");
  });

  it("sets a withheld Journey figure on one line, whole", () => {
    const state = seedWardFlowState();
    const report = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: NOW_ANCHOR,
        dayZero: "2026-10-24T00:00:00.000Z",
        startedAt: "2026-10-24T00:00:00.000Z",
        places: wardPlaceLookup(state.units),
      },
    );
    const counted = report.journey.filter((stage) => stage.figure.kind === "count");
    expect(counted.length).toBeGreaterThan(1);
    const [target, exact] = counted;
    const withheld = {
      ...report,
      journey: report.journey.map((stage) =>
        stage.id === target.id
          ? { ...stage, figure: { kind: "count" as const, count: { kind: "withheld" as const } } }
          : stage.id === exact.id
            ? { ...stage, figure: { kind: "count" as const, count: { kind: "exact" as const, value: 12 } } }
            : stage,
      ),
    } as typeof report;
    const binding = { actorId: "synthetic-executive", accessContext: "a".repeat(64), epoch: 1, revision: 7 };
    const wrap = (children: ReactNode) => (
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: withheld }}
        now={150}
        controls={{ executive: true, paused: false, togglePause: vi.fn() }}
      >
        {children}
      </ExecutiveStatisticsProvider>
    );
    render(wrap(<StatisticsJourneyView onShowBoard={vi.fn()} />));
    const node = screen.getByTestId(`ward-statistics-journey-node-${target.id}`);
    const figure = node.querySelector("[data-worded]");
    expect(figure).toHaveTextContent(SMALL_NUMBER_NOT_SHOWN);
    const shown = screen.getByTestId(`ward-statistics-journey-node-${exact.id}`);
    expect(shown).toHaveTextContent("12");
    expect(shown.querySelector("[data-worded]")).toBeNull();
  });
});
