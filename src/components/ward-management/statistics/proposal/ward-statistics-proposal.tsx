"use client";

import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";

import {
  BedBar,
  BedLegend,
  Definitions,
  KpiStrip,
  Panel,
  ProposalHeader,
  proposalHref,
} from "./statistics-proposal-parts";
import { SERVICE_COLOUR, percent, stayBandCounts } from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

/**
 * Proposed single-ward statistics. Same bed figures as every other statistics screen; one page in
 * two columns that line up, with every panel open rather than hidden behind a disclosure.
 */
export function WardStatisticsProposal({ unitId }: { unitId?: string }) {
  const { wards, asAt, now, world } = useStatisticsProposal();
  const ward = wards.find((candidate) => candidate.unit.id === unitId) ?? wards[0];
  if (!ward) return <p className={styles.empty}>No wards in this network.</p>;

  const current = world.admissions.filter(
    (admission) => admission.unitId === ward.unit.id && admission.state === "occupied",
  );
  const withDate = current.filter((admission) => admission.expectedDischargeAt !== null).length;
  const blocked = BED_RELEASE_BLOCKERS.map((reason) => ({
    reason,
    count: current.filter((admission) => admission.blockReason === reason).length,
  })).filter((row) => row.count > 0);
  const bands = stayBandCounts(ward.unit.id, world.admissions, now);
  const bandMax = Math.max(1, ...bands.map((band) => band.count));
  const referrals = wardReferralTally(world.movements, ward.unit.id);
  const stays = wards.map((candidate) => candidate.averageStayDays).filter((days): days is number => days !== null);
  const networkStay = stays.length ? stays.reduce((sum, days) => sum + days, 0) / stays.length : null;

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-ward">
      <ProposalHeader
        crumbs={[
          { label: "Statistics", href: proposalHref("statewide") },
          { label: ward.service, href: proposalHref("service", ward.service) },
          { label: ward.hospital },
        ]}
        title={ward.unit.name}
        swatch={SERVICE_COLOUR[ward.service]}
        asAt={asAt}
      />

      <KpiStrip
        label="Ward headline figures"
        items={[
          {
            label: "Beds",
            value: ward.beds,
            note: `${ward.unit.lockedBeds} locked · ${ward.beds - ward.unit.lockedBeds} open`,
          },
          {
            label: "Occupancy",
            value: percent(ward.occupancy, 0),
            note: `${ward.occupied} occupied · ${ward.onLeave} on leave`,
            keyClass: styles.segOccupied,
          },
          {
            label: "Ready",
            value: ward.ready,
            tone: ward.ready === 0 ? "danger" : "good",
            note: ward.beingMadeReady ? `${ward.beingMadeReady} being made ready` : "none being made ready",
            keyClass: styles.segReady,
          },
          { label: "Pulled", value: ward.pulled, note: "bed given, not yet arrived", keyClass: styles.segPulled },
          { label: "Closed", value: ward.closed, note: "empty, not offered", keyClass: styles.segClosed },
          {
            label: "Average stay",
            value:
              ward.averageStayDays === null ? (
                "–"
              ) : (
                <>
                  {ward.averageStayDays.toFixed(0)}
                  <small>days</small>
                </>
              ),
            note: networkStay === null ? undefined : `Network average ${networkStay.toFixed(0)} days`,
          },
        ]}
      />

      <Panel title="Beds now" question="The ward's beds, adding up to the total." meta={`${ward.beds} beds`}>
        <BedBar figures={ward} large />
        <BedLegend figures={ward} />
      </Panel>

      <div className={styles.grid2Even}>
        <Panel
          title="How long people have been here"
          question={`${current.length} people in a bed, grouped by length of stay so far.`}
        >
          <div className={styles.columns}>
            {bands.map((band) => (
              <div className={styles.column} key={band.label}>
                <span className={styles.columnValue}>{band.count}</span>
                <span className={styles.columnBar} style={{ height: `${(band.count / bandMax) * 8}rem` }} />
              </div>
            ))}
          </div>
          <div className={styles.columnLabels}>
            {bands.map((band) => (
              <span key={band.label}>{band.label}</span>
            ))}
          </div>
          <p className={styles.note}>Bands are display groupings, not clinical targets.</p>
        </Panel>

        <Panel title="Discharge planning" question="Who has a plan, and what is holding people up?">
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>With a discharge date</dt>
              <dd className={styles.toneGood}>{withDate}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Without one</dt>
              <dd className={current.length - withDate > 0 ? styles.toneWarn : ""}>{current.length - withDate}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Discharge held up</dt>
              <dd>{blocked.reduce((sum, row) => sum + row.count, 0)}</dd>
            </div>
          </dl>
          {blocked.length ? (
            <ul className={styles.hbars} style={{ marginTop: "0.875rem" }}>
              {blocked.map((row) => (
                <li className={styles.hbar} key={row.reason}>
                  <span className={styles.hbarLabel}>{row.reason}</span>
                  <span className={styles.hbarTrack}>
                    <span
                      className={`${styles.hbarFill} ${styles.hbarFillWarn}`}
                      style={{ width: `${(row.count / Math.max(...blocked.map((b) => b.count))) * 100}%` }}
                    />
                  </span>
                  <span className={styles.hbarValue}>
                    {row.count} {row.count === 1 ? "person" : "people"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>Nobody on this ward has a recorded discharge blocker.</p>
          )}
        </Panel>
      </div>

      <Panel title="Referrals to this ward" question="Requests from emergency departments that name this ward.">
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>Asking this ward now</dt>
            <dd className={referrals.askedAndWaiting ? styles.toneWarn : ""}>{referrals.askedAndWaiting}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Accepted by this ward</dt>
            <dd>{referrals.everAccepted}</dd>
          </div>
          <div className={styles.fact}>
            <dt>Declined by this ward</dt>
            <dd>{referrals.everDeclined}</dd>
          </div>
        </dl>
        <p className={styles.note}>A ward can decline a request and later accept it, so these can overlap.</p>
      </Panel>

      <Definitions />
    </main>
  );
}
