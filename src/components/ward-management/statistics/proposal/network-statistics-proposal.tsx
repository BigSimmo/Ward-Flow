"use client";

import {
  BedGrid,
  BedGridLegend,
  KpiStrip,
  Panel,
  ProposalHeader,
  ReleaseTimeline,
  Verdict,
  proposalHref,
} from "./statistics-proposal-parts";
import { SERVICE_COLOUR, percent, releasesToday, totalReleases } from "./statistics-proposal-figures";
import { useStatisticsProposal } from "./use-statistics-proposal";
import styles from "./statistics-proposal.module.css";

/**
 * Proposed Network overview: the whole bed network as a map of squares, one per bed, grouped by
 * health service and ward, plus when beds are expected to come free. Replaces the current page's
 * gauges (which left out Private) and its 22-row capacity table.
 */
export function NetworkStatisticsProposal() {
  const { wards, services, network, asAt } = useStatisticsProposal();
  const releases = totalReleases(wards);
  const freeToday = releasesToday(releases);
  const noReady = wards.filter((ward) => ward.ready === 0);
  const withBeds = services.filter((service) => service.beds > 0);

  return (
    <main id="main-content" className={styles.page} data-testid="statistics-proposal-network">
      <ProposalHeader
        crumbs={[{ label: "Statistics", href: proposalHref("statewide") }, { label: "Network overview" }]}
        title="Bed network"
        asAt={asAt}
      />

      <Verdict
        attention={[
          ...noReady.map((ward) => ({
            tone: "danger" as const,
            label: `${ward.unit.name}: no ready bed`,
            href: proposalHref("ward", ward.unit.id),
          })),
          { tone: "good", label: `${freeToday} beds expected to come free today` },
        ]}
      >
        <strong>{network.ready} beds are ready</strong> across {wards.length} wards, and {freeToday} more are expected
        to come free before midnight. {noReady.length} wards have no ready bed.
      </Verdict>

      <KpiStrip
        label="Network bed figures"
        items={[
          { label: "Beds", value: network.beds },
          {
            label: "Occupied",
            value: network.occupied,
            note: percent(network.occupied / network.beds, 1),
            keyClass: styles.segOccupied,
          },
          { label: "Pulled", value: network.pulled, keyClass: styles.segPulled },
          { label: "Closed", value: network.closed, keyClass: styles.segClosed },
          { label: "Ready", value: network.ready, tone: "good", keyClass: styles.segReady },
          { label: "Free by midnight", value: freeToday, tone: "good", note: "confirmed and expected" },
        ]}
      />

      <Panel
        title="Every bed in the network"
        question="One square per bed. Grouped by health service, then ward; tightest wards first."
        meta={`${network.beds} beds`}
        foot={<BedGridLegend />}
      >
        <div className={styles.serviceColumns}>
          {withBeds.map((service) => (
            <section className={styles.serviceColumn} key={service.service} aria-label={service.service}>
              <div className={styles.serviceHead} style={{ borderBottomColor: SERVICE_COLOUR[service.service] }}>
                <h3>
                  <a
                    className={styles.link}
                    href={proposalHref("service", service.service)}
                    style={{ color: "inherit" }}
                  >
                    {service.service}
                  </a>
                </h3>
                <span className={styles.rowSub}>
                  {percent(service.occupancy)} · <strong className={styles.toneGood}>{service.ready} ready</strong>
                </span>
              </div>
              {service.wards
                .slice()
                .sort((a, b) => a.ready - b.ready || b.occupancy - a.occupancy)
                .map((ward) => (
                  <a
                    key={ward.unit.id}
                    href={proposalHref("ward", ward.unit.id)}
                    className={`${styles.wardTile} ${ward.ready === 0 ? styles.wardTileHot : ""}`}
                  >
                    <span className={styles.wardTileHead}>
                      <span className={styles.wardTileName}>{ward.unit.name}</span>
                      <span className={`${styles.pill} ${ward.ready === 0 ? styles.pillDanger : styles.pillGood}`}>
                        {ward.ready} ready
                      </span>
                    </span>
                    <BedGrid figures={ward} size="sm" />
                    <span className={styles.wardTileFacts}>
                      <span>{ward.hospital}</span>
                      <span>
                        <strong>{percent(ward.occupancy)}</strong> occupied
                      </span>
                      {releasesToday(ward.releases) ? (
                        <span>
                          <strong>{releasesToday(ward.releases)}</strong> free today
                        </span>
                      ) : null}
                    </span>
                  </a>
                ))}
            </section>
          ))}
        </div>
      </Panel>

      <Panel
        title="Beds coming free"
        question="Discharges recorded by wards, by when the bed should be free. Solid is confirmed, pale is expected."
        meta={`${freeToday} today`}
      >
        <ReleaseTimeline releases={releases} />
      </Panel>
    </main>
  );
}
