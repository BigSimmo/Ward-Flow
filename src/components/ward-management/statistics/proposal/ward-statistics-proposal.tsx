"use client";

import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";

import {
  BedGrid,
  BedGridLegend,
  Definitions,
  KpiStrip,
  Panel,
  ProposalHeader,
  ReleaseTimeline,
  Verdict,
  type Attention,
  proposalHref,
} from "./statistics-proposal-parts";
import { SERVICE_COLOUR, percent, releasesToday, stayBandCounts } from "./statistics-proposal-figures";
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
  const freeToday = releasesToday(ward.releases);
  const datePassed = current.filter(
    (admission) => admission.expectedDischargeAt !== null && admission.expectedDischargeAt < now,
  ).length;
  const readyLocked = Math.min(ward.unit.allocatableLocked, ward.ready);
  const heldUp = blocked.reduce((sum, row) => sum + row.count, 0);
  const attention: Attention[] = [];
  if (ward.ready === 0) attention.push({ tone: "danger", label: "No ready bed" });
  if (referrals.askedAndWaiting)
    attention.push({ tone: "warn", label: `${referrals.askedAndWaiting} asking for a bed here` });
  if (datePassed) attention.push({ tone: "warn", label: `${datePassed} past their discharge date` });
  if (heldUp) attention.push({ tone: "warn", label: `${heldUp} discharges held up` });
  if (freeToday) attention.push({ tone: "good", label: `${freeToday} beds expected free today` });

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

      <Verdict attention={attention}>
        <strong>
          {ward.unit.name} is {percent(ward.occupancy)} occupied with {ward.ready} ready{" "}
          {ward.ready === 1 ? "bed" : "beds"}
        </strong>
        {ward.ready ? ` (${readyLocked} locked, ${ward.ready - readyLocked} open)` : ""}. {freeToday} more{" "}
        {freeToday === 1 ? "is" : "are"} expected to come free today
        {networkStay !== null && ward.averageStayDays !== null
          ? `, and stays here average ${ward.averageStayDays.toFixed(0)} days against ${networkStay.toFixed(0)} across the network.`
          : "."}
      </Verdict>

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
            meter: { value: ward.occupancy },
          },
          {
            label: "Ready",
            value: ward.ready,
            tone: ward.ready === 0 ? "danger" : "good",
            note: ward.ready ? `${readyLocked} locked · ${ward.ready - readyLocked} open` : "none to offer",
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

      <div className={styles.grid2}>
        <Panel title="Beds now" question="One square per bed." meta={`${ward.beds} beds`} foot={<BedGridLegend />}>
          <div className={styles.bedGridLarge}>
            <BedGrid figures={ward} />
          </div>
        </Panel>
        <Panel
          title="Beds coming free"
          question="Discharges this ward has recorded. Solid is confirmed, pale is expected."
          meta={`${freeToday} today`}
        >
          <ReleaseTimeline releases={ward.releases} />
        </Panel>
      </div>

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
              <dt>Past their date</dt>
              <dd className={datePassed ? styles.toneDanger : ""}>{datePassed}</dd>
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
