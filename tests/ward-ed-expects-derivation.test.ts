import { describe, expect, it } from "vitest";

import {
  EXPECT_RECONSIDER_AFTER_MINUTES,
  edArrivedFor,
  edExpectsFor,
  edReferralsFor,
  hasArrivedInDepartment,
} from "@/components/ward-management/ward-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * EXPECTS ARE THE PEOPLE ON THEIR WAY; REFERRALS ARE THE PEOPLE HERE. ONE LIST FEEDS THE OTHER.
 *
 * Product owner, 2026-09-07: *"any patient referred to an ED… who is not physically in the ED but on
 * the way at some point is an expect"*, *"Referrals are patients who are at the ED"*, and *"When
 * expects arrive and are marked as arrived, they become referrals."*
 *
 * ⚠️ **THE PROPERTY THAT MATTERS IS THE PARTITION, NOT EITHER LIST ON ITS OWN.** Two selectors that
 * each look right can still lose somebody between them, or show one person twice — and both faults
 * render as a perfectly ordinary screen. **A patient in neither list is invisible to the department
 * they were referred to**, which is the failure this file exists to make impossible.
 */

const ED = "rph-ed";
const NOW = 12 * 60;

function referral(overrides: Partial<Referral> & { id: string }): Referral {
  return {
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    raisedAt: NOW - 60,
    urgency: 2,
    originSiteCode: "RPH",
    transportNeeded: true,
    history: "",
    destinations: [
      { destination: { kind: "emergency_department", edId: ED, purpose: "psychiatric_review" }, state: "queued" },
    ],
    ...overrides,
  } as Referral;
}

describe("what counts as being in the department", () => {
  it("treats a triaged referral as arrived even with no arrival recorded", () => {
    // 🔴 The fallback that stops the screen inverting. All four seeded ED referrals are triaged and
    // none carries `inDepartmentAt`; without this they would every one become expects on first
    // render, and an empty Referrals list beside a full Expects list looks exactly like a working
    // feature.
    expect(hasArrivedInDepartment(referral({ id: "RF-t", triagedAt: NOW - 30 }))).toBe(true);
  });

  it("treats a recorded arrival as arrived with no triage", () => {
    // The ramping case, and the reason arrival is a separate fact: physically here, not yet triaged.
    expect(hasArrivedInDepartment(referral({ id: "RF-a", inDepartmentAt: NOW - 10 }))).toBe(true);
  });

  it("treats neither as not arrived — this is the only shape that makes an expect", () => {
    expect(hasArrivedInDepartment(referral({ id: "RF-n" }))).toBe(false);
  });
});

describe("the expects list", () => {
  it("holds the person who has not arrived, and not the one who has", () => {
    const onTheWay = referral({ id: "RF-way" });
    const here = referral({ id: "RF-here", triagedAt: NOW - 30 });
    const ids = edExpectsFor([onTheWay, here], ED, "psychiatric_review").map((row) => row.referral.id);
    expect(ids).toEqual(["RF-way"]);
  });

  /**
   * 🔴 THE OWNER'S RULING THAT COSTS THE MOST TO GET WRONG. `edReferralsFor` is a worklist and keeps
   * only `queued` rows, so a referral leaves it the moment somebody answers. Accepting does not make
   * anybody arrive — and if expects behaved that way, a patient would vanish from every screen in
   * the gap between "we have accepted them" and "they have walked in".
   */
  it("keeps an ACCEPTED referral whose patient has not arrived", () => {
    const accepted = referral({
      id: "RF-acc",
      destinations: [
        { destination: { kind: "emergency_department", edId: ED, purpose: "psychiatric_review" }, state: "accepted" },
      ],
    });
    expect(edExpectsFor([accepted], ED, "psychiatric_review").map((r) => r.referral.id)).toEqual(["RF-acc"]);
    // And the contrast that gives that assertion meaning: the worklist drops it.
    expect(edReferralsFor([accepted], ED, "psychiatric_review")).toEqual([]);
  });

  it("drops a DECLINED referral — nobody is on their way to a department that said no", () => {
    const declined = referral({
      id: "RF-dec",
      destinations: [
        { destination: { kind: "emergency_department", edId: ED, purpose: "psychiatric_review" }, state: "declined" },
      ],
    });
    expect(edExpectsFor([declined], ED, "psychiatric_review")).toEqual([]);
  });

  /**
   * ⚠️ HIS ORDERING, NOT MINE. I recommended urgency first then wait; he answered "Order by wait
   * time". The urgencies below are deliberately INVERTED against the wait order, so a selector that
   * quietly reintroduced urgency-first would fail here rather than pass by coincidence.
   */
  it("orders by wait time alone, longest first, ignoring urgency", () => {
    const rows = [
      referral({ id: "RF-new", raisedAt: NOW - 10, urgency: 1 }),
      referral({ id: "RF-old", raisedAt: NOW - 600, urgency: 3 }),
      referral({ id: "RF-mid", raisedAt: NOW - 120, urgency: 1 }),
    ];
    expect(edExpectsFor(rows, ED, "psychiatric_review").map((r) => r.referral.id)).toEqual([
      "RF-old",
      "RF-mid",
      "RF-new",
    ]);
  });

  it("ignores a referral addressed to a different department or a different purpose", () => {
    const otherEd = referral({
      id: "RF-other",
      destinations: [
        {
          destination: { kind: "emergency_department", edId: "scgh-ed", purpose: "psychiatric_review" },
          state: "queued",
        },
      ],
    });
    const otherPurpose = referral({
      id: "RF-med",
      destinations: [
        { destination: { kind: "emergency_department", edId: ED, purpose: "medical_assessment" }, state: "queued" },
      ],
    });
    expect(edExpectsFor([otherEd, otherPurpose], ED, "psychiatric_review")).toEqual([]);
  });
});

describe("the 72-hour reconsider threshold", () => {
  it("is the owner's own figure, in minutes", () => {
    // Pinned as a number rather than trusted as a name: a threshold silently changed from 72 hours
    // to something else would still read as "the reconsider threshold" everywhere it is used.
    expect(EXPECT_RECONSIDER_AFTER_MINUTES).toBe(72 * 60);
  });
});

describe("the partition — nobody in both lists, nobody in neither", () => {
  /**
   * 🔴 THE CASE MY OWN FLOOR WAS TOO NARROW TO SEE, found by an adversarial review that executed the
   * real selectors against the real seed rather than reading this file.
   *
   * `edExpectsFor` admits `queued` AND `accepted`. `edReferralsFor` admits `queued` only. So an
   * ACCEPTED referral whose patient HAS arrived is excluded from Expects (they are here) and
   * excluded from Referrals (not queued) — **and it is one click away, because the Expects row
   * renders "Mark arrived in department" on accepted rows and the reducer has no state guard.**
   *
   * ⚠️ The coverage assertion below this one was built from `d.state === "queued"` alone, so it
   * could not observe the hole: every one of its four assertions passed with the patient invisible.
   * This case is written from the OTHER side — a concrete patient, asserted to be somewhere.
   */
  it("keeps an ACCEPTED patient who has arrived on a list, instead of losing them from both", () => {
    const acceptedAndHere = referral({
      id: "RF-here-accepted",
      inDepartmentAt: NOW - 5,
      destinations: [
        { destination: { kind: "emergency_department", edId: ED, purpose: "psychiatric_review" }, state: "accepted" },
      ],
    });
    const inExpects = edExpectsFor([acceptedAndHere], ED, "psychiatric_review").length > 0;
    const inReferrals = edArrivedFor([acceptedAndHere], ED, "psychiatric_review").length > 0;

    expect(
      inExpects || inReferrals,
      "a patient the department has accepted AND who is standing in it must appear on one of the two " +
        "lists — the owner's ruling is that arriving makes an expect a referral, not that it makes them vanish",
    ).toBe(true);
  });

  /**
   * 🔴 THE STRUCTURAL PROPERTY, AND NEITHER LIST CAN SHOW IT ALONE. Run over the REAL fixture plus
   * two constructed expects, because the seed alone contains no expect at all and the invariant
   * would hold vacuously on one side.
   */
  it("puts every queued ED-addressed psychiatry referral in exactly one list", () => {
    const seeded = seedWardFlowState().referrals;
    const all = [...seeded, referral({ id: "RF-way-1" }), referral({ id: "RF-way-2", raisedAt: NOW - 300 })];

    const expects = edExpectsFor(all, ED, "psychiatric_review").map((r) => r.referral.id);
    const arrived = edArrivedFor(all, ED, "psychiatric_review").map((r) => r.referral.id);

    // Anti-vacuity on BOTH sides: an empty expects list would satisfy "no overlap" for free, and
    // this is precisely the fixture state that made the trap invisible in the first place.
    expect(expects.length, "there must be expects, or the disjointness below is free").toBeGreaterThan(0);
    expect(arrived.length, "there must be arrivals, or the coverage below is free").toBeGreaterThan(0);

    expect(
      expects.filter((id) => arrived.includes(id)),
      "no patient may appear as both on the way and already here",
    ).toEqual([]);

    // And nobody falls through the gap: every queued row addressed to this ED for psychiatry is
    // accounted for by one list or the other.
    const queuedHere = all
      // ⚠️ queued OR accepted — the population the two selectors actually admit. Built from
      // `"queued"` alone, this missed an accepted-and-arrived patient who was on NEITHER list, and
      // every assertion below passed while they were invisible. A coverage set narrower than the
      // thing it covers cannot fail for the reason it exists.
      .filter((r) =>
        r.destinations.some(
          (d) =>
            d.destination.kind === "emergency_department" &&
            d.destination.edId === ED &&
            d.destination.purpose === "psychiatric_review" &&
            (d.state === "queued" || d.state === "accepted"),
        ),
      )
      .map((r) => r.id);
    const covered = new Set([...expects, ...arrived]);
    expect(
      queuedHere.filter((id) => !covered.has(id)),
      "a queued referral in neither list is invisible to the department it was sent to",
    ).toEqual([]);
  });
});
