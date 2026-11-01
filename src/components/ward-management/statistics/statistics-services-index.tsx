"use client";

import Link from "next/link";
import { ArrowLeftRight, Send } from "lucide-react";

import { BarList, Donut, HeroStat, PhoneListRow, SrOnly, StatusGlyph, cx, useIsPhone } from "@/components/wf";
import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";
import { allEmergencyDepartments, siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";

import { LONG_WAIT_HOURS, edJourneyWaitFigures as edWaitFigures } from "./statistics-ed-waits";
import { HeroTool } from "./statistics-hero-tools";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { STATISTICS_COMPARE_HREF, STATISTICS_EDS_HREF, statisticsSectionById } from "./statistics-sections";
import { PhoneBody, PhoneDotKey, PhoneList, PhoneSheetRow, phoneBodyStyles as phone } from "./statistics-phone-parts";
import styles from "./statistics-v6.module.css";
import index from "./statistics-index.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import {
  BedStack,
  Facts,
  Foot,
  Glyph,
  Grid,
  MoreLink,
  Now,
  Strip,
  Tile,
  ShortLabel,
  redesignStyles as redesign,
} from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
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

/** The heat map's shade (the redesign's four steps): none, then 1, 2 and 3 or more; a held-back count takes the first. */
function heatLevel(count: number | null): number {
  if (count === null) return 1;
  return count === 0 ? 0 : Math.min(4, 1 + Math.floor(((count - 1) * 3) / 2));
}

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
  const totalWards = services.reduce((total, entry) => total + entry.wards, 0);
  // The redesign's order (Q135): services with inpatient beds first, then any without.
  const tiles = [...withBeds, ...services.filter((entry) => entry.beds === 0)];
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
            <HeroStat value={shown(totalWaiting)} label={<ShortLabel short="In ED now" full="Open ED journeys" />} />
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
          <StatCard
            id="services"
            className={index.anchorTarget}
            title="Health services"
            meta={`${services.length} services · ${totalWards} ${wardsWord(totalWards)}`}
            action={<span className={redesign.facts}>In use, pulled, closed and ready</span>}
            data-testid="ward-statistics-services"
          >
            <Strip label="Health services" cols={3}>
              {tiles.map((entry) => {
                const title = (
                  <ServiceLink
                    href={entry.openable === false ? undefined : serviceStatisticsHref(entry.service)}
                    className={cx(redesign.nameLink, redesign.nameSub)}
                  >
                    <ServiceDot service={entry.service} />
                    {entry.service}
                  </ServiceLink>
                );
                const ed = entry.departments === 0 ? "No ED" : shown(entry.waiting);
                const pastLine = positive(entry.over24) ? (
                  <SrOnly>{`, ${shown(entry.over24)} past ${LONG_WAIT_HOURS} hours`}</SrOnly>
                ) : null;
                if (entry.beds === 0) {
                  return (
                    <Tile
                      key={entry.service}
                      muted
                      testId={`ward-statistics-services-card-${entry.service}`}
                      title={title}
                      now={<Now>{`${entry.wards} ${wardsWord(entry.wards)}`}</Now>}
                    >
                      <p className={redesign.outside}>No inpatient beds recorded</p>
                      <Facts items={[{ value: ed, label: "open ED journeys" }]} />
                      {pastLine}
                    </Tile>
                  );
                }
                const percent = Math.round(entry.share * 100);
                const hot = percent >= BED_ALERT_THRESHOLD_PERCENT;
                return (
                  <Tile
                    key={entry.service}
                    testId={`ward-statistics-services-card-${entry.service}`}
                    title={title}
                    now={<Now>{`${entry.wards} ${wardsWord(entry.wards)}`}</Now>}
                    fig={`${percent}%`}
                    unit={`${entry.inUse} of ${entry.beds} beds in use`}
                    sub={entry.sites.join(", ")}
                  >
                    <BedStack
                      label={`${entry.service} beds`}
                      used={entry.inUse}
                      pulled={entry.pulled}
                      closed={entry.closed}
                      ready={entry.ready}
                      beds={entry.beds}
                    />
                    <Facts
                      items={[
                        {
                          value: `${entry.over} of ${entry.wards}`,
                          label: `wards at ${BED_ALERT_THRESHOLD_PERCENT}%+`,
                          tone: hot ? "warning" : undefined,
                          warn: hot,
                        },
                        { value: entry.ready, label: "ready" },
                        { value: entry.pending, label: "being made ready" },
                        { value: entry.pulled, label: "pulled" },
                        { value: ed, label: "open ED" },
                      ]}
                    />
                    {pastLine}
                  </Tile>
                );
              })}
            </Strip>
            <Foot link={<MoreLink href={STATISTICS_COMPARE_HREF}>Compare wards</MoreLink>}>
              Pulled beds count as in use
            </Foot>
          </StatCard>

          <Grid>
            <StatCard
              id="referrals"
              className={index.anchorTarget}
              title="Where referrals were accepted"
              meta="Every referral on record"
              data-testid="ward-statistics-services-referrals"
            >
              <div
                className={redesign.tableWrap}
                tabIndex={0}
                role="region"
                aria-label="Where referrals were accepted, scrollable table"
              >
                <table className={redesign.heat}>
                  <caption className={styles.srOnly}>
                    Referrals for a bed, by the referring service (rows) and the service whose ward accepted (columns)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">From, to</th>
                      {HEALTH_SERVICES.map((service) => (
                        <th key={service} scope="col" title={service}>
                          <span>
                            <ServiceDot service={service} />
                            <span aria-hidden="true">{service.replace(/ Metro$/u, "")}</span>
                            <span className={styles.srOnly}>{service}</span>
                          </span>
                        </th>
                      ))}
                      <th scope="col">Not yet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map(({ service: from }) => (
                      <tr key={from}>
                        <th scope="row">
                          <span>
                            <ServiceDot service={from} />
                            {from}
                          </span>
                        </th>
                        {[...HEALTH_SERVICES, null].map((to) => {
                          const count = to
                            ? (accepted.get(`${from}|${to}`) ?? unknownCount)
                            : (notYet.get(from) ?? unknownCount);
                          const exact = exactStatisticsCount(count);
                          return (
                            <td key={to ?? "not-yet"}>
                              <span
                                className={redesign.cell}
                                data-l={heatLevel(exact)}
                                data-own={to === from ? "" : undefined}
                              >
                                {exact === 0 ? (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <SrOnly>0</SrOnly>
                                  </>
                                ) : (
                                  shown(count)
                                )}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Foot>
                <span className={redesign.heatKey} aria-hidden="true">
                  Fewer <i data-l="1" />
                  <i data-l="2" />
                  <i data-l="3" />
                  <i data-l="4" /> More <i className={redesign.own} /> Own service
                </span>
                <span> · Not yet: no ward has accepted so far</span>
              </Foot>
            </StatCard>

            <StatCard
              id="ed-waits"
              className={index.anchorTarget}
              title="Open ED journeys, by service"
              meta={`${shown(totalWaiting)} open`}
              data-testid="ward-statistics-services-ed-waits"
            >
              <div className={redesign.bars}>
                <BarList
                  label="Open ED journeys, by originating health service"
                  track
                  rows={services.map((entry) => ({
                    id: entry.service,
                    label: entry.service,
                    ...withheldBar(exactStatisticsCount(entry.waiting) ?? 0, shown(entry.waiting)),
                    display:
                      entry.departments === 0 ? "No ED" : exactStatisticsCount(entry.waiting) === 0 ? "0" : undefined,
                    flag: positive(entry.over24) ? "warning" : undefined,
                  }))}
                />
              </div>
              <Foot link={<MoreLink href={STATISTICS_EDS_HREF}>Open EDs</MoreLink>}>
                <Glyph tone="warning" /> Someone waiting past the long-wait line
              </Foot>
            </StatCard>
          </Grid>
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
