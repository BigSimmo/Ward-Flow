"use client";

import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { siteByCode, unitById } from "@/components/ward-management/ward-sites";

import {
  BedBar,
  BedLegend,
  Definitions,
  KpiStrip,
  OccupancyPill,
  Panel,
  ProposalHeader,
  ReleaseTimeline,
  Verdict,
  ReadyPill,
  proposalHref,
} from "./statistics-proposal-parts";
import {
  SERVICE_COLOUR,
  edShort,
  hoursLabel,
  percent,
  releasesToday,
  totalReleases,
} from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

const DAY = 24 * 60;

/** Proposed health-service statistics: the statewide page, filtered to one service. */
export function ServiceStatisticsProposal({ serviceId }: { serviceId?: string }) {
  const { services, eds, asAt, world } = useStatisticsProposal();
  const name = (HEALTH_SERVICES as readonly string[]).includes(serviceId ?? "")
    ? (serviceId as HealthService)
    : "North Metro";
  const service = services.find((candidate) => candidate.service === name) ?? services[0];
  const ownEds = eds.filter((ed) => ed.service === service.service).sort((a, b) => b.longestMinutes - a.longestMinutes);
  const maxWardBeds = Math.max(1, ...service.wards.map((ward) => ward.beds));

  // Where the people waiting in this service's EDs have been accepted.
  const edIds = new Set(ownEds.map((ed) => ed.id));
  const waitingHere = world.movements.filter((movement) => edIds.has(movement.originEdId) && isOpen(movement));
  const destination = { own: 0, other: 0, none: 0 };
  for (const movement of waitingHere) {
    const accepted = movement.acceptedUnitId ? unitById(movement.acceptedUnitId) : undefined;
    if (!accepted) destination.none += 1;
    else if (siteByCode(accepted.siteCode)?.service === service.service) destination.own += 1;
    else destination.other += 1;
  }

  const releases = totalReleases(service.wards);
  const freeToday = releasesToday(releases);

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-service">
      <ProposalHeader
        crumbs={[{ label: "Statistics", href: proposalHref("statewide") }, { label: "Health services" }]}
        title={service.service}
        swatch={SERVICE_COLOUR[service.service]}
        asAt={asAt}
      />

      <Verdict
        attention={[
          ...service.wards
            .filter((ward) => ward.ready === 0)
            .map((ward) => ({
              tone: "danger" as const,
              label: `${ward.unit.name}: no ready bed`,
              href: proposalHref("ward", ward.unit.id),
            })),
          ...(destination.none
            ? [{ tone: "warn" as const, label: `${destination.none} waiting here with no ward yet` }]
            : []),
          ...ownEds
            .filter((ed) => ed.over24h)
            .map((ed) => ({
              tone: "danger" as const,
              label: `${edShort(ed.name)}: ${ed.over24h} over 24 hours`,
              href: proposalHref("ed", ed.id),
            })),
          { tone: "good" as const, label: `${freeToday} beds expected free today` },
        ]}
      >
        {service.beds ? (
          <>
            <strong>
              {service.service} is {percent(service.occupancy, 1)} occupied with {service.ready} ready beds
            </strong>{" "}
            for {service.edWaiting} people waiting in its emergency departments. {destination.own} of them have been
            accepted by a {service.service} ward.
          </>
        ) : (
          <>
            <strong>{service.service} has no inpatient mental health wards.</strong> {service.edWaiting} people are
            waiting in its emergency departments for a bed elsewhere.
          </>
        )}
      </Verdict>

      <KpiStrip
        label="Health service headline figures"
        items={[
          { label: "Beds", value: service.beds, note: `${service.wards.length} wards` },
          {
            label: "Occupancy",
            value: service.beds ? percent(service.occupancy, 1) : "–",
            note: `${service.occupied} occupied · ${service.onLeave} on leave`,
            keyClass: styles.segOccupied,
            meter: { value: service.occupancy },
          },
          { label: "Ready", value: service.ready, tone: "good", keyClass: styles.segReady },
          { label: "Pulled", value: service.pulled, keyClass: styles.segPulled },
          { label: "Closed", value: service.closed, keyClass: styles.segClosed },
          {
            label: "Waiting in ED",
            value: service.edWaiting,
            tone: service.edWaiting ? "warn" : undefined,
            note: `${ownEds.length} departments`,
          },
          {
            label: "Longest ED wait",
            value: hoursLabel(service.edLongestMinutes),
            tone: service.edLongestMinutes >= DAY ? "danger" : undefined,
          },
        ]}
      />

      <Panel
        title="Wards"
        question="Each ward's beds, on one scale so sizes compare."
        meta={`${service.beds} beds`}
        flush
      >
        {service.wards.length === 0 ? (
          <div className={styles.panelBody}>
            <p className={styles.empty}>This service has no inpatient mental health wards in the network.</p>
          </div>
        ) : (
          <>
            <div className={styles.panelBody}>
              <BedBar figures={service} large />
              <BedLegend figures={service} />
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Ward</th>
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
                    Free today
                  </th>
                  <th scope="col" className={styles.num}>
                    Average stay
                  </th>
                </tr>
              </thead>
              <tbody>
                {service.wards
                  .slice()
                  .sort((a, b) => a.ready - b.ready || b.occupancy - a.occupancy)
                  .map((ward) => (
                    <tr key={ward.unit.id}>
                      <td>
                        <span className={styles.rowName}>
                          <a href={proposalHref("ward", ward.unit.id)}>{ward.unit.name}</a>
                          <span className={styles.rowSub}>{ward.hospital}</span>
                        </span>
                      </td>
                      <td className={styles.barCell}>
                        <BedBar figures={ward} scaleTo={maxWardBeds} />
                      </td>
                      <td className={styles.num}>{ward.beds}</td>
                      <td className={styles.num}>
                        <OccupancyPill value={ward.occupancy} />
                      </td>
                      <td className={styles.num}>
                        <ReadyPill value={ward.ready} />
                      </td>
                      <td className={styles.num}>{releasesToday(ward.releases)}</td>
                      <td className={styles.num}>
                        {ward.averageStayDays === null ? "–" : `${ward.averageStayDays.toFixed(0)} days`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>

      <div className={styles.grid2Even}>
        <Panel title="Emergency departments" question="Waiting for a mental health bed now." flush>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col" className={styles.num}>
                  Waiting
                </th>
                <th scope="col" className={styles.num}>
                  No ward yet
                </th>
                <th scope="col" className={styles.num}>
                  Over 24h
                </th>
                <th scope="col" className={styles.num}>
                  Longest
                </th>
              </tr>
            </thead>
            <tbody>
              {ownEds.map((ed) => (
                <tr key={ed.id}>
                  <td>
                    <span className={styles.rowName}>
                      <a href={proposalHref("ed", ed.id)}>{edShort(ed.name)}</a>
                    </span>
                  </td>
                  <td className={styles.num}>{ed.waiting}</td>
                  <td className={styles.num}>{ed.unplaced}</td>
                  <td className={`${styles.num} ${ed.over24h ? styles.toneDanger : ""}`}>{ed.over24h}</td>
                  <td className={styles.num}>{ed.waiting ? hoursLabel(ed.longestMinutes) : "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Where people waiting here are going"
          question={`${waitingHere.length} people waiting in this service's emergency departments.`}
        >
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>Accepted within {service.service}</dt>
              <dd className={styles.toneGood}>{destination.own}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Accepted by another service</dt>
              <dd>{destination.other}</dd>
            </div>
            <div className={styles.fact}>
              <dt>No ward has accepted yet</dt>
              <dd className={destination.none ? styles.toneWarn : ""}>{destination.none}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {service.beds ? (
        <Panel
          title="Beds coming free"
          question={`Discharges recorded on ${service.service} wards. Solid is confirmed, pale is expected.`}
          meta={`${freeToday} today`}
        >
          <ReleaseTimeline releases={releases} />
        </Panel>
      ) : null}

      <Definitions />
    </main>
  );
}
