"use client";

import { declineReasonLabels } from "@/components/ward-management/movements/movement-workspace-derivations";
import {
  blockedDischargesByReason,
  declinesByReason,
  pullToArrival,
  refusedAndNothingPending,
} from "@/components/ward-management/statistics/statistics-derivations";
import { dayOf } from "@/components/ward-management/ward-clock";

import { Panel, ProposalHeader, Verdict, proposalHref } from "./statistics-proposal-parts";
import { hoursLabel, todayReferralFigures } from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

type Row = { label: string; count: number };

function RankedBars({ rows, tone, unit }: { rows: Row[]; tone: string; unit: [string, string] }) {
  const shown = rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
  const zero = rows.filter((row) => row.count === 0);
  const max = Math.max(1, ...shown.map((row) => row.count));
  return (
    <>
      {shown.length ? (
        <ul className={styles.hbars}>
          {shown.map((row) => (
            <li className={styles.hbar} key={row.label}>
              <span className={styles.hbarLabel} title={row.label}>
                {row.label}
              </span>
              <span className={styles.hbarTrack}>
                <span className={`${styles.hbarFill} ${tone}`} style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <span className={styles.hbarValue}>
                {row.count} {row.count === 1 ? unit[0] : unit[1]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>None recorded.</p>
      )}
      {zero.length ? (
        <p className={styles.note}>None recorded for: {zero.map((row) => row.label).join(", ")}.</p>
      ) : null}
    </>
  );
}

/**
 * Proposed Referrals and discharges screen: the network's flow from waiting in an emergency
 * department through to leaving a ward, and what is slowing each step. Gathers figures the current
 * Summary and Overview scatter across collapsed rows.
 */
export function FlowStatisticsProposal() {
  const { eds, waiting, asAt, now, world } = useStatisticsProposal();
  const { admissions, movements, referrals, units } = world;
  const today = todayReferralFigures(referrals, now);
  const unplaced = eds.reduce((sum, ed) => sum + ed.unplaced, 0);
  const over24 = eds.reduce((sum, ed) => sum + ed.over24h, 0);
  const refused = refusedAndNothingPending(movements, units, now);
  const declines = declinesByReason(movements);
  const blockers = blockedDischargesByReason(admissions);
  const arrival = pullToArrival(admissions);

  const pulled = admissions.filter((admission) => admission.state === "pulled").length;
  const inBed = admissions.filter((admission) => admission.state === "occupied");
  const datePassed = inBed.filter(
    (admission) => admission.expectedDischargeAt !== null && admission.expectedDischargeAt < now,
  ).length;
  const noDate = inBed.filter((admission) => admission.expectedDischargeAt === null).length;
  const leftToday = admissions.filter(
    (admission) => admission.leftAt !== null && dayOf(admission.leftAt) === dayOf(now),
  ).length;

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-flow">
      <ProposalHeader
        crumbs={[{ label: "Statistics", href: proposalHref("statewide") }, { label: "Referrals and discharges" }]}
        title="Referrals and discharges"
        asAt={asAt}
      />

      <Verdict
        attention={[
          { tone: "danger", label: `${unplaced} waiting with no ward yet` },
          ...(refused.count
            ? [{ tone: "danger" as const, label: `${refused.count} declined by every ward asked` }]
            : []),
          { tone: "warn", label: `${datePassed} in a bed past their discharge date` },
          { tone: "warn", label: `${blockers.totalCount} discharges held up` },
        ]}
      >
        <strong>{waiting} people are waiting for a bed</strong>; {unplaced} have no ward yet and {over24} have waited
        over 24 hours. On the wards, {blockers.totalCount} discharges are held up and {datePassed} people are past the
        discharge date written for them.
      </Verdict>

      <Panel
        title="From emergency department to discharge"
        question="Where people are in the journey right now."
        meta="Open requests and current admissions"
      >
        <div className={styles.funnel}>
          <div className={styles.funnelStep}>
            <span className={styles.funnelStepLabel}>Waiting in ED</span>
            <strong>{waiting}</strong>
            <span>
              {waiting - unplaced} accepted · {unplaced} no ward yet
            </span>
            <span className={styles.split} aria-hidden="true">
              <span
                className={styles.segReady}
                style={{ width: `${((waiting - unplaced) / Math.max(1, waiting)) * 100}%` }}
              />
              <span className={styles.meterDanger} style={{ width: `${(unplaced / Math.max(1, waiting)) * 100}%` }} />
            </span>
          </div>
          <div className={styles.funnelStep}>
            <span className={styles.funnelStepLabel}>Bed given, on the way</span>
            <strong>{pulled}</strong>
            <span>
              {arrival.averageMinutes === null
                ? "No arrival times yet"
                : `Average ${hoursLabel(arrival.averageMinutes)} from bed given to arrival`}
            </span>
          </div>
          <div className={styles.funnelStep}>
            <span className={styles.funnelStepLabel}>In a bed</span>
            <strong>{inBed.length}</strong>
            <span>
              {inBed.length - noDate} with a discharge date · {noDate} without
            </span>
            <span className={styles.split} aria-hidden="true">
              <span
                className={styles.segReady}
                style={{ width: `${((inBed.length - noDate - datePassed) / Math.max(1, inBed.length)) * 100}%` }}
              />
              <span
                className={styles.segPulled}
                style={{ width: `${(datePassed / Math.max(1, inBed.length)) * 100}%` }}
              />
              <span className={styles.segClosed} style={{ width: `${(noDate / Math.max(1, inBed.length)) * 100}%` }} />
            </span>
          </div>
          <div className={styles.funnelStep}>
            <span className={styles.funnelStepLabel}>Left a ward today</span>
            <strong>{leftToday}</strong>
            <span>discharged or transferred</span>
          </div>
        </div>
        <p className={styles.note}>
          In-a-bed bar: green has a future discharge date, amber is past its date, hatched has no date.
        </p>
      </Panel>

      <div className={styles.grid2Even}>
        <Panel title="Referrals for a bed today" question="Raised today with a ward as the destination.">
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Raised</dt>
              <dd>{today.raised}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Accepted</dt>
              <dd className={styles.toneGood}>{today.accepted}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Declined by every ward</dt>
              <dd>{today.declined}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Awaiting a ward</dt>
              <dd className={styles.toneWarn}>{today.open}</dd>
            </div>
          </dl>
          <div className={styles.split} aria-hidden="true" style={{ height: "0.625rem", marginTop: "0.875rem" }}>
            <span
              className={styles.segReady}
              style={{ width: `${(today.accepted / Math.max(1, today.raised)) * 100}%` }}
            />
            <span
              className={styles.segPulled}
              style={{ width: `${(today.open / Math.max(1, today.raised)) * 100}%` }}
            />
            <span
              className={styles.meterDanger}
              style={{ width: `${(today.declined / Math.max(1, today.raised)) * 100}%` }}
            />
          </div>
          <p className={styles.note}>
            {Math.round((today.accepted / Math.max(1, today.raised)) * 100)}% of today&apos;s referrals already have a
            ward.
          </p>
        </Panel>

        <Panel
          title="Why wards decline"
          question="Every decline on record, by the reason the ward gave."
          meta={`${declines.totalCount} declines`}
        >
          <RankedBars
            rows={declines.tallies.map((tally) => ({ label: declineReasonLabels[tally.reason], count: tally.count }))}
            tone={styles.hbarFillWarn}
            unit={["decline", "declines"]}
          />
        </Panel>
      </div>

      <Panel
        title="What is holding discharges up"
        question="People in a bed whose discharge has a recorded blocker, by reason."
        meta={`${blockers.totalCount} people`}
      >
        <RankedBars
          rows={blockers.tallies.map((tally) => ({ label: tally.reason, count: tally.count }))}
          tone={styles.hbarFillWarn}
          unit={["person", "people"]}
        />
      </Panel>
    </main>
  );
}
