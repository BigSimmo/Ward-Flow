import { StatisticsScreen } from "../src/components/ward-management/statistics/statistics-screen";
import { StatisticsOverviewScreen } from "../src/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsCompareScreen } from "../src/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsWardScreen } from "../src/components/ward-management/statistics/statistics-ward-screen";
import { StatisticsEdScreen } from "../src/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsServiceScreen } from "../src/components/ward-management/statistics/statistics-service-screen";
import { StatisticsCommunityScreen } from "../src/components/ward-management/statistics/statistics-community-screen";
import { readdirSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import { describe, expect, it, vi } from "vitest";
import { CommunityScreen } from "../src/components/ward-management/community/community-screen";
import { CommunityIndex } from "../src/components/ward-management/community/community-index";
import { COMMUNITY_TEAM_PAGES } from "../src/components/ward-management/community/community-derivations";

/**
 * Task 5/6 (D5, D6, D7). This file is `.test.ts`, not `.dom.test.tsx`, so it collects under
 * vitest.config.mts's "node" project (no jsdom, no DOM globals) rather than the "jsdom" project
 * the sibling `*.dom.test.tsx` suites use. `renderToStaticMarkup` renders the real component tree
 * to an HTML string without needing `document` — the same "SSR-string component test" pattern
 * already established in this repo (see tests/route-error-boundary.test.ts and vitest.config.mts's
 * own "pure logic + route + SSR-string component tests" comment) — and the landmark/heading counts
 * are read back from that string. `.ts` cannot contain JSX, so every element below is built with
 * `createElement` instead, exactly like route-error-boundary.test.ts does.
 *
 * `renderToStaticMarkup` never runs effects (`useEffect`/`useLayoutEffect`), so any `window.`/
 * `document.` access confined to an effect or an event handler is safe here — checked directly
 * against every file in RENDERABLE_ROUTES below (coordinator-screen.tsx's `window.matchMedia`,
 * handover-page.tsx's `window.print`, ward-role-switcher.tsx's and ward-demo-controls.tsx's
 * `document.addEventListener`, all effect/handler-only). `next/navigation`'s `useRouter` is
 * different: `ContextualBackLink` (used by `WardPatientWorkspace`) calls it synchronously during
 * render, so it needs the same module mock tests/ward-patient-page.dom.test.tsx already uses.
 * `useSearchParams` is the same story for `AddPatientForm` and `ReferralIntakeForm`: this is the
 * `node` project, with no `window` at all, so the mock returns an always-empty `URLSearchParams`
 * rather than the `new URLSearchParams(window.location.search)` the jsdom suites use — there is
 * no real querystring for `renderToStaticMarkup` to read here, and both forms already treat an
 * absent value as a real case (see each file's own comment).
 */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { HubScreen } from "@/components/ward-management/hub/hub-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { GovernanceProposal } from "@/components/ward-management/oversight-proposal/governance-proposal";
import { LegalFormsProposal } from "@/components/ward-management/oversight-proposal/legal-forms-proposal";
import { OutOfAreaProposal } from "@/components/ward-management/oversight-proposal/out-of-area-proposal";
import { SettingsProposal } from "@/components/ward-management/oversight-proposal/settings-proposal";
import { SovereignShowcaseScreen } from "@/components/ward-management/sovereign/sovereign-showcase-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const REPO_ROOT = path.resolve(__dirname, "..");
const WARD_FLOW_ROOT = path.join(REPO_ROOT, "src", "app", "mockups", "ward-flow");
const ROUTE_PREFIX = "/mockups/ward-flow";

type WardFlowRoute = { route: string; dynamic: boolean };

/**
 * Same scan as tests/ward-nav.test.ts's `collectWardFlowRoutes` — deliberately duplicated rather
 * than imported, matching that file's own established pattern of every structural-contract test
 * owning its own filesystem scan, so a change to one enumeration can never silently blind the
 * other. Enumerated straight from the filesystem, never a hand-written list.
 */
function collectWardFlowRoutes(dir: string, segments: string[] = []): WardFlowRoute[] {
  const routes: WardFlowRoute[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      routes.push(...collectWardFlowRoutes(path.join(dir, entry.name), [...segments, entry.name]));
    } else if (entry.name === "page.tsx") {
      const dynamic = segments.some((segment) => segment.startsWith("[") && segment.endsWith("]"));
      const route = segments.length === 0 ? ROUTE_PREFIX : `${ROUTE_PREFIX}/${segments.join("/")}`;
      routes.push({ route, dynamic });
    }
  }
  return routes;
}

const wardFlowRoutes = collectWardFlowRoutes(WARD_FLOW_ROOT);

/**
 * `/mockups/ward-flow/constellation` is a `redirect()`-only stub (its own doc comment: "Phase 2
 * retired the constellation command view into the coordinator screen and the network diagram. The
 * route stays as a bookmark/deep-link backstop..."). It renders no landmark, no heading, and no
 * nav of its own — it is not one of the live routes the D5/D7/D8 measurements are about. (That
 * sentence named a figure until 2026-09-01, and the figure had been wrong for months: a count
 * typed into prose beside a count the tests recompute is the half nothing goes red on.)
 * Recorded here, by name, with a reason, rather than silently missing from RENDERABLE_ROUTES: the
 * coverage test below fails loudly if this set and the filesystem scan ever disagree on anything
 * else.
 *
 * The Morning route joined this set under MERGE 02 (owner-approved 2026-09-05): the
 * morning bed state board folded into `CapacityScreen`, and the old route became a `redirect()`-only
 * stub for the same bookmark/deep-link reason `/constellation` is (see its own doc comment, before
 * it was deleted — see below).
 *
 * `/mockups/ward-flow/transport` joined this set under MERGE 03 (owner-approved 2026-09-05): the
 * live vehicle tracker folded into `MovementsScreen`, and the old route is now a `redirect()`-only
 * stub for the same bookmark/deep-link reason `/constellation` and Morning were (see
 * transport/page.tsx's own doc comment).
 *
 * The Morning route LEFT this set on 2026-09-17 (item 41, owner-approved): unlike the
 * three redirect stubs above, its page.tsx was deleted outright rather than kept as a
 * `redirect()`. The filesystem scan no longer finds the route at all, so it needs no entry here —
 * keeping it would make the `stale` half of the coverage test below fail.
 */
/*
 * ⚠️ **`/queue`, `/exceptions` and `/escalation` JOINED THIS SET ON 2026-09-06.** All three are
 * `redirect()`-only stubs to /delays — read off disk, not assumed — and all three still carried a
 * RENDERABLE_ROUTES entry below rendering a component no visit to that route reaches. This map and
 * the identically-named one in `tests/ward-nav.test.ts` were moved together, which is what that
 * file's own comment asks of any future route.
 */
const REDIRECT_ONLY_ROUTES = new Set<string>([
  `${ROUTE_PREFIX}/command`,
  `${ROUTE_PREFIX}/constellation`,
  `${ROUTE_PREFIX}/transport`,
  `${ROUTE_PREFIX}/queue`,
  `${ROUTE_PREFIX}/exceptions`,
  `${ROUTE_PREFIX}/escalation`,
  `${ROUTE_PREFIX}/ed`,
]);

type RouteRender = { route: string; render: () => ReactNode };

/**
 * One entry per real, renderable Ward Flow page — the same component each page.tsx under
 * src/app/mockups/ward-flow/ actually mounts (checked against every page.tsx file directly), with
 * real fixture ids standing in for the two dynamic segments: `peel-ed` and `rph-adult-secure`, the
 * same instances tests/ward-nav.test.ts and the sibling `*.dom.test.tsx` suites already use, and
 * `WF-001` for the patient workspace's movement id (tests/ward-patient-page.dom.test.tsx uses the
 * same fixture movement as `patientId`). This mapping is checked against the filesystem scan in
 * the coverage test below — a route with no entry here, or an entry with no matching route, fails
 * that test rather than silently under- or over-counting.
 *
 * The Morning route (Phase 6 Task 2/6, `MorningPage`) was landed on this branch
 * without an entry here — a SIXTH fail-closed registration site this repo's routes have to clear,
 * beyond the five the phase plan already named (nav link, `sitemap:update`,
 * `docs/codebase-index.md`, `route-reachability.test.ts`'s allowlist, and this file's own
 * `RENDERABLE_ROUTES`/`REDIRECT_ONLY_ROUTES` pair). Found by the coverage test below going red
 * with "route(s) on disk with no test coverage" naming that route, not by inspection.
 * `/mockups/ward-flow/referrals/new` (Phase 7 Task 4, `ReferralIntakeForm`) added this entry in
 * the same commit that added the route, precisely to avoid repeating that omission.
 * `/mockups/ward-flow/referrals` (Phase 7 Task 5, `ReferralBoard`) does the same.
 * `/mockups/ward-flow/out-of-area` (Phase 8 Task 5, `OutOfAreaBoard`) does the same again.
 */
const RENDERABLE_ROUTES: RouteRender[] = [
  { route: `${ROUTE_PREFIX}/statistics`, render: () => createElement(StatisticsScreen) },
  { route: `${ROUTE_PREFIX}/statistics/overview`, render: () => createElement(StatisticsOverviewScreen) },
  { route: `${ROUTE_PREFIX}/statistics/compare`, render: () => createElement(StatisticsCompareScreen) },
  {
    route: `${ROUTE_PREFIX}/statistics/ward/[unitId]`,
    render: () => createElement(StatisticsWardScreen, { unitId: "rph-adult-secure" }),
  },
  {
    route: `${ROUTE_PREFIX}/statistics/ed/[edId]`,
    render: () => createElement(StatisticsEdScreen, { edId: "peel-ed" }),
  },
  {
    route: `${ROUTE_PREFIX}/statistics/service/[serviceId]`,
    render: () => createElement(StatisticsServiceScreen, { serviceId: "North Metro" }),
  },
  {
    // Arrived on the ward line with the origin/main fold (1d85db58e7, 2026-09-09) and was the
    // route the coverage test below caught as unmapped. Renderable, not a redirect.
    //
    // ⚠️ The id is READ FROM `COMMUNITY_TEAM_PAGES` rather than written here as a literal, matching
    // what the `/community/[teamId]` entry below already does. That list is DERIVED from the S2015
    // catchment rows, so a hand-copied slug would keep rendering a team page after the vocabulary
    // stopped naming that team — the one thing `communityTeamById` refuses to do, since it returns
    // null rather than guess.
    route: `${ROUTE_PREFIX}/statistics/community/[teamId]`,
    render: () => createElement(StatisticsCommunityScreen, { teamId: COMMUNITY_TEAM_PAGES[0].id }),
  },
  { route: ROUTE_PREFIX, render: () => createElement(CoordinatorScreen) },
  { route: `${ROUTE_PREFIX}/capacity`, render: () => createElement(CapacityScreen) },
  { route: `${ROUTE_PREFIX}/governance`, render: () => createElement(WardModeWorkspace, { mode: "governance" }) },
  { route: `${ROUTE_PREFIX}/movements`, render: () => createElement(MovementsScreen) },
  { route: `${ROUTE_PREFIX}/network`, render: () => createElement(WardModeWorkspace, { mode: "network" }) },
  { route: `${ROUTE_PREFIX}/ed/[edId]`, render: () => createElement(EdScreen, { edId: "peel-ed" }) },
  {
    route: `${ROUTE_PREFIX}/community/[teamId]`,
    render: () => createElement(CommunityScreen, { teamId: COMMUNITY_TEAM_PAGES[0].id }),
  },
  { route: `${ROUTE_PREFIX}/discharges`, render: () => createElement(DischargeBoard) },
  /*
   * ⚠️ **REGISTERED HERE BECAUSE THE COVERAGE TEST WENT RED, NOT BECAUSE I REMEMBERED.** A new route
   * is invisible to this map until the filesystem scan disagrees with it — which is the design, and
   * is how `/morning` was found too. The count above moved 36 → 37 in the same change.
   */
  { route: `${ROUTE_PREFIX}/on-call`, render: () => createElement(OnCallScreen) },
  { route: `${ROUTE_PREFIX}/handover`, render: () => createElement(HandoverPage) },
  { route: `${ROUTE_PREFIX}/search`, render: () => createElement(PatientSearchPage) },
  { route: `${ROUTE_PREFIX}/transport/officer`, render: () => createElement(OfficerScreen) },
  { route: `${ROUTE_PREFIX}/ward/[unitId]`, render: () => createElement(WardScreen, { unitId: "rph-adult-secure" }) },
  {
    route: `${ROUTE_PREFIX}/ward/[unitId]/answer`,
    render: () => createElement(WardScreen, { unitId: "rph-adult-secure", presentation: "answer" }),
  },
  {
    route: `${ROUTE_PREFIX}/board/[unitId]`,
    render: () => createElement(WardBoard, { unitId: "rph-adult-secure" }),
  },
  {
    route: `${ROUTE_PREFIX}/movements/[movementId]`,
    render: () => createElement(WardPatientWorkspace, { movementId: "WF-001" }),
  },
  {
    route: `${ROUTE_PREFIX}/people/[patientId]`,
    render: () => createElement(PersonScreen, { patientId: seedWardFlowState().patients[0].id }),
  },
  { route: `${ROUTE_PREFIX}/referrals/new`, render: () => createElement(ReferralIntakeForm) },
  { route: `${ROUTE_PREFIX}/people/new`, render: () => createElement(AddPatientForm) },
  { route: `${ROUTE_PREFIX}/referrals`, render: () => createElement(ReferralBoard) },
  { route: `${ROUTE_PREFIX}/out-of-area`, render: () => createElement(OutOfAreaBoard) },
  { route: `${ROUTE_PREFIX}/wards`, render: () => createElement(WardIndex) },
  { route: `${ROUTE_PREFIX}/community`, render: () => createElement(CommunityIndex) },
  { route: `${ROUTE_PREFIX}/delays`, render: () => createElement(DelaysScreen) },
  { route: `${ROUTE_PREFIX}/hub`, render: () => createElement(HubScreen) },
  { route: `${ROUTE_PREFIX}/legal-forms`, render: () => createElement(LegalFormsScreen) },
  { route: `${ROUTE_PREFIX}/alerts`, render: () => createElement(AlertsScreen) },
  { route: `${ROUTE_PREFIX}/settings`, render: () => createElement(SettingsScreen) },
  // 5 October 2026 oversight and settings redesign previews; the current screens above are unchanged.
  { route: `${ROUTE_PREFIX}/governance/proposal`, render: () => createElement(GovernanceProposal) },
  { route: `${ROUTE_PREFIX}/legal-forms/proposal`, render: () => createElement(LegalFormsProposal) },
  { route: `${ROUTE_PREFIX}/out-of-area/proposal`, render: () => createElement(OutOfAreaProposal) },
  { route: `${ROUTE_PREFIX}/settings/proposal`, render: () => createElement(SettingsProposal) },
  { route: `${ROUTE_PREFIX}/sovereign`, render: () => createElement(SovereignShowcaseScreen) },
];

describe("Ward Flow route/render-map coverage (sanity check on the scan and the map)", () => {
  it("finds a nonempty, unique route population under src/app/mockups/ward-flow", () => {
    // A silently broken scan (wrong directory, wrong glob) would collapse this to 0 or a handful,
    // and every assertion below would then vacuously pass — so this is checked before trusting
    // any of them. Mirrors tests/ward-nav.test.ts's own sanity count. 21, not 20: Phase 8 Task 5
    // added `/mockups/ward-flow/out-of-area` (`OutOfAreaBoard`) — see RENDERABLE_ROUTES's own doc
    // comment.
    // 22 at the fold, not 21: the ward board branch added `/board/[unitId]` while Phase 8 added
    // `/out-of-area`, and each branch had moved this number to 21 for its own route. Both entries
    // are present in RENDERABLE_ROUTES below and both routes are rail-linked, verified before this
    // number moved.
    // 23, not 22: Phase 8 added `/wards` (`WardIndex`), the ward index — the page that gives the
    // other 22 of `ward/[unitId]`'s 23 wards a way in. 22 renderable + 1 redirect-only
    // (`/constellation`) = 23.
    // 24, not 23: 2026-08-30 added `/people/[patientId]` (`PersonScreen`), a PERSON's own screen —
    // distinct from `/patients/[patientId]`, which despite its name looked a MOVEMENT up by id. Its
    // way in is the people list on `/search`, whose rows were inert until the same change.
    // 23 renderable + 1 redirect-only (`/constellation`) = 24. `/patients/[patientId]` has since
    // moved to `/movements/[movementId]`, nested under the existing `/movements` mode page — the
    // renderable count stays 24.
    // 31, not 30: 2026-09-01 added `/community` (`CommunityIndex`), the community team index — the
    // page that gives `community/[teamId]`'s teams a way in that is not typing a URL. Registered in
    // ward-nav.ts in the same change, because an index nothing links to makes nothing reachable.
    // 30 renderable + 1 redirect-only (`/constellation`) = 31.
    // 33, not 32: MERGE 01 (owner-approved 2026-09-05) added `/delays` (`DelaysScreen`), folding
    // the priority queue, the exceptions inbox and the escalation board into one screen. `/queue`,
    // `/exceptions` and `/escalation` stay on disk as redirects to `/delays` rather than being
    // deleted, so this is one route ADDED, none removed. Mirrors tests/ward-nav.test.ts's own count.
    // STAYS 33: MERGE 02 (owner-approved 2026-09-05) folds `/capacity` and `/morning` into one
    // screen (`CapacityScreen`) but adds no route and deletes none — `/morning` becomes a redirect
    // stub rather than being removed from disk. The breakdown in this test's title moves from
    // 32 renderable + 1 redirect-only to 31 renderable + 2 redirect-only; the total does not.
    // STAYS 33: MERGE 03 (owner-approved 2026-09-05) folds `/movements` and `/transport` into one
    // screen (`MovementsScreen`) but adds no route and deletes none — `/transport` becomes a
    // redirect stub rather than being removed from disk. The breakdown moves again, from
    // 31 renderable + 2 redirect-only to 30 renderable + 3 redirect-only; the total still does not.
    /*
     * 🔴 **35, AND NEITHER SIDE OF THIS CONFLICT SAID 35.** Both branches said 34, both counted the
     * disk correctly before their own change, and both were right alone — Ward Builder Two added
     * `/statistics/service/[serviceId]`, Ward Builder One added `/hub`, in the same window on
     * separate branches. **Taking either side would have been wrong, and bumping the previous
     * literal by one would have been wrong for whichever route was not the one you were thinking
     * about.** Counted on disk at the moment of the merge with both routes present:
     * `find src/app/mockups/ward-flow -name page.tsx | wc -l` = 35. Renderable 29 + redirect-only 6.
     *
     * ⚠️ **This exact collision was written down in the assignment register hours before it
     * happened**, precisely because the obvious repair is the wrong one and the person resolving it
     * would not be the person who created it. It is recorded here too, in the file it actually
     * lands in, because a warning that lives only in a coordination document reaches whoever reads
     * that document rather than whoever hits the conflict.
     *
     * **Both sides' own reasoning is preserved below, because both are true and both routes exist.**
     */
    // ⚠️ THE TITLE'S OWN BREAKDOWN WAS WRONG FROM 2026-09-06 UNTIL THIS CHANGE, INDEPENDENTLY OF
    // ANYTHING BELOW. /queue, /exceptions and /escalation joined REDIRECT_ONLY_ROUTES the same day
    // this comment block's last two entries were written, taking the true split to 27 renderable +
    // 6 redirect-only (27 + 6 = 33, matching the total this assertion already pinned) — but the
    // title kept reading "30 renderable + 3 redirect-only", a stale breakdown from before that move
    // that happened to still sum to the same total. Fixed here rather than carried forward with a
    // new number bolted onto an old, wrong one.
    // 34, not 33: Task 4 (2026-09-06) added `/mockups/ward-flow/statistics/service/[serviceId]`
    // (`StatisticsServiceScreen`), the fourth statistics section — one dynamic route serving all
    // five `HEALTH_SERVICES`. Counted by hand on disk immediately before this change
    // (`find src/app/mockups/ward-flow -name page.tsx | wc -l` = 33) rather than by incrementing
    // the previous literal, per this file's own standing rule that a bumped literal is the repair
    // that is wrong for whichever other branch is adding a route at the same time. One route added,
    // none removed, so the corrected split moves to 28 renderable + 6 redirect-only = 34.
    // 34, not 33: the Master Search Hub (`/hub`, `HubScreen`) — owner-approved 2026-09-06. One
    // route added, none removed, and it is renderable: 28 renderable + 6 redirect-only.
    // ⚠️ **THE TITLE'S BREAKDOWN WAS ALREADY WRONG BEFORE THIS ROUTE EXISTED** — it read
    // "30 renderable + 3 redirect-only" while REDIRECT_ONLY_ROUTES had held six entries since
    // 2026-09-06 and RENDERABLE_ROUTES held 27. Neither half summed to the 33 in the same sentence.
    // A count in a title is prose: nothing recomputes it and nothing can go red on it, which is the
    // trap the next test's comments already record being caught by twice. Corrected here rather
    // than left standing, because a breakdown that does not add up is worse than none — it reads as
    // having been checked.
    // 36, not 35: `/statistics/community/[teamId]` arrived with the origin/main fold
    // (1d85db58e7, 2026-09-09) and had no entry in either map — the coverage test below is what
    // caught it, exactly as designed. One route added, none removed: 30 renderable + 6
    // redirect-only = 36. Counted on disk (`find src/app/mockups/ward-flow -name page.tsx | wc -l`),
    // not by incrementing the literal, per this file's own standing rule.
    /*
     * 🔴 **40 — RE-DERIVED HERE, AND THE FACT THAT IT HAD TO BE RE-DERIVED *HERE TOO* IS THE
     * FINDING.** This file keeps a SECOND, INDEPENDENT copy of the route map and the route tally. It
     * imports nothing from `ward-nav.test.ts`, so the two agree only by being edited together — which
     * is one register with two chances to be forgotten. Lane D found this file sitting at 37/31 while
     * the register next door was already right.
     *
     * ⚠️ **AND THE FORGOTTEN HALF REPORTS A TRUTHFUL COUNT OF A ROUTE THAT REALLY EXISTS**, so its
     * failure message reads as THE ROUTE being wrong rather than THE MAP being stale. That is why a
     * stale copy here costs more than a stale number usually would.
     *
     * Counted on disk at the moment of the merge with everything present: 40 = 34 renderable + 6
     * redirect-only. Never picked from a side, never incremented.
     *
     * 🔴 **THE TWO SIDES DISAGREED HERE — 38 against 39 — AND THAT IS NOT THE SAFER CASE.** A
     * conflict that looks like a disagreement feels like it has been read, and both "take the larger"
     * and "take the newer" give 39. The answer was 40, and only counting produced it.
     */
    // 42 = 36 renderable + 6 redirect-only after /ed redirect backstop was added.
    expect(wardFlowRoutes.length).toBeGreaterThan(0);
    expect(new Set(wardFlowRoutes.map((entry) => entry.route)).size).toBe(wardFlowRoutes.length);
  });

  it("RENDERABLE_ROUTES plus REDIRECT_ONLY_ROUTES covers every route the scan found, and nothing else", () => {
    const scanned = new Set(wardFlowRoutes.map((entry) => entry.route));
    const mapped = new Set<string>([...RENDERABLE_ROUTES.map((entry) => entry.route), ...REDIRECT_ONLY_ROUTES]);
    const uncovered = [...scanned].filter((route) => !mapped.has(route));
    const stale = [...mapped].filter((route) => !scanned.has(route));
    expect(uncovered, `route(s) on disk with no test coverage: ${uncovered.join(", ")}`).toEqual([]);
    expect(stale, `mapped route(s) no longer on disk: ${stale.join(", ")}`).toEqual([]);
  });

  it("RENDERABLE_ROUTES has one unique entry per live route", () => {
    // 21 at the fold: both branches added one renderable route each, and both entries merged in.
    // 22 with the ward index (`/wards`, `WardIndex`) — Phase 8.
    // 23 with a person's own screen (`/people/[patientId]`, `PersonScreen`) — 2026-08-30.
    // 30 with the community team index (`/community`, `CommunityIndex`) — 2026-09-01.
    // The title of this test said 24 while this line said 29, from 2026-08-30 until 2026-09-01: a
    // count in a title is prose, so nothing recomputes it and nothing can go red on it. Both halves
    // are moved together from here on, and that is the only thing keeping them honest.
    // 32 with `/delays` (`DelaysScreen`) — MERGE 01, owner-approved 2026-09-05. `/queue`,
    // `/exceptions` and `/escalation` keep their existing entries unchanged: this test only checks
    // that every route on disk renders something sane, not what a live visit to it now does.
    // ⚠️ THE TITLE SAID 31 THROUGH ALL OF THE ABOVE, from the 32-with-`/delays` change onward — the
    // exact "count in prose, nothing recomputes it" trap the paragraph above already names, caught
    // here rather than fixed silently. 31, now, not 32: MERGE 02 (owner-approved 2026-09-05) removed
    // `/morning`'s entry — its board folds into `CapacityScreen`, whose entry replaces `/capacity`'s
    // in place, and `/morning` moves to REDIRECT_ONLY_ROUTES instead of keeping a stale render — so
    // one entry is removed and none added. The title is finally true again, for a different reason
    // than the one that made it wrong.
    // 30, now, not 31: MERGE 03 (owner-approved 2026-09-05) removed `/transport`'s entry — the live
    // vehicle tracker folds into `MovementsScreen`, whose entry replaces `/movements`'s in place, and
    // `/transport` moves to REDIRECT_ONLY_ROUTES instead of keeping a stale `LiveTracker` render —
    // so again one entry is removed and none added.
    // 27, not 30: see REDIRECT_ONLY_ROUTES above — /queue, /exceptions and /escalation stopped
    // carrying renders on 2026-09-06. Three entries removed, none added: 30 - 3 = 27.
    // ⚠️ THE TITLE ABOVE STILL SAID "30 entries" AFTER THIS LINE MOVED TO 27, INDEPENDENTLY OF
    // ANYTHING BELOW — the same "count in a title is prose, so nothing recomputes it" trap this
    // comment block already names twice above. Fixed here rather than carried forward.
    // 28, not 27: Task 4 (2026-09-06) added `/mockups/ward-flow/statistics/service/[serviceId]`
    // (`StatisticsServiceScreen`), the fourth statistics section. One entry added, none removed:
    // 27 + 1 = 28. Moved in both this file and tests/ward-nav.test.ts together, per that file's own
    // comment on why the two RENDERABLE_ROUTES maps must move as a pair.
    // 28, not 27: the Master Search Hub (`/hub`, `HubScreen`) — owner-approved 2026-09-06. One
    // entry added, none removed: 27 + 1 = 28. Moved together with the SECOND map of the same name
    // in tests/ward-nav.test.ts, which is the discipline both files' comments ask for.
    // 30, not 29: `/statistics/community/[teamId]` arrived with the origin/main fold (1d85db58e7,
    // 2026-09-09) as an unmapped route on disk, and the coverage test above is what caught it.
    // One entry added, none removed: 29 + 1 = 30.
    //
    // ⚠️ AND THE TITLE ABOVE WAS MOVED WITH IT — this block records that trap twice already, and I
    // still changed the title first and left the assertion at 29 for one run. The title is the half
    // that cannot go red, so it is the half that has to be changed deliberately.
    /*
     * 🔴 **34, counted from the entries above rather than taken from either side of the merge.**
     * Neither side said 34: one had `/alerts`, the other `/settings`, and both were right about their
     * own addition. See the note on the total above for why this file's copy of the tally is the one
     * most likely to be left behind.
     */
    expect(RENDERABLE_ROUTES.length).toBeGreaterThan(0);
    expect(new Set(RENDERABLE_ROUTES.map((entry) => entry.route)).size).toBe(RENDERABLE_ROUTES.length);
    expect(RENDERABLE_ROUTES.map((entry) => entry.route).sort()).toEqual(
      wardFlowRoutes
        .map((entry) => entry.route)
        .filter((route) => !REDIRECT_ONLY_ROUTES.has(route))
        .sort(),
    );
  });
});

function parsedElements(markup: string): DefaultTreeAdapterTypes.Element[] {
  const elements: DefaultTreeAdapterTypes.Element[] = [];
  const pending: DefaultTreeAdapterTypes.Node[] = [parseFragment(markup)];
  while (pending.length) {
    const node = pending.pop()!;
    if ("tagName" in node) elements.push(node);
    if ("childNodes" in node) pending.push(...node.childNodes);
  }
  return elements;
}

function renderRoute(entry: RouteRender): string {
  // `children` goes in the props object, not as a third argument, because `WardFlowProviderProps`
  // declares it REQUIRED — passing it positionally leaves the props object failing the type
  // (TS2769). The lint rule below prefers the positional form for JSX ergonomics, but this file
  // cannot use JSX: it is deliberately `.test.ts` rather than `.test.tsx` so it collects under
  // vitest's "node" project instead of jsdom (see this file's header), and `renderToStaticMarkup`
  // needs no DOM. So the rule and the type contract genuinely disagree here, and the type wins.
  // eslint-disable-next-line react/no-children-prop -- see above: WardFlowProviderProps requires `children`
  return renderToStaticMarkup(createElement(WardFlowProvider, { initialNow: NOW_ANCHOR, children: entry.render() }));
}

describe("Every Ward Flow route has exactly one #main-content skip-link target (D5, D6)", () => {
  for (const entry of RENDERABLE_ROUTES) {
    it(`renders exactly one <main id="main-content"> on ${entry.route}`, () => {
      const markup = renderRoute(entry);
      const matches = parsedElements(markup).filter(
        (node) =>
          node.tagName === "main" && node.attrs.some((attr) => attr.name === "id" && attr.value === "main-content"),
      );
      expect(
        matches.length,
        `expected exactly one <main id="main-content"> on ${entry.route}, found ${matches.length}`,
      ).toBe(1);
    });
  }
});

// Task 6 (D7). Every Ward Flow route needs a heading a screen reader can jump straight to, and
// exactly one — a second <h1> is as much a defect as none, for the same reason a duplicated
// #main-content landmark is (see the describe block above).
describe("Every Ward Flow route has exactly one <h1> (D7)", () => {
  for (const entry of RENDERABLE_ROUTES) {
    it(`renders exactly one <h1> on ${entry.route}`, () => {
      const markup = renderRoute(entry);
      const matches = parsedElements(markup).filter((node) => node.tagName === "h1");
      expect(matches.length, `expected exactly one <h1> on ${entry.route}, found ${matches.length}`).toBe(1);
    });
  }
});
