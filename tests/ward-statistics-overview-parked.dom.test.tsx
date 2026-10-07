import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import {
  admissionStagePosition,
  bedsBeingPrepared,
  declinesByReason,
  refusedAndNothingPending,
  type AdmissionStagePosition,
} from "@/components/ward-management/statistics/statistics-derivations";

import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE OVERVIEW STOPPED BEING A SKELETON ON 2026-09-06, AND THIS FILE'S SUBJECT CHANGED WITH
 * IT — RE-POINTED, NOT RETIRED.**
 *
 * Until this task the page rendered no figure and said so in its own words: *"No whole-of-prototype
 * figure has been derived, so this page shows none — not a nought, and not a dash standing where a
 * number will go."* This file used to be the tripwire that kept that sentence honest: it went red
 * the day a figure and the "no figure" claim disagreed with each other.
 *
 * The task that added real figures to this page makes that sentence FALSE, so the sentence is gone
 * — but the risk the tripwire was guarding against has not gone anywhere. A page whose whole
 * character was "never show a figure this prototype cannot honestly support" can still, at any
 * later edit, grow a placeholder nought or a dash standing in for one it cannot support. **The new
 * subject is: every numeral this page renders is either independently reproducible from the same
 * state the screen reads, using the same derivations the screen itself calls, or it lives inside
 * the one labelled demonstration wrapper (Task 1) that this prototype keeps no history to back.**
 *
 * ⚠️ **RECOMPUTED, NOT READ BACK OFF THE COMPONENT.** Every expected number below comes from calling
 * the exported derivation functions directly against `seedWardFlowStateAt(0)` — the exact state
 * `<WardFlowProvider initialNow={NOW_ANCHOR}>` seeds internally (`anchorOffsetMinutes` is `initialNow
 * - NOW_ANCHOR`, which is `0` here) — not from importing anything private out of the screen file.
 * A screen that quietly substituted a different number for a real one would have to make this
 * independent recomputation agree with it by accident, which a hand-typed literal could not do.
 *
 * ⚠️ **EACH ASSERTION IS SCOPED TO ITS OWN LEAF TESTID, NEVER TO JOINED SIBLING TEXT.**
 * `document.body.textContent` (and any ancestor's `.textContent`) concatenates sibling text nodes
 * with NO separator, so "North Metro" beside "2" beside "Ready to admit" can arrive as
 * `"North Metro2Ready to admit"` — a `/\b2\b/` regex over that joined string never matches, because
 * neither "o2" nor "2R" is a word boundary. Every figure this screen renders carries its own
 * `data-testid` on a small element whose trimmed text is the number and nothing else, and every
 * assertion below reads exactly that element rather than scanning a region's joined text.
 */

function renderOverview() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsOverviewScreen />
    </WardFlowProvider>,
  );
}

/** The page's own body text, tags stripped, so a CSS Module class hash cannot pass as a figure. */
function bodyText(): string {
  return (document.body.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/** The trimmed text of one leaf figure element, by its own testid — never a joined ancestor. */
function value(testId: string): string {
  return (screen.getByTestId(testId).textContent ?? "").trim();
}

const ADMISSION_STAGE_POSITIONS: readonly AdmissionStagePosition[] = [
  "no-bed-yet",
  "bed-given-not-arrived",
  "in-the-bed",
  "ended",
];

describe("the statistics overview now carries real figures, honestly", () => {
  /**
   * ⚠️ **THE FLOOR FIRST.** Everything below is a statement about what the page does and does not
   * contain. A page that threw, or rendered an empty shell, would satisfy every negative below
   * trivially and prove nothing at all.
   */
  it("renders a page with substantial content", () => {
    renderOverview();
    expect(bodyText().length, "the overview rendered almost nothing").toBeGreaterThan(1200);
  });

  /**
   * 🔴 **THE RETIRED SENTENCE, FORBIDDEN RATHER THAN SOFTENED.** Described here instead of quoted
   * back word for word — the same discipline this file's own screen already applies to the
   * reachability sentence it retired on 2026-09-01 — so the retired wording exists nowhere in the
   * tree and no scan can mistake this guard for a relapse. If either fragment below has returned,
   * either the page has regressed to the skeleton or a later edit reintroduced the old claim beside
   * new figures, which is worse: a page cannot honestly say both "no figure has been derived" and
   * render one.
   */
  it("never claims no whole-of-prototype figure has been derived", () => {
    renderOverview();
    const text = bodyText();
    expect(text).not.toContain("No whole-of-prototype figure has been derived");
    expect(text).not.toContain("not a nought, and not a dash");
  });

  /**
   * 🔴 **THE REPLACEMENT TRIPWIRE.** Every genuine count this screen renders is recomputed here from
   * the same derivations the screen itself imports, against the identical seeded state the screen
   * renders against. A screen that substituted an invented number for a real one, or that quietly
   * stopped calling a derivation and hard-coded its last output instead, would have to make this
   * independent computation agree by coincidence — which is exactly what a hand-typed literal in
   * the screen could not reliably do against a seed with hundreds of records.
   */
  it("renders the admission-stage table exactly as admissionStagePosition computes it", () => {
    const seed = seedWardFlowStateAt(0);
    const expectedCounts: Record<AdmissionStagePosition, number> = {
      "no-bed-yet": 0,
      "bed-given-not-arrived": 0,
      "in-the-bed": 0,
      ended: 0,
    };
    for (const admission of seed.admissions) {
      expectedCounts[admissionStagePosition(admission)] += 1;
    }

    renderOverview();

    for (const position of ADMISSION_STAGE_POSITIONS) {
      expect(value(`ward-statistics-overview-stage-${position}`), `stage "${position}"`).toBe(
        String(expectedCounts[position]),
      );
    }
  });

  it("renders the declines-by-reason table exactly as declinesByReason computes it", () => {
    const seed = seedWardFlowStateAt(0);
    const expected = declinesByReason(seed.movements);

    renderOverview();

    expect(value("ward-statistics-overview-declines-total")).toBe(String(expected.totalCount));
    expect(value("ward-statistics-overview-declines-movements-with")).toBe(String(expected.movementsWithDeclinesCount));
    expect(value("ward-statistics-overview-declines-movements")).toBe(String(expected.movementCount));
    expect(value("ward-statistics-overview-declines-vocabulary-size")).toBe(String(expected.vocabularySize));

    for (const tally of expected.tallies) {
      expect(value(`ward-statistics-overview-decline-${tally.reason}`), `reason "${tally.reason}"`).toBe(
        String(tally.count),
      );
    }
  });

  it("renders beds-being-prepared exactly as bedsBeingPrepared computes it", () => {
    const seed = seedWardFlowStateAt(0);
    const expected = bedsBeingPrepared(seed.bedReleases);

    renderOverview();

    expect(value("ward-statistics-overview-preparing-value")).toBe(String(expected));
  });

  it("renders refused-and-nothing-pending exactly as refusedAndNothingPending computes it", () => {
    const seed = seedWardFlowStateAt(0);
    const expected = refusedAndNothingPending(seed.movements, seed.units, NOW_ANCHOR);

    renderOverview();

    expect(value("ward-statistics-overview-refused-so-far-value")).toBe(String(expected.count));
    expect(value("ward-statistics-overview-refused-so-far-open-count")).toBe(String(expected.openMovementCount));
    expect(value("ward-statistics-overview-refused-so-far-escalated")).toBe(String(expected.escalatedCount));
  });

  it("renders Ready/Empty/Allocatable exactly as unitCapacity sums it across every unit", () => {
    const seed = seedWardFlowStateAt(0);
    let ready = 0;
    let empty = 0;
    let allocatable = 0;
    for (const unit of seed.units) {
      ready += unitCapacity(unit, seed.bedReleases).available;
      empty += unit.empty.value;
      allocatable += unit.allocatable.value;
    }

    renderOverview();

    expect(value("ward-statistics-overview-capacity-ready")).toBe(String(ready));
    expect(value("ward-statistics-overview-capacity-empty")).toBe(String(empty));
    expect(value("ward-statistics-overview-capacity-allocatable")).toBe(String(allocatable));
  });

  /**
   * ⚠️ **NO PLACEHOLDER NOUGHT AND NO DASH, ANYWHERE A FIGURE IS RENDERED.** None of the five
   * derivations this page reads (`admissionStagePosition`, `declinesByReason`, `bedsBeingPrepared`,
   * `refusedAndNothingPending`, `unitCapacity`) has a nullable-average shape — every one returns a
   * genuine count — so there is structurally nowhere on this page for an absence to be rendered as a
   * dash standing in for a number, and every leaf value element must therefore hold pure digits and
   * nothing else: no dash, no "N/A", no empty string.
   */
  it("every figure leaf is pure digits — no dash and no blank standing in for a number", () => {
    renderOverview();

    const leafTestIds = [
      "ward-statistics-overview-capacity-ready",
      "ward-statistics-overview-capacity-empty",
      "ward-statistics-overview-capacity-allocatable",
      ...ADMISSION_STAGE_POSITIONS.map((position) => `ward-statistics-overview-stage-${position}`),
      "ward-statistics-overview-declines-total",
      "ward-statistics-overview-declines-movements-with",
      "ward-statistics-overview-declines-movements",
      "ward-statistics-overview-declines-vocabulary-size",
      "ward-statistics-overview-refused-so-far-value",
      "ward-statistics-overview-refused-so-far-open-count",
      "ward-statistics-overview-refused-so-far-escalated",
      "ward-statistics-overview-preparing-value",
    ];

    for (const testId of leafTestIds) {
      const text = value(testId);
      expect(text, `"${testId}" is not pure digits: "${text}"`).toMatch(/^\d+$/u);
    }

    for (const reason of declinesByReason(seedWardFlowStateAt(0).movements).tallies.map((tally) => tally.reason)) {
      const testId = `ward-statistics-overview-decline-${reason}`;
      const text = value(testId);
      expect(text, `"${testId}" is not pure digits: "${text}"`).toMatch(/^\d+$/u);
    }
  });

  /**
   * ⚠️ **THE ONE INVENTED NUMBER ON THIS PAGE IS LABELLED, AND ONLY IT MAY BE.** Task 1's wrapper is
   * the sole place a `DemonstrationSeries` can be rendered anywhere under `ward-management/` — a
   * source scan elsewhere holds that boundary structurally. This test only has to prove the wrapper
   * is present and says, in words, that it is not real; it does not have to reprove Task 1's own
   * contract.
   */
  // Josh, 25 Sept 2026: a made-up trend shows "Not recorded" and is not drawn.
  it("carries exactly one trend, and it says Not recorded rather than drawing one", () => {
    renderOverview();

    const main = within(screen.getByTestId("ward-statistics-overview-screen")).getByRole("main");
    const charts = main.querySelectorAll('[data-ward-primitive="demonstration-chart"]');
    expect(charts.length, "expected exactly one demonstration chart on this page").toBe(1);

    const chart = charts[0];
    expect(chart.textContent).toContain("Not recorded");
    expect(chart.querySelectorAll("p")).toHaveLength(1);
    expect(chart.querySelector("svg"), "no invented line is drawn").toBeNull();
  });

  /**
   * The declines-by-reason figure is scoped to patients already inside an emergency department —
   * the owner's ruling for this figure — and the screen must say who that excludes. Scoped to the
   * disclosure's own testid rather than the whole page, so a false positive elsewhere in the page's
   * prose cannot satisfy it.
   */
  it("uses visible operational panels instead of the retired explanation: states who the declines-by-reason figure misses", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-declines-scope");
  });

  /** The two tables the brief requires, at minimum. */
  it("carries at least two real data tables", () => {
    renderOverview();
    expect(screen.getByTestId("ward-statistics-overview-stage-table")).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-overview-declines-table")).toBeInTheDocument();
  });

  /** The three disclosures the brief requires, at minimum — native `<details>` elements, per the
   *  fourth-edition design language's `.reveal` primitive. */
  it("uses visible operational panels instead of the retired explanation: carries at least three disclosures", () => {
    assertStatisticsPresentation("overview");
  });

  it("uses visible operational panels instead of the retired explanation: shows the shared section title and retained reporting scope and provenance", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-invented-figures");
  });
});
