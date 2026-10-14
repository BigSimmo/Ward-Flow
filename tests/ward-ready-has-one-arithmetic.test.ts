import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * ═══ "READY" IS ONE RULED NUMBER WITH FOUR IMPLEMENTATIONS, AND NOTHING MADE THEM AGREE ══════════
 *
 * Ruling R-B-09: **"Ready" is the one word for `min(allocatable, empty)`** — the beds a coordinator
 * can put somebody in. That expression is written out four times:
 *
 *     ward-derivations.ts       unitCapacity()          a figure somebody reads
 *     ward-bed-availability.ts  openBedsNow()           a figure read, AND the PULL_PATIENT gate
 *     ward-bed-availability.ts  capacityBreakdown()     a figure somebody reads
 *     ward-eligibility.ts       referralEligibility()   🔴 whether a bed is OFFERED AT ALL
 *
 * **Four arithmetics over one clinical fact.** They agree because the expressions are
 * character-identical — agreement by coincidence of authorship, not by construction. Nothing fails
 * if one changes.
 *
 * 🔴 **THE ELIGIBILITY COPY IS THE HIGHEST-CONSEQUENCE ONE AND IT WAS THE ONE NOBODY NAMED.** The
 * other three produce a number a human reads and can sanity-check. That one participates in whether
 * a patient is placed at all.
 *
 * ⚠️ **AND SOMEBODY ALREADY GOT THIS WRONG ONCE AND WROTE A WARNING INSTEAD OF A CHECK.**
 * `ward-eligibility.ts` carries the rule in prose — *"`Math.min(unit.allocatable.value,
 * unit.empty.value)` — never `unit.allocatable.value` alone"*. **A comment cannot fail.** This file
 * is what that comment should have been.
 *
 * ## Why this is not merely untidy, on these screens specifically
 *
 * **Two rendered sentences COMPARE two of the implementations, and a third gates on the comparison:**
 *
 *     statistics-service-screen   "…the number this service can act on right now is {A}, not {B}."
 *     statistics-ward-screen      "…the number available to act on right now is {A}."  (when A < B)
 *
 * `A` from `openBedsNow`, `B` from `unitCapacity().available`. If they diverge, the sentence stops
 * contrasting *pullable* against *Ready* and starts contrasting two opinions about Ready — reading
 * exactly as before. The conditional misfires both ways: hiding the warning where the constraint IS
 * biting, or reprinting the "is 12, not 12" contradiction removed from these screens on 2026-09-07.
 *
 * ## Credit, and how the count went from two to four
 *
 * **Ward Builder Four found the class** on the ward home — a row deriving its own count beside chips
 * from `capacityBreakdown()`, agreeing across all 23 units **by accident**, because the only control
 * that creates a release uses a `type="time"` input and cannot express a later day. *Agreement by
 * seed, not by construction.*
 *
 * ⚠️ **I then reported two copies. They measured four.** Two of the three I missed are in
 * `ward-bed-availability.ts` — **a file I had already opened and read.** That is why the census
 * below discovers occurrences from the tree instead of checking a list I would write from memory.
 *
 * ## Why a census as well as a behavioural test
 *
 * `referralEligibility` takes a `Referral`, a `WardReferralDestination`, a `Unit` and an `Instant`,
 * and returns a verdict rather than the number — so its copy cannot be compared to `unitCapacity`
 * without constructing a whole referral and inferring the arithmetic from a gate's pass or fail. The
 * behavioural test runs where it can; the census covers the two copies it cannot reach.
 *
 * ## Why none of this is a repair
 *
 * The obvious fix is for the three to call `unitCapacity(...).available`. **Deliberately not done.**
 * `openBedsNow` is what `ward-flow-reducer.ts` gates `PULL_PATIENT` on — *"a patient cannot be
 * pulled to a bed that is not open"* — and `referralEligibility` decides whether a ward is offered.
 * **Changing either is changing a clinical safety gate, and other chats are live in both files.**
 * Unifying them is those owners' decision, not a side effect of a statistics fix.
 *
 * ⚠️ **CHECKED AND NOT A DEFECT:** `statistics-claims-register.ts` also holds the expression, as the
 * `evidence` string `HELD_IS_DERIVED_FROM_TWO_AGGREGATES`. **That is a citation the register
 * verifies against its cited source file, not a blind fifth copy** — it goes red if that source
 * changes, which is the register working as designed. Two further occurrences are prose comments in
 * `ward-screen.tsx` and `ward-eligibility.ts`.
 */

// Named rather than written as an escape. A newline escape inside a source string is exactly what a
// scripted rewrite of this file through a shell turns into a real line break — it happened three
// times today, and `tests/helpers/strip-source-comments.ts` carries the same note for the same
// reason.
const NL = String.fromCharCode(10);

// Owner ruling 13 Oct 2026 (R-B-09 unified): the four copies became ONE, in
// `boundedBedAvailability` (ward-bed-availability.ts), which `unitCapacity`, `openBedsNow`,
// `capacityBreakdown` and `ward-eligibility.ts`'s `readyBedsNow` all call. The census now pins that
// single home, and the old four-copy expression must not come back anywhere as executable code.
const READY_EXPRESSION = "Math.min(unit.allocatable.value, effectiveEmpty)";
const RETIRED_READY_EXPRESSION = "Math.min(unit.allocatable.value, unit.empty.value)";

/** Every line in tracked source containing the ruled expression, discovered rather than listed. */
function readyOccurrences() {
  return execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
    .split(NL)
    .filter((file) => /\.tsx?$/u.test(file))
    .flatMap((file) => {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      return text
        .split(NL)
        .map((line, index) => ({ file, line: line.trim(), number: index + 1 }))
        .filter((row) => row.line.includes(READY_EXPRESSION));
    });
}

describe("the ruled Ready expression has exactly the sanctioned homes", () => {
  it("found the expression at all, or this census is measuring nothing", () => {
    expect(
      readyOccurrences().length,
      "the Ready expression was not found anywhere in tracked source — reworded, or this search is broken",
    ).toBeGreaterThan(0);
  });

  it("the retired four-copy expression has no executable home left", () => {
    const retired = execFileSync("git", ["ls-files", "src"], { encoding: "utf8" })
      .split(NL)
      .filter((file) => /\.tsx?$/u.test(file))
      .flatMap((file) =>
        readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
          .split(NL)
          .map((line, index) => ({ file, line: line.trim(), number: index + 1 }))
          .filter(
            (row) =>
              row.line.includes(RETIRED_READY_EXPRESSION) &&
              // Any executable use counts (const, property, argument): only comments and the
              // claims register's quoted citation strings are not code.
              !/^(?:\/\/|\/?\*)/u.test(row.line) &&
              !/^["'`]/u.test(row.line),
          ),
      )
      .map((row) => `${row.file}:${row.number}`);
    expect(retired, "a second Ready arithmetic has come back; call boundedBedAvailability instead").toEqual([]);
  });

  it("no NEW executable copy has appeared", () => {
    // Prose mentions are excluded deliberately: a comment cannot compute a different number. An
    // executable copy is one that assigns.
    const executable = readyOccurrences()
      .filter((row) => /^const\s+\w+\s*=/u.test(row.line))
      .map((row) => `${row.file}:${row.number}`)
      .sort();

    expect(
      executable,
      "a new home for min(allocatable, empty) has appeared, or one of the four has moved. Ruling " +
        "R-B-09 fixes Ready as ONE number and there are already four implementations of it — the " +
        "one in ward-eligibility.ts decides whether a bed is offered at all. If you are adding a " +
        "fifth, call an existing helper instead. If you are moving or changing one, change all " +
        "four and update this list, because nothing else compares them.",
    ).toEqual([
      // Owner ruling 13 Oct 2026: the single sanctioned home. Any second assignment is refused.
      "src/components/ward-management/ward-ready-beds.ts:14",
    ]);
  });
});

describe("the two implementations that can be compared do agree", () => {
  const units = allUnits();

  it("examined a real population, or the assertions below are about nothing", () => {
    expect(units.length, "allUnits() returned nothing; this file would pass vacuously").toBeGreaterThan(20);
  });

  it("agree on every unit when nothing is being made ready", () => {
    // With no releases, `openBedsNow` subtracts nothing, so it reduces to its own copy of the Ready
    // expression. Any difference from `unitCapacity().available` is a divergence between the two
    // definitions and nothing else — the pending-preparation term cannot account for it.
    const divergent = units
      .map((unit) => ({ id: unit.id, open: openBedsNow(unit, []), ready: unitCapacity(unit, []).available }))
      .filter((row) => row.open !== row.ready);

    expect(
      divergent,
      "`openBedsNow` and `unitCapacity().available` disagree about min(allocatable, empty) — the " +
        "number ruling R-B-09 fixes as the one meaning of Ready. Two screens print these two " +
        "figures in one sentence and a third gates on the comparison, so a divergence reads as a " +
        "sensible contrast between pullable and Ready while actually contrasting two opinions " +
        "about Ready.",
    ).toEqual([]);
  });

  it("openBedsNow never exceeds Ready, whatever the releases", () => {
    // The directional half: pullable is Ready minus beds being made ready, so it can be lower and
    // must never be higher. This holds independently of the expressions being identical, so it
    // survives the repair that would make the case above trivial.
    for (const unit of units) {
      expect(
        openBedsNow(unit, []),
        `${unit.id}: more beds pullable than Ready, which cannot be true of any ward`,
      ).toBeLessThanOrEqual(unitCapacity(unit, []).available);
    }
  });
});
