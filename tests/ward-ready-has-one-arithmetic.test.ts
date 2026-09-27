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

const READY_EXPRESSION = "Math.min(unit.allocatable.value, unit.empty.value)";

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
    ).toBeGreaterThan(3);
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
      // 168/180 -> 169/181, 26 Sept 2026: engine constants 47a7f575e7 added one import line at the top
      // of ward-bed-availability.ts. VERIFIED a move and not a new copy: the file still holds exactly
      // two matches, the same lines in `openBedsNow` and `capacityBreakdown`.
      "src/components/ward-management/ward-bed-availability.ts:169",
      "src/components/ward-management/ward-bed-availability.ts:181",
      // 514 -> 515 on 2026-09-09: the origin/main fold (1d85db58e7) added three imports at the top of
      // ward-derivations.ts. VERIFIED a move and not a fifth copy — same `available` line inside the
      // same `unitCapacity` function, and that file still holds exactly one match. The guard fired
      // correctly; only the coordinate aged.
      // 515 -> 521 on 2026-09-11: a six-line dated CORRECTION was inserted into
      // `referralForMovement`'s doc comment above this function - the stale claim that
      // `Admission.referralId` "already manufactures" a join, one of fifteen such claims corrected
      // that night. VERIFIED a move and not a fifth copy by the guard's own two tests: same
      // `available` line inside the same `unitCapacity` function (now declared at :520), and that
      // file still holds EXACTLY ONE match. The guard fired correctly; only the coordinate aged.
      //
      // 🔴 THIRD TIME THIS COORDINATE HAS AGED, and all three for the same reason: lines were
      // added ABOVE it by work that never touched it. Two folds and now a comment correction.
      // ⚠️ This list pins a MECHANISM (a file:line) to defend a PROPERTY (there are exactly four
      // implementations). A line number is a different number in every tree and after every edit,
      // so this guard reddens on correct work by construction - which is the shape that teaches
      // people its refusals are noise. ✅ Recorded, NOT redesigned here: replacing the
      // coordinate with a stable anchor (the enclosing function name plus the file's match COUNT)
      // is a change to what this guard proves, and that is a ruling rather than a repair.
      // 521 -> 514 on 2026-09-12: O-16.8 moved `stageCopy` OUT of ward-derivations.ts into its own
      // module, so the reducer could import the labels without closing a cycle. Seven lines left
      // the file ABOVE this function. VERIFIED a move and not a fifth copy by the guard's own two
      // tests: the file still holds EXACTLY ONE match, and it is the same `available` line inside
      // the same `unitCapacity`. The guard fired correctly; only the coordinate aged.
      //
      // 🔴 FOURTH TIME, AND THE FIRST BY SUBTRACTION. The three before it were lines ADDED above;
      // this one is lines REMOVED. ⚠️ So the coordinate is not monotonic — it has now been 514,
      // 515, 521 and 514 again, and this trail cannot be read as a history of the file growing.
      // A reader reconciling 514 here against 514 in the first entry is looking at two different
      // trees, not a mistake.
      //
      // 514 -> 529, 17 Sept 2026 audit fix line: comments added above `unitCapacity` by the folded
      // fixes. VERIFIED a move: same `available = Math.min(unit.allocatable.value, unit.empty.value)`
      // line inside the same `unitCapacity`, and the file still holds exactly one match.
      // 529 -> 557, same day: the withdrawn-acceptance and service fixes added lines above it.
      // VERIFIED the same move by the same two checks.
      // 557 -> 568, 17 Sept 2026 (census/pin fold): further comment lines landed above
      // `unitCapacity` from the same day's folds. VERIFIED a move and not a fifth copy — the file
      // still holds exactly one match, and it is the same
      // `available = Math.min(unit.allocatable.value, unit.empty.value)` line inside the same
      // `unitCapacity` function.
      // 568 -> 569, 17 Sept 2026 (T2r fix round, finding 5, data-substantive pass): a one-line
      // shift above this function. VERIFIED a move and not a fifth copy — the file still holds
      // exactly one match, and it is the same
      // `available = Math.min(unit.allocatable.value, unit.empty.value)` line inside the same
      // `unitCapacity` function.
      // 569 -> 580, 25 Sept 2026 (capacity regression fix 84d308c6c5): the unreviewed batch
      // 5d7f438126 rewrote `unitCapacity` and REMOVED this expression, leaving three homes; the fix
      // restored the ruled line verbatim. The coordinate was ALREADY 580 on 5d7f438126's parent, so
      // this pin had aged before that batch, by lines landed above the function in some earlier
      // commit. VERIFIED the file holds exactly one match, inside `unitCapacity`.
      // 580 -> 581, 26 Sept 2026 (demo-final-v3): "CAHS" joined `wardServiceOrder` above this
      // function (owner ruling 2A, Perth Children's under CAHS). VERIFIED a move and not a fifth
      // copy: the file still holds exactly one match, the same `available` line inside `unitCapacity`.
      "src/components/ward-management/ward-derivations.ts:581",
      // 424 -> 426, owner ruling 2026-09-09/2026-09-10 (sex and gender split, P1 #BAY1TY): the
      // gender gate task added two imports (`Patient`, `OverrideReason`) to the top of
      // ward-eligibility.ts for the new standalone `genderEligibility` function. VERIFIED a move
      // and not a fifth copy — same `availableNow` line inside the same `referralEligibility`
      // function, and that file still holds exactly one match. The guard fired correctly; only
      // the coordinate aged.
      // 426 -> 478, 17 Sept 2026 (census/pin fold): the T15/T12/legal folds landed doc comments and
      // new gates above the eligibility check. VERIFIED a move and not a fifth copy — the file
      // still holds exactly one match, and it is the same `availableNow` line inside the same
      // eligibility computation.
      // 478 -> 510, 17 Sept 2026 (gender review round 2 fold): the RAISE_REFERRAL gender/diagnosis
      // checks landed further doc comments and gates above the eligibility check. VERIFIED a move
      // and not a fifth copy — the file still holds exactly one match, and it is the same
      // `availableNow = Math.min(unit.allocatable.value, unit.empty.value)` line inside the same
      // eligibility computation.
      // 510 -> 539, 17 Sept 2026 (audit fix round, round-2 fold): the D15 doc comment above
      // `referralEligibility` grew (the `availableNow` vs. `allocatable.value` explanation, and
      // the note on why this is computed inline rather than via `capacityBreakdown`). VERIFIED a
      // move and not a fifth copy — the file still holds exactly one match, and it is the same
      // `availableNow = Math.min(unit.allocatable.value, unit.empty.value)` line inside the same
      // `referralEligibility` function.
      // 539 -> 541, 25 Sept 2026: the unreviewed batch 5d7f438126 added two lines above the
      // eligibility check. VERIFIED a move and not a fifth copy — the file still holds exactly one
      // EXECUTABLE match (plus its one prose mention), the same `availableNow` line.
      // 541 -> 592, 26 Sept 2026: the recorded sex and gender identity work (9d54ec7317,
      // f2778f950d, since folded) added lines above it. VERIFIED a move and not a
      // fifth copy — still exactly one executable match, the same `availableNow` line in
      // `referralEligibility`, now at 592 on the line e33b20d1d1.
      // 592 -> 160, 26 Sept 2026 (Fix 2): the movement path's `sex_mix` gate now needs Ready too, so
      // the one line moved into a small `readyBedsNow(unit)` helper above `eligibility()`, and both
      // `eligibility()` and `referralEligibility()` call it. Still exactly one executable copy in the
      // file (plus its one prose mention); a second inline copy is what this guard refused.
      "src/components/ward-management/ward-eligibility.ts:160",
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
