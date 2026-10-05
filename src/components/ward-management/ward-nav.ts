/**
 * The single source for every Ward Flow destination — rendered three ways by
 * `ward-management-navigation.tsx` (icon rail, expanded panel, phone drawer) and checked both
 * ways by `tests/ward-nav.test.ts`.
 *
 * Before this file, the rail's Ward-Flow-specific destinations were 329 lines of individually
 * hand-pasted link blocks, one appended per task over two phases. Nothing enumerated the two
 * sides — nav links and real routes — against each other, which is *why* three boards
 * (`/handover`, `/escalation`, `/search`) could ship with no rail entry and nothing noticed
 * (plan defects D8/D9).
 *
 * `tests/ward-nav.test.ts` enforces the two-way property this file exists to make possible:
 * every href below must resolve to a real route under `src/app/mockups/ward-flow/`, **and**
 * every *static* route under that tree must appear here or in `WARD_NAV_INTENTIONALLY_UNLISTED`
 * with a stated reason. A one-way check ("every nav link is a real route") is exactly what let
 * D8 happen — it says nothing about a route with no link pointing at it at all.
 */

import { raiseReferralHref, type ReferralSource } from "@/components/ward-management/shell/ward-facade";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardPlaceFor } from "@/components/ward-management/ward-place";

/**
 * The eight coordinator-level mode ids.
 *
 * ⚠️ **THIS COMMENT USED TO SAY "the eight coordinator-level views, ordered as the rail and the
 * panel present them", AND BY 2026-09-05 THAT WAS FALSE IN BOTH HALVES.** MERGE 01 folded the
 * priority queue and the exceptions inbox into `DelaysScreen`, and MERGE 03 folded the vehicle
 * tracker into `MovementsScreen`. `WARD_VIEWS` has listed SIX ever since; `exceptions` and
 * `transport` are presented nowhere and are not views at all. The sentence describing this file's
 * central fact was left behind by two merges that each updated the array beneath it — which is the
 * ordinary way a comment goes wrong, and the reason the count below is now DERIVED rather than
 * written down.
 *
 * 🔴 **A RUNTIME LIST, WITH THE TYPE DERIVED FROM IT — not a hand-written union beside a
 * hand-written array.** A union is erased before any test runs, so nothing could ever walk the
 * eight ids and check them against the six that are listed; the only enforcement was two total
 * `Record`s (`WARD_VIEW_ICONS`, `modeCopy`), and a total `Record` proves every id HAS an entry,
 * never that any entry is READ. Six of `modeCopy`'s eight are read by nothing today. With
 * `WARD_MODES` as the source, `tests/ward-nav.test.ts` can require every id to be either a listed
 * view or a recorded exception with a reason — the same two-way property this file already
 * enforces for routes, which is what stopped D8.
 *
 * The order is the rail's order for the six that are listed, with the retained id last.
 *
 * ⚠️ **`queue` BECAME `delays` AND `exceptions` WAS RETIRED ON 2026-09-06.** MERGE 01 pointed the
 * queue entry at `/delays` and relabelled it "Delays" while leaving its ID as `queue` — so the
 * single source of truth for ward destinations carried an id naming a screen that had stopped
 * existing, and `ward-sidebar.dom.test.tsx` had a comment explaining the discrepancy rather than a
 * reason for it. `exceptions` is gone outright: nothing renders it anywhere in `src` or `tests`.
 *
 * ⚠️ **THE ROUTES `/queue` AND `/exceptions` ARE UNTOUCHED AND MUST STAY.** They are `redirect()`
 * stubs to `/delays`, so an existing bookmark still resolves. **The id and the route path are two
 * different things** — this change moves the id only.
 */
export const WARD_MODES = ["command", "network", "delays", "capacity", "movements", "governance", "transport"] as const;

export type WardMode = (typeof WARD_MODES)[number];

/**
 * A mode id that is deliberately NOT a listed view, and why it is still here.
 *
 * ⚠️ **"NOT LISTED" IS NOT "DEAD", AND THE DIFFERENCE IS THE WHOLE POINT OF THIS MAP.** Both ids
 * below are still branched on by `ModeBody` (`ward-management-modes.tsx`) and still rendered by
 * test files, so deleting either is a decision with consequences elsewhere — not a tidy-up. What
 * they have lost is a place in the rail.
 *
 * ⚠️ **`command` IS NOT IN THIS MAP, AND WAS NEARLY RECORDED AS DEAD.** It is excluded from
 * `WardModeWorkspace`'s prop type, which reads like absence; measured 2026-09-05 it had two live
 * consumers — its own `WARD_VIEWS` entry pointing at `/mockups/ward-flow`, and
 * `coordinator-screen.tsx`, which rendered its own per-screen rail mount with an explicit prop so
 * the Command screen highlighted itself there. **Task 8, 2026-09-11: that second consumer's own
 * mechanism is gone** — the third-edition shell's rail (`shell/ward-rail.tsx`) takes no per-mode
 * prop for any screen and instead derives every link's active state from the route itself, so
 * `command` is live today by the same one mechanism as every other view id: its `WARD_VIEWS` entry
 * plus the root route actually rendering `CoordinatorScreen` there (`tests/ward-nav.test.ts` pins
 * this directly). It remains the most-used mode id in the application; an id absent from ONE
 * consumer is not an unused id, and the two claims still look identical from inside that consumer.
 */
export const WARD_MODES_NOT_LISTED: ReadonlyMap<WardMode, string> = new Map([
  [
    "transport",
    "MERGE 03 (owner-approved 2026-09-05) folded the live vehicle tracker into MovementsScreen, and /mockups/ward-flow/transport is now a redirect to /movements. RETAINED, unlike 'exceptions' which was retired alongside this entry on 2026-09-06, because something still renders it: tracker/live-tracker.tsx passes activeMode=\"transport\" to ClinicalRail. That file is itself imported by nothing and is a candidate for deletion — but deciding the fate of live-tracker.tsx and tracker-derivations.ts is a two-file question, not an id rename, so the id stays until somebody answers it.",
  ],
] as const);

export type WardViewItem = {
  id: WardMode;
  href: string;
  label: string;
};

/**
 * The eight views, moved here from eight hand-written `<Link>` blocks inside
 * `WardModeNavigation`. Those blocks were literal so that a source-text regex in
 * `tests/ward-management.test.ts` could read the hrefs back, and so that
 * `tests/route-reachability.test.ts`'s literal-href AST scan could see them. Neither reason
 * survives: that reachability test's `staticPageRoutes` excludes every `/mockups/**` route
 * outright (Ward Flow's sandbox move), and the mode-href test now reads this array directly,
 * which is a stronger check than a regex over a function body.
 *
 * The move is what makes a labelled sidebar possible at all. A panel and a drawer that render
 * labelled links cannot read a rail's icon-only JSX, so leaving the views in JSX would have
 * meant a second hand-maintained list of the same eight destinations — the precise defect this
 * file was created to end.
 *
 * ⚠️ SEVEN, NOT EIGHT, as of MERGE 01 (owner-approved 2026-09-05). `queue` and `exceptions` used
 * to be two separate entries, "Priority queue" and "Exceptions" — the same waiting patients,
 * listed twice under two different lenses, plus a third list on the escalation board that was
 * never one of these eight at all. `DelaysScreen` answers what all three were separately trying
 * to answer ("why is this person still waiting?"), so the `queue` entry now points at `/delays`
 * and carries the label "Delays"; the `exceptions` entry is gone. The `queue` and `exceptions` ids
 * themselves are untouched in the `WardMode` type below — see that type's own comment — this is a
 * change to which destinations get listed, not to what a mode id can be.
 *
 * ⚠️ SIX, NOT SEVEN, as of MERGE 03 (owner-approved 2026-09-05). `movements` and `transport`
 * used to be two separate entries — the six-stage movement board and the live vehicle tracker,
 * asking "where is everyone right now" two different ways. `MovementsScreen` answers both, so the
 * `transport` entry is gone; the route still exists as a redirect to `/movements` — see
 * `WARD_NAV_INTENTIONALLY_UNLISTED` below. The `transport` id itself is untouched in the `WardMode`
 * type below, for the same reason `queue`/`exceptions` stayed untouched after MERGE 01.
 */
export const WARD_VIEWS: readonly WardViewItem[] = [
  { id: "command", href: "/mockups/ward-flow", label: "Command" },
  { id: "network", href: "/mockups/ward-flow/network", label: "Network" },
  { id: "delays", href: "/mockups/ward-flow/delays", label: "Delays" },
  { id: "capacity", href: "/mockups/ward-flow/capacity", label: "Capacity" },
  { id: "movements", href: "/mockups/ward-flow/movements", label: "Movements" },
  { id: "governance", href: "/mockups/ward-flow/governance", label: "Governance" },
];

/**
 * Ward Flow's own home — `WARD_VIEWS`' "command" entry, re-exported under its own name.
 *
 * ⚠️ **THIS EXISTS BECAUSE `shell/ward-rail.tsx`'S BRAND LINK TYPED THE ROUTE DIRECTLY, WHICH IS
 * THE ONE DEFECT `tests/ward-facade-agrees-with-screens.test.ts` EXISTS TO CATCH.** Written while
 * `ward-facade.ts` (`shell/ward-facade.ts`) was still on the sibling `ward/phase-1-shell-
 * facade-20260910` branch and not yet folded in — see `docs/ward-flow/plans/2026-09-10-third-
 * edition-build-master-plan.md` §1.3. The fold has since landed and the facade is real, but it
 * carries no home-route builder of its own (checked against its exported names and
 * `EXPECTED_BUILDER_LINES` directly, 2026-09-11) — only per-record builders like `movementHref`,
 * none of them a bare `/mockups/ward-flow`. This constant is still this route's one source; retire
 * it in favour of the facade's own builder if one is ever added there.
 */
export const WARD_HOME_HREF: string = WARD_VIEWS.find((view) => view.id === "command")!.href;

export type WardNavGroup = "role" | "board";

/**
 * Every `WARD_NAV` id, as a union rather than `string`.
 *
 * `WARD_VIEWS`' ids have always been union-typed (`WardMode`), which is what makes
 * `WARD_VIEW_ICONS: Record<WardMode, LucideIcon>` in `ward-nav-icons.ts` compiler-guarded — a view
 * with no icon does not build. `WARD_NAV`'s ids were `string`, so its sibling `WARD_NAV_ICONS` had
 * to be `Record<string, LucideIcon>`, which accepts anything and guarantees nothing. Both the rail
 * and the drawer do `const Icon = WARD_NAV_ICONS[item.id]` and then render `<Icon />`, so a
 * missing entry throws `Element type is invalid` at render on EVERY Ward Flow screen (the rail
 * mounts on all of them), not just the one whose id lost its icon. That has already happened once.
 *
 * Adding an id here and to `WARD_NAV` without adding its icon is now a type error at the icon map.
 * `tests/ward-nav.test.ts` still asserts the same property at test time and MUST be kept: the two
 * mechanisms fail differently — the compiler catches it before anything runs, the test catches the
 * case where a `Record` key is present but resolves to nothing usable — and a phase that has spent
 * two days on guards that turned out not to guard does not trade a real check for a newer one.
 */
export type WardNavId =
  | "wards"
  | "community"
  | "ward"
  | "board"
  | "officer"
  | "ed"
  | "handover"
  | "alerts"
  | "escalation"
  | "search"
  | "discharges"
  | "referrals"
  | "referral-intake"
  | "out-of-area"
  | "statistics"
  | "on-call"
  | "hub"
  | "legal-forms";

export type WardNavItem = {
  id: WardNavId;
  href: string;
  label: string;
  group: WardNavGroup;
  /** True when the href names one specific synthetic ward or department rather than a section. */
  exampleOnly?: boolean;
};

/**
 * The referral intake form's path, in one place.
 *
 * ⚠️ MUST STAY ABOVE `WARD_NAV`, which now references it (owner ruling 2026-09-03 put the form in
 * the rail). A `const` used before its declaration throws at module load, and because the rail
 * mounts on every Ward Flow screen that would be a crash on all of them rather than on one.
 *
 * `referral-board.tsx` also links here, so the constant is what stops a hand-written string in
 * that file drifting from the route on disk. `tests/ward-nav.test.ts` checks every `WARD_NAV`
 * href against the real route tree, so the constant, the nav entry and the route stay one fact.
 */
export const WARD_REFERRAL_INTAKE_HREF = "/mockups/ward-flow/referrals/new";
export const WARD_ALERTS_HREF = "/mockups/ward-flow/alerts";
export const WARD_CAPACITY_HREF = "/mockups/ward-flow/capacity";
export const WARD_COMMAND_HREF = "/mockups/ward-flow/command";
export const WARD_ED_HREF = "/mockups/ward-flow/ed";

/**
 * `role` — entry points for the role screens `WardRoleSwitcher` offers (Coordinator, Ward,
 * Officer, Emergency department — see that component's own doc comment). Coordinator is
 * deliberately absent here: it is `/mockups/ward-flow` itself, already present in `WARD_VIEWS`
 * as "Command" — see `WARD_NAV_INTENTIONALLY_UNLISTED` below, which is where that reasoning is
 * recorded and checked. Ward and Emergency department are dynamic detail routes
 * (`ward/[unitId]`, `ed/[edId]`); the rail can only ever link to one concrete instance of each,
 * so both carry `exampleOnly: true` (D10) — the navigation must present them as an example entry
 * point into that role screen, never as though they were a section of the app in their own
 * right. **Do not delete either.** `ed` is still the only way to reach the emergency department
 * role screen at all. `ward` is no longer the only way to reach a ward — `wards` above is the ward
 * index, which links every unit in the network — but it remains the ONE concrete `ward/[unitId]`
 * href in the source, and `tests/ward-nav.test.ts` measures that route's recorded coverage from
 * exactly that: delete it and the figure falls to nought, having made nothing more reachable.
 *
 * `wards` is a section rather than an example, so it carries no `exampleOnly` flag: it is the
 * index of every ward, not one ward standing in for the rest.
 *
 * `community` is the same shape as `wards` and is here for the same reason: it is the index of
 * every community team a referral can name, each linked, so it too is a section rather than an
 * example and carries no `exampleOnly` flag. **It must not be moved to
 * `WARD_NAV_INTENTIONALLY_UNLISTED`.** Its whole purpose is to be the front door to
 * `community/[teamId]`, whose pages were reachable only by typing an address; an index nothing
 * links to confers no reachability on anything it links, and burying it here would leave every
 * team page exactly as unreachable as it was while every scan started reporting them healthy.
 * (No count of teams is written here on purpose — `community-index.tsx` records why a team count
 * typed into prose is a claim that falsifies itself the first time the seed changes.)
 *

 * `board` — the specialist boards that sit outside the eight views.
 */

export const WARD_NAV: readonly WardNavItem[] = [
  {
    id: "statistics",
    href: "/mockups/ward-flow/statistics",
    label: "Statistics",
    group: "role",
  },
  {
    id: "wards",
    href: "/mockups/ward-flow/wards",
    label: "All wards",
    group: "role",
  },
  {
    id: "community",
    href: "/mockups/ward-flow/community",
    label: "All community teams",
    group: "role",
  },
  {
    id: "ward",
    href: "/mockups/ward-flow/ward/rph-adult-secure",
    label: "Ward — Dabakarn",
    group: "role",
    exampleOnly: true,
  },
  {
    id: "board",
    href: "/mockups/ward-flow/board/rph-adult-secure",
    label: "Ward board — Ward 2K",
    group: "role",
    exampleOnly: true,
  },
  { id: "officer", href: "/mockups/ward-flow/transport/officer", label: "Officer", group: "role" },
  {
    id: "ed",
    href: "/mockups/ward-flow/ed/peel-ed",
    label: "Emergency department",
    group: "role",
    exampleOnly: true,
  },
  { id: "handover", href: "/mockups/ward-flow/handover", label: "Handover", group: "board" },
  /* The `escalation` entry was REMOVED here by MERGE 01 (owner-approved 2026-09-05): the
   * escalation board's list of patients is now shown inside `DelaysScreen`, under its own cause
   * group, so a separate board entry would be a second listing of the same people. The route
   * itself still exists as a redirect to `/delays` — see `WARD_NAV_INTENTIONALLY_UNLISTED` below
   * — and the `escalation` id stays a member of `WardNavId` even though nothing in this array
   * uses it any more, for the same reason `queue`/`exceptions` stay in `WardMode`: nothing else
   * in this file depends on removing it, and leaving it costs nothing. */
  { id: "search", href: "/mockups/ward-flow/search", label: "Patient search", group: "board" },
  /*
   * THE MASTER SEARCH HUB, added 2026-09-06 from the owner-approved mockup.
   *
   * ⚠️ **IT SITS IN `WARD_NAV`, NOT `WARD_VIEWS`, AND THE REASON IS SEMANTIC RATHER THAN
   * MECHANICAL.** `WARD_VIEWS` holds the six coordinator lenses on the network — Command, Network,
   * Delays, Capacity, Movements, Governance. A hub for FINDING a place is not a seventh lens; it is
   * the sibling of `search` directly above it. **One finds people, one finds places.**
   *
   * That placement also avoids a collision, which is worth recording because it is the weaker of
   * the two reasons and would be the tempting one to cite: `tests/ui-ward-management.spec.ts`
   * derives its destination list from `WARD_VIEWS` alone, and a second chat was editing that array
   * at the time. Belonging here is why this is right; missing that guard is only a bonus.
   */
  { id: "hub", href: "/mockups/ward-flow/hub", label: "Search hub", group: "board" },
  { id: "discharges", href: "/mockups/ward-flow/discharges", label: "Discharges", group: "board" },
  /*
   * 🔴 **LISTED, NOT HIDDEN — AND THAT IS A JUDGEMENT ABOUT A DANGEROUS SCREEN.**
   *
   * On-call and contacts holds no names and no way of reaching anybody, so a reasonable instinct is
   * to keep it out of the rail until it holds something. ⚠️ **That instinct is backwards here.** An
   * unlisted screen is found by somebody who went looking for a roster, at the moment they need one
   * — and they arrive already believing it holds one. **Listed, it is met in the ordinary way, with
   * its own disclosure at the top saying what it does not hold**, which is when that sentence is
   * cheap to read rather than unwelcome.
   */
  { id: "on-call", href: "/mockups/ward-flow/on-call", label: "On-call", group: "board" },
  /*
   * The Alerts screen, 2026-09-12. LISTED rather than intentionally unlisted: it is addressed to a
   * role across every movement and referral, so a coordinator who cannot reach it has no way to
   * learn it exists — and an alerting surface nobody opens is the one screen where that costs
   * something. `WARD_NAV_INTENTIONALLY_UNLISTED` is for routes reached from another screen; nothing
   * links here.
   */
  { id: "alerts", href: "/mockups/ward-flow/alerts", label: "Alerts", group: "board" },
  /* The `morning` entry was REMOVED here by MERGE 02 (owner-approved 2026-09-05): the morning bed
   * state board's figures are now shown inside `CapacityScreen`, so a separate board entry would be
   * a second listing of the same network/hospital/ward numbers. At that point the route itself kept
   * existing as a redirect to `/capacity` (see `WARD_NAV_INTENTIONALLY_UNLISTED` below) and the
   * `morning` id stayed a member of `WardNavId`, for the same reason `escalation` stayed after
   * MERGE 01.
   *
   * Item 41 (owner-approved 2026-09-17) went further and retired the route itself, not only this
   * array entry: the `morning` id is no longer a member of `WardNavId`, its
   * `WARD_NAV_INTENTIONALLY_UNLISTED` entry is gone, and the Morning route file and its
   * implementation module were deleted in the same commit. */
  { id: "referrals", href: "/mockups/ward-flow/referrals", label: "Referral board", group: "board" },
  /*
   * ⚠️ THIS ENTRY REVERSES A DELIBERATE DESIGN DECISION, BY OWNER RULING ON 2026-09-03:
   * "I would like the referral form/hub in the sidebar please."
   *
   * The argument it overrules is kept here rather than deleted, because a design argument that
   * simply vanishes reads as though nobody ever thought about it. Until today this route sat in
   * `WARD_NAV_INTENTIONALLY_UNLISTED` with this reasoning:
   *
   *   "An action taken from the referral board, not a section of the app: the board carries the
   *    'New referral' <Link> that is the only way in, mirroring how a coordinator actually reaches
   *    it — they are looking at the queue when they raise the next one. Listing an intake form in
   *    the rail beside Handover, Escalation and Discharges would present a form as though it were
   *    a board."
   *
   * That reasoning was sound and it is not what the owner wants. He asked for the form as well as
   * the board — "form/hub", and the board is already here as `referrals` — so BOTH are listed and
   * neither replaces the other. The `New referral` link on the board stays: this adds a second way
   * in, it does not move the first one.
   */
  {
    id: "referral-intake",
    href: WARD_REFERRAL_INTAKE_HREF,
    label: "New referral",
    group: "board",
  },
  { id: "out-of-area", href: "/mockups/ward-flow/out-of-area", label: "Out of area", group: "board" },
  /*
   * The legal forms board — every open movement that carries a legal form, ordered by time
   * remaining. A board rather than an example, the same shape `wards`/`community` above are: it is
   * the one cross-patient index of a fact that otherwise lives scattered across the drawer, the
   * shortlist, the console and half a dozen other screens, each showing one movement's own form and
   * none of the others'.
   */
  { id: "legal-forms", href: "/mockups/ward-flow/legal-forms", label: "Legal forms", group: "board" },
];

/**
 * In this standalone repository, the developer hub and home destination is /mockups/ward-flow.
 */
export const WARD_DEVELOPER_HUB_HREF = "/mockups/ward-flow";

/* `WARD_REFERRAL_INTAKE_HREF` was declared here until 2026-09-03. It moved ABOVE `WARD_NAV`
 * because `WARD_NAV` now references it, and a `const` used before its declaration is a temporal
 * dead zone error at module load — a crash on every Ward Flow screen, since the rail mounts on
 * all of them. Nothing else changed about it. */

/**
 * Where a person who is not in the system yet gets added.
 *
 * A constant for the same reason `WARD_REFERRAL_INTAKE_HREF` above is one: the only way in is a
 * `<Link>` inside another screen — here the patient search's empty state — so nothing in `WARD_NAV`
 * pins its path, and a hand-written string in `patient-search.tsx` could drift from the route on
 * disk with nothing noticing. The constant, the exemption below and the route are one fact in one
 * place.
 */
export const WARD_ADD_PERSON_HREF = "/mockups/ward-flow/people/new";

/**
 * Static Ward Flow routes intentionally absent from `WARD_VIEWS` and `WARD_NAV`, each with the
 * reason it is exempt — mirrors `REACHABILITY_ALLOWLIST` in `tests/route-reachability.test.ts`.
 * Every key must be a real static route under `src/app/mockups/ward-flow/` (checked by
 * `tests/ward-nav.test.ts`, which fails on a stale entry) and must never also appear in a nav
 * array — a route belongs in exactly one of the two.
 */
export const WARD_NAV_INTENTIONALLY_UNLISTED: ReadonlyMap<string, string> = new Map([
  [
    "/mockups/ward-flow/command",
    "A deliberate redirect to /mockups/ward-flow, documented in its own route file (command/page.tsx) — route alias for the command view.",
  ],
  [
    "/mockups/ward-flow/constellation",
    "A deliberate 307 redirect to /network, documented in its own route file (constellation/page.tsx) — not a destination.",
  ],
  /* The entry for `WARD_REFERRAL_INTAKE_HREF` was REMOVED on 2026-09-03, in the same change that
   * listed the form in `WARD_NAV` by owner ruling. It had to go in THAT commit and not a later
   * one: this map means "a real route deliberately absent from the nav", and `tests/ward-nav.test.ts`
   * fails any route that appears in both. Leaving it would have shipped a document contradicting
   * the nav it describes. The argument it carried is preserved verbatim at the new
   * `referral-intake` entry above, so the overruled reasoning is still readable. */
  [
    WARD_ADD_PERSON_HREF,
    "An action taken from the patient search, not a section of the app: the search's empty state carries the 'Add this person' <Link> that is the only way in, and it appears exactly when it is needed — you have searched, nobody came up, and this is the person who does not exist yet. Listing it in the rail would invite adding a person nobody had looked for first, which is how a duplicate record gets made.",
  ],
  [
    "/mockups/ward-flow/statistics/overview",
    "Reached by Link from the statistics hub, not from the rail. Three statistics entries in the sidebar would bury the hub the owner actually wants to land on — the same reasoning WARD_REFERRAL_INTAKE_HREF above already sets, where a destination inside a screen is not a section of the app.",
  ],
  [
    "/mockups/ward-flow/statistics/compare",
    "Reached by Link from the statistics hub, for the same reason as /overview above.",
  ],
  /*
   * 🔴 SETTINGS IS UNLISTED BY THE DRAWING'S OWN INSTRUCTION, NOT BY THIS LANE'S JUDGEMENT.
   * `settings-third-edition.html` says it in as many words: "Settings has no rail item of its own
   * (section 14 of the standard has no entry for it): it opens from Tools on every screen, and its
   * parent for this tally is Command."
   *
   * ⚠️ THE BUILD CONTRACT EXPECTED A `WARD_NAV` ENTRY AND THE DRAWING OVERRULES IT. Recorded here
   * rather than resolved silently either way — a seventh rail item nobody drew would be adding
   * beyond the drawing, which is the same rule as omitting something it draws.
   *
   * ⚠️ **"UNLISTED" HERE MEANS "NO RAIL ITEM", NOT "UNREACHABLE"** — Settings is reached three ways
   * today: the Tools drawer (`shell/ward-bar.tsx`), the rail's footer Settings control
   * (`shell/ward-rail.tsx`), and search (`search/ward-smart-search.ts`). An earlier version of the
   * reason below said "reachable by URL only" while the Tools link was another lane's routed-but-not-
   * taken file; that link has since landed, so the sentence was fixed to match the reality it
   * describes rather than left to contradict three live controls.
   */
  [
    "/mockups/ward-flow/settings",
    "No rail item by the drawing's own instruction — it opens from the Tools drawer on every screen. " +
      "Settings is reached from the Tools drawer (shell/ward-bar.tsx), the rail footer (shell/ward-rail.tsx) " +
      "and search (search/ward-smart-search.ts).",
  ],
  [
    "/mockups/ward-flow/sovereign",
    "Showcase workspace for the Sovereign Chrome, Navigation Rail & Drawers Suite (sovereign-sidebar-ultimate.html) — a demonstrator screen for cross-cutting shell and off-canvas drawer capabilities, deliberately unlisted from the operational clinical navigation rail.",
  ],
  /* The next three entries were added by MERGE 01 (owner-approved 2026-09-05), which folded the
   * priority queue, the exceptions inbox and the escalation board into one screen, `DelaysScreen`
   * at /mockups/ward-flow/delays. Each of the three old routes now redirects there rather than
   * being deleted, so an existing bookmark or deep link does not 404 — the same reasoning
   * `/constellation` above already sets for a retired route kept as a redirect stub. */
  [
    "/mockups/ward-flow/queue",
    "A deliberate redirect to /delays (MERGE 01), documented in its own route file (queue/page.tsx) — not a destination in its own right.",
  ],
  [
    "/mockups/ward-flow/exceptions",
    "A deliberate redirect to /delays (MERGE 01), documented in its own route file (exceptions/page.tsx) — not a destination in its own right.",
  ],
  [
    "/mockups/ward-flow/escalation",
    "A deliberate redirect to /delays (MERGE 01), documented in its own route file (escalation/page.tsx) — not a destination in its own right.",
  ],
  /* MERGE 03 (owner-approved 2026-09-05) folded the live vehicle tracker into `MovementsScreen`.
   * The old route now redirects there rather than being deleted, for the same bookmark/deep-link
   * reason MERGE 01's and MERGE 02's entries above already set. `/transport/officer` is a separate,
   * nested route and is unaffected: it stays listed in WARD_NAV under its own `officer` entry. */
  [
    "/mockups/ward-flow/transport",
    "A deliberate redirect to /movements (MERGE 03), documented in its own route file (transport/page.tsx) — not a destination in its own right.",
  ],
  [
    "/mockups/ward-flow/ed",
    "A deliberate redirect to /mockups/ward-flow/ed/peel-ed, documented in its own route file (ed/page.tsx) — not a destination in its own right.",
  ],
  [
    "/mockups/ward-flow/hub/proposal",
    "Preview-only redesign proposal (5 October 2026) for owner review beside the current screen; not a destination until approved.",
  ],
  [
    "/mockups/ward-flow/search/proposal",
    "Preview-only redesign proposal (5 October 2026) for owner review beside the current screen; not a destination until approved.",
  ],
  [
    "/mockups/ward-flow/people/proposal",
    "Preview-only redesign proposal (5 October 2026) for owner review beside the current screen; not a destination until approved.",
  ],
  [
    "/mockups/ward-flow/people/new/proposal",
    "Preview-only redesign proposal (5 October 2026) for owner review beside the current screen; not a destination until approved.",
  ],
]);

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * WARD_PRIMARY_ACTIONS — Task 7. One primary action per route, decided here rather than by each
 * screen, so the screens read the answer instead of choosing
 * one and disagreeing. This list is a CONTRACT: every lane reads it, none may edit it.
 *
 * ⚠️ **THIS IS NOT EVERY WARD FLOW ROUTE.** It covers the routes the third edition
 * redesigns — the ones named in `docs/ward-flow/plans/2026-09-10-third-edition-build-master-plan.md`
 * and proved built in `docs/ward-flow/mockups/third-edition-kit/check-output.txt`, plus the service
 * statistics route that follows the same export-action contract. Every other route (Handover, Discharges, the
 * referral board, Out of area, Officer, the ward/community indexes, Network, Governance) keeps
 * using `ward-chrome-header.tsx`'s existing role-adaptive `roleAction()` for now — **this task does
 * not delete that function**, because nothing yet consumes this list to replace it; that is the
 * shell task's job once the bar actually reads from here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * One entry in the "New referral" menu — the three places a referral can be raised from, shared
 * by every route whose primary action is `"new-referral"`.
 *
 * 🔴 **EACH `href` IS BUILT BY `raiseReferralHref`, NEVER TYPED.** That is the blocker this task
 * was dispatched against — see this file's own import above. `tests/ward-nav.test.ts` proves it by
 * recomputing each href from `raiseReferralHref` independently and comparing, not by matching a
 * literal string this file happens to contain.
 *
 * ⚠️ **GENERIC ON PURPOSE — SOURCE ONLY, NO `patientId`/`originEdId`/`teamId`.** This module is a
 * static table evaluated once at import time; it has no patient, ward, ED or team in scope. A
 * screen that DOES have that context (the ED screen raising a referral from *this* ED, say) calls
 * `raiseReferralHref` again itself with the extra fields — this menu is the three-way choice every
 * "New referral" route shares, not the richer link any one of them can build once it knows more.
 */
export type WardReferralMenuEntry = {
  readonly source: ReferralSource;
  readonly label: string;
  readonly href: string;
};

export const WARD_NEW_REFERRAL_MENU: readonly WardReferralMenuEntry[] = [
  { source: "community", label: "Community Referral", href: raiseReferralHref({ source: "community" }) },
  { source: "ed_medical", label: "ED Referral", href: raiseReferralHref({ source: "ed_medical" }) },
  { source: "inter_hospital", label: "Ward Referral", href: raiseReferralHref({ source: "inter_hospital" }) },
];

/**
 * The one primary action a route's bar can show — a discriminated union so a lane switching on
 * `.kind` gets a compiler error, not a silent `undefined`, the day a sixth kind is ever added.
 *
 * `"none"` is its own arm rather than an absent entry. "Patient search", "Patient", "Search hub"
 * and "Raise a referral" all carry it: their primary lives in a panel, or is the form's own Send,
 * and a route that deliberately has no bar action must say so — an ABSENT route and a route that
 * deliberately has none look identical to every gate unless the list states which.
 */
export type WardPrimaryAction =
  | { readonly kind: "new-referral"; readonly label: "New referral"; readonly menu: readonly WardReferralMenuEntry[] }
  | { readonly kind: "record-decision"; readonly label: "Record a decision" }
  | { readonly kind: "contact-team"; readonly label: "Contact a team" }
  | { readonly kind: "export-figures"; readonly label: "Export the figures" }
  | { readonly kind: "none" };

export type WardPrimaryActionEntry = {
  /**
   * A real route — static exactly as it appears in `staticRoutes`, or a dynamic pattern exactly as
   * `tests/ward-nav.test.ts`'s own scan produces it (e.g. `"/mockups/ward-flow/ward/[unitId]"`).
   * Never a hand-typed variant: the test resolves every one of these against the real route tree,
   * the same way it already does for `WARD_NAV` and `WARD_VIEWS` above.
   */
  readonly route: string;
  readonly action: WardPrimaryAction;
};

/**
 * THE LIST — twenty entries, each appearing exactly once.
 * `tests/ward-nav.test.ts` pins this exact set against `THIRD_EDITION_MOCKUP_ROUTES` (the routes
 * whose primary action follows this contract) in both directions, so a route dropped from here, a
 * route added twice, or a route renamed on disk all redden — never just "every entry present is
 * well-formed", which would pass as happily over three entries as over twenty.
 */
export const WARD_PRIMARY_ACTIONS: readonly WardPrimaryActionEntry[] = [
  // New referral — the shared source menu on Command, Delays, Capacity, Wards, Ward, Bed board and ED.
  {
    route: WARD_HOME_HREF,
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  {
    route: "/mockups/ward-flow/delays",
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  {
    route: "/mockups/ward-flow/capacity",
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  {
    route: "/mockups/ward-flow/wards",
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  {
    route: "/mockups/ward-flow/ward/[unitId]",
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  {
    route: "/mockups/ward-flow/ward/[unitId]/answer",
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  {
    route: "/mockups/ward-flow/board/[unitId]",
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  {
    route: "/mockups/ward-flow/ed/[edId]",
    action: { kind: "new-referral", label: "New referral", menu: WARD_NEW_REFERRAL_MENU },
  },
  // Record a decision — the Movements overview and an individual Movement.
  {
    route: "/mockups/ward-flow/movements",
    action: { kind: "record-decision", label: "Record a decision" },
  },
  {
    route: "/mockups/ward-flow/movements/[movementId]",
    action: { kind: "record-decision", label: "Record a decision" },
  },
  // Contact a team — Community team.
  {
    route: "/mockups/ward-flow/community/[teamId]",
    action: { kind: "contact-team", label: "Contact a team" },
  },
  // Export the figures — Statistics and its Ward, Community team, ED and Service detail routes.
  {
    route: "/mockups/ward-flow/statistics",
    action: { kind: "export-figures", label: "Export the figures" },
  },
  {
    route: "/mockups/ward-flow/statistics/ward/[unitId]",
    action: { kind: "export-figures", label: "Export the figures" },
  },
  {
    route: "/mockups/ward-flow/statistics/community/[teamId]",
    action: { kind: "export-figures", label: "Export the figures" },
  },
  {
    route: "/mockups/ward-flow/statistics/ed/[edId]",
    action: { kind: "export-figures", label: "Export the figures" },
  },
  {
    route: "/mockups/ward-flow/statistics/service/[serviceId]",
    action: { kind: "export-figures", label: "Export the figures" },
  },
  // None in the bar — Patient search, Patient, Search hub, Raise a referral.
  { route: "/mockups/ward-flow/search", action: { kind: "none" } },
  { route: "/mockups/ward-flow/people/[patientId]", action: { kind: "none" } },
  { route: "/mockups/ward-flow/hub", action: { kind: "none" } },
  { route: WARD_REFERRAL_INTAKE_HREF, action: { kind: "none" } },
];

/**
 * Drops one trailing slash, unless the whole pathname IS "/" — `usePathname()` never returns a
 * trailing slash in this app's own routes, but a caller passing one by hand (a test, a future
 * caller) must resolve exactly as its slash-free form would, matching `wardPlaceFor`'s own
 * `\/?` tolerance (`ward-place.ts`) for the same reason.
 */
function normalizeWardPathname(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Whether `pathname` is one concrete instance of a dynamic `route` pattern like
 * `/mockups/ward-flow/ward/[unitId]` — segment-by-segment, a `[bracketed]` route segment matches
 * any single non-empty path segment, everything else must match exactly. The same shape
 * `tests/ward-nav.test.ts`'s own `routeToPattern` checks this very list against the real route
 * tree with (that file builds a `RegExp`; this is the same rule read segment-by-segment instead),
 * so production code carries no dependency on a test helper.
 */
function matchesDynamicRoute(route: string, pathname: string): boolean {
  const routeSegments = route.split("/");
  const pathSegments = pathname.split("/");
  if (routeSegments.length !== pathSegments.length) return false;
  return routeSegments.every((segment, index) => {
    const pathSegment = pathSegments[index];
    if (/^\[.+\]$/.test(segment)) {
      // A concrete instance's own segment must be a real, non-empty id — and never the literal
      // bracketed placeholder itself, which is not a route anything navigates to.
      //
      // 🔴 NOR THE RESERVED LITERAL `new` (defect fix): `/people/new` is the static "add a person"
      // route (`WARD_ADD_PERSON_HREF`), not a patient id, and `/referrals/new` is the referral intake
      // form. Without this, `people/[patientId]` swallowed `/people/new` and resolved it to the
      // patient route's action. No dynamic route's id can legitimately be the word "new".
      return (
        pathSegment !== undefined && pathSegment.length > 0 && !/^\[.+\]$/.test(pathSegment) && pathSegment !== "new"
      );
    }
    return segment === pathSegment;
  });
}

/**
 * `pathname` -> its `WARD_PRIMARY_ACTIONS` entry, or `undefined` when the route is not one of the
 * routes this list covers at all (this list's own header comment: every
 * other route — Handover, Discharges, the referral board, Out of area, Officer, the ward/community
 * indexes, Network, Governance — still uses `ward-chrome-header.tsx`'s `roleAction()`). Absence
 * here is exactly as honest as `{ kind: "none" }` for a route this list DOES cover: both render no
 * button, for two different and equally real reasons this function does not need to tell apart —
 * the caller only ever needs "is there an action to draw", never "why not".
 *
 * D-16 (`docs/ward-flow/owner-decisions-2026-09-1x.md`) is why this function exists at all rather
 * than a hand-built `{ id, label, href }` lookup: three of the five `WardPrimaryAction` kinds carry
 * no `href`, so a caller resolving one of THOSE would have to invent a destination — exactly what
 * `ward-shell-types.ts`'s own comment forbids. This function returns the whole discriminated
 * `WardPrimaryAction`, never a projection of it, so nothing downstream is tempted to reach for a
 * field that a given kind does not carry.
 */
export function resolveWardPrimaryAction(pathname: string): WardPrimaryAction | undefined {
  const normalized = normalizeWardPathname(pathname);
  const exact = WARD_PRIMARY_ACTIONS.find((entry) => entry.route === normalized);
  if (exact) return exact.action;

  const dynamic = WARD_PRIMARY_ACTIONS.find(
    (entry) => entry.route.includes("[") && matchesDynamicRoute(entry.route, normalized),
  );
  return dynamic?.action;
}

/**
 * Resolves a human-readable title for the given route pathname.
 * Reads live ward/ED/team place names first, then view labels, then nav labels.
 */
export function resolveWardScreenTitle(pathname: string, units: readonly Unit[] = []): string {
  const normalized = normalizeWardPathname(pathname);
  const place = wardPlaceFor(normalized, units);
  if (place) return place.name;

  if (normalized === "/mockups/ward-flow" || normalized === "/mockups/ward-flow/command") return "Command";
  if (normalized.startsWith("/mockups/ward-flow/board")) return "Bed Board";
  if (normalized.startsWith("/mockups/ward-flow/ward")) return "Ward";
  if (normalized.startsWith("/mockups/ward-flow/ed")) return "Emergency Department";
  if (normalized.startsWith("/mockups/ward-flow/community")) return "Community";
  if (normalized.startsWith("/mockups/ward-flow/movements")) return "Movements";
  if (normalized.startsWith("/mockups/ward-flow/statistics")) return "Statistics";
  if (normalized.startsWith("/mockups/ward-flow/delays") || normalized === "/mockups/ward-flow/queue") return "Delays";
  if (normalized.startsWith("/mockups/ward-flow/capacity")) return "Capacity";
  if (normalized.startsWith("/mockups/ward-flow/network")) return "Network";
  if (normalized.startsWith("/mockups/ward-flow/governance")) return "Governance";
  if (normalized === "/mockups/ward-flow/referrals/new") return "Raise a referral";
  if (normalized.startsWith("/mockups/ward-flow/referrals")) return "Referrals";
  if (normalized === "/mockups/ward-flow/people/new") return "Add a patient";
  if (normalized.startsWith("/mockups/ward-flow/people")) return "Patients";
  if (normalized.startsWith("/mockups/ward-flow/transport/officer")) return "Transport Officer Console";
  if (normalized.startsWith("/mockups/ward-flow/transport")) return "Movements";
  if (normalized.startsWith("/mockups/ward-flow/settings")) return "Settings";
  if (normalized.startsWith("/mockups/ward-flow/sovereign")) return "Sovereign Health";

  const exactView = WARD_VIEWS.find((v) => v.href === normalized);
  if (exactView) return exactView.label;

  const exactNav = WARD_NAV.find((n) => n.href === normalized);
  if (exactNav) return exactNav.label;

  return "Command";
}
