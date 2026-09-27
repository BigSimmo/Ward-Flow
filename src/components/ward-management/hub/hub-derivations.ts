import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { HOME_REGIONS, type BedRelease, type Unit } from "@/components/ward-management/ward-model";
import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * THE MASTER SEARCH HUB'S PURE LOGIC — one screen to search every ward, emergency department and
 * community team, with a preview pane. This module produces the flat, searchable list and its
 * summaries; it renders nothing and owns no state.
 *
 * Every number below is READ from the model's own derivations, never re-derived:
 * `unitCapacity` (ward-derivations.ts) for Ready, `bedsPendingPreparation`
 * (ward-bed-availability.ts) for the pending-preparation count. The one piece of arithmetic this
 * file DOES own — `security()` — has no home elsewhere: `Unit.lockedBeds` is a raw count, and
 * nothing in `ward-bed-designation.ts` classifies a unit as Open/Locked/Mixed from it (that file
 * only ever asks "how many", never "which of the three").
 */

export type HubKind = "ward" | "ed" | "community";

export type HubEntry = {
  /** Stable and unique across every kind — a unit id, an ED id, or a community region slug. None
   *  of the three id spaces collides with another in the real fixture; `tests/ward-hub-derivations
   *  .test.ts` pins that as a property rather than trusting it by inspection. */
  id: string;
  kind: HubKind;
  name: string;
  href: string;
  /** Hospital name — ward and ED only. */
  site?: string;
  /** Health service (ward/ED) or WA region (community). */
  service?: string;
  /** Ward only. */
  cohort?: string;
  security?: "Open" | "Locked" | "Mixed";
  authorised?: boolean;
  beds?: number;
  ready?: number;
  /**
   * ⚠️ **VACANT BUT NOT YET CLEARED — A DIFFERENT FACT FROM `pendingPreparation`, AND BOTH ARE REAL.**
   *
   * `held` is `unitCapacity().held` — physically empty beds the ward has NOT made allocatable,
   * computed from `empty` against `allocatable`. `pendingPreparation` is narrower and comes from a
   * different source entirely: bed releases flagged `preparing`, i.e. discharged and being cleaned.
   *
   * **A screen that shows one and calls it the other is wrong**, and the two genuinely differ in the
   * fixture — Mental Health Unit is 2 ready / 3 vacant-not-cleared / 0 being cleaned. Keeping both here
   * is what lets the hub show each under its own words instead of picking one and hoping.
   */
  held?: number;
  pendingPreparation?: number;
  confirmedAt?: Instant;
  stale?: boolean;
  /**
   * Beds out of service — ward only. A DIFFERENT fact again from `held` and `pendingPreparation`:
   * this bed is not coming back today at all, where the other two are empty beds on their way to
   * being usable. The mockup's ward notes state it in words rather than folding it into any total,
   * and so does this screen.
   */
  blocked?: number;
  /** How many of the ward's beds are designated locked. Ward only; `wardSecurity` reduces this to
   *  Open/Locked/Mixed for the badge, but the NUMBER is what a coordinator placing a specific
   *  patient needs, so it is carried too. */
  lockedBeds?: number;
  /** A forensic ward — independent of locked/open, per `Unit.forensic`'s own doc comment. */
  forensic?: boolean;
  /** Who this ward's beds may hold, as a CONSTRAINT. `"Undesignated"` accepts either sex and is
   *  therefore not worth a badge; anything else is. */
  sexDesignation?: string;
  /**
   * The wards that sit on this ED's own site — emergency departments only.
   *
   * ⚠️ **AN EMPTY ARRAY IS A FACT, NOT A MISSING VALUE.** Joondalup and Peel genuinely run
   * emergency departments with no mental health beds of their own, which is a real asymmetry in
   * this network and the reason the screen says so in a sentence rather than printing "0".
   */
  onSiteUnits?: string[];
};

/**
 * Open / Locked / Mixed, derived from `Unit.lockedBeds` against `Unit.beds` — NEVER from prose.
 *
 * ⚠️ **`ward-sites.ts` calls `scgh-adult-open` and `fre-adult-open` "genuinely mixed" in a comment,
 * and both carry `lockedBeds: 0`.** By the numbers that is wholly Open, not Mixed — zero locked
 * beds is zero locked beds regardless of what the comment beside the fixture row says. This
 * function trusts the recorded count and reports `"Open"` for both; the discrepancy is real and is
 * exactly the case this rule exists to catch, not a bug in this function.
 */
function wardSecurity(unit: Unit): "Open" | "Locked" | "Mixed" {
  if (unit.lockedBeds === 0) return "Open";
  if (unit.lockedBeds === unit.beds) return "Locked";
  return "Mixed";
}

/**
 * A unit's own ward-confirmed capacity is stale once it is older than that SAME figure's own
 * `staleAfterMinutes` — never a network-wide constant. `unit.allocatable` is the ward's own
 * confirmation (`CapacitySource: "ward"`), as opposed to `unit.empty`, which is the feed's belief
 * about physical vacancy — so this reads `allocatable`, not `empty`.
 */
function isStale(unit: Unit, now: Instant): boolean {
  return now - unit.allocatable.confirmedAt > unit.allocatable.staleAfterMinutes;
}

/** Lower-cased, non-alphanumeric runs collapsed to one hyphen, trimmed — a generic slugify, not a
 *  domain rule, so it stays local rather than reusing `communityTeamSlug`
 *  (`community/community-derivations.ts`): that function slugifies a DIFFERENT vocabulary (the
 *  referral-recorded clinic names `communityTeamOptions()` returns), and importing it here would
 *  read as the two vocabularies being related when they are deliberately not — see the comment on
 *  `communityHref` below for why. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * 🔴 **THE `" (placeholder)"` SUFFIX IS NOT COSMETIC AND IS NEVER STRIPPED HERE.**
 *
 * This function used to exist and did strip it, on the reasoning that "the screen states the
 * placeholder caveat once for the whole list rather than on every row". **The screen did not state
 * it.** A caveat promised in one file and owed by another is a caveat nobody writes — and while it
 * was missing, ten invented team names rendered clean under a banner whose own words are *"the
 * wards, hospitals, emergency departments and health services are the real network this prototype
 * models"*. A coordinator reading that banner would have taken "Perth Metropolitan Community Mental
 * Health Team" for a real service. It is not one; `ward-teams.ts` says so in its own doc comment,
 * and the suffix is the mechanism by which it says so **at the point of the claim**, on every screen
 * that renders the name, without a second disclosure that can drift out of step with the first.
 *
 * So: `COMMUNITY_TEAMS[region]` is rendered verbatim. If a future screen wants a shorter label, the
 * honest way to get one is for the owner to supply real team names (a table swap in `ward-teams.ts`,
 * under an hour's work per that file's own note) — never by deleting the marker that says these are
 * not real.
 */

/**
 * ⚠️ **THERE IS NO WORKING DEEP LINK FOR A `COMMUNITY_TEAMS` ENTRY, AND THIS IS A REAL GAP, NOT AN
 * OVERSIGHT.** `/mockups/ward-flow/community/[teamId]` resolves `teamId` against
 * `COMMUNITY_TEAM_PAGES` (`community/community-derivations.ts`), which is built from
 * `communityTeamOptions()` — the clinic names a REFERRAL actually records. `COMMUNITY_TEAMS` here
 * is a different, region-keyed placeholder vocabulary that shares no names with that list (by that
 * module's own comment, reading `COMMUNITY_TEAMS` into the community hub "would reintroduce
 * region-derived membership under a different name" — deliberately refused there). A href built by
 * slugifying a `COMMUNITY_TEAMS` name and pointing it at `[teamId]` would resolve to nothing and
 * land a coordinator on "No community team matches …" — an href that is not an arrival. Pointing at
 * the real index route instead is honest: it is a working page, just not a per-region one.
 */
function communityHref(teamId: string): string {
  return `/mockups/ward-flow/community/${teamId}`;
}

/**
 * The flat, searchable list the hub renders from. `units` and `bedReleases` are supplied by the
 * caller (typically `allUnits()` and live bed-release state) — EDs and community teams are read
 * from their own fixed sources internally, since nothing else varies them.
 */
export function hubEntries(input: { units: Unit[]; bedReleases: BedRelease[]; now: Instant }): HubEntry[] {
  const { units, bedReleases, now } = input;

  const wardEntries: HubEntry[] = units.map((unit) => {
    const site = siteByCode(unit.siteCode);
    const capacity = unitCapacity(unit, bedReleases);
    return {
      id: unit.id,
      kind: "ward",
      name: unit.name,
      href: `/mockups/ward-flow/ward/${unit.id}`,
      site: site?.name,
      service: site?.service,
      cohort: unit.cohort,
      security: wardSecurity(unit),
      authorised: unit.authorised,
      beds: unit.beds,
      // `.available` IS Ready — never reduced by pending-preparation beds. A bed the feed calls
      // free but the ward is still cleaning is still Ready; `pendingPreparation` sits beside it as
      // its own number, per the owner's 2026-09-05 ruling.
      ready: capacity.available,
      held: capacity.held,
      pendingPreparation: bedsPendingPreparation(unit.id, bedReleases),
      confirmedAt: unit.allocatable.confirmedAt,
      stale: isStale(unit, now),
      lockedBeds: unit.lockedBeds,
      forensic: unit.forensic,
      sexDesignation: unit.sexDesignation,
    };
  });

  const edEntries: HubEntry[] = allEmergencyDepartments().map((ed) => {
    const site = siteByCode(ed.siteCode);
    return {
      id: ed.id,
      kind: "ed",
      name: ed.name,
      href: `/mockups/ward-flow/ed/${ed.id}`,
      site: site?.name,
      service: site?.service,
      // Read off the SITE, which is where the model keeps them — never inferred from a name match.
      onSiteUnits: (site?.units ?? []).map((unit) => unit.name),
    };
  });

  // The sixty-five real WA teams the rest of the app already uses, derived from the catchment
  // table — not the ten region placeholders this list carried until 2026-09-18. Owner ruling Q-5
  // (2026-09-10): the placeholders are retired when a real list arrives, and it has.
  //
  // ⚠️ THE ID IS WHY THE LINK NOW WORKS. `/community/[teamId]` resolves against COMMUNITY_TEAM_PAGES,
  // so taking the id from the same list means each row points at its own page instead of the bare
  // index. The old rows could not: a slugified region name resolved to no team, and this module's
  // comment used to explain that gap rather than close it.
  //
  // ⚠️ NO `service`. The old rows set it to the home region, which is the one association Ward Flow
  // must not make — the owner ruled on 17 September that lists narrow by sending and receiving
  // service, never home area, and the reference pack refuses to route on contested catchments by
  // name (Lynwood, Butler/Wanneroo). A team's health service is a real fact, but it is not this
  // one, and inventing it here would put a guess in a searchable field.
  const communityEntries: HubEntry[] = COMMUNITY_TEAM_PAGES.map((team) => ({
    id: team.id,
    kind: "community",
    name: team.name,
    href: communityHref(team.id),
  }));

  return [...wardEntries, ...edEntries, ...communityEntries];
}

/**
 * Case-insensitive substring match over name, site and service. An empty (post-trim) query never
 * excludes anything — "search for nothing" means "show everything (of this kind)", never "show
 * nothing" — and this never widens the match beyond those three fields, so it can never invent one.
 */
export function searchHub(entries: HubEntry[], query: string, kind: HubKind | "all"): HubEntry[] {
  const scoped = kind === "all" ? entries : entries.filter((entry) => entry.kind === kind);
  const needle = query.trim().toLowerCase();
  if (needle === "") return scoped;
  return scoped.filter((entry) => {
    const haystack = [entry.name, entry.site, entry.service]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * How many of each kind the CURRENT QUERY matches — never the whole population.
 *
 * 🔴 **THIS TOOK `entries` ALONE AND COUNTED EVERYTHING.** With "fremantle" typed, the list showed
 * two wards and the tab beside it read **"Wards 23"**. A number sitting on a control states what
 * pressing that control will give you; 23 was the answer to a question nobody had asked, printed
 * where the answer to the asked one belongs. On a screen whose entire job is telling a coordinator
 * how much of the network is available, a figure that means something other than it appears to is
 * the specific failure this prototype exists to avoid.
 *
 * It delegates to `searchHub` rather than re-implementing the match, so the count and the list are
 * the same computation and cannot drift apart. `tests/ward-hub-screen.dom.test.tsx` pins the claim
 * where it is actually made — on the rendered screen, comparing the number ON the tab against the
 * rows pressing it produces — because agreement between two functions in this file would be true by
 * construction and would prove nothing.
 */
export function hubCounts(entries: HubEntry[], query: string): Record<HubKind | "all", number> {
  const matched = searchHub(entries, query, "all");
  return {
    all: matched.length,
    ward: matched.filter((entry) => entry.kind === "ward").length,
    ed: matched.filter((entry) => entry.kind === "ed").length,
    community: matched.filter((entry) => entry.kind === "community").length,
  };
}

/**
 * Ready beds summed by health service, ward entries only (Ready is a ward-only figure). Ordered by
 * `wardServiceOrder` (`ward-derivations.ts`) — the app's own canonical service order — rather than
 * insertion order, which would otherwise follow whatever order `units` happened to arrive in.
 */
export function readyByService(entries: HubEntry[]): { service: string; ready: number }[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== "ward" || entry.service === undefined || entry.ready === undefined) continue;
    totals.set(entry.service, (totals.get(entry.service) ?? 0) + entry.ready);
  }
  return wardServiceOrder
    .filter((service) => totals.has(service))
    .map((service) => ({
      service,
      ready: totals.get(service) ?? 0,
    }));
}

/**
 * Which wards need a coordinator's attention, and why, in a sentence they can act on — never a
 * colour alone. The only two triggers are: no ready beds right now, and a stale ward confirmation.
 * Nothing else in `HubEntry` feeds this list, so it cannot silently grow a third reason nobody
 * decided on.
 */
export type AttentionRow = {
  entry: HubEntry;
  reason: string;
  /**
   * 2 when BOTH triggers fired, 1 when one did. Not a score anybody tuned — it is a count of how
   * many of the two stated reasons apply, which is why the screen can name the criterion in words
   * beside the flag instead of asking a coordinator to trust a ranking they cannot see.
   */
  severity: 1 | 2;
};

export function needsAttention(entries: HubEntry[]): AttentionRow[] {
  const out: AttentionRow[] = [];
  for (const entry of entries) {
    if (entry.kind !== "ward") continue;
    const noReadyBeds = entry.ready === 0;
    const staleConfirmation = entry.stale === true;
    if (!noReadyBeds && !staleConfirmation) continue;

    let reason: string;
    let severity: 1 | 2;
    if (noReadyBeds && staleConfirmation) {
      reason = "No ready beds, and the last bed confirmation is stale — check with the ward.";
      severity = 2;
    } else if (staleConfirmation) {
      reason = "The last bed confirmation is stale — check with the ward.";
      severity = 1;
    } else {
      reason = "No ready beds right now.";
      severity = 1;
    }
    out.push({ entry, reason, severity });
  }
  // Worst first, and STABLE within a severity — `sort` is stable in every runtime this ships to,
  // so wards keep their fixture order rather than shuffling between renders for no reason a
  // coordinator could explain.
  return out.sort((a, b) => b.severity - a.severity);
}

/**
 * The network's beds in one row — the figure a coordinator opens this screen wanting.
 *
 * ⚠️ **FOUR NUMBERS THAT ARE NEVER ADDED TOGETHER ON SCREEN, AND THIS FUNCTION DOES NOT ADD THEM.**
 * Ready is what can be filled now. Vacant-not-cleared is empty but not allocatable. Out of service
 * is not coming back today. Beds is the network's size. Ready + vacant is the physically-empty
 * total, which reads as availability and is not, because the reducer refuses `PULL_PATIENT` into
 * the second group — the same trap the per-ward panel exists to avoid, one level up.
 */
export function networkBeds(entries: HubEntry[]): {
  ready: number;
  held: number;
  blocked: number;
  beds: number;
  wards: number;
} {
  let ready = 0;
  let held = 0;
  let blocked = 0;
  let beds = 0;
  let wards = 0;
  for (const entry of entries) {
    if (entry.kind !== "ward") continue;
    wards += 1;
    ready += entry.ready ?? 0;
    held += entry.held ?? 0;
    blocked += entry.blocked ?? 0;
    beds += entry.beds ?? 0;
  }
  return { ready, held, blocked, beds, wards };
}

/**
 * Wards not authorised under the Mental Health Act, by name.
 *
 * ⚠️ **NAMES, NOT A COUNT.** "2 wards not authorised" tells a coordinator there is a problem and
 * not where; the whole value of the line is knowing WHICH ward cannot take the involuntary patient
 * in front of them. The mockup names them for the same reason.
 */
export function unauthorisedWards(entries: HubEntry[]): HubEntry[] {
  return entries.filter((entry) => entry.kind === "ward" && entry.authorised === false);
}

/**
 * The result list, cut into the sections the mockup groups it by: wards (subgrouped by health
 * service), then emergency departments, then community teams.
 *
 * ⚠️ **BUILT FROM THE ALREADY-FILTERED RESULTS, NEVER FROM THE FULL LIST.** A section header
 * carrying a count is a claim about what is under it; deriving it from anything but the rows it
 * heads is how "Wards 23" ends up sitting above two rows — the defect this screen already had once
 * in its kind tabs.
 *
 * An empty group is dropped rather than rendered with a zero, because a heading over nothing is a
 * heading a reader has to scroll past to learn it says nothing.
 */
export function groupedResults(results: HubEntry[]): {
  key: HubKind;
  label: string;
  entries: HubEntry[];
  subgroups: { label: string; entries: HubEntry[] }[];
}[] {
  const of = (kind: HubKind) => results.filter((entry) => entry.kind === kind);

  const wards = of("ward");
  const wardSubgroups: { label: string; entries: HubEntry[] }[] = wardServiceOrder
    .map((service) => ({
      label: service as string,
      entries: wards.filter((entry) => entry.service === service),
    }))
    .filter((group) => group.entries.length > 0);
  // Any ward whose service is not in the canonical order would otherwise vanish from a list that
  // still counted it in its heading. Nothing is dropped silently.
  const placed = new Set(wardSubgroups.flatMap((group) => group.entries.map((entry) => entry.id)));
  const unplaced = wards.filter((entry) => !placed.has(entry.id));
  if (unplaced.length > 0) wardSubgroups.push({ label: "Other", entries: unplaced });

  return [
    { key: "ward" as const, label: "Wards", entries: wards, subgroups: wardSubgroups },
    { key: "ed" as const, label: "Emergency departments", entries: of("ed"), subgroups: [] },
    { key: "community" as const, label: "Community mental health teams", entries: of("community"), subgroups: [] },
  ].filter((section) => section.entries.length > 0);
}
