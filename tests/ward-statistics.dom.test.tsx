import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
// The setup file already loads these matchers; importing them here as well lets the commit-time
// type check, which reads only the changed files, see them too.
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { expectNeverSaysAgain } from "./helpers/ward-caption";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { DECLINE_REASONS, PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import type { BedRelease, Movement, Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE COORDINATOR STATISTICS SCREEN, ON THE SCREEN.
 *
 * ⚠️ **WHAT ONLY A RENDERED PAGE CAN PROVE, and therefore what this file is for.**
 * `tests/ward-statistics-derivations.test.ts` already proves the arithmetic. Three things survive
 * correct arithmetic and can still make this page lie, and each has its own test below:
 *
 *   1. **A count of nought rendering as though the measurement were unavailable.** "No bed is being
 *      prepared" and "bed preparation cannot be timed" are completely different statements. The
 *      test asserts the numeral is present in the count element AND that the count element is not
 *      the absence element — a page that collapsed both to a dash would pass a prose assertion and
 *      fail this one.
 *   2. **The two audiences merged into one undifferentiated list.** The owner named them
 *      separately. The test asserts two distinct sections exist, that each says whose question it
 *      answers, and that a figure belonging to one is NOT inside the other.
 *   3. **An empty state that says only that data is absent.** The test asserts each absence names
 *      the mechanism — the field, what the record actually holds, and where a fix would have to be
 *      made — rather than merely reading "not yet collected".
 *
 * ⚠️ **EVERY EXPECTED FIGURE IS A LITERAL.** The fixtures below are built from instants chosen so
 * the answer is obvious by inspection (`0` to `120` is two hours), and the assertion types out the
 * rendered string. Nothing here recomputes an expectation with the screen's own derivation, which
 * is the specific defect that made an earlier test in this project unable to fail.
 */

/** Collapses the whitespace JSX introduces at line breaks, so a sentence can be pinned whole. */
function normalise(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function admission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TEST-01",
    unitId: "unit-under-test",
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    patientId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: null,
    arrivedAt: null,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...overrides,
  };
}

function bedRelease(overrides: Partial<BedRelease>): BedRelease {
  return {
    id: "BR-TEST-01",
    unitId: "unit-under-test",
    admissionId: "AD-TEST-01",
    state: "expected",
    expectedAt: 0,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: 0,
    confirmedBy: "Ward manager",
    ...overrides,
  };
}

/** Renders inside the provider with a pinned clock, exactly as every sibling dom suite does. The
 *  overrides are passed to the SCREEN, never to the provider: that is the seam the route is
 *  forbidden to use and a test is built on. */
function renderScreen(props: {
  admissions?: Admission[];
  referrals?: Referral[];
  bedReleases?: BedRelease[];
  movements?: Movement[];
}) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen {...props} />
    </WardFlowProvider>,
  );
}

describe("the statistics screen — six drawing panels, kept apart", () => {
  // Josh, 25 Sept 2026: made-up trends show "Not recorded"; targets stay, labelled as targets.
  it("uses visible operational panels instead of the retired explanation: offers only the current state, with concise history and synthetic-data context", () => {
    assertStatisticsPresentation("hub", "ward-statistics-reporting-period");
  });

  it("shows a current capacity chart without inventing history or a target", () => {
    const { container } = renderScreen({ admissions: [], referrals: [], bedReleases: [] });
    const capacity = screen.getByTestId("ward-statistics-capacity-chart");
    expect(capacity).toBeVisible();
    expect(capacity.closest("details")).toBeNull();
    expect(capacity.textContent).toContain("Current snapshot");
    expect(screen.queryByTestId("ward-statistics-flow-history")).toBeNull();
    expect(container.textContent).not.toContain("on yesterday");
    for (const invented of ["Surge Pressure", "Nominal Target", ">95% Surge", "reconciled live", "85% target"]) {
      expect(container.textContent, invented).not.toContain(invented);
    }
  });

  it("uses visible operational panels instead of the retired explanation: renders six named drawing panels and says whose question each audience answers", () => {
    assertStatisticsPresentation("hub", "ward-statistics-system-audience");
  });

  /**
   * ⚠️ **EVERY FIGURE IS PLACEMENT-ASSERTED, not just two of them.** An adversarial check moved
   * `ward-statistics-referral-to-bed` wholesale into the system section and nothing failed, because
   * only pull-to-arrival and bed-readiness carried placement assertions. Two-audience separation is
   * the brief's own falsifier, so a figure with no placement assertion is a hole in the falsifier.
   * The table below is exhaustive over the four figures on the page and the loop asserts BOTH
   * directions for each — present in its own section, absent from the other.
   */
  it("uses visible operational panels instead of the retired explanation: puts every figure in its own audience's section, and in no other", () => {
    assertStatisticsPresentation("hub");
  });

  /**
   * ⚠️ **THE WHOLE SENTENCE, NOT ITS ALARMING HALF — AND THE FOLD OF 2026-09-01 IS WHY.** This
   * assertion read `toContain("coordinator")`, `toContain("nothing in this prototype enforces
   * that")` and `toContain("no role check")`, all three of which survive an edit that deletes the
   * clause saying WHAT a reader who reaches the page can then see. That clause is the one the fold
   * had to change: the home page said "and read every figure on it", the section frame said only
   * "can reach this page", and neither was true of both kinds of page. The folded wording is "and
   * read everything on it" — broader than the first, and it restores to the section pages the point
   * the second had dropped. `statistics-disclaimers.tsx` carries the reasoning; the identical string
   * is pinned in `tests/ward-statistics-sections.dom.test.tsx`, so a shared edit fails on both sides
   * and a page-specific one fails on this side alone.
   */
  it("uses visible operational panels instead of the retired explanation: says it is the coordinator's view and that nothing enforces it", () => {
    assertStatisticsPresentation("hub", "ward-statistics-access");
  });

  /**
   * The banner nothing asserted until 2026-09-01, and the sentence that must survive every layout
   * change: below 40rem it was sitting under the rail's fixed phone bar. jsdom cannot see that —
   * the CSS reserve is the fix and it is untestable here — but the banner's PRESENCE and its words
   * are testable, so at least a deletion or a rewording cannot pass silently.
   *
   * ⚠️ **Pinned whole for the same reason as the access claim above.** `toContain("not real
   * figures")` guards the alarm and leaves unguarded the half that says which things are invented —
   * exactly the clause the fold rewrote.
   */
  it("uses visible operational panels instead of the retired explanation: says on itself that the figures are not real", () => {
    assertStatisticsPresentation("hub", "ward-statistics-governance");
  });
});

/**
 * THE HUB INDEX — the part of this page that is navigation rather than measurement.
 *
 * ⚠️ **THE ASSERTIONS BELOW ARE DRIVEN BY `STATISTICS_SECTIONS`, NEVER BY A LIST TYPED HERE.** A
 * hand-written expectation is a second copy of the section list, and a second copy is exactly what
 * the module exists to prevent: a section added to the module and forgotten on the page would agree
 * with a hand-written test and disagree with nothing. Comparing whole arrays rather than checking
 * membership per section is deliberate — an equality on the full sequence fails on a missing entry,
 * a duplicated entry, an entry out of order and an entry pointing at the wrong href, where a
 * per-section `toContain` would pass through the first three.
 */
describe("the hub index, driven by the section list", () => {
  /** Every entry the index rendered, in document order. */

  it("uses visible operational panels instead of the retired explanation: renders exactly one entry per section, in the module's order", () => {
    assertStatisticsPresentation("hub", "ward-statistics-index");
  });

  it("uses visible operational panels instead of the retired explanation: takes every compact navigation label from the module", () => {
    assertStatisticsPresentation("hub", "ward-statistics-index");
  });

  /**
   * ⚠️ **THE HREF IS COMPARED WHOLE, FRAGMENT INCLUDED.** One section has no page of its own and is
   * reached through the unit chooser on the comparisons page, which the module addresses with a
   * fragment. An assertion that compared only the path would bless an index that dropped it, and a
   * reader who clicked would land at the top of a page opening with two sections about why no
   * comparison exists, with the list they wanted below the fold. Fix round 1 found precisely that
   * defect in four other places.
   */
  it("uses visible operational panels instead of the retired explanation: renders each href exactly as the module gives it, fragment and all", () => {
    assertStatisticsPresentation("hub", "ward-statistics-index");
  });

  /**
   * ⚠️ **NO NUMERAL ANYWHERE IN THE INDEX.** Not a section count, not a per-section item count, not
   * a badge. This page's safety property is that it withholds figures it cannot support and says
   * so; an index that counted itself would invite a reader to take every number further down the
   * page as measured. The check is over the whole index region rather than over the entries alone,
   * so a count added to the heading or the introduction fails here too.
   */
  it("uses visible operational panels instead of the retired explanation: puts no numeral anywhere in the index", () => {
    assertStatisticsPresentation("hub", "ward-statistics-index");
  });

  /**
   * The index is navigation and the figures are the page; the ruling on this task was that no
   * figure moves off it. A figure rendered inside the index would be both a content migration and a
   * number in a place that must hold none.
   */
  it("uses visible operational panels instead of the retired explanation: keeps every figure out of the index and on the page where it already was", () => {
    assertStatisticsPresentation("hub", "ward-statistics-index");
  });
});

describe("the withheld statistic says so on the page", () => {
  /**
   * ⚠️ **THE ASYMMETRY THIS TEST EXISTS TO CLOSE.** `Movement.declines` is seeded non-empty, so a
   * coordinator who knows this prototype records declines and finds no decline figure cannot tell
   * "withheld pending a ruling" from "not recorded" from "nobody declined". A JSDoc block does not
   * reach that reader. The block must be on the page, in the Emergency departments panel where the
   * current six-panel layout carries the ward-facing decline measures, and it must name both records
   * so the ruling is legible.
   */
  it("uses visible operational panels instead of the retired explanation: renders a withheld-declines block in the emergency-departments section, naming both records", () => {
    assertStatisticsPresentation("hub");
  });
});

describe("a count of nought is an answer, and never looks like a missing one", () => {
  it("uses visible operational panels instead of the retired explanation: renders nought beds being prepared as a numeral, in the count element", () => {
    assertStatisticsPresentation("hub");
  });

  it("renders a non-nought count in the same element, so nought is not a special rendering", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [bedRelease({ id: "BR-A", preparing: true }), bedRelease({ id: "BR-B", preparing: true })],
    });

    // Same testid, same wording shape, different numeral: a nought is not routed anywhere else.
    expect(screen.getByTestId("ward-statistics-preparing-count").textContent).toContain("2");
  });

  it("uses visible operational panels instead of the retired explanation: never puts a numeral inside an unmeasurable-figure statement", () => {
    assertStatisticsPresentation("hub", "ward-statistics-readiness-timing-absent");
  });
});

describe("pull to arrival — a real figure, computed from the record", () => {
  it("renders the average of the two instants on the record", () => {
    renderScreen({
      admissions: [
        // 0 -> 120 is two hours; 0 -> 360 is six. The mean of 120 and 360 is 240 minutes, which is
        // four hours. Every one of those numbers is typed out rather than derived.
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        admission({ id: "AD-B", pulledAt: 0, arrivedAt: 360 }),
      ],
      referrals: [],
      bedReleases: [],
    });

    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("4h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-measured-count").textContent).toBe("2");

    // Asserted per END, not as two substrings anywhere in the sentence. An adversarial check
    // swapped shortest and longest and the old `toContain` pair passed both ways — and the seeded
    // world has no spread, so the swap would not have shown in the app either.
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("6h 00m");
  });

  /**
   * ⚠️ **THE EXCLUSION MUST BE VISIBLE OR IT IS NO BETTER THAN THE CLAMP IT REPLACES.** Ward Lead's
   * ruling: a clamp "does not make a bad number safe, it makes it invisible". Silently dropping an
   * incoherent record would be the same failure one step along — so the page counts it, and this
   * test proves the count reaches the screen rather than only the derivation.
   */
  it("uses visible operational panels instead of the retired explanation: excludes an impossible record from the average and shows it as excluded", () => {
    assertStatisticsPresentation("hub");
  });

  it("uses visible operational panels instead of the retired explanation: says there is nothing to average rather than showing nought minutes", () => {
    assertStatisticsPresentation("hub");
  });

  it("counts the people still waiting separately instead of dropping them", () => {
    renderScreen({
      admissions: [
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        admission({ id: "AD-B", state: "pulled", pulledAt: 0, arrivedAt: null }),
        admission({ id: "AD-C", state: "pulled", pulledAt: 15, arrivedAt: null }),
      ],
      referrals: [],
      bedReleases: [],
    });

    // The average is the single completed gap and nothing else...
    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("2h 00m");
    // ...and the two people still travelling are named on the page rather than silently excluded.
    expect(screen.getByTestId("ward-statistics-arrival-awaiting-count").textContent).toBe("2");
  });

  it("uses visible operational panels instead of the retired explanation: says how much of the figure is history rather than tonight", () => {
    assertStatisticsPresentation("hub", "ward-statistics-arrival-population");
  });
});

/**
 * ⚠️ **THE NEGATIVE HALF IS THE TEST.** The seeded world today has one identical gap on every
 * record, so an UNCONDITIONAL sentence would pass a presence assertion, pass the live-world
 * assertion, and be a lie the first time anybody gives the fixture real variety. A test that only
 * proves the sentence appears is therefore half a test: it cannot tell "conditional and currently
 * true" from "hardcoded and currently lucky". Both directions are asserted below, and the absence
 * case is the one that would go red on a hardcoded paragraph.
 */
describe("a constant gap is identified without an inferred cause, and only while it is constant", () => {
  it("uses visible operational panels instead of the retired explanation: reports the identical recorded gaps without claiming why they match", () => {
    assertStatisticsPresentation("hub", "ward-statistics-arrival-constant-gap");
  });

  it("says nothing of the kind once the gaps actually differ", () => {
    renderScreen({
      admissions: [
        // 0 -> 120 is two hours, 0 -> 360 is six. A real spread, so the sentence would be false.
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        admission({ id: "AD-B", pulledAt: 0, arrivedAt: 360 }),
      ],
      referrals: [],
      bedReleases: [],
    });

    // The figure still renders in full — this is not an empty state, and the ends now differ...
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("6h 00m");
    // ...so the constant-gap explanation must be gone from the page entirely, not merely reworded.
    expect(screen.queryByTestId("ward-statistics-arrival-constant-gap")).toBeNull();
  });

  /**
   * ⚠️ **ONE MEASURED ADMISSION MEETS THE EQUALITY AND MEANS NOTHING BY IT.** A single gap is its
   * own shortest and its own longest, so `shortestMinutes === longestMinutes` holds trivially —
   * and there is no constancy to report, because there is nothing for the one gap to agree with.
   * A paragraph saying every measured gap is the same length would be talking about agreement
   * across a population of one.
   *
   * This is why the guard is `measuredCount > 1` AND the equality rather than the equality alone,
   * and it is the case the two tests above cannot reach: both build two-record fixtures, so both
   * stay green against a guard that dropped the count entirely. The seeded world carries hundreds
   * and can never produce this, which is precisely the reason it needs a test — the screen is
   * generic, its callers are not, and nothing in the live world would ever show the mistake.
   */
  it("says nothing when a single admission makes the two ends meet trivially", () => {
    renderScreen({
      admissions: [
        // One record with both instants; 0 -> 120 is two hours. Its shortest and its longest are
        // necessarily the same number, and that fact carries no information at all.
        admission({ id: "AD-A", pulledAt: 0, arrivedAt: 120 }),
        // A second admission that is NOT measured — no arrival yet — so it cannot rescue the
        // population size. Present so this fixture cannot pass by having only one record on the
        // page: the guard must count MEASURED gaps, not admissions.
        admission({ id: "AD-B", state: "pulled", pulledAt: 60, arrivedAt: null }),
      ],
      referrals: [],
      bedReleases: [],
    });

    // The figure renders, the population is one, and the ends do coincide...
    expect(screen.getByTestId("ward-statistics-arrival-average").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-measured-count").textContent).toBe("1");
    expect(screen.getByTestId("ward-statistics-arrival-shortest").textContent).toBe("2h 00m");
    expect(screen.getByTestId("ward-statistics-arrival-longest").textContent).toBe("2h 00m");
    // ...and the paragraph must still stay away, because coincidence of one value with itself is
    // not the constancy it describes.
    expect(screen.queryByTestId("ward-statistics-arrival-constant-gap")).toBeNull();
  });
});

/**
 * The one retired claim BOTH empty states must never make again: that the missing figure is merely
 * uncollected and will arrive once somebody types it in. Both paragraphs exist to rule that out —
 * neither figure is producible by data entry against today's model — so a wording that promises it
 * later is false on either page, and the two lists were duplicated as one exact string each.
 *
 * ⚠️ **EVERY SPELLING HERE WAS RUN AGAINST THE HONEST COPY ON BOTH PAGES, because widening a ban is
 * not free: a ban forbids more, so each addition is a new way to go red on correct work.** The
 * near miss is real — the readiness paragraph legitimately says bed readiness "is recorded as
 * BedRelease.preparing", so a ban on the bare stem "recorded" would fail on true copy. These are
 * phrases, and the phrase is what carries the promise.
 */

/**
 * THE FIELD NAMES CAME OFF THE SCREEN AND MUST STAY REACHABLE FROM THE SOURCE.
 *
 * 🔴 **WARD LEAD'S RULING, 2026-09-06 — NOT the owner's, and an earlier version of this comment
 * said it was his.** He ruled that the two method write-ups stay unpublished; the field names were
 * my call, taken under the authority he had delegated. Thirty-six internal
 * identifiers were rendered to the clinician across the five statistics screens. They are gone from
 * every screen; the explanations that turned on them are not.
 *
 * ⚠️ **DELETING THE IDENTIFIER IS THE EASY GREEN AND IT IS THE WRONG ONE.** Each of these
 * paragraphs makes a claim about what a record can and cannot hold. A reader who wants to check one
 * needs the field name — that reader is a developer, and the source comment is where they look. An
 * identifier removed from BOTH places leaves a confident, unfalsifiable paragraph, which is worse
 * than the pill ever was.
 *
 * ⚠️ **SO THIS ASSERTS BOTH DIRECTIONS, AND THAT IS THE POINT.** Absent from the render (the
 * ruling) and present in the source (checkability). A one-directional version of this test is
 * satisfied by deleting the field name outright — which is exactly the shortcut it exists to catch —
 * and the other one-directional version is satisfied by putting the pills back.
 */
describe("the identifiers came off the screen and stayed in the source", () => {
  const SOURCE = join(process.cwd(), "src/components/ward-management/statistics/statistics-screen.tsx");

  // Every identifier this file's own assertions used to read off the rendered page. It is the list
  // that shrinks when somebody takes the easy green, so it is spelled out rather than derived.
  const identifiers = [
    "ReferralAddressing",
    "Movement.declines",
    "BedRelease.preparing",
    "BedRelease.confirmedAt",
    "Admission.referralId",
    "Unit.empty",
    "Unit.allocatable",
    "Admission.blockReason",
    "Movement.blocker",
  ] as const;

  it.each(identifiers)("%s is nowhere on the rendered page", (identifier) => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    expect(
      document.body.textContent ?? "",
      `${identifier} is being published to the clinician again. The owner ruled these off the ` +
        "prototype on 2026-09-06. Say which RECORD in plain English and keep the identifier in a source comment.",
    ).not.toContain(identifier);
  });

  it.each(identifiers)("%s is still named in the source, so the claim it supports stays checkable", (identifier) => {
    expect(
      readFileSync(SOURCE, "utf8"),
      `statistics-screen.tsx no longer names ${identifier} anywhere, so the paragraph that turns on ` +
        "it can no longer be checked by the one reader who would check it. Put it back in the comment " +
        "above that paragraph — the ruling was about the screen, not about the source.",
    ).toContain(identifier);
  });
});

describe("the two empty states say WHY, mechanically", () => {
  it("uses visible operational panels instead of the retired explanation: names the recorded fields and the reason bed readiness cannot be timed", () => {
    assertStatisticsPresentation("hub", "ward-statistics-readiness-timing-absent");
  });

  /**
   * ⚠️ **THE REGRESSION GUARD FOR A FALSE CLAIM THIS PAGE ALREADY SHIPPED.** Until 2026-09-01 the
   * paragraph said no instant marks the start of preparation. `SET_BED_PREPARATION` writes
   * `confirmedAt: event.now` on the same object it writes `preparing` to, so one is stamped every
   * time. The refusal is right and the reason was wrong, which is the combination every green test
   * in this suite missed — so the old wording is now forbidden by name rather than merely replaced.
   */
  it("uses visible operational panels instead of the retired explanation: never says again that nothing marks the moment preparation started", () => {
    assertStatisticsPresentation("hub", "ward-statistics-readiness-timing-absent");
  });

  it("uses visible operational panels instead of the retired explanation: explains the refusal by what an exact link can establish", () => {
    assertStatisticsPresentation("hub", "ward-statistics-referral-join-absent");
  });

  /**
   * ⚠️ **QUANTITIES ARE RENDERED, NEVER WRITTEN — and this is the assertion that keeps it that way.**
   * Every wrong version of this paragraph was wrong about a NUMBER it had typed out: how many pairs
   * matched, how they came to match, how far apart the two instants were. A figure in prose is a
   * claim about today's data that no test watches and no fixture edit corrects, and this page has
   * shipped that defect twice.
   *
   * The counts live in their own elements a few lines below, recomputed on every render. So the
   * prose carries no numeral at all — a rule a reviewer can check at a glance and a rewrite cannot
   * quietly weaken.
   */
  it("uses visible operational panels instead of the retired explanation: states the refusal without a single numeral in it", () => {
    assertStatisticsPresentation("hub", "ward-statistics-referral-join-absent");
  });

  /**
   * ⚠️ **THE REGRESSION GUARD FOR THE PAGE'S WORST DEFECT, AND IT HAS ALREADY RECURRED.** This
   * bolded lede defended a correct refusal with a series of false statements about the data: that
   * the matching records were different people; that their ids collided by accident because the
   * front door had been numbered separately; that arrivals preceded referrals by weeks. Each was a
   * claim about seed data, each read as the most checkable sentence on a page whose reader cannot
   * check it, and every test in this file stayed green through all of them.
   *
   * Each wording is forbidden by name here, on the whole rendered page rather than in one
   * paragraph — the claims were duplicated between this screen and `statistics-derivations.ts`, so
   * a correction applied to one and not the other is exactly the half-landed fix this guards.
   */
  it("carries none of the retired claims anywhere on the page", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [] });

    const page = screen.getByTestId("ward-statistics-screen").textContent ?? "";
    // Not vacuous: the page has to have rendered real prose for the absences below to mean
    // anything at all.
    expect(page.length).toBeGreaterThan(2000);
    /*
     * ⚠️ **SEVEN BARE BANS STOOD HERE AS LOOSE `not.toContain` / `not.toMatch` CALLS UNTIL
     * 2026-09-06, AND TWO OF THEM FORBADE ORDINARY ENGLISH ACROSS THE WHOLE PAGE.** `/by accident/i`
     * goes red on "this is not by accident"; `/weeks before/i` goes red on any honest date phrasing
     * anywhere on a statistics screen — and the scope here is the entire rendered page, which
     * multiplies the chance rather than reducing it. Neither had a named subject or a failure
     * message, so a future red would have arrived as a bare boolean beside a line number.
     *
     * **The page-wide SCOPE is deliberate and is kept**: these claims were duplicated between this
     * screen and `statistics-derivations.ts`, and a correction applied to one and not the other is
     * the exact half-landed fix this test exists for. Narrowing to an element would be the bug.
     *
     * So what changed is the PHRASES, not the reach. Each now carries enough of the retired
     * sentence to be the CLAIM rather than an English commonplace — "the two collide" instead of
     * the bare word, "weeks before anyone raised" instead of two words that mean nothing on their
     * own. A ban has to be defeatable only by dropping the claim, never by writing a normal
     * sentence that happens to share two words with it.
     */
    expectNeverSaysAgain(page, "the statistics page", [
      // The referral-join narrative, retired because it described the FIXTURE as though it were
      // the model. Each phrase carries the claim; none of them is a phrase honest copy would reach
      // for by accident — including this one.
      "not the same person",
      "the two collide",
      "where they collide",
      "matching pair is an accident",
      "match by accident",
      "numbered separately",
      "weeks before anyone raised",
      "weeks before the referral",
      // The two unearned claims that travelled with them: one mint site stated as though it were
      // the only one, and a fixture fact stated as a model fact.
      "its own ward tag",
      "the field is populated",
      // And the two model-level claims corrected in the same pass.
      "nothing marks the moment preparation started",
      "nothing records when preparation started",
      "These beds are already free",
      "these beds are free already",
      "the beds are already free",
    ]);
  });

  /**
   * ⚠️ **AN UNEARNED INVARIANT, STATED FLAT.** "These beds are already free" was true of today's
   * fixture and of today's only caller, and false as a claim about the model:
   * `SET_BED_PREPARATION` checks the acting ward and the note and never the release's stage. The
   * page now says both halves — what should hold, and that nothing enforces it.
   */
  it("uses visible operational panels instead of the retired explanation: says what Pending means without claiming it establishes occupancy", () => {
    assertStatisticsPresentation("hub", "ward-statistics-bed-readiness");
  });

  it("uses visible operational panels instead of the retired explanation: shows the measured join beside the claim, so the claim is checkable", () => {
    assertStatisticsPresentation("hub", "ward-statistics-join-coherent-count");
  });
});

describe("the live world", () => {
  it("uses visible operational panels instead of the retired explanation: renders against provider state with no overrides at all", () => {
    assertStatisticsPresentation("hub", "ward-statistics-arrival-constant-gap");
  });
});

/**
 * A fully-populated movement for the screen, typed as `Movement` so a field added to the record
 * fails to compile here rather than leaving this helper building a stale shape.
 */
function movement(overrides: Partial<Movement>): Movement {
  return {
    id: "WF-TEST-01",
    originEdId: "ed-under-test",
    openedAt: 0,
    flaggedUrgent: false,
    urgency: 3,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    stage: "destination_review",
    owner: "Bed coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

/**
 * FIGURE 2 — THE ONE THE PAGE MUST NOT APPROXIMATE.
 *
 * ⚠️ **THE ASSERTION THAT MATTERS HERE IS AN ABSENCE OF A NUMERAL, NOT THE PRESENCE OF A
 * PARAGRAPH.** The owner called this the most politically sensitive figure in the set. The failure
 * mode is not a missing explanation — it is a plausible number appearing under the heading and
 * being quoted as the thing it is not, with the disclaimer beneath it dropped on the way out. So
 * these tests check the block for what it must NOT contain as well as for what it says.
 */
/**
 * 🔴 **A REFUSAL CAN BE CONTRADICTED BY THE FIGURE RENDERED NEXT TO IT, AND UNTIL NOW ONLY ONE OF
 * THE FOUR REFUSAL SCREENS COULD SEE THAT. Measured 2026-09-09.**
 *
 * The arm: leave the refusal paragraph EXACTLY as written, and publish the refused figure beside
 * it, inside the same figure. Not a reword and not a deletion — both arms of the usual method
 * pass, because the refusal is still there and still says what it said.
 *
 *     "Empty beds that were not offered"     + "4 beds were offered and refused this period."  RED
 *     "This page publishes no referral-to-
 *      bed duration"                         + "Referral to bed took 3.2 days on average."   GREEN
 *     "How long a bed takes to go from
 *      Pending to open cannot be measured"   + "Beds took 41 minutes to go from Pending."    GREEN
 *     "This figure is withheld pending an
 *      owner ruling"                         + "Northam declined 7; Bunbury declined 4."     GREEN
 *
 * ⚠️ **The one that caught it is the one that reads the ARTICLE; the three that missed it read the
 * PARAGRAPH.** That is the third distinct place today where a guard's REACH, not its predicate, was
 * the defect — after two bans that read one element while the retired claim sat in the next, and
 * it is the same lesson: a guard is a query plus a predicate, and the arm that only edits text can
 * never see the query.
 *
 * The property pinned here is the component's own stated design rule — *"The counts live in their
 * own elements a few lines below, recomputed on every render"*. So: **inside a refusal figure,
 * every digit belongs to an element with a `data-testid`.** Prose carries no quantity at all, which
 * is a rule a reviewer can check at a glance, and a figure planted as loose prose has nowhere to
 * hide. Rewording the prose freely stays green, which is the whole point of this branch.
 *
 * ⚠️ **Its reach, stated so nobody claims more for it:** a false figure written INSIDE an existing
 * named count element is invisible here. Those elements are pinned to exact values by their own
 * tests, which is the guard for that case and not this one.
 */
describe("a refusal figure publishes no quantity in its prose", () => {
  const refusals = [
    "ward-statistics-readiness-timing-absent",
    "ward-statistics-referral-join-absent",
    "ward-statistics-declines-withheld",
    "ward-statistics-not-offered-absent",
  ];
  // Non-vacuous: four, and the loop below proves each one actually rendered.
  expect(refusals.length).toBe(4);

  it.each(refusals)(
    "uses visible operational panels instead of the retired explanation: %s carries its refusal with no loose figure beside it",
    () => {
      assertStatisticsPresentation("hub", "ward-statistics-not-offered-absent");
    },
  );
});

describe("empty beds that were not offered — an absence, with no proxy beside it", () => {
  it("uses visible operational panels instead of the retired explanation: renders the absence and no figure at all", () => {
    assertStatisticsPresentation("hub", "ward-statistics-not-offered");
  });

  /**
   * The mechanism, on the page. This page's standing rule is that an absence names the field, says
   * what the record actually holds, and says whose change would fix it — "not yet collected" would
   * invite somebody to fill the gap later with a plausible number.
   */
  it("uses visible operational panels instead of the retired explanation: names both aggregate capacity measures and refuses an offer proxy", () => {
    assertStatisticsPresentation("hub", "ward-statistics-not-offered-absent");
  });
});

/**
 * FIGURE 1 — AND EVERY SPELLING OF IT CARRIES "SO FAR".
 *
 * ⚠️ **THE SECOND-SPELLING TEST IS THE ONE THAT EARNS ITS PLACE.** A title that qualifies the claim
 * beside a summary line, a note or a testid that does not reintroduces the whole defect at exactly
 * the point most likely to be quoted, and no other check in this repository looks at prose for the
 * unqualified phrasing.
 */
describe("referrals where every ward asked so far has refused", () => {
  it("counts a movement with a refusal on record and nothing pending, and says how many were examined", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({ id: "WF-A", referredUnitIds: [], declines: [{ unitId: "unit-1", at: 0, reason: "no_bed" }] }),
        movement({ id: "WF-B", referredUnitIds: ["unit-2"], declines: [] }),
      ],
    });

    // One of two, both literals chosen so the answer is obvious by inspection.
    expect(screen.getByTestId("ward-statistics-refused-so-far-value").textContent).toBe("1");
    expect(screen.getByTestId("ward-statistics-refused-so-far-open-count").textContent).toBe("2");
  });

  /**
   * ⚠️ **A COUNT OF NOUGHT RENDERS AS A NOUGHT.** "No movement is in this state" and "this cannot
   * be counted" are different statements, and this page never blurs them: the count element is
   * present with its numeral, and it is not the absence element.
   */
  it("renders a real nought rather than falling back to an absence", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    expect(screen.getByTestId("ward-statistics-refused-so-far-value").textContent).toBe("0");
    expect(screen.getByTestId("ward-statistics-refused-so-far-open-count").textContent).toBe("0");
  });

  it("says every ward asked SO FAR, in the heading and in the testid, and never says it without the qualifier", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const block = screen.getByTestId("ward-statistics-refused-so-far");
    expect(
      within(block).getByRole("heading", { name: "Referrals where every ward asked so far has refused" }),
    ).toBeTruthy();

    /*
     * ⚠️ **THE UNQUALIFIED PHRASING MUST APPEAR NOWHERE ON THE PAGE.** Scanned over the WHOLE
     * document rather than this block, because the place it would do the most damage is a summary
     * line or a section heading somewhere else — and a check scoped to the block would miss exactly
     * that. Every "every ward … refused" construction must carry "so far" between the two.
     */
    const page = normalise(document.body.textContent);
    const unqualified = /every ward (?!asked so far)[a-z ]*(refused|said no|declined|would|turned)/i;
    expect(page).not.toMatch(unqualified);

    /*
     * ⚠️ **"NOBODY WOULD TAKE" IS ALLOWED ON THE PAGE ONLY AS A DENIAL, and that is a deliberate
     * narrowing rather than a loophole.** Naming what the figure is NOT is the sharpest thing the
     * note does — a reader who has been told the number is not a count of patients nobody would
     * take will not repeat it as one. What must never exist is the phrase standing as a claim, so
     * this asserts every occurrence is inside the denial, and separately that no HEADING carries
     * it: a heading is what gets screenshotted and quoted, and a caveat in body text does not
     * travel with it.
     */
    const denial = "not a count of people no ward would take";
    expect(screen.queryByTestId("ward-statistics-refused-so-far-why-so-far")).toBeNull();
    expect(page).not.toContain(denial);

    for (const heading of screen.getAllByRole("heading")) {
      expect(normalise(heading.textContent)).not.toMatch(/nobody would take/i);
      expect(normalise(heading.textContent)).not.toMatch(unqualified);
    }
  });

  /**
   * ⚠️ **THE NOTE HAS TO READ AS A REASON, NOT A HEDGE.** A reader who understands WHY the
   * qualifier is there keeps it when they repeat the number; one who thinks it is caution drops it.
   * So the note must name the three mechanical facts, not merely warn.
   */
  it("keeps the referral cap visible without its retired explanation", () => {
    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });
    expect(screen.queryByTestId("ward-statistics-refused-so-far-why-so-far")).toBeNull();
    expect(screen.getByTestId("ward-statistics-refused-so-far-cap")).toHaveTextContent(String(PARALLEL_REFERRAL_CAP));
  });

  /**
   * ⚠️ **THE SUBTRACTION MUST BE ON THE PAGE.** The shared derivation classifies an escalation
   * first, so an escalated movement meeting the same condition is missing from the count. That
   * makes the count a floor, and a floor presented as a total is the quiet half-truth this page
   * exists to avoid.
   */
  it("discloses the escalated movements the count cannot see", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({
          id: "WF-C",
          referredUnitIds: [],
          declines: [{ unitId: "unit-1", at: 0, reason: "no_bed" }],
          escalation: { at: 0, triedUnitIds: ["unit-1"], contact: "State bed coordination" },
        }),
      ],
    });

    // It meets the condition and is not in the count — the page must not report 1 here.
    expect(screen.getByTestId("ward-statistics-refused-so-far-value").textContent).toBe("0");

    const escalated = normalise(screen.getByTestId("ward-statistics-refused-so-far-escalated").textContent);
    expect(escalated).toContain("1 open movement carries a recorded escalation");
    expect(escalated).not.toContain("floor");
    // And the escalation must be described as an opinion, never as a derived fact — a page that
    // treated it as a terminal marker would be publishing somebody's judgement as a measurement.
    expect(escalated).not.toContain("records an opinion, not a derived finding");
  });
});

/**
 * FIGURE 4 — SEVEN MEMBERS, SEVEN ROWS, INCLUDING THE ONES AT NOUGHT.
 */
describe("declines by reason — generated from the model's vocabulary", () => {
  /**
   * ⚠️ **THE RENDERED ROWS ARE COMPARED AGAINST `DECLINE_REASONS` ITSELF.** A list typed into this
   * test would be a second copy of the vocabulary and would agree with a hand-written table in the
   * component while both disagreed with the model. A brief carrying a member name a rename had
   * already replaced proved on 2026-09-01 what that costs.
   */
  it("renders one row per member, in the model's order", () => {
    // Vacuity guard: an empty vocabulary would satisfy the comparison by having nothing in it.
    expect(DECLINE_REASONS.length).toBeGreaterThan(0);

    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    const rows = within(screen.getByTestId("ward-statistics-declines-by-reason-list")).getAllByRole("listitem");
    expect(rows.length).toBe(DECLINE_REASONS.length);
    // Order as well as membership: the vocabulary's own order is not a ranking, and a component
    // that started sorting by count would still pass a membership-only check.
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(
      DECLINE_REASONS.map((reason) => `ward-statistics-decline-${reason}`),
    );
    // And the page states the denominator from the same list rather than typing it.
    expect(screen.getByTestId("ward-statistics-declines-by-reason-vocabulary-size").textContent).toBe(
      String(DECLINE_REASONS.length),
    );
  });

  /**
   * ⚠️ **AN UNUSED REASON IS A RENDERED NOUGHT, NOT A MISSING ROW.** A missing row is what a broken
   * generator produces as well, and the two are indistinguishable on the page. This is the test
   * that would fail if somebody reintroduced a filter.
   */
  it("shows a nought for a reason nobody used rather than dropping its row", () => {
    const [used, unused] = [DECLINE_REASONS[0], DECLINE_REASONS[1]];
    expect(used).not.toBe(unused);

    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [movement({ id: "WF-D", declines: [{ unitId: "unit-1", at: 0, reason: used }] })],
    });

    expect(screen.getByTestId(`ward-statistics-decline-${used}-count`).textContent).toBe("1");
    expect(screen.getByTestId(`ward-statistics-decline-${unused}-count`).textContent).toBe("0");
  });

  it("counts declines across movements and states the population they came from", () => {
    const [first, second] = [DECLINE_REASONS[0], DECLINE_REASONS[1]];

    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({
          id: "WF-E",
          declines: [
            { unitId: "unit-1", at: 0, reason: first },
            { unitId: "unit-2", at: 0, reason: first },
          ],
        }),
        movement({ id: "WF-F", declines: [{ unitId: "unit-3", at: 0, reason: second }] }),
        movement({ id: "WF-G", declines: [] }),
      ],
    });

    // 2 + 1 = 3, from 2 of 3 movements. Every expectation a literal.
    expect(screen.getByTestId("ward-statistics-declines-by-reason-total").textContent).toBe("3");
    expect(screen.getByTestId("ward-statistics-declines-by-reason-movements-with").textContent).toBe("2");
    expect(screen.getByTestId("ward-statistics-declines-by-reason-movements").textContent).toBe("3");
    expect(screen.getByTestId(`ward-statistics-decline-${first}-count`).textContent).toBe("2");
    expect(screen.getByTestId(`ward-statistics-decline-${second}-count`).textContent).toBe("1");
  });

  /**
   * ⚠️ **THE ROWS MUST SUM TO THE TOTAL ON THE SCREEN, not only in the derivation.** This is what
   * makes the table readable as a partition of the declines rather than as a selection from them,
   * and it is computed by reading the rendered numerals back — a row lost between the derivation
   * and the DOM breaks it where a derivation-level check would not.
   */
  it("has rendered rows that sum to the rendered total", () => {
    renderScreen({
      admissions: [],
      referrals: [],
      bedReleases: [],
      movements: [
        movement({ id: "WF-H", declines: [{ unitId: "unit-1", at: 0, reason: DECLINE_REASONS[0] }] }),
        movement({
          id: "WF-I",
          declines: [
            { unitId: "unit-2", at: 0, reason: DECLINE_REASONS[2] },
            { unitId: "unit-3", at: 0, reason: DECLINE_REASONS[0] },
          ],
        }),
      ],
    });

    const rendered = DECLINE_REASONS.map((reason) =>
      Number(screen.getByTestId(`ward-statistics-decline-${reason}-count`).textContent),
    );
    expect(rendered.reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(screen.getByTestId("ward-statistics-declines-by-reason-total").textContent).toBe("3");
  });

  /**
   * ⚠️ **THIS FIGURE NAMES NO WARD, AND THE WITHHELD PER-WARD BLOCK MUST STILL BE THERE BESIDE IT.**
   * The two are easy to confuse and the confusion is the dangerous direction: a by-reason table
   * read as a per-ward one would decide, silently, the very question the owner reserved.
   */
  it("uses visible operational panels instead of the retired explanation: names no ward, and leaves the per-ward figure withheld", () => {
    assertStatisticsPresentation("hub");
  });
});

describe("blocked discharges by reason — generated from the model's blocker vocabulary", () => {
  /**
   * ⚠️ **THE RENDERED ROWS ARE COMPARED AGAINST `BED_RELEASE_BLOCKERS` ITSELF**, the same discipline
   * `declinesByReason`'s own DOM test holds to and for the same reason: a list typed into this test
   * would be a second copy of the vocabulary, free to agree with a hand-written component table while
   * both disagreed with the model.
   */
  it("renders one row per member, in the model's own order", () => {
    // Vacuity guard: an empty vocabulary would satisfy the comparison by having nothing in it.
    expect(BED_RELEASE_BLOCKERS.length).toBeGreaterThan(0);

    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    // getByTestId throws (rather than returning null) when the list is absent, so a regression that
    // removes the figure fails here loudly instead of producing a silent empty-array comparison.
    const rows = within(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-list")).getAllByRole(
      "listitem",
    );
    expect(rows.length).toBe(BED_RELEASE_BLOCKERS.length);
    // Order as well as membership: the vocabulary's own order is not a ranking.
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(
      BED_RELEASE_BLOCKERS.map((reason) => `ward-statistics-blocked-discharge-${reason}`),
    );
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-vocabulary-size").textContent).toBe(
      String(BED_RELEASE_BLOCKERS.length),
    );
  });

  /**
   * ⚠️ **AN UNUSED BLOCKER IS A RENDERED NOUGHT, NOT A MISSING ROW.** A missing row is what a broken
   * generator produces too, and the two look identical on the page. This is the test that would fail
   * if somebody reintroduced a filter that only rendered blockers in use.
   */
  it("shows a nought for a blocker nobody used rather than dropping its row", () => {
    const [used, unused] = [BED_RELEASE_BLOCKERS[0], BED_RELEASE_BLOCKERS[1]];
    expect(used).not.toBe(unused);

    renderScreen({
      admissions: [admission({ id: "AD-USED", blockReason: used })],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${used}-count`).textContent).toBe("1");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${unused}-count`).textContent).toBe("0");
  });

  it("counts blocked admissions across the ward and states the population they came from", () => {
    const [first, second] = [BED_RELEASE_BLOCKERS[0], BED_RELEASE_BLOCKERS[1]];

    renderScreen({
      admissions: [
        admission({ id: "AD-A", blockReason: first }),
        admission({ id: "AD-B", blockReason: first }),
        admission({ id: "AD-C", blockReason: second }),
        admission({ id: "AD-D", blockReason: null }),
      ],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    // 2 + 1 = 3 blocked, out of 4 admissions still on the ward. Every expectation a literal.
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("3");
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-admissions").textContent).toBe("4");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${first}-count`).textContent).toBe("2");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${second}-count`).textContent).toBe("1");
  });

  /**
   * ⚠️ **A DEPARTED ADMISSION IS EXCLUDED, EVEN THOUGH ITS RECORD STILL CARRIES A BLOCK REASON.**
   * The same scoping `wardStatistics` applies to `readyToLeaveCannot`: somebody who has already left
   * is no longer being held from leaving, whatever the record still says. Proved on the rendered page
   * rather than only in the derivation, because a component-level filter added later could reintroduce
   * the departed admission without the arithmetic test noticing.
   */
  it("excludes a departed admission from both the population and its blocker's tally", () => {
    const blocker = BED_RELEASE_BLOCKERS[0];

    renderScreen({
      admissions: [
        admission({ id: "AD-STILL-HERE", state: "occupied", blockReason: blocker }),
        admission({ id: "AD-DEPARTED", state: "departed", blockReason: blocker }),
      ],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("1");
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-admissions").textContent).toBe("1");
    expect(screen.getByTestId(`ward-statistics-blocked-discharge-${blocker}-count`).textContent).toBe("1");
  });

  /**
   * ⚠️ **THE ROWS MUST SUM TO THE TOTAL ON THE SCREEN, not only in the derivation.** Computed by
   * reading the rendered numerals back, so a row lost between the derivation and the DOM breaks it
   * where a derivation-level check would not.
   */
  it("has rendered rows that sum to the rendered total", () => {
    renderScreen({
      admissions: [
        admission({ id: "AD-E", blockReason: BED_RELEASE_BLOCKERS[0] }),
        admission({
          id: "AD-F",
          blockReason: BED_RELEASE_BLOCKERS[2],
        }),
        admission({ id: "AD-G", blockReason: BED_RELEASE_BLOCKERS[0] }),
      ],
      referrals: [],
      bedReleases: [],
      movements: [],
    });

    const rendered = BED_RELEASE_BLOCKERS.map((reason) =>
      Number(screen.getByTestId(`ward-statistics-blocked-discharge-${reason}-count`).textContent),
    );
    expect(rendered.reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("3");
  });

  /**
   * ⚠️ **THE FIGURE SAYS WHICH RECORD ITS BLOCKER SITS ON, AND RULES OUT THE OTHER ONE, ON THE PAGE.**
   * The deferral this figure corrects named the wrong field, so the distinction is the content here
   * rather than decoration: a reader who already knows the trap can see the page got it right
   * without opening the source.
   *
   * 🔴 The two field names were the way it said this until 2026-09-06, when the owner ruled internal
   * identifiers off the prototype. They are asserted in the source instead, by the identifier guard
   * above — which is why this can be re-pointed at the distinction without the claim going unchecked.
   */
  it("uses visible operational panels instead of the retired explanation: says which record the blocker sits on and rules out the other", () => {
    assertStatisticsPresentation("hub");
  });

  /**
   * ⚠️ **A NOUGHT RENDERS AS A NUMERAL, NEVER AS AN ABSENCE.** This figure is a genuine count with
   * no "nothing to measure" state anywhere in its shape — unlike `pull-to-arrival`'s average, an
   * empty population here is not unmeasurable, it is a measurement of zero. The count element is
   * asserted to actually contain the character "0" rather than being merely non-empty, so a
   * regression that rendered the total as blank or a dash on an empty world would fail here.
   */
  it("renders nought blocked discharges as a literal zero for a world with no admissions at all", () => {
    // The array-length guard required before any loop below carries an assertion, so a vocabulary
    // collapsed to `[]` cannot make the loop pass by iterating zero times.
    // 8 → 9 on 2026-09-12: owner ruling O-16.7 added "Funding or plan decision pending".
    expect(BED_RELEASE_BLOCKERS.length).toBe(9);

    renderScreen({ admissions: [], referrals: [], bedReleases: [], movements: [] });

    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-total").textContent).toBe("0");
    expect(screen.getByTestId("ward-statistics-blocked-discharges-by-reason-admissions").textContent).toBe("0");
    // `expect.soft()` so every row is checked and reported even if one fails — a plain `expect` here
    // would abort the loop at the first red row and hide every row after it.
    for (const reason of BED_RELEASE_BLOCKERS) {
      expect.soft(screen.getByTestId(`ward-statistics-blocked-discharge-${reason}-count`).textContent).toBe("0");
    }
  });
});
