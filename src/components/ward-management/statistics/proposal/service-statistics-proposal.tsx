"use client";

import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import {
  INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE,
  OUT_OF_AREA_BANDS,
  SYNTHETIC_TRAVEL_TIMES_NOTICE,
  TRAVEL_BAND_LABELS,
} from "@/components/ward-management/ward-distance";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { siteByCode, unitById } from "@/components/ward-management/ward-sites";
import { isOpen } from "@/components/ward-management/ward-derivations";

import {
  BedBar,
  BedLegend,
  KpiStrip,
  OccupancyPill,
  Panel,
  TableScroll,
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
  referralPlacement,
  releasesToday,
  totalReleases,
} from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

const DAY = 24 * 60;

/** Proposed health-service statistics: the statewide page, filtered to one service. */
export function ServiceStatisticsProposal({ serviceId }: { serviceId?: string }) {
  const { services, eds, asAt, world, now } = useStatisticsProposal();
  const name = (HEALTH_SERVICES as readonly string[]).includes(serviceId ?? "")
    ? (serviceId as HealthService)
    : "North Metro";
  const service = services.find((candidate) => candidate.service === name) ?? services[0];
  const ownEds = eds.filter((ed) => ed.service === service.service).sort((a, b) => b.longestMinutes - a.longestMinutes);
  const maxWardBeds = Math.max(1, ...service.wards.map((ward) => ward.beds));

  // Where the people waiting in this service's EDs have been accepted (used by the verdict).
  const edIds = new Set(ownEds.map((ed) => ed.id));
  const waitingHere = world.movements.filter((movement) => edIds.has(movement.originEdId) && isOpen(movement));
  const destination = { own: 0, none: 0 };
  for (const movement of waitingHere) {
    const accepted = movement.acceptedUnitId ? unitById(movement.acceptedUnitId) : undefined;
    if (!accepted) destination.none += 1;
    else if (siteByCode(accepted.siteCode)?.service === service.service) destination.own += 1;
  }

  // Where this service's own referrals were accepted (the current page's placement chart).
  const placement = referralPlacement(world.referrals, world.units, service.service);
  const placedElsewhere = placement.elsewhere.reduce((sum, row) => sum + row.count, 0);
  const placementRows = [
    { id: "within", label: `Within ${service.service}`, count: placement.within, tone: "good" as const },
    { id: "elsewhere", label: "Another service", count: placedElsewhere, tone: undefined },
    { id: "none", label: "No ward has accepted", count: placement.noWard, tone: "warn" as const },
    ...(placement.unresolved
      ? [{ id: "unresolved", label: "Ward not recognised", count: placement.unresolved, tone: undefined }]
      : []),
  ];
  const placementMax = Math.max(1, ...placementRows.map((row) => row.count));

  const farFromHome = outOfAreaLedger(
    world.admissions,
    service.wards.map((ward) => ward.unit),
    now,
  );
  const farBands = OUT_OF_AREA_BANDS.map((band) => ({
    band,
    count: farFromHome.entries.filter((entry) => entry.band === band).length,
  }));
  const farMax = Math.max(1, ...farBands.map((row) => row.count));

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
          ...(freeToday
            ? [
                {
                  tone: "good" as const,
                  label: `${freeToday} ${freeToday === 1 ? "bed" : "beds"} expected free today`,
                },
              ]
            : []),
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
            <TableScroll label="Wards">
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
            </TableScroll>
          </>
        )}
      </Panel>

      <div className={styles.grid2Even}>
        <Panel title="Emergency departments" question="Waiting for a mental health bed now." flush>
          <TableScroll label="Emergency departments">
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
          </TableScroll>
        </Panel>

        <Panel
          title="Where this service's referrals were placed"
          question={`${placement.total} referrals raised from ${service.service} hospitals, by the ward that accepted them.`}
          meta="Accepted is not arrived"
        >
          <ul className={styles.hbars}>
            {placementRows.map((row) => (
              <li className={styles.hbar} key={row.id}>
                <span className={styles.hbarLabel}>{row.label}</span>
                <span className={styles.hbarTrack}>
                  <span
                    className={`${styles.hbarFill} ${row.tone === "good" ? styles.hbarFillGood : row.tone === "warn" ? styles.hbarFillWarn : ""}`}
                    style={{ width: `${(row.count / placementMax) * 100}%` }}
                  />
                </span>
                <span className={styles.hbarValue}>{row.count}</span>
              </li>
            ))}
          </ul>
          {placement.elsewhere.length ? (
            <>
              <h3 className={styles.subHeading}>Accepted by another service</h3>
              <ul className={styles.hbars}>
                {placement.elsewhere.map((row) => (
                  <li className={styles.hbar} key={row.service}>
                    <span className={styles.hbarLabel}>
                      <a href={proposalHref("service", row.service)}>{row.service}</a>
                    </span>
                    <span className={styles.hbarTrack}>
                      <span
                        className={styles.hbarFill}
                        style={{
                          width: `${(row.count / Math.max(1, placedElsewhere)) * 100}%`,
                          background: SERVICE_COLOUR[row.service],
                        }}
                      />
                    </span>
                    <span className={styles.hbarValue}>{row.count}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.note}>No referral from this service has been accepted by another service.</p>
          )}
        </Panel>
      </div>

      {service.beds ? (
        <Panel
          title="Far from home"
          question={`People in a ${service.service} bed a long way from where they live.`}
          meta={`${farFromHome.entries.length} people`}
        >
          <ul className={styles.hbars}>
            {farBands.map((row) => (
              <li className={styles.hbar} key={row.band}>
                <span className={styles.hbarLabel}>{TRAVEL_BAND_LABELS[row.band]}</span>
                <span className={styles.hbarTrack}>
                  <span className={styles.hbarFill} style={{ width: `${(row.count / farMax) * 100}%` }} />
                </span>
                <span className={styles.hbarValue}>
                  {row.count} {row.count === 1 ? "person" : "people"}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            {farFromHome.notBanded} {farFromHome.notBanded === 1 ? "person has" : "people have"} no travel time
            recorded. {INVENTED_OUT_OF_AREA_THRESHOLD_NOTICE} {SYNTHETIC_TRAVEL_TIMES_NOTICE}
          </p>
        </Panel>
      ) : null}

      {service.beds ? (
        <Panel
          title="Beds coming free"
          question={`Discharges recorded on ${service.service} wards. Solid is confirmed, pale is expected.`}
          meta={`${freeToday} today`}
        >
          <ReleaseTimeline releases={releases} />
        </Panel>
      ) : null}

      <p className={styles.note}>
        <a className={styles.link} href={`${proposalHref("statewide")}#definitions`}>
          How these figures are counted ›
        </a>
      </p>
    </main>
  );
}
