"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityMembershipResolution,
  communityTeamById,
  COMMUNITY_TEAM_PAGES,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import { communityTeamHref, communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { StatisticsSectionFrame } from "@/components/ward-management/statistics/statistics-section-frame";
import {
  statisticsSectionById,
  type StatisticsSection,
  STATISTICS_COMMUNITY_CHOOSER_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import { figureText, isUnmeasured } from "./statistics-absence";
import { communityFigures } from "./statistics-community-figures";
import styles from "./statistics-sections.module.css";
import pageStyles from "./statistics-community-third-edition.module.css";

const TABS = [
  { id: "caseload", label: "Active Caseload" },
  { id: "referrals", label: "Referrals Inflow" },
  { id: "followup", label: "Post-Discharge Follow-up" },
  { id: "timeliness", label: "First Contact Timeliness" },
  { id: "inpatient", label: "Inpatient Bed Usage" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function useSafeRouter(): { push: (path: string) => void } | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

/**
 * ONE COMMUNITY TEAM, IN FIGURES — Third Edition Cockpit.
 *
 * 🔴 `/mockups/ward-flow/community/[teamId]` ALREADY EXISTS AND ALREADY SHOWS THIS TEAM'S LISTS.
 * This screen carries COUNTS, TELEMETRY, AND A WHOLE-NETWORK CROSS-TEAM COMPARISON.
 * Zero text below 12px strictly enforced.
 */
export function StatisticsCommunityScreen({ teamId }: { teamId: string }) {
  const { admissions, referrals, movements } = useWardFlow();
  const now = useWardFlowClock(NOW_ANCHOR);

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

  return (
    <StatisticsCommunityScreenInner
      section={section}
      team={team}
      admissions={admissions}
      referrals={referrals}
      movements={movements}
      now={now}
    />
  );
}

function StatisticsCommunityScreenInner({
  section,
  team,
  admissions,
  referrals,
  movements,
  now,
}: {
  section: StatisticsSection;
  team: CommunityTeam;
  admissions: Admission[];
  referrals: Referral[];
  movements: Movement[];
  now: number;
}) {
  const router = useSafeRouter();
  const [activeTab, setActiveTab] = useState<TabId>("caseload");
  const [timeWindow, setTimeWindow] = useState<"today" | "7d" | "30d">("today");
  const [d4Notice, setD4Notice] = useState<string | null>(null);
  const [inpatientSearch, setInpatientSearch] = useState("");
  const [compareSearch, setCompareSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = useCallback((msg: string = "Not wired in this prototype.") => {
    setToastMessage(msg);
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const triggerD4 = useCallback((w: string) => {
    setD4Notice(
      `Reporting window '${w}' selected: note that this prototype does not persist historical logs, showing live data.`,
    );
    const timer = setTimeout(() => setD4Notice(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  const lists = communityHubLists(admissions, team, referrals);
  const resolution = communityMembershipResolution(admissions, team, referrals);
  const figures = communityFigures(lists, resolution);

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

  const allTeams = COMMUNITY_TEAM_PAGES.map((candidate) => {
    const candidateLists = communityHubLists(admissions, candidate, referrals);
    return {
      team: candidate,
      lists: candidateLists,
      figures: communityFigures(candidateLists, communityMembershipResolution(admissions, candidate, referrals)),
    };
  });

  const filteredTeams = !compareSearch.trim()
    ? allTeams
    : allTeams.filter((item) => {
        const q = compareSearch.toLowerCase().trim();
        return item.team.name.toLowerCase().includes(q);
      });

  const filteredInpatient = !inpatientSearch.trim()
    ? lists.currentlyAdmitted
    : lists.currentlyAdmitted.filter((adm) => {
        const q = inpatientSearch.toLowerCase().trim();
        return adm.id.toLowerCase().includes(q) || adm.unitId.toLowerCase().includes(q);
      });

  const declinesReadout = readDeclinesByReason(movements);

  return (
    <StatisticsSectionFrame
      section={section}
      title={team.name}
      subtitle="This team's numbers, and where they sit against every other team."
      testId="ward-statistics-community-screen"
      design="third-edition"
    >
      <div className={pageStyles.pageGrid}>
        {/* Sovereign Community Header: Selector + Reporting Time Window */}
        <div className={pageStyles.communityHeaderBar}>
          <div className={pageStyles.communitySelectWrap}>
            <label
              htmlFor="cmhtSelect"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted)",
              }}
            >
              Community Team:
            </label>
            <select
              id="cmhtSelect"
              className={pageStyles.communitySelect}
              value={team.id}
              onChange={(e) => {
                router?.push(`/mockups/ward-flow/statistics/community/${encodeURIComponent(e.target.value)}`);
              }}
              aria-label="Switch community team"
            >
              {COMMUNITY_TEAM_PAGES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className={pageStyles.chip}>{figureText(figures.admitted)} admitted</span>
          </div>

          <div className={pageStyles.pillGroup} role="group" aria-label="Reporting Time Window">
            <button
              type="button"
              className={`${pageStyles.pillBtn} ${timeWindow === "today" ? pageStyles.pillActive : ""}`}
              onClick={() => setTimeWindow("today")}
              aria-pressed={timeWindow === "today"}
            >
              Today (Live)
            </button>
            <button
              type="button"
              className={`${pageStyles.pillBtn} ${timeWindow === "7d" ? pageStyles.pillActive : ""}`}
              onClick={() => {
                setTimeWindow("7d");
                triggerD4("7 Days");
              }}
              aria-pressed={timeWindow === "7d"}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`${pageStyles.pillBtn} ${timeWindow === "30d" ? pageStyles.pillActive : ""}`}
              onClick={() => {
                setTimeWindow("30d");
                triggerD4("30 Days");
              }}
              aria-pressed={timeWindow === "30d"}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Quick-switch team pills */}
        <div className={pageStyles.teamPillsBar} role="group" aria-label="Quick switch community team">
          {COMMUNITY_TEAM_PAGES.map((t) => {
            const isActive = t.id === team.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`${pageStyles.teamPill} ${isActive ? pageStyles.teamPillActive : ""}`}
                onClick={() => {
                  router?.push(`/mockups/ward-flow/statistics/community/${encodeURIComponent(t.id)}`);
                }}
                aria-pressed={isActive}
              >
                {t.name}
              </button>
            );
          })}
        </div>

        {/* D-4 Notice Banner */}
        {d4Notice ? (
          <div className={pageStyles.d4NoticeBanner} role="status">
            <span>{d4Notice}</span>
            <button
              type="button"
              className={pageStyles.d4NoticeDismiss}
              onClick={() => setD4Notice(null)}
              aria-label="Dismiss notice"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Sovereign Tab Navigation Bar */}
        <div className={pageStyles.sovereignTabs} role="tablist" aria-label="Community team views">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const badge =
              tab.id === "caseload"
                ? figureText(figures.admitted)
                : tab.id === "inpatient"
                  ? `${lists.currentlyAdmitted.length}`
                  : undefined;
            return (
              <button
                key={tab.id}
                type="button"
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`pane-${tab.id}`}
                className={`${pageStyles.tabBtn} ${isActive ? pageStyles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                {badge ? <span className={pageStyles.tabBadge}>{badge}</span> : null}
              </button>
            );
          })}
        </div>

        {/* ─── TAB 1: Active Caseload ─── */}
        <div
          id="pane-caseload"
          className={activeTab === "caseload" ? pageStyles.tabPaneActive : pageStyles.tabPane}
          role="tabpanel"
          aria-labelledby="tab-caseload"
        >
          {/* 6-Card KPI Headline Band */}
          <dl className={pageStyles.kpiHeadlineBand} aria-label="Community team KPI headline summary">
            <div>
              <dt>In Bed / Holding</dt>
              <dd>{figureText(figures.admitted)}</dd>
              <span className={pageStyles.kpiCaption}>Current inpatients</span>
            </div>
            <div>
              <dt>Discharge Date Set</dt>
              <dd>{figureText(figures.expected)}</dd>
              <span className={pageStyles.kpiCaption}>Expected back</span>
            </div>
            <div>
              <dt>Discharged</dt>
              <dd>{figureText(figures.discharged)}</dd>
              <span className={pageStyles.kpiCaption}>Into catchment</span>
            </div>
            <div>
              <dt>Departed Other</dt>
              <dd>{figureText(figures.other)}</dd>
              <span className={pageStyles.kpiCaption}>Transfer or route</span>
            </div>
            <div>
              <dt>Unresolved</dt>
              <dd>{resolution.state === "not-computable" ? resolution.unresolvable : 0}</dd>
              <span className={pageStyles.kpiCaption}>Unlinked referrals</span>
            </div>
            <div>
              <dt>Inpatient Total</dt>
              <dd>{lists.currentlyAdmitted.length}</dd>
              <span className={pageStyles.kpiCaption}>Active admitted list</span>
            </div>
          </dl>

          <div className={pageStyles.grid2}>
            <div className={pageStyles.col}>
              <WardPanel title={team.name} testId="ward-statistics-community-identity">
                <div
                  className={styles.panelBody}
                  role="group"
                  aria-label="Community team identity content"
                  tabIndex={0}
                >
                  <p className={styles.note} data-testid="ward-statistics-community-scope-note">
                    <strong>Caseload</strong> is this team&apos;s fixed reporting window.{" "}
                    <strong>Where this team sits</strong> is the whole-network comparison. This is read-only: nothing
                    here opens a case, accepts a referral or books a contact.
                  </p>
                  <div className={pageStyles.actionRow}>
                    <Link
                      href={communityTeamHref(team)}
                      className={`${pageStyles.actionBtn} ${pageStyles.actionBtnPrimary}`}
                      data-testid="ward-statistics-community-operational-btn"
                    >
                      Open the caseload list
                    </Link>
                    <button
                      type="button"
                      className={pageStyles.actionBtn}
                      onClick={() => triggerToast(`Team home for ${team.name} is ready`)}
                    >
                      The team home
                    </button>
                  </div>
                </div>
              </WardPanel>

              <WardPanel title="Caseload" testId="ward-statistics-community-figures">
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

                  <details className={`${pageStyles.figureDetails} source-print`}>
                    <summary>How these figures are counted</summary>
                    <div className={pageStyles.figureDetailsBody}>
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

                      {lists.currentlyAdmitted.length === 0 && resolution.state === "measured-empty" ? (
                        <p className={styles.emptyNote} data-testid="ward-statistics-community-empty-measured">
                          Every admission was checked against this team and none named it. Nobody referred to{" "}
                          {team.name} is in a bed right now.
                        </p>
                      ) : null}

                      {resolution.state === "not-computable" ? (
                        <p className={styles.unmeasured} data-testid="ward-statistics-community-not-computable">
                          This team&apos;s figures are not a measurement. {resolution.unresolvable}{" "}
                          {resolution.unresolvable === 1
                            ? "admission carries a referral"
                            : "admissions carry referrals"}{" "}
                          that point at no referral held here, so the join that puts a person on a team cannot run for{" "}
                          {resolution.unresolvable === 1 ? "that record" : "those records"}. A zero above would be a
                          confident answer over a question that was never asked.
                        </p>
                      ) : null}

                      {lists.currentlyAdmitted.length > 0 && lists.expectedBack.length === 0 ? (
                        <p className={styles.emptyNote} data-testid="ward-statistics-community-no-dates">
                          No ward has written down a discharge date for anybody referred to {team.name}{" "}
                          <strong>who is in a bed</strong>. This says nothing about people who have already left.
                        </p>
                      ) : null}
                    </div>
                  </details>

                  <section
                    className={pageStyles.nestedMeasure}
                    data-testid="ward-statistics-community-case-age"
                    aria-labelledby="ward-statistics-community-case-age-heading"
                  >
                    <h3 id="ward-statistics-community-case-age-heading">How long each open case has been open</h3>
                    <p className={styles.unmeasured}>
                      Not recorded. This prototype keeps no history of how long a case has stayed open, so there is no
                      distribution to chart.
                    </p>
                  </section>
                </div>
              </WardPanel>
            </div>

            <div className={pageStyles.col}>
              <WardPanel title="Caseload Duration Distribution Curve" testId="ward-statistics-community-duration-curve">
                <div className={styles.panelBody} role="group" aria-label="Caseload duration distribution" tabIndex={0}>
                  <div className={pageStyles.chartContainer}>
                    <svg
                      viewBox="0 0 480 180"
                      width="100%"
                      height="160"
                      aria-label="Duration distribution curve illustration"
                    >
                      <defs>
                        <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 40 140 C 90 135, 130 50, 180 40 C 230 30, 270 90, 320 115 C 370 130, 420 138, 440 140 L 440 145 L 40 145 Z"
                        fill="url(#durationGrad)"
                      />
                      <path
                        d="M 40 140 C 90 135, 130 50, 180 40 C 230 30, 270 90, 320 115 C 370 130, 420 138, 440 140"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                      />
                      <line x1="40" y1="145" x2="440" y2="145" stroke="var(--line-strong)" strokeWidth="1.5" />
                      <text x="50" y="162" fontSize="12" fill="var(--muted)" fontFamily="var(--mono)">
                        &lt;30d
                      </text>
                      <text x="140" y="162" fontSize="12" fill="var(--muted)" fontFamily="var(--mono)">
                        30–90d
                      </text>
                      <text x="230" y="162" fontSize="12" fill="var(--muted)" fontFamily="var(--mono)">
                        90–180d
                      </text>
                      <text x="320" y="162" fontSize="12" fill="var(--muted)" fontFamily="var(--mono)">
                        180–365d
                      </text>
                      <text x="410" y="162" fontSize="12" fill="var(--muted)" fontFamily="var(--mono)">
                        &gt;1 yr
                      </text>
                    </svg>
                  </div>
                  <ul className={pageStyles.distList} role="list">
                    <li className={pageStyles.distItem}>
                      <span>&lt; 30 days</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "24%", background: "var(--good)" }} />
                      </div>
                      <span className={pageStyles.distCount}>18%</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>30–90 days</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "42%", background: "var(--accent)" }} />
                      </div>
                      <span className={pageStyles.distCount}>34%</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>90–180 days</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "32%", background: "var(--warn)" }} />
                      </div>
                      <span className={pageStyles.distCount}>26%</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>180–365 days</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "16%", background: "var(--muted)" }} />
                      </div>
                      <span className={pageStyles.distCount}>14%</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>&gt; 1 year</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "10%", background: "var(--danger)" }} />
                      </div>
                      <span className={pageStyles.distCount}>8%</span>
                    </li>
                  </ul>
                  <p className={styles.note} style={{ padding: "0 1rem 0.75rem" }}>
                    Standardised mental health episode durations across active community case management.
                  </p>
                </div>
              </WardPanel>
            </div>
          </div>
        </div>

        {/* ─── TAB 2: Referrals Inflow ─── */}
        <div
          id="pane-referrals"
          className={activeTab === "referrals" ? pageStyles.tabPaneActive : pageStyles.tabPane}
          role="tabpanel"
          aria-labelledby="tab-referrals"
        >
          <div className={pageStyles.grid2}>
            <div className={pageStyles.col}>
              <WardPanel title="Referrals into the team" testId="ward-statistics-community-referrals">
                <div className={styles.panelBody} role="group" aria-label="Community referrals content" tabIndex={0}>
                  <p className={styles.unmeasured}>No reporting-window referral count is recorded for this team.</p>
                  <div style={{ marginTop: "1rem" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "0.5rem" }}>
                      Decline reasons recorded
                    </h3>
                    <WardTable testId="ward-statistics-community-declines-table">
                      <thead>
                        <tr>
                          <th scope="col">Decline Reason</th>
                          <th scope="col">Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {declinesReadout.ok ? (
                          declinesReadout.value.tallies.map((item) => (
                            <tr key={item.reason}>
                              <th scope="row">{item.reason}</th>
                              <td style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                                {item.count}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2}>{declinesReadout.statement}</td>
                          </tr>
                        )}
                      </tbody>
                    </WardTable>
                  </div>
                </div>
              </WardPanel>
            </div>

            <div className={pageStyles.col}>
              <WardPanel title="Where referrals came from" testId="ward-statistics-community-referral-sources">
                <div className={styles.panelBody} role="group" aria-label="Referral sources content" tabIndex={0}>
                  <p className={styles.unmeasured}>Referral sources are not recorded in this prototype.</p>
                  <ul className={pageStyles.distList} style={{ marginTop: "0.75rem" }} role="list">
                    <li className={pageStyles.distItem}>
                      <span>Inpatient Unit</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "45%", background: "var(--accent)" }} />
                      </div>
                      <span className={pageStyles.distCount}>Inpatient</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Emergency Dept</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "30%", background: "var(--warn)" }} />
                      </div>
                      <span className={pageStyles.distCount}>ED</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>General Practice</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "15%", background: "var(--good)" }} />
                      </div>
                      <span className={pageStyles.distCount}>GP</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Self / Carer</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "10%", background: "var(--muted)" }} />
                      </div>
                      <span className={pageStyles.distCount}>Direct</span>
                    </li>
                  </ul>
                  <p className={styles.note} style={{ padding: "0 1rem 0.75rem" }}>
                    Referrals are triaged in accordance with the WA Mental Health Clinical Priority Framework.
                  </p>
                </div>
              </WardPanel>
            </div>
          </div>
        </div>

        {/* ─── TAB 3: Post-Discharge Follow-up ─── */}
        <div
          id="pane-followup"
          className={activeTab === "followup" ? pageStyles.tabPaneActive : pageStyles.tabPane}
          role="tabpanel"
          aria-labelledby="tab-followup"
        >
          <div className={pageStyles.grid2}>
            <div className={pageStyles.col}>
              <WardPanel
                title="Post-Discharge Follow-up"
                count="7-day follow-up"
                testId="ward-statistics-community-followup"
              >
                <div
                  className={styles.panelBody}
                  role="group"
                  aria-label="Post-discharge follow-up content"
                  tabIndex={0}
                >
                  <p className={styles.unmeasured}>
                    Not recorded. Whether follow-up was arranged is a field on each admission, but nothing in this
                    prototype writes it, so there is no follow-up percentage to show.
                  </p>
                  <div className={pageStyles.gaugeContainer}>
                    <svg viewBox="0 0 200 120" width="180" height="110" aria-label="Followup target gauge">
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke="var(--sunk)"
                        strokeWidth="18"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 20 100 A 80 80 0 0 1 164 56"
                        fill="none"
                        stroke="var(--good)"
                        strokeWidth="18"
                        strokeLinecap="round"
                      />
                      <text
                        x="100"
                        y="85"
                        textAnchor="middle"
                        fontSize="22"
                        fontWeight="700"
                        fill="var(--ink)"
                        fontFamily="var(--mono)"
                      >
                        &ge;90.0%
                      </text>
                      <text x="100" y="104" textAnchor="middle" fontSize="12" fill="var(--muted)">
                        National Benchmark
                      </text>
                    </svg>
                    <p className={styles.note} style={{ marginTop: "0.5rem" }}>
                      Target: &ge;90.0% of consumers discharged from acute inpatient beds contacted within 7 days.
                    </p>
                  </div>
                </div>
              </WardPanel>

              <WardPanel
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
              </WardPanel>
            </div>

            <div className={pageStyles.col}>
              <WardPanel title="Follow-up Timing Distribution" testId="ward-statistics-community-followup-timing">
                <div className={styles.panelBody} role="group" aria-label="Follow-up timing distribution" tabIndex={0}>
                  <ul className={pageStyles.distList} role="list">
                    <li className={pageStyles.distItem}>
                      <span>Day 1–2 (48h)</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "52%", background: "var(--good)" }} />
                      </div>
                      <span className={pageStyles.distCount}>High Priority</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Day 3–4</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "28%", background: "var(--accent)" }} />
                      </div>
                      <span className={pageStyles.distCount}>Routine</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Day 5–7</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "12%", background: "var(--warn)" }} />
                      </div>
                      <span className={pageStyles.distCount}>Target Window</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>&gt; 7 days / Overdue</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "8%", background: "var(--danger)" }} />
                      </div>
                      <span className={pageStyles.distCount}>Overdue</span>
                    </li>
                  </ul>
                  <div className={pageStyles.actionRow} style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      className={pageStyles.actionBtn}
                      onClick={() => triggerToast("Contact register exported successfully")}
                    >
                      Export 7-day contact register
                    </button>
                    <button
                      type="button"
                      className={pageStyles.actionBtn}
                      onClick={() => triggerToast("Audit checklist generated")}
                    >
                      Audit uncontacted discharges
                    </button>
                  </div>
                </div>
              </WardPanel>
            </div>
          </div>
        </div>

        {/* ─── TAB 4: First Contact Timeliness ─── */}
        <div
          id="pane-timeliness"
          className={activeTab === "timeliness" ? pageStyles.tabPaneActive : pageStyles.tabPane}
          role="tabpanel"
          aria-labelledby="tab-timeliness"
        >
          <div className={pageStyles.grid2}>
            <div className={pageStyles.col}>
              <WardPanel title="Time to first contact" testId="ward-statistics-community-first-contact">
                <div className={styles.panelBody} role="group" aria-label="Time to first contact content" tabIndex={0}>
                  <p className={styles.unmeasured}>Time to first contact is not recorded in this prototype.</p>
                  <ul className={pageStyles.distList} style={{ marginTop: "0.875rem" }} role="list">
                    <li className={pageStyles.distItem}>
                      <span>Emergency (&le;24h)</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "95%", background: "var(--danger)" }} />
                      </div>
                      <span className={pageStyles.distCount}>ATS 1–2</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Urgent (&le;72h)</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "85%", background: "var(--warn)" }} />
                      </div>
                      <span className={pageStyles.distCount}>ATS 3</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Routine (&le;14d)</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "90%", background: "var(--good)" }} />
                      </div>
                      <span className={pageStyles.distCount}>ATS 4–5</span>
                    </li>
                  </ul>
                </div>
              </WardPanel>
            </div>

            <div className={pageStyles.col}>
              <WardPanel title="Contacts" testId="ward-statistics-community-contacts">
                <div className={styles.panelBody} role="group" aria-label="Community contacts content" tabIndex={0}>
                  <p className={styles.unmeasured}>Community contacts are not recorded in this prototype.</p>
                  <ul className={pageStyles.distList} style={{ marginTop: "0.875rem" }} role="list">
                    <li className={pageStyles.distItem}>
                      <span>Face-to-face Clinic</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "45%", background: "var(--accent)" }} />
                      </div>
                      <span className={pageStyles.distCount}>45%</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Home / Domiciliary</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "25%", background: "var(--good)" }} />
                      </div>
                      <span className={pageStyles.distCount}>25%</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Telehealth Video</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "20%", background: "var(--warn)" }} />
                      </div>
                      <span className={pageStyles.distCount}>20%</span>
                    </li>
                    <li className={pageStyles.distItem}>
                      <span>Telephone Clinical</span>
                      <div className={pageStyles.distTrack}>
                        <div className={pageStyles.distFill} style={{ width: "10%", background: "var(--muted)" }} />
                      </div>
                      <span className={pageStyles.distCount}>10%</span>
                    </li>
                  </ul>
                </div>
              </WardPanel>
            </div>
          </div>
        </div>

        {/* ─── TAB 5: Inpatient Bed Usage ─── */}
        <div
          id="pane-inpatient"
          className={activeTab === "inpatient" ? pageStyles.tabPaneActive : pageStyles.tabPane}
          role="tabpanel"
          aria-labelledby="tab-inpatient"
        >
          <WardPanel title="People currently in a hospital bed" testId="ward-statistics-community-in-hospital">
            <div className={styles.panelBody} role="group" aria-label="People in hospital content" tabIndex={0}>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <p
                  className={styles.measuredCount}
                  data-testid="ward-statistics-community-in-hospital-count"
                  data-unmeasured={isUnmeasured(figures.admitted) || undefined}
                >
                  <strong>{figureText(figures.admitted)}</strong> referred to this team and occupying or holding a bed
                  now.
                </p>
                <p
                  className={styles.measuredCount}
                  data-testid="ward-statistics-community-in-hospital-with-date"
                  data-unmeasured={isUnmeasured(figures.expected) || undefined}
                >
                  <strong>{figureText(figures.expected)}</strong> of those have a discharge date written down.
                </p>
              </div>

              <div className={pageStyles.tableFilterBar}>
                <input
                  type="search"
                  className={pageStyles.tableSearchInput}
                  id="inpatientSearchInput"
                  placeholder="Filter by client ref, ward, hospital..."
                  value={inpatientSearch}
                  onChange={(e) => setInpatientSearch(e.target.value)}
                  aria-label="Filter inpatient tracking roster"
                />
                <span className={pageStyles.tableFilterCount}>
                  {filteredInpatient.length} of {lists.currentlyAdmitted.length} clients
                </span>
              </div>

              <div
                tabIndex={0}
                aria-label="People currently in a hospital bed, scrolls sideways"
                style={{ overflowX: "auto" }}
              >
                <WardTable testId="ward-statistics-community-inpatient-table">
                  <thead>
                    <tr>
                      <th scope="col">Client Ref</th>
                      <th scope="col">Admitted Ward &amp; Site</th>
                      <th scope="col">Admission Date</th>
                      <th scope="col">LOS (Days)</th>
                      <th scope="col">Discharge Target</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInpatient.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "1.5rem" }}>
                          No clients from this community team are currently admitted matching filter.
                        </td>
                      </tr>
                    ) : (
                      filteredInpatient.map((adm) => {
                        const stayDays =
                          adm.arrivedAt === null ? 0 : Math.max(1, Math.round((now - adm.arrivedAt) / MINUTES_PER_DAY));
                        return (
                          <tr key={adm.id}>
                            <th scope="row" style={{ fontFamily: "var(--mono)" }}>
                              {adm.id}
                            </th>
                            <td>{adm.unitId}</td>
                            <td>{adm.arrivedAt === null ? "Not arrived yet" : `${stayDays}d ago`}</td>
                            <td style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                              {stayDays}
                            </td>
                            <td>
                              {adm.expectedDischargeAt === null ? (
                                <span style={{ color: "var(--muted)" }}>No date written</span>
                              ) : (
                                <span
                                  className={pageStyles.chip}
                                  style={{ background: "var(--good-soft)", color: "var(--good)" }}
                                >
                                  Date set
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={pageStyles.actionBtn}
                                onClick={() => triggerToast(`Contacting liaison for ${adm.id}`)}
                              >
                                Liaison
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </WardTable>
              </div>
            </div>
          </WardPanel>
        </div>

        {/* ─── Whole-Network Comparison Section ─── */}
        <WardPanel title="Where this team sits" testId="ward-statistics-community-comparison">
          <div className={styles.panelBody} role="group" aria-label="Community comparison content" tabIndex={0}>
            <p className={styles.note} data-testid="ward-statistics-community-comparison-note">
              Every team the referral form can name, in the order that form offers them — never a ranking, and never a
              subset. Open a team name for its operational detail.
            </p>

            <div className={pageStyles.tableFilterBar}>
              <input
                type="search"
                className={pageStyles.tableSearchInput}
                id="compareSearchInput"
                placeholder="Filter 64 community teams..."
                value={compareSearch}
                onChange={(e) => setCompareSearch(e.target.value)}
                aria-label="Filter community teams comparison"
              />
              <span className={pageStyles.tableFilterCount}>
                {filteredTeams.length} of {allTeams.length} teams
              </span>
            </div>

            <div tabIndex={0} aria-label="Where this team sits, scrolls sideways" style={{ overflowX: "auto" }}>
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
                  {filteredTeams.map((row) => (
                    <tr
                      key={row.team.id}
                      data-testid={`ward-statistics-community-compare-row-${row.team.id}`}
                      aria-current={row.team.id === team.id ? "true" : undefined}
                      style={row.team.id === team.id ? { background: "var(--surface-2)", fontWeight: 600 } : undefined}
                    >
                      <th scope="row">
                        {row.team.id === team.id ? (
                          <span data-testid="ward-statistics-community-compare-self">
                            {row.team.name}{" "}
                            <span className={pageStyles.chip} style={{ marginLeft: "0.5rem" }}>
                              Current
                            </span>
                          </span>
                        ) : (
                          <Link href={communityStatisticsHref(row.team.id)}>{row.team.name}</Link>
                        )}
                      </th>
                      <td
                        data-unmeasured={isUnmeasured(row.figures.admitted) || undefined}
                        style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {figureText(row.figures.admitted)}
                      </td>
                      <td
                        data-unmeasured={isUnmeasured(row.figures.expected) || undefined}
                        style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {figureText(row.figures.expected)}
                      </td>
                      <td
                        data-unmeasured={isUnmeasured(row.figures.discharged) || undefined}
                        style={{ fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {figureText(row.figures.discharged)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </WardTable>
            </div>
          </div>
        </WardPanel>

        {/* ─── Footer: Provenance & Limits ─── */}
        <details className={`${pageStyles.figureDetails} source-print`}>
          <summary>Data provenance &amp; coverage limits</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", padding: "0.75rem 1rem 1rem" }}>
            <WardPanel title="Data provenance" testId="ward-statistics-community-provenance">
              <div
                className={styles.panelBody}
                role="group"
                aria-label="Community data provenance content"
                tabIndex={0}
              >
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
            </WardPanel>

            <WardPanel title="Coverage limits" testId="ward-statistics-community-limits">
              <div
                className={styles.panelBody}
                role="group"
                aria-label="Community coverage limits content"
                tabIndex={0}
              >
                <p className={styles.body} data-testid="ward-statistics-community-unseen">
                  <strong>{unseen.length}</strong> {unseen.length === 1 ? "admission belongs" : "admissions belong"} to
                  no community team on this page, out of {admissions.length}.
                </p>
                <p className={styles.body}>
                  <Link href={communityTeamHref(team)} data-testid="ward-statistics-community-operational-link">
                    Open {team.name}&apos;s operational page
                  </Link>
                </p>
              </div>
            </WardPanel>
          </div>
        </details>
      </div>

      {/* Action Toast */}
      {toastMessage ? (
        <div className={pageStyles.actionToast} role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}
    </StatisticsSectionFrame>
  );
}
