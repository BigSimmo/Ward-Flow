import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors and this suite
// reads hrefs rather than actually navigating, so a plain <a> avoids an App Router context jsdom
// cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The sidebar orders itself by the route's role (`ward-nav-role-order.ts`), so this suite has to
// be able to say which route it is standing on. Mutable-state mock idiom, as in
// `tests/ward-shell.dom.test.tsx`.
const route = { pathname: "/mockups/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { attentionRows } from "@/components/ward-management/ward-sidebar-content";
import { ClinicalRail } from "@/components/ward-management/ward-management-navigation";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_NAV, WARD_VIEWS } from "@/components/ward-management/ward-nav";
import { WARD_SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/components/ward-management/use-ward-sidebar-collapsed";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { buildActionInbox, destinationUnit, isOpen } from "@/components/ward-management/ward-derivations";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { SEVERE_CAUSES, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { referralState } from "@/components/ward-management/ward-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const COORDINATOR_ROUTE = "/mockups/ward-flow";
const WARD_ROUTE = "/mockups/ward-flow/board/rph-adult-secure";
const ED_ROUTE = "/mockups/ward-flow/ed/peel-ed";
// A ward-ish route (`wardChromeRole` treats `/board/` as ward chrome) with no id after the segment
// at all — `wardPlaceIdFor`'s regexes require one or more non-slash characters, so this resolves
// to `undefined` rather than to an empty string.
const WARD_ROUTE_WITH_NO_ID = "/mockups/ward-flow/board/";

/**
 * A link's accessible name now carries its count where it has one — "Delays, 2 needing attention
 * now" — following `mobileSectionItemLabel` in `clinical-dashboard/dashboard-nav.tsx`.
 *
 * ⚠️ **Matched on the label PREFIX, never loosened to a substring.** A substring match would let
 * "Delays" find a hypothetical "Transport delays" and report the wrong link as present; anchoring
 * the start and requiring the next character to be the comma the composer writes keeps the
 * assertion as strict as the `^label$` it replaces, for every label that has no count.
 */
function named(label: string) {
  return new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(,|$)`);
}

function renderRail(pathname = COORDINATOR_ROUTE) {
  route.pathname = pathname;
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ClinicalRail activeMode="delays" />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  route.pathname = COORDINATOR_ROUTE;
  window.localStorage.removeItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY);
});

afterEach(() => {
  window.localStorage.removeItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY);
});

/**
 * The phone drawer.
 *
 * Ward Flow had no phone treatment of any kind before this: `ward-management.module.css` held
 * four media queries, of which two were `prefers-reduced-motion` and `forced-colors` and two
 * named `.workspaceGrid` and `.patientWorkspace`. Not one touched the rail, so a 390px phone
 * rendered the full 4.5rem desktop icon column. Nothing in the test suite could notice, because
 * nothing was structurally wrong — which is why the checks below assert the drawer exists and
 * works, and why `tests/ward-sidebar-phone-contract.test.ts` separately asserts the stylesheet
 * rules that make it reachable.
 */
describe("Ward Flow phone drawer", () => {
  it("opens from the phone bar's menu button and closes again", () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: "Open Ward Flow menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(trigger);

    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Ward Flow")).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Close Ward Flow menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lists every destination by name, which the icon rail can only do in an aria-label", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");

    for (const view of WARD_VIEWS) {
      const link = within(drawer).getByRole("link", { name: named(view.label) });
      expect(link, `${view.label} is missing from the drawer`).toHaveAttribute("href", view.href);
    }
    // Matched on href rather than on accessible name: two of these labels carry an "example" tag
    // inside the link (D10), so the name is the label plus that word.
    const drawerHrefs = within(drawer)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    for (const item of WARD_NAV) {
      expect(drawerHrefs, `${item.label} is missing from the drawer`).toContain(item.href);
    }
    // The entries that name one arbitrary synthetic instance rather than a section of the app say
    // so in words here. The icon rail can only say it in an aria-label nobody reads.
    //
    // THREE at the fold, not two: the ward board (`board/[unitId]`) joined `ward/[unitId]` and
    // `ed/[edId]` as a dynamic route the rail can only ever link one concrete instance of. Moved
    // after confirming the third is the board's rail entry and belongs — not to reach green. The
    // hrefs themselves are pinned as a set in tests/ward-nav.test.ts, which is where a fourth
    // arriving by accident would be caught by name rather than by arithmetic.
    expect(within(drawer).getAllByText("example")).toHaveLength(3);
    // The one legitimate way out of the sandbox.
    expect(within(drawer).getByRole("link", { name: "Back to the developer hub" })).toHaveAttribute(
      "href",
      "/mockups/ward-flow",
    );
  });

  it("closes when a destination is chosen, so the drawer never covers the page it opened", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");
    fireEvent.click(within(drawer).getByRole("link", { name: named("Capacity") }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks the active view current in the drawer as well as in the rail", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");
    // MERGE 01 (2026-09-05) renamed this view's label from "Priority queue" to "Delays" but left
    // its id as `queue`, and these two comments recorded the discrepancy for a day rather than a
    // reason for it. The id became `delays` on 2026-09-06, so `activeMode="delays"` in
    // `renderRail()` now matches the label the assertion queries. The ROUTE `/queue` is untouched
    // and still redirects to `/delays` — the id moved, the path did not.
    expect(within(drawer).getByRole("link", { name: named("Delays") })).toHaveAttribute("aria-current", "page");
    expect(within(drawer).getByRole("link", { name: named("Capacity") })).not.toHaveAttribute("aria-current");
  });
});

/**
 * The desktop expand/collapse pair, mirroring `useSidebarCollapsed` in the clinical application:
 * collapsed on a first visit, remembered per browser afterwards.
 */
describe("Ward Flow desktop sidebar collapse", () => {
  it("starts collapsed, with the icon rail and no labelled panel", () => {
    renderRail();
    expect(screen.getByRole("complementary", { name: "Ward Flow" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Ward Flow sidebar" })).toBeNull();
  });

  it("expands into the labelled panel and remembers the choice", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    const panel = screen.getByRole("complementary", { name: "Ward Flow sidebar" });
    // Same view as the drawer test above: label "Delays", id `delays` since 2026-09-06.
    expect(within(panel).getByRole("link", { name: named("Delays") })).toHaveAttribute("aria-current", "page");
    expect(window.localStorage.getItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("0");

    fireEvent.click(within(panel).getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByRole("complementary", { name: "Ward Flow sidebar" })).toBeNull();
    expect(window.localStorage.getItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("1");
  });

  it("restores a remembered expanded preference on the next visit", () => {
    window.localStorage.setItem(WARD_SIDEBAR_COLLAPSED_STORAGE_KEY, "0");
    renderRail();
    expect(screen.getByRole("complementary", { name: "Ward Flow sidebar" })).toBeTruthy();
  });
});

/**
 * **THE SIDEBAR ORDERS ITSELF BY ROLE, AND THE ROLE IS THE ROUTE** — owner's approved sidebar,
 * 2026-09-06, plus his ruling the same day that a role gets the same real screens reordered rather
 * than links to screens nobody has built.
 *
 * 🔴 **THE MEMBERSHIP ASSERTIONS ABOVE ARE NOT RELAXED FOR THIS — THEY ARE RUN THREE TIMES.** The
 * whole claim being made is that the three sidebars are permutations of one another, so a test that
 * checked membership once and ordering separately would leave the claim untested exactly where it
 * matters. If a future role change drops a destination, the loop below goes red naming the role.
 */
describe("Ward Flow sidebar, by role", () => {
  function drawerHrefs(pathname: string) {
    // Three roles are compared inside ONE test, and RTL only auto-cleans BETWEEN tests: without
    // this, the second render leaves two rails in the document and every query finds two matches.
    cleanup();
    renderRail(pathname);
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    return within(screen.getByRole("dialog"))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
  }

  it.each([
    ["coordinator", COORDINATOR_ROUTE],
    ["ward", WARD_ROUTE],
    ["ed", ED_ROUTE],
  ])("offers every destination in the %s role, none added and none dropped", (_role, pathname) => {
    const hrefs = drawerHrefs(pathname);
    for (const view of WARD_VIEWS) {
      expect(hrefs, `${view.label} is missing`).toContain(view.href);
    }
    for (const item of WARD_NAV) {
      expect(hrefs, `${item.label} is missing`).toContain(item.href);
    }
  });

  it("puts a ward's own bed board first and an emergency department's movements first", () => {
    const coordinator = drawerHrefs(COORDINATOR_ROUTE);
    const ward = drawerHrefs(WARD_ROUTE);
    const ed = drawerHrefs(ED_ROUTE);

    // The claim is that the order CHANGES; asserting one fixed permutation would pin today's
    // opinion about what a nurse wants first, which is the owner's to change.
    expect(ward).not.toEqual(coordinator);
    expect(ed).not.toEqual(coordinator);

    const firstView = (hrefs: (string | null)[]) => hrefs.find((href) => WARD_VIEWS.some((view) => view.href === href));
    expect(firstView(coordinator)).toBe("/mockups/ward-flow");
    expect(firstView(ward)).toBe("/mockups/ward-flow/capacity");
    expect(firstView(ed)).toBe("/mockups/ward-flow/movements");
  });

  /**
   * ⚠️ **THE EXPECTED NUMBERS ARE DERIVED FROM THE SEED, NEVER TYPED.** A literal here would pass
   * for a count wired to the wrong derivation the moment the two happened to agree on today's
   * fixture — and would then have to be edited every time the seed moved, which is how a test stops
   * being read. The anti-vacuity floor below is what stops the whole check passing on all-zeroes.
   */
  it("shows each count exactly as its own derivation computes it, in the link's accessible name", () => {
    const seed = seedWardFlowState();
    const expected = wardNavCounts({
      movements: seed.movements,
      units: seed.units,
      referrals: seed.referrals,
      bedReleases: seed.bedReleases,
      leaveBeds: seed.leaveBeds,
      now: NOW_ANCHOR,
    });

    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");

    const labelled = [...WARD_VIEWS, ...WARD_NAV];
    const seen: number[] = [];
    for (const [id, count] of Object.entries(expected)) {
      const item = labelled.find((entry) => entry.id === id);
      expect(item, `no sidebar entry for counted id ${id}`).toBeTruthy();
      const link = within(drawer).getByRole("link", {
        name: new RegExp(`^${item!.label}, ${count!.value} ${count!.noun}$`),
      });
      expect(link).toHaveAttribute("href", item!.href);
      seen.push(count!.value);
    }
    expect(seen.length, "no counts rendered — this test would prove nothing").toBeGreaterThan(2);
    expect(
      seen.some((value) => value > 0),
      "every count is zero, so a count wired to a constant would pass this test",
    ).toBe(true);
  });

  /**
   * ⚠️ Ten-odd destinations deliberately carry NO number — see `ward-nav-counts.ts`. A `0` on a
   * destination nobody measured asserts that its screen is empty, which is a different statement
   * from having no figure for it.
   */
  it("leaves an uncounted destination's accessible name as its bare label", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");
    for (const label of ["Command", "Network", "Governance", "Handover", "Patient search"]) {
      expect(
        within(drawer).getByRole("link", { name: new RegExp(`^${label}$`) }),
        `${label} has grown a count with no derivation behind it`,
      ).toBeTruthy();
    }
  });

  /**
   * 🔴 **"Needs you now" — the owner's drawn wording, shipped now that the list is genuinely scoped
   * to a place** (see `WardSidebarAttention`'s doc comment for the predicates). `WARD_ROUTE`
   * (`rph-adult-secure`) has no qualifying movement on today's seed — scoping this to zero on that
   * unit is itself correct behaviour — so an ED route is used here, where `peel-ed` does have one.
   * The unit-scoped case with a non-empty list is covered separately, below, on a unit found by
   * derivation rather than assumed.
   */
  it("gives an emergency department the attention block, worded 'Needs you now', and a coordinator the tasks drawer instead", () => {
    renderRail(ED_ROUTE);
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    expect(within(screen.getByRole("dialog")).getByText(/Needs you now/u)).toBeTruthy();
  });

  it("does not give a coordinator the attention block, whose work list is the header's tasks drawer", () => {
    renderRail(COORDINATOR_ROUTE);
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    expect(within(screen.getByRole("dialog")).queryByText(/Needs you now/u)).toBeNull();
  });
});

/**
 * 🔴 **THE COUNTS, CHECKED AGAINST THE PRIMITIVES RATHER THAN AGAINST THE MODULE THAT COMPUTES
 * THEM.**
 *
 * The suite above asserts that the sidebar renders whatever `wardNavCounts` returns. That is worth
 * having and it is **not** a check on the figures: it computes its expectation by calling the very
 * function under test, so a wrong derivation moves both sides together and the assertion holds.
 * Measured, not assumed — mutating `movements.filter(isOpen).length` to `movements.length` inside
 * `wardNavCounts` left all fifteen of those cases green.
 *
 * So each figure below is re-derived here from the derivation it is supposed to read, by a path that
 * does not pass through `ward-nav-counts.ts` at all. A count wired to the wrong source now has two
 * different numbers to disagree with.
 */
describe("Ward Flow sidebar counts, against their own derivations", () => {
  const seed = seedWardFlowState();
  const rollup = serviceRollup(wardSites, seed.units, seed.bedReleases, seed.leaveBeds, NOW_ANCHOR);
  const openMovements = seed.movements.filter(isOpen).length;
  const severeDelays = delayGroups(seed.movements, seed.units, NOW_ANCHOR)
    .filter((group) => SEVERE_CAUSES.includes(group.cause))
    .reduce((total, group) => total + group.movements.length, 0);
  const queuedReferrals = seed.referrals.filter((referral) => referralState(referral) === "queued").length;

  function nameOf(label: string) {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    return within(screen.getByRole("dialog"))
      .getByRole("link", { name: named(label) })
      .getAttribute("aria-label");
  }

  it.each([
    ["Movements", () => `Movements, ${openMovements} still open`],
    ["Capacity", () => `Capacity, ${rollup.service.availableNow} beds ready now`],
    ["Delays", () => `Delays, ${severeDelays} at a time limit or with nowhere to go`],
    ["Discharges", () => `Discharges, ${rollup.service.blockedToday} discharges held up`],
    ["Referral board", () => `Referral board, ${queuedReferrals} awaiting a decision`],
  ])("states %s exactly as its own derivation computes it", (label, expected) => {
    cleanup();
    expect(nameOf(label)).toBe(expected());
  });

  /**
   * 🔴 **THE ONE COINCIDENCE THIS DESIGN EXISTS TO AVOID.** `delayGroups`' `causeOf` ends in a
   * catch-all, so its groups partition every open movement — the obvious "rows on the Delays
   * screen" figure is the Movements figure, permanently, under a second label. Two numbers that
   * always agree read as corroboration. This asserts they are computed from different populations,
   * and that today's data actually separates them, so the check is not passing on an empty set.
   */
  it("counts delays from a narrower population than movements, and the two differ on today's data", () => {
    expect(openMovements, "no open movements — every count below would prove nothing").toBeGreaterThan(0);
    expect(severeDelays).toBeLessThan(openMovements);
  });
});

/**
 * 🔴 **A HEADING COUNT IS NOT A TRUNCATION NOTICE.** The attention block shows three rows above a
 * heading carrying the honest total, and on the real render the only thing separating "there are
 * four, you can see three" from "there are four" was counting the rows. The remainder is named in
 * words, and so is where the rest of them are.
 *
 * ⚠️ **SCOPING THE INPUT SHRANK EVERY REAL PLACE'S OWN LIST BELOW THE THREE-ROW CAP.** Before the
 * block was scoped to a place, it showed the whole network's inbox on any ward or ED route, which
 * is how the old version of this test reached four rows regardless of which ward or department it
 * rendered on. Once the input is filtered to one place first, the busiest single place on today's
 * seed is an emergency department with two qualifying movements — every ward tops out at one — so
 * no route can currently demonstrate the "N more" line with real data. The mechanism itself
 * (`WardSidebarAttention`'s `LIMIT = 3` slice and its hidden-count message) is untouched code, and
 * the assertion below instead pins its OTHER branch: a scoped list at or under the cap renders every
 * row and prints no truncation notice at all, which is the behaviour the current fixture can prove.
 */
describe("Ward Flow sidebar attention block", () => {
  it("shows every scoped row and no truncation notice, when the scoped total is at or under the cap", () => {
    const seed = seedWardFlowState();
    const open = seed.movements.filter(isOpen);
    const edId = ED_ROUTE.split("/").at(-1);
    const scoped = open.filter((movement) => movement.originEdId === edId);
    const items = buildActionInbox(scoped, NOW_ANCHOR, seed.units);
    expect(items.length, "no scoped rows — this test would prove nothing").toBeGreaterThan(0);
    expect(
      items.length,
      "the scoped total now exceeds the 3-row cap — restore the truncation assertion this comment describes",
    ).toBeLessThanOrEqual(3);

    renderRail(ED_ROUTE);
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const drawer = screen.getByRole("dialog");
    const block = within(drawer).getByRole("navigation", { name: "Ward Flow attention" });

    expect(within(block).getAllByRole("link")).toHaveLength(items.length);
    expect(within(block).queryByText(/more in Tasks, at the top of the page/u)).toBeNull();
  });
});

/**
 * 🔴 **THE BLOCK IS SCOPED TO THE READER'S OWN PLACE, NOT THE NETWORK** — ward-lead task,
 * 2026-09-06/07. See `WardSidebarAttention`'s doc comment for the two predicates
 * (`destinationUnit(movement, units)?.id === placeId` for a ward, `movement.originEdId === placeId`
 * for an emergency department, matching `edPressure` byte-for-byte) and for why an unscoped
 * `placeId` renders nothing rather than falling back to the network list.
 *
 * Every expectation below is recomputed straight from `seedWardFlowState()` and the exported
 * derivations — never by calling anything in `ward-sidebar-content.tsx` — so a wrong predicate in
 * the component has an independent number to disagree with.
 */
describe("Ward Flow sidebar attention block, scoped to the reader's own place", () => {
  const seed = seedWardFlowState();
  const open = seed.movements.filter(isOpen);
  const unscopedTotal = buildActionInbox(open, NOW_ANCHOR, seed.units).length;

  /**
   * ⚠️ **DERIVED, NOT HOPED FOR.** `WARD_ROUTE` (`rph-adult-secure`) has zero qualifying movements
   * on today's seed — a test built on it would pass vacuously, showing an empty (correctly empty)
   * block and calling that proof of scoping. This walks every real unit and keeps the first one
   * whose OWN scoped inbox is non-empty; the test right below asserts the search actually found one.
   */
  const wardUnitWithAttention = seed.units.find((unit) => {
    const scopedMovements = open.filter((movement) => destinationUnit(movement, seed.units)?.id === unit.id);
    return buildActionInbox(scopedMovements, NOW_ANCHOR, seed.units).length > 0;
  });

  it("finds at least one ward whose own scoped inbox is non-empty on today's seed", () => {
    expect(wardUnitWithAttention, "no ward qualifies on today's seed — every test below would be vacuous").toBeTruthy();
  });

  const wardRouteWithAttention = `/mockups/ward-flow/board/${wardUnitWithAttention?.id ?? "no-qualifying-unit-found"}`;

  it("shows only rows whose own movement is destined for the ward on-screen", () => {
    renderRail(wardRouteWithAttention);
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    const block = within(screen.getByRole("dialog")).getByRole("navigation", { name: "Ward Flow attention" });
    const links = within(block).getAllByRole("link");
    expect(links.length, "the ward chosen by derivation rendered no rows").toBeGreaterThan(0);

    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      const movementId = href.replace("/mockups/ward-flow/movements/", "");
      const movement = seed.movements.find((candidate) => candidate.id === movementId);
      expect(movement, `${movementId} (rendered) is not a real seeded movement`).toBeTruthy();
      expect(destinationUnit(movement!, seed.units)?.id).toBe(wardUnitWithAttention!.id);
    }
  });

  it("is strictly smaller than the network-wide inbox, which is itself non-empty", () => {
    const scopedTotal = buildActionInbox(
      open.filter((movement) => destinationUnit(movement, seed.units)?.id === wardUnitWithAttention!.id),
      NOW_ANCHOR,
      seed.units,
    ).length;
    expect(unscopedTotal, "the network inbox is empty — a smaller scoped count would prove nothing").toBeGreaterThan(0);
    expect(scopedTotal).toBeLessThan(unscopedTotal);
  });

  it("renders no attention block at all on a ward-ish route with no id in it", () => {
    renderRail(WARD_ROUTE_WITH_NO_ID);
    fireEvent.click(screen.getByRole("button", { name: "Open Ward Flow menu" }));
    expect(within(screen.getByRole("dialog")).queryByRole("navigation", { name: "Ward Flow attention" })).toBeNull();
    expect(screen.queryByText(/Needs you now/u)).toBeNull();
  });
});

/**
 * 🔴 **THE TRUNCATION CAP, WHICH SCOPING MADE UNREACHABLE THROUGH THE COMPONENT.**
 *
 * Before the attention block was scoped to one place, a ward's sidebar showed the whole network and
 * the seed's four inbox items exercised the "N more in Tasks" line. Scoped, **no place on either
 * seeded scenario has more than two** — measured across `standard` and `scarce`: busiest ward 1,
 * busiest ED 2 — so that branch can no longer be reached by rendering, and the test that covered it
 * was rewritten to assert the opposite branch.
 *
 * ⚠️ **That left a live code path with no coverage at all**, which is the exact class this project
 * keeps finding: a capability that still exists, still passes everything, and reaches nobody. The
 * cap is not deleted — the owner will replace this seed with real ward data, where one ward having
 * four things wrong is an ordinary morning — so it is tested where it CAN be tested, on the
 * arithmetic itself.
 */
describe("the attention block's display cap", () => {
  it("shows everything and reports no remainder at or below the cap", () => {
    for (const size of [1, 2, 3]) {
      const items = Array.from({ length: size }, (_, index) => index);
      const { shown, hidden } = attentionRows(items);
      expect(shown).toHaveLength(size);
      expect(hidden, `${size} items should leave nothing over`).toBe(0);
    }
  });

  it("caps at three and reports exactly what it withheld", () => {
    const { shown, hidden } = attentionRows([1, 2, 3, 4, 5, 6]);
    expect(shown).toEqual([1, 2, 3]);
    expect(hidden).toBe(3);
  });

  it("keeps shown + hidden equal to the whole list, so the remainder can never be a guess", () => {
    for (const size of [0, 1, 3, 4, 12]) {
      const items = Array.from({ length: size }, (_, index) => index);
      const { shown, hidden } = attentionRows(items);
      expect(shown.length + hidden, `${size} items lost or invented a row`).toBe(size);
    }
  });

  /** The cap is a parameter, so a caller that changes it does not change the arithmetic's meaning. */
  it("honours a different cap without changing what the remainder means", () => {
    const { shown, hidden } = attentionRows([1, 2, 3, 4, 5], 2);
    expect(shown).toEqual([1, 2]);
    expect(hidden).toBe(3);
  });
});
