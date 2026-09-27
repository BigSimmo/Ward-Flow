import { describe, expect, it } from "vitest";

import { stageChangeReasonLabel } from "@/components/ward-management/ward-management-console";
import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  RELEASE_PULL_REASONS,
  withdrawalReasonLabels,
  WITHDRAWAL_REASONS,
} from "@/components/ward-management/ward-change-reasons";
import { DECLINE_REASONS, STEP_BACK_REASONS } from "@/components/ward-management/ward-model";

/**
 * ═══ EVERY REASON A STAGE TRANSITION CAN CARRY HAS WORDS, AND NONE OF THEM IS ITS STORED VALUE ═══
 *
 * 🔴 **THE DEFECT THIS EXISTS FOR PRINTED `the_bed_was_lost` ON THE MOVEMENT WORKSPACE.**
 * `StageChange.reason` is a plain `string` — five events write it from four different closed
 * lists, so no single union could type it — and the page's audit timeline rendered it raw, three
 * lines above a sibling that looked its own reason up correctly.
 *
 * ⚠️ **`tsc` CANNOT CATCH THIS AND NEVER COULD.** A `string` field indexed into a
 * `Record<string, string>` type-checks whatever the value is; the property being tested here is
 * that the four reason LISTS are covered, which is a fact about runtime values.
 *
 * ⚠️ **AND THE DOM TEST ALONE IS NOT ENOUGH EITHER.** `ward-console-controls.dom.test.tsx` proves
 * the two step-back reasons it clicks come out in words. It says nothing about the other
 * seventeen, because no fixture on that page carries them — which is exactly how this line stayed
 * broken for `DECLINE` and `RELEASE_PULL` the whole time. This walks the lists themselves.
 */

/**
 * Every reason list an event can write into `StageChange.reason`, discovered from the exports
 * rather than typed out here — a fifth list added to a fifth event fails at import if it is not
 * added, and a list that is renamed fails at compile.
 *
 * `WITHDRAWAL_REASONS` is deliberately absent: it belongs to `withdrawnReferrals`, not to a stage
 * change. It has its own test at the bottom.
 */
const STAGE_CHANGE_REASON_LISTS: ReadonlyArray<{ list: readonly string[]; writtenBy: string }> = [
  { list: DECLINE_REASONS, writtenBy: "DECLINE" },
  { list: RELEASE_PULL_REASONS, writtenBy: "RELEASE_PULL" },
  { list: CANCEL_TRANSPORT_REASONS, writtenBy: "CANCEL_TRANSPORT" },
  { list: STEP_BACK_REASONS, writtenBy: "STEP_BACK_STAGE and WITHDRAW_ACCEPTANCE" },
];

describe("the movement workspace's stage-transition reason labels", () => {
  it("walks every reason list, and a shrunken population fails rather than passing quietly", () => {
    /*
     * ⚠️ **THE FLOOR IS ON THE POPULATION WALKED, NEVER ON THE VIOLATIONS FOUND.** A list emptied
     * or an import silently resolving to `[]` makes every `for` below range over nothing, and
     * `[].every(...)` is `true` — a guard reduced to an empty population reads exactly like a
     * guard that is satisfied.
     */
    expect(STAGE_CHANGE_REASON_LISTS).toHaveLength(4);
    for (const { list, writtenBy } of STAGE_CHANGE_REASON_LISTS) {
      expect(list.length, `${writtenBy}'s reason list is empty, so it is checked against nothing`).toBeGreaterThan(0);
    }
    /*
     * ⚠️ **THE FLOOR SITS WELL BELOW THE POPULATION, NOT AT IT.** The four lists held 19
     * reasons between them on 2026-09-06. Pinning 19 would go red the day somebody legitimately
     * retires one — a floor that fails on ordinary shrinkage teaches people to edit the floor,
     * which is how it stops meaning anything. 12 catches a list collapsing to nothing or an import
     * resolving empty, which is all this is for.
     */
    const total = STAGE_CHANGE_REASON_LISTS.reduce((sum, entry) => sum + entry.list.length, 0);
    expect(
      total,
      "the four reason lists have collapsed; the checks below would range over almost nothing",
    ).toBeGreaterThanOrEqual(12);
  });

  it("gives every one of them words, and never its stored value", () => {
    for (const { list, writtenBy } of STAGE_CHANGE_REASON_LISTS) {
      for (const reason of list) {
        const label = stageChangeReasonLabel(reason);
        expect(label, `${writtenBy} can write "${reason}" and nothing renders it in words`).toBeDefined();
        expect(label?.trim().length, `"${reason}" resolves to an empty label`).toBeGreaterThan(0);
        // ⚠️ The specific shape of the defect: a "label" that is just the value tidied up, or the
        // value itself. Either one puts snake_case on a coordinator's screen.
        expect(label).not.toBe(reason);
        expect(label).not.toContain("_");
      }
    }
  });

  it("returns nothing for a reason no list owns — never the value it was handed", () => {
    /*
     * The alternative implementation this guards against is `?? reason`, which every one of the
     * assertions above would pass. It is what the sibling lines in the same file did before this
     * fix, and it is the reason a miss must be visibly empty rather than plausibly filled.
     */
    expect(stageChangeReasonLabel("a_reason_no_list_holds")).toBeUndefined();
    expect(stageChangeReasonLabel("")).toBeUndefined();
  });

  it("has no reason owned by two lists with different words", () => {
    /*
     * The lookup consults the maps in a fixed order, so a key held by two of them resolves to
     * whichever comes first — silently, and correctly-looking. This is the only way the helper can
     * return a real label that is the WRONG label, and it cannot be seen by reading either list.
     */
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const { list } of STAGE_CHANGE_REASON_LISTS) {
      for (const reason of list) {
        const label = stageChangeReasonLabel(reason) ?? "";
        const previous = seen.get(reason);
        if (previous !== undefined && previous !== label) collisions.push(reason);
        seen.set(reason, label);
      }
    }
    expect(collisions).toEqual([]);
    expect(seen.size, "nothing was walked, so no collision could have been found").toBeGreaterThan(0);
  });
});

describe("the withdrawn-referral line's reasons", () => {
  it("renders the label the model's own field comment demands, never the code", () => {
    /*
     * `Movement.withdrawnReferrals` carries the instruction on the field itself: "Render
     * `withdrawalReasonLabels[reason]`, never the code." The timeline rendered
     * `reason.replaceAll("_", " ")` — a defect the field had already been annotated against.
     *
     * This list is NOT in `stageChangeReasonLabel`'s chain, deliberately: no event writes a
     * withdrawal reason into a stage change, and an unnecessary map in that chain is one more way
     * for a shared key to resolve to another list's wording.
     */
    expect(WITHDRAWAL_REASONS.length).toBeGreaterThan(0);
    for (const reason of WITHDRAWAL_REASONS) {
      const label = withdrawalReasonLabels[reason];
      expect(label?.trim().length, `"${reason}" has no withdrawal label`).toBeGreaterThan(0);
      expect(label).not.toContain("_");
    }
  });

  it("keeps those labels out of the stage-transition chain", () => {
    // If a later edit adds `withdrawalReasonLabels` to that chain "for completeness", this says so.
    for (const reason of WITHDRAWAL_REASONS) {
      expect(
        stageChangeReasonLabel(reason),
        `"${reason}" is now resolvable as a stage-transition reason, which no event writes`,
      ).toBeUndefined();
    }
  });

  it("control: the maps this file imports are the real ones, not empty objects", () => {
    // Two of the assertions above would pass against `{}`. This is what makes them mean something.
    expect(Object.keys(changeReasonLabels).length).toBeGreaterThan(10);
    expect(Object.keys(withdrawalReasonLabels).length).toBe(WITHDRAWAL_REASONS.length);
  });
});
