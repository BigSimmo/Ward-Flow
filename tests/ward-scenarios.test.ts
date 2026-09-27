import { describe, expect, it } from "vitest";

import { eligibility } from "@/components/ward-management/ward-eligibility";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { scenarioUnits, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";

function eligibleCounts(scenario: "standard" | "scarce") {
  const units = scenarioUnits(scenario);
  return wardMovements
    .filter(isOpen)
    .map((movement) => units.filter((unit) => eligibility(movement, unit, NOW_ANCHOR).eligible).length);
}

describe("ward scenarios", () => {
  /**
   * The assertion this test originally carried — "every open movement has at least five eligible
   * wards" — was false, and the way it was false is worth recording. It came from counting the
   * LENGTH of `eligibleCandidatesAmong(...)`, which sorts eligible-first and truncates to its
   * `limit`; it does not filter to eligible. That length is therefore the number of same-cohort
   * units, never the number of eligible ones, and reading it as eligibility produced a confident
   * wrong answer that survived into a design document.
   *
   * RE-MEASURED on 2026-08-29 at NOW_ANCHOR, counting `eligibility(...).eligible` across all
   * 23 units for every open movement — the same computation `eligibleCounts("standard")` below
   * performs, run against the current fixture: 41 open movements, 342 eligible movement/unit
   * pairs, distribution {0:2, 4:11, 5:3, 6:4, 7:2, 11:1, 12:9, 14:9} — and **two movements,
   * WF-009 and WF-308, already have nowhere eligible on the standard night.** Both are the
   * fixture as authored, not something the scarce scenario introduced.
   *
   * It replaces a 2026-08-25 measurement of 337 pairs over 22 units with distribution
   * {0:2, 4:11, 5:6, 6:3, 11:1, 12:9, 14:9}. That record was taken two days before Phase 7 seeded
   * the 23rd unit, so the "22" had gone stale — but changing only the 22 to a 23 would have been
   * WRONG, not merely incomplete, and the reason is worth keeping: **the 23rd unit accounts for
   * none of the difference.** Recomputing this total with `bty-youth` removed still gives 342, and
   * no open movement is eligible for it at all — the network's only Youth unit, and nothing open
   * is a youth movement. The five extra pairs come from the gates and the fixture moving since,
   * across Phase 5 to Phase 8 (legal status became a capability, `involuntaryBedNeeded` was wired
   * into the legal-status gate, bed category and the three-stage bed model landed, `homeRegion`
   * was seeded). So the old figure was stale in substance and not only in its stated basis.
   *
   * The assertions below are thresholds, so none of this was red and none of it was vacuous —
   * which is exactly why a stale record here could sit unnoticed. If you change the fixture or a
   * gate, re-measure and re-date this; do not adjust a number and leave the date.
   *
   * RE-MEASURED on 2026-09-02, following this comment's own instruction, after `eligibility()`
   * gained a `sex_designation` gate. The movement path had never read `unit.sexDesignation` while
   * `referralEligibility()` had gated on it since Phase 7, so a Female Adult movement needing a
   * Secure bed was returned ELIGIBLE for `fsh-adult-secure` — the network's Male-only Secure bed.
   * `sex_mix` did not catch it and could not: it asks whether mixing sexes is acceptable given the
   * ward's CURRENT occupants and passes for either sex whenever more than one bed is free.
   *
   *   standard: 43 open movements, **340** pairs (was 353), 2 stranded — WF-009 and WF-308, the
   *   same two, unchanged. Distribution {0:2, 4:15, 5:1, 6:3, 7:3, 11:7, 12:3, 13:3, 14:6}.
   *   scarce: 102 pairs, 9 stranded — completely unchanged, because `fsh-adult-secure` has no
   *   allocatable bed under that scenario and those pairs already failed an earlier gate.
   *
   * The 13 lost pairs are ALL at `fsh-adult-secure` and every one of them fails `sex_designation`
   * and NOTHING else — verified by counting verdicts whose only failing gate is the new one. This
   * is the reading the comment above prescribes: same movements, fewer pairs, so a gate change;
   * and `strandedMovements` did not move, so no patient lost their last option. Thirteen women
   * were being offered a male-only bed and are now not.
   *
   * Two honesty notes taken while re-measuring, neither of them caused by this change. First, the
   * assertion below already read 43/353 while the 2026-08-29 record above says 41/342 — someone
   * updated the numbers and left the date, the exact drift that record warns about; the paragraph
   * above is left verbatim rather than quietly corrected, because its account of WHY the older
   * figures moved is still the useful part. Second, `ger-adult-open` (the network's Female-only
   * bed) accounts for none of the 13: no open male movement otherwise qualifies for it, so the
   * new gate is currently load-bearing on one unit only, and a fixture edit could make it
   * load-bearing on two without anything here going red.
   *
   * RE-MEASURED on 2026-09-02, following this comment's own instruction, after `eligibility()`
   * gained a `forensic` gate. `referralEligibility()` has refused a forensic bed unconditionally
   * since Phase 7 (D7); the movement path had never read `unit.forensic` at all, so the network's
   * one forensic bed, `brm-adult-secure`, was returned ELIGIBLE on the movement path for every
   * Adult/Secure movement that otherwise qualified for it — the referral path refused that same
   * unit outright at the same instant.
   *
   *   standard: 43 open movements, **325** pairs (was 340), 2 stranded — unchanged.
   *   scarce: 87 pairs (was 102), 9 stranded — unchanged.
   *
   * The 15 lost pairs in EACH scenario are ALL at `brm-adult-secure` and every one of them fails
   * `forensic` and nothing else — verified the same way as the `sex_designation` measurement
   * above: counting verdicts whose only failing gate is the new one. Same movements, fewer pairs,
   * so a gate change; `strandedMovements` did not move in either scenario, so no patient lost
   * their last option — `brm-adult-secure` was never a real placement the referral path would
   * have honoured, only a display bug on the movement path's own shortlist.
   *
   * RE-MEASURED on 2026-09-04. Two changes are folded into this single re-measurement, because
   * the full offline suite was never run to completion between them landing and this test finally
   * being exercised again: (1) `ward-eligibility.ts`'s security gate was rewritten (commit
   * `da9931e00`) from a form that passed every Open movement unconditionally, even at a ward with
   * zero free beds, to one that requires `unit.allocatable.value > 0` for an Open movement (see
   * that file's `security` gate for the exact expression); and (2) the locked/open bed-designation
   * split (Task 3 of `docs/superpowers/plans/2026-09-04-ward-flow-mixed-locked-open-beds.md`)
   * widened three previously wholly-open adult units — `scgh-adult-open`, `fsh-adult-secure` and
   * `fre-adult-open` — into genuinely mixed ones, each now carrying real free locked beds. Which
   * of the two moved this number in which direction is not decomposed here — the figure below is
   * the actual measured output of both changes together, not a guess.
   *
   *   standard: 43 open movements, **349** pairs (was 325), **1** stranded (was 2) — WF-009,
   *   previously stranded, is no longer stranded; WF-308 stays stranded (confirmed against the
   *   real fixture in `tests/ward-escalation.dom.test.tsx`, which names both movements
   *   explicitly).
   *   scarce: 95 pairs (was 87), 9 stranded — unchanged.
   *
   * **RE-MEASURED 2026-09-10, after the `acuity` gate landed** (owner ruling: high-acuity nursing
   * is marked by the referring clinician at referral, and the gate refuses a ward that staffs no
   * high-acuity places).
   *
   *   standard: 43 open movements, **323** pairs (was 325), **2** stranded — **UNCHANGED**.
   *   scarce:   **77** pairs (was 87), **13** stranded (was 9).
   *
   * ⚠️ **THE SCARCE NIGHT'S STRANDED COUNT ROSE AND THAT IS THE NEW GATE, NOT DRIFT.** The four
   * additions are WF-306, WF-312, WF-318 and WF-324 — every routine movement carrying
   * `highAcuity`. On a night where nearly every ward is full, the wards still holding beds include
   * `ger-adult-open` and `kun-adult-open`, the two that staff **no** high-acuity places, so a
   * patient who needs one has nowhere left. **That is the hard case this scenario exists to
   * produce, reached by a real clinical constraint rather than by arithmetic.**
   *
   * ⚠️ **AND THE STANDARD NIGHT IS THE ONE THE WARNING BELOW IS ABOUT: it did not move.** No
   * patient the network placed on an ordinary night is stranded by this gate. Had that number
   * risen, this would be a regression to fix rather than a measurement to re-date.
   *
   * ⚠️ **`highAcuityCapacity` IS AN INVENTED FIGURE ON ALL 23 WARDS**, authored 2026-09-10, and
   * the two zeroes are what drive the rise. If the owner supplies real staffing figures these
   * numbers move again, and that will not be a regression either.
   *
   * **RE-MEASURED 2026-09-16, after fixing WF-26** (the scarce map built `allocatable` from
   * `index % 3 === 0 ? 1 : 0` alone, never clamping to `unit.empty.value`, and never touched
   * `allocatableLocked` at all — see `ward-scenarios.ts`'s own comment on `scenarioUnits`).
   *
   *   standard: 43 open movements, **323** pairs, **2** stranded — **UNCHANGED**, as expected:
   *   the bug was in the scarce map only.
   *   scarce: **77** pairs, **13** stranded — **ALSO UNCHANGED, and this is the honest result of
   *   actually re-running the derivation, not an assumption.** The fix drops `gry-older-adult`'s
   *   scarce `allocatable` from the buggy 1 to the correct 0, and clamps five units'
   *   `allocatableLocked` down to 0 (`fsh-adult-secure`, `rgh-adult-secure`, `bty-adult-secure`,
   *   `gry-adult-secure`, `sjgs-adult-secure` — `tests/ward-scenarios.test.ts`'s own invariant
   *   test below names all six). **Neither change moves a single eligible pair, and there is no
   *   newly stranded movement, for two separate reasons, both confirmed by re-running
   *   `eligibleCounts("scarce")` before and after and diffing every movement's eligible-unit list
   *   (byte-identical):**
   *
   *   1. `gry-older-adult` was **already** eligible for nothing, before or after this fix — never
   *      "its only eligible unit" for anything, because its `allocatable.confirmedAt` is
   *      `NOW_ANCHOR - 300` against a `staleAfterMinutes` of 180 (see that unit's own comment in
   *      `ward-sites.ts`: "the freshness gate should catch this one"). The `capacity_freshness`
   *      gate already excluded it on every scarce-night movement regardless of what the buggy
   *      `allocatable.value` said, so correcting that value from 1 to 0 changes an already-failing
   *      verdict to a doubly-failing one — no movement's `eligible` result moves.
   *   2. The five `allocatableLocked` corrections never reach the movement path at all:
   *      `eligibility()`'s `security` gate for a Secure movement passes on `unitHasLockedBeds`
   *      (`unit.lockedBeds > 0`, a structural figure the scenario never touches), not on
   *      `allocatableLocked`. The one place `allocatableLocked` does feed in is
   *      `lockedBedsFree = min(allocatableLocked, allocatable.value)`, and for all five of those
   *      units `allocatable.value` was already 0 on the scarce night, buggy or fixed — so
   *      `lockedBedsFree` was already 0 either way.
   *
   *   This is exactly the outcome ward-lead should want from a bug fix here: the network's shape
   *   — which movement is stranded and which is not — did not change, only a display/UI-adjacent
   *   inconsistency (a bed count exceeding what physically exists) went away.
   *
   * **RE-MEASURED 2026-09-17, T10** (item 8, owner answer 17 September 2026, "gender at referral
   * decides the incoming bed check"). `eligibility()`'s designation gate was renamed
   * `sex_designation` → `gender_designation` and now reads `movement.gender` — recorded AT
   * REFERRAL, never derived from `movement.sex` — instead of `movement.sex` directly. The fixture
   * authors `gender` on exactly three NAMED movements (`ward-movements.ts`, never copied from
   * `sex` in bulk): `WF-005` (Female, targeting `ger-adult-open`), `WF-006` (Male, targeting
   * `fsh-adult-secure`) and `WF-012` (Non-binary, no designated ward). Every other movement's
   * `gender` is absent — "not yet recorded" — which the gate refuses at BOTH the network's
   * single-gender wards regardless of what `sex` says, per WLQ-35's own rule (an unrecorded
   * gender is refused at a single-gender ward, not merely at the one whose sex it happens to
   * disagree with).
   *
   *   standard: 43 open movements, **301** pairs (was 323), **2** stranded — **UNCHANGED**.
   *
   * The 22 lost pairs are every movement that previously passed `sex_designation` by matching
   * `ger-adult-open` or `fsh-adult-secure`'s designation on `sex` alone and has no `gender`
   * authored — 24 such movements before this change, now only the two named examples above still
   * pass. `strandedMovements` did not move, so no open movement's last remaining option was one of
   * these two units — consistent with the historical `sex_designation` measurement above, which
   * found the same for the original 13 lost pairs.
   *
   *   scarce: 77 pairs, 13 stranded — **UNCHANGED**, because `ger-adult-open` and
   *   `fsh-adult-secure` both already sit at zero allocatable beds on the scarce night, so
   *   `gender_designation` was never the deciding gate there either before or after this change.
   *
   * **RE-MEASURED 2026-09-17, sample-data pass** (owner request, "add more sample data";
   * `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §4, task 3): eleven movements added
   * (WF-021..WF-031), giving WACHS and Private a reachable open movement at every stage a movement
   * can carry service membership through. All eleven are open, so both scenarios' `openMovements`
   * moves by exactly +11.
   *
   *   standard: **54** open movements (was 43), **418** pairs (was 301), **2** stranded —
   *   **UNCHANGED**. None of the eleven strands on an ordinary night.
   *   scarce: **54** open movements, **111** pairs (was 77), **14** stranded (was 13) — **ONE MORE,
   *   AND IT IS WF-021, NOT A REGRESSION ON ANY EXISTING PATIENT.** WF-021 is `cohort: "Youth"`,
   *   and `bty-youth` (Bentley's East Metropolitan Youth Unit) is the network's ONLY Youth-cohort
   *   unit (`ward-sites.ts`) — there is no fallback ward for a Youth movement the way an Adult or
   *   Older-adult one has thirteen or six respectively. On the scarce night `bty-youth`'s own
   *   allocatable capacity is exhausted like every other ward's, and with no second Youth unit
   *   anywhere to fall back to, WF-021 has nowhere eligible. This is the same class of hard case
   *   the 2026-09-10 `acuity` re-measurement above records happening to WF-306/312/318/324 — a
   *   real structural fragility (one unit covers a whole cohort) surfacing under scarcity, not
   *   something this fixture invented. The thirteen pre-existing stranded movements are
   *   unchanged; confirmed by re-running the derivation and listing ids before asserting here.
   *
   * **RE-MEASURED 2026-09-17, T2r fix round finding 5** (same day, later pass): WF-024 (WACHS
   * `pulled`) dropped — it duplicated chance coverage WACHS already had at `pulled`
   * (WF-318/WF-325), and `ward-model.test.ts`'s realistic-pressure cap requires `wardMovements` to
   * stay at 60 or fewer. `openMovements` moves by exactly -1 in both scenarios; `strandedMovements`
   * is unchanged in both (WF-024 stranded on neither night, so removing it strands nobody and
   * frees nobody).
   *
   *   standard: **53** open movements, **405** pairs, **2** stranded — unchanged.
   *   scarce: **53** open movements, **107** pairs, **14** stranded — unchanged.
   *
   * **RE-MEASURED 2026-09-21, after the `specialling` gate stopped failing.** That gate is now
   * `pass: true` always: `eligibility()` takes no admissions list, so it could say whether a ward
   * had ANY one-to-one capacity and never whether it had any LEFT, and it was inviting placements
   * `PULL_PATIENT` then refused (its own comment in `ward-eligibility.ts` sets this out).
   *
   *   standard: **53** open movements — unchanged, **408** pairs (was 405), **2** stranded —
   *   unchanged.
   *   scarce: **53** open movements — unchanged, **130** pairs (was 107), **3** stranded
   *   (was 14).
   *
   * ⚠️ **THE ATTRIBUTION IS MEASURED, AND IT IS PARTIAL — SAID SO RATHER THAN ROUNDED UP.**
   * Counting pairs that are eligible now AND that the old rule (`movement.specialling` at a ward
   * with `speciallingCapacity <= 0`) would have refused: **13 of the 23 new scarce pairs, and 2 of
   * the 3 new standard pairs.** The remaining ten and one are NOT explained by this gate; other
   * gate work landed in the same period and no attempt was made here to split them further.
   *
   * 🔴 **AND THE SCARCE NIGHT IS NOW A MUCH WEAKER STRESS CASE — 3 STRANDED WHERE IT USED TO
   * STRAND 14.** The test below still passes, because it only requires at least one, and by this
   * file's own rubric a FALL in `strandedMovements` is not the clinical regression a rise would be.
   * But the scarce scenario exists to manufacture the hard case, and it now manufactures a quarter
   * as much of it. **That is a product question about what the scenario is for, not a test that
   * needs a number changed, and it is recorded here rather than absorbed into the figure.**
   */
  it("the standard night leaves most open movements real choice, but already strands two", () => {
    const counts = eligibleCounts("standard");

    // ABSOLUTE, not floors — changed 2026-08-30, and the reason is the point. This read
    // `toBeGreaterThan(30)` and `toBeGreaterThan(300)`, and a fixture that had quietly shrunk to 31
    // movements and 301 pairs would satisfy both exactly as 41 and 342 do. A floor set below the
    // real value cannot see the fixture decaying toward it, which is precisely the decay the doc
    // comment above records happening to the 2026-08-25 measurement — unnoticed for four days
    // because nothing here was ever red.
    //
    // All three figures travel in ONE assertion so a failure prints all three actuals side by side.
    // Which of them moved IS the diagnosis: fewer movements is a fixture change, fewer pairs with
    // the same movements is a gate change, and more stranded is a clinical regression.
    expect(
      {
        openMovements: counts.length,
        eligiblePairs: counts.reduce((sum, count) => sum + count, 0),
        strandedMovements: counts.filter((count) => count === 0).length,
      },
      "The standard night's shape has changed. These are MEASURED values, not targets: re-measure " +
        "them and RE-DATE the doc comment above, rather than editing a number here to match. Look " +
        "at strandedMovements first — it counts open movements with nowhere eligible to go on an " +
        "ordinary night, so a rise there means the network now strands patients it used to place, " +
        "and that is a clinical regression rather than a test that needs updating.",
    // RE-MEASURED 2026-09-25, 21:25, on the R7 split merged with batch 3g: seeded movements record
    // gender (authored demo data), so `gender_designation` can pass the two single-sex wards on gender:
    // 408 -> 430 pairs. Stranded UNCHANGED at 2. (A 453/1 reading at batch 3a was superseded by batch
    // 3g's own seed and capacity changes.)
    ).toEqual({ openMovements: 53, eligiblePairs: 430, strandedMovements: 2 });
  });

  it("the scarce night exhausts the network for at least one open movement", () => {
    const counts = eligibleCounts("scarce");

    // Same treatment, same reason. The three assertions this replaces were `length > 30`,
    // `min === 0` and `zeros >= 1` — every one of them satisfied by a network with one movement
    // left and nowhere to put it. They are folded into the absolute below, which is strictly
    // stronger on each: nothing has been loosened or dropped.
    expect(
      {
        openMovements: counts.length,
        eligiblePairs: counts.reduce((sum, count) => sum + count, 0),
        strandedMovements: counts.filter((count) => count === 0).length,
      },
      "The scarce night's shape has changed. Measured values, not targets — re-measure and re-date " +
        "rather than adjusting a number. openMovements must match the standard night's 53 exactly, " +
        "because the scarce scenario changes bed counts and never the movements; if it does not, " +
        "the scenario has started altering something it must not touch, and the last test in this " +
        "file says which attributes those are.",
    // RE-MEASURED 2026-09-25, 21:25, same tree: UNCHANGED at 130 pairs and 3 stranded, because the
    // single-sex wards sit at zero allocatable beds on the scarce night.
    // RE-MEASURED 2026-09-26, after the Kununurra ward was removed (owner-approved ward facts):
    // 130 -> 135 pairs, stranded UNCHANGED at 3. The scarce night's allocatable beds are keyed by
    // each unit's position (index % 3), so removing one unit moved which later units draw a bed.
    ).toEqual({ openMovements: 53, eligiblePairs: 135, strandedMovements: 3 });

    expect(
      Math.min(...counts),
      "The scarce night no longer exhausts the network for anybody. That is this test's whole " +
        "subject: the scarce scenario exists to produce the case where a patient has nowhere to go, " +
        "and if the minimum is above zero the scenario has stopped demonstrating the thing the " +
        "escalation and out-of-area screens are built to answer.",
    ).toBe(0);
  });

  it("the scarce night is strictly tighter than the standard night, movement for movement", () => {
    const standard = eligibleCounts("standard");
    const scarce = eligibleCounts("scarce");
    expect(scarce.every((count, index) => count <= standard[index])).toBe(true);
    const scarceTotal = scarce.reduce((sum, count) => sum + count, 0);
    const standardTotal = standard.reduce((sum, count) => sum + count, 0);
    expect(scarceTotal).toBeLessThan(standardTotal / 2);
  });

  it("changes operational numbers only — never a patient attribute", () => {
    const standard = scenarioUnits("standard");
    const scarce = scenarioUnits("scarce");
    expect(scarce.map((unit) => unit.id)).toEqual(standard.map((unit) => unit.id));
    expect(scarce.map((unit) => unit.cohort)).toEqual(standard.map((unit) => unit.cohort));
    expect(scarce.map((unit) => unit.lockedBeds)).toEqual(standard.map((unit) => unit.lockedBeds));
    expect(scarce.map((unit) => unit.authorised)).toEqual(standard.map((unit) => unit.authorised));
    expect(scarce.map((unit) => unit.name)).toEqual(standard.map((unit) => unit.name));
  });
});

/**
 * WF-26: the scarce scenario built `allocatable` from `index % 3 === 0 ? 1 : 0` alone, never
 * looking at the unit's `empty` figure — so `gry-older-adult` (empty 0) was handed an allocatable
 * bed that did not physically exist. It also never touched `allocatableLocked` at all, so a unit
 * whose STANDARD `allocatableLocked` was 1 or 2 kept that figure on the scarce night even where
 * the same map had just zeroed its `allocatable` — `fsh-adult-secure` (locked 2) and
 * `rgh-adult-secure` (locked 1) both went to scarce `allocatable: 0` while still reporting locked
 * beds their own total said did not exist. This pins the bed-count invariant every unit must hold
 * on BOTH nights, independent of any particular unit's numbers, so a future scenario change cannot
 * reopen either gap without turning this red.
 */
describe("scenario bed counts never exceed what physically exists", () => {
  it.each(WARD_SCENARIOS)(
    "every unit keeps 0 <= allocatable <= empty <= beds and 0 <= allocatableLocked <= allocatable on the %s night",
    (scenario) => {
      const units = scenarioUnits(scenario);
      const violations = units
        .filter((unit) => {
          const { value: allocatable } = unit.allocatable;
          const { value: empty } = unit.empty;
          const { beds, allocatableLocked } = unit;
          return !(
            Number.isInteger(allocatable) &&
            Number.isInteger(empty) &&
            Number.isInteger(beds) &&
            Number.isInteger(allocatableLocked) &&
            allocatable >= 0 &&
            allocatable <= empty &&
            empty <= beds &&
            allocatableLocked >= 0 &&
            allocatableLocked <= allocatable
          );
        })
        .map((unit) => unit.id);
      expect(
        violations,
        `units violating "0 <= allocatable <= empty <= beds" or "0 <= allocatableLocked <= allocatable" ` +
          `on the ${scenario} night — a scenario must never advertise a bed that is not physically empty, ` +
          `or a locked-bed count above the total it is supposed to be a part of`,
      ).toEqual([]);
    },
  );
});
