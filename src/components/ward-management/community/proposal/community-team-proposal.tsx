"use client";

import { useMemo, useState } from "react";

import { communityTeamById, COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { elapsedDaysPhrase } from "@/components/ward-management/community/community-elapsed";
import { contactForTeam } from "@/components/ward-management/community/community-team-contact-mapping";
import {
  communityTeamSuburbCounts,
  nearDuplicateSpellingsOf,
} from "@/components/ward-management/community/community-vocabulary";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { daysBetween, formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import {
  COMMUNITY_DECLINE_REASONS,
  type CommunityDeclineReason,
  type Referral,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { COMMUNITY_DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";

import { acceptedRelativeToBed, stayDays, teamFigures } from "./community-proposal-figures";
import {
  Empty,
  KpiStrip,
  Panel,
  PreviewBar,
  ProposalHeader,
  PROPOSAL_ROOT,
  TableScroll,
  Verdict,
  proposalTeamHref,
  type Attention,
} from "./community-proposal-parts";
import styles from "./community-proposal.module.css";

type BedFilter = "all" | "soon" | "past";

function expectedLabel(admission: Admission, now: Instant): { text: string; past: boolean; days: number | null } {
  const expected = admission.expectedDischargeAt;
  if (expected === null) return { text: "No date set", past: false, days: null };
  if (expected < now) {
    const days = daysBetween(expected, now);
    return {
      text: days === 0 ? "Was earlier today" : `Passed ${elapsedDaysPhrase(days)} ago`,
      past: true,
      days: -days,
    };
  }
  const days = daysBetween(now, expected);
  return { text: days === 0 ? "Later today" : `In ${elapsedDaysPhrase(days)}`, past: false, days };
}

/**
 * Proposed single-team page. One scrolling page in the order a coordinator acts: who needs this
 * team's answer, who is in a bed, who is due out, who the team has accepted, then how to reach it.
 * Every figure comes from `teamFigures`; nothing is read from the demonstration cohort.
 */
export function CommunityTeamProposal({ teamId }: { teamId: string }) {
  const { admissions, referrals, units, patients, dayZero, dispatch } = useWardFlow();
  const now = useWardFlowClock();
  const team = communityTeamById(teamId);
  const [bedFilter, setBedFilter] = useState<BedFilter>("all");
  const [declineFor, setDeclineFor] = useState<string | undefined>();
  const [declineReason, setDeclineReason] = useState<CommunityDeclineReason | "">("");
  const [contactAt, setContactAt] = useState<Instant | undefined>();

  const figures = useMemo(
    () => (team ? teamFigures(team, admissions, referrals, now) : null),
    [team, admissions, referrals, now],
  );

  if (!team || !figures) {
    return (
      <>
        <PreviewBar currentHref="/mockups/ward-flow/community" label="Team not found" />
        <main id="main-content" className={styles.page}>
          <ProposalHeader
            crumbs={[{ label: "Community teams", href: PROPOSAL_ROOT }, { label: "Not found" }]}
            title="No team by that name"
            asAt={`As at ${formatSheetMoment(now, dayZero)}`}
          />
          <Empty>
            “{teamId}” is not a team name a referral can use.{" "}
            <a href={PROPOSAL_ROOT}>Choose from all community teams</a>.
          </Empty>
        </main>
      </>
    );
  }

  const contact = contactForTeam(team.name);
  const service = contact?.hsp ?? "Health service not recorded";
  const suburbCount = communityTeamSuburbCounts().get(team.name) ?? 0;
  const alike = nearDuplicateSpellingsOf(team.name);
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? unitId;
  const patientFor = (admission: Admission) => patients.find((patient) => patient.id === admission.patientId);

  const beds = [...figures.inBed].sort(
    (a, b) => (a.expectedDischargeAt ?? Number.MAX_SAFE_INTEGER) - (b.expectedDischargeAt ?? Number.MAX_SAFE_INTEGER),
  );
  const soon = beds.filter((admission) => {
    const label = expectedLabel(admission, now);
    return label.days !== null && label.days >= 0 && label.days <= 7;
  });
  const shownBeds = bedFilter === "soon" ? soon : bedFilter === "past" ? figures.pastExpected : beds;
  const next = beds.find((admission) => admission.expectedDischargeAt !== null && admission.expectedDischargeAt >= now);
  const acceptedNotInBed = figures.accepted.filter(
    (referral) => !figures.inBed.some((admission) => admission.referralId === referral.id),
  );
  const acceptedBefore = figures.inBed.filter(
    (admission) => acceptedRelativeToBed(admission, referrals, team) === "before",
  ).length;

  const attention: Attention[] = [];
  if (figures.waiting.length > 0)
    attention.push({
      tone: "danger",
      label: `${figures.waiting.length} waiting for this team's answer`,
      href: "#waiting",
    });
  if (figures.pastExpected.length > 0)
    attention.push({
      tone: "warn",
      label: `${figures.pastExpected.length} past their expected discharge`,
      href: "#in-bed",
    });
  if (figures.atEd.length > 0)
    attention.push({ tone: "warn", label: `${figures.atEd.length} away at an emergency department`, href: "#in-bed" });
  if (figures.pulledNotArrived.length > 0)
    attention.push({
      tone: "info",
      label: `${figures.pulledNotArrived.length} with a bed pulled, not yet arrived`,
      href: "#in-bed",
    });
  if (alike.length > 0)
    attention.push({
      tone: "info",
      label: `Name reads like ${alike.length} other ${alike.length === 1 ? "name" : "names"}`,
      href: "#team",
    });

  const sentence =
    figures.waiting.length === 0 && figures.inBed.length === 0 ? (
      <>
        <strong>Nothing is matched to {team.name} right now.</strong> No referral names it and nobody is in a bed under
        one.
      </>
    ) : (
      <>
        <strong>
          {figures.waiting.length === 0
            ? "Nobody is waiting for this team's answer."
            : `${figures.waiting.length} ${figures.waiting.length === 1 ? "referral is" : "referrals are"} waiting for this team's answer.`}
        </strong>{" "}
        {figures.inBed.length} {figures.inBed.length === 1 ? "person" : "people"} referred to {team.name}{" "}
        {figures.inBed.length === 1 ? "is" : "are"} in a bed or holding one
        {next ? `; the next expected discharge is ${expectedLabel(next, now).text.toLowerCase()}` : ""}.
      </>
    );

  return (
    <>
      <PreviewBar currentHref={`/mockups/ward-flow/community/${encodeURIComponent(team.id)}`} label={team.name} />
      <main id="main-content" className={styles.page} data-testid="community-team-proposal">
        <ProposalHeader
          crumbs={[
            { label: "Ward Flow", href: "/mockups/ward-flow" },
            { label: "Community teams", href: PROPOSAL_ROOT },
            { label: team.name },
          ]}
          title={team.name}
          subtitle={
            <>
              Community team · {service} · {suburbCount} {suburbCount === 1 ? "suburb names" : "suburbs name"} it in the
              catchment table
            </>
          }
          asAt={`As at ${formatSheetMoment(now, dayZero)}`}
          actions={
            <>
              <a className={styles.textLink} href="/mockups/ward-flow/referrals/new">
                Raise a referral
              </a>
              <button
                type="button"
                className={styles.textLink}
                onClick={() => {
                  dispatch({ type: "RECORD_CLINICAL_CONTACT", role: "community", now, teamId: team.id });
                  setContactAt(now);
                }}
              >
                Record contact
              </button>
            </>
          }
        />

        {contactAt !== undefined ? (
          <p className={styles.note} role="status">
            Contact with {team.name} recorded at {formatSheetMoment(contactAt, dayZero)} (team, time and role only).
          </p>
        ) : null}

        <Verdict attention={attention}>{sentence}</Verdict>

        <KpiStrip
          label={`${team.name} figures`}
          items={[
            {
              label: "Waiting for answer",
              value: figures.waiting.length,
              tone: figures.waiting.length > 0 ? "danger" : undefined,
              href: "#waiting",
            },
            {
              label: "In a bed or holding one",
              value: figures.inBed.length,
              note:
                figures.pulledNotArrived.length > 0
                  ? `${figures.pulledNotArrived.length} not yet arrived`
                  : "All arrived",
              href: "#in-bed",
            },
            {
              label: "Discharge date set",
              value: (
                <>
                  {figures.expectedBack.length}
                  <small>of {figures.inBed.length}</small>
                </>
              ),
              note: figures.pastExpected.length > 0 ? `${figures.pastExpected.length} already passed` : undefined,
              href: "#in-bed",
            },
            {
              label: "Accepted by the team",
              value: figures.accepted.length,
              note: `${acceptedBefore} accepted before the bed began`,
              href: "#accepted",
            },
            {
              label: "Left the ward",
              value: figures.dischargedToArea.length + figures.otherDepartures.length,
              note: `${figures.dischargedToArea.length} to the community`,
              href: "#left",
            },
          ]}
        />

        <nav className={styles.sectionNav} aria-label="On this page">
          <a href="#waiting">Waiting ({figures.waiting.length})</a>
          <a href="#in-bed">In a bed ({figures.inBed.length})</a>
          <a href="#accepted">Accepted ({figures.accepted.length})</a>
          <a href="#left">Left the ward ({figures.dischargedToArea.length + figures.otherDepartures.length})</a>
          <a href="#team">Contact and team</a>
        </nav>

        <div className={styles.gridMain}>
          <div className={styles.stack}>
            <Panel
              id="waiting"
              title="Waiting for this team's answer"
              question="Accept for follow-up, or decline with a reason. Inpatient admission is not decided here."
              meta={figures.waiting.length}
              flush
            >
              {figures.waiting.length === 0 ? (
                <Empty>No referral naming this team is waiting for an answer.</Empty>
              ) : (
                <TableScroll label="Waiting for this team's answer">
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Referral</th>
                        <th scope="col">Urgency</th>
                        <th scope="col">Age band</th>
                        <th scope="col">Home region</th>
                        <th scope="col">Answer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {figures.waiting.map((referral: Referral) => (
                        <tr key={referral.id}>
                          <td className={styles.mono}>{referral.id}</td>
                          <td>{urgencyTierLabel(referral.urgency)}</td>
                          <td>{referral.ageBand}</td>
                          <td>{referral.homeRegion}</td>
                          <td>
                            {declineFor === referral.id ? (
                              <div className={styles.inlineForm}>
                                <label>
                                  <span className={styles.srOnly}>Reason for declining</span>
                                  <select
                                    className={styles.select}
                                    value={declineReason}
                                    onChange={(event) => setDeclineReason(event.target.value as CommunityDeclineReason)}
                                  >
                                    <option value="">Choose a reason</option>
                                    {COMMUNITY_DECLINE_REASONS.map((reason) => (
                                      <option key={reason} value={reason}>
                                        {COMMUNITY_DECLINE_REASON_LABELS[reason]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className={styles.buttonDanger}
                                  aria-disabled={declineReason === ""}
                                  onClick={() => {
                                    if (declineReason === "") return;
                                    dispatch({
                                      type: "DECLINE_REFERRAL",
                                      role: "community",
                                      now,
                                      referralId: referral.id,
                                      destinationKind: "community_team",
                                      reason: declineReason,
                                    });
                                    setDeclineFor(undefined);
                                    setDeclineReason("");
                                  }}
                                >
                                  Confirm decline
                                </button>
                                <button
                                  type="button"
                                  className={styles.textLink}
                                  onClick={() => setDeclineFor(undefined)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className={styles.inlineForm}>
                                <button
                                  type="button"
                                  className={styles.button}
                                  onClick={() =>
                                    dispatch({
                                      type: "ACCEPT_REFERRAL",
                                      role: "community",
                                      now,
                                      referralId: referral.id,
                                      destinationKind: "community_team",
                                    })
                                  }
                                >
                                  Accept for follow-up
                                </button>
                                <button
                                  type="button"
                                  className={styles.textLink}
                                  onClick={() => setDeclineFor(referral.id)}
                                >
                                  Decline…
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              )}
            </Panel>

            <Panel
              id="in-bed"
              title="In a bed or holding one"
              question="Sorted by expected discharge, soonest first. Dates are the ward's own plan."
              meta={
                <span className={styles.segmented} role="group" aria-label="Filter people in a bed">
                  <button type="button" aria-pressed={bedFilter === "all"} onClick={() => setBedFilter("all")}>
                    All {beds.length}
                  </button>
                  <button type="button" aria-pressed={bedFilter === "soon"} onClick={() => setBedFilter("soon")}>
                    Next 7 days {soon.length}
                  </button>
                  <button type="button" aria-pressed={bedFilter === "past"} onClick={() => setBedFilter("past")}>
                    Date passed {figures.pastExpected.length}
                  </button>
                </span>
              }
              flush
            >
              {shownBeds.length === 0 ? (
                <Empty>
                  {beds.length === 0
                    ? "Nobody referred to this team is in a bed or holding one."
                    : "Nobody in this filter. Choose All to see everyone."}
                </Empty>
              ) : (
                <TableScroll label="In a bed or holding one">
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Person</th>
                        <th scope="col">Ward</th>
                        <th scope="col">Bed</th>
                        <th scope="col" className={styles.num}>
                          Days in bed
                        </th>
                        <th scope="col">Expected discharge</th>
                        <th scope="col">Legal status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownBeds.map((admission) => {
                        const patient = patientFor(admission);
                        const expected = expectedLabel(admission, now);
                        const days = stayDays(admission, now);
                        return (
                          <tr key={admission.id}>
                            <td className={styles.rowName}>
                              {admission.patientId ? (
                                <a href={patientHref(admission.patientId)}>{admission.patientId}</a>
                              ) : (
                                <span>{admission.id}</span>
                              )}
                            </td>
                            <td className={styles.nowrap}>{unitName(admission.unitId)}</td>
                            <td>
                              {admission.state === "pulled" ? (
                                <span className={`${styles.pill} ${styles.pillWarn}`}>Pulled, not arrived</span>
                              ) : admission.awayAtEmergencyDepartmentSince !== null ? (
                                <span className={`${styles.pill} ${styles.pillWarn}`}>Away at an ED</span>
                              ) : (
                                <span className={`${styles.pill} ${styles.pillQuiet}`}>In the bed</span>
                              )}
                            </td>
                            <td className={styles.num}>{days ?? "–"}</td>
                            <td className={expected.past ? styles.toneWarn : undefined}>{expected.text}</td>
                            <td>{patient?.legalStatus ?? <span className={styles.muted}>Not recorded</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              )}
            </Panel>

            <Panel
              id="accepted"
              title="Accepted by this team"
              question="Not counting people in a bed above. No team closure is recorded, so this is not a current caseload."
              meta={figures.accepted.length}
              flush
            >
              {figures.accepted.length === 0 ? (
                <Empty>This team has not accepted any referral.</Empty>
              ) : acceptedNotInBed.length === 0 ? (
                <Empty>All {figures.accepted.length} are for people listed under In a bed above.</Empty>
              ) : (
                <TableScroll label="Accepted by this team">
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Referral</th>
                        <th scope="col">Person</th>
                        <th scope="col">Age band</th>
                        <th scope="col">Accepted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acceptedNotInBed.map((referral) => {
                        const decidedAt = referral.destinations.find(
                          (addressing) =>
                            addressing.destination.kind === "community_team" &&
                            addressing.destination.teamName === team.name,
                        )?.decidedAt;
                        return (
                          <tr key={referral.id}>
                            <td className={styles.mono}>{referral.id}</td>
                            <td>
                              {referral.patientId ? (
                                <a href={patientHref(referral.patientId)}>{referral.patientId}</a>
                              ) : (
                                <span className={styles.muted}>Not linked</span>
                              )}
                            </td>
                            <td>{referral.ageBand}</td>
                            <td>
                              {decidedAt === undefined
                                ? "Time not recorded"
                                : `${elapsedDaysPhrase(Math.max(0, daysBetween(decidedAt, now)))} ago`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              )}
            </Panel>

            <Panel
              id="left"
              title="Left the ward"
              meta={figures.dischargedToArea.length + figures.otherDepartures.length}
            >
              {figures.dischargedToArea.length + figures.otherDepartures.length === 0 ? (
                <Empty>Nobody referred to this team has left a ward yet.</Empty>
              ) : (
                <p className={styles.note}>
                  {figures.dischargedToArea.length} left to the community; {figures.otherDepartures.length} left
                  somewhere else.
                </p>
              )}
            </Panel>
          </div>

          <div className={styles.stack}>
            <Panel id="team" title="How to reach this team">
              {contact ? (
                <dl className={styles.facts}>
                  <div className={styles.fact}>
                    <dt>Phone</dt>
                    <dd>{contact.publishedPhone ?? "Not in the register"}</dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>Hours</dt>
                    <dd>{contact.publishedHours ?? "Not in the register"}</dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>Address</dt>
                    <dd>{contact.address ?? "Not in the register"}</dd>
                  </div>
                </dl>
              ) : (
                <Empty>No published contact is paired with this team name.</Empty>
              )}
              <p className={styles.note}>
                {contact
                  ? `Published directory detail${contact.recordedOn ? `, recorded ${contact.recordedOn}` : ""}. Not call-tested.`
                  : "Check the service directory before calling."}
              </p>
            </Panel>

            <Panel title="About this name">
              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt>Health service</dt>
                  <dd>{service}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Suburbs naming it</dt>
                  <dd>{suburbCount}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Staffing roster</dt>
                  <dd>Not held in Ward Flow</dd>
                </div>
              </dl>
              {alike.length > 0 ? (
                <p className={styles.note}>
                  Reads like:{" "}
                  {alike.map((name, index) => {
                    const id = COMMUNITY_TEAM_PAGES.find((candidate) => candidate.name === name)?.id;
                    return (
                      <span key={name}>
                        {index > 0 ? ", " : ""}
                        {id ? <a href={proposalTeamHref(id)}>{name}</a> : name}
                      </span>
                    );
                  })}
                  . Check the referral used this exact name.
                </p>
              ) : null}
            </Panel>

            <Panel title="What this page can see">
              <dl className={styles.definitions}>
                <div>
                  <dt>Matched</dt>
                  <dd>Only people whose referral named this team. Home address is never used.</dd>
                </div>
                <div>
                  <dt>Accepted</dt>
                  <dd>A team&apos;s yes is recorded; a team discharge is not, so acceptance is not current care.</dd>
                </div>
                <div>
                  <dt>Days</dt>
                  <dd>Elapsed time is shown instead of synthetic calendar dates.</dd>
                </div>
              </dl>
              <p className={styles.note}>
                <a href={`${PROPOSAL_ROOT}#coverage`}>Admissions matched to no team</a> are counted on the hub.
              </p>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
