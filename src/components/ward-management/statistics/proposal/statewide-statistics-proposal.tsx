"use client";

import { useMemo } from "react";

import {
  BedBar,
  BedLegend,
  Definitions,
  KpiStrip,
  OccupancyPill,
  Panel,
  ProposalHeader,
  ReadyPill,
  proposalHref,
} from "./statistics-proposal-parts";
import { SERVICE_COLOUR, edShort, hoursLabel, percent, todayReferralFigures } from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

const DAY = 24 * 60;

/**
 * Proposed statistics home. Replaces both the current Summary and Network overview pages: one
 * headline strip, one bed bar that adds up, then the three places a coordinator looks for pressure.
 */
export function StatewideStatisticsProposal() {
  const { wards, eds, services, network, waiting, asAt, now, world } = useStatisticsProposal();
  const referrals = todayReferralFigures(world.referrals, now);
  const hospitals = new Set(wards.map((ward) => ward.hospital)).size;
  const urgent = eds.reduce((sum, ed) => sum + ed.urgent, 0);
  const over24 = eds.reduce((sum, ed) => sum + ed.over24h, 0);
  const longest = eds.reduce((max, ed) => (ed.longestMinutes > max.longestMinutes ? ed : max), eds[0]);
  const maxServiceBeds = Math.max(...services.map((service) => service.beds));

  const pressure = useMemo(
    () =>
      wards
        .slice()
        .sort((a, b) => a.ready - b.ready || b.occupancy - a.occupancy || a.unit.name.localeCompare(b.unit.name))
        .slice(0, 8),
    [wards],
  );
  const edsByWait = useMemo(() => eds.slice().sort((a, b) => b.longestMinutes - a.longestMinutes), [eds]);
  const maxEdWait = Math.max(DAY * 2, ...eds.map((ed) => ed.longestMinutes));

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-statewide">
      <ProposalHeader crumbs={[{ label: "Statistics" }]} title="Across Western Australia" asAt={asAt} />

      <KpiStrip
        label="Network headline figures"
        items={[
          { label: "Beds", value: network.beds, note: `${wards.length} wards · ${hospitals} hospitals` },
          {
            label: "Occupancy",
            value: percent(network.beds ? network.occupied / network.beds : 0, 1),
            note: `${network.occupied} occupied · ${network.onLeave} on leave`,
            keyClass: styles.segOccupied,
          },
          {
            label: "Ready",
            value: network.ready,
            tone: "good",
            note: `${network.beingMadeReady} still being made ready`,
            keyClass: styles.segReady,
          },
          { label: "Pulled", value: network.pulled, note: "bed given, not yet arrived", keyClass: styles.segPulled },
          { label: "Closed", value: network.closed, note: "empty, not offered", keyClass: styles.segClosed },
          {
            label: "Waiting for a bed",
            value: waiting,
            tone: "warn",
            note: `${urgent} urgent · ${over24} over 24 hours`,
          },
          {
            label: "Longest ED wait",
            value: hoursLabel(longest?.longestMinutes ?? 0),
            tone: (longest?.longestMinutes ?? 0) >= DAY ? "danger" : undefined,
            note: longest ? edShort(longest.name) : undefined,
          },
        ]}
      />

      <Panel
        title="Beds by health service"
        question="Where is the space, and where is it tight?"
        meta={`${network.beds} beds`}
        flush
        foot={
          <>
            <span>Every row adds up: occupied + pulled + closed + ready = beds.</span>
            <a href={proposalHref("compare")}>Compare all wards ›</a>
          </>
        }
      >
        <div className={styles.panelBody}>
          <BedBar figures={network} large />
          <BedLegend figures={network} />
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Health service</th>
              <th scope="col">Beds now</th>
              <th scope="col" className={styles.num}>
                Beds
              </th>
              <th scope="col" className={styles.num}>
                Occupancy
              </th>
              <th scope="col" className={styles.num}>
                Ready
              </th>
              <th scope="col" className={styles.num}>
                Waiting in ED
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.service}>
                <td>
                  <span className={styles.rowName}>
                    <a href={proposalHref("service", service.service)}>
                      <span
                        className={styles.swatch}
                        style={{ background: SERVICE_COLOUR[service.service], display: "inline-block", marginRight: 8 }}
                        aria-hidden="true"
                      />
                      {service.service}
                    </a>
                    <span className={styles.rowSub}>
                      {service.wards.length === 0
                        ? "No inpatient mental health wards"
                        : `${service.wards.length} ward${service.wards.length === 1 ? "" : "s"}`}
                    </span>
                  </span>
                </td>
                <td className={styles.barCell}>
                  {service.beds > 0 ? <BedBar figures={service} scaleTo={maxServiceBeds} /> : null}
                </td>
                <td className={styles.num}>{service.beds || "–"}</td>
                <td className={styles.num}>{service.beds > 0 ? <OccupancyPill value={service.occupancy} /> : "–"}</td>
                <td className={styles.num}>{service.beds > 0 ? <ReadyPill value={service.ready} /> : "–"}</td>
                <td className={styles.num}>{service.edWaiting}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>All services</td>
              <td />
              <td className={styles.num}>{network.beds}</td>
              <td className={styles.num}>{percent(network.beds ? network.occupied / network.beds : 0, 1)}</td>
              <td className={styles.num}>{network.ready}</td>
              <td className={styles.num}>{waiting}</td>
            </tr>
          </tfoot>
        </table>
      </Panel>

      <div className={styles.grid2Even}>
        <Panel
          title="Wards under most pressure"
          question="Fewest ready beds first, then highest occupancy."
          meta={`${wards.filter((ward) => ward.ready === 0).length} wards with no ready bed`}
          flush
          foot={<a href={proposalHref("compare")}>All {wards.length} wards ›</a>}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col" className={styles.num}>
                  Beds
                </th>
                <th scope="col" className={styles.num}>
                  Occupancy
                </th>
                <th scope="col" className={styles.num}>
                  Ready
                </th>
                <th scope="col" className={styles.num}>
                  Asked for a bed
                </th>
              </tr>
            </thead>
            <tbody>
              {pressure.map((ward) => (
                <tr key={ward.unit.id}>
                  <td>
                    <span className={styles.rowName}>
                      <a href={proposalHref("ward", ward.unit.id)}>{ward.unit.name}</a>
                      <span className={styles.rowSub}>{ward.hospital}</span>
                    </span>
                  </td>
                  <td className={styles.num}>{ward.beds}</td>
                  <td className={styles.num}>
                    <OccupancyPill value={ward.occupancy} />
                  </td>
                  <td className={styles.num}>
                    <ReadyPill value={ward.ready} />
                  </td>
                  <td className={styles.num}>{ward.askedAndWaiting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Emergency department waits"
          question="Who has waited longest for a mental health bed?"
          meta={`${waiting} waiting · ${eds.length} departments`}
          foot={<span>Dashed lines mark 24 and 48 hours. Bars show each department&apos;s longest current wait.</span>}
        >
          <div className={styles.scaleRow} aria-hidden="true" style={{ marginBottom: "1rem" }}>
            <span />
            <span style={{ position: "relative", height: "1rem" }}>
              <span className={styles.hbarMarkerLabel} style={{ left: `${(DAY / maxEdWait) * 100}%`, top: 0 }}>
                24h
              </span>
              <span className={styles.hbarMarkerLabel} style={{ left: `${((DAY * 2) / maxEdWait) * 100}%`, top: 0 }}>
                48h
              </span>
            </span>
            <span />
          </div>
          <ul className={styles.hbars}>
            {edsByWait.map((ed) => {
              const tone =
                ed.longestMinutes >= DAY * 2
                  ? styles.hbarFillDanger
                  : ed.longestMinutes >= DAY
                    ? styles.hbarFillWarn
                    : "";
              return (
                <li className={styles.hbar} key={ed.id}>
                  <span className={styles.rowName}>
                    <a href={proposalHref("ed", ed.id)} title={ed.name}>
                      {edShort(ed.name)}
                    </a>
                    <span className={styles.rowSub}>
                      {ed.waiting} waiting{ed.over24h ? ` · ${ed.over24h} over 24h` : ""}
                    </span>
                  </span>
                  <span className={styles.hbarTrack}>
                    <span
                      className={`${styles.hbarFill} ${tone}`}
                      style={{ width: `${(ed.longestMinutes / maxEdWait) * 100}%` }}
                    />
                    <span className={styles.hbarMarker} style={{ left: `${(DAY / maxEdWait) * 100}%` }} />
                    <span className={styles.hbarMarker} style={{ left: `${((DAY * 2) / maxEdWait) * 100}%` }} />
                  </span>
                  <span className={styles.hbarValue}>{ed.waiting ? hoursLabel(ed.longestMinutes) : "none"}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className={styles.grid2Even}>
        <Panel title="Referrals for a bed today" question="Raised today with a ward as the destination.">
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Raised</dt>
              <dd>{referrals.raised}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Accepted</dt>
              <dd className={styles.toneGood}>{referrals.accepted}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Declined by every ward</dt>
              <dd>{referrals.declined}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Still awaiting a ward</dt>
              <dd className={styles.toneWarn}>{referrals.open}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Community teams" question="People in a bed who are linked to a community team.">
          <p className={styles.empty}>
            Only admissions whose referral named a community team can be linked. Open a team to see its people in beds,
            expected discharges and follow-up.{" "}
            <a className={styles.link} href={proposalHref("community")}>
              Choose a community team ›
            </a>
          </p>
        </Panel>
      </div>

      <Definitions />
    </main>
  );
}
