"use client";

import Link from "next/link";
import { ArrowLeftRight, Clock, Send } from "lucide-react";

import {
  BarList,
  CardBody,
  CardFoot,
  Donut,
  HeroStat,
  StackBar,
  SrOnly,
  StatusGlyph,
  cx,
  tableClasses,
} from "@/components/wf";
import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, siteByCode, wardSites } from "@/components/ward-management/ward-sites";

import { LONG_WAIT_HOURS, edWaitFigures } from "./statistics-ed-waits";
import { HeroTool } from "./statistics-hero-tools";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { FlushRow } from "./statistics-layout";
import { STATISTICS_COMPARE_HREF, statisticsSectionById } from "./statistics-sections";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";

/** Each health service's colour class (the `--wf-svc-*` tokens), for its dot. */
const SERVICE_CLASS: Record<HealthService, string> = {
  "North Metro": index.svcNorth,
  "South Metro": index.svcSouth,
  "East Metro": index.svcEast,
  WACHS: index.svcWachs,
  CAHS: index.svcCahs,
  Private: index.svcPrivate,
};

/** The coloured dot for a health service, read from the design tokens. Decorative: the name is beside it. */
export function ServiceDot({ service }: { service: HealthService | undefined }) {
  return <span className={cx(index.svcDot, service ? SERVICE_CLASS[service] : undefined)} aria-hidden="true" />;
}

/** "Sir Charles Gairdner Hospital" to "Sir Charles Gairdner", for the card's site line. */
const shortSite = (name: string) => name.replace(/\s+(Hospital|Health Campus|Health Service)$/u, "");

const wardsWord = (count: number) => (count === 1 ? "ward" : "wards");

/**
 * ALL HEALTH SERVICES — the Services index page (Statistics A, 9 Oct 2026).
 *
 * One card per health service, each the way into that service's own page. Every figure is read from
 * the live state the rest of the prototype shows: the ruled bed boxes from `bedStates`, the beds
 * being made ready from `bedsPendingPreparation`, and the people waiting in each emergency department
 * from `edWaitFigures`. A service with no inpatient wards says so rather than showing a nought
 * occupancy. Nothing here keeps history, so there is no trend.
 */
export function StatisticsServicesIndexScreen() {
  const section = statisticsSectionById("service");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'service' section");

  const live = useStatisticsLive();
  const { units, admissions, bedReleases, leaveBeds, movements, referrals } = live.state;
  const now = live.now;
  const departments = allEmergencyDepartments();

  const services = HEALTH_SERVICES.map((service) => {
    const siteCodes = new Set(wardSites.filter((site) => site.service === service).map((site) => site.code));
    const serviceUnits = units.filter((unit) => siteCodes.has(unit.siteCode));
    const rows = serviceUnits.map((unit) => {
      const states = bedStates(unit, admissions, bedReleases, leaveBeds);
      return { unit, states, rate: unit.beds > 0 ? Math.round((states.occupied / unit.beds) * 100) : 0 };
    });
    const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const waits = departments
      .filter((department) => siteCodes.has(department.siteCode))
      .map((department) => edWaitFigures(movements, department.id, now));
    const beds = sum((row) => row.unit.beds);
    const occupied = sum((row) => row.states.occupied);
    return {
      service,
      wards: serviceUnits.length,
      beds,
      occupied,
      share: beds > 0 ? occupied / beds : 0,
      ready: sum((row) => row.states.ready),
      pulled: sum((row) => row.states.pulled),
      closed: sum((row) => row.states.closed),
      pending: serviceUnits.reduce((total, unit) => total + bedsPendingPreparation(unit.id, bedReleases), 0),
      over: rows.filter((row) => row.rate >= BED_ALERT_THRESHOLD_PERCENT).length,
      waiting: waits.reduce((total, figures) => total + figures.onTheList, 0),
      over24: waits.reduce((total, figures) => total + figures.over24h, 0),
      departments: waits.length,
      sites: Array.from(
        new Set(serviceUnits.map((unit) => shortSite(siteByCode(unit.siteCode)?.name ?? unit.siteCode))),
      ),
    };
  });

  // Where each service's referrals were accepted at a ward, by the referral's origin site.
  const accepted = new Map<string, number>();
  const notYet = new Map<HealthService, number>();
  for (const referral of referrals) {
    const from = siteByCode(referral.originSiteCode)?.service;
    if (!from) continue;
    const ward = referral.destinations.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.acceptedUnitId !== undefined,
    );
    if (!ward || ward.acceptedUnitId === undefined) {
      if (referral.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward")) {
        notYet.set(from, (notYet.get(from) ?? 0) + 1);
      }
      continue;
    }
    const unit = units.find((candidate) => candidate.id === ward.acceptedUnitId);
    const to = unit ? siteByCode(unit.siteCode)?.service : undefined;
    if (!to) continue;
    accepted.set(`${from}|${to}`, (accepted.get(`${from}|${to}`) ?? 0) + 1);
  }

  const totalWaiting = services.reduce((total, entry) => total + entry.waiting, 0);
  const withBeds = services.filter((entry) => entry.beds > 0);

  return (
    <StatisticsPage
      section={section}
      navSection="service"
      testId="ward-statistics-services-index"
      eyebrowLabel={`Statistics · ${HEALTH_SERVICES.length} services`}
      title="Health services"
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      tools={
        <HeroTool
          href={STATISTICS_COMPARE_HREF}
          icon={<ArrowLeftRight size={14} aria-hidden="true" />}
          testId="ward-statistics-services-compare"
        >
          Compare
        </HeroTool>
      }
      stats={
        <>
          {withBeds.map((entry) => (
            <HeroStat
              key={entry.service}
              value={`${Math.round(entry.share * 100)}%`}
              label={entry.service}
              tone={entry.over > 0 ? "warning" : undefined}
            />
          ))}
        </>
      }
    >
      <FlushRow layout="thirds" id="services" className={index.anchorTarget} data-testid="ward-statistics-services">
        {services.map((entry) => (
          <StatCard
            key={entry.service}
            className={index.svcCard}
            id={`service-${entry.service.toLowerCase().replace(/\s+/gu, "-")}`}
            data-testid={`ward-statistics-services-card-${entry.service}`}
            title={
              <Link href={serviceStatisticsHref(entry.service)} className={index.svcTitle}>
                <ServiceDot service={entry.service} />
                {entry.service}
              </Link>
            }
            aside={
              <span className={styles.muted}>
                {entry.wards} {wardsWord(entry.wards)}
              </span>
            }
          >
            <CardBody className={index.svcBody}>
              {entry.beds === 0 ? (
                <p className={index.cardNote}>No inpatient beds are recorded for this service.</p>
              ) : (
                <>
                  <div className={index.svcTop}>
                    <Donut value={entry.share} label={`${entry.service} occupancy`} />
                    <span className={index.svcText}>
                      <span className={index.svcBeds}>
                        {entry.occupied} of {entry.beds} beds
                      </span>
                      <span className={index.svcLine}>
                        {entry.over > 0 ? (
                          <>
                            <StatusGlyph tone="warning" size={9} />
                            {`${entry.over} ${wardsWord(entry.over)} over ${BED_ALERT_THRESHOLD_PERCENT}%`}
                          </>
                        ) : (
                          <>
                            <StatusGlyph tone="success" size={9} />
                            {`No ward over ${BED_ALERT_THRESHOLD_PERCENT}%`}
                          </>
                        )}
                      </span>
                    </span>
                  </div>
                  <StackBar
                    thin
                    label={`${entry.service} beds`}
                    segments={[
                      { id: "ready", label: BED_STATE_LABELS.ready, value: entry.ready, fill: "data-1" },
                      { id: "pulled", label: BED_STATE_LABELS.pulled, value: entry.pulled, hatch: true },
                      { id: "closed", label: BED_STATE_LABELS.closed, value: entry.closed, fill: "data-2" },
                      { id: "occupied", label: BED_STATE_LABELS.occupied, value: entry.occupied, fill: "data-3" },
                    ]}
                  />
                </>
              )}
              <dl className={index.figures}>
                <div>
                  <dt>{BED_STATE_LABELS.ready}</dt>
                  <dd>{entry.ready}</dd>
                </div>
                <div>
                  <dt>{BED_STATE_LABELS.beingMadeReady}</dt>
                  <dd>{entry.pending}</dd>
                </div>
                <div>
                  <dt>{BED_STATE_LABELS.pulled}</dt>
                  <dd>{entry.pulled}</dd>
                </div>
                <div>
                  <dt>
                    {entry.over24 > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                    Waiting in ED
                  </dt>
                  <dd>
                    {entry.departments === 0 ? "No ED" : entry.waiting}
                    {entry.over24 > 0 ? <SrOnly>{`, ${entry.over24} past ${LONG_WAIT_HOURS} hours`}</SrOnly> : null}
                  </dd>
                </div>
              </dl>
              <p className={index.sites}>{entry.sites.length > 0 ? entry.sites.join(", ") : "No inpatient sites"}</p>
            </CardBody>
          </StatCard>
        ))}
      </FlushRow>

      <FlushRow layout="lead2">
        <StatCard
          icon={Send}
          id="referrals"
          className={index.anchorTarget}
          title="Where referrals were accepted"
          aside={<span className={cx(styles.muted, index.phoneHide)}>Every referral on record</span>}
          data-testid="ward-statistics-services-referrals"
        >
          <div className={styles.tableWrap}>
            <table className={cx(tableClasses.table, styles.table, index.matrix)}>
              <caption className={styles.srOnly}>
                Referrals for a bed, by the referring service (rows) and the service whose ward accepted (columns)
              </caption>
              <thead>
                <tr>
                  <th scope="col">From, to</th>
                  {HEALTH_SERVICES.map((service) => (
                    <th key={service} scope="col" className={styles.num} title={service}>
                      <span className={index.matrixHead}>
                        <ServiceDot service={service} />
                        <span aria-hidden="true">{service.replace(/ Metro$/u, "")}</span>
                        <span className={styles.srOnly}>{service}</span>
                      </span>
                    </th>
                  ))}
                  <th scope="col" className={styles.num}>
                    Not yet
                  </th>
                </tr>
              </thead>
              <tbody>
                {HEALTH_SERVICES.map((from) => (
                  <tr key={from}>
                    <th scope="row">
                      <span className={index.matrixHead}>
                        <ServiceDot service={from} />
                        {from}
                      </span>
                    </th>
                    {HEALTH_SERVICES.map((to) => {
                      const count = accepted.get(`${from}|${to}`) ?? 0;
                      return (
                        <td key={to} className={count === 0 ? styles.zero : undefined}>
                          {count === 0 ? (
                            0
                          ) : (
                            <span className={cx(index.bubble, from === to && index.own)}>{count}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={(notYet.get(from) ?? 0) === 0 ? styles.zero : undefined}>{notYet.get(from) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CardFoot meta="Shaded: accepted within its own service. Not yet: no ward has accepted so far." />
        </StatCard>

        <StatCard
          icon={Clock}
          id="ed-waits"
          className={index.anchorTarget}
          title="Waiting in ED, by service"
          aside={<span className={styles.muted}>{totalWaiting} waiting</span>}
          data-testid="ward-statistics-services-ed-waits"
        >
          <CardBody>
            <BarList
              label="People waiting in an emergency department, by health service"
              track
              labelWidth="8rem"
              rows={services.map((entry) => ({
                id: entry.service,
                label: entry.service,
                value: entry.waiting,
                display: entry.departments === 0 ? "No ED" : undefined,
                flag: entry.over24 > 0 ? "warning" : undefined,
              }))}
            />
          </CardBody>
          <CardFoot meta="An amber dot marks a service with someone waiting past the long-wait line." />
        </StatCard>
      </FlushRow>
    </StatisticsPage>
  );
}
