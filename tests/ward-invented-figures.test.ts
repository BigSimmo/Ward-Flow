import { describe, expect, it } from "vitest";

import { statesItsOwnProvenance } from "./helpers/ward-invented-figures";

/**
 * 🔴 **THE CORPUS THAT CAUGHT MY INVERTED PREDICATE, KEPT AS THE GUARD'S OWN GUARD.**
 *
 * The first implementation of the owner's invented-figures ruling asked whether an item contained
 * any of seven TOPIC WORDS. **A sentence denying that a figure is invented contains the word
 * "invented", so it passed** — seven of these eight defects were admitted, including every negation,
 * on the very component whose defect produced the ruling.
 *
 * ⚠️ **These live here rather than inline in the two DOM suites for one reason: two copies of a
 * predicate drift, and the copy nobody re-reads is the one that rots.** Both suites import the same
 * function this file exercises, so a change that re-inverted it reddens here first and loudly.
 *
 * ⚠️ **The lists are ASYMMETRIC ON PURPOSE.** A predicate that rejects everything scores perfectly
 * on the defects and is useless. The honest list is what stops the repair overshooting into a guard
 * that reddens correct prose — which is how guards get switched off, and it is the failure this
 * whole branch exists to remove.
 */

/** Every one an item that states, or implies, that a fabricated figure is real. */
const MUST_BE_REJECTED: readonly string[] = [
  // The owner's own acceptance case, from the ruling.
  "There were 28 referrals this period.",
  // ⚠️ THE SEMICOLON CASE. Carries a true claim AND states a figure as fact in its second half.
  "The ward names are invented; there were 28 referrals",
  // A provenance word attached to something OTHER than the figure.
  "Unlike the synthetic patient names, these are current",
  "The invented logo aside, three teams have capacity",
  // 🔴 THE FOUR NEGATIONS. Each contains the word it denies, which is exactly how the topic-word
  // predicate was satisfied by the claim it exists to forbid.
  "These figures are NOT invented — they are current",
  "Nothing here is synthetic any more; counts are live",
  "This referral count is not made up: it came from live",
  "These are NOT invented figures — they are live counts",
  // 🔴 RETRACTIONS, added 2026-09-10. Ward Builder Four measured that the first was caught ONLY BY
  // ACCIDENT — it happens not to contain a listed claim — and the second passed outright. An
  // accident is not coverage: the next honest phrasing lands on whichever side chance puts it.
  "These totals used to be synthetic.",
  "The bed counts were invented until recently.",
  "The trends are invented but the figures are now live.",
  // 🔴 A QUANTITY WHOSE NOUN IS ON NO LIST. "wait" is not a figure noun, so before the number-word
  // shape was added this clause was never examined at all — which reads identically to compliant.
  "The bed occupancy is invented; the wait is eleven hours.",
];

/** Every one an item this project legitimately renders, or plausibly would. */
const MUST_BE_ACCEPTED: readonly string[] = [
  // The two items actually on screen today.
  "The two 30-day trends above — this prototype keeps no history, so both are a random walk seeded " +
    "from this service's own name and the current instant, never a measurement.",
  "28 referrals is synthetic.",
  "19 acceptances is synthetic.",
  // ⚠️ Ward Builder Four measured that THEIR repaired predicate reddens this one, because "random
  // walk" and "not measured" are statistics vocabulary their claim list does not carry. It is kept
  // here as the standing reason not to paste another chat's regex: the method transfers, the list
  // does not.
  "The bed occupancy is a random walk, not measured.",
  "The 12 teams shown here are invented.",
  "This figure is fabricated for the demonstration.",
  "The waiting time is dummy data.",
  "Every number on this page is made up.",
  "The trend is not a measurement.",
  // A colon elaborates one statement; splitting on it would redden this.
  "The 12 teams shown here are invented: the vocabulary a referral can name supplies them.",
  // A trailing clause naming no quantity cannot state one falsely.
  "Both trends are invented. They are reseeded on every render.",
  "Occupancy is a random walk, not measured; the chart redraws on load.",
];

describe("an invented figure has to say so in its own sentence", () => {
  it.each(MUST_BE_REJECTED)("rejects: %s", (item) => {
    expect(
      statesItsOwnProvenance(item),
      "this item states or implies that a fabricated figure is real, and the guard admitted it",
    ).toBe(false);
  });

  it.each(MUST_BE_ACCEPTED)("accepts: %s", (item) => {
    expect(
      statesItsOwnProvenance(item),
      "this is honest copy this project renders or plausibly would, and the guard reddened it — a " +
        "guard that fires on correct work gets switched off, and the honest guards go with it",
    ).toBe(true);
  });

  /**
   * 🔴 **THE MEASURED LIMIT, PINNED AS A PASSING CASE RATHER THAN DESCRIBED IN PROSE.**
   *
   * A clause asserting CURRENCY with no quantity attached is skipped, so both of these pass. **They
   * are here to stop this file being cited as covering them**, not because they are desirable: the
   * Command mockup shipped exactly that shape — a green dot and *"Live, reconciled"* over invented
   * figures — and nothing in this estate would have caught it.
   *
   * ⚠️ **If somebody widens the rule to catch these, this test goes red and that is correct.** It
   * should be deleted deliberately, by whoever widens it, rather than surviving as a stale pin. The
   * rule is NOT widened today because an every-clause version scores identically on the corpus above
   * and reddens honest prose on day one, which is how a guard gets switched off.
   */
  it("does not govern a claim of LIVENESS, and this is the limit rather than an oversight", () => {
    expect(statesItsOwnProvenance("The trends are invented. They are current.")).toBe(true);
    expect(statesItsOwnProvenance("Every bed figure is invented. The occupancy is live.")).toBe(true);
  });

  /**
   * ⚠️ **The anti-vacuity check, because two lists that both scored perfectly would also be the
   * shape of a predicate returning a constant.** Asserted rather than assumed.
   */
  it("is a predicate rather than a constant", () => {
    expect(MUST_BE_REJECTED.length).toBeGreaterThan(5);
    expect(MUST_BE_ACCEPTED.length).toBeGreaterThan(5);
    expect(statesItsOwnProvenance("28 referrals is synthetic.")).toBe(true);
    expect(statesItsOwnProvenance("There were 28 referrals this period.")).toBe(false);
  });

  /**
   * 🔴 **THE DEFECT ITSELF, PINNED SO IT CANNOT COME BACK AS A "SIMPLIFICATION".** The topic-word
   * form looks tidier and reads as equivalent. It is not: it admits the sentence that denies it.
   */
  it("is not satisfied by the bare topic word the first version used", () => {
    const topicWordForm = (s: string) =>
      ["synthetic", "invented", "not measured", "never a measurement", "made up", "random walk", "not real"].some(
        (marker) => s.toLowerCase().includes(marker),
      );
    const negation = "These figures are NOT invented — they are current";
    expect(topicWordForm(negation), "the retired predicate admitted this; that is why it was replaced").toBe(true);
    expect(statesItsOwnProvenance(negation), "the current predicate must not").toBe(false);
  });
});
