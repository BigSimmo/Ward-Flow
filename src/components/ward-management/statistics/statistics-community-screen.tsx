"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";

import {
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityMembershipResolution,
  communityTeamById,
  COMMUNITY_TEAM_PAGES,
} from "@/components/ward-management/community/community-derivations";
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  STATISTICS_COMMUNITY_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import { figureText, isUnmeasured } from "./statistics-absence";
import { communityFigures } from "./statistics-community-figures";
import styles from "./statistics-sections.module.css";
import pageStyles from "./statistics-community-third-edition.module.css";

function openAndFocusCommunitySection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  let details = target.closest("details");
  while (details) {
    details.open = true;
    details = details.parentElement?.closest("details") ?? null;
  }
  queueMicrotask(() => target.focus({ preventScroll: true }));
}

/**
 * ONE COMMUNITY TEAM, IN FIGURES — and deliberately NOT a second copy of its operational page.
 *
 * 🔴 **`/mockups/ward-flow/community/[teamId]` ALREADY EXISTS AND ALREADY SHOWS THIS TEAM'S
 * LISTS.** `CommunityScreen` renders "Waiting for your answer", "Ours, in a bed or holding one",
 * "Expected back", "Discharged into the area", "Left the ward another way", the referrals it has
 * made, and its own limits panel. The gap this screen closes is that the STATISTICS hub indexed
 * four kinds of place and the network has five — not that a team had nowhere to be looked at.
 *
 * ⚠️ **SO THIS SCREEN MUST NOT RESTATE THOSE LISTS, AND THE REASON IS THIS REPOSITORY'S OWN RULE:
 * a second name for one fact is the drift every governance gate here exists to prevent.** Two
 * screens rendering the same population from the same derivation will diverge the first time only
 * one of them is edited, and nothing goes red when they do. This page therefore carries COUNTS and
 * a CROSS-TEAM COMPARISON — the question the operational hub cannot answer, because it only ever
 * shows one team — and it links to that hub for the names.
 *
 * ⚠️ **A SLUG THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO**, matching the ward, department
 * and health-service screens beside it. `communityTeamById` returns `null` rather than guessing,
 * and this screen never falls back to a different team: one team's patients under another team's
 * name is the worst answer it could give.
 *
 * ⚠️ **THE EMPTY-STATE SENTENCES ARE SCOPED TO WHAT EACH FIGURE MEASURES, NEVER WIDENED.**
 * `communityHubLists` documents this trap being sprung twice in one day in two different files: a
 * figure computed over CURRENT cases, rendered as an absence over ALL cases, states something
 * false about the cases it never looked at. `expectedBack` is a subset of `currentlyAdmitted`, so
 * "nobody has a discharge date" here can only ever mean "nobody IN A BED has one" — and it says
 * exactly that. The tempting repair is to widen the figure; the defect is always in the claim.
 *
 * ⚠️ **AND AN EMPTY TEAM IS NOT AUTOMATICALLY A MEASURED ABSENCE.** `communityMembershipResolution`
 * separates "we looked and found nobody" from "we cannot look at all" — the latter when admissions
 * carry a `referralId` pointing at no referral in state. Reporting the second as the first would
 * publish a confident zero over a broken join.
 */
export function StatisticsCommunityScreen({ teamId }: { teamId: string }) {
  const router = useRouter();
  const { admissions, referrals } = useWardFlow();

  const section = statisticsSectionById("community");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'community' section");

  const team = communityTeamById(teamId);

  if (!team) {
    return (
      <StatisticsSectionFrame
        section={section}
        title="Community team not found"
        subtitle="The address names a community team this prototype does not have."
        testId="ward-statistics-community-screen"
        design="third-edition"
      >
        <div className={styles.notFoundBlock}>
          <p className={styles.notFoundBody} data-testid="ward-statistics-community-unresolved">
            No community team in this prototype has the address <span className={styles.unresolvedId}>{teamId}</span>.
            The teams here are exactly those the referral form can name — {COMMUNITY_TEAM_PAGES.length} of them — so a
            team that exists in the real world and not in that list has no page. This page never falls back to a
            different team, because a page showing one team&apos;s patients under another team&apos;s name is worse than
            a page showing nothing.
          </p>
          <p className={styles.body}>
            <Link href={STATISTICS_COMMUNITY_CHOOSER_HREF} data-testid="ward-statistics-community-chooser-link">
              Choose a community team from the statistics hub
            </Link>{" "}
            to reach one that does exist.
          </p>
        </div>
      </StatisticsSectionFrame>
    );
  }

  const lists = communityHubLists(admissions, team, referrals);
  const resolution = communityMembershipResolution(admissions, team, referrals);
  /*
   * 🔴 The four figures carry their own state. Until 2026-09-11 these cells rendered
   * `lists.<x>.length` with NO gate on `resolution`, while the paragraph below called a zero
   * there "a confident answer over a question that was never asked" — and the zero was provable,
   * not merely possible. See `statistics-community-figures.ts`.
   */
  const figures = communityFigures(lists, resolution);

  /*
   * 🔴 **ONE SOURCE FOR THE FOUR ROWS, BECAUSE THE TABLE IS NOT THE ONLY THING THAT NAMES THEM.**
   * The provenance section below has to say which figures are invented, and a hand-typed list there
   * would be a SECOND source — stale the first time a row is added, which is six times in this
   * tranche. Both render from this array, so a row that nobody discloses cannot exist.
   */
  const figureRows = [
    {
      key: "admitted",
      label: "In a bed, or holding one",
      figure: figures.admitted,
      counts:
        "Referred to this team and occupying a bed now — including a bed pulled for somebody who has not physically arrived, because the ward has committed it either way.",
    },
    {
      key: "expected",
      label: "Of those, with a discharge date written down",
      figure: figures.expected,
      counts:
        "A subset of the row above, never a count over everybody this team has ever had. It exists while somebody can still act on it.",
    },
    {
      key: "discharged",
      label: "Discharged into the area",
      figure: figures.discharged,
      counts: "Left the ward to the community this team serves.",
    },
    {
      key: "other",
      label: "Left the ward another way",
      figure: figures.other,
      counts: "Transferred, or left by a route that is not a discharge into the area.",
    },
  ] as const;
  const unseen = admissionsWithNoCommunityTeam(admissions, referrals);

  // Every team, so this page can say where THIS team sits. The operational hub shows one team at a
  // time by design, so the comparison is the thing only a statistics page can give.
  //
  // 🔴 EACH ROW CARRIES ITS OWN `figures`, GATED THE SAME WAY THIS TEAM'S OWN FOUR ARE (see `figures`
  // above). The comparison cells used to render `row.lists.*.length` directly, with no gate on
  // whether the join that puts a person on THAT candidate team could even run — the same false-zero
  // defect `communityFigures` exists to close for this team's own figures, paid a second time, once
  // per row, because the table computed its own ungated count instead of reusing that gate.
  const allTeams = COMMUNITY_TEAM_PAGES.map((candidate) => {
    const candidateLists = communityHubLists(admissions, candidate, referrals);
    return {
      team: candidate,
      lists: candidateLists,
      figures: communityFigures(candidateLists, communityMembershipResolution(admissions, candidate, referrals)),
    };
  });

  const serviceInfo =
    team.name.includes("EMHS") || team.name.includes("Armadale") || team.name.includes("Midland")
      ? {
          name: "East Metropolitan Health Service",
          tone: "east" as const,
          suburbs: "Armadale, Kelmscott, Seville Grove, Mount Nasura, Wungong, Harrisdale, Piara Waters",
        }
      : team.name.includes("SMHS") ||
          team.name.includes("Fremantle") ||
          team.name.includes("Rockingham") ||
          team.name.includes("Alma")
        ? {
            name: "South Metropolitan Health Service",
            tone: "south" as const,
            suburbs: "Fremantle, Cockburn, Melville, Rockingham, Kwinana, Mandurah",
          }
        : team.name.includes("NMHS") || team.name.includes("Osborne Park") || team.name.includes("Joondalup")
          ? {
              name: "North Metropolitan Health Service",
              tone: "north" as const,
              suburbs: "Osborne Park, Stirling, Joondalup, Wanneroo, Scarborough, Subiaco",
            }
          : team.name.includes("WACHS") || team.name.includes("Albany") || team.name.includes("Bunbury")
            ? {
                name: "WA Country Health Service",
                tone: "wachs" as const,
                suburbs: "Regional Western Australia catchment centers and primary care districts",
              }
            : {
                name: "Metropolitan Health Service",
                tone: "east" as const,
                suburbs: "Local catchment suburbs and primary network centers",
              };

  return (
    <StatisticsSectionFrame
      section={section}
      title={team.name}
      subtitle=""
      testId="ward-statistics-community-screen"
      design="third-edition"
    >
      {/* CMHT Switcher & 64-Clinic Selector Bar */}
      <div className={pageStyles.teamChooserBar}>
        <div className={pageStyles.teamSelectGroup}>
          <label htmlFor="cmhtSelect" className={pageStyles.teamSelectLabel}>
            Community Team:
          </label>
          <select
            id="cmhtSelect"
            className={pageStyles.teamSelect}
            value={team.id}
            onChange={(e) => {
              const nextId = e.target.value;
              if (nextId) router.push(communityStatisticsHref(nextId));
            }}
          >
            {COMMUNITY_TEAM_PAGES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className={pageStyles.serviceChip} data-tone={serviceInfo.tone}>
            {serviceInfo.tone === "east"
              ? "East Metro"
              : serviceInfo.tone === "south"
                ? "South Metro"
                : serviceInfo.tone === "north"
                  ? "North Metro"
                  : "Country (WACHS)"}
          </span>
        </div>
        <div className={pageStyles.pillGroup} role="group" aria-label="Reporting time window">
          <span className={`${pageStyles.pillBtn} ${pageStyles.pillBtnActive}`}>Current snapshot</span>
          <button
            type="button"
            className={pageStyles.pillBtn}
            aria-disabled="true"
            tabIndex={0}
            onClick={ignoreUnavailableActivation}
            title="Not recorded: this prototype keeps no seven-day history"
          >
            7 Days
          </button>
          <button
            type="button"
            className={pageStyles.pillBtn}
            aria-disabled="true"
            tabIndex={0}
            onClick={ignoreUnavailableActivation}
            title="Not recorded: this prototype keeps no thirty-day history"
          >
            30 Days
          </button>
        </div>
        <p className={styles.unmeasured}>
          Seven-day and thirty-day views are unavailable because this prototype keeps no reporting history.
        </p>
      </div>

      <nav className={pageStyles.viewTabbar} aria-label="Community statistics sections">
        <a
          className={pageStyles.tabBtn}
          href="#community-stat-caseload"
          onClick={() => openAndFocusCommunitySection("community-stat-caseload")}
          style={{ textDecoration: "none" }}
        >
          Caseload &amp; Beds
        </a>
        <a
          className={pageStyles.tabBtn}
          href="#community-stat-transitions"
          onClick={() => openAndFocusCommunitySection("community-stat-transitions")}
          style={{ textDecoration: "none" }}
        >
          Hospital Discharges
        </a>
        <a
          className={pageStyles.tabBtn}
          href="#community-stat-comparison"
          onClick={() => openAndFocusCommunitySection("community-stat-comparison")}
          style={{ textDecoration: "none" }}
        >
          Where this team sits
        </a>
        <a
          className={pageStyles.tabBtn}
          href="#community-stat-unsupported"
          onClick={() => openAndFocusCommunitySection("community-stat-unsupported")}
          style={{ textDecoration: "none" }}
        >
          Scope &amp; Limits
        </a>
      </nav>

      {/* Structured Executive Dashboard Grid */}
      <div className={pageStyles.pageGrid}>
        {/* Left Column: Team Identity & Active Caseload */}
        <div className={pageStyles.dashboardCol}>
          <WardPanel title={team.name} testId="ward-statistics-community-identity">
            <div className={styles.panelBody} role="group" aria-label="Community team identity content" tabIndex={0}>
              <p className={pageStyles.teamLine}>
                <strong className={pageStyles.svcName}>{serviceInfo.name}</strong> &middot; Catchment suburbs:{" "}
                {serviceInfo.suburbs}.
              </p>
              <p className={styles.note} data-testid="ward-statistics-community-scope-note">
                <strong>Caseload</strong> is this team&apos;s fixed reporting window.{" "}
                <strong>Where this team sits</strong> is the whole-network comparison. This is read-only: nothing here
                opens a case, accepts a referral or books a contact.
              </p>
              <div className={pageStyles.ctlRow}>
                <Link
                  href={communityTeamHref(team)}
                  className={`${pageStyles.ctl} ${pageStyles.ctlPrimary}`}
                  data-testid="ward-statistics-community-operational-link"
                >
                  Open the caseload list
                </Link>
                <Link href="/mockups/ward-flow" className={pageStyles.ctl}>
                  Back to team home
                </Link>
              </div>
            </div>
          </WardPanel>

          <WardPanel title="Caseload" testId="ward-statistics-community-figures">
            <div
              id="community-stat-caseload"
              className={styles.panelBody}
              role="group"
              aria-label="Community caseload content"
              tabIndex={0}
            >
              <div className={pageStyles.kpiBand} aria-label="Community caseload headline figures">
                {figureRows.map((row) => (
                  <div
                    className={pageStyles.kpi}
                    key={`kpi-${row.key}`}
                    data-testid={`ward-statistics-community-kpi-${row.key}`}
                  >
                    <span className={pageStyles.kpiLabel}>{row.label}</span>
                    <strong className={pageStyles.kpiValue}>{figureText(row.figure)}</strong>
                  </div>
                ))}
              </div>

              <div className={pageStyles.tableWrap}>
                <WardTable testId="ward-statistics-community-figures-table">
                  <thead>
                    <tr>
                      <th scope="col">Figure</th>
                      <th scope="col">Count</th>
                      <th scope="col">What it counts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {figureRows.map((row) => (
                      <tr key={row.key} data-testid={`ward-statistics-community-row-${row.key}`}>
                        <th scope="row">{row.label}</th>
                        <td
                          data-testid={`ward-statistics-community-value-${row.key}`}
                          data-unmeasured={isUnmeasured(row.figure) || undefined}
                        >
                          {figureText(row.figure)}
                        </td>
                        <td>{row.counts}</td>
                      </tr>
                    ))}
                  </tbody>
                </WardTable>
              </div>

              {lists.currentlyAdmitted.length === 0 && resolution.state === "measured-empty" ? (
                <p className={styles.emptyNote} data-testid="ward-statistics-community-empty-measured">
                  Every admission was checked against this team and none named it. Nobody referred to {team.name} is in
                  a bed right now.
                </p>
              ) : null}

              {resolution.state === "not-computable" ? (
                <p className={styles.unmeasured} data-testid="ward-statistics-community-not-computable">
                  This team&apos;s figures are not a measurement. {resolution.unresolvable}{" "}
                  {resolution.unresolvable === 1 ? "admission carries a referral" : "admissions carry referrals"} that
                  point at no referral held here, so the join that puts a person on a team cannot run for{" "}
                  {resolution.unresolvable === 1 ? "that record" : "those records"}. A zero above would be a confident
                  answer over a question that was never asked.
                </p>
              ) : null}

              {lists.currentlyAdmitted.length > 0 && lists.expectedBack.length === 0 ? (
                <p className={styles.emptyNote} data-testid="ward-statistics-community-no-dates">
                  No ward has written down a discharge date for anybody referred to {team.name}{" "}
                  <strong>who is in a bed</strong>. This says nothing about people who have already left.
                </p>
              ) : null}

              <section
                className={pageStyles.nestedMeasure}
                data-testid="ward-statistics-community-case-age"
                aria-labelledby="ward-statistics-community-case-age-heading"
              >
                <h3 id="ward-statistics-community-case-age-heading" className={styles.subHeading}>
                  Case age distribution
                </h3>
                <p className={styles.unmeasured}>
                  Not recorded. This prototype keeps no history of how long a case has stayed open, so there is no
                  duration curve or distribution to chart.
                </p>
              </section>
            </div>
          </WardPanel>
        </div>

        {/* Right Column: Inpatient Bed Presence & Hospital Discharges */}
        <div className={pageStyles.dashboardCol}>
          <WardPanel
            title="People currently in a hospital bed"
            testId="ward-statistics-community-in-hospital"
          >
            <div
              id="community-stat-inpatient"
              className={styles.panelBody}
              role="group"
              aria-label="People in hospital content"
              tabIndex={0}
            >
              <div className={pageStyles.statCalloutStack}>
                <div className={pageStyles.statCallout}>
                  <span className={pageStyles.statCalloutVal}>{figureText(figures.admitted)}</span>
                  <p
                    className={pageStyles.statCalloutText}
                    data-testid="ward-statistics-community-in-hospital-count"
                    data-unmeasured={isUnmeasured(figures.admitted) || undefined}
                  >
                    referred to this team and occupying or holding a hospital bed now.
                  </p>
                </div>
                <div className={pageStyles.statCallout}>
                  <span className={pageStyles.statCalloutVal}>{figureText(figures.expected)}</span>
                  <p
                    className={pageStyles.statCalloutText}
                    data-testid="ward-statistics-community-in-hospital-with-date"
                    data-unmeasured={isUnmeasured(figures.expected) || undefined}
                  >
                    of those have a recorded discharge date written down.
                  </p>
                </div>
              </div>
            </div>
          </WardPanel>

          <WardPanel
            title="Discharges from hospital into this team's care"
            testId="ward-statistics-community-hospital-discharges"
          >
            <div
              id="community-stat-transitions"
              className={styles.panelBody}
              role="group"
              aria-label="Hospital discharges content"
              tabIndex={0}
            >
              <p
                className={styles.measuredCount}
                data-testid="ward-statistics-community-hospital-discharges-count"
                data-unmeasured={isUnmeasured(figures.discharged) || undefined}
              >
                <strong>{figureText(figures.discharged)}</strong> discharged into the area this team serves.
              </p>
              <p
                className={styles.measuredCount}
                data-testid="ward-statistics-community-other-departures-count"
                data-unmeasured={isUnmeasured(figures.other) || undefined}
              >
                <strong>{figureText(figures.other)}</strong> left a ward another way.
              </p>
            </div>
          </WardPanel>

          <WardPanel
            title="Post-Discharge Follow-up"
            count="7-day follow-up"
            testId="ward-statistics-community-followup"
          >
            <div
              id="community-stat-followup"
              className={styles.panelBody}
              role="group"
              aria-label="Post-discharge follow-up content"
              tabIndex={0}
            >
              <p className={styles.unmeasured}>
                Not recorded. Whether follow-up was arranged is a field on each admission, but nothing in this prototype
                writes it, so there is no follow-up percentage to show.
              </p>
            </div>
          </WardPanel>

          <WardPanel title="Coverage limits" testId="ward-statistics-community-limits">
            <div className={styles.panelBody} role="group" aria-label="Community coverage limits content" tabIndex={0}>
              <p className={styles.body} data-testid="ward-statistics-community-unseen">
                <strong>{unseen.length}</strong> {unseen.length === 1 ? "admission belongs" : "admissions belong"} to no
                community team on this page, out of {admissions.length}.
              </p>
            </div>
          </WardPanel>
        </div>

        {/* Full Width: Network Comparison Table */}
        <div id="community-stat-comparison" className={pageStyles.fullWidthCol}>
          <WardPanel title="Where this team sits" testId="ward-statistics-community-comparison">
            <div className={styles.panelBody} role="group" aria-label="Community comparison content" tabIndex={0}>
              <p className={styles.note} data-testid="ward-statistics-community-comparison-note">
                Every team the referral form can name, in the order that form offers them — never a ranking, and never a
                subset. Open a team name for its operational detail.
              </p>
              <div className={pageStyles.tableWrap}>
                <WardTable testId="ward-statistics-community-comparison-table">
                  <thead>
                    <tr>
                      <th scope="col">Team</th>
                      <th scope="col">In a bed</th>
                      <th scope="col">Discharge date written</th>
                      <th scope="col">Discharged into the area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTeams.map((row) => (
                      <tr
                        key={row.team.id}
                        data-testid={`ward-statistics-community-compare-row-${row.team.id}`}
                        aria-current={row.team.id === team.id ? "true" : undefined}
                      >
                        <th scope="row">
                          {row.team.id === team.id ? (
                            <span data-testid="ward-statistics-community-compare-self">
                              <strong>{row.team.name}</strong> (This team)
                            </span>
                          ) : (
                            <Link href={communityStatisticsHref(row.team.id)}>{row.team.name}</Link>
                          )}
                        </th>
                        <td data-unmeasured={isUnmeasured(row.figures.admitted) || undefined}>
                          {figureText(row.figures.admitted)}
                        </td>
                        <td data-unmeasured={isUnmeasured(row.figures.expected) || undefined}>
                          {figureText(row.figures.expected)}
                        </td>
                        <td data-unmeasured={isUnmeasured(row.figures.discharged) || undefined}>
                          {figureText(row.figures.discharged)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </WardTable>
              </div>
            </div>
          </WardPanel>
        </div>

        {/* Full Width: Scope, Unsupported Measures & Provenance */}
        <div id="community-stat-unsupported" className={pageStyles.fullWidthCol}>
          <WardPanel
            title="Measures this prototype does not record"
            testId="ward-statistics-community-unsupported-panel"
          >
            <div className={pageStyles.unsupportedGrid}>
              <div data-testid="ward-statistics-community-referrals" className={pageStyles.unsupportedItem}>
                <h3 className={styles.subHeading}>Referrals into the team</h3>
                <p className={styles.unmeasured}>No reporting-window referral count is recorded for this team.</p>
              </div>

              <div data-testid="ward-statistics-community-referral-sources" className={pageStyles.unsupportedItem}>
                <h3 className={styles.subHeading}>Where referrals came from</h3>
                <p className={styles.unmeasured}>Referral sources are not recorded in this prototype.</p>
              </div>

              <div data-testid="ward-statistics-community-first-contact" className={pageStyles.unsupportedItem}>
                <h3 className={styles.subHeading}>Time to first contact</h3>
                <p className={styles.unmeasured}>Time to first contact is not recorded in this prototype.</p>
              </div>

              <div data-testid="ward-statistics-community-contacts" className={pageStyles.unsupportedItem}>
                <h3 className={styles.subHeading}>Contacts</h3>
                <p className={styles.unmeasured}>Community contacts are not recorded in this prototype.</p>
              </div>
            </div>
          </WardPanel>

          <WardPanel title="Data provenance" testId="ward-statistics-community-provenance">
            <div className={styles.panelBody} role="group" aria-label="Community data provenance content" tabIndex={0}>
              <div className={pageStyles.measureDetailsBody}>
                <p className={styles.body}>
                  Every figure on this page is invented and describes no real person or day, including{" "}
                  {figureRows.map((row) => row.label).join(", ")} and the cross-team comparison.
                </p>
                <p className={styles.note}>
                  <strong>Team names are real referral vocabulary</strong> from a 2015 statewide catchment table, not a
                  current roster of WA community services. Every figure beside those names is invented, and this panel
                  makes no claim about wards, sites or services shown elsewhere.
                </p>
              </div>
            </div>
          </WardPanel>
        </div>
      </div>
    </StatisticsSectionFrame>
  );
}
