import { cleanup, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { installMatchMediaStub } from "./setup/jsdom.setup";

/**
 * 🔴 **THE WHOLE WARD FLOW JOURNEY, WALKED FOR CONTROLS THAT GO NOWHERE.**
 *
 * The owner's goal is "nothing dead end or logic breakdown" across Ward Flow. Nothing else in this
 * suite asks that question at the control level: `ward-route-component-binding.test.ts` pins which
 * COMPONENT a route renders, `ward-event-reachability.test.ts` pins which REDUCER EVENTS a screen
 * can dispatch, `ward-component-reachability.test.ts` pins which COMPONENTS a route can reach — and
 * none of the three opens a rendered screen and asks whether every button, link, menu item and
 * select on it actually does something. This file is that question, run mechanically over every
 * Ward Flow route on disk.
 *
 * **Scope, set by the coordinator's speed ruling (2026-09-17):** render each route once — as the
 * route's own chrome role, computed from `wardChromeRole`, never hand-typed — and skip the
 * one-level dispatch/rejection walk entirely. A second "most-privileged coordinator" render was
 * considered and dropped: none of the Ward Flow SCREEN components (as opposed to the
 * `shell/ward-rail.tsx` / `shell/ward-bar.tsx` chrome that `layout.tsx` mounts around them) reads
 * `usePathname` or `wardChromeRole` at all — confirmed by grepping every `.tsx` under
 * `src/components/ward-management` for both names before writing this file. A route's content does
 * not change with the mocked pathname, so a second render would have produced byte-identical DOM
 * and cost time for no new finding. If a future screen starts reading chrome role directly, this
 * paragraph is the place to notice and add the second render back.
 *
 * ⚠️ **A CONTROL IS "OK" ON ANY ONE OF THREE GROUNDS, NEVER BY DEFAULT.** It has an `href` that
 * resolves to a real page on disk; OR it (or its owning `<form>`) carries a React click/change/
 * submit handler, read off the fibre's own props rather than guessed from markup; OR it is
 * disabled and SAYS why — the D4 "Not wired in this prototype." sentence, or a title/
 * `aria-describedby` reason. Anything else is DEAD. This mirrors, at the control level, exactly the
 * disjunction `ward-settings-not-wired-controls.dom.test.tsx` already proves for the nine D4 rows.
 */

const NOT_WIRED = "Not wired in this prototype.";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * A screen-level suite, not a layout-level one: nothing here mounts `shell/ward-rail.tsx`, so the
 * pathname mock only has to satisfy any hook that calls it without throwing. See this file's own
 * header comment for the measurement that no Ward Flow SCREEN reads it for content.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { scanAppRoutes, scanWardFlowRoutes, hrefResolvesToRoute } from "./helpers/ward-dead-end-routes";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardBoard } from "@/components/ward-management/board/ward-board";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { HubScreen } from "@/components/ward-management/hub/hub-screen";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { SovereignShowcaseScreen } from "@/components/ward-management/sovereign/sovereign-showcase-screen";
import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { StatisticsServicesIndexScreen } from "@/components/ward-management/statistics/statistics-services-index";
import { StatisticsWardsIndexScreen } from "@/components/ward-management/statistics/statistics-wards-index";
import { StatisticsEdsIndexScreen } from "@/components/ward-management/statistics/statistics-eds-index";
import { StatisticsTeamsIndexScreen } from "@/components/ward-management/statistics/statistics-teams-index";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { OfficerScreen } from "@/components/ward-management/officer/officer-screen";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardIndex } from "@/components/ward-management/wards/ward-index";
import { EdIndex } from "@/components/ward-management/ed/ed-index";

const unit = allUnits()[0];
const ed = allEmergencyDepartments()[0];
const movement = wardMovements[0];
const patient = wardPatients[0];
const team = COMMUNITY_TEAM_PAGES[0];
const service = HEALTH_SERVICES[0];

/**
 * One render function per non-redirect Ward Flow route, keyed by the ABSTRACT route (brackets
 * intact, exactly as `scanWardFlowRoutes()` reports it) so the coverage check below can compare
 * the two sets directly. Each render is wrapped in the same `WardFlowProvider` every screen dom
 * suite in this repo already uses, pinned to `NOW_ANCHOR` for determinism.
 */
const ROUTE_RENDERERS: ReadonlyMap<string, { concrete: string; render: () => ReactElement }> = new Map([
  ["/mockups/ward-flow", { concrete: "/mockups/ward-flow", render: () => <CoordinatorScreen /> }],
  ["/mockups/ward-flow/alerts", { concrete: "/mockups/ward-flow/alerts", render: () => <AlertsScreen /> }],
  [
    "/mockups/ward-flow/board/[unitId]",
    { concrete: `/mockups/ward-flow/board/${unit.id}`, render: () => <WardBoard unitId={unit.id} /> },
  ],
  ["/mockups/ward-flow/capacity", { concrete: "/mockups/ward-flow/capacity", render: () => <CapacityScreen /> }],
  ["/mockups/ward-flow/community", { concrete: "/mockups/ward-flow/community", render: () => <CommunityIndex /> }],
  [
    "/mockups/ward-flow/community/[teamId]",
    { concrete: `/mockups/ward-flow/community/${team.id}`, render: () => <CommunityScreen teamId={team.id} /> },
  ],
  ["/mockups/ward-flow/delays", { concrete: "/mockups/ward-flow/delays", render: () => <DelaysScreen /> }],
  ["/mockups/ward-flow/discharges", { concrete: "/mockups/ward-flow/discharges", render: () => <DischargeBoard /> }],
  ["/mockups/ward-flow/on-call", { concrete: "/mockups/ward-flow/on-call", render: () => <OnCallScreen /> }],
  ["/mockups/ward-flow/ed", { concrete: "/mockups/ward-flow/ed", render: () => <EdIndex /> }],
  [
    "/mockups/ward-flow/ed/[edId]",
    { concrete: `/mockups/ward-flow/ed/${ed.id}`, render: () => <EdScreen edId={ed.id} /> },
  ],
  [
    "/mockups/ward-flow/governance",
    { concrete: "/mockups/ward-flow/governance", render: () => <WardModeWorkspace mode="governance" /> },
  ],
  ["/mockups/ward-flow/handover", { concrete: "/mockups/ward-flow/handover", render: () => <HandoverPage /> }],
  ["/mockups/ward-flow/hub", { concrete: "/mockups/ward-flow/hub", render: () => <HubScreen /> }],
  [
    "/mockups/ward-flow/legal-forms",
    { concrete: "/mockups/ward-flow/legal-forms", render: () => <LegalFormsScreen /> },
  ],
  ["/mockups/ward-flow/movements", { concrete: "/mockups/ward-flow/movements", render: () => <MovementsScreen /> }],
  [
    "/mockups/ward-flow/movements/[movementId]",
    {
      concrete: `/mockups/ward-flow/movements/${movement.id}`,
      render: () => <WardPatientWorkspace movementId={movement.id} />,
    },
  ],
  [
    "/mockups/ward-flow/network",
    { concrete: "/mockups/ward-flow/network", render: () => <WardModeWorkspace mode="network" /> },
  ],
  ["/mockups/ward-flow/out-of-area", { concrete: "/mockups/ward-flow/out-of-area", render: () => <OutOfAreaBoard /> }],
  [
    "/mockups/ward-flow/people/[patientId]",
    { concrete: `/mockups/ward-flow/people/${patient.id}`, render: () => <PersonScreen patientId={patient.id} /> },
  ],
  ["/mockups/ward-flow/people/new", { concrete: "/mockups/ward-flow/people/new", render: () => <AddPatientForm /> }],
  ["/mockups/ward-flow/referrals", { concrete: "/mockups/ward-flow/referrals", render: () => <ReferralBoard /> }],
  [
    "/mockups/ward-flow/referrals/new",
    { concrete: "/mockups/ward-flow/referrals/new", render: () => <ReferralBoard defaultSelectFirst /> },
  ],
  ["/mockups/ward-flow/search", { concrete: "/mockups/ward-flow/search", render: () => <PatientSearchPage /> }],
  ["/mockups/ward-flow/settings", { concrete: "/mockups/ward-flow/settings", render: () => <SettingsScreen /> }],
  [
    "/mockups/ward-flow/sovereign",
    { concrete: "/mockups/ward-flow/sovereign", render: () => <SovereignShowcaseScreen /> },
  ],
  // Read-only reports, 9 Oct 2026 (stream C).
  [
    "/mockups/ward-flow/reports/chronology",
    {
      concrete: "/mockups/ward-flow/reports/chronology",
      render: () => <PatientChronologyScreen initialPatientId="PT-013" />,
    },
  ],
  [
    "/mockups/ward-flow/reports/downtime",
    { concrete: "/mockups/ward-flow/reports/downtime", render: () => <DowntimePackScreen /> },
  ],
  [
    "/mockups/ward-flow/statistics/weekly",
    { concrete: "/mockups/ward-flow/statistics/weekly", render: () => <WeeklyReportScreen /> },
  ],
  [
    "/mockups/ward-flow/statistics/services",
    { concrete: "/mockups/ward-flow/statistics/services", render: () => <StatisticsServicesIndexScreen /> },
  ],
  [
    "/mockups/ward-flow/statistics/wards",
    { concrete: "/mockups/ward-flow/statistics/wards", render: () => <StatisticsWardsIndexScreen /> },
  ],
  [
    "/mockups/ward-flow/statistics/eds",
    { concrete: "/mockups/ward-flow/statistics/eds", render: () => <StatisticsEdsIndexScreen /> },
  ],
  [
    "/mockups/ward-flow/statistics/teams",
    { concrete: "/mockups/ward-flow/statistics/teams", render: () => <StatisticsTeamsIndexScreen /> },
  ],
  ["/mockups/ward-flow/statistics", { concrete: "/mockups/ward-flow/statistics", render: () => <StatisticsScreen /> }],
  [
    "/mockups/ward-flow/statistics/compare",
    { concrete: "/mockups/ward-flow/statistics/compare", render: () => <StatisticsCompareScreen /> },
  ],
  [
    "/mockups/ward-flow/statistics/ed/[edId]",
    { concrete: `/mockups/ward-flow/statistics/ed/${ed.id}`, render: () => <StatisticsEdScreen edId={ed.id} /> },
  ],
  [
    "/mockups/ward-flow/statistics/overview",
    { concrete: "/mockups/ward-flow/statistics/overview", render: () => <StatisticsOverviewScreen /> },
  ],
  [
    "/mockups/ward-flow/statistics/service/[serviceId]",
    {
      concrete: `/mockups/ward-flow/statistics/service/${encodeURIComponent(service)}`,
      render: () => <StatisticsServiceScreen serviceId={service} />,
    },
  ],
  [
    "/mockups/ward-flow/statistics/community/[teamId]",
    {
      concrete: `/mockups/ward-flow/statistics/community/${team.id}`,
      render: () => <StatisticsCommunityScreen teamId={team.id} />,
    },
  ],
  [
    "/mockups/ward-flow/statistics/ward/[unitId]",
    {
      concrete: `/mockups/ward-flow/statistics/ward/${unit.id}`,
      render: () => <StatisticsWardScreen unitId={unit.id} />,
    },
  ],
  [
    "/mockups/ward-flow/transport/officer",
    { concrete: "/mockups/ward-flow/transport/officer", render: () => <OfficerScreen /> },
  ],
  [
    "/mockups/ward-flow/ward/[unitId]",
    { concrete: `/mockups/ward-flow/ward/${unit.id}`, render: () => <WardScreen unitId={unit.id} /> },
  ],
  [
    "/mockups/ward-flow/ward/[unitId]/answer",
    {
      concrete: `/mockups/ward-flow/ward/${unit.id}/answer`,
      render: () => <WardScreen unitId={unit.id} presentation="answer" />,
    },
  ],
  ["/mockups/ward-flow/wards", { concrete: "/mockups/ward-flow/wards", render: () => <WardIndex /> }],
]);

function renderRoute(node: ReactElement) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

/* --------------------------------------------------------------------------------------------- *
 * Coverage: the registry above must exactly match disk, minus redirect-only routes. This is what
 * stops the registry from becoming a fourth hand-maintained route census that silently drifts —
 * a route added to disk with no entry here fails loudly instead of just never being examined.
 * --------------------------------------------------------------------------------------------- */

const diskRoutes = scanWardFlowRoutes();
const renderableDiskRoutes = diskRoutes.filter((entry) => !entry.redirectOnly);
const redirectRoutes = diskRoutes.filter((entry) => entry.redirectOnly);

describe("route registry coverage (so nothing below can pass by examining nothing)", () => {
  it("found more than 25 Ward Flow routes on disk, most of them renderable", () => {
    expect(diskRoutes.length).toBeGreaterThan(25);
    expect(renderableDiskRoutes.length).toBeGreaterThan(20);
  });

  it("has exactly one render entry per renderable route, and no entry for a route that is gone or redirect-only", () => {
    const registered = [...ROUTE_RENDERERS.keys()].sort();
    const expected = renderableDiskRoutes.map((entry) => entry.route).sort();
    expect(registered).toEqual(expected);

    const redirectRouteSet = new Set(redirectRoutes.map((entry) => entry.route));
    for (const key of ROUTE_RENDERERS.keys()) {
      expect(redirectRouteSet.has(key), `${key} is redirect-only and should not be in ROUTE_RENDERERS`).toBe(false);
    }
  });
});

/* --------------------------------------------------------------------------------------------- *
 * Pass 1: render every route once, recording whether its main landmark is non-empty. This feeds
 * the "links to a real but empty target" check in pass 2, and is kept as its own pass because a
 * link's target may be a route rendered earlier OR later in registry order.
 * --------------------------------------------------------------------------------------------- */

type RenderOutcome = { ok: true; mainNonEmpty: boolean } | { ok: false; error: string };

const renderOutcomes = new Map<string, RenderOutcome>();

function runPass1() {
  for (const [abstractRoute, entry] of ROUTE_RENDERERS) {
    try {
      const { container, unmount } = renderRoute(entry.render());
      const main = container.querySelector("#main-content") ?? container.querySelector("main");
      const mainNonEmpty = (main?.textContent ?? "").trim().length > 0;
      renderOutcomes.set(abstractRoute, { ok: true, mainNonEmpty });
      unmount();
      cleanup();
    } catch (error) {
      renderOutcomes.set(abstractRoute, { ok: false, error: error instanceof Error ? error.message : String(error) });
      cleanup();
    }
  }
}

function mainNonEmptyForHref(href: string, routes: ReturnType<typeof scanAppRoutes>): boolean | undefined {
  const clean = (href.split("?")[0] ?? href).split("#")[0] ?? href;
  const normalised = clean.length > 1 && clean.endsWith("/") ? clean.slice(0, -1) : clean;
  for (const [abstractRoute, entry] of ROUTE_RENDERERS) {
    if (entry.concrete === normalised) {
      const outcome = renderOutcomes.get(abstractRoute);
      return outcome?.ok ? outcome.mainNonEmpty : undefined;
    }
  }
  // Not one of the concrete instances this file rendered (a different dynamic instance, or a
  // route outside Ward Flow entirely). `routes` still tells us it resolves to SOME page on disk;
  // whether that page's main is empty is unknown, so this is deliberately "cannot tell" rather
  // than a false positive or negative.
  void routes;
  return undefined;
}

/* --------------------------------------------------------------------------------------------- *
 * Control classification helpers.
 * --------------------------------------------------------------------------------------------- */

type ReactPropBag = Record<string, unknown>;

function reactPropsOf(el: Element): ReactPropBag | undefined {
  const key = Object.keys(el).find((candidate) => candidate.startsWith("__reactProps$"));
  if (!key) return undefined;
  return (el as unknown as Record<string, ReactPropBag>)[key];
}

function hasReactHandler(el: Element): boolean {
  const own = reactPropsOf(el);
  if (own && ["onClick", "onChange", "onSubmit"].some((k) => typeof own[k] === "function")) return true;
  const form = el.closest("form");
  if (form) {
    const formProps = reactPropsOf(form);
    if (formProps && typeof formProps.onSubmit === "function") return true;
  }
  return false;
}

function accessibleName(el: Element): string {
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  const value = el.getAttribute("value")?.trim();
  if (value) return value;
  const title = el.getAttribute("title")?.trim();
  if (title) return title;
  return "(no accessible name)";
}

/**
 * D4's own sentence, a non-empty `title`, or non-empty `aria-describedby` text — the same
 * disjunction `ward-settings-not-wired-controls.dom.test.tsx` already proves for its nine rows,
 * generalised to every control this file examines.
 */
function disabledWithStatedReason(el: Element): boolean {
  const ariaDisabled = el.getAttribute("aria-disabled") === "true";
  const nativeDisabled = (el as HTMLButtonElement).disabled === true;
  if (!ariaDisabled && !nativeDisabled) return false;

  if ((el.textContent ?? "").includes(NOT_WIRED)) return true;
  if ((el.getAttribute("title") ?? "").trim().length > 0) return true;

  const describedBy = el.getAttribute("aria-describedby");
  if (describedBy) {
    for (const id of describedBy.split(/\s+/).filter(Boolean)) {
      const node = el.ownerDocument.getElementById(id);
      if (node && (node.textContent ?? "").trim().length > 0) return true;
    }
  }
  return false;
}

type Verdict = { dead: false } | { dead: true; reason: string };

/**
 * `container` is the same rendered root the control came from, needed for the `#fragment` case:
 * a same-page jump link is a real, wired navigation (`ward-screen.tsx`'s "Complete today's
 * return" jumps to `#ward-daily-return` on the same screen) and is OK exactly when its target id
 * exists somewhere in the rendered page — DEAD when it names an id nothing on the page has.
 */
function classify(el: Element, container: ParentNode, appRoutes: ReturnType<typeof scanAppRoutes>): Verdict {
  if (disabledWithStatedReason(el)) return { dead: false };

  if (el.tagName.toLowerCase() === "a") {
    const href = el.getAttribute("href")?.trim();
    if (href) {
      if (/^(https?:|mailto:|tel:)/i.test(href)) return { dead: false };
      if (href.startsWith("#")) {
        const fragment = href.slice(1);
        if (fragment.length === 0) return { dead: true, reason: "href is bare '#' — no target and no handler" };
        const target = container.querySelector(`#${CSS.escape(fragment)}`);
        if (target) return { dead: false };
        return { dead: true, reason: `anchors to '#${fragment}', which has no matching id anywhere on this page` };
      }
      if (hrefResolvesToRoute(href, appRoutes)) {
        const targetEmpty = mainNonEmptyForHref(href, appRoutes) === false;
        if (targetEmpty) return { dead: true, reason: `links to ${href}, which renders an empty main landmark` };
        return { dead: false };
      }
    }
  }

  if (hasReactHandler(el)) return { dead: false };

  return {
    dead: true,
    reason: "no href to a route on disk, no click/change/submit handler, not disabled with a stated reason",
  };
}

const CONTROL_SELECTOR = 'button, a, [role="button"], [role="menuitem"], select, input[type="submit"]';

/* --------------------------------------------------------------------------------------------- *
 * Pass 2: render again, classify every control.
 * --------------------------------------------------------------------------------------------- */

type DeadEntry = { route: string; role: WardChromeRole; name: string; reason: string };

const appRoutes = scanAppRoutes();
const deadFound: DeadEntry[] = [];
const renderFailures: { route: string; error: string }[] = [];
let routesExamined = 0;
let controlsExamined = 0;

function runPass2() {
  for (const [abstractRoute, entry] of ROUTE_RENDERERS) {
    const outcome = renderOutcomes.get(abstractRoute);
    if (!outcome?.ok) {
      if (outcome) renderFailures.push({ route: entry.concrete, error: outcome.error });
      continue;
    }

    const role = wardChromeRole(entry.concrete);
    try {
      const { container, unmount } = renderRoute(entry.render());
      routesExamined += 1;
      const controls = [...container.querySelectorAll(CONTROL_SELECTOR)];
      for (const control of controls) {
        controlsExamined += 1;
        const verdict = classify(control, container, appRoutes);
        if (verdict.dead) {
          deadFound.push({ route: entry.concrete, role, name: accessibleName(control), reason: verdict.reason });
        }
      }
      unmount();
      cleanup();
    } catch (error) {
      renderFailures.push({ route: entry.concrete, error: error instanceof Error ? error.message : String(error) });
      cleanup();
    }
  }
}

/**
 * Both passes run from `beforeAll` rather than at module top level. The jsdom project's own
 * `beforeEach` (matchMedia/`scrollIntoView` stubs, in `tests/setup/jsdom.setup.ts`) has not fired
 * yet at module-collection time, so a render loop running during collection hits a bare
 * `window.matchMedia is not a function` on the first screen that touches it. `installMatchMediaStub`
 * is called directly here for that reason, rather than relying on hook ordering this file does not
 * control.
 */
beforeAll(() => {
  installMatchMediaStub(false);
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
  runPass1();
  runPass2();
}, 120_000);

/**
 * 🔴 **TODAY'S FINDINGS, HELD EXPLICITLY SO THIS FILE FAILS ON A NEW DEAD CONTROL AND ON A FIXED
 * ONE THAT NOBODY REMOVED THE ENTRY FOR.** Recorded from the first real run of this file
 * (2026-09-17) — see this task's final report for the measured counts and the reasoning behind
 * each row. This list must only shrink: fixing a control removes its row; a genuinely new dead
 * control is a new row, never silently absorbed by widening the match.
 */
const KNOWN_DEAD_ENDS: readonly DeadEntry[] = [];

describe("Ward Flow has no dead-end controls (or every one is named here with a reason)", () => {
  it("rendered enough routes and examined enough controls that the assertions below mean something", () => {
    // Measured on the first real run (2026-09-17): routesExamined=35, controlsExamined=1443, zero
    // render failures. Floors set at roughly 90% of that measurement so ordinary content changes
    // do not trip them, while a scan that silently rendered nothing or found no interactive
    // elements — the shape every "this list is empty" assertion below is vulnerable to — still
    // fails loudly instead of passing over nothing.
    expect(routesExamined, "too few routes rendered — the render loop is broken, not the screens").toBeGreaterThan(30);
    expect(
      controlsExamined,
      "too few controls examined — the control selector or the render loop is broken",
    ).toBeGreaterThan(1250);
  });

  it("failed to render no route (each failure is a defect this file cannot classify controls on)", () => {
    expect(renderFailures, JSON.stringify(renderFailures, null, 2)).toEqual([]);
  });

  it("has no dead control beyond what KNOWN_DEAD_ENDS already records", () => {
    const known = new Set(KNOWN_DEAD_ENDS.map((entry) => `${entry.route}::${entry.role}::${entry.name}`));
    const newlyDead = deadFound.filter((entry) => !known.has(`${entry.route}::${entry.role}::${entry.name}`));
    expect(
      newlyDead,
      "these controls are DEAD (no working href, no handler, not disabled with a stated reason) and " +
        "are not recorded in KNOWN_DEAD_ENDS. Wire the control, give it a disabled reason, or add an " +
        "entry recording why it is outstanding.",
    ).toEqual([]);
  });

  it("holds no stale KNOWN_DEAD_ENDS entry (a control that is fixed must have its row deleted)", () => {
    const stillDead = new Set(deadFound.map((entry) => `${entry.route}::${entry.role}::${entry.name}`));
    const stale = KNOWN_DEAD_ENDS.filter((entry) => !stillDead.has(`${entry.route}::${entry.role}::${entry.name}`));
    expect(
      stale,
      "these KNOWN_DEAD_ENDS entries no longer reproduce as dead — the control was fixed. Delete the " +
        "entry; a register of gaps that keeps closed ones is a list of things that used to be true.",
    ).toEqual([]);
  });
});
