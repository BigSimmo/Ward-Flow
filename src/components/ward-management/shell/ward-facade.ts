/**
 * THE STATE FACADE — the one module every Ward Flow screen reads its shared figures and its routes
 * through.
 *
 * ⚠️ **WHY THIS EXISTS AT ALL.** Sixteen screens are being rebuilt in four lanes that never see each
 * other's code. **They agree on a figure only if something makes them agree**, and this module is
 * that something: one place where "how many beds are available" and "where does a patient's page
 * live" are each answered exactly once. Its companion test,
 * `tests/ward-facade-agrees-with-screens.test.ts`, is what turns that intention into a gate — it
 * renders the owning screen and compares the number in the markup against the number this module
 * hands back, over a base fixture and three mutated ones.
 *
 * ⚠️ **NOTHING HERE COMPUTES A CLINICAL FIGURE.** Every figure below wraps a derivation that already
 * exists and is already tested — `wardNavCounts` for the rail's counts, `buildActionInbox` for the
 * task list. A second formula for a figure that already has one is the exact drift this file was
 * created to stop, so re-deriving anything here would defeat its own purpose. If a lane needs a
 * number this module does not carry, the derivation is added where the derivation lives and wrapped
 * here — never authored here.
 *
 * 🔴 **THIS MODULE IS NOT A CLIENT MODULE AND MUST NEVER BECOME ONE.** It carries no `"use client"`,
 * no hook and no React import, and that is a hard requirement rather than a tidiness preference:
 * every export of a client module reaches a Server Component as a client *reference* rather than as
 * a callable function, so a server page calling `patientHref` from a `"use client"` facade would
 * typecheck, pass every unit test, and throw on the first real request. `community-index.tsx`'s own
 * doc comment records that trap being hit once already, when the single team-href builder lived
 * inside a client screen. Adding a hook here — for the service scope below, or for anything else —
 * re-opens it for every route in the app at once.
 *
 * ⚠️ **LANES ADD THEIR OWN DERIVATIONS IN THEIR OWN DIRECTORIES, NEVER HERE.** This is the shared
 * surface only. A figure only one screen shows is that screen's business.
 *
 * ⚠️ **`Unit.held` IS NEVER READ.** It is a stored field nothing writes and nothing should read;
 * every "Held" on screen comes from `unitCapacity().held`, which derives it. (Plan issue I-9.)
 *
 * ⚠️ **NOTHING HERE CALLS `Date.now()`.** Time arrives as an `Instant` from the clock the provider
 * already resolved, so a figure computed here and a figure computed in a screen cannot be about two
 * different moments.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  BedRelease,
  HealthService,
  LeaveBed,
  Movement,
  Referral,
  Unit,
} from "@/components/ward-management/ward-model";
import type { CommunityTeam } from "@/components/ward-management/community/community-derivations";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";

/**
 * THE MOVEMENT VERDICT, RE-EXPORTED RATHER THAN WRAPPED.
 *
 * 🔴 **THE BUILD PLAN SAYS TO CREATE `movementVerdict()`. IT WOULD HAVE BEEN A SECOND NAME FOR A
 * FUNCTION THAT ALREADY EXISTS.** `eligibility(movement, unit, now)` and `candidateReason(verdict)`
 * are already standalone exports of `ward-eligibility.ts`, and the coordinator console *imports*
 * them rather than owning them — so the Patient screen can already read the movement workspace's
 * verdict without editing any shared console file, which was the whole reason the plan asked for a
 * new function. Measured on this branch before writing a line of it.
 *
 * ⚠️ **AND ITS SIGNATURE TAKES A SINGLE UNIT, NOT A LIST**, so an adapter "smoothing over" a list
 * argument would have been an adapter for a shape nothing produces. Re-exported under its own name,
 * with no wrapper, so that the facade is one import for a lane without becoming a second definition
 * anybody could change independently.
 */
export { candidateReason, eligibility } from "@/components/ward-management/ward-eligibility";
export type { EligibilityGate, EligibilityVerdict, GateResult } from "@/components/ward-management/ward-eligibility";

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * SHELL FIGURES — the numbers the rail and the bar show.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * The figures the shell carries, by id.
 *
 * ⚠️ **`delaysNeedingAttention` IS NAMED FOR WHAT IT COUNTS, AND THAT IS DELIBERATELY NOT "OPEN
 * DELAYS".** The obvious figure — how many delays are open — was considered and refused where the
 * derivation lives: `delayGroups` sorts EVERY open movement into a cause (`awaiting_coordinator` is
 * its fallback), so "open delays" is the open-movement count by construction, identical to
 * `openMovements` forever, with two different labels over it. `wardNavCounts` counts the three
 * severe causes instead — the number somebody acts on — and this wraps that. A field here called
 * `openDelays` would have promised the refused figure and delivered the other one.
 *
 * ⚠️ **THE RAIL CARRIES A SIXTH COUNT THIS LIST DOES NOT.** `wardNavCounts` also returns
 * `discharges`, the blocked bed releases due today. It is absent here deliberately rather than by
 * oversight: `discharge-board.tsx`'s own comment records that its `blocked` group and
 * `CapacityBreakdown.blockedToday` are DIFFERENT populations on purpose — the board is a work queue
 * and includes a blocked release expected beyond tonight, the figure excludes it — so a facade
 * figure asserting the two agree would be a guard that fires on correct work. Adding it needs an
 * owner decision about which population the shell should show, not a wrapper.
 */
export const SHELL_FIGURE_IDS = [
  "bedsAvailable",
  "openMovements",
  "delaysNeedingAttention",
  "referralsWaiting",
  "tasks",
] as const;

export type ShellFigureId = (typeof SHELL_FIGURE_IDS)[number];

/**
 * One shell figure: the number, and what the number counts, in words.
 *
 * ⚠️ **THE NOUN TRAVELS WITH THE NUMBER**, for the reason `ward-nav-counts.ts` already records: a
 * bare numeral in chrome is read as "new since you last looked", and these are standing facts. Every
 * noun below comes from the derivation that produced the figure rather than being written here, so a
 * figure whose meaning changes carries its new words with it.
 */
export type ShellFigure = {
  readonly value: number;
  readonly noun: string;
};

/**
 * Everything the shell figures are derived from — the same collections `useWardFlow()` already hands
 * a screen, so a caller passes what it is holding and never fetches anything.
 */
export type ShellFigureInput = {
  readonly movements: Movement[];
  readonly units: Unit[];
  readonly referrals: Referral[];
  readonly bedReleases: readonly BedRelease[];
  readonly leaveBeds: readonly LeaveBed[];
  readonly now: Instant;
  /** Optional; overdue planned arrivals count in the Tasks figure when supplied. */
  readonly plannedAdmissions?: readonly import("@/components/ward-management/ward-admissions").PlannedAdmission[];
};

/**
 * The words for the one figure not carried by `wardNavCounts`. `buildActionInbox` returns rows, not
 * a labelled count, so the noun is stated here.
 *
 * ⚠️ **THIS IS THE PLURAL WORDING THE TASKS CONTROL ALREADY RENDERS, NOT A THIRD PHRASING.**
 * `ward-chrome-header.tsx` — the surface `layout.tsx` actually mounts — renders `"need attention"`
 * beside its count for every value except exactly one, where it switches to `"needs attention"`:
 * subject-verb agreement that one flat string cannot carry. `TASKS_NOUN` is fixed at the plural
 * form, so a lane rendering `${value} ${noun}` matches the header for every count the seeded
 * fixture and its three reducer mutations produce (all four worlds hold this figure at the same
 * value). It would read ungrammatically only if the count were ever exactly one — the accepted
 * cost of one flat noun, not a second phrasing invented for the facade. An earlier version of this
 * comment claimed `"needing attention"` was that existing wording; it was not, and nothing guarded
 * the claim. `tests/ward-facade-agrees-with-screens.test.ts` now reads this noun back out of the
 * header's own rendered markup, so a real divergence reddens instead of being described.
 */
const TASKS_NOUN = "need attention";

/**
 * Every shell figure, from one call.
 *
 * 🔴 **A MISSING FIGURE THROWS RATHER THAN READING AS ZERO.** `wardNavCounts` returns a
 * `Partial<Record<…>>` — a destination with no honest derivation gets no entry at all, which is that
 * module's own rule and a good one. But a zero substituted here for an absent entry would state that
 * there are no beds available, or nobody waiting, on the strength of nothing having been measured.
 * A count and no count are different statements, so an absence fails loudly.
 */
export function shellFigures(input: ShellFigureInput): Record<ShellFigureId, ShellFigure> {
  const counts = wardNavCounts({
    movements: input.movements,
    units: input.units,
    referrals: input.referrals,
    bedReleases: input.bedReleases,
    leaveBeds: input.leaveBeds,
    now: input.now,
  });

  function required(key: "capacity" | "movements" | "delays" | "referrals"): ShellFigure {
    const count = counts[key];
    if (count === undefined) {
      throw new Error(
        `ward-facade: wardNavCounts returned no "${key}" count. A shell figure with no derivation behind it ` +
          "must not be shown as 0 — that would state a measured result nobody measured.",
      );
    }
    return { value: count.value, noun: count.noun };
  }

  return {
    bedsAvailable: required("capacity"),
    openMovements: required("movements"),
    delaysNeedingAttention: required("delays"),
    referralsWaiting: required("referrals"),
    tasks: {
      value: buildActionInbox(
        input.movements.filter(isOpen),
        input.now,
        input.units,
        input.plannedAdmissions ?? [],
      ).length,
      noun: TASKS_NOUN,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * IDENTIFIER HELPERS — every route in every screen comes from here.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **EACH BUILDER WRITES ITS WHOLE ROUTE PATH OUT, AND THE DUPLICATED PREFIX IS A REACHABILITY
 * REQUIREMENT RATHER THAN AN OVERSIGHT.** `tests/ward-nav.test.ts` proves a dynamic route is
 * reachable by scanning `src` for LITERAL route text; a path assembled from a shared constant is
 * invisible to it, however correct the string it produces. Two real, linked statistics routes were
 * reported as reachable by nothing at all on 2026-09-01 for exactly that reason. Compose these from
 * a common prefix and the scan stops seeing any of them at once.
 *
 * ⚠️ **`encodeURIComponent` ON THE WAY OUT, BECAUSE THE ROUTES `decodeURIComponent` ON THE WAY IN.**
 * The pair has to be symmetric or an id needing an escape resolves on one side of the link and not
 * the other. Today's ids are plain slugs, which is precisely why this would go unnoticed if it were
 * wrong.
 */
export function patientHref(patientId: string): string {
  return `/mockups/ward-flow/people/${encodeURIComponent(patientId)}`;
}

/**
 * A ward's own screen. See `patientHref` — same two reasons.
 *
 * ⚠️ **THIS IS THE WARD ROUTE, NOT THE BED BOARD.** `/mockups/ward-flow/board/[unitId]` is a second,
 * different page about the same unit. Its Change ward control uses `wardBoardHref` below;
 * keeping the two builders distinct prevents navigation to the wrong kind of ward page.
 */
export function unitHref(unitId: string): string {
  return `/mockups/ward-flow/ward/${encodeURIComponent(unitId)}`;
}

/** The bed board for a unit, with the same literal-path and encoding contract as `unitHref`. */
export function wardBoardHref(unitId: string): string {
  return `/mockups/ward-flow/board/${encodeURIComponent(unitId)}`;
}

/**
 * A community team's operational page. See `patientHref` — same two reasons.
 *
 * ⚠️ **THE ID IS A SLUG, NOT A TEAM NAME.** `communityTeamSlug` has already removed everything that
 * does not belong in a path segment, so the encoded form is normally identical to the input; a
 * caller passing a raw team NAME by mistake produces an id that resolves to nothing rather than a
 * broken URL, which is the honest failure `communityTeamById` is built to give.
 */
export function teamHref(teamId: string): string {
  return `/mockups/ward-flow/community/${encodeURIComponent(teamId)}`;
}

/**
 * The same route, for the many callers that hold the team rather than its id.
 *
 * ⚠️ **A DELEGATE, NEVER A SECOND BUILDER — the distinction is the whole point of this module.** It
 * writes no path of its own, so there is exactly one literal for this route in the repository and it
 * is in `teamHref` above. This name is kept because six call sites and two test files already use
 * it, and renaming them would be churn in files four lanes are about to own.
 *
 * ⚠️ **IT MOVED HERE FROM `community-screen.tsx` ON 2026-09-10**, which is a `"use client"` module —
 * so this builder used to be unusable from a Server Component, a limit that file's own comment
 * records. It is now a plain function in a plain module and that limit is gone.
 */
export function communityTeamHref(team: CommunityTeam): string {
  return teamHref(team.id);
}

/** One emergency department's screen. See `patientHref` — same two reasons. */
export function edHref(edId: string): string {
  return `/mockups/ward-flow/ed/${encodeURIComponent(edId)}`;
}

/** One movement's record. See `patientHref` — same two reasons. */
export function movementHref(movementId: string): string {
  return `/mockups/ward-flow/movements/${encodeURIComponent(movementId)}`;
}

/** Fixed shell destinations live beside the parameterised builders so chrome never retypes them. */
export function handoverHref(): string {
  return "/mockups/ward-flow/handover";
}

export function settingsHref(): string {
  return "/mockups/ward-flow/settings";
}

export function officerHref(): string {
  return "/mockups/ward-flow/transport/officer";
}

export function onCallHref(): string {
  return "/mockups/ward-flow/on-call";
}

/** The digest is a sibling GET document because it must not inherit the interactive Ward shell. */
export function digestHref(): string {
  return "/mockups/ward-flow-digest";
}

/** The demonstration sign-in is a sibling page because it intentionally has no Ward shell. */
export function signInHref(): string {
  return "/mockups/ward-flow-sign-in";
}

/**
 * The statistics detail route for one ward. Moved here from `statistics/statistics-sections.ts` on
 * 2026-09-10 — lane D is about to own that file, and a builder every lane needs cannot live inside
 * one lane's file without every other lane having to edit it.
 *
 * See `patientHref` for why the whole path is written out and why the id is encoded. The literal is
 * pinned against this function in `tests/ward-statistics-sections.test.ts`, which reads this file's
 * source text, so tidying the path back into a shared constant goes red there rather than silently
 * unreaching the page.
 */
export function wardStatisticsHref(unitId: string): string {
  return `/mockups/ward-flow/statistics/ward/${encodeURIComponent(unitId)}`;
}

/** The statistics detail route for one emergency department. See `wardStatisticsHref` — same reasons. */
export function edStatisticsHref(edId: string): string {
  return `/mockups/ward-flow/statistics/ed/${encodeURIComponent(edId)}`;
}

/**
 * The statistics detail route for one health service. See `wardStatisticsHref` — same reasons.
 *
 * ⚠️ **THE ARGUMENT IS A SERVICE NAME, AND EVERY REAL ONE NEEDS ESCAPING.** All five
 * `HEALTH_SERVICES` members contain a literal space ("North Metro"), so the encoded segment always
 * carries a `%20`. That percent sign falls outside `tests/ward-nav.test.ts`'s own concrete-segment
 * character class, so even a hand-written literal href for one service could never register as a
 * "concrete" instance there — a limit of that scan, recorded on the route's own orphan entry rather
 * than worked around by inventing a URL-safe slug, which would be a second name for the same five
 * services.
 *
 * 🔴 **THIS IS THE DIFFERENCE FROM `communityStatisticsHref` BELOW: A NAME, NOT A SLUG.** Passing a
 * slug here, or a name there, produces an href that looks right and resolves to nothing.
 */
export function serviceStatisticsHref(serviceId: string): string {
  return `/mockups/ward-flow/statistics/service/${encodeURIComponent(serviceId)}`;
}

/**
 * The statistics detail route for one community team. See `wardStatisticsHref` — same reasons.
 *
 * ⚠️ **THE ID HERE IS A SLUG, NOT A NAME, AND THAT IS THE DIFFERENCE FROM `serviceStatisticsHref`.**
 * `communityTeamSlug` has already removed everything that does not belong in a path segment.
 * `encodeURIComponent` stays anyway: it is what makes the route's own `decodeURIComponent`
 * symmetric, and a caller passing a raw team NAME by mistake produces an id that resolves to nothing
 * rather than a broken URL. With sixty-odd community teams derived from the catchment source, a
 * builder that quietly accepted a name would produce that many hrefs that look right and resolve
 * wrong.
 */
export function communityStatisticsHref(teamId: string): string {
  return `/mockups/ward-flow/statistics/community/${encodeURIComponent(teamId)}`;
}

/*
 * 🔴 THE QUERY CARRIES MODEL VALUES. D-18, and the owner's ruling of 2026-09-11.
 *
 * This file used to declare its own union — `"ed" | "community" | "gp"` — a SECOND vocabulary for a
 * fact `ward-model.ts` already names. ⚠️ A union restated in a second place can drift from the first,
 * and it did: `gp` existed here and has never been a member of `REFERRAL_SOURCES`, so the menu
 * offered "From a GP or private practice", the link resolved, and the form could not have recorded
 * what it was even if it had read the parameter.
 *
 * The owner's answer, 2026-09-11, verbatim: **"NO. They come through ED or community."** There is no
 * GP referral source. So the type is no longer restated here — it is the model's own, quoted, and
 * anything this file can put in a link is something `Referral.source` can hold.
 */
import type { ReferralSource } from "@/components/ward-management/ward-model";
export type { ReferralSource };

export type RaiseReferralTarget = {
  readonly patientId?: string;
  /** Where the referral comes from. Optional: the bar's "New referral" menu names only where it goes. */
  readonly source?: ReferralSource;
  /** Where the referral goes — the slide-out's first choice, "Refer to" (Josh, 8 Oct 2026). */
  readonly refer?: "ward" | "community" | "ed";
  /** The emergency department the person is being referred FROM, when the source is `"ed"`. */
  readonly originEdId?: string;
  /** The community team the person is being referred FROM, when the source is `"community"`. */
  readonly teamId?: string;
};

/**
 * WHERE A REFERRAL IS RAISED FROM — the one thing in the app that builds the referral link.
 *
 * ⚠️ **THE QUERY IS BUILT HERE AND NOWHERE ELSE.** Three different surfaces raise a referral from
 * three different starting points (an emergency department, a community team, a GP), and each one
 * typing its own querystring is three chances to spell a parameter differently. `URLSearchParams`
 * escapes every value, so a team name or a department id containing a character that needs escaping
 * cannot break the link.
 *
 * ⚠️ **AN ABSENT FIELD IS OMITTED, NEVER SENT EMPTY.** A `patientId=` with nothing after it is a
 * parameter that was supplied and is blank; leaving it out says it was not supplied. The receiving
 * form has to be able to tell those apart, and this is the only place that distinction can be made.
 *
 * **WHO READS THEM (8 Oct 2026).** The full-page intake form is retired; the referral slide-out is
 * the one place a referral is written. `referrals/referral-sheet-link.ts` reads `patientId`,
 * `source`, `refer` and `originEdId` from this link, and the bar (`shell/ward-bar.tsx`) opens the
 * slide-out with them, in place, wherever the link is clicked. `teamId` is still never read: the
 * model holds a community team's NAME, not an id, so reading an id would either invent a registry or
 * silently store one as a name.
 */
export function raiseReferralHref(target: RaiseReferralTarget): string {
  const query = new URLSearchParams();
  if (target.patientId !== undefined) query.set("patientId", target.patientId);
  if (target.source !== undefined) query.set("source", target.source);
  if (target.refer !== undefined) query.set("refer", target.refer);
  if (target.originEdId !== undefined) query.set("originEdId", target.originEdId);
  if (target.teamId !== undefined) query.set("teamId", target.teamId);
  return `/mockups/ward-flow/referrals/new?${query.toString()}`;
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * SERVICE SCOPE — what the Service selector is showing.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * THE SERVICE SELECTOR'S SCOPE: every health service, or one named one.
 *
 * 🔴 **THERE IS NO THIRD STATE, AND THAT IS WHAT "ESCAPE NEVER CLEARS IT" MEANS STRUCTURALLY.** A
 * nullable scope would make "showing everything" and "nothing selected" the same value, and a reader
 * looking at a network-wide board would have no way to tell a deliberate whole-network view from a
 * selector that had silently dropped their choice. All services is a CHOICE, not an absence, so it
 * has its own member and the type cannot express a cleared scope at all.
 *
 * ⚠️ **THE OTHER HALF OF THAT RULE IS THE SHELL'S, NOT THIS MODULE'S.** "Escape never clears it" also
 * means a keypress that closes the selector must leave a chosen service chosen, and that is
 * behaviour in the shell's own component — this module cannot hold state without becoming a client
 * module, which the file header explains would break every Server Component that builds an href.
 */
export type ServiceScope =
  { readonly kind: "all-services" } | { readonly kind: "one-service"; readonly service: HealthService };

export const ALL_SERVICES_SCOPE: ServiceScope = { kind: "all-services" };

/**
 * The scope for a stored selection. `null` means the reader has not chosen a service — which
 * resolves to all services, never to nothing.
 */
export function serviceScope(service: HealthService | null): ServiceScope {
  return service === null ? ALL_SERVICES_SCOPE : { kind: "one-service", service };
}

/** Whether a health service is inside the current scope. All services admits every one of them. */
export function serviceScopeIncludes(scope: ServiceScope, service: HealthService): boolean {
  return scope.kind === "all-services" || scope.service === service;
}
