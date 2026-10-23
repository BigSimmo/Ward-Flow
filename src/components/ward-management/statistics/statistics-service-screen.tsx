"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, ChevronDown, Clock, LayoutList, MapPin, Network, Plane } from "lucide-react";

import {
  BarList,
  CardBody,
  CardFoot,
  HeroStat,
  Icon,
  Menu,
  PhoneListRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  buttonClass,
  durMinutes,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { SMALL_NUMBER_NOT_SHOWN } from "@/components/ward-management/ward-access-scope";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { MINUTES_PER_DAY, formatSheetMoment } from "@/components/ward-management/ward-clock";
import {
  statisticsSectionById,
  STATISTICS_SERVICE_CHOOSER_HREF,
  STATISTICS_SERVICES_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import {
  edStatisticsHref,
  serviceStatisticsHref,
  wardStatisticsHref,
} from "@/components/ward-management/shell/ward-facade";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { OUT_OF_AREA_BANDS, TRAVEL_BAND_LABELS } from "@/components/ward-management/ward-distance";
import { HEALTH_SERVICES, type HealthService, type Referral, type Unit } from "@/components/ward-management/ward-model";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, siteByCode, siteDirectory } from "@/components/ward-management/ward-sites";

import { countAxisMax } from "./statistics-axis";
import { StatisticsCapacityChart } from "./statistics-capacity-chart";
import { StatisticsEdSwarm } from "./statistics-ed-swarm";
import { edWaitFigures } from "./statistics-ed-waits";
import { StatCard, StatisticsPage, useStatisticsLive } from "./statistics-hero";
import { HeroTool, UnitStepper } from "./statistics-hero-tools";
import { FlushRow, Follow } from "./statistics-layout";
import { useOptionalRouter } from "./statistics-nav";
import { occupancyPercent, occupiedBeds } from "./statistics-occupancy";
import {
  PhoneBody,
  PhoneFacts,
  PhoneGroup,
  PhoneList,
  PhoneSheetRow,
  phoneBodyStyles as phone,
} from "./statistics-phone-parts";
import { PeopleNotListed, withheldBar } from "./statistics-small-numbers";
import styles from "./statistics-v6.module.css";
import detail from "./statistics-detail.module.css";

const OUT_OF_AREA_HREF = "/ward-flow/out-of-area";

/** "Joondalup Health Campus Emergency Department" reads "Joondalup ED" beside the ED wait field. */
function shortDepartmentName(name: string): string {
  return name
    .replace(/ Emergency Department$/u, " ED")
    .replace(/ (Memorial |General |Public )?(Hospital|Health Campus|Health Service) ED$/u, " ED");
}

/** "Sir Charles Gairdner Hospital" to "Sir Charles Gairdner", for the hero's one-line list. */
function shortSiteName(name: string): string {
  return name.replace(/\s+(Hospital|Health Campus)$/u, "");
}

function referralOriginService(referral: Referral): HealthService | undefined {
  return siteByCode(referral.originSiteCode)?.service;
}

/**
 * ONE HEALTH SERVICE IN DETAIL.
 *
 * The audience is a health-service manager asking one question: *is my service carrying its own
 * referral demand, or exporting it.* Nothing else in Ward Flow groups by health service and shows
 * one of them its own figures.
 *
 * ⚠️ **THE SERVICES ARE NORTH METRO, SOUTH METRO, EAST METRO, WACHS AND PRIVATE — `HEALTH_SERVICES`
 * (`ward-model.ts`).** The approved drawing names them EMHS/SMHS/NMHS; this app has never had those
 * names, and a second name for one fact is exactly the drift this feature's governance rules out.
 *
 * ⚠️ **AN ID THAT RESOLVES TO NOTHING GETS A PAGE THAT SAYS SO**, for the same reason the ward and
 * department screens beside this one do. This screen never falls back to a different service.
 *
 * ⚠️ **EVERY UNIT READ HERE COMES FROM THE PROVIDER'S LIVE `units`, NEVER FROM `allUnits()` OR
 * `unitById()`.** Which SITE a health service owns, and which SITE an emergency department sits at,
 * is identity rather than capacity, so `siteDirectory`, `siteByCode` and `allEmergencyDepartments()` are
 * read directly.
 *
 * ⚠️ **DECLINES ATTRIBUTED TO A WARD OR A SERVICE ARE A WITHHELD PRODUCT DECISION, NOT BUILT HERE.**
 *
 * ⚠️ **NO TREND.** The drawing's seven-day occupancy line needs a history the record does not keep
 * (owner, 25 Sept 2026: a made-up trend is not drawn), so it is left out rather than invented.
 */
export function StatisticsServiceScreen({ serviceId }: { serviceId: string }) {
  const live = useStatisticsLive();
  const { countsOnly, small, parts } = useStatisticsCounts();
  const { units: liveUnits, admissions, referrals, bedReleases, leaveBeds, movements, dayZero } = live.state;
  const now = live.now;
  const isPhone = useIsPhone();

  const section = statisticsSectionById("service");
  if (!section) throw new Error("statistics-sections.ts no longer defines the 'service' section");

  const service = useMemo(() => HEALTH_SERVICES.find((candidate) => candidate === serviceId), [serviceId]);

  const serviceSites = useMemo(
    () => (service ? siteDirectory.filter((site) => site.service === service) : []),
    [service],
  );
  const serviceSiteCodes = useMemo(() => new Set(serviceSites.map((site) => site.code)), [serviceSites]);
  const serviceUnits = useMemo(
    () => (service ? liveUnits.filter((unit) => serviceSiteCodes.has(unit.siteCode)) : []),
    [service, liveUnits, serviceSiteCodes],
  );
  const serviceEds = useMemo(
    () => (service ? allEmergencyDepartments().filter((department) => serviceSiteCodes.has(department.siteCode)) : []),
    [service, serviceSiteCodes],
  );

  // Ready is `unitCapacity`'s `available`, `min(allocatable, empty)`, per the owner's ruling.
  const readyRows = useMemo(
    () => serviceUnits.map((unit) => ({ unit, capacity: unitCapacity(unit, bedReleases) })),
    [serviceUnits, bedReleases],
  );
  const totalReady = useMemo(() => readyRows.reduce((sum, row) => sum + row.capacity.available, 0), [readyRows]);
  const totalBedBase = useMemo(() => serviceUnits.reduce((sum, unit) => sum + unit.beds, 0), [serviceUnits]);
  // L1: the one occupancy figure, Occupied + Pulled (`ward-occupancy.ts`), as every page prints it.
  const serviceOccupancy = useMemo(
    () => occupiedBeds(serviceUnits, admissions, bedReleases, leaveBeds),
    [serviceUnits, admissions, bedReleases, leaveBeds],
  );
  const occupancyPct = useMemo(() => occupancyPercent(serviceOccupancy), [serviceOccupancy]);
  const zeroReadyWards = useMemo(() => readyRows.filter((row) => row.capacity.available === 0).length, [readyRows]);
  // Owner's ruling of 2026-09-07: only beds the patient has already left count as being made ready.
  const pendingPreparation = useMemo(
    () => serviceUnits.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, bedReleases), 0),
    [serviceUnits, bedReleases],
  );
  // Pullable is smaller than Ready and clamped per ward, never subtracted from the service total.
  const totalOpenNow = useMemo(
    () => serviceUnits.reduce((sum, unit) => sum + openBedsNow(unit, bedReleases), 0),
    [serviceUnits, bedReleases],
  );

  // Where this service's OWN referral demand ended up, by the referral's origin site.
  const referralDemand = useMemo(() => {
    const ownReferrals = service ? referrals.filter((referral) => referralOriginService(referral) === service) : [];
    let placedWithinService = 0;
    let placedElsewhereCount = 0;
    let notYetAcceptedAtWard = 0;
    let placedAtUnresolvedWard = 0;
    const placedElsewhereByService = new Map<HealthService, number>(
      wardServiceOrder.filter((candidate) => candidate !== service).map((candidate) => [candidate, 0]),
    );
    for (const referral of ownReferrals) {
      const wardAcceptance = referral.destinations.find(
        (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.acceptedUnitId !== undefined,
      );
      if (!wardAcceptance || wardAcceptance.acceptedUnitId === undefined) {
        notYetAcceptedAtWard += 1;
        continue;
      }
      const acceptedUnit = liveUnits.find((unit) => unit.id === wardAcceptance.acceptedUnitId);
      const acceptedService = acceptedUnit ? siteByCode(acceptedUnit.siteCode)?.service : undefined;
      if (acceptedService === service) placedWithinService += 1;
      else if (acceptedService !== undefined) {
        placedElsewhereCount += 1;
        placedElsewhereByService.set(acceptedService, (placedElsewhereByService.get(acceptedService) ?? 0) + 1);
      } else placedAtUnresolvedWard += 1;
    }
    return {
      ownReferrals,
      placedWithinService,
      placedElsewhereCount,
      notYetAcceptedAtWard,
      placedAtUnresolvedWard,
      placedElsewhereByService,
    };
  }, [service, referrals, liveUnits]);

  // Out of area, scoped to this service's own beds.
  const outOfAreaSummary = useMemo(() => {
    const { entries: outOfAreaEntries, notBanded: outOfAreaNotBanded } = outOfAreaLedger(admissions, serviceUnits, now);
    const bandCounts = new Map<(typeof OUT_OF_AREA_BANDS)[number], number>(OUT_OF_AREA_BANDS.map((band) => [band, 0]));
    for (const entry of outOfAreaEntries) bandCounts.set(entry.band, (bandCounts.get(entry.band) ?? 0) + 1);
    return { outOfAreaEntries, outOfAreaNotBanded, bandCounts };
  }, [admissions, serviceUnits, now]);

  // Everyone waiting in this service's emergency departments, read through the ED screens' own helper.
  const edSwarmRows = useMemo(
    () =>
      serviceEds.map((department) => ({
        id: department.id,
        name: shortDepartmentName(department.name),
        href: edStatisticsHref(department.id),
        entries: edWaitFigures(movements, department.id, now).waitingMovements,
      })),
    [serviceEds, movements, now],
  );
  const edWaiting = useMemo(() => edSwarmRows.reduce((sum, row) => sum + row.entries.length, 0), [edSwarmRows]);

  if (!service) {
    return (
      <StatisticsPage
        section={section}
        navSection="service"
        testId="ward-statistics-service-screen"
        title="Health service not found"
        eyebrowLabel="Health service"
        now={now}
        paused={live.paused}
        onTogglePause={live.togglePause}
      >
        <StatCard icon={Network} title="No such health service">
          <CardBody className={styles.bodyStack}>
            <p data-testid="ward-statistics-service-unresolved">
              No health service in this prototype has the name <code className={detail.code}>{serviceId}</code>. This
              prototype has exactly five: {wardServiceOrder.join(", ")}. It may have been renamed, or the name in the
              address may be wrong. This page never falls back to a different service, because a page showing the wrong
              service under the right heading is worse than a page showing nothing.
            </p>
            <p>
              <Link href={STATISTICS_SERVICE_CHOOSER_HREF} data-testid="ward-statistics-service-chooser-link">
                Choose a health service from the statistics hub
              </Link>{" "}
              to reach one that does exist.
            </p>
          </CardBody>
        </StatCard>
      </StatisticsPage>
    );
  }

  const {
    ownReferrals,
    placedWithinService,
    placedElsewhereCount,
    notYetAcceptedAtWard,
    placedAtUnresolvedWard,
    placedElsewhereByService,
  } = referralDemand;
  const { outOfAreaEntries, outOfAreaNotBanded, bandCounts } = outOfAreaSummary;
  // Executive: the bands add up to the far-from-home count beside them, so they hide together.
  const bandsShown = parts(OUT_OF_AREA_BANDS.map((band) => bandCounts.get(band) ?? 0));

  return (
    <StatisticsPage
      section={section}
      navSection="service"
      slug={service}
      testId="ward-statistics-service-screen"
      title={service}
      titleAction={
        <>
          <ChangeService current={service} />
          <UnitStepper
            items={wardServiceOrder.map((candidate) => ({
              id: candidate,
              href: serviceStatisticsHref(candidate),
              label: candidate,
            }))}
            currentId={service}
            noun="service"
          />
        </>
      }
      tools={
        <HeroTool
          href={STATISTICS_SERVICES_HREF}
          icon={<LayoutList size={14} aria-hidden="true" />}
          testId="ward-statistics-service-tool-services"
        >
          All services
        </HeroTool>
      }
      eyebrowLabel="Health service"
      eyebrowDetail={
        <span className={detail.siteIdentity} data-testid="ward-statistics-service-identity">
          <span className={detail.eyebrowSites} aria-hidden="true">
            {serviceSites.map((site) => shortSiteName(site.name)).join(", ") || "No hospital recorded"}
          </span>
          <SrOnly>
            <span>{serviceSites.map((site) => site.name).join(", ") || "No hospital recorded"}</span>
            {", "}
            <span>Hospitals</span>
            <span>{serviceSites.length}</span>
            {", "}
            <span>Wards</span>
            <span>{serviceUnits.length}</span>
            {", "}
            <span>{serviceEds.length} emergency departments</span>
          </SrOnly>
        </span>
      }
      now={now}
      paused={live.paused}
      onTogglePause={live.togglePause}
      exportFigures={{
        stem: service.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-"),
        scope: service,
        figures: () => [
          ["Beds", totalBedBase],
          ["Occupancy percent (occupied or pulled)", occupancyPct],
          ["Ready", totalReady],
          ["Being made ready", pendingPreparation],
          ["Wards", serviceUnits.length],
          ["EDs", serviceEds.length],
          ["Out of area", small(outOfAreaEntries.length)],
        ],
      }}
      phone={{
        eyebrow: `Health service · ${serviceSites.length} ${serviceSites.length === 1 ? "hospital" : "hospitals"}`,
        sub: `${occupancyPct}% in use · ${serviceUnits.length} ${serviceUnits.length === 1 ? "ward" : "wards"}`,
        stats: (
          <>
            <HeroStat value={totalBedBase} label="Beds" />
            <HeroStat value={totalReady} label="Ready" />
            <HeroStat
              value={small(edWaiting)}
              label="In ED"
              tone={
                edSwarmRows.some((row) => row.entries.some((entry) => entry.waitMinutes >= LONG_WAIT_MINUTES))
                  ? "warning"
                  : undefined
              }
            />
          </>
        ),
      }}
      stats={
        <>
          <HeroStat
            value={<span data-testid="ward-statistics-service-exec-total-beds">{totalBedBase}</span>}
            label="Beds"
          />
          <HeroStat
            value={<span data-testid="ward-statistics-service-exec-occupancy">{occupancyPct}%</span>}
            label="In use"
          />
          <HeroStat
            value={<span data-testid="ward-statistics-service-exec-ready-beds">{totalReady}</span>}
            label={pendingPreparation > 0 ? `Ready, ${pendingPreparation} being made ready` : "Ready"}
          />
          <HeroStat value={serviceUnits.length} label="Wards" />
          {/* Five figures at most (v10). The ED count is on the ED waits card's head ("N waiting in
              M EDs"), so the hero leaves it out; the export still carries it. */}
          <HeroStat
            value={<span data-testid="ward-statistics-service-exec-ooa">{small(outOfAreaEntries.length)}</span>}
            label={
              <span className={styles.flagged}>
                {outOfAreaEntries.length > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                Out of area
              </span>
            }
          />
        </>
      }
    >
      {isPhone ? (
        <ServicePhone
          states={serviceUnits.map((unit) => ({ unit, states: bedStates(unit, admissions, bedReleases, leaveBeds) }))}
          pendingPreparation={pendingPreparation}
          eds={serviceEds.map((department) => ({
            id: department.id,
            name: shortDepartmentName(department.name),
            figures: edWaitFigures(movements, department.id, now),
          }))}
          edWaiting={small(edWaiting)}
          outOfArea={outOfAreaEntries}
          countsOnly={countsOnly}
        />
      ) : (
        <>
          <FlushRow layout="lead2" id="capacity">
            <StatisticsCapacityChart
              asAt={formatSheetMoment(now, dayZero, { includeYearAndZone: true })}
              units={serviceUnits}
              bedReleases={bedReleases}
              admissions={admissions}
              leaveBeds={leaveBeds}
              initialGroup="ward"
              scopeLabel={`in ${service}`}
              title="Ward capacity"
            />
            <Follow className={detail.followBody}>
              <Placement
                service={service}
                raised={ownReferrals.length}
                within={placedWithinService}
                elsewhere={placedElsewhereCount}
                notYet={notYetAcceptedAtWard}
                unresolved={placedAtUnresolvedWard}
                byService={placedElsewhereByService}
              />
            </Follow>
          </FlushRow>

          <FlushRow layout="lead2">
            <ReadyBeds
              service={service}
              readyRows={readyRows}
              totalReady={totalReady}
              zeroReadyWards={zeroReadyWards}
              pendingPreparation={pendingPreparation}
              openNow={totalOpenNow}
            />
            <Follow className={detail.followBody}>
              <StatCard
                id="far-from-home"
                icon={MapPin}
                title="Far from home"
                aside="Synthetic travel bands"
                data-testid="ward-statistics-service-out-of-area"
              >
                <CardBody
                  className={`${styles.bodyStack} ${detail.scrolls}`}
                  tabIndex={0}
                  role="region"
                  aria-label="Out of area figures"
                >
                  <dl className={styles.figures}>
                    <div className={styles.figure}>
                      <dd className={styles.figureValue} data-testid="ward-statistics-service-out-of-area-value">
                        {small(outOfAreaEntries.length)}
                      </dd>
                      <dt className={styles.figureLabel}>Far from home</dt>
                    </div>
                    <div className={styles.figure}>
                      <dd
                        className={styles.figureValue}
                        data-testid="ward-statistics-service-out-of-area-not-banded-value"
                      >
                        {small(outOfAreaNotBanded)}
                      </dd>
                      <dt className={styles.figureLabel}>Not banded</dt>
                    </div>
                  </dl>
                  <BarList
                    label="Patients far from home by travel band"
                    axis
                    max={countAxisMax(
                      OUT_OF_AREA_BANDS.map(
                        (band, index) => withheldBar(bandCounts.get(band) ?? 0, bandsShown[index]!).value,
                      ),
                    )}
                    labelWidth="13rem"
                    rows={OUT_OF_AREA_BANDS.map((band, index) => ({
                      id: band,
                      label: TRAVEL_BAND_LABELS[band],
                      ...withheldBar(bandCounts.get(band) ?? 0, bandsShown[index]!),
                      display: String(bandsShown[index]),
                    }))}
                  />
                  <ul className={styles.srOnly} data-testid="ward-statistics-service-out-of-area-bands">
                    {OUT_OF_AREA_BANDS.map((band, index) => (
                      <li key={band} data-testid={`ward-statistics-service-out-of-area-band-${band}`}>
                        {TRAVEL_BAND_LABELS[band]},{" "}
                        <span data-testid={`ward-statistics-service-out-of-area-band-${band}-count`}>
                          {bandsShown[index]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </StatCard>
            </Follow>
          </FlushRow>

          <StatCard
            id="ed-waits"
            className={detail.anchor}
            icon={Clock}
            title="ED waits"
            aside={`${small(edWaiting)} waiting in ${serviceEds.length} ${serviceEds.length === 1 ? "ED" : "EDs"}`}
            data-testid="ward-statistics-service-ed-waits"
          >
            <CardBody className={detail.swarmBody}>
              {edSwarmRows.length === 0 ? (
                <p className={styles.muted}>No emergency department is recorded at a {service} hospital.</p>
              ) : countsOnly ? (
                <PeopleNotListed testId="ward-statistics-service-ed-swarm-not-listed" />
              ) : (
                <StatisticsEdSwarm
                  rows={edSwarmRows}
                  labelWidth={180}
                  label={`Each person waiting in a ${service} emergency department, by how long they have waited`}
                  testId="ward-statistics-service-ed-swarm"
                />
              )}
            </CardBody>
          </StatCard>

          <StatCard
            id="out-of-area"
            className={detail.anchor}
            icon={Plane}
            title="Out of area"
            aside="In this service's beds"
            data-testid="ward-statistics-service-repatriation"
          >
            {countsOnly ? (
              <CardBody>
                <PeopleNotListed testId="ward-statistics-service-repatriation-not-listed" />
              </CardBody>
            ) : (
              <div
                className={styles.tableWrap}
                tabIndex={0}
                role="region"
                aria-label="Service ward comparison, scrollable table"
              >
                <table className={`${tableClasses.table} ${styles.table}`}>
                  <caption className={styles.srOnly}>Admissions in this service far from home</caption>
                  <thead>
                    <tr>
                      <th scope="col">Admission</th>
                      <th scope="col">Home</th>
                      <th scope="col">Travel</th>
                      <th scope="col" className={styles.num}>
                        Since arrival
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {outOfAreaEntries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.muted}>
                          Nobody in this service&apos;s beds is far from home
                        </td>
                      </tr>
                    ) : null}
                    {outOfAreaEntries.map((entry) => (
                      <tr key={entry.admission.id}>
                        <th scope="row">
                          <span className={detail.primary}>{entry.admission.id}</span>
                          <Link className={detail.secondary} href={wardStatisticsHref(entry.unit.id)}>
                            {entry.unit.name}
                          </Link>
                        </th>
                        <td className={entry.admission.homeRegion === null ? styles.muted : undefined}>
                          {entry.admission.homeRegion ?? "Not recorded"}
                        </td>
                        <td>{TRAVEL_BAND_LABELS[entry.band]}</td>
                        <td className={styles.num}>{durMinutes(Math.max(0, entry.sinceArrival))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <CardFoot meta="Repatriation is arranged on the out-of-area board">
              <Link href={OUT_OF_AREA_HREF} className={styles.footLink}>
                Open out of area
              </Link>
            </CardFoot>
          </StatCard>

          <p className={detail.pageFoot}>
            <Link href={STATISTICS_SERVICE_CHOOSER_HREF} data-testid="ward-statistics-service-chooser-link">
              Choose a different health service
            </Link>
          </p>
        </>
      )}
    </StatisticsPage>
  );
}

const waitMedian = (minutes: readonly number[]): number | null => {
  if (minutes.length === 0) return null;
  const sorted = [...minutes].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * One health service on a phone (v10 phone): the bed states as four tiles, its wards fullest
 * first, its EDs busiest first, then the people far from home in a sheet. The v10 drawing puts a
 * small trend on each ward row; the prototype keeps no occupancy history, so none is drawn.
 */
function ServicePhone({
  states,
  pendingPreparation,
  eds,
  edWaiting,
  outOfArea,
  countsOnly,
}: {
  states: { unit: Unit; states: ReturnType<typeof bedStates> }[];
  pendingPreparation: number;
  eds: { id: string; name: string; figures: ReturnType<typeof edWaitFigures> }[];
  /** Worded as "fewer than 5" for an executive, like the hero. */
  edWaiting: number | string;
  outOfArea: ReturnType<typeof outOfAreaLedger>["entries"];
  /** The executive desk: the people far from home are counted, not listed. */
  countsOnly: boolean;
}) {
  const { small, parts } = useStatisticsCounts();
  const outOfAreaShown = small(outOfArea.length);
  const sum = (pick: (entry: (typeof states)[number]) => number) =>
    states.reduce((total, entry) => total + pick(entry), 0);
  const wards = states
    .map((entry) => ({
      ...entry,
      // In use (Occupied + Pulled), the one occupancy count every page prints (ward-occupancy.ts).
      rate:
        entry.unit.beds > 0 ? Math.round(((entry.states.occupied + entry.states.pulled) / entry.unit.beds) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate || a.unit.name.localeCompare(b.unit.name));
  // On the executive desk a department worded as fewer than 5 sorts as nought, so the order cannot
  // rank the hidden ones (review on PR #354).
  const sortValue = (count: number) => {
    const shown = small(count);
    return typeof shown === "number" ? shown : 0;
  };
  const busiest = [...eds].sort(
    (a, b) => sortValue(b.figures.onTheList) - sortValue(a.figures.onTheList) || a.name.localeCompare(b.name),
  );
  // Executive: the departments add up to the "waiting" total above them, so they hide together.
  const waitingShown = parts(busiest.map((entry) => entry.figures.onTheList));
  const bedDays = outOfArea.reduce((total, entry) => total + Math.max(0, entry.sinceArrival), 0) / MINUTES_PER_DAY;
  // Bed days add up each person's stay, so beside a worded count they would give the people back.
  const bedDaysText = typeof outOfAreaShown === "string" ? "bed days not shown" : `${bedDays.toFixed(1)} bed days`;
  return (
    <PhoneBody testId="ward-statistics-service-phone">
      <PhoneFacts
        label="Beds in this service"
        facts={[
          { id: "occupied", label: BED_STATE_LABELS.occupied, value: sum((entry) => entry.states.occupied) },
          { id: "pulled", label: BED_STATE_LABELS.pulled, value: sum((entry) => entry.states.pulled) },
          { id: "closed", label: BED_STATE_LABELS.closed, value: sum((entry) => entry.states.closed) },
          { id: "prep", label: "Making ready", value: pendingPreparation },
        ]}
      />
      <PhoneGroup title="Wards" aside={`${wards.length} · tap to open`}>
        {wards.length === 0 ? (
          <p className={phone.note}>No inpatient wards are recorded for this service.</p>
        ) : (
          <PhoneList label="Wards, fullest first">
            {wards.map((entry) => (
              <PhoneListRow
                key={entry.unit.id}
                as="li"
                name={entry.unit.name}
                meta={
                  <span className={phone.flagged}>
                    {entry.rate >= BED_ALERT_THRESHOLD_PERCENT ? <StatusGlyph tone="warning" size={9} /> : null}
                    {`${entry.rate}% in use`}
                  </span>
                }
                value={entry.states.ready}
                time="ready"
                href={wardStatisticsHref(entry.unit.id)}
              />
            ))}
          </PhoneList>
        )}
      </PhoneGroup>
      <PhoneGroup title="ED waits" aside={`${edWaiting} waiting`}>
        {busiest.length === 0 ? (
          <p className={phone.note}>No emergency department is recorded for this service.</p>
        ) : (
          <PhoneList label="Emergency departments, busiest first">
            {busiest.map((entry, index) => {
              const median = waitMedian(entry.figures.waitingMovements.map((wait) => wait.waitMinutes));
              return (
                <PhoneListRow
                  key={entry.id}
                  as="li"
                  name={entry.name}
                  meta={
                    entry.figures.onTheList === 0
                      ? "No one waiting"
                      : `${small(entry.figures.unplaced)} no ward yet · median ${median === null ? "none" : durMinutes(Math.round(median))}`
                  }
                  value={waitingShown[index]}
                  time={`longest ${entry.figures.longestWait ? durMinutes(entry.figures.longestWait.waitMinutes) : "none"}`}
                  href={edStatisticsHref(entry.id)}
                />
              );
            })}
          </PhoneList>
        )}
      </PhoneGroup>
      <PhoneSheetRow
        icon={MapPin}
        title="Far from home and out of area"
        sub={`${outOfAreaShown} ${outOfAreaShown === 1 ? "person" : "people"} out of area · ${bedDaysText}`}
        testId="ward-statistics-service-phone-out-of-area"
      >
        {outOfArea.length === 0 ? (
          <p className={phone.note}>Nobody in this service&apos;s beds is far from home.</p>
        ) : countsOnly ? (
          <PeopleNotListed testId="ward-statistics-service-phone-out-of-area-not-listed" />
        ) : (
          <PhoneList label="Far from home">
            {outOfArea.map((entry) => {
              return (
                <PhoneListRow
                  key={entry.admission.id}
                  as="li"
                  name={entry.admission.id}
                  meta={`${entry.unit.name} · ${TRAVEL_BAND_LABELS[entry.band]}`}
                  value={durMinutes(Math.max(0, entry.sinceArrival))}
                  time="since arrival"
                />
              );
            })}
          </PhoneList>
        )}
        <Link href={OUT_OF_AREA_HREF} className={buttonClass({ variant: "sec" })}>
          Open out of area
        </Link>
      </PhoneSheetRow>
    </PhoneBody>
  );
}

function ChangeService({ current }: { current: HealthService }) {
  const router = useOptionalRouter();
  return (
    <Menu
      label="Change service"
      items={wardServiceOrder.map((candidate) => ({
        id: candidate,
        label: candidate,
        disabled: candidate === current,
        onSelect: () => {
          const href = serviceStatisticsHref(candidate);
          if (router) router.push(href);
          else window.location.assign(href);
        },
      }))}
      trigger={(props) => (
        <button {...props} type="button" className={buttonClass({ variant: "onHero", size: "sm" })}>
          Change service
          <Icon icon={ChevronDown} size={14} />
        </button>
      )}
    />
  );
}

function ReadyBeds({
  service,
  readyRows,
  totalReady,
  zeroReadyWards,
  pendingPreparation,
  openNow,
}: {
  service: HealthService;
  readyRows: { unit: { id: string; name: string; cohort: string }; capacity: { available: number } }[];
  totalReady: number;
  zeroReadyWards: number;
  pendingPreparation: number;
  openNow: number;
}) {
  return (
    <StatCard
      id="ready-beds"
      icon={BedDouble}
      title="Ready beds by ward"
      aside={`${readyRows.length} ${readyRows.length === 1 ? "ward" : "wards"}`}
      data-testid="ward-statistics-service-ready-beds"
    >
      {readyRows.length === 0 ? (
        <CardBody>
          <p className={styles.muted} data-testid="ward-statistics-service-no-wards">
            No ward in this prototype is recorded at a {service} hospital.
          </p>
        </CardBody>
      ) : (
        <>
          <CardBody className={styles.bodyStack}>
            <dl className={styles.figures}>
              <div className={styles.figure}>
                <dd className={styles.figureValue}>{totalReady}</dd>
                <dt className={styles.figureLabel}>Ready</dt>
              </div>
              <div className={styles.figure}>
                <dd className={styles.figureValue}>{openNow}</dd>
                <dt className={styles.figureLabel}>Open now</dt>
              </div>
              <div className={styles.figure}>
                <dd className={styles.figureValue}>{pendingPreparation}</dd>
                <dt className={styles.figureLabel}>Pending</dt>
              </div>
              <div className={styles.figure}>
                <dd className={styles.figureValue}>{zeroReadyWards}</dd>
                <dt className={styles.figureLabel}>
                  {zeroReadyWards > 0 ? <StatusGlyph tone="warning" size={9} /> : null}
                  None ready
                </dt>
              </div>
            </dl>
            <SrOnly>
              <p data-testid="ward-statistics-service-pending-preparation">
                {pendingPreparation} pending, {openNow} open now
              </p>
              <p data-testid="ward-statistics-service-zero-ready-wards">
                <span data-testid="ward-statistics-service-zero-ready-wards-value">{zeroReadyWards}</span> of{" "}
                {readyRows.length} wards without ready beds
              </p>
            </SrOnly>
          </CardBody>
          <div
            className={styles.tableWrap}
            data-testid="ward-statistics-service-ready-beds-table"
            tabIndex={0}
            role="region"
            aria-label="Service ready beds, scrollable table"
          >
            <table className={`${tableClasses.table} ${styles.table}`}>
              <caption className={styles.srOnly}>Ready beds by ward and cohort</caption>
              <thead>
                <tr>
                  <th scope="col">Ward</th>
                  <th scope="col">Cohort</th>
                  <th scope="col" className={styles.num}>
                    Ready
                  </th>
                </tr>
              </thead>
              <tbody>
                {readyRows.map(({ unit, capacity }) => (
                  <tr key={unit.id} data-testid={`ward-statistics-service-ready-row-${unit.id}`}>
                    <th scope="row">
                      <Link href={wardStatisticsHref(unit.id)} className={styles.rowLink}>
                        {unit.name}
                      </Link>
                    </th>
                    <td>{unit.cohort}</td>
                    <td
                      className={capacity.available === 0 ? `${styles.num} ${styles.muted}` : styles.num}
                      data-testid={`ward-statistics-service-ready-value-${unit.id}`}
                    >
                      {capacity.available}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">All {readyRows.length} wards</th>
                  <td />
                  <td className={styles.num} data-testid="ward-statistics-service-ready-total">
                    {totalReady}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </StatCard>
  );
}

function Placement({
  service,
  raised,
  within,
  elsewhere,
  notYet,
  unresolved,
  byService,
}: {
  service: HealthService;
  raised: number;
  within: number;
  elsewhere: number;
  notYet: number;
  unresolved: number;
  byService: Map<HealthService, number>;
}) {
  const [view, setView] = useState<"chart" | "data">("chart");
  const { small, parts } = useStatisticsCounts();
  // Executive: every part adds up to Raised, so the parts hide together. Elsewhere is the sum of the
  // services, so it hides too when one of them is hidden.
  const elsewhereCounts = [...byService];
  const shown = parts([within, ...elsewhereCounts.map(([, count]) => count), notYet, unresolved]);
  const withinShown = shown[0]!;
  const byServiceShown = shown.slice(1, 1 + elsewhereCounts.length);
  const notYetShown = shown[1 + elsewhereCounts.length]!;
  const unresolvedShown = shown[2 + elsewhereCounts.length]!;
  const elsewhereWorded = small(elsewhere);
  const elsewhereShown = byServiceShown.some((part) => typeof part === "string")
    ? typeof elsewhereWorded === "string"
      ? elsewhereWorded
      : SMALL_NUMBER_NOT_SHOWN
    : elsewhereWorded;
  const rows = [
    { id: "own", label: service, value: within, shown: withinShown },
    ...elsewhereCounts.map(([name, count], index) => ({
      id: name,
      label: name,
      value: count,
      shown: byServiceShown[index]!,
    })),
    { id: "not-yet", label: "Not yet", value: notYet, shown: notYetShown },
  ];
  return (
    <StatCard
      id="referrals"
      icon={Network}
      title="Where referrals landed"
      action={
        <Segmented
          label="Where referrals landed view"
          value={view}
          onChange={setView}
          items={[
            { id: "chart", label: "Chart" },
            { id: "data", label: "Data" },
          ]}
        />
      }
      data-testid="ward-statistics-service-placement"
    >
      <CardBody
        className={`${styles.bodyStack} ${detail.scrolls}`}
        tabIndex={0}
        role="region"
        aria-label="Placement figures"
      >
        <dl className={styles.figures}>
          <div className={styles.figure}>
            <dd className={styles.figureValue} data-testid="ward-statistics-service-placement-raised">
              {small(raised)}
            </dd>
            <dt className={styles.figureLabel}>Raised</dt>
          </div>
          <div className={styles.figure}>
            <dd className={styles.figureValue} data-testid="ward-statistics-service-placement-within">
              {withinShown}
            </dd>
            <dt className={styles.figureLabel}>Within</dt>
          </div>
          <div className={styles.figure}>
            <dd className={styles.figureValue} data-testid="ward-statistics-service-placement-elsewhere">
              {elsewhereShown}
            </dd>
            <dt className={styles.figureLabel}>Elsewhere</dt>
          </div>
          <div className={styles.figure}>
            <dd className={styles.figureValue} data-testid="ward-statistics-service-placement-not-yet">
              {notYetShown}
            </dd>
            <dt className={styles.figureLabel}>Not yet</dt>
          </div>
        </dl>
        {view === "chart" ? (
          <BarList
            label="Referrals raised here, by the service whose ward accepted"
            axis
            max={countAxisMax(rows.map((row) => withheldBar(row.value, row.shown).value))}
            labelWidth="8rem"
            rows={rows.map((row) => ({
              id: row.id,
              label: row.label,
              ...withheldBar(row.value, row.shown),
              display: String(row.shown),
            }))}
          />
        ) : (
          <div
            className={styles.tableWrap}
            tabIndex={0}
            role="region"
            aria-label="Service out-of-area admissions, scrollable table"
          >
            <table className={`${tableClasses.table} ${styles.table}`}>
              <caption className={styles.srOnly}>Referrals raised here, by the service whose ward accepted</caption>
              <thead>
                <tr>
                  <th scope="col">Accepted at</th>
                  <th scope="col" className={styles.num}>
                    Referrals
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td className={row.value === 0 ? `${styles.num} ${styles.muted}` : styles.num}>{row.shown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ul className={styles.srOnly} data-testid="ward-statistics-service-placement-elsewhere-list">
          {elsewhereCounts.map(([destination], index) => (
            <li key={destination} data-testid={`ward-statistics-service-placement-to-${destination}`}>
              Accepted at a {destination} ward,{" "}
              <span data-testid={`ward-statistics-service-placement-to-${destination}-count`}>
                {byServiceShown[index]}
              </span>
            </li>
          ))}
        </ul>
        {unresolved > 0 ? (
          <p className={detail.note} data-testid="ward-statistics-service-placement-unresolved">
            <span data-testid="ward-statistics-service-placement-unresolved-count">{unresolvedShown}</span>{" "}
            {unresolvedShown === 1 ? "referral names" : "referrals name"} an accepting ward this prototype cannot place
            at any hospital, so it is counted neither within {service} nor elsewhere.
          </p>
        ) : null}
      </CardBody>
      <CardFoot meta="An acceptance is not an arrival" />
    </StatCard>
  );
}
