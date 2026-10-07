"use client";

import { StatisticsInsightChart } from "./statistics-insight-chart";
import { StatisticsDetailPanel } from "./statistics-detail-panel";
import family from "./statistics-family.module.css";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
        </div>
        <span className={family.note}>Current snapshot</span>
      </div>
      <StatisticsInsightChart
        title="Community handover"
        variant="distribution"
        testId="statistics-community-handover-chart"
        metrics={[
          {
            id: "count",
            label: "Recorded people",
            unit: "people",
            note: "Discharge dates are a subset of people holding a bed. Departures describe recorded admission states, without a reporting window.",
          },
        ]}
        rows={figureRows.map((row) => ({
          id: row.key,
          name: row.label,
          values: { count: row.figure.kind === "measured" ? row.figure.value : null },
          unavailable: figureText(row.figure),
          detail: row.counts,
        }))}
      />
      <nav className={pageStyles.viewTabbar} aria-label="Community statistics sections">
        <a
          className={pageStyles.tabBtn}
          href="#community-stat-caseload"
          onClick={() => openAndFocusCommunitySection("community-stat-caseload")}
          style={{ textDecoration: "none" }}
        >
          Current figures
        </a>
        <a
          className={pageStyles.tabBtn}
          href="#community-stat-inpatient"
          onClick={() => openAndFocusCommunitySection("community-stat-inpatient")}
          style={{ textDecoration: "none" }}
        >
          People in beds
        </a>
      </nav>

      <div id="community-stat-caseload" tabIndex={-1} className={family.actions}>
        <Link href={communityTeamHref(team)} data-testid="ward-statistics-community-operational-link">
          Open the caseload list →
        </Link>
      </div>

      {/* Preservation of required accessible details and testids */}
      <div className={pageStyles.pageGrid}>
        <StatisticsDetailPanel title="Caseload" testId="ward-statistics-community-figures">
          <div className={styles.panelBody} role="group" aria-label="Community caseload content" tabIndex={0}>
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

            <WardTable testId="ward-statistics-community-figures-table">
              <thead>
                <tr>
                  <th scope="col">Figure</th>
                  <th scope="col">Count</th>
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
                  </tr>
                ))}
              </tbody>
            </WardTable>
            <section className={styles.panelBody}>
              <h3 className={styles.figureHeading}>Case age distribution</h3>
              <section
                className={pageStyles.nestedMeasure}
                data-testid="ward-statistics-community-case-age"
                aria-labelledby="ward-statistics-community-case-age-heading"
              >
                <h3 id="ward-statistics-community-case-age-heading">How long each open case has been open</h3>
                <p className={styles.unmeasured}>Not recorded</p>
              </section>
            </section>
          </div>
        </StatisticsDetailPanel>

        <StatisticsDetailPanel
          title="Follow-up after discharge"
          count="7-day follow-up"
          testId="ward-statistics-community-followup"
        >
          <div
            id="community-stat-followup"
            className={styles.panelBody}
            role="group"
            aria-label="Post-discharge follow-up content"
            tabIndex={-1}
          >
            <p className={styles.unmeasured}>Not recorded</p>
          </div>
        </StatisticsDetailPanel>

        <StatisticsDetailPanel
          title="Discharges from hospital into this team's care"
          testId="ward-statistics-community-hospital-discharges"
        >
          <div className={styles.panelBody} role="group" aria-label="Hospital discharges content" tabIndex={0}>
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
        </StatisticsDetailPanel>

        <WardPanel title="People currently in a hospital bed" testId="ward-statistics-community-in-hospital">
          <div
            id="community-stat-inpatient"
            className={styles.panelBody}
            role="group"
            aria-label="People in hospital content"
            tabIndex={-1}
          >
            <p
              className={styles.measuredCount}
              data-testid="ward-statistics-community-in-hospital-count"
              data-unmeasured={isUnmeasured(figures.admitted) || undefined}
            >
              <strong>{figureText(figures.admitted)}</strong> referred to this team and occupying or holding a bed now.
            </p>
            <p
              className={styles.measuredCount}
              data-testid="ward-statistics-community-in-hospital-with-date"
              data-unmeasured={isUnmeasured(figures.expected) || undefined}
            >
              <strong>{figureText(figures.expected)}</strong> of those have a discharge date written down.
            </p>
          </div>
        </WardPanel>

        <StatisticsDetailPanel title="Where this team sits" testId="ward-statistics-community-comparison">
          <div className={styles.panelBody} role="group" aria-label="Community comparison content" tabIndex={0}>
            <StatisticsInsightChart
              title="Team comparison"
              testId="statistics-community-comparison-chart"
              defaultSort="value"
              metrics={figureRows.map((row) => ({
                id: row.key,
                label: row.label,
                unit: "people",
                note: "Whole-network recorded team membership. Missing links remain unavailable; discharge dates are a subset of people holding beds.",
              }))}
              rows={allTeams.map((row) => ({
                id: row.team.id,
                name: row.team.name,
                values: Object.fromEntries(
                  figureRows.map((measure) => {
                    const figure = row.figures[measure.key];
                    return [measure.key, figure.kind === "measured" ? figure.value : null];
                  }),
                ),
                unavailable: "Not linked",
                href: communityStatisticsHref(row.team.id),
              }))}
            />
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
                        <span data-testid="ward-statistics-community-compare-self">{row.team.name}</span>
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
        </StatisticsDetailPanel>

        {/*
        🔴 **THE PROVENANCE SECTION — and its figure list is DERIVED, never typed.**

        The drawing carries "What is invented, and what is real" and this screen has never had it,
        nor have two of its three siblings. ⚠️ **A hand-typed list of figure names here would be a
        second source: stale the first time a section is added, which is six times in this tranche.**
        So it names `figureRows` — the same array the table renders — and a row that nobody discloses
        cannot exist.

        ⚠️ **WHAT THIS SECTION DELIBERATELY DOES NOT CLAIM.** The drawing's "what is real" list is the
        health services, the hospital sites and the ward names read from the network's own table —
        **none of which this screen renders.** 🔴 **A "what is real" claim about things that are not
        on the page is a second source about somebody else's screen**, so this says only what it can
        see: everything here is invented, and it names each one.
      */}

        <WardPanel title="Coverage limits" testId="ward-statistics-community-limits">
          <div className={styles.panelBody} role="group" aria-label="Community coverage limits content" tabIndex={0}>
            <p className={styles.body} data-testid="ward-statistics-community-unseen">
              <strong>{unseen.length}</strong> {unseen.length === 1 ? "admission belongs" : "admissions belong"} to no
              community team on this page, out of {admissions.length}.
            </p>
            <p className={styles.body}>
              <Link href={communityTeamHref(team)} data-testid="ward-statistics-community-operational-link">
                Open {team.name}&apos;s operational page
              </Link>
            </p>
          </div>
        </WardPanel>
      </div>
    </StatisticsSectionFrame>
  );
}
