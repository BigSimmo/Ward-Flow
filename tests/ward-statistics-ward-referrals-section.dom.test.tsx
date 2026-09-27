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

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * 🔴 **REFERRALS INTO ONE WARD, ON THE SCREEN — OWNER-RULED 2026-09-12, DIRECT: *"Yes do it"*, in
 * answer to *"I've built a counter that no page shows yet. Shall I put it on the ward statistics
 * page?"***
 *
 * ⚠️ **CHANNEL, BECAUSE THIS LANE NOW RECORDS IT: answered to me directly, not relayed.** The same
 * reply confirmed O-16.7 first-hand and deferred D-2. **A relayed ruling and a direct one read
 * identically once written into a file, which is why the channel is stated rather than implied.**
 *
 * 🔴 **THE DERIVATION SHIPPED WITH ZERO PRODUCTION CALLERS AND SIX PASSING TESTS** — correct,
 * covered and unreachable, which is a shape this repository has recorded under its own name. **This
 * file is what makes those six mean something, so its first duty is to assert the numbers reach a
 * READER.**
 *
 * ---
 *
 * 🔴 **TWO OF THESE TESTS WERE WORTHLESS IN THEIR FIRST VERSION AND MUTATION IS THE ONLY REASON I
 * KNOW. Both are recorded here rather than quietly rewritten, because the shapes recur.**
 *
 * **(1) THE "NO TOTAL" GUARD COULD NOT FAIL.** It asserted `section.textContent` did not match
 * `/\b4\b/`. ⚠️ **`textContent` concatenates adjacent elements with NO separator**, so the rendered
 * page reads `...Ever declined by this ward1Referrals received4These three are...` — the digit is
 * glued between `d` and `T`, both word characters, so **`\b` never fires and the pattern can never
 * match.** 🔴 **I re-added the exact forbidden total the drawing asks for, and all five tests stayed
 * green.** It now reads the `dd` elements as values instead of pattern-matching flattened prose.
 *
 * **(2) THE FIGURES WERE CHECKED ON A WARD WHERE ONE OF THEM WAS NOUGHT.** `rph-adult-secure` is
 * `{asked 0, accepted 2, declined 1}`, so the `asked` assertion compared 0 with 0 and would have
 * held with that slot wired to anything empty. ⚠️ **The anti-vacuity floor I wrote was on the SUM,
 * which was 3 and looked healthy — a floor over an aggregate does not defend the members.**
 */

const SEED = seedWardFlowState();

/**
 * 🔴 **THE ONE SEEDED WARD THAT EXERCISES ALL THREE FIGURES AT ONCE.** Measured across all 23 units,
 * not chosen by eye: `bty-adult-secure` is the only id where `askedAndWaiting`, `everAccepted` and
 * `everDeclined` are all non-zero (1 / 2 / 1).
 */
const ALL_THREE_UNIT = "bty-adult-secure";

/**
 * 🔴 **THREE WARDS THAT EACH EXERCISE EXACTLY ONE FIGURE — this is what pins each number to its own
 * slot.** On a ward with all three non-zero, two of them happen to be 1, so a swap of those two
 * would survive. ✅ **Here each ward has exactly one non-zero figure, so ANY misrouting between the
 * three slots moves a number onto a ward that should be showing nought.** Measured from the seed.
 */
const ONE_FIGURE_UNITS = [
  { unitId: "gry-older-adult", slot: "asked", expected: 1 },
  { unitId: "alb-adult-open", slot: "accepted", expected: 3 },
  { unitId: "gry-adult-secure", slot: "declined", expected: 2 },
] as const;

function renderWard(unitId: string) {
  render(
    <WardFlowProvider>
      <StatisticsWardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
  return screen.getByTestId("ward-stat-referrals");
}

/** The three figures as they are actually rendered, read as values rather than as flattened prose. */
function renderedFigures(section: HTMLElement) {
  return {
    asked: within(section).getByTestId("ward-stat-referrals-asked").textContent,
    accepted: within(section).getByTestId("ward-stat-referrals-accepted").textContent,
    declined: within(section).getByTestId("ward-stat-referrals-declined").textContent,
  };
}

describe("the ward statistics screen's referral counts", () => {
  it("renders the section at all", () => {
    expect(renderWard(ALL_THREE_UNIT)).toBeInTheDocument();
  });

  /**
   * ⚠️ **THE FLOOR IS PER FIGURE, NOT ON THEIR SUM** — see (2) in this file's header. A sum-based
   * floor passed while one of the three compared nought with nought.
   */
  it("shows the derivation's own three figures, on a ward where none of them is nought", () => {
    const expected = wardReferralTally(SEED.movements, ALL_THREE_UNIT);
    expect(expected.askedAndWaiting, "the chosen ward has nobody asking").toBeGreaterThan(0);
    expect(expected.everAccepted, "the chosen ward has accepted nothing").toBeGreaterThan(0);
    expect(expected.everDeclined, "the chosen ward has declined nothing").toBeGreaterThan(0);

    expect(renderedFigures(renderWard(ALL_THREE_UNIT))).toEqual({
      asked: String(expected.askedAndWaiting),
      accepted: String(expected.everAccepted),
      declined: String(expected.everDeclined),
    });
  });

  /**
   * 🔴 **EACH FIGURE IS PINNED TO ITS OWN SLOT, USING A WARD WHERE ONLY THAT ONE IS NON-ZERO.** Any
   * swap between two slots moves a number onto a ward that should be showing nought, so it reddens
   * — which a same-valued pair on a single ward cannot catch.
   */
  it.each(ONE_FIGURE_UNITS)("carries only the $slot figure on $unitId", ({ unitId, slot, expected }) => {
    const figures = renderedFigures(renderWard(unitId));
    const wanted = { asked: "0", accepted: "0", declined: "0", [slot]: String(expected) };
    expect(figures).toEqual(wanted);
  });

  /**
   * 🔴 **THE DRAWING'S "RECEIVED" TOTAL AND "ACCEPTED SHARE" MUST NOT APPEAR, AND THIS READS THE
   * `dd` ELEMENTS RATHER THAN PATTERN-MATCHING THE PROSE.** See (1) in this file's header: the
   * regex version could not fail, and it did not fail when the total was really put back.
   *
   * ⚠️ **The expected values are computed from the live tally, never typed**, so this keeps meaning
   * something when the seed changes rather than passing for the wrong reason.
   */
  it("publishes exactly three figures — no summed total, no share", () => {
    const tally = wardReferralTally(SEED.movements, ALL_THREE_UNIT);
    const section = renderWard(ALL_THREE_UNIT);

    const values = [...section.querySelectorAll("dd")].map((cell) => cell.textContent);
    expect(values, "a fourth figure — a total or a share — was published beside the three").toEqual([
      String(tally.askedAndWaiting),
      String(tally.everAccepted),
      String(tally.everDeclined),
    ]);
    expect(section.textContent ?? "", "a percentage was rendered in a section that has no denominator").not.toMatch(
      /%/,
    );
  });

  /**
   * ⚠️ **EACH FIGURE MUST CARRY ITS TENSE IN WORDS.** One is live and two are lifetime, and a reader
   * cannot see that from three numbers in a row. 🔴 **"Accepted" alone reads as "waiting to arrive",
   * which is false: `acceptedUnitId` survives the patient arriving and is cleared only by a
   * withdrawal of the acceptance.**
   */
  it("says in words that one figure is now and two are ever", () => {
    const text = renderWard(ALL_THREE_UNIT).textContent ?? "";
    expect(text, "nothing marks the live figure as being about right now").toMatch(
      /right now|at the moment|currently/i,
    );
    expect(text, "nothing marks the two cumulative figures as lifetime").toMatch(/ever/i);
  });

  /**
   * ⚠️ **THE OVERLAP MUST BE STATED ON THE PAGE, NOT ONLY IN THE MODULE'S DOC COMMENT.** A ward can
   * decline a movement and later accept it, so one movement can appear in two of these counts. **A
   * reader who adds two of them together is not being careless — nothing on the screen tells them
   * not to** unless this sentence is there.
   *
   * 🔴 **The testid sits on a SECTION wrapping heading, figures and sentence.** It was on the `dl`
   * first, so this assertion read only the three rows and could never have seen the warning however
   * correct the page was — a guard whose subject excludes the thing it guards.
   */
  it("warns on the page that one movement can appear in two of the counts", () => {
    const text = renderWard(ALL_THREE_UNIT).textContent ?? "";
    expect(text, "the screen does not warn that these figures overlap").toMatch(
      /same (movement|referral)|overlap|twice|both/i,
    );
  });
});
