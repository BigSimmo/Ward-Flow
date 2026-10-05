"use client";

import { useRouter } from "next/navigation";

import {
  COMMUNITY_TEAM_PAGES,
  admissionsWithNoCommunityTeam,
  communityHubLists,
  communityTeamById,
} from "@/components/ward-management/community/community-derivations";
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

  const counted = COMMUNITY_TEAM_PAGES.map((team) => ({
    team,
    lists: communityHubLists(admissions, team, referrals),
  }));
  const withPeople = counted
    .filter((row) => row.lists.currentlyAdmitted.length + row.lists.dischargedIntoTheArea.length > 0)
    .sort((a, b) => b.lists.currentlyAdmitted.length - a.lists.currentlyAdmitted.length);
  const chosen =
    (teamId ? counted.find((row) => row.team.id === communityTeamById(teamId)?.id) : undefined) ??
    withPeople[0] ??
    counted[0];
  const { lists, team } = chosen;
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
