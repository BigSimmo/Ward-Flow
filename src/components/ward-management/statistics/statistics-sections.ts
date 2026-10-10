/**
 * THE SECTIONS OF THE STATISTICS SCREEN, IN ONE PLACE.
 *
 * ⚠️ **This module exists so that the section list is written down exactly once.** The hub index on
 * the statistics home page, each section screen's own header, and the tests that check they agree
 * all read this file. A second copy of "Across all services" — in a heading, in a nav label, in a
 * test literal — is how the hub comes to promise one thing and the page to deliver another, and
 * nothing would fail while they drifted.
 *
 * ⚠️ **NOTHING HERE IS A FIGURE, AND NOTHING HERE MAY BECOME ONE.** A description says what a
 * section will hold. It never says how many wards there are, how many measures exist, or how much
 * of the section is built — those are counts, and a count written into a constant is a count that
 * stops being true silently. The screens state what is unbuilt in prose instead.
 *
 * **Why there are three sections and five routes.** The owner named three: figures across all
 * services, comparisons between units, and detail for one named unit. The third is served by two
 * dynamic routes — one for wards, one for emergency departments — because a ward and an emergency
 * department are different records with different fields, not one list with a flag. So the third
 * section has no index page of its own: it is reached by choosing a unit, and the chooser lives on
 * the comparisons page, which is the one page whose whole subject is the set of units. That is what
 * `STATISTICS_UNIT_CHOOSER_ID` and the fragment on the third section's `href` are for. It is stated
 * here rather than left to be inferred, because a hub entry that lands somewhere other than a page
 * of its own is exactly the kind of thing a later reader "tidies up" into a wrong shape.
 *
 * **A fourth section, added for a different audience.** The first three answer a network-wide or
 * per-unit question; a health-service manager asks a different one — is my service carrying its
 * own referral demand, or exporting it, and what does that cost. `HEALTH_SERVICES` (`ward-model.ts`)
 * is a small, fixed, five-member list, so this fourth route is dynamic in SHAPE (one route serving
 * every service) but not in scale, and it has the same reachability problem the third section's two
 * routes have: a dynamic route with no concrete link anywhere is a page only reachable by typing an
 * address. `STATISTICS_SERVICE_CHOOSER_ID` and the fragment on the fourth section's `href` are for
 * exactly that, and the chooser lives on the hub (`statistics-screen.tsx`) rather than the
 * comparisons page — a health service is not a unit, and the comparisons page's own subject is the
 * set of units.
 */

/** The statistics home page — the hub that indexes the sections below. */
export const STATISTICS_HOME_HREF = "/mockups/ward-flow/statistics";

/**
 * ⚠️ **THE FULL PATH IS WRITTEN OUT, NEVER COMPOSED — and that is a reachability requirement rather
 * than a style preference.** The repository's route scan reads SOURCE TEXT: it can see a literal
 * route path and cannot see one assembled at runtime, however correct the resulting string is. Both
 * of these were composed from `STATISTICS_HOME_HREF` until 2026-09-01, and on that day the strings
 * "/mockups/ward-flow/statistics/overview" and "/mockups/ward-flow/statistics/compare" appeared
 * NOWHERE in `src` — only in this module's own test. Two real, linked, working routes were invisible
 * to the scan, and nothing anywhere went red about it.
 *
 * This is the same rule `wardStatisticsHref` and `edStatisticsHref` below already follow, and it is
 * the reason their duplicated prefix is deliberate. `STATISTICS_HOME_HREF` stays a literal beside
 * them because it is a route in its own right and is linked as one.
 *
 * Ward Lead is building an invariant test that walks every route directory under
 * `src/app/mockups/ward-flow` and asserts its literal prefix appears in `src` source text. These
 * three sites were written out by hand ahead of it; if that test later flags something here, the
 * two are the same finding.
 */
export const STATISTICS_OVERVIEW_HREF = "/mockups/ward-flow/statistics/overview";

export const STATISTICS_COMPARE_HREF = "/mockups/ward-flow/statistics/compare";

/** The four index pages (Statistics A, 9 Oct 2026): every service, ward, ED and team on one page. */
export const STATISTICS_SERVICES_HREF = "/mockups/ward-flow/statistics/services";
export const STATISTICS_WARDS_HREF = "/mockups/ward-flow/statistics/wards";
export const STATISTICS_EDS_HREF = "/mockups/ward-flow/statistics/eds";
export const STATISTICS_TEAMS_HREF = "/mockups/ward-flow/statistics/teams";

/**
 * The id of the unit chooser on the comparisons page. The third section's `href` points at it, and
 * the comparisons screen puts it on the chooser's own heading — one constant, so a rename cannot
 * leave the hub linking at an anchor that no longer exists.
 */
export const STATISTICS_UNIT_CHOOSER_ID = "choose-a-unit";

/**
 * The link to the chooser — the comparisons route plus its anchor.
 *
 * ⚠️ **Every link to the chooser uses this, never a bare `STATISTICS_COMPARE_HREF`.** Fix round 1
 * found the four in-page links back to the chooser had each dropped the fragment, so a reader who
 * clicked "choose a ward" landed at the top of a page that opens with two sections about why no
 * comparison exists and had to scroll to find the list — and a test asserting the bare href had
 * blessed it. A constant is what makes the correct link the cheap one to write.
 */
export const STATISTICS_UNIT_CHOOSER_HREF = `/mockups/ward-flow/statistics/compare#${STATISTICS_UNIT_CHOOSER_ID}`;

/**
 * The id of the health-service chooser on the statistics hub, and the link to it — the fourth
 * section's own `STATISTICS_UNIT_CHOOSER_ID`/`STATISTICS_UNIT_CHOOSER_HREF` pair, for the same
 * reason: every link to the chooser must use this constant, never a bare `STATISTICS_HOME_HREF`,
 * or a reader following the hub entry lands at the top of the statistics home page rather than at
 * the list of five services.
 */
export const STATISTICS_SERVICE_CHOOSER_ID = "choose-a-health-service";

export const STATISTICS_SERVICE_CHOOSER_HREF = `${STATISTICS_HOME_HREF}#${STATISTICS_SERVICE_CHOOSER_ID}`;

/**
 * The id of the community-team chooser on the statistics hub, and the link to it — the fifth
 * section's own pair, for the same reason as the two above: a link to the chooser must use this
 * constant, never a bare `STATISTICS_HOME_HREF`, or a reader following the hub entry lands at the
 * top of the statistics home page rather than at the list of teams.
 */
export const STATISTICS_COMMUNITY_CHOOSER_ID = "choose-a-community-team";

export const STATISTICS_COMMUNITY_CHOOSER_HREF = `${STATISTICS_HOME_HREF}#${STATISTICS_COMMUNITY_CHOOSER_ID}`;

export type StatisticsSectionId = "overview" | "compare" | "units" | "service" | "community";

export type StatisticsSection = {
  id: StatisticsSectionId;
  /** The section's name, as it is written wherever the section is named. */
  label: string;
  /** One line saying what the section is for. Never a claim that anything in it is built. */
  description: string;
  /** Where a reader is sent to reach the section. */
  href: string;
};

export const STATISTICS_SECTIONS: readonly StatisticsSection[] = [
  {
    id: "overview",
    label: "Across all services",
    description: "Figures about the prototype as a whole, and about Western Australia, rather than about any one unit.",
    href: STATISTICS_OVERVIEW_HREF,
  },
  {
    id: "compare",
    label: "Ward and ED comparisons",
    /*
     * ⚠️ THIS PROMISED ONE MEASURE SET AND THE SOFTWARE CANNOT HOLD ONE. A ward measure is about
     * BEDS — length of stay, empty-bed minutes, discharge dates — and an emergency department in
     * this model has no beds, no capacity and no occupancy, so half of that grid could only ever
     * be blank. `statistics-ed-screen.tsx` says it plainly: a ward and an emergency department
     * are not one list with a flag.
     *
     * Changed rather than queued, under the owner's standing rule that a sentence describing what
     * the software does is inside the diff that makes it false. The scope did not shrink: both are
     * still compared, each against its own kind.
     */
    description:
      "Every ward beside the other wards, and every emergency department beside the other departments — each on the measures its own records can carry.",
    href: STATISTICS_COMPARE_HREF,
  },
  {
    id: "units",
    label: "One ward or emergency department in detail",
    description: "Everything the model can honestly say about a single named unit, chosen from the comparisons page.",
    href: STATISTICS_UNIT_CHOOSER_HREF,
  },
  {
    id: "service",
    label: "One health service in detail",
    description:
      "Whether one health service is carrying its own referral demand or exporting it, chosen from this page.",
    href: STATISTICS_SERVICE_CHOOSER_HREF,
  },
  {
    id: "community",
    label: "One community team in detail",
    description:
      "Who a community team has in a bed, who is expected back, and who it cannot see, chosen from this page.",
    href: STATISTICS_COMMUNITY_CHOOSER_HREF,
  },
] as const;

/** Returns `undefined` for an unknown id. Never falls back to a different section. */
export function statisticsSectionById(id: string): StatisticsSection | undefined {
  return STATISTICS_SECTIONS.find((section) => section.id === id);
}

/*
 * THE FOUR PER-UNIT / PER-SERVICE / PER-TEAM HREF BUILDERS MOVED OUT OF THIS FILE ON 2026-09-10.
 *
 * They now live in `shell/ward-facade.ts`, with their reasoning and their route literals intact.
 * The move is not tidying: sixteen screens are being rebuilt in four lanes that never see each
 * other's code, this file belongs to one of those lanes, and a builder every lane needs cannot sit
 * inside one lane's file without every other lane having to edit it. The facade is the shared
 * surface; this module keeps the SECTION LIST, which is genuinely this screen's own subject.
 *
 * Nothing about why each path is written out in full changed, and neither did the source-text pin
 * that protects it: `tests/ward-statistics-sections.test.ts` now reads the facade's source for
 * those literals and this file's source for the section hrefs, so a builder tidied back into a
 * composed prefix still goes red rather than silently unreaching a page.
 */
