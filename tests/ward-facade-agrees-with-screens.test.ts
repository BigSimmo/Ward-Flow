import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createContext, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

/**
 * 🔴 **THE FACADE AND THE SCREENS MUST NOT BE ABLE TO DISAGREE — THIS FILE IS THE ONLY THING THAT
 * MAKES THAT TRUE.**
 *
 * Sixteen screens are being rebuilt in four lanes that never see each other's code. A shared module
 * makes agreement POSSIBLE; only a test that renders the owning screen and reads its number back out
 * of the markup makes it CHECKED.
 *
 * ⚠️ **THE COMMONEST WAY THIS FILE GETS WRITTEN IS THE ONE WAY IT MUST NOT BE.** Comparing
 * `shellFigures(state).openMovements` against a second call to `wardNavCounts(state)` compares a
 * function to itself: it cannot fail, for any change, ever. Every expectation below is instead a
 * number PARSED OUT OF RENDERED HTML — the digit a coordinator would read on the page — so a screen
 * that starts computing its own figure goes red here rather than shipping a second answer.
 *
 * ⚠️ **AND AGREEMENT ON ONE FIXTURE PROVES ALMOST NOTHING.** Two derivations that are both wrong in
 * the same way agree perfectly, and a fixture where every figure happens to be 2 makes five wrong
 * readers look right. So every comparison runs over four states — the seeded night and three
 * mutations of it applied through the REAL reducer — and each mutation is itself asserted to have
 * moved at least one figure. **A mutation that moves nothing gives a green that means nothing**, so
 * that assertion is a floor rather than a nicety.
 *
 * ⚠️ **WHAT THIS FILE DELIBERATELY DOES NOT CLAIM.** Two of the five figures — the severe-delay count
 * and the task count — are not moved by any of the three mutations the build plan names. They are
 * still compared on all four states, which is worth having, but the mutation evidence covers three
 * figures and not five. Saying so here is the difference between a measured claim and a sentence
 * written wider than its measurement; the honest way to widen it is a fourth mutation that moves
 * them, not a rewording of this paragraph.
 *
 * ⚠️ **AND THE FIVE FIGURES ARE NOT FIVE INDEPENDENT CROSS-CHECKS TODAY — TRACED END TO END:**
 *
 *     bedsAvailable            Capacity reads `allocatable.value` (capacity-derivations.ts:290); the
 *                              facade reads `min(allocatable.value, empty.value)`
 *                              (ward-bed-availability.ts:180) — a GENUINELY INDEPENDENT
 *                              cross-derivation, the only one of the five.
 *     openMovements            movements.filter(isOpen) — the SAME EXPRESSION read on both sides.
 *     delaysNeedingAttention   delayGroups(...) filtered to SEVERE_CAUSES — the SAME EXPRESSION
 *                              read on both sides.
 *     referralsWaiting         referralState(referral) === "queued" — the SAME PREDICATE read on
 *                              both sides.
 *     tasks                    buildActionInbox(movements.filter(isOpen), now, units) — a
 *                              BYTE-IDENTICAL call on both sides.
 *
 * So `bedsAvailable` is the one figure this file cross-derives against a genuinely different
 * computation today; the other four read the same predicate the owning screen already reads,
 * through the rendered page rather than through a second call to the same function. **That is not
 * a defect in this file.** "Wrap the derivation the screen already uses" is what the facade is FOR
 * — authoring a second formula for a figure that already has one would be the exact drift this
 * module exists to stop. It does mean this file's job for those four is catching FUTURE
 * divergence: the day a screen starts computing its own number, or the facade's wrapped call drifts
 * from the one the screen calls. Read it as that, not as five independent proofs of agreement, when
 * the integration phase extends this file.
 *
 * ── HOW IT RENDERS ────────────────────────────────────────────────────────────────────────────────
 *
 * This is a `.test.ts`, so it collects under `vitest.config.mts`'s **node** project — no jsdom, no
 * DOM globals, and no JSX. `renderToStaticMarkup` renders the real component tree to an HTML string,
 * the "SSR-string component test" pattern `tests/ward-landmarks.test.ts` and
 * `tests/route-error-boundary.test.ts` already establish here, and every element is built with
 * `createElement`.
 *
 * `WardFlowProvider` accepts only `initialNow` — there is no way to hand it a mutated world — so the
 * provider MODULE is mocked and `useWardFlow` returns the state under test. **The reducer is not
 * mocked**: every mutated state below is produced by `wardFlowReducer` from the real seed, so what
 * the screens render is a world the application could actually reach.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  // The rail derives its role from the route, so a whole-module mock without a pathname makes
  // `usePathname` undefined and throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

const world = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  WardFlowProvider: ({ children }: { children: ReactNode }) => children,
  useWardFlow: () => world.current,
  // Screens read the ticking clock separately from the world snapshot; the mock world carries
  // `now` on the same object `useWardFlow` returns, so the clock hook reads it from there.
  useWardFlowClock: () => (world.current as { now: number } | null)?.now ?? 0,
  WardFlowContext: createContext(null),
}));

import { SHELL_FIGURE_IDS, shellFigures, type ShellFigureId } from "@/components/ward-management/shell/ward-facade";
import {
  communityStatisticsHref,
  communityTeamHref,
  digestHref,
  edHref,
  edStatisticsHref,
  handoverHref,
  movementHref,
  officerHref,
  onCallHref,
  patientHref,
  raiseReferralHref,
  dischargeHref,
  serviceStatisticsHref,
  settingsHref,
  signInHref,
  teamHref,
  unitHref,
  wardBoardHref,
  wardStatisticsHref,
} from "@/components/ward-management/shell/ward-facade";
import { demoDayZero } from "@/components/ward-management/ward-clock";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { referralState } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardChromeHeader } from "@/components/ward-management/ward-chrome-header";

// jsdom is already the installed test environment; use only its document API here.
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (markup: string) => { window: { document: Document } };
};
const REPO_ROOT = process.cwd();
const WARD_FLOW_ROUTES = path.join(REPO_ROOT, "src", "app", "mockups", "ward-flow");
const SHELL_DIR = path.join(REPO_ROOT, "src", "components", "ward-management", "shell");
const NOW = NOW_ANCHOR;

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FOUR WORLDS — the seeded night, and three mutations of it through the real reducer.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **EVERY MUTATION IS DERIVED FROM THE SEED, NEVER HARD-CODED, AND EVERY ONE ASSERTS IT WAS NOT
 * REFUSED.** The reducer answers an event it will not perform by returning the state with a
 * `Rejection` appended — same shape, same collections, a plausible world. A hard-coded id that the
 * fixture later renames would therefore produce a "mutation" that changed nothing and a suite that
 * still passed, which is the exact failure this file exists to refuse. So each helper below finds
 * its subject in the state it was handed, and `mutate` fails if the rejection list grew.
 */
function mutate(state: WardFlowState, event: Parameters<typeof wardFlowReducer>[1], what: string): WardFlowState {
  const next = wardFlowReducer(state, event);
  expect(
    next.rejections.length,
    `the reducer REFUSED "${what}" — ${next.rejections[next.rejections.length - 1]?.reason ?? "no reason recorded"}. ` +
      "A refused event returns a state that looks exactly like a successful one, so this mutation would " +
      "have proved nothing while passing.",
  ).toBe(state.rejections.length);
  return next;
}

/** One movement added: an emergency department raises a brand-new journey. */
function movementAdded(state: WardFlowState): WardFlowState {
  const edId = state.movements.map((movement) => movement.originEdId).find((id): id is string => id !== undefined);
  expect(edId, "no movement in the seed names an origin department, so no referral can be raised").toBeDefined();
  return mutate(
    state,
    {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: edId as string,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    },
    "raise a referral",
  );
}

/**
 * One bed released: a ward's occupant actually leaves, which is what completes a bed release now.
 *
 * CHANGED 25 September 2026: owner ruling made a bed release a named admission's discharge, and
 * `RELEASE_BED` was narrowed to match — it now REFUSES outright while the admission it names is
 * still `occupied` (`ward-flow-reducer.ts`'s `RELEASE_BED` case), because every release
 * `derivedBedReleases` can produce belongs to exactly one still-occupied admission
 * (`deriveForwardRelease` only derives one for `bedIsOccupied` admissions) — so `RELEASE_BED`
 * would refuse this mutation every time, on every fixture, forever. The event that actually
 * completes a release now is `RECORD_LEAVING`, which is what this mutation dispatches instead; the
 * property under test — "a ward statement frees a bed, and that changes what the shell shows" —
 * is unchanged.
 */
function bedReleased(state: WardFlowState): WardFlowState {
  const release = state.bedReleases.find((candidate) => {
    if (candidate.state === "discharged") return false;
    const admission = state.admissions.find((a) => a.id === candidate.admissionId);
    if (!admission || admission.state !== "occupied") return false;
    // An admission with no linked movement sidesteps `RECORD_LEAVING`'s in-transit refusal; the
    // destination below never trips the involuntary-discharge boundary, so a patient link is fine
    // (the seed links every person since D-14, so requiring none would find nobody).
    if (admission.movementId !== null) return false;
    return true;
  });
  expect(release, "no un-discharged bed release found on an admission free of any linked movement").toBeDefined();
  const admission = state.admissions.find((a) => a.id === release!.admissionId)!;
  return mutate(
    state,
    {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      // The one destination that never trips the involuntary-discharge boundary, so a patient-linked
      // admission is not refused for a reason unrelated to this mutation.
      leavingDestination: "transferred-to-another-psychiatric-ward",
    },
    "record a patient leaving so their bed release completes",
  );
}

/**
 * One referral declined — and it must be a referral with exactly ONE destination.
 *
 * ⚠️ `referralState` calls a referral `queued` until every destination has declined (FD-24: a decline
 * locks nobody out). Declining one of two destinations therefore leaves the referral queued and the
 * figure unmoved — a mutation that moves nothing, dressed as one that does.
 */
function referralDeclined(state: WardFlowState): WardFlowState {
  const referral = state.referrals.find(
    (candidate) => referralState(candidate) === "queued" && candidate.destinations.length === 1,
  );
  expect(
    referral,
    "no seeded referral is queued with a single destination, so no decline can settle one",
  ).toBeDefined();
  return mutate(
    state,
    {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral!.id,
      destinationKind: referral!.destinations[0].destination.kind,
      reason: "no_suitable_bed",
    },
    "decline a referral",
  );
}

const WORLDS = [
  { name: "the seeded night", build: (state: WardFlowState) => state, mutation: false },
  { name: "one movement added", build: movementAdded, mutation: true },
  { name: "one bed released", build: bedReleased, mutation: true },
  { name: "one referral declined", build: referralDeclined, mutation: true },
] as const;

function seed(): WardFlowState {
  return seedWardFlowStateAt(0);
}

/** The context shape `useWardFlow()` hands a screen, built from a reducer state. */
function contextFor(state: WardFlowState) {
  return {
    ...state,
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    rejections: state.rejections,
    bedReleases: state.bedReleases,
    leaveBeds: state.leaveBeds,
    refreshRequests: state.refreshRequests,
    inboxAcknowledgements: state.inboxAcknowledgements,
    inboxCompletions: state.inboxCompletions,
    patients: state.patients,
    admissions: state.admissions,
    now: NOW,
    dayZero: demoDayZero(new Date(2026, 8, 10)),
    scenario: state.scenario,
    dispatch: () => {},
    focusMovementId: undefined,
    setFocusMovementId: () => {},
  };
}

function markupOf(state: WardFlowState, component: () => ReactNode): string {
  world.current = contextFor(state);
  return renderToStaticMarkup(createElement(component));
}

function facadeFigures(state: WardFlowState) {
  return shellFigures({
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    bedReleases: state.bedReleases,
    leaveBeds: state.leaveBeds,
    now: NOW,
  });
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * ASSERTION 1 — each figure equals the number its owning screen renders.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * How each figure is read back off the page a coordinator would be looking at.
 *
 * ⚠️ **EVERY READER FAILS LOUDLY WHEN ITS LOCATOR IS ABSENT, AND NONE OF THEM RETURNS 0.** A missing
 * figure and a figure of nought are different statements — a reader that quietly returned 0 when its
 * pattern stopped matching would report perfect agreement on the day a screen stopped showing the
 * number at all.
 */
type ScreenReader = {
  readonly screen: string;
  readonly component: () => ReactNode;
  readonly read: (markup: string) => number;
};

/**
 * The one number a pattern finds in the markup — and it must be ONE number however many times the
 * page prints it.
 *
 * ⚠️ **NOT "EXACTLY ONE MATCH", AND THE DIFFERENCE MATTERS BOTH WAYS.** A component legitimately
 * renders the same figure twice: `WardBar` prints its caption for the eye and again for a screen
 * reader, so Capacity's ready-bed total appears twice in the markup from one value. Demanding a
 * single occurrence would have failed on correct markup. Demanding that every occurrence AGREES is
 * the property actually worth holding — two different totals beside one rail is a real defect on a
 * screen whose whole subject is how many beds there are, and this catches it. Zero matches still
 * fails: a figure the screen stopped printing must never read as nought.
 */
function oneNumber(markup: string, pattern: RegExp, what: string): string {
  const values = [...markup.matchAll(pattern)].map((match) => match[1]);
  expect(values.length, `${what}: nothing in the rendered markup matched ${pattern}`).toBeGreaterThan(0);
  expect(
    [...new Set(values)],
    `${what}: the screen renders more than one value for this figure (${values.join(", ")}), so there is no ` +
      "single number to agree with.",
  ).toHaveLength(1);
  return values[0];
}

const READERS: Record<ShellFigureId, ScreenReader> = {
  /**
   * The Capacity screen's own network total, which reaches the page through a DIFFERENT derivation
   * from the facade's: Capacity builds it from `allocatable.value` (`capacity-derivations.ts:290`),
   * the facade's figure comes from `min(allocatable.value, empty.value)` inside `capacityBreakdown()`
   * (`ward-bed-availability.ts:180`). The two are held to agree unit by unit by
   * `tests/ward-capacity-derivation-agreement.test.ts`; this compares the network sums, through the
   * rendered page. That makes this the strongest of the five — it is not one derivation checked
   * against itself in any sense.
   */
  bedsAvailable: {
    screen: "Capacity",
    component: CapacityScreen,
    read: (markup) =>
      Number(oneNumber(markup, /(\d+) beds ready across the network/gu, "Capacity's ready-bed bar caption")),
  },
  /** The Movements day panel states the complete open-movement count, independently of transport. */
  openMovements: {
    screen: "Movements",
    component: MovementsScreen,
    read: (markup) => {
      // v6 Movements (7 Oct 2026): The day is the hero band, whose title carries the count. Read
      // between The day's opening tag and the next panel so a second count anywhere in it still fails.
      // The title is also the "Open" day figure (#113 browser journey): its DOM reads label then
      // number ("Open movements" then <strong>70</strong>) and CSS draws "70 open movements".
      const headers = [
        ...markup.matchAll(
          /<section\b[^>]*\baria-label="The day"[^>]*>([\s\S]*?)<section\b[^>]*\baria-label="Today’s traffic"/gu,
        ),
      ];
      expect(headers, "Movements must render exactly one day panel header").toHaveLength(1);
      const counts = [
        ...headers[0][1].matchAll(
          /<span\b[^>]*\bdata-ward-panel-count(?:="")?[^>]*>\s*<span\b[^>]*>Open movements<\/span>\s*<strong\b[^>]*>(\d+)<\/strong>\s*<\/span>/gu,
        ),
      ];
      expect(counts, "The day panel header must render exactly one own open-movement count").toHaveLength(1);
      return Number(counts[0][1]);
    },
  },
  /**
   * The Delays screen marks each cause control `data-severe`, and prints the group size in its table row.
   * Summing the severe rows is what the screen SHOWS as needing attention now — and it is read off
   * the rows rather than from any single printed total, because the screen prints no single total.
   */
  delaysNeedingAttention: {
    screen: "Delays",
    component: DelaysScreen,
    read: (markup) => {
      const document = new JSDOM(markup).window.document;
      const buttons = [...document.querySelectorAll<HTMLButtonElement>("button[data-testid^='delays-cause-']")];
      expect(buttons.length, "the Delays screen rendered no cause rows to count").toBeGreaterThan(0);
      return buttons.reduce((total, button) => {
        const row = button.closest("tr");
        expect(row, "a cause control must belong to its displayed count row").not.toBeNull();
        const count = row?.querySelector("td:last-child")?.textContent?.trim() ?? "";
        expect(count, "every cause row must display an integer count").toMatch(/^\d+$/u);
        expect(button.dataset.severe, "every cause must identify whether it needs attention").toMatch(
          /^(true|false)$/u,
        );
        return total + (button.dataset.severe === "true" ? Number(count) : 0);
      }, 0);
    },
  },
  /**
   * The referral board's queued section, counted by its rows.
   *
   * ⚠️ **THE ROWS, NOT THE CARDS.** The board renders the same queue twice — a table for wide
   * viewports and a card list for narrow ones — so a pattern loose enough to catch both counts every
   * referral twice and reports a number no reader ever sees. `ward-referral-board-row-` is the table
   * only; `ward-referral-board-decided-row-` is the settled section and is deliberately excluded by
   * the anchored prefix.
   */
  referralsWaiting: {
    screen: "Referrals",
    component: ReferralBoard,
    read: (markup) => [...markup.matchAll(/data-testid="ward-referral-board-row-[^"]+"/gu)].length,
  },
  /**
   * The tasks control in the header bar — the surface `layout.tsx` actually mounts, which is
   * `WardChromeHeader` rather than the unmounted `WardTasksPanel` beside it. The count is the digit
   * in the control, not the length of a list this test computed.
   */
  tasks: {
    screen: "the header bar's Tasks control",
    component: WardChromeHeader,
    read: (markup) =>
      Number(
        oneNumber(
          markup,
          /data-testid="ward-tasks-opener"[^>]*>Tasks<span[^>]*>(\d+)<\/span>/gu,
          "the header bar's Tasks count",
        ),
      ),
  },
};

describe("the shell facade agrees with the screens that own its figures", () => {
  /**
   * 🔴 **THE ANTI-VACUITY FLOOR ON THE POPULATION ITSELF.** Every assertion in this file loops over
   * `SHELL_FIGURE_IDS`. An empty list — or a figure added to the facade with no reader written for it
   * — would make this whole file pass having compared nothing, which is the failure that looks
   * exactly like success. The reader map is pinned against the id list EXACTLY, so a sixth figure
   * cannot be added to the facade without somebody deciding which screen owns it.
   */
  it("has figures to compare, and a screen reader for every one of them", () => {
    expect(SHELL_FIGURE_IDS.length).toBeGreaterThan(0);
    expect([...Object.keys(READERS)].sort()).toEqual([...SHELL_FIGURE_IDS].sort());
  });

  /**
   * 🔴 **THE SECOND ANTI-VACUITY FLOOR, AND IT IS THE ONE THE MUTATIONS DO NOT COVER.**
   *
   * Two of the five figures are not moved by any of the three mutations the build plan names. For
   * those two, every comparison in this file is between two numbers that never change - so if either
   * figure were nought in the seeded night, "the facade agrees with the screen" would be `0 === 0`
   * on all four worlds, four times over, proving that two readers can both find nothing.
   *
   * A floor, deliberately, and never a pinned count. The synthetic night is expected to change and
   * pinning today's figures would redden this file for every fixture edit; what must never change is
   * that there is something to count.
   */
  it("has a non-zero figure of every kind in the seeded night, or the comparisons compare nothing", () => {
    const figures = facadeFigures(seed());
    for (const id of SHELL_FIGURE_IDS) {
      expect(
        figures[id].value,
        `${id} is nought in the seeded night, so every comparison of it in this file is 0 === 0 and ` +
          "demonstrates only that the facade and the screen can both find nothing.",
      ).toBeGreaterThan(0);
    }
  });

  /**
   * IMPORTANT 1's OWN GUARD — the facade states `TASKS_NOUN` rather than deriving it, and its own
   * doc comment used to claim it was the wording `ward-chrome-header.tsx` already renders when it
   * was in fact a third phrasing nothing guarded. Reading the noun back out of the same header
   * markup assertion 1 already renders is what makes the next divergence redden instead of being
   * described.
   */
  it("the tasks noun matches the words the header control renders beside its count", () => {
    const state = seed();
    const markup = markupOf(state, WardChromeHeader);
    const match = markup.match(
      /data-testid="ward-tasks-opener"[^>]*>Tasks<span[^>]*>\d+<\/span><span[^>]*>([^<]+)<\/span>/u,
    );
    expect(match, "the header's Tasks control markup did not match the expected shape at all").not.toBeNull();
    const renderedNoun = match![1];
    const figure = facadeFigures(state).tasks;
    // ⚠️ **PINNED AWAY FROM 1, DELIBERATELY.** The header switches to the singular "needs attention"
    // at exactly one task (`ward-chrome-header.tsx:158`); `TASKS_NOUN`'s own doc comment in
    // `ward-facade.ts` names that single-count mismatch as the accepted cost of one flat noun, not a
    // bug. Nothing else in this file kept the seeded fixture away from 1, so this floor is what stops
    // a future fixture edit from reddening this test on correct, already-accepted behaviour.
    expect(
      figure.value,
      "the seeded fixture holds the tasks figure at exactly 1, where the header renders the singular " +
        `"needs attention" and the facade still states the plural "${figure.noun}" by design — that is ` +
        "not a divergence this test should catch. Choose a fixture whose tasks count is not exactly 1.",
    ).toBeGreaterThan(1);
    expect(
      figure.noun,
      `the facade states the tasks noun as "${figure.noun}" and the header control renders ` +
        `"${renderedNoun}" beside the same count — a lane concatenating value and noun would show two ` +
        "different sentences.",
    ).toBe(renderedNoun);
  });

  for (const worldCase of WORLDS) {
    describe(worldCase.name, () => {
      for (const id of SHELL_FIGURE_IDS) {
        it(`${id} matches the number ${READERS[id].screen} renders`, () => {
          const state = worldCase.build(seed());
          const reader = READERS[id];
          const rendered = reader.read(markupOf(state, reader.component));
          const figure = facadeFigures(state)[id];
          expect(
            figure.value,
            `the facade says ${figure.value} ${figure.noun} and the ${reader.screen} screen renders ` +
              `${rendered}. One of them is what a coordinator acts on and there is no way to tell which.`,
          ).toBe(rendered);
        });
      }
    });
  }

  /**
   * 🔴 **THE ASSERTION THAT STOPS THE THREE ABOVE BEING DECORATIVE.** Two readers that are both wrong
   * in the same way agree on every fixture. What separates "they agree" from "they are both reading
   * the same broken thing" is that the world MOVED and both moved with it — so a mutation that
   * changes no figure at all contributes nothing, and this fails rather than letting it look like
   * evidence.
   */
  it("each mutation actually moves at least one figure", () => {
    const base = facadeFigures(seed());
    const mutations = WORLDS.filter((candidate) => candidate.mutation);
    expect(mutations.length, "no mutated world is defined, so the agreement above rests on one fixture").toBe(3);

    for (const worldCase of mutations) {
      const after = facadeFigures(worldCase.build(seed()));
      const moved = SHELL_FIGURE_IDS.filter((id) => after[id].value !== base[id].value);
      expect(
        moved.length,
        `"${worldCase.name}" changed no shell figure. It was applied and not refused, so the world really ` +
          "did change — but nothing the shell shows moved with it, which means this world proves nothing " +
          "about agreement. Either choose a mutation that moves a figure, or drop it and say so.",
      ).toBeGreaterThan(0);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * ASSERTION 4 — every builder produces a route that exists, and is not a redirect stub.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Each builder, an href it actually produced, and the route directory that href must land in.
 *
 * ⚠️ **WHAT THIS DOES NOT ASSERT, DELIBERATELY.** It does not claim that every patient id, team id or
 * service name in the model resolves to a rendered record — "every X resolves" is the shape most
 * likely to force a fabrication, because failing it reads as an incomplete screen rather than as an
 * absent capability. The routes below exist and are not stubs; whether a particular id finds a record
 * is the route's own honest not-found, and `communityTeamById`'s doc comment says as much.
 *
 * ⚠️ **AND ONE STATED ABSENCE, WRITTEN DOWN RATHER THAN PAPERED OVER.** `raiseReferralHref` builds a
 * querystring nothing reads yet: `referral-intake.tsx` consumes none of `patientId`, `source`,
 * `originEdId` or `teamId`. The ROUTE resolves, which is what this assertion is about; the form does
 * not arrive pre-filled, which is the intake lane's work and is recorded on the builder itself.
 */
const BUILDER_ROUTES: readonly {
  readonly name: string;
  readonly href: string;
  readonly route: string;
  readonly targetFile?: string;
}[] = [
  { name: "patientHref", href: patientHref("WF-001"), route: "people/[patientId]" },
  { name: "unitHref", href: unitHref("rph-adult-secure"), route: "ward/[unitId]" },
  { name: "wardBoardHref", href: wardBoardHref("rph-adult-secure"), route: "board/[unitId]" },
  { name: "teamHref", href: teamHref("armadale-adult"), route: "community/[teamId]" },
  {
    name: "communityTeamHref",
    href: communityTeamHref({ id: "armadale-adult", name: "Armadale Adult" } as Parameters<
      typeof communityTeamHref
    >[0]),
    route: "community/[teamId]",
  },
  { name: "edHref", href: edHref("peel-ed"), route: "ed/[edId]" },
  { name: "movementHref", href: movementHref("WF-M-1"), route: "movements/[movementId]" },
  { name: "handoverHref", href: handoverHref(), route: "handover" },
  { name: "settingsHref", href: settingsHref(), route: "settings" },
  { name: "officerHref", href: officerHref(), route: "transport/officer" },
  { name: "onCallHref", href: onCallHref(), route: "on-call" },
  {
    name: "digestHref",
    href: digestHref(),
    route: "/mockups/ward-flow-digest",
    targetFile: "src/app/mockups/ward-flow-digest/route.ts",
  },
  {
    name: "signInHref",
    href: signInHref(),
    route: "/mockups/ward-flow-sign-in",
    targetFile: "src/app/mockups/ward-flow-sign-in/page.tsx",
  },
  { name: "wardStatisticsHref", href: wardStatisticsHref("rph-adult-secure"), route: "statistics/ward/[unitId]" },
  { name: "edStatisticsHref", href: edStatisticsHref("peel-ed"), route: "statistics/ed/[edId]" },
  {
    name: "serviceStatisticsHref",
    href: serviceStatisticsHref("North Metro"),
    route: "statistics/service/[serviceId]",
  },
  {
    name: "communityStatisticsHref",
    href: communityStatisticsHref("armadale-adult"),
    route: "statistics/community/[teamId]",
  },
  { name: "raiseReferralHref", href: raiseReferralHref({ source: "community" }), route: "referrals/new" },
  { name: "dischargeHref", href: dischargeHref("AD-LEFT-01"), route: "discharges" },
];

describe("every href the facade builds lands on a route that exists", () => {
  it("covers every builder the facade exports", () => {
    // Anti-vacuity: an empty or shrunken list would make every case below pass by not running.
    expect(BUILDER_ROUTES.length).toBe(19);
    expect(new Set(BUILDER_ROUTES.map((entry) => entry.name)).size).toBe(BUILDER_ROUTES.length);
  });

  it.each(BUILDER_ROUTES.map((entry) => [entry.name, entry] as const))(
    "%s builds a path that matches a real route directory with a page in it",
    (_name, entry) => {
      const [pathOnly] = entry.href.split("?");
      const routeSegments = entry.route.split("/");
      if (entry.targetFile === undefined) {
        const hrefSegments = pathOnly.replace("/mockups/ward-flow/", "").split("/");
        expect(hrefSegments.length, `${entry.name} produced ${pathOnly}, which is not ${entry.route}'s shape`).toBe(
          routeSegments.length,
        );
        routeSegments.forEach((segment, index) => {
          if (segment.startsWith("[")) {
            expect(hrefSegments[index], `${entry.name} left ${segment} empty`).not.toBe("");
          } else {
            expect(hrefSegments[index], `${entry.name} produced ${pathOnly}, which is not ${entry.route}`).toBe(
              segment,
            );
          }
        });
      } else {
        expect(pathOnly, `${entry.name} produced ${pathOnly}, which is not its sibling route`).toBe(entry.route);
      }

      const pageFile = entry.targetFile
        ? path.join(REPO_ROOT, entry.targetFile)
        : path.join(WARD_FLOW_ROUTES, ...routeSegments, "page.tsx");
      expect(existsSync(pageFile), `${entry.name} points at ${entry.route}, which has no page.tsx on disk`).toBe(true);

      /*
       * ⚠️ **NOT A REDIRECT STUB.** A route that exists and immediately forwards somewhere else is a
       * page a link "reaches" and a reader never sees; `/mockups/ward-flow/constellation` is exactly
       * that shape in this tree, so the case is real rather than theoretical. (The Morning route used
       * to be this example too, until item 41, owner-approved 2026-09-17, deleted it outright rather
       * than leaving it as a redirect stub.)
       */
      const pageSource = readFileSync(pageFile, "utf8");
      expect(
        pageSource.includes("redirect("),
        `${entry.name} points at ${entry.route}, whose page redirects rather than rendering`,
      ).toBe(false);
    },
  );
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * ASSERTION 5 — no route string is typed in shell/ except inside the builders themselves.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT A CONVENIENCE.** The facade's own doc comments
 * quote route paths — the board route it deliberately does not build, for one — and a scan that
 * counted those would either force the documentation to be deleted or force this guard to be
 * loosened. `tests/ward-nav.test.ts` strips comments for the mirror-image reason: a commented-out
 * href once satisfied its whole safety net.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

/**
 * ⚠️ **NAMED, NOT A BARE ARRAY OF STRINGS — SO IMPORTANT 2'S CROSS-CHECK CAN ASK "WHICH BUILDER".**
 * `communityTeamHref` is deliberately absent: it is a delegate to `teamHref` (see the facade's own
 * doc comment) and writes no return line of its own, so it has nothing to name here.
 */
const EXPECTED_BUILDER_LINES: readonly { readonly name: string; readonly line: string }[] = [
  { name: "patientHref", line: "return `/mockups/ward-flow/people/${encodeURIComponent(patientId)}`;" },
  { name: "unitHref", line: "return `/mockups/ward-flow/ward/${encodeURIComponent(unitId)}`;" },
  { name: "wardBoardHref", line: "return `/mockups/ward-flow/board/${encodeURIComponent(unitId)}`;" },
  { name: "teamHref", line: "return `/mockups/ward-flow/community/${encodeURIComponent(teamId)}`;" },
  { name: "edHref", line: "return `/mockups/ward-flow/ed/${encodeURIComponent(edId)}`;" },
  { name: "movementHref", line: "return `/mockups/ward-flow/movements/${encodeURIComponent(movementId)}`;" },
  { name: "handoverHref", line: 'return "/mockups/ward-flow/handover";' },
  { name: "settingsHref", line: 'return "/mockups/ward-flow/settings";' },
  { name: "officerHref", line: 'return "/mockups/ward-flow/transport/officer";' },
  { name: "onCallHref", line: 'return "/mockups/ward-flow/on-call";' },
  { name: "digestHref", line: 'return "/mockups/ward-flow-digest";' },
  { name: "signInHref", line: 'return "/mockups/ward-flow-sign-in";' },
  {
    name: "wardStatisticsHref",
    line: "return `/mockups/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`;",
  },
  {
    name: "edStatisticsHref",
    line: "return `/mockups/ward-flow/statistics/ed/${encodeURIComponent(edId)}`;",
  },
  {
    name: "serviceStatisticsHref",
    line: "return `/mockups/ward-flow/statistics/service/${encodeURIComponent(serviceId)}`;",
  },
  {
    name: "communityStatisticsHref",
    line: "return `/mockups/ward-flow/statistics/community/${encodeURIComponent(teamId)}`;",
  },
  { name: "raiseReferralHref", line: "return `/mockups/ward-flow/referrals/new?${query.toString()}`;" },
  {
    name: "dischargeHref",
    line: "return `/mockups/ward-flow/discharges?admissionId=${encodeURIComponent(admissionId)}`;",
  },
] as const;

const EXPECTED_BUILDER_LINE_TEXT = EXPECTED_BUILDER_LINES.map((entry) => entry.line);

/**
 * ⚠️ **THE ONE BUILDER CHECKED IN `BUILDER_ROUTES` (ASSERTION 4) THAT HAS NO ENTRY ABOVE.**
 * `communityTeamHref` is a delegate, not a second builder — see its own doc comment in
 * `ward-facade.ts` — so it is deliberately excluded from `EXPECTED_BUILDER_LINES` rather than
 * missing from it by accident. Any OTHER name in one list and not the other is IMPORTANT 2's defect.
 */
const DELEGATE_BUILDERS: readonly string[] = ["communityTeamHref"];

describe("the shell directory writes a route path in exactly one kind of place", () => {
  /**
   * ⚠️ **RECURSIVE, BECAUSE `shell/` WILL GROW SUBDIRECTORIES.** A flat `readdirSync` made a route
   * string typed inside any `shell/<subdir>/*.ts` invisible to this scan — and the anti-vacuity
   * floor below (`files.length > 0`) was satisfied by `ward-facade.ts` alone, so a whole subtree
   * could go unscanned without a single assertion noticing.
   *
   * ⚠️ **`entry.name` IS THE BASENAME ONLY ONCE `recursive: true` IS SET, NOT A RELATIVE PATH.**
   * Node's `Dirent` carries `parentPath` for exactly this — the directory that actually contains the
   * entry, which differs from `SHELL_DIR` for anything below the top level. Joining `SHELL_DIR` with
   * `entry.name` here would silently point every nested file at the wrong, nonexistent location.
   */
  const files = readdirSync(SHELL_DIR, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")))
    .map((entry) => path.join(entry.parentPath, entry.name));

  it("has shell source to scan, or everything below is vacuous", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("carries a route path only on a builder's own return line", () => {
    const offending: string[] = [];
    const found: string[] = [];

    for (const file of files) {
      const relative = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      for (const line of stripComments(readFileSync(file, "utf8")).split("\n")) {
        if (!line.includes("/mockups/ward-flow")) continue;
        const trimmed = line.trim();
        if (EXPECTED_BUILDER_LINE_TEXT.includes(trimmed)) found.push(trimmed);
        else offending.push(`${relative}: ${trimmed}`);
      }
    }

    expect(
      offending,
      "a route path typed anywhere in shell/ other than inside a builder is the defect this module exists " +
        "to prevent — every screen linking that route would then have two places to read it from.",
    ).toEqual([]);
    // Both directions. The negative above is satisfied by a file with no routes in it at all.
    expect([...found].sort()).toEqual([...EXPECTED_BUILDER_LINE_TEXT].sort());
  });

  /**
   * IMPORTANT 2 — `BUILDER_ROUTES` (assertion 4) and `EXPECTED_BUILDER_LINES` (above) are two
   * separately hand-maintained lists of the same population, and nothing before this made them
   * agree. `BUILDER_ROUTES.length` was pinned to 11 by hand: a twelfth builder forced into
   * `EXPECTED_BUILDER_LINES` by the two-way equality just above would NOT have been forced into
   * `BUILDER_ROUTES`, so "every href builder produces a route that exists" could quietly become
   * "eleven of twelve do" with nothing here going red. Checking the two lists' builder NAMES against
   * each other, rather than re-trusting either one's own hand-set length, is what closes that.
   */
  it("BUILDER_ROUTES and EXPECTED_BUILDER_LINES name the same builders, delegates excluded", () => {
    const routeNames = new Set(BUILDER_ROUTES.map((entry) => entry.name));
    const lineNames = new Set(EXPECTED_BUILDER_LINES.map((entry) => entry.name));

    // The matching floor to BUILDER_ROUTES' own uniqueness check above: without this, a twelfth
    // builder added to EXPECTED_BUILDER_LINES under a COPY-PASTED name would collapse into an
    // existing entry in `lineNames` (a Set), so neither loop below would ever see a name that is
    // not already in BUILDER_ROUTES — the exact defect IMPORTANT 2 raised, recreated one property
    // below the fix that was meant to close it.
    expect(
      lineNames.size,
      "EXPECTED_BUILDER_LINES has a duplicated builder name — it would satisfy the two-way check " +
        "below without ever registering as a new builder that BUILDER_ROUTES must also cover.",
    ).toBe(EXPECTED_BUILDER_LINES.length);

    for (const name of lineNames) {
      expect(
        routeNames.has(name),
        `${name} writes its own route line in shell/ but has no entry in BUILDER_ROUTES — "every href ` +
          `builder produces a route that exists" would silently exclude it.`,
      ).toBe(true);
    }
    for (const name of routeNames) {
      if (DELEGATE_BUILDERS.includes(name)) continue;
      expect(
        lineNames.has(name),
        `${name} is checked in BUILDER_ROUTES but writes no route line of its own in shell/ and is not ` +
          "listed in DELEGATE_BUILDERS — confirm it is not silently duplicating another builder's route.",
      ).toBe(true);
    }
  });
});
