"use client";

import Link from "next/link";
import { ArrowLeftRight, Clock, Send } from "lucide-react";

import {
  BarList,
  CardBody,
  CardFoot,
  Donut,
  HeroStat,
  PhoneListRow,
  StackBar,
  SrOnly,
  StatusGlyph,
  cx,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";
import { allEmergencyDepartments, siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";

import { LONG_WAIT_HOURS, edJourneyWaitFigures as edWaitFigures } from "./statistics-ed-waits";
import { HeroTool } from "./statistics-hero-tools";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { FlushRow } from "./statistics-layout";
import { STATISTICS_COMPARE_HREF, statisticsSectionById } from "./statistics-sections";
import { PhoneBody, PhoneDotKey, PhoneList, PhoneSheetRow, phoneBodyStyles as phone } from "./statistics-phone-parts";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  withheldBar,
  type StatisticsCount,
} from "./statistics-small-numbers";

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

type ServiceIndexRow = {
  service: HealthService;
  wards: number;
  beds: number;
  occupied: number;
  inUse: number;
  share: number;
  ready: number;
  pulled: number;
  closed: number;
  pending: number;
  over: number;
  waiting: StatisticsCount;
  over24: StatisticsCount;
  departments: number;
  sites: string[];
  openable?: boolean;
};
export function StatisticsServicesIndexScreen() {
  const control = useExecutiveStatisticsControl();
  const access = useEffectiveWardAccess();
  return control.executive || access.role === "executive" ? <ExecutiveServicesIndex /> : <OperationalServicesIndex />;
}
function ExecutiveServicesIndex() {
  const data = useExecutiveStatistics();
  const control = useExecutiveStatisticsControl();
  if (!data || data.services.length === 0) return <ExecutiveStatisticsUnavailable />;
  const services: ServiceIndexRow[] = data.services.map((service) => {
    const ownWards = data.wards.filter((ward) => ward.service === service.service);
    return {
      service: service.service,
      openable: data.openableServiceIds.includes(service.service),
      wards: service.wards,
      beds: service.beds.total,
      occupied: service.beds.occupied,
      inUse: service.beds.inUse,
      share: service.beds.total > 0 ? service.beds.inUse / service.beds.total : 0,
      ready: service.beds.ready,
      pulled: service.beds.pulled,
      closed: service.beds.closed,
      pending: ownWards.reduce((sum, ward) => sum + ward.pendingPreparation, 0),
      over: service.wardsOverOccupancyLine,
      waiting: service.waiting,
      over24: service.over24h,
      departments: service.departments,
      sites: [
        ...new Set(
          ownWards.map((ward) =>
            shortSite(data.catalogue.sites.find((site) => site.code === ward.siteCode)?.name ?? ward.siteCode),
          ),
        ),
      ],
    };
  });
  return (
    <ServicesIndexView
      services={services}
      accepted={new Map(data.referralMatrix.map((cell) => [cell.from + "|" + cell.to, cell.count]))}
      notYet={new Map(data.services.map((service) => [service.service, service.indexNotYetAcceptedAtWard]))}
      totalWaiting={data.edIndex.waiting}
      now={data.network.asAt.now}
      paused={control.paused}
      togglePause={control.togglePause}
      scopeLabel={data.network.scope.kind === "service" ? data.network.scope.service : undefined}
      executive
    />
  );
}
function OperationalServicesIndex() {
  const live = useStatisticsLive();
  const { units, admissions, bedReleases, leaveBeds, movements, referrals } = live.state;
  const now = live.now;
  const departments = allEmergencyDepartments();
  const services = HEALTH_SERVICES.map((service) => {
    const siteCodes = new Set(siteDirectory.filter((site) => site.service === service).map((site) => site.code));
    const serviceUnits = units.filter((unit) => siteCodes.has(unit.siteCode));
    const rows = serviceUnits.map((unit) => {
      const states = bedStates(unit, admissions, bedReleases, leaveBeds);
      // The one occupancy count (Occupied + Pulled, ward-occupancy.ts), as Overview and Wards read it.
      const inUse = wardBedsInUse(unit, admissions, bedReleases);
      return { unit, states, inUse, rate: unit.beds > 0 ? Math.round((inUse / unit.beds) * 100) : 0 };
    });
    const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const waits = departments
      .filter((department) => siteCodes.has(department.siteCode))
      .map((department) => edWaitFigures(movements, department.id, now));
    const beds = sum((row) => row.unit.beds);
    const occupied = sum((row) => row.states.occupied);
    const inUse = sum((row) => row.inUse);
    return {
      service,
      wards: serviceUnits.length,
      beds,
      occupied,
      inUse,
      share: beds > 0 ? inUse / beds : 0,
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

  return (
    <ServicesIndexView
      services={services}
      accepted={accepted}
      notYet={notYet}
      totalWaiting={services.reduce((sum, row) => sum + row.waiting, 0)}
      now={now}
      paused={live.paused}
      togglePause={live.togglePause}
    />
  );
}
function ServicesIndexView({
  services,
  accepted,
  notYet,
  totalWaiting,
  now,
  paused,
  togglePause,
  executive = false,
  scopeLabel,
}: {
  services: ServiceIndexRow[];
  accepted: ReadonlyMap<string, StatisticsCount>;
  notYet: ReadonlyMap<HealthService, StatisticsCount>;
  totalWaiting: StatisticsCount;
  now: number;
  paused: boolean;
  togglePause: (() => void) | null;
  executive?: boolean;
  scopeLabel?: string;
}) {
  const section = statisticsSectionById("service");
  if (!section) throw new Error("Statistics service section is missing.");
  const isPhone = useIsPhone();
  const shown = (count: StatisticsCount) => statisticsCountText(count);
  const positive = (count: StatisticsCount) => {
    const value = exactStatisticsCount(count);
    return value === null || value > 0;
  };
  const unknownCount: StatisticsCount = executive ? { kind: "withheld" } : 0;
  const withBeds = services.filter((entry) => entry.beds > 0);
  const servicesOver = services.filter((entry) => entry.over > 0).length;
  const totalBeds = services.reduce((total, entry) => total + entry.beds, 0);
  return (
    <StatisticsPage
      section={section}
      navSection="service"
      testId="ward-statistics-services-index"
      eyebrowLabel={`Statistics · ${HEALTH_SERVICES.length} services`}
      title="Health services"
      eyebrowDetail={scopeLabel}
      now={now}
      paused={paused}
      onTogglePause={togglePause ?? undefined}
      tools={
        <HeroTool
          href={STATISTICS_COMPARE_HREF}
          icon={<ArrowLeftRight size={14} aria-hidden="true" />}
          testId="ward-statistics-services-compare"
        >
          Compare
        </HeroTool>
      }
      phone={{
        title: `${servicesOver} with a ward over ${BED_ALERT_THRESHOLD_PERCENT}%`,
        sub: "Each ring shows the share of beds in use",
        stats: (
          <>
            <HeroStat value={services.length} label="Services" />
            <HeroStat value={totalBeds} label="Beds" />
            <HeroStat value={shown(totalWaiting)} label="Open ED journeys" />
          </>
        ),
      }}
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
      {isPhone ? (
        <PhoneBody testId="ward-statistics-services-phone">
          <PhoneList label="Health services">
            {services.map((entry) => (
              <PhoneListRow
                key={entry.service}
                as="li"
                leading={
                  entry.beds > 0 ? (
                    <Donut
                      className={phone.ring}
                      size={36}
                      thickness={4}
                      value={entry.share}
                      text={String(Math.round(entry.share * 100))}
                      label={`${entry.service} occupancy`}
                    />
                  ) : (
                    <span className={phone.ring0} aria-hidden="true" />
                  )
                }
                name={<span className={phone.dotName}>{entry.service}</span>}
                meta={
                  entry.beds === 0
                    ? "No inpatient beds"
                    : `${entry.inUse} of ${entry.beds} in use · ${entry.over} over ${BED_ALERT_THRESHOLD_PERCENT}%`
                }
                value={
                  <span className={phone.flagged}>
                    {positive(entry.over24) ? <StatusGlyph tone="warning" size={9} /> : null}
                    {entry.departments === 0 ? <span className={phone.word}>No ED</span> : shown(entry.waiting)}
                  </span>
                }
                time={entry.departments === 0 ? undefined : "open ED journeys"}
                href={entry.openable === false ? undefined : serviceStatisticsHref(entry.service)}
              />
            ))}
          </PhoneList>
          <PhoneDotKey testId="ward-statistics-services-dot-key">
            {`Amber dot: an open ED journey is past ${LONG_WAIT_HOURS} hours`}
          </PhoneDotKey>
          <PhoneSheetRow
            icon={Send}
            title="Where referrals were accepted"
            sub="By the service whose ward accepted"
            testId="ward-statistics-services-phone-referrals"
          >
            {HEALTH_SERVICES.map((from) => {
              const to = HEALTH_SERVICES.map((target) => ({
                target,
                count: accepted.get(`${from}|${target}`) ?? unknownCount,
              })).filter((cell) => positive(cell.count));
              return (
                <PhoneList key={from} label={`Referrals from ${from}`}>
                  <PhoneListRow
                    as="li"
                    name={<span className={phone.dotName}>{`From ${from}`}</span>}
                    value={shown(notYet.get(from) ?? unknownCount)}
                    time="not yet"
                  />
                  {to.map((cell) => (
                    <PhoneListRow
                      key={cell.target}
                      as="li"
                      name={cell.target === from ? `${cell.target}, its own` : cell.target}
                      value={shown(cell.count)}
                      time="accepted"
                    />
                  ))}
                </PhoneList>
              );
            })}
          </PhoneSheetRow>
        </PhoneBody>
      ) : (
        <>
          <FlushRow layout="thirds" id="services" className={index.anchorTarget} data-testid="ward-statistics-services">
            {services.map((entry) => (
              <StatCard
                key={entry.service}
                className={index.svcCard}
                id={`service-${entry.service.toLowerCase().replace(/\s+/gu, "-")}`}
                data-testid={`ward-statistics-services-card-${entry.service}`}
                title={
                  <ServiceLink
                    href={entry.openable === false ? undefined : serviceStatisticsHref(entry.service)}
                    className={index.svcTitle}
                  >
                    <ServiceDot service={entry.service} />
                    {entry.service}
                  </ServiceLink>
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
                            {entry.inUse} of {entry.beds} beds in use
                          </span>
                          <span className={index.svcLine}>
                            {entry.over > 0 ? (
                              <>
                                <StatusGlyph tone="warning" size={9} />
                                {`${entry.over} ${wardsWord(entry.over)} at or over ${BED_ALERT_THRESHOLD_PERCENT}%`}
                              </>
                            ) : (
                              <>
                                <StatusGlyph tone="success" size={9} />
                                {`No ward at or over ${BED_ALERT_THRESHOLD_PERCENT}%`}
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
                        {positive(entry.over24) ? <StatusGlyph tone="warning" size={9} /> : null}
                        Open ED journeys
                      </dt>
                      <dd>
                        {entry.departments === 0 ? "No ED" : shown(entry.waiting)}
                        {positive(entry.over24) ? (
                          <SrOnly>{`, ${shown(entry.over24)} past ${LONG_WAIT_HOURS} hours`}</SrOnly>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                  <p className={index.sites}>
                    {entry.sites.length > 0 ? entry.sites.join(", ") : "No inpatient sites"}
                  </p>
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
              <div
                className={styles.tableWrap}
                tabIndex={0}
                role="region"
                aria-label="Where referrals were accepted, scrollable table"
              >
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
                    {services.map(({ service: from }) => (
                      <tr key={from}>
                        <th scope="row">
                          <span className={index.matrixHead}>
                            <ServiceDot service={from} />
                            {from}
                          </span>
                        </th>
                        {HEALTH_SERVICES.map((to) => {
                          const count = accepted.get(`${from}|${to}`) ?? unknownCount;
                          return (
                            <td key={to} className={exactStatisticsCount(count) === 0 ? styles.zero : undefined}>
                              {exactStatisticsCount(count) === 0 ? (
                                0
                              ) : (
                                <span className={cx(index.bubble, from === to && index.own)}>{shown(count)}</span>
                              )}
                            </td>
                          );
                        })}
                        <td
                          className={
                            exactStatisticsCount(notYet.get(from) ?? unknownCount) === 0 ? styles.zero : undefined
                          }
                        >
                          {shown(notYet.get(from) ?? unknownCount)}
                        </td>
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
              title="Open ED journeys, by service"
              aside={<span className={styles.muted}>{shown(totalWaiting)} open ED journeys</span>}
              data-testid="ward-statistics-services-ed-waits"
            >
              <CardBody>
                <BarList
                  label="Open ED journeys, by originating health service"
                  track
                  labelWidth="8rem"
                  rows={services.map((entry) => ({
                    id: entry.service,
                    label: entry.service,
                    ...withheldBar(exactStatisticsCount(entry.waiting) ?? 0, shown(entry.waiting)),
                    display: entry.departments === 0 ? "No ED" : undefined,
                    flag: positive(entry.over24) ? "warning" : undefined,
                  }))}
                />
              </CardBody>
              <CardFoot meta="An amber dot marks a service with someone waiting past the long-wait line." />
            </StatCard>
          </FlushRow>
        </>
      )}
    </StatisticsPage>
  );
}

function ServiceLink({ href, children, ...props }: Omit<React.ComponentProps<"a">, "href"> & { href?: string }) {
  return href ? (
    <Link href={href} {...props}>
      {children}
    </Link>
  ) : (
    <span {...props}>{children}</span>
  );
}
