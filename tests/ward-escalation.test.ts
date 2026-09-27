// tests/ward-escalation.test.ts
import { describe, expect, it } from "vitest";

import { escalationBoard, isOpen } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { scenarioUnits } from "../src/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const { movements, units } = seedWardFlowState();
const openMovements = movements.filter(isOpen);

describe("escalationBoard", () => {
  it("escalated contains exactly the open movements carrying a recorded escalation", () => {
    const board = escalationBoard(movements, units, NOW_ANCHOR);
    const expectedIds = openMovements
      .filter((movement) => movement.escalation !== undefined)
      .map((movement) => movement.id)
      .sort();
    expect(board.escalated.map((entry) => entry.movement.id).sort()).toEqual(expectedIds);
  });

  it("escalated resolves triedUnitIds to real Unit objects, one for one, on the real fixture", () => {
    const board = escalationBoard(movements, units, NOW_ANCHOR);
    for (const entry of board.escalated) {
      const escalation = entry.movement.escalation;
      if (!escalation) throw new Error(`${entry.movement.id} appears in escalated without an escalation record`);
      expect(entry.triedUnits.map((unit) => unit.id)).toEqual(escalation.triedUnitIds);
    }
  });

  // RE-MEASURED on 2026-08-29 at NOW_ANCHOR against this file's own basis — `seedWardFlowState()`'s
  // `movements` and `units`, not another file's fixture read — counting `eligibility(...).eligible`
  // RE-MEASURED 2026-08-30: 43 open movements and 353 eligible pairs on the standard night, after
  // WF-019 and WF-020 were seeded to give the fixture waits longer than a day. THE ASSERTIONS BELOW
  // DID NOT MOVE - both new movements are placeable, so the stranded sets are unchanged and nothing
  // here went red. This comment is corrected anyway, because a figure no assertion reads can be
  // wrong for as long as it likes and is read by people making decisions: this same file carried
  // "123 eligible pairs" for days when the number was 98.
  // for every open movement (never the truncated length of `eligibleCandidatesAmong(...)`'s default
  // 3-candidate shortlist, which is a same-cohort count, not an eligibility count): 23 units,
  // 41 open movements, 342 eligible movement/unit pairs, distribution
  // {0:2, 4:11, 5:3, 6:4, 7:2, 11:1, 12:9, 14:9}, and exactly two movements — WF-009 and WF-308 —
  // already have nowhere eligible on the standard night. Both are the fixture as authored. Pinned
  // by id so a regression that strands more (or fewer) patients is caught here, not only on screen.
  //
  // It replaces a 2026-08-25 record of 337 pairs over 22 units. Do not read the change as the 23rd
  // unit arriving: recomputing without `bty-youth` still gives 342, and no open movement is
  // eligible for it at all. The five extra pairs are the gates and the fixture moving across
  // Phase 5 to Phase 8. tests/ward-scenarios.test.ts carries the same measurement, taken on ITS
  // basis (`scenarioUnits("standard")` and `wardMovements`) and agreeing figure for figure — the
  // two were measured separately rather than copied, because they are not the same read.
  it("on the standard night, exactly WF-009 and WF-308 have nowhere eligible", () => {
    const board = escalationBoard(movements, units, NOW_ANCHOR);
    expect(
      board.nowhereEligible.map((movement) => movement.id).sort(),
      "The set of patients with nowhere to go on an ORDINARY night has changed. This is a clinical " +
        "fact about the demonstration, not a test detail: every id here is a movement the network " +
        "cannot place at all, and the escalation board exists to show exactly these. A LONGER list " +
        "means a gate or the fixture now strands someone it used to place - investigate the gate " +
        "before touching this line. A SHORTER list is not automatically good either; it can mean a " +
        "gate stopped rejecting something it should reject. Re-measure and re-date the comment " +
        "above rather than editing these ids to match what the code now does.",
    ).toEqual(["WF-009", "WF-308"]);
  });

  it("on the scarce night, nowhereEligible grows to the measured three-movement set", () => {
    const scarceUnits = scenarioUnits("scarce");
    const board = escalationBoard(movements, scarceUnits, NOW_ANCHOR);
    // CURRENT pin (owner ruling 2026-09-21 / Wave 1 measure): exactly WF-009, WF-021, WF-308.
    // Historical measurements below still say nine / thirteen / fourteen as dated records of what
    // the fixture produced then — do not re-edit those into "three"; the assertion is the live pin.
    //
    // RE-MEASURED 2026-08-30 on this file's own basis (`seedWardFlowState()` movements against
    // `scenarioUnits("scarce")`, counting `eligibility(...).eligible`): 41 open movements, 23 units,
    // 98 eligible movement/unit pairs, 9 movements stranded. Pinned exactly (then).
    //
    // The pair count previously read 123, and that was WRONG rather than stale. Every other figure
    // re-measures unchanged - 342 standard pairs, 9 stranded, 23 units, 41 open - and a fixture
    // that had drifted enough to move the scarce total by 25 could not have left the other four
    // identical. So this reads as an error at the moment it was written rather than the fixture
    // moving underneath it. Recorded rather than quietly renumbered, because "adjust the number and
    // keep the date" is exactly how the 2026-08-25 record in this file went stale in substance.
    //
    // Nothing was ever red: no assertion reads the pair count, so a comment can carry a wrong
    // figure here indefinitely. tests/ward-scenarios.test.ts measures 98 independently on ITS basis.
    expect(
      board.nowhereEligible.map((movement) => movement.id).sort(),
      "The scarce night's stranded set has changed. The scarce scenario exists to produce the hard " +
        "case - patients the network genuinely cannot place - so this list IS the scenario's reason " +
        "for existing. It must stay a strict superset of the standard night's two, WF-009 and " +
        "WF-308, which the assertion below checks separately: the scarce night is the standard " +
        "night with fewer beds, never a different night. If this list shrank, the scenario has " +
        "stopped demonstrating the thing the escalation and out-of-area screens answer.",
      // ⚠️ GREW FROM NINE TO THIRTEEN ON 2026-09-10, AND THE FOUR ADDITIONS ARE ONE CAUSE: the
      // `acuity` gate. WF-306, WF-312, WF-318 and WF-324 are every routine movement carrying
      // `highAcuity`, and on the scarce night the wards still holding beds include the two that
      // staff no high-acuity places. It GREW, which this assertion's own message permits and
      // explains — a shrink is what would mean the scenario had stopped demonstrating the hard
      // case. The standard night's two are unchanged, so it remains a strict superset.
      //
      // GREW FROM THIRTEEN TO FOURTEEN ON 2026-09-17 (T2r fix round, finding 5, sample-data pass):
      // WF-021, the new East Metro `handover_ready` row, is `cohort: "Youth"` and already
      // `acceptedUnitId: "bty-youth"` — the network's ONLY Youth unit (verified: `allUnits().
      // filter(u => u.cohort === "Youth")` finds exactly one). `bty-youth`'s `allocatable.value`
      // is 1 on the standard night and 0 on the scarce night (`scenarioUnits("scarce")`), so a
      // movement already accepted there under standard conditions has, on the scarce night,
      // genuinely nowhere else to go — there is no second Youth-cohort ward to fall back on. This
      // is the same shape the class-comment above already describes for the acuity gate: a real
      // network constraint the scarce scenario is supposed to expose, not a data mistake.
      //
      // 🔴 **SHRANK FROM FOURTEEN TO THREE ON 2026-09-21, AND THIS ASSERTION'S OWN MESSAGE SAYS
      // WHAT THAT MEANS: the scenario has stopped demonstrating most of what it exists to
      // demonstrate.** The cause is a deliberate engine change, not a data mistake. The
      // `specialling` gate is now `pass: true` always, because `eligibility()` takes no admissions
      // list and so could say whether a ward had ANY one-to-one capacity and never whether it had
      // any LEFT; it was inviting placements `PULL_PATIENT` then refused. Measured attribution, in
      // `ward-scenarios.test.ts`: 13 of the 23 newly-eligible scarce pairs are pairs the old rule
      // would have refused. The other ten are not attributed to it.
      //
      // ⚠️ **The structural property still holds** — the standard night's WF-009 and WF-308 are
      // both still here, so this remains a strict superset and the assertion below still means
      // something. **What no longer holds is the scenario's usefulness as a stress case**, and
      // that is a product question about what the scarce night is for, not a number to adjust.
      // Recorded here and raised with the owner rather than absorbed into the list.
    ).toEqual(["WF-009", "WF-021", "WF-308"]);
    // The honest empty state does not exist on either measured night — the scarce night is
    // strictly a superset of the standard night's two, never a disjoint or smaller set. This
    // guards against a scenario change that shrinks the scarce list back toward the standard
    // one, which would quietly undercut the point of the scarce scenario.
    const standardBoard = escalationBoard(movements, units, NOW_ANCHOR);
    const standardIds = new Set(standardBoard.nowhereEligible.map((movement) => movement.id));
    for (const id of standardIds) {
      expect(board.nowhereEligible.map((movement) => movement.id)).toContain(id);
    }
    expect(board.nowhereEligible.length).toBeGreaterThan(standardBoard.nowhereEligible.length);
  });

  it("excludes closed movements from both groups", () => {
    const closedWithEscalation = movements.find((movement) => movement.escalation !== undefined && !isOpen(movement));
    // The real fixture carries no closed movement with a recorded escalation (escalation only
    // makes sense for a patient still travelling through the pathway), so this constructs the
    // precondition explicitly rather than weakening the assertion — the same move Tasks 2, 3 and
    // 4 all had to make when a literal fixture lookup would not produce what the assertion needs.
    const syntheticClosedEscalated =
      closedWithEscalation ??
      (() => {
        const base = movements.find((movement) => movement.escalation !== undefined);
        if (!base) throw new Error("fixture carries no movement with a recorded escalation to build the case from");
        return {
          ...base,
          id: "WF-TEST-CLOSED-ESCALATED",
          closure: { at: NOW_ANCHOR, outcome: "arrived" as const, reason: "Test fixture: arrived" },
        };
      })();

    expect(isOpen(syntheticClosedEscalated)).toBe(false);

    const board = escalationBoard([...movements, syntheticClosedEscalated], units, NOW_ANCHOR);
    expect(board.escalated.map((entry) => entry.movement.id)).not.toContain(syntheticClosedEscalated.id);
    expect(board.nowhereEligible.map((movement) => movement.id)).not.toContain(syntheticClosedEscalated.id);
  });
});
