/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { publishedThresholds } from "@/components/ward-management/settings/settings-thresholds";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { ED_ACCESS_TARGET_MINUTES } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE THRESHOLDS TABLE — OWNER-RULED 2026-09-12, AND THE STATE COLUMN IS MEASURED RATHER THAN
 * WRITTEN DOWN.**
 *
 * **What the owner decided**, on three questions put to him with the measurement behind each:
 *
 *     the two thresholds the drawing lists and the app does not have   🔴 NOT ADDED. A number that
 *         changes a colour with nobody's name against it is what this table exists to expose;
 *         adding two more of exactly that kind would be self-defeating.
 *     the one threshold the app HAS and the drawing omits              ✅ PUBLISHED.
 *     a state per row                                                  ✅ ADDED, and it is the one
 *         he was asked to press for.
 *
 * 🔴 **WHY THE STATE MUST BE COMPUTED AND NOT TYPED.** Two of the three possible states look
 * identical to anybody using the app — nothing is ever amber — and they need opposite responses:
 *
 *     fires now             the threshold exists and something currently reaches it.
 *     nothing reaches it    the threshold exists and works, and no record in today's data reaches
 *                           it. A working safeguard nobody can see.
 *
 * ⚠️ **A hand-written state column would be a second source about the first**, stale the day the
 * seed changes — and its staleness would be invisible for exactly the same reason the state matters:
 * **a row saying "nothing reaches it" and a row that is wrong both render as no amber anywhere.**
 * ✅ **So each row's state is derived from the same data the threshold itself is read against, and a
 * seed that gains an overdue form flips that row to "fires now" by itself.**
 */

const SEED = seedWardFlowState();
const CONFIGURATION = defaultWardConfiguration();

describe("the thresholds this prototype publishes", () => {
  it("publishes the access target and the legal-form deadline, and nothing else", () => {
    const rows = publishedThresholds(SEED.movements, NOW_ANCHOR, CONFIGURATION);
    expect(rows).toHaveLength(2);
  });

  /**
   * 🔴 **THE FIGURE IS READ FROM THE CONSTANT, NEVER TYPED.** A table about where numbers live,
   * carrying its own copy of one of them, would be the defect it was written to expose.
   */
  it("takes the access target's number from the constant itself", () => {
    const rows = publishedThresholds(SEED.movements, NOW_ANCHOR, CONFIGURATION);
    const target = rows.find((row) => row.livesIn.includes("ED_ACCESS_TARGET_MINUTES"));
    expect(target, "the access-target row is missing").toBeDefined();
    expect(target?.figure).toContain(String(ED_ACCESS_TARGET_MINUTES));
  });

  /**
   * ⚠️ **THE OWNER'S TWO REFUSED THRESHOLDS MUST NOT APPEAR**, and this asserts it by their numbers
   * rather than by counting rows — a count says a row is missing, a value says WHICH.
   */
  it("carries neither of the two numbers the owner declined to adopt", () => {
    const everything = publishedThresholds(SEED.movements, NOW_ANCHOR, CONFIGURATION)
      .map((row) => `${row.figure} ${row.triggers} ${row.livesIn} ${row.setBy}`)
      .join(" | ");
    expect(everything, "a threshold the owner did not adopt is published").not.toMatch(/\b200\b/);
    expect(everything, "a threshold the owner did not adopt is published").not.toMatch(/\b120\b/);
  });

  /**
   * 🔴 **THE STATE IS MEASURED. On today's seed the legal-form deadline reaches nobody**, because
   * after the owner's 2026-08-23 correction only the transport and transfer forms carry a deadline
   * and none of those is overdue. **A working safeguard nobody can currently see.**
   */
  it("reports the legal-form deadline as reaching nobody on today's data", () => {
    const rows = publishedThresholds(SEED.movements, NOW_ANCHOR, CONFIGURATION);
    const legalForm = rows.find((row) => row.livesIn.includes("legalForm"));
    expect(legalForm, "the legal-form row is missing").toBeDefined();
    expect(legalForm?.state).toBe("nothing-reaches-it");
    expect(legalForm?.reached).toBe(0);
  });

  /**
   * ✅ **AND THE STATE FLIPS ON ITS OWN WHEN THE DATA CHANGES — this is the whole reason it is
   * computed.** Moving the clock far enough past every deadline must turn the row live without
   * anybody editing the table.
   */
  it("turns that row live by itself once something does reach it", () => {
    const farFuture = NOW_ANCHOR + 60 * 24 * 365;
    const rows = publishedThresholds(SEED.movements, farFuture, CONFIGURATION);
    const legalForm = rows.find((row) => row.livesIn.includes("legalForm"));

    expect(legalForm?.reached, "no movement reached the deadline even a year later").toBeGreaterThan(0);
    expect(legalForm?.state).toBe("fires-now");
  });

  /**
   * ⚠️ **The anti-vacuity mirror: the access-target row must be able to say BOTH things too**, or
   * "measured" would be a claim about one row only. On the seed's own clock somebody is past 24
   * hours; wind the clock back before every arrival and nobody is.
   */
  it("measures the access target the same way, in both directions", () => {
    const onSeedClock = publishedThresholds(SEED.movements, NOW_ANCHOR, CONFIGURATION).find((row) =>
      row.livesIn.includes("ED_ACCESS_TARGET_MINUTES"),
    );
    expect(onSeedClock?.state, "nobody on the seed is past the access target").toBe("fires-now");
    expect(onSeedClock?.reached).toBeGreaterThan(0);

    const longBefore = publishedThresholds(SEED.movements, NOW_ANCHOR - 60 * 24 * 365, CONFIGURATION);
    const wound = longBefore.find((row) => row.livesIn.includes("ED_ACCESS_TARGET_MINUTES"));
    expect(wound?.state, "the access target still fired a year before anybody arrived").toBe("nothing-reaches-it");
    expect(wound?.reached).toBe(0);
  });

  /** Every row must name where it lives and who set it — the table's whole purpose. */
  it("gives every row a home and an owner, with no blanks", () => {
    for (const row of publishedThresholds(SEED.movements, NOW_ANCHOR, CONFIGURATION)) {
      expect(row.figure.length, "a row has no figure").toBeGreaterThan(0);
      expect(row.triggers.length, "a row does not say what it triggers").toBeGreaterThan(0);
      expect(row.livesIn.length, "a row does not say where it lives").toBeGreaterThan(0);
      expect(row.setBy.length, "a row does not say who set it").toBeGreaterThan(0);
    }
  });
});
