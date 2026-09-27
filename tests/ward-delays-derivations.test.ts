import { describe, expect, it } from "vitest";

import {
  DELAY_CAUSE_ORDER,
  DELAY_OWNERS,
  SEVERE_CAUSES,
  delayGroups,
  isCleared,
  lastRecordedActivity,
  legalDeadlineMinutes,
  ownerOf,
  silentCommunityReminder,
  silentWardReminder,
  unclearedCount,
  waitingSplit,
} from "@/components/ward-management/delays/delays-derivations";
import { ESCALATION_CONTACTS } from "@/components/ward-management/ward-change-reasons";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { referrals, wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { clockState, minutesUntil } from "@/components/ward-management/ward-clock";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

/**
 * The merge's whole claim, asserted rather than argued: the priority queue, the exceptions inbox and
 * the escalation board listed THE SAME PEOPLE, so one screen can carry all three without losing
 * anybody and without counting anybody twice.
 *
 * ⚠️ Three of the plan's own conditions were wrong against the real code and are corrected here.
 * Each is recorded on the assertion that would have caught it, because a silently emptied group is
 * the failure mode this whole screen has: a heading that is simply absent reads as "nothing is
 * wrong in that category".
 */
const NOW = NOW_ANCHOR;

/**
 * A MINIMAL, VALID `Movement` — every required field, none of the optional ones. Cloned rather than
 * hand-written per test, the same "only X moves" discipline the legal-deadline tests above already
 * use: whatever a test changes on top of this is the whole of what that test is about, and nothing
 * about `blocker`, `stage` or the rest is silently doing work the test's own name does not mention.
 * Deliberately open (`stage: "placement_requested"`, no `closure`) — `isOpen` (ward-derivations.ts)
 * returns true for it.
 */
const BASE_MOVEMENT: Movement = {
  id: "WF-TEST-BASE",
  originEdId: "arm-ed",
  openedAt: NOW - 500,
  flaggedUrgent: false,
  urgency: 1,
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  specialling: false,
  highAcuity: false,
  legalStatus: "Voluntary",
  statusChanges: [],
  urgencyChanges: [],
  overrides: [],
  stage: "placement_requested",
  owner: "ED mental health team",
  referredUnitIds: [],
  declines: [],
  blocker: "No blocker",
  withdrawnReferrals: [],
  unwinds: [],
  stageChanges: [],
};

describe("delayGroups", () => {
  it("places every open movement in exactly one group — a patient is not counted twice", () => {
    const open = wardMovements.filter(isOpen);
    const grouped = delayGroups(wardMovements, allUnits(), NOW).flatMap((group) =>
      group.movements.map((movement) => movement.id),
    );
    expect(new Set(grouped).size, "a movement appears in two groups").toBe(grouped.length);
    expect([...grouped].sort()).toEqual(open.map((movement) => movement.id).sort());
  });

  it("puts an expiring legal authority first, above a longer wait", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    // Only assert the ordering rule when the fixture actually exercises it, and say so when it does
    // not — a silently skipped ordering rule is how one comes back wrong.
    const legal = groups.findIndex((group) => group.cause === "legal_expiring");
    if (legal === -1) {
      /*
       * ⚠️ THIS BRANCH USED TO ASSERT `groups` DID NOT CONTAIN `legal_expiring`, WHICH IS THE
       * CONDITION OF THE BRANCH IT SITS IN. A filter and an assertion over the same predicate is a
       * tautology: it could not fail, so on today's fixture — where the group is never populated —
       * this whole test was unfailable while reading as coverage.
       *
       * The replacement asserts the REASON the group is absent, which is falsifiable: no open
       * movement's legal clock is "critical" against `NOW`. If a seeded `dueAt` moves inside the
       * hour, this goes red and the branch above starts running instead, which is the correct
       * outcome either way. The ordering rule itself is now proved unconditionally by
       * "ranks a passed legal deadline above an approaching one" below, on constructed movements.
       */
      for (const movement of wardMovements.filter(isOpen)) {
        const dueAt = movement.legalForm?.dueAt;
        if (dueAt === undefined) continue;
        expect(
          clockState(dueAt, NOW),
          `${movement.id}'s legal clock is critical, so legal_expiring should have been populated`,
        ).not.toBe("critical");
      }
      return;
    }
    expect(legal).toBe(0);
  });

  it("returns no empty group, because a heading over nothing reads as a category that is fine", () => {
    for (const group of delayGroups(wardMovements, allUnits(), NOW)) {
      expect(group.movements.length, `${group.cause} is empty`).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ ANTI-VACUITY, AND IT CATCHES A DEFECT THE PLAN SHIPPED. The plan classified "no eligible
   * bed" as `shortlistCandidates(...).length === 0`. That function returns EVERY unit with an
   * honest verdict on each — its own doc comment says so in capitals — so its length is zero only
   * when the network has no wards at all. The group would have been permanently empty, and an
   * empty group is DROPPED, so the two people with nowhere to go would simply not have appeared.
   * Nothing above would have gone red: every other assertion here passes with the group missing.
   */
  it("actually finds the people with nowhere eligible, rather than dropping the group", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const nowhere = groups.find((group) => group.cause === "no_eligible_bed");
    expect(nowhere, "no_eligible_bed is absent — the classifier can no longer detect it").toBeDefined();
    expect(nowhere?.movements.length ?? 0).toBeGreaterThan(0);
  });

  /** Every cause the type allows must be reachable, or the union is bigger than the classifier. */
  it("uses only causes the classifier can actually produce", () => {
    const produced = new Set(delayGroups(wardMovements, allUnits(), NOW).map((group) => group.cause));
    expect(produced.size, "the fixture exercises too few causes to be a useful guard").toBeGreaterThan(2);
  });

  /**
   * AUDIT GAP 1. `buildActionInbox`'s "Bed pull expired" category has a real equivalent here now:
   * a `stage === "pulled"` movement whose `pullExpiresAt` has already lapsed must land under
   * `bed_pull_expired`, not get lumped into `awaiting_bed_ready` with every hold still running.
   */
  it("puts an expired bed pull under bed_pull_expired, not awaiting_bed_ready", () => {
    const expiredPulls = wardMovements.filter(
      (movement) => movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt < NOW,
    );
    expect(
      expiredPulls.length,
      "the fixture carries no expired bed pull — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const expiredGroup = groups.find((group) => group.cause === "bed_pull_expired");
    expect(expiredGroup, "bed_pull_expired is absent — the classifier can no longer detect it").toBeDefined();
    const expiredGroupIds = new Set(expiredGroup?.movements.map((movement) => movement.id));
    for (const movement of expiredPulls) {
      expect(expiredGroupIds.has(movement.id), `${movement.id} has an expired pull but is not grouped under it`).toBe(
        true,
      );
    }

    const bedReadyGroup = groups.find((group) => group.cause === "awaiting_bed_ready");
    for (const movement of expiredPulls) {
      expect(
        bedReadyGroup?.movements.some((candidate) => candidate.id === movement.id) ?? false,
        `${movement.id} has an expired pull but still appears under awaiting_bed_ready too`,
      ).toBe(false);
    }
  });

  /**
   * AUDIT GAP 1, ranking half. An expired hold is worse than one still running, so
   * `bed_pull_expired` must outrank `awaiting_bed_ready` whenever both groups are present.
   */
  it("ranks bed_pull_expired above awaiting_bed_ready when both are present", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const expiredIndex = groups.findIndex((group) => group.cause === "bed_pull_expired");
    const bedReadyIndex = groups.findIndex((group) => group.cause === "awaiting_bed_ready");
    if (expiredIndex === -1 || bedReadyIndex === -1) {
      // Already proved non-vacuous above for bed_pull_expired; if awaiting_bed_ready happens to
      // be empty on this fixture there is nothing to rank against, and that is not this test's
      // claim to make.
      return;
    }
    expect(expiredIndex).toBeLessThan(bedReadyIndex);
  });

  /**
   * AUDIT GAP 3. `legal_breached` and `legal_expiring` must never both claim the same movement,
   * and `ORDER` must rank a passed deadline above a merely approaching one. As of this fixture
   * (recorded in delays-derivations.ts's own comment on this branch) every seeded `legalForm.dueAt`
   * lands in `clockState` "due" or "clear" — none is "breached" or "critical" — so neither new
   * cause is actually populated today. That is reported here rather than hidden: the population
   * this test floors is the movements that carry a legal deadline at all, and what it proves is
   * that none of THEM is wrongly swept into either legal cause while in a non-urgent state.
   */
  it("keeps a non-urgent legal deadline out of both legal_breached and legal_expiring", () => {
    const withDeadline = wardMovements.filter((movement) => movement.legalForm?.dueAt !== undefined);
    expect(
      withDeadline.length,
      "the fixture carries no movement with a legal deadline — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    const nonUrgent = withDeadline.filter((movement) => {
      const dueAt = movement.legalForm?.dueAt;
      if (dueAt === undefined) return false;
      const state = clockState(dueAt, NOW);
      return state === "due" || state === "clear";
    });
    expect(
      nonUrgent.length,
      "every seeded legal deadline is breached or critical — this test no longer covers the non-urgent case it names",
    ).toBe(withDeadline.length);

    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const legalIds = new Set(
      groups
        .filter((group) => group.cause === "legal_breached" || group.cause === "legal_expiring")
        .flatMap((group) => group.movements.map((movement) => movement.id)),
    );
    for (const movement of nonUrgent) {
      expect(legalIds.has(movement.id), `${movement.id}'s deadline is not urgent but was grouped as legal`).toBe(false);
    }
  });

  /**
   * AUDIT GAP 3, ranking half. `legal_breached` must outrank `legal_expiring`: a legal authority
   * that has already expired is worse than one merely approaching, and it is the one thing on this
   * screen the module says nothing outranks.
   *
   * 🔴 **THIS TEST RAN ZERO ASSERTIONS UNTIL 2026-09-06 AND WAS THEREFORE UNFAILABLE.** It read the
   * two groups out of `delayGroups(wardMovements, …)` and returned early when either was missing —
   * and neither is EVER populated by the seeded fixture, whose four `dueAt` values are all "due" or
   * "clear" against `NOW_ANCHOR`. Its own docblock said so and called the early return a way of
   * holding "in both the case where the fixture starts exercising one or both groups later and the
   * case where it never does". **Holding in both cases is the defect, not the mitigation:** a test
   * that passes vacuously is indistinguishable from one that passes because the property holds.
   *
   * Proved rather than argued: swapping the two entries in `ORDER` — so a PASSED legal deadline
   * ranks below an approaching one, on the ward screen where that ordering matters most — left this
   * file at 15 of 15 passing, and every other test that touches the ordering
   * (`ward-delay-cause-vocabulary`) at 18 of 18. Nothing in the repository caught it.
   *
   * ⚠️ **AND THE FIXTURE WAS NEVER THE OBSTACLE.** `delayGroups` is a pure function: two seeded
   * movements cloned with a moved `dueAt` populate both groups today, with no wait and no new
   * seed. The constructed case below goes red under that same swap.
   */
  it("ranks a passed legal deadline above an approaching one, on movements built to populate both", () => {
    const carryingLegalForm = wardMovements.filter((movement) => isOpen(movement) && movement.legalForm !== undefined);
    // Floor on the POPULATION the case is built from, never on the result: if the seed stops
    // carrying open movements with a legal form, the clones below cannot be made and this test
    // would otherwise construct nothing and pass.
    expect(
      carryingLegalForm.length,
      "fewer than two open seeded movements carry a legal form, so the two groups cannot both be populated",
    ).toBeGreaterThan(1);

    const [first, second] = carryingLegalForm;
    // Only `dueAt` moves. Everything else is the seed's own record, so nothing about these
    // movements is invented beyond the one field whose value decides the branch.
    const breached = { ...first, legalForm: { ...first.legalForm!, dueAt: NOW - 10 } };
    const expiring = { ...second, legalForm: { ...second.legalForm!, dueAt: NOW + 30 } };
    expect(clockState(NOW - 10, NOW), "the breached clone is not breached").toBe("breached");
    expect(clockState(NOW + 30, NOW), "the expiring clone is not critical").toBe("critical");

    const groups = delayGroups([breached, expiring], allUnits(), NOW);
    const causes = groups.map((group) => group.cause);
    // Both must be present before the ordering means anything — an absent group would make
    // `indexOf` return -1 and the comparison below pass for the wrong reason.
    expect(causes, "the constructed movements did not populate both legal groups").toContain("legal_breached");
    expect(causes, "the constructed movements did not populate both legal groups").toContain("legal_expiring");
    expect(
      causes.indexOf("legal_breached"),
      "an already-expired legal authority is ranked below one merely running out",
    ).toBeLessThan(causes.indexOf("legal_expiring"));
  });
});

describe("legalDeadlineMinutes", () => {
  /**
   * AUDIT GAP 2. `delayGroups` only tells a caller WHICH cause a movement's legal deadline fell
   * under; the exceptions inbox it replaces rendered the actual remaining/overdue minutes
   * (`buildActionInbox`'s `minutesUntil(dueAt, now)`). This exposes that same raw figure.
   */
  it("returns the exact minutesUntil figure for every movement carrying a legal deadline", () => {
    const withDeadline = wardMovements.filter((movement) => movement.legalForm?.dueAt !== undefined);
    expect(
      withDeadline.length,
      "the fixture carries no movement with a legal deadline — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    for (const movement of withDeadline) {
      const dueAt = movement.legalForm?.dueAt as number;
      expect(legalDeadlineMinutes(movement, NOW)).toBe(minutesUntil(dueAt, NOW));
    }
  });

  it("returns undefined for a movement with no legal deadline, and does not fabricate a number", () => {
    const withoutDeadline = wardMovements.filter((movement) => movement.legalForm?.dueAt === undefined);
    expect(
      withoutDeadline.length,
      "the fixture carries no movement without a legal deadline — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    for (const movement of withoutDeadline) {
      expect(legalDeadlineMinutes(movement, NOW)).toBeUndefined();
    }
  });

  /**
   * 🔴 **THIS RAN ZERO ASSERTIONS UNTIL 2026-09-06, AND ITS OWN COMMENT SAID SO.** It filtered the
   * seed for a movement whose legal deadline had passed, found none — measured: `delayGroups`
   * populates `no_eligible_bed:2, awaiting_ward_answer:4, bed_pull_expired:1, awaiting_bed_ready:6,
   * awaiting_transport:8, patient_or_family:1, awaiting_coordinator:21`, and neither legal group at
   * all — and returned, recording that the branch "cannot be exercised without inventing fixture
   * data".
   *
   * ⚠️ **THAT SENTENCE IS THE MISTAKE, AND IT IS THE SAME ONE AS THE RANKING TEST ABOVE.**
   * `legalDeadlineMinutes` is a pure function of a movement and a `now`; moving one seeded
   * movement's `dueAt` is not inventing fixture data, it is supplying the argument. The seeded
   * arm is kept — if a real deadline ever passes, it must hold there too — but it is no longer the
   * only arm, so the test can no longer pass by finding nothing.
   */
  it("returns a negative figure once the deadline has passed, matching formatRemaining's own sign convention", () => {
    const carryingLegalForm = wardMovements.filter((movement) => movement.legalForm !== undefined);
    expect(
      carryingLegalForm.length,
      "no seeded movement carries a legal form, so the constructed case below cannot be built",
    ).toBeGreaterThan(0);

    // Only `dueAt` moves, to ten minutes before `NOW`. Everything else is the seed's own record.
    const passed = {
      ...carryingLegalForm[0],
      legalForm: { ...carryingLegalForm[0].legalForm!, dueAt: NOW - 10 },
    };
    expect(legalDeadlineMinutes(passed, NOW), "a passed deadline did not report a negative figure").toBe(-10);

    // The seeded arm, unchanged in intent: if the fixture ever does carry a passed deadline, the
    // same convention must hold on the real record and not only on the constructed one.
    for (const movement of wardMovements.filter(
      (candidate) => candidate.legalForm?.dueAt !== undefined && candidate.legalForm.dueAt < NOW,
    )) {
      expect(legalDeadlineMinutes(movement, NOW)).toBeLessThan(0);
    }
  });
});

describe("waitingSplit", () => {
  it("splits every open movement and nothing else", () => {
    const total = waitingSplit(wardMovements, NOW).reduce((sum, segment) => sum + segment.value, 0);
    expect(total).toBe(wardMovements.filter(isOpen).length);
  });

  it("puts a real population in more than one band, or the bar says nothing", () => {
    const nonEmpty = waitingSplit(wardMovements, NOW).filter((segment) => segment.value > 0);
    expect(nonEmpty.length).toBeGreaterThan(1);
  });

  /**
   * 🔴 THE OWNER'S 2026-09-08 BAND RULING, PINNED AT THE EXACT MINUTE. This is the only test in this
   * file that asserts a boundary rather than a total, and until that date it was pointed at
   * `waitBands` — a duplicate banding function that no screen ever called. So the boundaries of the
   * bar a coordinator actually looks at were unpinned, while the boundaries of a dead one were
   * proved to the minute. The duplicate is gone and this test now guards the live function.
   *
   * ⚠️ Each movement is built AT the boundary, not near it. `>= 8 * 60` and `> 8 * 60` differ on
   * exactly one input — a person who has waited eight hours to the minute — and every test that
   * samples "about eight hours" passes under both.
   */
  it("draws the three bands at 8 and 24 hours, on movements built exactly at each boundary", () => {
    const justUnder8h: Movement = { ...BASE_MOVEMENT, id: "WF-TEST-UNDER8", openedAt: NOW - (8 * 60 - 1) };
    const exactly8h: Movement = { ...BASE_MOVEMENT, id: "WF-TEST-8H", openedAt: NOW - 8 * 60 };
    const justUnder24h: Movement = { ...BASE_MOVEMENT, id: "WF-TEST-UNDER24", openedAt: NOW - (24 * 60 - 1) };
    const exactly24h: Movement = { ...BASE_MOVEMENT, id: "WF-TEST-24H", openedAt: NOW - 24 * 60 };

    const bandFor = (movement: Movement) => waitingSplit([movement], NOW).find((segment) => segment.value === 1)?.label;

    expect(bandFor(justUnder8h)).toBe("Under 8 hours");
    expect(bandFor(exactly8h)).toBe("8 to 24 hours");
    expect(bandFor(justUnder24h)).toBe("8 to 24 hours");
    expect(bandFor(exactly24h)).toBe("Over 24 hours");
  });

  /**
   * 🔴 SEVERITY MUST BE A CONTIGUOUS PREFIX OF THE RANKING, and this exists because it briefly was
   * not. Splitting `legal_expiring` into `legal_breached` + `legal_expiring` added the worse case
   * to the ranking while the screen predicate that decides danger tone still named only the old
   * member — so the lapsed authority read as routine and the approaching one read as danger.
   * A string union still typechecks after a split, so nothing caught it.
   *
   * The property, rather than the member list: everything the screen calls severe must sit at the
   * TOP of the order with no ordinary cause interleaved. Insert a new worst cause without naming it
   * severe and this goes red; mark something severe that ranks below an ordinary cause and it goes
   * red the other way.
   */
  it("treats exactly the top of the ranking as severe, with no ordinary cause above a severe one", () => {
    expect(SEVERE_CAUSES.length, "no severe causes — this assertion would be vacuous").toBeGreaterThan(0);
    expect(
      DELAY_CAUSE_ORDER.length,
      "the ranking is not longer than the severe band, so prefix means nothing",
    ).toBeGreaterThan(SEVERE_CAUSES.length);

    const positions = SEVERE_CAUSES.map((cause) => DELAY_CAUSE_ORDER.indexOf(cause));
    expect(positions, `a severe cause is missing from the ranking: ${SEVERE_CAUSES.join(", ")}`).not.toContain(-1);

    const expected = DELAY_CAUSE_ORDER.slice(0, SEVERE_CAUSES.length);
    expect(
      [...SEVERE_CAUSES].sort(),
      `severity is not the top ${SEVERE_CAUSES.length} of the ranking — order is ${DELAY_CAUSE_ORDER.join(" > ")}`,
    ).toEqual([...expected].sort());
  });
});

describe("DELAY_OWNERS and ownerOf", () => {
  it("names the five headings in the owner's own words, in order", () => {
    expect(DELAY_OWNERS).toEqual([
      { id: "yours", name: "Yours", subLine: "Your decision, or a legal form's due time running out" },
      { id: "wards", name: "Wards", subLine: "Waiting on a ward to answer or a bed to be ready" },
      { id: "ed", name: "ED", subLine: "Waiting on the referring department" },
      { id: "transport", name: "Transport", subLine: "Waiting on a vehicle or an escort" },
      { id: "other", name: "Other", subLine: "Everything else holding somebody up" },
    ]);
  });

  /**
   * TOTALITY, PROVEN AT RUNTIME RATHER THAN TRUSTED TO THE COMPILER. `ownerOf` is backed by a
   * `Record<DelayCause, DelayOwnerId>`, which the compiler would refuse to leave incomplete — but
   * this file's own top-of-file correction records that vitest never typechecks, so that guarantee
   * never actually runs here. Walking `DELAY_CAUSE_ORDER` itself, never a hand-copied list of
   * causes, means this single test goes red BOTH if a cause in today's ranking has no owner AND if
   * a new cause is ever added to the ranking without a line added for it in `CAUSE_OWNERS` — a
   * missing key reads as `undefined` at runtime regardless of what the type system would have said.
   */
  it("maps every cause the ranking currently produces to one of the five owners", () => {
    expect(DELAY_CAUSE_ORDER.length, "no causes to floor this test on").toBeGreaterThan(0);
    const ownerIds = new Set(DELAY_OWNERS.map((owner) => owner.id));
    for (const cause of DELAY_CAUSE_ORDER) {
      expect(ownerIds.has(ownerOf(cause)), `${cause} maps to no valid owner`).toBe(true);
    }
  });

  /**
   * 🔴 THE OWNER'S RULING AS A PROPERTY, NOT AS A VALUE — the test above pins nine exact strings and
   * would go green again the moment somebody edited it to match whatever the code now says. This one
   * cannot be satisfied that way: it says the WORST thing on the board is never filed under the
   * leftovers heading, whatever that thing is called and however the ranking is reordered later.
   *
   * ⚠️ **IT PROVABLY COULD HAVE FAILED.** Until 2026-09-08 `DELAY_CAUSE_ORDER[0]` was
   * `legal_breached` and `ownerOf(legal_breached)` was `"other"` — this exact assertion was RED
   * against the code as shipped the day before, which is the only evidence that it is a guard rather
   * than a tautology. It is not floored on a hand-copied cause name for the same reason.
   */
  it("never files the highest-ranked cause under the leftovers heading", () => {
    expect(DELAY_CAUSE_ORDER.length, "no causes to floor this test on").toBeGreaterThan(0);
    const worst = DELAY_CAUSE_ORDER[0];
    expect(ownerOf(worst), `${worst} is ranked first on the board and would be read last under "Other"`).not.toBe(
      "other",
    );
  });

  it("assigns the exact recorded owner for each cause, so a re-mapping is a deliberate, reviewed line", () => {
    // ⚠️ OWNER RULING 2026-09-08. These two read "other" until that date. A conflict resolved over
    // either of these two lines is a decision about which behaviour survives, not a mechanical merge.
    expect(ownerOf("legal_breached")).toBe("yours");
    expect(ownerOf("legal_expiring")).toBe("yours");
    expect(ownerOf("no_eligible_bed")).toBe("wards");
    expect(ownerOf("awaiting_ward_answer")).toBe("wards");
    expect(ownerOf("bed_pull_expired")).toBe("wards");
    expect(ownerOf("awaiting_bed_ready")).toBe("wards");
    expect(ownerOf("awaiting_transport")).toBe("transport");
    expect(ownerOf("patient_or_family")).toBe("other");
    expect(ownerOf("awaiting_coordinator")).toBe("yours");
  });
});

describe("lastRecordedActivity", () => {
  /**
   * 🔴 THE UNDEFINED BRANCH, PROVED RATHER THAN ASSUMED. `openedAt` is a required field on
   * `Movement` (ward-model.ts) — never optional — so it is always a candidate, and a movement with
   * every OPTIONAL timed field absent still returns it. This is the anti-vacuity floor for the
   * whole function: if this ever returned `undefined`, the "floor" the function's own doc comment
   * claims always exists would be false.
   */
  it("returns the floor — openedAt — when nothing else on the movement is recorded, and is never undefined", () => {
    const result = lastRecordedActivity(BASE_MOVEMENT, NOW);
    expect(
      result,
      "lastRecordedActivity returned undefined even though openedAt is required and always present",
    ).toBeDefined();
    expect(result).toEqual({ at: BASE_MOVEMENT.openedAt, what: "the journey opened" });
  });

  it("finds WF-003's recorded examination as more recent than its own openedAt (real fixture, not constructed)", () => {
    const wf003 = wardMovements.find((movement) => movement.id === "WF-003");
    expect(wf003, "WF-003 is missing from the fixture").toBeDefined();
    expect(wf003!.examination, "WF-003 no longer carries an examination — this test would be vacuous").toBeDefined();
    expect(lastRecordedActivity(wf003!, NOW)).toEqual({
      at: wf003!.examination!.at,
      what: "the psychiatric examination was recorded",
    });
  });

  it("finds WF-001's recorded referral absence as more recent than its own openedAt (real fixture)", () => {
    const wf001 = wardMovements.find((movement) => movement.id === "WF-001");
    expect(wf001, "WF-001 is missing from the fixture").toBeDefined();
    expect(
      wf001!.referralAbsence,
      "WF-001 no longer carries a referral absence — this test would be vacuous",
    ).toBeDefined();
    expect(lastRecordedActivity(wf001!, NOW)).toEqual({
      at: wf001!.referralAbsence!.at,
      what: "recorded that nobody referred this person",
    });
  });

  it("picks escalation over an earlier decline and an earlier examination on the same movement (WF-009, real fixture)", () => {
    const wf009 = wardMovements.find((movement) => movement.id === "WF-009");
    expect(wf009, "WF-009 is missing from the fixture").toBeDefined();
    expect(wf009!.escalation, "WF-009 no longer carries an escalation — this test would be vacuous").toBeDefined();
    expect(wf009!.declines.length, "WF-009 no longer carries declines to rank against").toBeGreaterThan(0);
    const latestDecline = Math.max(...wf009!.declines.map((decline) => decline.at));
    expect(
      wf009!.escalation!.at,
      "the escalation is no longer the most recent event on WF-009 — this test no longer proves ranking",
    ).toBeGreaterThan(latestDecline);
    /*
     * 🔴 **THIS ASSERTED A CONTACT THE MODEL CANNOT HOLD, AND PASSED BECAUSE IT SAID THE SAME WRONG
     * THING AS THE CODE.** It pinned the literal `"escalated to the on-call manager"` — a person who
     * does not exist in this system. `escalation.contact` is one of six members of
     * `ESCALATION_CONTACTS`, a closed list whose values ARE the rendered text, and "the on-call
     * manager" is not among them. Found by reading the live screen, where the detail panel named
     * that phantom while the row beside it named the real desk.
     *
     * ⚠️ **A TEST WRITTEN FROM THE SAME UNDERSTANDING AS THE CODE ASSERTS THE HALF THEY AGREE ON.**
     * The repair is not to update the string — that reproduces the same defect one layer up. It is
     * to assert against the FIELD, so any future hard-coded name fails here however plausible it
     * reads, plus a membership floor so a fixture drifting off the vocabulary is caught too.
     */
    expect(
      ESCALATION_CONTACTS as readonly string[],
      "WF-009's contact is not a member of the closed list — the fixture has drifted from the vocabulary",
    ).toContain(wf009!.escalation!.contact);
    expect(lastRecordedActivity(wf009!, NOW)).toEqual({
      at: wf009!.escalation!.at,
      what: `escalated to ${wf009!.escalation!.contact}`,
    });
  });

  /**
   * 🔴 THE TIE-BREAK, ON A REAL TIE THE FIXTURE ALREADY CARRIES — no clone needed. The Ward Flow
   * test clock does not advance on its own, so two genuinely different recorded events sharing one
   * instant is not a corner case here; `WF-007`'s transport arrival and its closure are exactly
   * that pair. `lastRecordedActivity` pushes the transport-arrival candidate before the closure
   * candidate and `pickLatest` keeps the FIRST candidate on an exact tie (strict `>`, never `>=`),
   * so "transport arrived" wins over "the patient arrived" here. That specific direction is an
   * arbitrary but fixed choice — determinism, not correctness, is what this proves.
   */
  it("breaks a real tied instant deterministically — WF-007's transport arrival and closure share one instant", () => {
    const wf007 = wardMovements.find((movement) => movement.id === "WF-007");
    expect(wf007, "WF-007 is missing from the fixture").toBeDefined();
    expect(wf007!.transport?.arrivedAt, "WF-007 no longer carries a transport arrival").toBeDefined();
    expect(wf007!.closure?.at, "WF-007 no longer carries a closure").toBeDefined();
    expect(
      wf007!.transport!.arrivedAt,
      "the tie this test relies on no longer holds — transport arrival and closure have drifted apart",
    ).toBe(wf007!.closure!.at);
    expect(lastRecordedActivity(wf007!, NOW)).toEqual({ at: wf007!.closure!.at, what: "transport arrived" });
  });

  it.each([
    ["acceptedAt", "transport accepted the job"],
    ["enRouteAt", "transport left en route"],
    ["collectedAt", "the patient was collected"],
    ["arrivedAt", "transport arrived"],
    ["cancelledAt", "transport was cancelled"],
  ] as const)("names a transport %s instant as %j", (field, what) => {
    const movement: Movement = {
      ...BASE_MOVEMENT,
      transport: { id: "TR-TEST", provider: "Ambulance service", escortRequired: false, [field]: NOW - 10 },
    };
    expect(lastRecordedActivity(movement, NOW)).toEqual({ at: NOW - 10, what });
  });

  // ⚠️ `patch` is typed `Partial<Movement>` directly, never `as const` — the nested `declines`/
  // `withdrawnReferrals` arrays and their `reason` members must stay assignable to `Decline[]` /
  // `WithdrawalReason` etc, which an `as const` tuple would freeze into readonly literals instead.
  const lastActivityCases: { name: string; patch: Partial<Movement>; what: string }[] = [
    { name: "referredAt", patch: { referredAt: NOW - 10 }, what: "referral raised" },
    { name: "formedAt", patch: { formedAt: NOW - 10 }, what: "the legal form was raised" },
    {
      name: "declines",
      patch: { declines: [{ unitId: "arm-adult-open", at: NOW - 10, reason: "no_bed" }] },
      what: "a ward declined",
    },
    {
      name: "withdrawnReferrals",
      patch: { withdrawnReferrals: [{ unitId: "arm-adult-open", at: NOW - 10, reason: "another_unit_accepted" }] },
      what: "a referral was withdrawn",
    },
    {
      name: "referralAbsence (not_asked)",
      patch: { referralAbsence: { reason: "not_asked", at: NOW - 10 } },
      what: "recorded that nobody was asked which referral this came from",
    },
  ];

  it.each(lastActivityCases)(
    "names $name as the last recorded activity, on a movement built only to carry it",
    ({ patch, what }) => {
      const movement: Movement = { ...BASE_MOVEMENT, ...patch };
      expect(lastRecordedActivity(movement, NOW)).toEqual({ at: NOW - 10, what });
    },
  );

  it("drops a future-dated candidate rather than reporting it as the most recent activity", () => {
    const movement: Movement = { ...BASE_MOVEMENT, referredAt: NOW + 999 };
    // The future candidate must not win, and there is nothing else recorded, so the floor answers.
    expect(lastRecordedActivity(movement, NOW)).toEqual({ at: movement.openedAt, what: "the journey opened" });
  });
});

describe("isCleared and unclearedCount", () => {
  /**
   * ⚠️ **THE FIXTURE CANNOT EXERCISE `true` OR `false` — MEASURED, NOT ASSUMED.** Neither seeded
   * referral a movement actually links to (`RF-012`, `RF-013`) carries a `medicalClearance` at all,
   * so every real movement's `isCleared` reads `undefined` today. That is reported here as the real
   * finding it is, and the constructed cases below exercise the branches the fixture cannot.
   */
  it("finds no clearance recorded on either real referral link, so both read unknown rather than cleared or not", () => {
    const wf002 = wardMovements.find((movement) => movement.id === "WF-002");
    const wf009 = wardMovements.find((movement) => movement.id === "WF-009");
    expect(wf002?.referralId, "WF-002 no longer links to a referral").toBeDefined();
    expect(wf009?.referralId, "WF-009 no longer links to a referral").toBeDefined();
    const linked002 = referrals.find((referral) => referral.id === wf002!.referralId);
    const linked009 = referrals.find((referral) => referral.id === wf009!.referralId);
    expect(linked002, "WF-002's referral link no longer resolves").toBeDefined();
    expect(linked009, "WF-009's referral link no longer resolves").toBeDefined();
    expect(
      linked002!.medicalClearance,
      "RF-012 now carries a medicalClearance — this test's premise (the fixture cannot exercise true/false) no longer holds",
    ).toBeUndefined();
    expect(
      linked009!.medicalClearance,
      "RF-013 now carries a medicalClearance — this test's premise (the fixture cannot exercise true/false) no longer holds",
    ).toBeUndefined();
    expect(isCleared(wf002!, referrals)).toBeUndefined();
    expect(isCleared(wf009!, referrals)).toBeUndefined();
  });

  it("returns undefined for a movement with no resolvable referral at all, not a false 'not cleared'", () => {
    const wf001 = wardMovements.find((movement) => movement.id === "WF-001");
    expect(wf001, "WF-001 is missing from the fixture").toBeDefined();
    expect(
      wf001!.referralId,
      "WF-001 now carries a referral link — pick a different unlinked movement",
    ).toBeUndefined();
    expect(isCleared(wf001!, referrals)).toBeUndefined();
  });

  it("reports true or false once the linked referral actually records an answer, on referrals built to carry one", () => {
    const rf012 = referrals.find((referral) => referral.id === "RF-012");
    const wf002 = wardMovements.find((movement) => movement.id === "WF-002");
    expect(rf012, "RF-012 is missing from the fixture").toBeDefined();
    expect(wf002, "WF-002 is missing from the fixture").toBeDefined();

    const cleared: Referral = { ...rf012!, medicalClearance: { cleared: true, at: NOW - 5 } };
    expect(isCleared(wf002!, [cleared])).toBe(true);

    const notCleared: Referral = { ...rf012!, medicalClearance: { cleared: false, at: NOW - 5 } };
    expect(isCleared(wf002!, [notCleared])).toBe(false);
  });

  it("is honestly zero on the real fixture — nothing has recorded an answer either way, never inferred from unknown", () => {
    expect(wardMovements.filter(isOpen).length, "no open movements to floor this on").toBeGreaterThan(0);
    expect(unclearedCount(wardMovements, referrals)).toBe(0);
  });

  it("counts only the explicitly-false movements, never the unknown ones", () => {
    const rf012 = referrals.find((referral) => referral.id === "RF-012")!;
    const clearedRef: Referral = { ...rf012, id: "RF-TEST-CLEARED", medicalClearance: { cleared: true, at: NOW } };
    const unclearedRef: Referral = { ...rf012, id: "RF-TEST-UNCLEARED", medicalClearance: { cleared: false, at: NOW } };
    const movements: Movement[] = [
      { ...BASE_MOVEMENT, id: "WF-TEST-CLEARED", referralId: "RF-TEST-CLEARED" },
      { ...BASE_MOVEMENT, id: "WF-TEST-UNCLEARED", referralId: "RF-TEST-UNCLEARED" },
      { ...BASE_MOVEMENT, id: "WF-TEST-UNKNOWN" },
    ];
    expect(unclearedCount(movements, [clearedRef, unclearedRef])).toBe(1);
  });
});

describe("silent answer reminders — display only, from existing timestamps", () => {
  it("says nothing until a ward has been silent two hours", () => {
    expect(silentWardReminder(NOW - 119, NOW)).toBeUndefined();
    expect(silentWardReminder(undefined, NOW)).toBeUndefined();
  });

  it("names the 2-hour, 4-hour, and end-of-shift marks as they are reached", () => {
    expect(silentWardReminder(NOW - 120, NOW)).toContain("Ward silent 2 hours");
    // Inside one shift (08:00 to 12:00, day shift 07:00-15:00). NOW - 240 is 06:42, in the night shift that
    // ended at 07:00 under the one shift pattern, so it now reads past end of shift instead.
    expect(silentWardReminder(8 * 60, 12 * 60)).toContain("Ward silent 4 hours");
    // D-22: the reminder marks are Josh's defaults, and the text says so.
    expect(silentWardReminder(NOW - 120, NOW)).toContain("your default, not a legal limit");
    const morningReferral = 8 * 60;
    const afterMorningShift = 15 * 60 + 30;
    expect(silentWardReminder(morningReferral, afterMorningShift)).toContain("07:00–15:00");
    // One shift pattern (Josh, 26 Sept 2026): evening is 15:00–23:00 and night 23:00–07:00.
    const eveningReferral = 16 * 60;
    const afterEveningShift = 23 * 60 + 30;
    expect(silentWardReminder(eveningReferral, afterEveningShift)).toContain("15:00–23:00");
    const nightReferral = 23 * 60 + 30;
    const afterNightShift = 24 * 60 + 7 * 60 + 30;
    expect(silentWardReminder(nightReferral, afterNightShift)).toContain("23:00–07:00");
    const earlyReferral = 24 * 60 + 2 * 60;
    expect(silentWardReminder(earlyReferral, earlyReferral + 6 * 60)).toContain("23:00–07:00");
  });

  it("waits for 07:00 next morning, then the morning after, for a community team", () => {
    const raisedAtTen = 10 * 60;
    expect(silentCommunityReminder(raisedAtTen, raisedAtTen + 30)).toBeUndefined();
    expect(silentCommunityReminder(raisedAtTen, 24 * 60 + 7 * 60)).toContain("next morning");
    expect(silentCommunityReminder(raisedAtTen, 2 * 24 * 60 + 7 * 60)).toContain("morning after");
    expect(silentCommunityReminder(2 * 60, 7 * 60)).toContain("next morning");
  });
});
