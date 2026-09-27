import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { RECENTLY_DECIDED_DISPLAY_LIMIT } from "@/components/ward-management/ward-referrals";
import { referrals } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 THE BOARD SAID "Recently decided (10)" WHILE EIGHTEEN HAD BEEN DECIDED — owner ruling 2026-09-06.
 *
 * The number was `decided.length` taken AFTER the list had been truncated to
 * `RECENTLY_DECIDED_DISPLAY_LIMIT`, so it printed the display cap in the grammatical position of a
 * total. **It was correct for months and became false without any code changing**: the seed grew
 * past ten, and an expression that had always meant "how many there are" silently started meaning
 * "how many fit".
 *
 * ⚠️ **BOTH NUMBERS MUST BE DERIVED AND NEITHER TYPED, WHICH IS WHY THIS FILE EXISTS.** This exact
 * figure has gone stale twice by being written down — `tests/ui-ward-referrals.spec.ts` carries the
 * history of both, including the time a fixture commit made it wrong and every required gate stayed
 * green for five hours because the six `ui-ward-*` journeys run only in an advisory lane. **So the
 * guard belongs in the ordinary unit suite, not beside that history**, or it is a guard that runs
 * in neither loop.
 *
 * ⚠️ **THE EXPECTATION IS COMPUTED HERE, OVER THE RAW SEED, AND SHARES NO CODE WITH THE BOARD.**
 * Calling `decidedReferrals` — the function the board uses — would make these assertions true by
 * construction and absorb the next fixture change in silence. That argument was made on the other
 * side of an earlier merge over this same number and it was right; it is kept.
 */
const NOW = NOW_ANCHOR;

/**
 * "Decided" re-derived independently: a referral with any destination no longer queued. Written
 * from the domain rule rather than imported, for the reason above.
 */
const decidedInSeed = referrals.filter((referral) =>
  referral.destinations.some((destination) => destination.state !== "queued"),
).length;

const shownInSeed = Math.min(decidedInSeed, RECENTLY_DECIDED_DISPLAY_LIMIT);

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <ReferralBoard />
    </WardFlowProvider>,
  );
}

function headingText(): string {
  return screen.getByTestId("ward-referral-board-decided").querySelector("h2")?.textContent ?? "";
}

/** Every run of digits in the heading, as numbers. */
function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+/gu)].map((match) => Number(match[0]));
}

describe("the referral board's decided heading names the total, not the display cap", () => {
  it("has a seed that is actually truncated, or this whole file is vacuous", () => {
    // 🔴 THE ASSERTION THAT TELLS "the heading is right" FROM "there is nothing to get wrong".
    // While the seed sits below the cap the two numbers are equal, every assertion below passes on
    // the OLD broken code too, and this guard would be decoration. It goes red the day the seed
    // shrinks under ten — which is the day somebody must decide whether this guard still means
    // anything, rather than the day it quietly stops meaning it.
    expect(referrals.length, "no referrals in the seed at all").toBeGreaterThan(0);
    expect(
      decidedInSeed,
      `the seed holds ${decidedInSeed} decided referrals and the display cap is ` +
        `${RECENTLY_DECIDED_DISPLAY_LIMIT}. Nothing is truncated, so the shown count and the total are ` +
        "equal and this file cannot detect the defect it exists for.",
    ).toBeGreaterThan(RECENTLY_DECIDED_DISPLAY_LIMIT);
  });

  it("names the true total of decided referrals", () => {
    // The defect in one assertion: the total must appear. Before the fix the heading's only number
    // was the cap, so this is the line that would have gone red.
    renderBoard();
    expect(
      numbersIn(headingText()),
      `the heading reads "${headingText().trim()}" and never names ${decidedInSeed}, the number of ` +
        "referrals that have actually been decided — so it presents the display cap as a total",
    ).toContain(decidedInSeed);
  });

  it("also names how many are shown, so the two are not conflated", () => {
    renderBoard();
    expect(
      numbersIn(headingText()),
      `the heading reads "${headingText().trim()}" and does not say how many rows are shown ` +
        `(${shownInSeed}), so a reader cannot tell the list is truncated`,
    ).toContain(shownInSeed);
  });

  it("renders exactly the capped number of rows, so the heading's smaller number is the real one", () => {
    // ⚠️ WITHOUT THIS, "names both numbers" could be satisfied by a heading that says anything at
    // all while the list below it disagrees. Ties the claim to what is actually on the page.
    renderBoard();
    const cards = screen
      .getByTestId("ward-referral-board-decided")
      .querySelectorAll('[data-testid^="ward-referral-board-decided-card-"]');
    expect(cards.length, "the rendered decided rows do not match the display cap").toBe(shownInSeed);
  });

  it("detects the old heading when one is constructed, so the assertions above are not decoration", () => {
    // 🔴 THE CONTROL. The defect was a heading whose only number was the cap. Both predicates above
    // are applied to that exact string and must reject it, and to the fixed string and must accept
    // it — checked in both directions so a detector that matches everything, or nothing, is caught.
    const broken = `Recently decided (${shownInSeed})`;
    const fixed = `Recently decided — ${shownInSeed} most recent of ${decidedInSeed}`;

    expect(numbersIn(broken), "the shipped defect must not appear to name the total").not.toContain(decidedInSeed);
    expect(numbersIn(fixed), "the fixed heading must name the total").toContain(decidedInSeed);
    expect(numbersIn(fixed), "the fixed heading must name the shown count").toContain(shownInSeed);
    // And the fixed heading must not be satisfiable by repeating one number twice.
    expect(shownInSeed, "the control is vacuous if the two numbers are equal").not.toBe(decidedInSeed);
  });
});
