"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Info, LayoutGrid, List, Lock, Search } from "lucide-react";

import {
  BarList,
  Button,
  Card,
  EmptyState,
  Hero,
  HeroStat,
  Icon,
  Kbd,
  Popover,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  cx,
  dur,
} from "@/components/wf";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import {
  designationSummary,
  lockedBedsFree,
  unitHasLockedBeds,
  wardCategory,
} from "@/components/ward-management/ward-bed-designation";
import { dayShiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { unitCapacity, wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { remainingSpeciallingCapacity } from "@/components/ward-management/ward-admissions";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { BedStrip } from "@/components/ward-management/wards/bed-strip";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./ward-index.module.css";

/**
 * All wards (v6). One hero band with the statewide counts, one filter card (service, search,
 * cards or table; status, cohort, order), then every ward as a card or a table row. Every figure
 * is read from the provider: bed states from `bedStates`, discharges from `capacityBreakdown`,
 * confirmation age from the ward's own allocatable figure.
 */

interface WardMetadata {
  num: string;
  ext: string;
  vocera: string;
  criteria: string;
  mhaForms: string;
  security: string;
  securityTone: "danger" | "warn" | "good" | "accent" | "gilt";
}

const WARD_METADATA: Record<string, WardMetadata> = {
  // 22 Authentic Inpatient Units in allUnits()
  "rph-adult-secure": {
    num: "Brian O'Connor",
    ext: "2105",
    vocera: "#NUM-21",
    criteria: "Inner-city high-acuity crisis assessment, severe behavioral disturbance, and complex dual diagnosis.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "rph-older-adult": {
    num: "Andrew Scott",
    ext: "3825",
    vocera: "#NUM-39",
    criteria:
      "Specialised psychogeriatric inpatient unit for acute organic and functional psychiatric disorders in older adults.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "scgh-adult-open": {
    num: "David Stirling",
    ext: "3490",
    vocera: "#NUM-34",
    criteria: "General acute psychiatric admissions for NMHS catchment with co-morbid acute medical complexity.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "scgh-older-adult": {
    num: "Helen Zhang",
    ext: "2930",
    vocera: "#NUM-29",
    criteria: "Sub-acute geriatric mental health rehabilitation and severe BPSD management for older adults.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "fsh-adult-secure": {
    num: "Jason Miller",
    ext: "5182",
    vocera: "#NUM-51",
    criteria: "High-dependency acute assessment and psychiatric intensive care for southern metropolitan corridor.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "fsh-older-adult": {
    num: "Simon Ross",
    ext: "4118",
    vocera: "#NUM-42",
    criteria: "Specialised psychogeriatric assessment and dementia-related behavioral support for Rockingham-Kwinana.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "arm-adult-open": {
    num: "Patricia Wright",
    ext: "3820",
    vocera: "#NUM-38",
    criteria: "Acute inpatient psychiatric care for south-east metropolitan catchment under WA Mental Health Act.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "sjgm-adult-open": {
    num: "Emma Wilson",
    ext: "7308",
    vocera: "#NUM-73",
    criteria: "Eastern corridor acute adult admissions, emergency department liaison transfers, and crisis beds.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "rgh-adult-secure": {
    num: "Jessica Howard",
    ext: "6100",
    vocera: "#NUM-61",
    criteria: "South-west metropolitan acute mental health admissions and emergency liaison transfers.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "fre-adult-open": {
    num: "Fiona Campbell",
    ext: "4112",
    vocera: "#NUM-41",
    criteria: "South-west coastal corridor acute psychiatric intake, multidisciplinary stabilization, and crisis care.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "fre-older-adult": {
    num: "Graeme Bell",
    ext: "6140",
    vocera: "#NUM-62",
    criteria: "Older adult acute psychogeriatric intake and behavioral management for Fremantle catchment.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "bty-adult-secure": {
    num: "Liam Foster",
    ext: "3150",
    vocera: "#NUM-35",
    criteria: "Secure high-dependency containment, crisis stabilization, and psychiatric intensive nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "bty-older-adult": {
    num: "Gary Davies",
    ext: "7314",
    vocera: "#NUM-74",
    criteria:
      "Older adult assessment, diagnostic workup, and community transition planning for Eastern Hills catchment.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "bty-youth": {
    num: "Timothy Lee",
    ext: "1902",
    vocera: "#NUM-19",
    criteria: "Specialised youth early psychosis intervention and recovery program for young adults aged 16–24.",
    mhaForms: "Form 1A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "gry-adult-secure": {
    num: "Clare Douglas",
    ext: "4102",
    vocera: "#NUM-41",
    criteria:
      "Adults 18–64 under Form 1A/Form 6A requiring intensive psychiatric containment and high-dependency nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  "gry-older-adult": {
    num: "Marcus Vance",
    ext: "2190",
    vocera: "#NUM-21",
    criteria:
      "Older adults 65+ experiencing acute neuropsychiatric decompensation, behavioral BPSD, or late-onset psychosis.",
    mhaForms: "Form 1A, Form 2, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "alb-adult-open": {
    num: "Karen Hughes",
    ext: "2224",
    vocera: "#NUM-22",
    criteria: "Regional adult psychiatric unit for Great Southern region with telemetry link to Perth State Bed Desk.",
    mhaForms: "Form 1A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "bun-adult-open": {
    num: "Stephen Clarke",
    ext: "9014",
    vocera: "#NUM-90",
    criteria: "Regional high-dependency acute psychiatric intake and assessment for South West WA.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "brm-adult-secure": {
    num: "Bradley King",
    ext: "8420",
    vocera: "#NUM-84",
    criteria: "Kimberley regional acute culturally-grounded mental health inpatient unit with RFDS coordination.",
    mhaForms: "Form 4A, Form 6A, CLMA Remand",
    security: "All locked",
    securityTone: "danger",
  },
  "ger-adult-open": {
    num: "Rachel Adams",
    ext: "3140",
    vocera: "#NUM-31",
    criteria: "Midwest regional acute psychiatric intake, stabilization, and crisis admissions.",
    mhaForms: "Form 1A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "sjgs-adult-open": {
    num: "Julian Croft",
    ext: "3310",
    vocera: "#NUM-33",
    criteria:
      "Private adult voluntary inpatient stabilization, mood disorder therapies, and anxiety treatment programs.",
    mhaForms: "Voluntary Admissions, Form 1A",
    security: "All open",
    securityTone: "good",
  },
  "sjgs-adult-secure": {
    num: "Sophie Turner",
    ext: "9901",
    vocera: "#NUM-99",
    criteria: "Private secure high-dependency crisis stabilization and psychiatric care.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
  // Legacy aliases for backward compatibility with mockups
  "armadale-adult": {
    num: "Patricia Wright",
    ext: "3820",
    vocera: "#NUM-38",
    criteria: "Acute inpatient psychiatric care for south-east metropolitan catchment under WA Mental Health Act.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "midland-adult": {
    num: "Emma Wilson",
    ext: "7308",
    vocera: "#NUM-73",
    criteria: "Eastern corridor acute adult admissions, emergency department liaison transfers, and crisis beds.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "fremantle-adult-open": {
    num: "Fiona Campbell",
    ext: "4112",
    vocera: "#NUM-41",
    criteria: "South-west coastal corridor acute psychiatric intake, multidisciplinary stabilization, and crisis care.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All open",
    securityTone: "good",
  },
  "graylands-dorrington": {
    num: "Clare Douglas",
    ext: "4102",
    vocera: "#NUM-41",
    criteria:
      "Adults 18–64 under Form 1A/Form 6A requiring intensive psychiatric containment and high-dependency nursing.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: "All locked",
    securityTone: "danger",
  },
};

type ServiceFilter = "all" | HealthService;
type StatusFilter = "all" | "has-ready" | "full" | "stale";
type CohortFilter = "all" | "adult" | "older-adult" | "youth" | "perinatal";
type OrderBy = "service" | "most-ready" | "fullest";
type ViewMode = "cards" | "table";

/** "Fiona Stanley Hospital" -> "Fiona Stanley". Display only; the full name stays in the profile. */
function siteShortName(name: string): string {
  return name.replace(/ (Hospital|Health Service|Health Campus|Mental Health Service)$/u, "");
}

function serviceShortName(service: HealthService): string {
  return service.replace(/ Metro$/u, "");
}

/** Mother and baby wards read as perinatal; the model's cohorts are Adult, Older adult, Youth. */
function cohortKey(unit: Unit): Exclude<CohortFilter, "all"> {
  if (/mother|baby|perinatal|mbu/iu.test(unit.name)) return "perinatal";
  if (unit.cohort === "Older adult") return "older-adult";
  if (unit.cohort === "Youth") return "youth";
  return "adult";
}

function cohortLabel(unit: Unit): string {
  return cohortKey(unit) === "perinatal" ? "Perinatal" : unit.cohort;
}

/** Owner ruling 2026-09-04: Open, Locked or Mixed, read from the bed counts. */
function SecurityLabel({ unit }: { unit: Unit }) {
  const category = wardCategory(unit);
  return (
    <span className={styles.acuityBadge} title={designationSummary(unit)}>
      {category !== "Open" ? <Icon icon={Lock} size={14} /> : null}
      {category}
    </span>
  );
}

const NEAR_FULL = 0.95;
const SERVICE_LINE = 0.9;

type WardRow = {
  unit: Unit;
  service: HealthService | null;
  siteName: string;
  siteShort: string;
  states: ReturnType<typeof bedStates>;
  occupancy: number;
  ready: number;
  out: number;
  incoming: number;
  confirmedAt: Instant;
  stale: boolean;
  specialling: number;
};

export function WardIndex({ units: unitsOverride }: { units?: Unit[] }) {
  const { units: liveUnits, bedReleases, movements, admissions, leaveBeds } = useWardFlow();
  const units = unitsOverride ?? liveUnits;
  const { now, paused, togglePause } = usePageLive();

  const [service, setService] = useState<ServiceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [cohort, setCohort] = useState<CohortFilter>("all");
  const [order, setOrder] = useState<OrderBy>("service");
  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const rows: WardRow[] = useMemo(
    () =>
      units.map((unit) => {
        const site = siteByCode(unit.siteCode);
        const states = bedStates(unit, admissions, bedReleases, leaveBeds);
        const capacity = unitCapacity(unit, bedReleases);
        const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
        const incoming = movements.filter(
          (movement) =>
            (movement.stage === "moving" || movement.stage === "accepted_awaiting_bed") &&
            movement.acceptedUnitId === unit.id,
        ).length;
        return {
          unit,
          service: site?.service ?? null,
          siteName: site?.name ?? unit.siteCode,
          siteShort: site ? siteShortName(site.name) : unit.siteCode,
          states,
          occupancy: unit.beds > 0 ? capacity.occupied / unit.beds : 0,
          ready: states.ready,
          out: breakdown.confirmedToday + breakdown.expectedToday,
          incoming,
          confirmedAt: unit.allocatable.confirmedAt,
          stale: now - unit.allocatable.confirmedAt > unit.allocatable.staleAfterMinutes,
          specialling: Math.max(0, unit.speciallingCapacity - remainingSpeciallingCapacity(unit, admissions)),
        };
      }),
    [units, admissions, bedReleases, leaveBeds, movements, now],
  );

  const services = useMemo(
    () =>
      wardServiceOrder
        .map((name) => ({ name, rows: rows.filter((row) => row.service === name) }))
        .filter((group) => group.rows.length > 0),
    [rows],
  );
  const placed = rows.filter((row) => row.service !== null);
  const unplaced = rows.filter((row) => row.service === null);

  // Statewide hero counts.
  const totalBeds = rows.reduce((sum, row) => sum + row.unit.beds, 0);
  const totalOccupied = rows.reduce((sum, row) => sum + Math.round(row.occupancy * row.unit.beds), 0);
  const readyNow = rows.reduce((sum, row) => sum + row.ready, 0);
  const shiftEnd = dayShiftEndInstant(now);
  const freeingByShiftEnd = bedReleases.filter(
    (release) =>
      release.state !== "discharged" &&
      release.expectedAt <= shiftEnd &&
      units.some((unit) => unit.id === release.unitId),
  ).length;
  const pulled = rows.reduce((sum, row) => sum + row.states.pulled, 0);
  const specialling = rows.reduce((sum, row) => sum + row.specialling, 0);
  const staleCount = rows.filter((row) => row.stale).length;

  const matchesQuery = (row: WardRow) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.unit.name, row.siteName, row.unit.cohort, row.service ?? ""].some((text) =>
      text.toLowerCase().includes(q),
    );
  };

  // Counts for each control follow the other filters, so a count never promises rows it cannot show.
  const byService = (row: WardRow) => service === "all" || row.service === service;
  const byStatus = (row: WardRow) =>
    status === "all" ||
    (status === "has-ready" && row.ready > 0) ||
    (status === "full" && row.ready === 0) ||
    (status === "stale" && row.stale);
  const byCohort = (row: WardRow) => cohort === "all" || cohortKey(row.unit) === cohort;

  const filtered = placed.filter((row) => byService(row) && byStatus(row) && byCohort(row) && matchesQuery(row));
  const serviceRank = (row: WardRow) => wardServiceOrder.indexOf(row.service as HealthService);
  const ordered = [...filtered].sort((a, b) => {
    if (order === "most-ready") return b.ready - a.ready || serviceRank(a) - serviceRank(b);
    if (order === "fullest") return b.occupancy - a.occupancy || serviceRank(a) - serviceRank(b);
    return serviceRank(a) - serviceRank(b);
  });

  const isFiltered = service !== "all" || status !== "all" || cohort !== "all" || query !== "";
  const resetFilters = () => {
    setService("all");
    setStatus("all");
    setCohort("all");
    setQuery("");
  };

  const serviceItems = [
    { id: "all" as ServiceFilter, label: "All", count: placed.filter((row) => matchesQuery(row)).length },
    ...services.map((group) => ({
      id: group.name as ServiceFilter,
      label: serviceShortName(group.name),
      count: group.rows.filter((row) => matchesQuery(row)).length,
    })),
  ];

  const serviceBars = services.map((group) => {
    const beds = group.rows.reduce((sum, row) => sum + row.unit.beds, 0);
    const occupied = group.rows.reduce((sum, row) => sum + Math.round(row.occupancy * row.unit.beds), 0);
    const value = beds > 0 ? occupied / beds : 0;
    return {
      id: group.name,
      label: group.name,
      value: value * 100,
      display: `${(value * 100).toFixed(1)}%`,
      fill: value >= SERVICE_LINE ? ("data-1" as const) : ("data-2" as const),
    };
  });

  return (
    <div
      className={styles.screen}
      data-testid="ward-index"
      data-ward-design="v6"
      data-ward-rebuilt-screen="wards-index"
    >
      <main id="main-content" className={styles.main}>
        <Hero
          eyebrow="Wards · Statewide"
          level={1}
          title={
            <>
              <SrOnly>All wards, </SrOnly>
              {units.length} wards, {totalBeds} beds
            </>
          }
          stats={
            <>
              <HeroStat
                value={`${totalBeds > 0 ? ((totalOccupied / totalBeds) * 100).toFixed(1) : "0.0"}%`}
                label="Occupied"
              />
              <HeroStat value={readyNow} label="Ready now" tone="success" />
              <HeroStat value={readyNow + freeingByShiftEnd} label={`Ready by ${formatInstant(shiftEnd)}`} />
              <HeroStat value={pulled} label="Pulled" />
              <HeroStat value={specialling} label="1:1 specialling" />
              <HeroStat value={staleCount} label="Stale counts" tone={staleCount > 0 ? "warning" : undefined} />
            </>
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
        />

        <section className={styles.filters} aria-label="Ward filters">
          <div className={styles.filterRow}>
            <Segmented label="Health service" items={serviceItems} value={service} onChange={setService} size="md" />
            <TextInput
              ref={searchRef}
              type="search"
              id="wardSearchInput"
              icon={Search}
              placeholder="Ward, hospital or suburb"
              aria-label="Filter wards by keyword"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              trailing={query ? undefined : <Kbd>/</Kbd>}
              autoComplete="off"
              spellCheck={false}
              boxClassName={styles.search}
            />
            <Segmented
              label="View"
              items={[
                { id: "cards" as ViewMode, label: <ViewLabel icon={LayoutGrid} text="Cards" /> },
                { id: "table" as ViewMode, label: <ViewLabel icon={List} text="Table" /> },
              ]}
              value={view}
              onChange={setView}
              size="md"
            />
          </div>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel} id="ward-status-label">
              Status
            </span>
            <Segmented
              label="Status"
              items={[
                { id: "all" as StatusFilter, label: "All" },
                { id: "has-ready" as StatusFilter, label: "Has ready" },
                { id: "full" as StatusFilter, label: "Full" },
                { id: "stale" as StatusFilter, label: "Stale" },
              ]}
              value={status}
              onChange={setStatus}
            />
            <span className={styles.filterLabel}>Cohort</span>
            <Segmented
              label="Cohort"
              items={[
                { id: "all" as CohortFilter, label: "All" },
                { id: "adult" as CohortFilter, label: "Adult" },
                { id: "older-adult" as CohortFilter, label: "Older adult" },
                { id: "youth" as CohortFilter, label: "Youth" },
                { id: "perinatal" as CohortFilter, label: "Perinatal" },
              ]}
              value={cohort}
              onChange={setCohort}
            />
            <span className={styles.filterLabel}>Order</span>
            <Segmented
              label="Order"
              items={[
                { id: "service" as OrderBy, label: "Service" },
                { id: "most-ready" as OrderBy, label: "Most ready" },
                { id: "fullest" as OrderBy, label: "Fullest" },
              ]}
              value={order}
              onChange={setOrder}
            />
            <span className={styles.shownCount}>
              {isFiltered ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : null}
              <span>
                {filtered.length} of {placed.length}
              </span>
            </span>
          </div>
        </section>

        {/* Service anchors: the canonical service order, one heading each, for in-page links. */}
        <div className={styles.serviceAnchors}>
          {wardServiceOrder.map((name) => (
            <section key={name} id={`wards-${slug(name)}`} data-testid={`ward-index-service-${slug(name)}`}>
              <h3>{name}</h3>
            </section>
          ))}
        </div>

        {ordered.length === 0 ? (
          <Card className={styles.emptyCard}>
            <EmptyState
              icon={Search}
              title="No wards match"
              meta={`${placed.length} wards in the network`}
              action={
                <Button variant="sec" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              }
            />
          </Card>
        ) : view === "cards" ? (
          <section className={styles.cardGrid} aria-label="Ward cards">
            {ordered.map((row) => (
              <WardCard key={row.unit.id} row={row} now={now} />
            ))}
            <Card className={styles.serviceCard} as="section" aria-labelledby="ward-service-occupancy">
              <div className={styles.serviceHead}>
                <h3 id="ward-service-occupancy" className={styles.eyebrow}>
                  Occupancy by service
                </h3>
                <span className={styles.serviceMeta}>dashed at {SERVICE_LINE * 100}%</span>
              </div>
              <BarList
                label="Occupancy by service"
                rows={serviceBars}
                max={100}
                mean={SERVICE_LINE * 100}
                meanLabel=""
                track
                labelWidth="88px"
              />
            </Card>
          </section>
        ) : (
          <WardTable rows={ordered} now={now} />
        )}

        {unplaced.length > 0 ? (
          <section id="wards-unplaced" className={styles.unplaced} data-testid="ward-index-unplaced">
            <h3 className={styles.eyebrow}>Not placed in a health service</h3>
            <ul className={styles.unplacedList}>
              {unplaced.map((row) => (
                <li key={row.unit.id}>
                  <Link
                    className={styles.unplacedLink}
                    href={`/mockups/ward-flow/ward/${row.unit.id}`}
                    data-testid={`ward-index-link-${row.unit.id}`}
                  >
                    {row.unit.name}
                  </Link>
                  <span className={styles.meta}>
                    {row.siteName} · {row.unit.cohort} · {wardCategory(row.unit)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <WardPrototypeFooter
          testId="ward-index-governance"
          note="Synthetic prototype. Invented figures under real WA hospital names. Lists update once a minute."
        />
      </main>
    </div>
  );
}

function slug(service: HealthService): string {
  return service.toLowerCase().split(" ").join("-");
}

function ViewLabel({ icon, text }: { icon: typeof List; text: string }) {
  return (
    <span className={styles.viewLabel}>
      <Icon icon={icon} size={14} />
      {text}
    </span>
  );
}

function OccupancyFigure({ row }: { row: WardRow }) {
  const pct = Math.round(row.occupancy * 100);
  const nearFull = row.occupancy >= NEAR_FULL;
  return (
    <span className={styles.figure}>
      {nearFull ? <StatusGlyph tone="warning" size={8} /> : null}
      <b className={styles.num}>{pct}%</b> {nearFull ? "near full" : "occupied"}
    </span>
  );
}

function Confirmed({ row, now }: { row: WardRow; now: Instant }) {
  const age = dur(Math.max(0, now - row.confirmedAt) * 60_000);
  return row.stale ? (
    <span className={styles.confirmed}>
      <StatusGlyph tone="warning" size={8} />
      <b className={styles.num}>{age}</b> stale, ask NUM
    </span>
  ) : (
    <span className={styles.confirmed}>
      <b className={styles.num}>{age}</b> since confirmed
    </span>
  );
}

function WardCard({ row, now }: { row: WardRow; now: Instant }) {
  const { unit } = row;
  return (
    <article
      className={styles.wardCard}
      data-service={row.service ?? "none"}
      data-cohort={cohortKey(unit)}
      data-avail={row.ready > 0 ? "vacant" : "full"}
      data-acuity={unitHasLockedBeds(unit) ? "high" : "standard"}
    >
      <div className={styles.cardHead}>
        <h3 className={styles.wardTitle} title={unit.name}>
          {unit.name}
        </h3>
        <SecurityLabel unit={unit} />
      </div>
      <p className={styles.meta} title={`${row.service ?? ""} · ${row.siteName} · ${unit.cohort}`}>
        {row.service} · {row.siteShort} · {cohortLabel(unit)}
      </p>
      <BedStrip counts={row.states} wardName={unit.name} className={styles.strip} />
      <div className={styles.figures}>
        <OccupancyFigure row={row} />
        <span className={styles.flow}>
          <b className={styles.num}>{row.ready}</b> ready <span aria-hidden="true">·</span>{" "}
          <b className={styles.num}>{row.out}</b> out <span aria-hidden="true">·</span>{" "}
          <b className={styles.num}>{row.incoming}</b> in
        </span>
      </div>
      <div className={styles.cardFoot}>
        <Confirmed row={row} now={now} />
        <WardProfile row={row} />
        <Link
          className={buttonClass({ variant: "sec", size: "sm" })}
          href={`/mockups/ward-flow/ward/${unit.id}`}
          data-testid={`ward-index-link-${unit.id}`}
          aria-label={`Enter ${unit.name}`}
        >
          Enter
        </Link>
      </div>
    </article>
  );
}

function WardProfile({ row }: { row: WardRow }) {
  const { unit } = row;
  const meta: WardMetadata = WARD_METADATA[unit.id] ?? {
    num: "Shift coordinator",
    ext: "2000",
    vocera: "#NUM-01",
    criteria: "Adult acute clinical assessment.",
    mhaForms: "Form 1A, Form 3A, Form 6A",
    security: unitHasLockedBeds(unit) ? "Locked Unit" : "Open Inpatient Care",
    securityTone: unitHasLockedBeds(unit) ? "danger" : "good",
  };
  const forms = meta.mhaForms.split(",").map((form) => form.trim());
  return (
    <Popover
      label={`${unit.name} profile`}
      align="end"
      panelClassName={styles.profile}
      trigger={(props) => (
        <button {...props} type="button" className={styles.iconButton} aria-label={`${unit.name} profile`}>
          <Icon icon={Info} size={16} />
        </button>
      )}
    >
      {(close) => (
        <div className={styles.profileBody}>
          <div className={styles.profileHead}>
            <span className={styles.eyebrow}>{row.service ?? "Unplaced"} · Profile</span>
            <span className={styles.profileTitle}>{unit.name}</span>
            <span className={styles.meta}>{row.siteName}</span>
          </div>
          <dl className={styles.profileStats}>
            <div>
              <dt>Beds</dt>
              <dd>{unit.beds}</dd>
            </div>
            <div>
              <dt>Ready</dt>
              <dd>{row.ready}</dd>
            </div>
            <div>
              <dt>Locked beds</dt>
              <dd>{unit.lockedBeds}</dd>
            </div>
            <div>
              <dt>1:1</dt>
              <dd>{row.specialling}</dd>
            </div>
          </dl>
          <dl className={styles.profileFacts}>
            <dt>Cohort</dt>
            <dd>{cohortLabel(unit)}</dd>
            <dt>Security</dt>
            <dd>
              {designationSummary(unit)}
              {unitHasLockedBeds(unit) ? `, ${lockedBedsFree(unit)} locked free` : ""}
            </dd>
            <dt>Admits</dt>
            <dd>{meta.criteria}</dd>
            <dt>Forms held</dt>
            <dd className={styles.formChips}>
              {forms.map((form) => (
                <span key={form} className={styles.formChip}>
                  {form}
                </span>
              ))}
            </dd>
            <dt>Catchment</dt>
            <dd>{row.service ?? "Not placed"}</dd>
          </dl>
          <div className={styles.profileFoot}>
            <span className={styles.numOnShift}>
              <span className={styles.profileTitleSm}>NUM on shift</span>
              <span className={styles.mono} title={`${meta.num}, ext ${meta.ext}`}>
                ext {meta.ext} · {meta.num}
              </span>
            </span>
            <Link
              className={buttonClass({ variant: "sec", size: "sm" })}
              href={`/mockups/ward-flow/board/${unit.id}`}
              onClick={close}
            >
              Bed board
            </Link>
            <Link
              className={buttonClass({ variant: "pri", size: "sm" })}
              href={`/mockups/ward-flow/ward/${unit.id}`}
              onClick={close}
            >
              Enter ward
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}

const TABLE_COLUMNS = "minmax(200px, 2.2fr) 100px 80px minmax(120px, 1.4fr) 76px 56px 64px 92px 72px";

function WardTable({ rows, now }: { rows: WardRow[]; now: Instant }) {
  return (
    <Card className={styles.tableCard} as="section" aria-label="Ward table">
      <div role="table" aria-label="Wards" className={styles.table}>
        <div role="rowgroup">
          <div role="row" className={cx(styles.tr, styles.th)} style={{ gridTemplateColumns: TABLE_COLUMNS }}>
            <span role="columnheader">Ward</span>
            <span role="columnheader">Service</span>
            <span role="columnheader">Security</span>
            <span role="columnheader">Beds</span>
            <span role="columnheader">Occupied</span>
            <span role="columnheader" className={styles.end}>
              Ready
            </span>
            <span role="columnheader" className={styles.end}>
              Out, in
            </span>
            <span role="columnheader">Confirmed</span>
            <span role="columnheader">
              <span className={styles.srOnly}>Open</span>
            </span>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row) => (
            <div role="row" key={row.unit.id} className={styles.tr} style={{ gridTemplateColumns: TABLE_COLUMNS }}>
              <span role="cell" className={styles.wardCell}>
                <span className={styles.wardTitle}>{row.unit.name}</span>
                <span className={styles.meta}>
                  {row.siteShort} · {cohortLabel(row.unit)}
                </span>
              </span>
              <span role="cell">{row.service}</span>
              <span role="cell">
                <SecurityLabel unit={row.unit} />
              </span>
              <span role="cell">
                <BedStrip counts={row.states} wardName={row.unit.name} />
              </span>
              <span role="cell">
                <span className={styles.figure}>
                  {row.occupancy >= NEAR_FULL ? <StatusGlyph tone="warning" size={8} /> : null}
                  <b className={styles.num}>{Math.round(row.occupancy * 100)}%</b>
                </span>
              </span>
              <span role="cell" className={cx(styles.end, styles.bigNum)}>
                {row.ready}
              </span>
              <span role="cell" className={cx(styles.end, styles.num)}>
                {row.out}, {row.incoming}
              </span>
              <span role="cell" className={styles.num}>
                {row.stale ? <StatusGlyph tone="warning" size={8} /> : null}{" "}
                {dur(Math.max(0, now - row.confirmedAt) * 60_000)}
              </span>
              <span role="cell" className={styles.end}>
                <Link
                  className={buttonClass({ variant: "sec", size: "sm" })}
                  href={`/mockups/ward-flow/ward/${row.unit.id}`}
                  data-testid={`ward-index-link-${row.unit.id}`}
                  aria-label={`Enter ${row.unit.name}`}
                >
                  Enter
                </Link>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
