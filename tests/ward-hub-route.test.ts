/**
 * The Master Search Hub route (`/mockups/ward-flow/hub`, `src/app/mockups/ward-flow/hub/page.tsx`).
 * A thin binding, in the house pattern every other Ward Flow route follows (see
 * `src/app/mockups/ward-flow/search/page.tsx`, `.../capacity/page.tsx`): a `Metadata` export
 * naming the screen and stating this is a synthetic prototype, and a default component that
 * renders one real component and nothing else.
 *
 * 🔴 **THIS ROUTE IS DELIBERATELY UNREGISTERED ELSEWHERE, AND THAT IS OUT OF SCOPE HERE.** Two
 * existing structural gates enumerate the Ward Flow route tree against a hand-maintained record,
 * and both go red the moment this file exists, for reasons that have nothing to do with a defect
 * in this route:
 *
 *   - `tests/ward-route-component-binding.test.ts` — "has a pinned row for every route on disk,
 *     and no row for a route that is gone" fails because `PINNED` has no `hub` entry.
 *   - `tests/ward-nav.test.ts` — "finds every known page.tsx …" fails because it pins the route
 *     count at 33 (this makes 34), and "every static Ward Flow route appears in the navigation or
 *     is recorded as intentionally unlisted" fails because `/mockups/ward-flow/hub` is in neither
 *     `WARD_NAV` nor `WARD_NAV_INTENTIONALLY_UNLISTED`.
 *
 * Both are owned by files this task must not edit (`ward-nav.ts` is being edited concurrently by
 * another agent; the coordinator has not yet said who adds the rail entry), so neither is "fixed"
 * here — doing so would mean guessing the PINNED label and the nav wording on someone else's
 * behalf, and weakening either existing test to admit an unregistered route would defeat the whole
 * point of the two-way check they enforce. The one-line diff that WOULD register this route in
 * `ward-nav.ts` is recorded in this task's own final report instead.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { communityTeamById } from "@/components/ward-management/community/community-derivations";

import { hubEntries, type HubKind } from "@/components/ward-management/hub/hub-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, allUnits, edById, unitById } from "@/components/ward-management/ward-sites";

const ROUTE_FILE = "src/app/mockups/ward-flow/hub/page.tsx";

function readRoute(): string {
  return readFileSync(resolve(process.cwd(), ROUTE_FILE), "utf8");
}

describe("Ward Flow hub route (/mockups/ward-flow/hub)", () => {
  it("exists on disk", () => {
    expect(() => readRoute()).not.toThrow();
  });

  it("exports a Metadata object with a non-empty title, and a description that states this is a synthetic prototype", () => {
    const source = readRoute();
    const metadataBlock = /export const metadata:\s*Metadata\s*=\s*\{([\s\S]*?)\};/u.exec(source);
    expect(metadataBlock, "no `export const metadata: Metadata = {...}` block found").not.toBeNull();
    const body = metadataBlock?.[1] ?? "";

    const titleMatch = /title:\s*["'`]([^"'`]+)["'`]/u.exec(body);
    expect(titleMatch, "metadata has no title").not.toBeNull();
    expect((titleMatch?.[1] ?? "").trim().length, "metadata title is empty").toBeGreaterThan(0);

    const descriptionMatch = /description:\s*["'`]([^"'`]+)["'`]/u.exec(body);
    expect(descriptionMatch, "metadata has no description").not.toBeNull();
    expect(
      descriptionMatch?.[1] ?? "",
      "the description must state this is a synthetic prototype, matching every other Ward Flow route " +
        "(see search/page.tsx, capacity/page.tsx) — a clinical prototype must never let a reader mistake " +
        "this for a real, validated screen",
    ).toMatch(/synthetic prototype/i);
  });

  it("exports a default component", () => {
    expect(readRoute()).toMatch(/export default function \w+/u);
  });

  /**
   * Mirrors `componentRenderedBy` in `tests/ward-route-component-binding.test.ts`: reads the
   * default export's own JSX rather than scanning its imports. An import can survive long after
   * the JSX using it is deleted or swapped — that file's own header comment explains why a scan
   * of the RENDERED body is the only version of this check an import cannot fool.
   */
  it("renders HubScreen, and only HubScreen — no second component alongside it", () => {
    const source = readRoute();
    const body = source.slice(source.indexOf("export default"));
    expect(body.length, "no default export found to scan").toBeGreaterThan(0);

    const jsxTags = [...body.matchAll(/<([A-Z][A-Za-z0-9]*)/gu)].map((match) => match[1]);
    expect(jsxTags, "the default export renders no JSX component at all").not.toEqual([]);
    expect(new Set(jsxTags), "the route renders something other than exactly HubScreen").toEqual(
      new Set(["HubScreen"]),
    );
  });

  it("imports HubScreen from its own module, and imports no other component", () => {
    const source = readRoute();
    const componentImportLines = source.split("\n").filter((line) => /from\s*["'`]@\/components\//u.test(line));
    expect(
      componentImportLines,
      `expected exactly one @/components import (HubScreen); found: ${JSON.stringify(componentImportLines)}`,
    ).toHaveLength(1);
    expect(componentImportLines[0]).toMatch(
      /import\s*\{\s*HubScreen\s*\}\s*from\s*["'`]@\/components\/ward-management\/hub\/hub-screen["'`]/u,
    );
  });
});

/**
 * PHASE 5 — EVERY DESTINATION THE HUB OFFERS IS A ROUTE THAT EXISTS.
 *
 * 🔴 **A HUB IS NOTHING BUT INTERNAL LINKS, AND A BROKEN ONE LOOKS EXACTLY LIKE A WORKING ONE.**
 * Next's dynamic segments make this worse, not better: `/mockups/ward-flow/ward/anything-at-all`
 * resolves, renders a page, and returns 200. Nothing about the URL tells you the id was real. So
 * "the link works" cannot be established by following it — only by checking the id against the
 * fixture it came from, and the route against the filesystem.
 *
 * ⚠️ **THIS IS THE OFFLINE HALF OF A CHECK WHOSE OTHER HALF NEEDS A BROWSER.** On 2026-09-06 all 41
 * destinations were walked against the running dev server and every one rendered its own subject:
 * 32 distinct URLs, 0 not-found renders, 0 thin pages, 0 page errors. **That run proves rendering
 * and this test cannot; this test runs on every commit and that run does not.** Neither replaces
 * the other, and a ward end-to-end spec is in neither `verify:ui` nor `test:focused`'s selection,
 * so a browser-only guard here would be a guard nothing executes.
 */
describe("Ward Flow hub — every destination it offers resolves to a route on disk", () => {
  const ROUTE_ROOT = resolve(process.cwd(), "src/app/mockups/ward-flow");

  /** A concrete href maps to a page.tsx by substituting each dynamic segment back in. */
  function routeFileFor(href: string): string | undefined {
    const rest = href.replace("/mockups/ward-flow", "").replace(/^\//, "");
    const segments = rest === "" ? [] : rest.split("/");
    // Try the static path first, then progressively treat trailing segments as dynamic values.
    const candidates = [
      [...segments],
      segments.length > 0
        ? [...segments.slice(0, -1), `[${DYNAMIC_SEGMENT_NAMES[segments.slice(0, -1).join("/")] ?? "id"}]`]
        : [],
    ];
    for (const candidate of candidates) {
      const file = resolve(ROUTE_ROOT, ...candidate, "page.tsx");
      if (existsSync(file)) return file;
    }
    return undefined;
  }

  /** The parameter name each dynamic route uses, read from disk rather than guessed. */
  const DYNAMIC_SEGMENT_NAMES: Record<string, string> = {
    ward: "unitId",
    ed: "edId",
    community: "teamId",
  };

  const entries = hubEntries({ units: allUnits(), bedReleases: [], now: NOW_ANCHOR });

  it("floors the population: the hub offers destinations of all three kinds, so this test has something to discriminate", () => {
    const kinds = new Set(entries.map((entry) => entry.kind));
    expect(entries.length, "the hub produced no entries — every assertion below would pass vacuously").toBeGreaterThan(
      0,
    );
    expect([...kinds].sort()).toEqual(["community", "ed", "ward"]);
  });

  it("every href points at a page.tsx that exists", () => {
    const missing = entries.filter((entry) => routeFileFor(entry.href) === undefined);
    expect(
      missing.map((entry) => `${entry.name} -> ${entry.href}`),
      "the hub offers destinations with no route on disk",
    ).toEqual([]);
  });

  /**
   * ⚠️ **THE HALF THAT A ROUTE-EXISTS CHECK CANNOT SEE.** A dynamic route exists for every id,
   * including ones the fixture has never heard of, so "the page.tsx exists" is satisfied by a
   * typo. The id itself has to come from the same source the destination screen resolves against.
   */
  it("every ward and ED href carries an id the fixture actually knows", () => {
    const wrong: string[] = [];
    for (const entry of entries) {
      if (entry.kind === "ward") {
        const id = entry.href.split("/").pop() ?? "";
        if (unitById(id) === undefined) wrong.push(`${entry.name} -> ${entry.href} (no such unit)`);
      }
      if (entry.kind === "ed") {
        const id = entry.href.split("/").pop() ?? "";
        if (edById(id) === undefined) wrong.push(`${entry.name} -> ${entry.href} (no such emergency department)`);
      }
    }
    expect(wrong, "a hub link would land on a page that cannot find its subject").toEqual([]);
  });

  /**
   * 🔴 **AN ED ENTRY POINTING AT THE WARD ROUTE PASSED EVERY OTHER ASSERTION HERE.** Found by
   * mutating the href to `/mockups/ward-flow/ward/${ed.id}` and watching this file stay green.
   *
   * Both of the checks above were satisfied, each for a good reason: `ward/[unitId]/page.tsx`
   * exists on disk, so "the route exists" held; and the id in the last segment was still the real
   * `ed.id`, so `edById` found it. **Nothing compared the route FAMILY against the entry's kind**,
   * and the result would have been a coordinator clicking an emergency department and landing on a
   * ward page that renders "no such ward" — an href that resolves, returns 200, and is not an
   * arrival.
   *
   * The map is derived from the kind rather than written as three ifs, so a fourth kind cannot be
   * added without deciding where it points.
   */
  it("every href points at the route family matching its kind, not merely at a route that exists", () => {
    /**
     * ⚠️ **PREDICATES, NOT PREFIX STRINGS, AND WARD VERIFIER IS THE REASON.**
     *
     * This was three prefixes. Two carried a trailing slash and one did not, and a prefix without
     * a trailing slash is porous: `/mockups/ward-flow/wards/{realUnitId}` startsWith
     * `/mockups/ward-flow/ward`, so a one-character typo would have passed BOTH this check and the
     * id check above it. Verifier's attack found that the only entry missing the slash —
     * `community` — is also the one kind that cannot be bitten by it, because its route is static
     * and pinned by exact equality below.
     *
     * **That was true and it was luck.** A future kind added to this map inherits whichever style
     * its author copies, and the porous one looks identical to the safe one. Expressed as a
     * predicate per kind, the question "prefix or exact?" has to be answered rather than inherited,
     * and a dynamic route cannot be written with a bare prefix by accident.
     */
    const ROUTE_FAMILY: Record<HubKind, (href: string) => boolean> = {
      // Dynamic: an id follows, so the separator is part of the claim.
      ward: (href) => href.startsWith("/mockups/ward-flow/ward/"),
      ed: (href) => href.startsWith("/mockups/ward-flow/ed/"),
      // Dynamic since 2026-09-18. This was exact-equality against the bare index, because the hub
      // listed ten REGION placeholders whose slugs resolved against COMMUNITY_TEAM_PAGES to
      // nothing — an href that lands on "No community team matches…" is not an arrival, so the
      // rows deliberately pointed at the index instead. The hub now lists the real catchment teams
      // and takes each id from the same list the route resolves against, so every row reaches its
      // own page. Kept as a prefix test on the same family, not loosened to "contains".
      community: (href) => href.startsWith("/mockups/ward-flow/community/"),
    };
    const wrong = entries
      .filter((entry) => !ROUTE_FAMILY[entry.kind](entry.href))
      .map((entry) => `${entry.kind} "${entry.name}" -> ${entry.href}`);
    expect(wrong, "a hub entry's href lands on the wrong kind of screen").toEqual([]);
  });

  /**
   * ⚠️ **ONE LINE OF RESIDUE, RECORDED BECAUSE IT EXPIRES QUIETLY.** Every entry above is built with
   * `bedReleases: []`. That is harmless for these assertions — a bed release reaches only
   * `unitCapacity` and `bedsPendingPreparation`, i.e. FIGURES on an entry, never its existence and
   * never its href, which is built from `unit.id` alone. **But any future assertion in this file
   * about a COUNT would be counting a population that does not occur in the app.** Ward Verifier's
   * fourth attack; closed by construction today, and this is the note that survives the closing.
   */
  it("the fixture this file walks is the one the screen renders: no entry depends on a bed release", () => {
    const withReleases = hubEntries({
      units: allUnits(),
      bedReleases: seedWardFlowState().bedReleases,
      now: NOW_ANCHOR,
    });
    // Same entries, same destinations — only the figures may differ.
    expect(withReleases.map((entry) => `${entry.kind}:${entry.id}:${entry.href}`)).toEqual(
      entries.map((entry) => `${entry.kind}:${entry.id}:${entry.href}`),
    );
  });

  /**
   * The community entries deliberately all point at the shared index rather than a per-region page,
   * because `/community/[teamId]` resolves a DIFFERENT vocabulary — referral-recorded clinic names,
   * which share no names with the region-keyed placeholder list the hub renders. A slugified region
   * pointed at that route would resolve, render, and say "no community team matches" — an href that
   * is not an arrival. This pins the deliberate choice so a future "fix" has to argue with it.
   */
  /**
   * ⚠️ REVERSED ON 2026-09-18, AND THE OLD ASSERTION WAS RIGHT WHEN IT WAS WRITTEN. It required
   * every community row to point at the BARE INDEX, because the hub listed ten region placeholders
   * from `ward-teams.ts` whose slugs resolved against `COMMUNITY_TEAM_PAGES` to nothing. Pointing
   * each at its own page would have landed the reader on "No community team matches…", and an href
   * that reaches a screen while dropping the thing it was pointing at is not an arrival.
   *
   * The cause is gone rather than the symptom: the hub now lists the real catchment teams and takes
   * each id from the same list the route resolves against. So the requirement inverts — every row
   * must now reach ITS OWN page, and `communityTeamById` must resolve every one of them.
   */
  it("every community entry reaches its own team page, and that page resolves", () => {
    const community = entries.filter((entry) => entry.kind === "community");
    expect(community.length).toBeGreaterThan(1);
    const unresolved = community
      .map((entry) => ({ entry, id: entry.href.match(/\/community\/([^/?#]+)$/)?.[1] }))
      .filter(({ id }) => id === undefined || communityTeamById(id) === null)
      .map(({ entry }) => `${entry.name} -> ${entry.href}`);
    expect(unresolved, "a hub row points at a team page that resolves to nothing").toEqual([]);
    // Distinct pages, or the hub would be collapsing several teams onto one screen.
    expect(new Set(community.map((entry) => entry.href)).size).toBe(community.length);
  });
});
