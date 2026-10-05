"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  COMMUNITY_TEAM_PAGES,
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityMembershipResolution,
  communityTeamById,
} from "@/components/ward-management/community/community-derivations";
import { figureText } from "@/components/ward-management/statistics/statistics-absence";
import {
  communityFigures,
  type CommunityFigures,
} from "@/components/ward-management/statistics/statistics-community-figures";
import { daysInBed } from "@/components/ward-management/ward-admissions";
import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { unitById } from "@/components/ward-management/ward-sites";

import { KpiStrip, Panel, TableScroll, ProposalHeader, Verdict, proposalHref } from "./statistics-proposal-parts";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

/**
 * Proposed community-team statistics. Opens on a team that actually has linked people (the current
 * page opens on whichever team the link named and often shows four noughts), lists those people
 * once, and states how much of the network can be linked to any team at all.
 */
export function CommunityStatisticsProposal({ teamId }: { teamId?: string }) {
  const router = useRouter();
  const { asAt, now, world } = useStatisticsProposal();
  const { admissions, referrals, dayZero } = world;

  const [teamMeasure, setTeamMeasure] = useState<keyof CommunityFigures>("admitted");
  const counted = COMMUNITY_TEAM_PAGES.map((team) => {
    const lists = communityHubLists(admissions, team, referrals);
    // Gated exactly as the current page: a team nobody can be linked to shows "not linked", never 0.
    return {
      team,
      lists,
      figures: communityFigures(lists, communityMembershipResolution(admissions, team, referrals)),
    };
  });
  const withPeople = counted
    .filter((row) => row.lists.currentlyAdmitted.length + row.lists.dischargedIntoTheArea.length > 0)
    .sort((a, b) => b.lists.currentlyAdmitted.length - a.lists.currentlyAdmitted.length);
  const chosen =
    (teamId ? counted.find((row) => row.team.id === communityTeamById(teamId)?.id) : undefined) ??
    withPeople[0] ??
    counted[0];
  const { lists, team, figures } = chosen;
  const handover = [
    { key: "admitted", label: "In a bed, or holding one", figure: figures.admitted },
    { key: "expected", label: "of whom, a discharge date is written", figure: figures.expected, nested: true },
    { key: "discharged", label: "Discharged into the area", figure: figures.discharged },
    { key: "other", label: "Left the ward another way", figure: figures.other },
  ] as const;
  const valueOfFigure = (figure: CommunityFigures[keyof CommunityFigures]) =>
    figure.kind === "measured" ? figure.value : 0;
  const handoverMax = Math.max(1, ...handover.map((row) => valueOfFigure(row.figure)));
  const TEAM_MEASURES: { id: keyof CommunityFigures; label: string }[] = [
    { id: "admitted", label: "In a bed" },
    { id: "expected", label: "With a date" },
    { id: "discharged", label: "Discharged" },
    { id: "other", label: "Left another way" },
  ];
  const measuredTeams = counted.filter((row) => row.figures[teamMeasure].kind === "measured");
  const teamRows = measuredTeams
    .map((row) => ({ ...row, value: valueOfFigure(row.figures[teamMeasure]) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.team.name.localeCompare(b.team.name));
  const teamMax = Math.max(1, ...teamRows.map((row) => row.value));
  const zeroTeams = measuredTeams.length - teamRows.length;
  const notLinkedTeams = counted.length - measuredTeams.length;
  const unlinked = admissionsWithNoCommunityTeam(admissions, referrals).length;
  const week = 7 * 24 * 60;
  const timing = {
    passed: lists.currentlyAdmitted.filter((a) => a.expectedDischargeAt !== null && a.expectedDischargeAt < now).length,
    week: lists.currentlyAdmitted.filter(
      (a) => a.expectedDischargeAt !== null && a.expectedDischargeAt >= now && a.expectedDischargeAt < now + week,
    ).length,
    later: lists.currentlyAdmitted.filter((a) => a.expectedDischargeAt !== null && a.expectedDischargeAt >= now + week)
      .length,
    none: lists.currentlyAdmitted.filter((a) => a.expectedDischargeAt === null).length,
  };

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-community">
      <ProposalHeader
        crumbs={[{ label: "Statistics", href: proposalHref("statewide") }, { label: "Community teams" }]}
        title={team.name}
        asAt={asAt}
      />

      <div className={styles.header}>
        <label className={styles.asAt}>
          Community team
          <select
            className={styles.select}
            value={team.id}
            onChange={(event) => router.push(proposalHref("community", event.target.value))}
          >
            <optgroup label={`Teams with linked people (${withPeople.length})`}>
              {withPeople.map((row) => (
                <option key={row.team.id} value={row.team.id}>
                  {row.team.name} · {row.lists.currentlyAdmitted.length} in a bed
                </option>
              ))}
            </optgroup>
            <optgroup label="No linked people yet">
              {counted
                .filter((row) => !withPeople.includes(row))
                .map((row) => (
                  <option key={row.team.id} value={row.team.id}>
                    {row.team.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
      </div>

      <Verdict
        attention={[
          ...(timing.passed ? [{ tone: "danger" as const, label: `${timing.passed} past their discharge date` }] : []),
          ...(timing.none ? [{ tone: "warn" as const, label: `${timing.none} with no discharge date` }] : []),
          ...(timing.week ? [{ tone: "good" as const, label: `${timing.week} due back within 7 days` }] : []),
        ]}
      >
        {lists.currentlyAdmitted.length ? (
          <>
            <strong>
              {lists.currentlyAdmitted.length} people linked to {team.name} are in a bed
            </strong>
            . {timing.week} are due back within a week and {timing.passed} are already past the date written for them.
          </>
        ) : (
          <strong>Nobody in a bed is linked to {team.name}.</strong>
        )}
      </Verdict>

      <KpiStrip
        label="Community team headline figures"
        items={[
          { label: "In a bed now", value: lists.currentlyAdmitted.length, note: "referral named this team" },
          {
            label: "With a discharge date",
            value: lists.expectedBack.length,
            tone: "good",
            note: `of ${lists.currentlyAdmitted.length} in a bed`,
          },
          { label: "Discharged into the area", value: lists.dischargedIntoTheArea.length },
          { label: "Left another way", value: lists.otherDepartures.length, note: "transfer or other departure" },
        ]}
      />

      <div className={styles.grid2Even}>
        <Panel
          title="Community handover"
          question={`Where ${team.name}'s linked people are now: still in a bed, or already left.`}
          meta="Current snapshot"
        >
          <ul className={styles.hbars}>
            {handover.map((row) => (
              <li className={styles.hbar} key={row.key}>
                <span className={`${styles.hbarLabel} ${"nested" in row ? styles.hbarNested : ""}`}>{row.label}</span>
                <span className={styles.hbarTrack}>
                  <span
                    className={`${styles.hbarFill} ${"nested" in row ? styles.hbarFillGood : ""}`}
                    style={{ width: `${(valueOfFigure(row.figure) / handoverMax) * 100}%` }}
                  />
                </span>
                <span className={styles.hbarValue}>{figureText(row.figure)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            The discharge-date row is part of the row above it, not extra people. Departures have no reporting window:
            they are every recorded departure for this team.
          </p>
        </Panel>

        <Panel
          title="Where this team sits"
          question="Every team with anyone on this measure, highest first."
          meta={`${teamRows.length} ${teamRows.length === 1 ? "team" : "teams"}`}
        >
          <div className={styles.segmented} role="group" aria-label="Team measure">
            {TEAM_MEASURES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === teamMeasure}
                onClick={() => setTeamMeasure(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <ul className={`${styles.hbars} ${styles.scrollList}`}>
            {teamRows.map((row) => (
              <li
                className={`${styles.hbar} ${row.team.id === team.id ? styles.hbarCurrent : ""}`}
                key={row.team.id}
                aria-current={row.team.id === team.id ? "true" : undefined}
              >
                <span className={styles.hbarLabel}>
                  <a href={proposalHref("community", row.team.id)}>{row.team.name}</a>
                </span>
                <span className={styles.hbarTrack}>
                  <span className={styles.hbarFill} style={{ width: `${(row.value / teamMax) * 100}%` }} />
                </span>
                <span className={styles.hbarValue}>{row.value}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            {zeroTeams} other {zeroTeams === 1 ? "team has" : "teams have"} none.
            {notLinkedTeams
              ? ` ${notLinkedTeams} ${notLinkedTeams === 1 ? "team" : "teams"} cannot be linked to anyone, so ${notLinkedTeams === 1 ? "it is" : "they are"} left out rather than shown as zero.`
              : ""}
          </p>
        </Panel>
      </div>

      <Panel title="When people are due back" question="Expected discharge dates for this team's people in a bed.">
        <div className={styles.split} style={{ height: "1rem" }} aria-hidden="true">
          <span
            className={styles.meterDanger}
            style={{ width: `${(timing.passed / Math.max(1, lists.currentlyAdmitted.length)) * 100}%` }}
          />
          <span
            className={styles.segReady}
            style={{ width: `${(timing.week / Math.max(1, lists.currentlyAdmitted.length)) * 100}%` }}
          />
          <span
            className={styles.segOccupied}
            style={{ width: `${(timing.later / Math.max(1, lists.currentlyAdmitted.length)) * 100}%` }}
          />
          <span
            className={styles.segClosed}
            style={{ width: `${(timing.none / Math.max(1, lists.currentlyAdmitted.length)) * 100}%` }}
          />
        </div>
        <dl className={styles.facts} style={{ marginTop: "0.875rem" }}>
          <div className={styles.fact}>
            <dt>Date already passed</dt>
            <dd className={styles.toneDanger}>{timing.passed}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Within 7 days</dt>
            <dd className={styles.toneGood}>{timing.week}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Later</dt>
            <dd>{timing.later}</dd>
          </div>
          <div className={styles.fact}>
            <dt>No date</dt>
            <dd>{timing.none}</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        title="People in a bed"
        question="Coming back to this team. Soonest expected discharge first."
        meta={`${lists.currentlyAdmitted.length} people`}
        flush
      >
        {lists.currentlyAdmitted.length === 0 ? (
          <div className={styles.panelBody}>
            <p className={styles.empty}>Nobody in a bed is linked to this team.</p>
          </div>
        ) : (
          <TableScroll label="People in a bed">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Ward</th>
                  <th scope="col" className={styles.num}>
                    Days in bed
                  </th>
                  <th scope="col">Expected discharge</th>
                </tr>
              </thead>
              <tbody>
                {lists.currentlyAdmitted
                  .slice()
                  .sort((a, b) => (a.expectedDischargeAt ?? Infinity) - (b.expectedDischargeAt ?? Infinity))
                  .map((admission) => (
                    <tr key={admission.id}>
                      <td>
                        <strong>{resolveSubjectPatient(admission, world).initials}</strong>
                      </td>
                      <td>
                        <a className={styles.link} href={proposalHref("ward", admission.unitId)}>
                          {unitById(admission.unitId)?.name ?? admission.unitId}
                        </a>
                      </td>
                      <td className={styles.num}>{daysInBed(admission, now) ?? "–"}</td>
                      <td>
                        {admission.expectedDischargeAt === null ? (
                          <span className={`${styles.pill} ${styles.pillWarn}`}>No date</span>
                        ) : (
                          <>
                            {formatSheetMoment(admission.expectedDischargeAt, dayZero)}
                            {admission.expectedDischargeAt < now ? (
                              <span className={`${styles.pill} ${styles.pillDanger}`} style={{ marginLeft: 8 }}>
                                Date passed
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <Panel title="What this page can see" question="People are linked to a team only when their referral named it.">
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Admissions linked to any team</dt>
            <dd>{admissions.length - unlinked}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Not linked to a team</dt>
            <dd className={styles.toneWarn}>{unlinked}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Teams with anyone linked</dt>
            <dd>
              {withPeople.length} <small className={styles.rowSub}>of {COMMUNITY_TEAM_PAGES.length}</small>
            </dd>
          </div>
        </dl>
      </Panel>
    </main>
  );
}
