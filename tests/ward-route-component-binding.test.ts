import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **WHICH COMPONENT EACH WARD ROUTE RENDERS, PINNED — BECAUSE NOTHING ELSE ASSERTS IT AND A
 * SWAP GOES GREEN.**
 *
 * Ward Lead's ruling, 2026-09-05, arising from the community pair. `CommunityHome` and
 * `CommunityTeamHub` exist, are tested, use the second-edition primitives, and are rendered by no
 * route; `CommunityIndex` and `CommunityScreen` are the live pair. **Repointing
 * `community/page.tsx` at the newer component would leave every one of the thirty testids and every
 * pinned sentence green, because every one of those tests reaches the COMPONENT and not the
 * route** — while the live page silently lost the governance prose those tests were written to
 * protect. In review it would look like a redesign.
 *
 * ⚠️ **THE GAP IS STRUCTURAL, NOT A LAPSE.** A component suite cannot see which route renders it,
 * and a route file has almost nothing in it to assert against. So the binding is the thing with no
 * owner, and "be careful" is not a control. **One assertion per route is cheaper than any amount
 * of care**, and it is the whole of this file.
 *
 * ⚠️ **THIS PINS THE BINDING, NOT THE BEHAVIOUR.** A route may legitimately change what it renders
 * — that is what a redesign is. What may not happen is for it to change without anybody deciding:
 * this goes red, the diff says which route and which component, and a reviewer gets the sentence
 * "you are changing what the live page is" instead of a green tick.
 */

const ROUTES_DIR = "src/app/mockups/ward-flow";

/**
 * ⚠️ **PARSED FROM THE DEFAULT EXPORT'S BODY, NOT FROM THE WHOLE FILE.** Every one of these files
 * imports the component it renders, so a scan for an import would find the right name for the wrong
 * reason and would keep finding it after the JSX stopped using it — the exact shape of a check that
 * cannot fail. What is read is the first capitalised JSX tag actually returned.
 *
 * A route that renders no component at all returns `null` rather than throwing: `constellation`
 * legitimately calls `redirect()` and renders nothing, and a parser that treated that as an error
 * would be pinning a bug report rather than a fact.
 */
function componentRenderedBy(source: string): string | null {
  const body = source.slice(source.indexOf("export default"));
  if (body === "") return null;
  const jsx = /<([A-Z][A-Za-z0-9]*)/u.exec(body);
  if (jsx) return jsx[1];
  const redirected = /\bredirect\(\s*["'`]([^"'`]+)/u.exec(body);
  return redirected ? `redirect:${redirected[1]}` : null;
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? routeFiles(join(dir, entry.name)) : entry.name === "page.tsx" ? [join(dir, entry.name)] : [],
  );
}

/** Route path relative to the ward-flow root, `/` for the root page itself. */
function routeOf(file: string): string {
  const relative = file
    .replace(/\\/gu, "/")
    .slice(`${ROUTES_DIR}/`.length)
    .replace(/\/?page\.tsx$/u, "");
  return relative === "" ? "/" : relative;
}

/**
 * Measured from disk on 2026-09-05, not transcribed from a document.
 *
 * ⚠️ **THE TWO COMMUNITY ROWS ARE THE REASON THIS FILE EXISTS, AND THEY ARE CORRECT AS WRITTEN.**
 * `CommunityIndex` and `CommunityScreen` are the first-edition pair and they are what ships. The
 * second-edition `CommunityHome` / `CommunityTeamHub` are deliberately absent from this map because
 * they are deliberately absent from the routes — built ahead of the community role, which
 * `ward-role-switcher.tsx` does not carry. **When the adoption lands, these two rows stay exactly as
 * they are:** the ruling is that the language moves INTO these components, never that the routes
 * are repointed at the others.
 */
const PINNED: Record<string, string | null> = {
  "/": "CoordinatorScreen",
  // ⚠️ ADDED 2026-09-12 with the Alerts screen. 🔴 This is a THIRD hand-maintained route census —
  // the Alerts commit moved the two in `ward-nav.test.ts` and `ward-landmarks.test.ts` and said so,
  // and did not know this one existed. A route tally kept by hand in three files is three chances
  // to be complete and one chance to be caught.
  alerts: "AlertsScreen",
  "board/[unitId]": "WardBoard",
  capacity: "CapacityScreen",
  command: "redirect:/mockups/ward-flow",
  community: "CommunityIndex",
  "community/[teamId]": "CommunityScreen",
  constellation: "redirect:/mockups/ward-flow/network",
  delays: "DelaysScreen",
  discharges: "DischargeBoard",
  "on-call": "OnCallScreen",
  ed: "redirect:/mockups/ward-flow/ed/peel-ed",
  "ed/[edId]": "EdScreen",
  escalation: "redirect:/mockups/ward-flow/delays?from=escalation",
  exceptions: "redirect:/mockups/ward-flow/delays?from=exceptions",
  governance: "WardModeWorkspace",
  handover: "HandoverPage",
  hub: "HubScreen",
  // Added 2026-09-12 with the third-edition Legal forms build. ⚠️ A reconciliation is in flight
  // that will change what this screen RENDERS (the two kinds stop being ordered against each
  // other) but not which component the route resolves to, so this row survives it.
  "legal-forms": "LegalFormsScreen",
  // The `morning` row was removed here on 2026-09-17 (item 41, owner-approved): the route itself
  // was deleted outright, not merely repointed to redirect, so there is no page.tsx left on disk
  // for `routeFiles`/`found` to discover and no binding left to pin.
  movements: "MovementsScreen",
  "movements/[movementId]": "WardMovementNotFound",
  network: "WardModeWorkspace",
  "out-of-area": "OutOfAreaBoard",
  "people/[patientId]": "WardMovementNotFound",
  "people/new": "AddPatientForm",
  queue: "redirect:/mockups/ward-flow/delays?from=queue",
  referrals: "ReferralBoard",
  // 8 Oct 2026: the full-page form is retired; this route is the Referrals board with the slide-out open.
  "referrals/new": "ReferralBoard",
  search: "PatientSearchPage",
  // Added 2026-09-12 with the Settings screen. ⚠️ **THIS IS THE SIXTH PINNED TALLY OVER ONE
  // ROUTE, and the comment four rows below already called itself the fourth.** The other five:
  // ward-nav.test.ts's disk count, its RENDERABLE_ROUTES length, ward-landmarks.test.ts's own
  // separate RENDERABLE_ROUTES map and ITS disk count, and this row. **Five of the six went red on
  // the full suite and none of them on any focused run**, because no register imports another and
  // nothing selects a test that reads the filesystem.
  settings: "SettingsScreen",
  sovereign: "SovereignShowcaseScreen",
  statistics: "StatisticsScreen",
  "statistics/compare": "StatisticsCompareScreen",
  "statistics/ed/[edId]": "StatisticsEdScreen",
  "statistics/overview": "StatisticsOverviewScreen",
  "statistics/service/[serviceId]": "StatisticsServiceScreen",
  // 2026-09-08, the fifth statistics section. ⚠️ This is a FOURTH pinned tally over one route,
  // after ward-nav.test.ts's route count, its RENDERABLE_ROUTES and its dynamic-route list — and
  // that file's own comment warns three move together while naming only three. It is the fourth
  // that the full suite caught and the focused runs did not.
  "statistics/community/[teamId]": "StatisticsCommunityScreen",
  "statistics/ward/[unitId]": "StatisticsWardScreen",
  transport: "redirect:/mockups/ward-flow/movements",
  "transport/officer": "OfficerScreen",
  "ward/[unitId]": "WardScreen",
  // The Answer presentation is a distinct reachable route over the same authoritative WardScreen;
  // the route selects presentation only and does not copy its reducer or actions.
  "ward/[unitId]/answer": "WardScreen",
  wards: "WardIndex",
};

describe("every ward route renders the component it is pinned to", () => {
  const files = routeFiles(ROUTES_DIR);
  const found = Object.fromEntries(
    files.map((file) => [routeOf(file), componentRenderedBy(readFileSync(file, "utf8"))]),
  );

  /**
   * ⚠️ **THE FLOOR IS ON THE ROUTES WALKED, NEVER ON THE MATCHES.** Every assertion below is of the
   * form "this route renders that component". A walk that found no routes satisfies all of them
   * perfectly, and a directory rename is enough to produce one.
   */
  it("walks the whole route tree, so nothing below can pass on an empty set", () => {
    expect(files.length, "no ward routes were found on disk").toBeGreaterThan(25);
    expect(Object.keys(found).length, "two routes collapsed to one key").toBe(files.length);
  });

  /**
   * Both directions in one assertion. A new route with no pinned row is as much a gap as a pinned
   * row whose route has gone — the first is an unwatched page, the second a pin watching nothing.
   */
  it("has a pinned row for every route on disk, and no row for a route that is gone", () => {
    expect(Object.keys(found).sort()).toEqual(Object.keys(PINNED).sort());
  });

  /**
   * ⚠️ **PER ROUTE, NOT ONE DEEP EQUALITY, AND THE FIRST VERSION WAS THE DEEP EQUALITY.** It caught
   * the mutation correctly and reported `expected { Object (board/[unitId], capacity, ...) } to
   * deeply equal { '/': 'CoordinatorScreen', …(31) }` — true, useless, and it names neither the
   * route that moved nor what it moved to. **A guard exists to be read by whoever it stops, and a
   * message that sends them to diff two thirty-two-key objects is a guard that will be waved
   * through.**
   */
  it.each(Object.entries(PINNED))("route %s renders %s", (route, expected) => {
    expect(
      found[route],
      `${route} renders ${String(found[route])}, not ${String(expected)} — if that is intended, ` +
        `this is the line that says so, and the live page has just changed`,
    ).toBe(expected);
  });
});
