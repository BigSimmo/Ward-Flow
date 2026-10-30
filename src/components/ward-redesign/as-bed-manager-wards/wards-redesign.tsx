"use client";

// Fork of src/components/ward-redesign/wards/wards-redesign.tsx: a site bed manager branch.

import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { setServiceScope, useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Info, LayoutGrid, List, Lock, Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Button,
  Card,
  CheckingFoot,
  Count,
  CountCircle,
  EmptyState,
  Hero,
  HeroStat,
  Icon,
  Kbd,
  OccupancyRing,
  PhoneSheet,
  Popover,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  TextInput,
  WardCapacityRow,
  WardCapacityRows,
  buttonClass,
  cx,
  durMinutes,
  useIsPhone,
} from "@/components/wf";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import {
  designationSummary,
  lockedBedsFree,
  unitHasLockedBeds,
  wardCategory,
} from "@/components/ward-management/ward-bed-designation";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";
import { remainingSpeciallingCapacity } from "@/components/ward-management/ward-admissions";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { officialForms } from "@/lib/form-register";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { BedStrip, BedStripLegend } from "@/components/ward-management/wards/bed-strip";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";

import redesign from "@/components/ward-redesign/wards/wards-redesign.module.css";
import siteStyles from "./wards-site.module.css";
import styles from "@/components/ward-management/wards/ward-index.module.css";

/**
 * All wards (v10). One hero band with the ready-bed answer, the statewide occupancy ring and the
 * Checking foot; one filter card (service, search, cards or table; status, cohort, order) whose
 * choices highlight wards and dim the rest, never hide them; then every ward as a card or a table
 * row beside a sticky rail with occupancy by service (shared `WardCapacityRow`). Every figure
 * is read from the provider: bed states from `bedStates`, discharges from `capacityBreakdown`,
 * confirmation age from the ward's own allocatable figure.
 */

/**
 * What each ward admits, as a plain description. It carries no legal claim: the forms a ward holds
 * are read from the unit itself (`wardFormsHeld`), never typed here. The table once also carried a
 * nurse unit manager's name, extension and paging handle for every ward and a made-up fallback for
 * unknown wards; those were invented and are gone. A ward missing from this table shows no
 * description rather than a substituted one.
 */
const WARD_ADMITS: Readonly<Record<string, string>> = {
  "rph-adult-secure":
    "Inner-city high-acuity crisis assessment, severe behavioural disturbance, and complex dual diagnosis.",
  "rph-older-adult":
    "Specialised psychogeriatric inpatient unit for acute organic and functional psychiatric disorders in older adults.",
  "scgh-adult-open": "General acute psychiatric admissions for NMHS catchment with co-morbid acute medical complexity.",
  "scgh-older-adult": "Sub-acute geriatric mental health rehabilitation and severe BPSD management for older adults.",
  "fsh-adult-secure":
    "High-dependency acute assessment and psychiatric intensive care for southern metropolitan corridor.",
  "fsh-older-adult":
    "Specialised psychogeriatric assessment and dementia-related behavioural support for Rockingham-Kwinana.",
  "arm-adult-open":
    "Acute inpatient psychiatric care for south-east metropolitan catchment under WA Mental Health Act.",
  "sjgm-adult-open":
    "Eastern corridor acute adult admissions, emergency department liaison transfers, and crisis beds.",
  "rgh-adult-secure": "South-west metropolitan acute mental health admissions and emergency liaison transfers.",
  "fre-adult-open":
    "South-west coastal corridor acute psychiatric intake, multidisciplinary stabilisation, and crisis care.",
  "fre-older-adult": "Older adult acute psychogeriatric intake and behavioural management for Fremantle catchment.",
  "bty-adult-secure": "Secure high-dependency containment, crisis stabilisation, and psychiatric intensive nursing.",
  "bty-older-adult":
    "Older adult assessment, diagnostic workup, and community transition planning for Eastern Hills catchment.",
  "bty-youth": "Specialised youth early psychosis intervention and recovery program for young adults aged 16–24.",
  "gry-adult-secure": "Adults 18–64 requiring intensive psychiatric containment and high-dependency nursing.",
  "gry-older-adult":
    "Older adults 65+ experiencing acute neuropsychiatric decompensation, behavioural BPSD, or late-onset psychosis.",
  "alb-adult-open":
    "Regional adult psychiatric unit for Great Southern region with telemetry link to Perth State Bed Desk.",
  "bun-adult-open": "Regional high-dependency acute psychiatric intake and assessment for South West WA.",
  "brm-adult-secure":
    "Kimberley regional acute culturally-grounded mental health inpatient unit with RFDS coordination.",
  "ger-adult-open": "Midwest regional acute psychiatric intake, stabilisation, and crisis admissions.",
  "sjgs-adult-open":
    "Private adult voluntary inpatient stabilisation, mood disorder therapies, and anxiety treatment programs.",
  "sjgs-adult-secure": "Private secure high-dependency crisis stabilisation and psychiatric care.",
  // Legacy aliases for backward compatibility with mockups
  "armadale-adult":
    "Acute inpatient psychiatric care for south-east metropolitan catchment under WA Mental Health Act.",
  "midland-adult": "Eastern corridor acute adult admissions, emergency department liaison transfers, and crisis beds.",
  "fremantle-adult-open":
    "South-west coastal corridor acute psychiatric intake, multidisciplinary stabilisation, and crisis care.",
  "graylands-dorrington": "Adults 18–64 requiring intensive psychiatric containment and high-dependency nursing.",
};

const VOLUNTARY_ONLY_LABEL = "Voluntary only";
const CLMA_LABEL = "CLMA";

const COMMUNITY_ORDER_CODES = new Set(
  officialForms.filter((form) => form.category === "Community treatment orders").map((form) => form.code),
);

/**
 * The legal forms a ward holds, read from the unit rather than typed per ward.
 *
 * - A unit that is not authorised under the Mental Health Act holds voluntary patients only, so it
 *   lists no involuntary form at all.
 * - An authorised unit lists the codes the intake picker offers (`SELECTABLE_LEGAL_FORMS`), less
 *   any community treatment order: Form 5A is an order for treatment in the community, never an
 *   inpatient authority (`tests/ward-register-inpatient-form-codes.test.ts`).
 * - CLMA is listed only on an authorised forensic unit.
 *
 * The model records no finer per-unit authority, so every authorised unit shows the same codes.
 */
function wardFormsHeld(unit: Pick<Unit, "authorised" | "forensic">): string[] {
  if (!unit.authorised) return [VOLUNTARY_ONLY_LABEL];
  const forms = SELECTABLE_LEGAL_FORMS.filter((form) => !COMMUNITY_ORDER_CODES.has(form.code)).map(
    (form) => `Form ${form.code}`,
  );
  return unit.forensic ? [...forms, CLMA_LABEL] : forms;
}

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

/** Near full: the signed occupancy surge band (95%), as a fraction. */
const NEAR_FULL = CLINICAL_VALUES.occupancySurge.value / 100;
/* The one alert line (device audit, 11 Oct 2026): the rail's Bed alerts threshold, as on Home and
   Capacity. It was 90% here, so All wards drew a "90% line" against everyone else's 85%. */
const SERVICE_LINE = BED_ALERT_THRESHOLD_PERCENT / 100;

type WardRow = {
  unit: Unit;
  service: HealthService | null;
  siteName: string;
  siteShort: string;
  states: ReturnType<typeof bedStates>;
  occupancy: number;
  ready: number;
  /** Inside `ready`: released beds still being made ready. */
  pendingPreparation: number;
  out: number;
  incoming: number;
  confirmedAt: Instant;
  stale: boolean;
  specialling: number;
};

/** Preview only: a fork of `WardIndex` with one filter row and cards whose text wraps. */
export function AsBedManagerWards({ units: unitsOverride }: { units?: Unit[] }) {
  const {
    units: liveUnits,
    bedReleases,
    movements,
    admissions,
    leaveBeds,
  } = useWardFlowSelect("units", "bedReleases", "movements", "admissions", "leaveBeds");
  const units = unitsOverride ?? liveUnits;
  // ROLE BRANCH (bed_manager, D-80): a site bed manager's hero, checks and first cards are its own
  // site's wards. Every other site stays on the page as bed counts only: no Enter, no stays link,
  // because its ward pages are not this desk's to open.
  const access = useEffectiveWardAccess();
  const siteCode = access.role === "bed_manager" && access.scope.kind === "site" ? access.scope.siteCode : undefined;
  const deskSite = siteCode === undefined ? undefined : siteByCode(siteCode);
  const isOwn = (unit: Unit) => siteCode === undefined || unit.siteCode === siteCode;
  const { now, paused, togglePause } = usePageLive();

  const [pickedService, setPickedService] = useState<ServiceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [cohort, setCohort] = useState<CohortFilter>("all");
  const [order, setOrder] = useState<OrderBy>("service");
  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Phone (v10): one list of wards; a tap opens the ward's card as a bottom sheet.
  const isPhone = useIsPhone();
  // shell-15 (Josh, 13 Oct 2026): on a phone the header's service is the one service control, so
  // the page follows it and draws no region chips of its own. Desktop keeps its own chips.
  const headerService = useServiceScope();
  const service: ServiceFilter = isPhone ? (headerService ?? "all") : pickedService;
  const setService = (next: ServiceFilter) => {
    if (isPhone) setServiceScope(next === "all" ? null : next);
    else setPickedService(next);
  };
  const [phoneWardId, setPhoneWardId] = useState<string | null>(null);
  const [phoneRailOpen, setPhoneRailOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!areCharacterShortcutsEnabled() || event.key !== "/" || event.defaultPrevented) return;
      if (hasOpenSheet() || document.querySelector('[aria-modal="true"]')) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
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
          // Occupied or Pulled: the one occupancy count (`ward-occupancy.ts`).
          occupancy: unit.beds > 0 ? wardBedsInUse(unit, admissions, bedReleases) / unit.beds : 0,
          ready: states.ready,
          pendingPreparation: bedsPendingPreparation(unit.id, bedReleases),
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

  // Statewide hero counts. ROLE BRANCH (bed_manager): the site's own wards only.
  const heroRows = siteCode === undefined ? rows : rows.filter((row) => isOwn(row.unit));
  const heroUnits = siteCode === undefined ? units : units.filter(isOwn);
  const totalBeds = heroRows.reduce((sum, row) => sum + row.unit.beds, 0);
  const totalOccupied = heroRows.reduce((sum, row) => sum + Math.round(row.occupancy * row.unit.beds), 0);
  const readyNow = heroRows.reduce((sum, row) => sum + row.ready, 0);
  const shiftEnd = shiftEndInstant(now);
  const freeingByShiftEnd = bedReleases.filter(
    (release) =>
      release.state !== "discharged" &&
      release.expectedAt <= shiftEnd &&
      heroUnits.some((unit) => unit.id === release.unitId),
  ).length;
  const pulled = heroRows.reduce((sum, row) => sum + row.states.pulled, 0);
  const staleCount = heroRows.filter((row) => row.stale).length;

  const matchesQuery = (row: WardRow) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.unit.name, row.siteName, row.unit.cohort, row.service ?? ""].some((text) =>
      text.toLowerCase().includes(q),
    );
  };

  // v10 rule: these filters highlight the wards they match and dim the rest by colour. No ward is
  // hidden, so the cards keep their places and every Enter stays reachable. Counts for each control
  // follow the other filters, so a count says how many wards that choice would highlight.
  const byService = (row: WardRow) => service === "all" || row.service === service;
  const byStatus = (row: WardRow) =>
    status === "all" ||
    (status === "has-ready" && row.ready > 0) ||
    (status === "full" && row.ready === 0) ||
    (status === "stale" && row.stale);
  const byCohort = (row: WardRow) => cohort === "all" || cohortKey(row.unit) === cohort;
  const isLit = (row: WardRow) => byService(row) && byStatus(row) && byCohort(row) && matchesQuery(row);

  const lit = placed.filter(isLit);
  const serviceRank = (row: WardRow) => wardServiceOrder.indexOf(row.service as HealthService);
  const ordered = [...placed].sort((a, b) => {
    if (order === "most-ready") return b.ready - a.ready || serviceRank(a) - serviceRank(b);
    if (order === "fullest") return b.occupancy - a.occupancy || serviceRank(a) - serviceRank(b);
    return serviceRank(a) - serviceRank(b);
  });

  const isFiltered = service !== "all" || status !== "all" || cohort !== "all" || query !== "";
  const resetFilters = () => {
    setPickedService("all");
    setStatus("all");
    setCohort("all");
    setQuery("");
  };

  const otherFilters = (row: WardRow) => byStatus(row) && byCohort(row) && matchesQuery(row);
  const serviceItems = [
    { id: "all" as ServiceFilter, label: "All", count: placed.filter(otherFilters).length },
    ...services.map((group) => ({
      id: group.name as ServiceFilter,
      label: serviceShortName(group.name),
      count: group.rows.filter(otherFilters).length,
    })),
  ];

  // Occupancy by service, one shared capacity row each, drawn from the same bed states as the cards.
  const serviceRows = services.map((group) => {
    const sum = (pick: (row: WardRow) => number) => group.rows.reduce((total, row) => total + pick(row), 0);
    const beds = sum((row) => row.unit.beds);
    const occupied = sum((row) => Math.round(row.occupancy * row.unit.beds));
    return {
      id: group.name,
      name: group.name,
      wards: group.rows.length,
      ready: sum((row) => row.ready),
      percent: beds > 0 ? (occupied / beds) * 100 : null,
      segments: [
        { id: "occupied", value: sum((row) => row.states.occupied), fill: "data-1" as const, label: "Occupied" },
        { id: "ready", value: sum((row) => row.ready), fill: "ready" as const, label: "Ready" },
        { id: "pulled", value: sum((row) => row.states.pulled), fill: "data-2" as const, hatch: true, label: "Pulled" },
        { id: "closed", value: sum((row) => row.states.closed), fill: "closed" as const, label: "Closed" },
      ],
    };
  });

  const heroPlaced = placed.filter((row) => isOwn(row.unit));
  const nearFullCount = heroPlaced.filter((row) => row.occupancy >= NEAR_FULL).length;
  const noReadyCount = heroPlaced.filter((row) => row.ready === 0).length;
  const staleRows = [...heroRows.filter((row) => row.stale)].sort((a, b) => a.confirmedAt - b.confirmedAt);
  const mostReady = [...heroPlaced].sort((a, b) => b.ready - a.ready || a.unit.name.localeCompare(b.unit.name))[0];
  const statewidePercent = totalBeds > 0 ? (totalOccupied / totalBeds) * 100 : null;
  const [filtersOpen, setFiltersOpen] = useState(false);
  // ROLE BRANCH (bed_manager): own site first, then the rest as counts, folded after a few cards.
  const [otherOpen, setOtherOpen] = useState(false);
  const ownOrdered = ordered.filter((row) => isOwn(row.unit));
  const otherOrdered = ordered.filter((row) => !isOwn(row.unit));
  const otherShown = otherOpen || isFiltered ? otherOrdered : otherOrdered.slice(0, OTHER_SITE_CARDS);

  // The statewide rail. Phone (v10) opens it as a sheet from one link row under the list.
  const rail = (
    <aside className={styles.rail} data-wf-rail="1121" aria-label="Statewide by service">
      <Card as="section" className={styles.railCard} aria-labelledby="ward-service-occupancy">
        <div className={styles.serviceHead}>
          <h2 id="ward-service-occupancy" className={styles.railTitle}>
            Occupancy by service
          </h2>
          <span className={styles.serviceMeta}>line {SERVICE_LINE * 100}%</span>
        </div>
        <WardCapacityRows label="Occupancy by service">
          {serviceRows.map((entry) => (
            <WardCapacityRow
              key={entry.id}
              name={serviceShortName(entry.name)}
              meta={`${entry.ready} ready`}
              segments={entry.segments}
              percent={entry.percent}
              alertAt={SERVICE_LINE * 100}
              selected={service === entry.id}
              dim={service !== "all" && service !== entry.id}
              onSelect={() => setService(service === entry.id ? "all" : (entry.id as ServiceFilter))}
              actionLabel={`Highlight ${entry.name} wards`}
              className={styles.serviceCapRow}
            />
          ))}
        </WardCapacityRows>
        <p className={styles.railNote}>Press a service to highlight its wards.</p>
      </Card>

      <Card as="section" className={styles.railCard} aria-labelledby="ward-counts-to-check">
        <div className={styles.serviceHead}>
          <h2 id="ward-counts-to-check" className={styles.railTitle}>
            Counts to check <Count n={staleRows.length} />
          </h2>
          <span className={styles.serviceMeta}>
            {deskSite ? `${deskSite.name}, past each ward's limit` : "past each ward's limit"}
          </span>
        </div>
        {staleRows.length === 0 ? (
          <p className={styles.railNote}>0 wards have a stale bed count.</p>
        ) : (
          <ul className={styles.checkList}>
            {staleRows.map((row) => (
              <li key={row.unit.id}>
                <StatusGlyph tone="warning" size={9} />
                <Link className={styles.checkName} href={`/ward-flow/ward/${row.unit.id}`}>
                  {row.unit.name}
                </Link>
                <span className={styles.checkAge}>
                  <b className={styles.num}>{durMinutes(Math.max(0, now - row.confirmedAt))}</b> stale
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  );

  return (
    <div
      className={styles.screen}
      data-testid="ward-index"
      data-ward-design="v10"
      data-ward-rebuilt-screen="wards-index"
    >
      <main id="main-content" className={`${styles.main} ${redesign.page}`}>
        <Hero
          eyebrow={
            isPhone
              ? `Wards · ${deskSite?.name ?? "Statewide"}`
              : `Wards · ${deskSite?.name ?? "Statewide"} · ${heroUnits.length} wards, ${totalBeds} beds`
          }
          level={1}
          title={
            <>
              <SrOnly>{"All wards, "}</SrOnly>
              {`${readyNow} ${readyNow === 1 ? "bed" : "beds"} ready${isPhone ? "" : " now"}`}
            </>
          }
          titleMeta={
            isPhone
              ? `${heroUnits.length} wards · ${statewidePercent === null ? "share in use not recorded" : `${statewidePercent.toFixed(1)}% in use`} · ${pulled} pulled`
              : undefined
          }
          stats={
            isPhone ? (
              <>
                <HeroStat
                  value={noReadyCount}
                  label="No bed ready"
                  tone={noReadyCount > 0 ? "warning" : undefined}
                  pressed={status === "full"}
                  onToggle={() => setStatus(status === "full" ? "all" : "full")}
                />
                <HeroStat
                  value={readyNow + freeingByShiftEnd}
                  label={`By ${formatInstantWithDay(shiftEnd, now)}`}
                  tone="info"
                />
                <HeroStat
                  value={staleCount}
                  label="Stale counts"
                  tone={staleCount > 0 ? "warning" : undefined}
                  pressed={status === "stale"}
                  onToggle={() => setStatus(status === "stale" ? "all" : "stale")}
                />
              </>
            ) : undefined
          }
          lead={
            isPhone ? undefined : (
              <OccupancyRing
                percent={statewidePercent}
                alertAt={SERVICE_LINE * 100}
                scope={deskSite?.name ?? "Statewide"}
              />
            )
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
          bar={
            isPhone ? undefined : (
              <div
                className={styles.heroChips}
                role="group"
                aria-label={deskSite ? `${deskSite.name} counts` : "Statewide counts"}
              >
                <HeroStat
                  inline
                  value={readyNow}
                  label="Ready now"
                  tone="success"
                  pressed={status === "has-ready"}
                  onToggle={() => setStatus(status === "has-ready" ? "all" : "has-ready")}
                />
                <HeroStat
                  inline
                  value={readyNow + freeingByShiftEnd}
                  label={`Ready by ${formatInstantWithDay(shiftEnd, now)}`}
                />
                <HeroStat inline value={pulled} label="Pulled" />
                <HeroStat
                  inline
                  value={staleCount}
                  label="Stale counts"
                  tone={staleCount > 0 ? "warning" : undefined}
                  pressed={status === "stale"}
                  onToggle={() => setStatus(status === "stale" ? "all" : "stale")}
                />
              </div>
            )
          }
          barAside={
            !isPhone && mostReady && mostReady.ready > 0 ? (
              <Link
                className={styles.heroJump}
                href={`/ward-flow/ward/${mostReady.unit.id}`}
                aria-label={`Most ready: ${mostReady.unit.name}, ${mostReady.ready} ready. Open the ward.`}
              >
                <span className={styles.heroJumpLabel}>Most ready</span>
                <span className={styles.heroJumpName}>{mostReady.unit.name}</span>
                <b className={styles.heroJumpValue}>{mostReady.ready}</b>
              </Link>
            ) : null
          }
          foot={
            isPhone ? undefined : (
              <CheckingFoot
                items={[
                  {
                    id: "stale",
                    label: "Stale bed counts",
                    value: staleCount,
                    tone: staleCount > 0 ? "warning" : undefined,
                  },
                  {
                    id: "near-full",
                    label: `Near full, ${NEAR_FULL * 100}% and over`,
                    value: nearFullCount,
                    tone: nearFullCount > 0 ? "warning" : undefined,
                  },
                ]}
                notChecked={["staffed versus funded beds, no feed"]}
              />
            )
          }
        />

        <section className={styles.filters} aria-label="Ward filters">
          <div className={styles.filterRow}>
            {isPhone ? null : (
              <Segmented label="Health service" items={serviceItems} value={service} onChange={setService} size="md" />
            )}
            {/* Redesign: Status, Cohort and Order as three menus on this one row, not two more rows. */}
            {isPhone ? null : (
              <>
                <Select
                  aria-label="Status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as StatusFilter)}
                  boxClassName={redesign.menu}
                >
                  <option value="all">Any status</option>
                  <option value="has-ready">Has ready</option>
                  <option value="full">Full</option>
                  <option value="stale">Stale count</option>
                </Select>
                <Select
                  aria-label="Cohort"
                  value={cohort}
                  onChange={(event) => setCohort(event.target.value as CohortFilter)}
                  boxClassName={redesign.menu}
                >
                  <option value="all">Any cohort</option>
                  <option value="adult">Adult</option>
                  <option value="older-adult">Older adult</option>
                  <option value="youth">Youth</option>
                  <option value="perinatal">Perinatal</option>
                </Select>
                <Select
                  aria-label="Order"
                  value={order}
                  onChange={(event) => setOrder(event.target.value as OrderBy)}
                  boxClassName={redesign.menu}
                >
                  <option value="service">By service</option>
                  <option value="most-ready">Most ready first</option>
                  <option value="fullest">Fullest first</option>
                </Select>
              </>
            )}
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
              trailing={query || isPhone ? undefined : <Kbd>/</Kbd>}
              autoComplete="off"
              spellCheck={false}
              boxClassName={`${styles.search} ${redesign.search}`}
            />
            {isPhone ? null : (
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
            )}
            <button
              type="button"
              className={styles.filtersToggle}
              aria-expanded={filtersOpen}
              aria-controls="ward-index-more-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Icon icon={SlidersHorizontal} size={16} />
              Filters
              {status !== "all" || cohort !== "all" ? (
                <CountCircle n={(status !== "all" ? 1 : 0) + (cohort !== "all" ? 1 : 0)} />
              ) : null}
            </button>
          </div>
          <div
            className={`${styles.filterRow} ${redesign.phoneOnly}`}
            id="ward-index-more-filters"
            data-open={filtersOpen ? "true" : undefined}
          >
            <span className={styles.filterGroup}>
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
            </span>
            <span className={styles.filterGroup}>
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
            </span>
            <span className={styles.filterGroup}>
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
            </span>
          </div>
          {/* Audit 11 Oct 2026: the bed strip key is one line under the filters, not a rail card. */}
          <div className={redesign.keyRow}>
            {isPhone ? null : (
              <div className={styles.legendLine} aria-label="Reading a ward" role="note">
                <BedStripLegend />
                <span>One cell a bed.</span>
              </div>
            )}
            <p className={styles.shownCount} data-testid="ward-index-count-note">
              {isPhone ? <b className={styles.phoneListTitle}>Every ward</b> : null}
              {isFiltered ? (
                <>
                  <span>
                    <b className={styles.num}>{lit.length}</b> of <b className={styles.num}>{placed.length}</b> wards
                    highlighted. All wards stay.
                  </span>
                  {lit.length === 0 ? <span>No match.</span> : null}
                  {/* On a phone the service is the header's own choice, so Reset never offers to undo it. */}
                  {isPhone && status === "all" && cohort === "all" && query === "" ? null : (
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  )}
                </>
              ) : isPhone ? null : (
                // shell-15: the phone shows no "22 of 22" while nothing is filtered.
                <span>
                  <b className={styles.num}>{placed.length}</b> of <b className={styles.num}>{placed.length}</b> wards
                </span>
              )}
            </p>
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

        <div className={styles.layout}>
          <div className={styles.wardsColumn}>
            {placed.length === 0 ? (
              <Card className={styles.emptyCard}>
                <EmptyState icon={Search} title="No wards recorded" meta="The network has no placed wards." />
              </Card>
            ) : isPhone && deskSite ? (
              <>
                <SiteHead title={deskSite.name} meta={`${ownOrdered.length} wards`} />
                <WardPhoneList
                  rows={ownOrdered}
                  now={now}
                  grouped={false}
                  isDim={(row) => isFiltered && !isLit(row)}
                  onOpen={(row) => setPhoneWardId(row.unit.id)}
                />
                <SiteHead title="Other sites" meta="Bed counts only" />
                <WardPhoneList
                  rows={otherShown}
                  now={now}
                  countsOnly
                  grouped={order === "service"}
                  isDim={(row) => isFiltered && !isLit(row)}
                  onOpen={(row) => setPhoneWardId(row.unit.id)}
                />
                <OtherSitesMore
                  shown={otherShown.length}
                  total={otherOrdered.length}
                  open={otherOpen}
                  onToggle={() => setOtherOpen((value) => !value)}
                />
              </>
            ) : isPhone ? (
              <WardPhoneList
                rows={ordered}
                now={now}
                grouped={order === "service"}
                isDim={(row) => isFiltered && !isLit(row)}
                onOpen={(row) => setPhoneWardId(row.unit.id)}
              />
            ) : view === "cards" && deskSite ? (
              <>
                <SiteHead title={deskSite.name} meta={`${ownOrdered.length} wards, ${totalBeds} beds`} />
                <section className={styles.cardGrid} aria-label={`${deskSite.name} ward cards`}>
                  {ownOrdered.map((row) => (
                    <WardCard key={row.unit.id} row={row} now={now} dim={isFiltered && !isLit(row)} />
                  ))}
                </section>
                <SiteHead
                  title="Other sites"
                  meta={`Bed counts only · ${otherOrdered.length} wards, ${otherOrdered.reduce((sum, row) => sum + row.ready, 0)} ready`}
                />
                <section className={styles.cardGrid} aria-label="Other sites, bed counts">
                  {otherShown.map((row) => (
                    <WardCard key={row.unit.id} row={row} now={now} dim={isFiltered && !isLit(row)} countsOnly />
                  ))}
                </section>
                <OtherSitesMore
                  shown={otherShown.length}
                  total={otherOrdered.length}
                  open={otherOpen}
                  onToggle={() => setOtherOpen((value) => !value)}
                />
              </>
            ) : view === "cards" ? (
              <section className={styles.cardGrid} aria-label="Ward cards">
                {ordered.map((row) => (
                  <WardCard key={row.unit.id} row={row} now={now} dim={isFiltered && !isLit(row)} />
                ))}
              </section>
            ) : (
              <WardTable
                rows={deskSite ? [...ownOrdered, ...otherOrdered] : ordered}
                now={now}
                isDim={(row) => isFiltered && !isLit(row)}
                countsOnly={(row) => !isOwn(row.unit)}
              />
            )}
          </div>

          {isPhone ? (
            <button
              type="button"
              className={styles.phoneRailLink}
              aria-haspopup="dialog"
              onClick={() => setPhoneRailOpen(true)}
            >
              <span className={styles.phoneRailLinkText}>
                <b>Occupancy by service</b>
                <span>Bars against the {SERVICE_LINE * 100}% line, with ready beds</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : null}
          {isPhone ? (
            <PhoneSheet
              open={phoneRailOpen}
              onClose={() => setPhoneRailOpen(false)}
              title="Occupancy by service"
              description={`Bars against the ${SERVICE_LINE * 100}% line, with ready beds`}
              className={styles.phoneRailSheet}
            >
              {rail}
            </PhoneSheet>
          ) : (
            rail
          )}
        </div>

        {unplaced.length > 0 ? (
          <section id="wards-unplaced" className={styles.unplaced} data-testid="ward-index-unplaced">
            <h3 className={styles.eyebrow}>Not placed in a health service</h3>
            <ul className={styles.unplacedList}>
              {unplaced.map((row) => (
                <li key={row.unit.id}>
                  <Link
                    className={styles.unplacedLink}
                    href={`/ward-flow/ward/${row.unit.id}`}
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

        {isPhone ? (
          <WardPhoneSheet
            row={rows.find((row) => row.unit.id === phoneWardId)}
            now={now}
            onClose={() => setPhoneWardId(null)}
            countsOnly={phoneWardId !== null && !rows.some((row) => row.unit.id === phoneWardId && isOwn(row.unit))}
          />
        ) : null}

        <WardPrototypeFooter
          testId="ward-index-governance"
          note="Synthetic prototype. Invented figures under real WA hospital names. Lists update once a minute."
        />
      </main>
    </div>
  );
}

/** ROLE BRANCH (bed_manager): other-site cards shown before "Show all". */
const OTHER_SITE_CARDS = 6;

/** ROLE BRANCH (bed_manager): the heading over the desk's own site and over the other sites. */
function SiteHead({ title, meta }: { title: string; meta: string }) {
  return (
    <h2 className={siteStyles.siteHead}>
      <span className={siteStyles.siteTitle}>{title}</span>
      <span className={siteStyles.siteMeta}>{meta}</span>
    </h2>
  );
}

/** ROLE BRANCH (bed_manager): Show all or fewer of the other sites' wards. */
function OtherSitesMore({
  shown,
  total,
  open,
  onToggle,
}: {
  shown: number;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  if (total <= OTHER_SITE_CARDS) return null;
  if (!open && shown >= total) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded={open} className={siteStyles.more}>
      {open ? "Show fewer other sites" : `Show all ${total} wards at other sites`}
    </Button>
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

function Confirmed({ row, now, countsOnly = false }: { row: WardRow; now: Instant; countsOnly?: boolean }) {
  const age = durMinutes(Math.max(0, now - row.confirmedAt));
  return row.stale ? (
    <span className={styles.confirmed}>
      <StatusGlyph tone="warning" size={8} />
      {/* ROLE BRANCH (bed_manager): another site's count is its own ward's to chase, not this desk's. */}
      <b className={styles.num}>{age}</b> {countsOnly ? "stale" : "stale, ask NUM"}
    </span>
  ) : (
    <span className={styles.confirmed}>
      <b className={styles.num}>{age}</b> since confirmed
    </span>
  );
}

function WardCard({
  row,
  now,
  dim = false,
  countsOnly = false,
}: {
  row: WardRow;
  now: Instant;
  dim?: boolean;
  /** ROLE BRANCH (bed_manager): another site's ward, drawn as bed counts with no way in. */
  countsOnly?: boolean;
}) {
  const { unit } = row;
  return (
    <article
      className={styles.wardCard}
      data-dim={dim ? "true" : undefined}
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
      <BedStrip
        counts={{ ...row.states, pendingPreparation: row.pendingPreparation }}
        wardName={unit.name}
        className={styles.strip}
      />
      <div className={styles.figures}>
        <OccupancyFigure row={row} />
        {/* ROLE BRANCH (bed_manager): out and in are read from people records a site desk is not
            given for other sites, so they would read 0. Its counts-only cards show beds alone. */}
        {countsOnly ? (
          <span className={styles.flow}>
            <b className={styles.num}>{row.ready}</b> ready <span aria-hidden="true">·</span>{" "}
            <b className={styles.num}>{row.unit.beds}</b> beds
          </span>
        ) : (
          <span className={styles.flow}>
            <b className={styles.num}>{row.ready}</b> ready <span aria-hidden="true">·</span>{" "}
            <b className={styles.num}>{row.out}</b> out <span aria-hidden="true">·</span>{" "}
            <b className={styles.num}>{row.incoming}</b> in
          </span>
        )}
      </div>
      <div className={styles.cardFoot}>
        <Confirmed row={row} now={now} countsOnly={countsOnly} />
        <WardProfile row={row} countsOnly={countsOnly} />
        {/* Audit 11 Oct 2026: the whole card is the Enter target, so 22 repeated buttons go. */}
        {countsOnly ? null : (
          <Link
            className={styles.cardLink}
            href={`/ward-flow/ward/${unit.id}`}
            data-testid={`ward-index-link-${unit.id}`}
            aria-label={`Enter ${unit.name}`}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

function WardProfile({ row, countsOnly = false }: { row: WardRow; countsOnly?: boolean }) {
  const { unit } = row;
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
      {(close) => <WardProfileBody row={row} close={close} inSheet={countsOnly} />}
    </Popover>
  );
}

function WardProfileBody({
  row,
  close,
  inSheet = false,
}: {
  row: WardRow;
  close?: (options?: { restoreFocus?: boolean }) => void;
  /** In the phone sheet, whose footer already holds Enter ward. */
  inSheet?: boolean;
}) {
  const { unit } = row;
  const admits = WARD_ADMITS[unit.id];
  const forms = wardFormsHeld(unit);
  return (
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
          <dt>Observation staff in use</dt>
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
        {row.pendingPreparation > 0 ? (
          <>
            <dt>Being made ready</dt>
            <dd>{row.pendingPreparation} of the ready beds</dd>
          </>
        ) : null}
        {admits ? (
          <>
            <dt>Admits</dt>
            <dd>{admits}</dd>
          </>
        ) : null}
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
      {inSheet ? null : (
        <div className={styles.profileFoot}>
          <Link
            className={buttonClass({ variant: "sec", size: "sm" })}
            href={`/ward-flow/board/${unit.id}`}
            onClick={() => close?.({ restoreFocus: false })}
          >
            Stays and discharges
          </Link>
          <Link
            className={buttonClass({ variant: "pri", size: "sm" })}
            href={`/ward-flow/ward/${unit.id}`}
            onClick={() => close?.({ restoreFocus: false })}
          >
            Enter ward
          </Link>
        </div>
      )}
    </div>
  );
}

/** Phone: every ward as a two line row grouped by service, with its ready figure and occupancy. */
function WardPhoneList({
  rows,
  now,
  grouped,
  isDim,
  onOpen,
  countsOnly = false,
}: {
  rows: WardRow[];
  now: Instant;
  /** ROLE BRANCH (bed_manager): other sites' wards, whose stale counts are not this desk's to chase. */
  countsOnly?: boolean;
  grouped: boolean;
  isDim: (row: WardRow) => boolean;
  onOpen: (row: WardRow) => void;
}) {
  const groups: { key: string; label: string | null; rows: WardRow[] }[] = [];
  for (const row of rows) {
    const key = grouped ? (row.service ?? "none") : "all";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, label: grouped ? (row.service ?? "Not placed") : null, rows: [row] });
  }
  return (
    <section className={styles.phoneList} aria-label="Wards">
      {groups.map((group) => {
        const beds = group.rows.reduce((sum, row) => sum + row.unit.beds, 0);
        const occupied = group.rows.reduce((sum, row) => sum + Math.round(row.occupancy * row.unit.beds), 0);
        return (
          <div key={group.key} className={styles.phoneGroup}>
            {group.label ? (
              <h3 className={styles.phoneGroupHead}>
                <span className={styles.phoneGroupDot} data-service={group.key} aria-hidden="true" />
                <span>{group.label}</span>
                <span className={styles.phoneGroupShare}>
                  {beds > 0 ? `${((occupied / beds) * 100).toFixed(1)}%` : ""}
                </span>
              </h3>
            ) : null}
            <ul className={styles.phoneRows}>
              {group.rows.map((row) => {
                const pct = Math.round(row.occupancy * 100);
                const nearFull = row.occupancy >= NEAR_FULL;
                return (
                  <li key={row.unit.id}>
                    <button
                      type="button"
                      className={styles.phoneRow}
                      data-dim={isDim(row) ? "true" : undefined}
                      aria-haspopup="dialog"
                      onClick={() => onOpen(row)}
                    >
                      <span className={styles.phoneRowText}>
                        <span className={styles.phoneRowName}>{row.unit.name}</span>
                        <span className={styles.phoneRowSub}>
                          {row.stale ? (
                            <>
                              <StatusGlyph tone="warning" size={8} />
                              <span>
                                Count {durMinutes(Math.max(0, now - row.confirmedAt))} old
                                {countsOnly ? "" : ", ask the ward"}
                              </span>
                            </>
                          ) : (
                            <>
                              {unitHasLockedBeds(row.unit) ? (
                                <Icon icon={Lock} size={14} className={styles.phoneRowLock} />
                              ) : null}
                              <span>
                                {row.siteShort} · {cohortLabel(row.unit)} · {wardCategory(row.unit)}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className={styles.phoneRowFigures}>
                        <span className={styles.phoneRowReady}>
                          {row.ready > 0 ? <StatusGlyph tone="success" size={9} /> : null}
                          <b className={styles.num}>{row.ready}</b> ready
                        </span>
                        <span className={styles.phoneRowShare}>
                          {nearFull ? <StatusGlyph tone="warning" size={8} /> : null}
                          {pct}% in use
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {/* Phone review F-25: the amber dot marks two things here, so the key names both. */}
      <p className={styles.phoneDotKey} data-testid="ward-index-phone-dot-key">
        <StatusGlyph tone="warning" size={8} />
        <span>{`Amber dot: ${NEAR_FULL * 100}% or more in use, or a bed count not confirmed in time`}</span>
      </p>
    </section>
  );
}

/** Phone: the ward's card as a bottom sheet, with Enter ward in the footer. */
function WardPhoneSheet({
  row,
  now,
  onClose,
  countsOnly = false,
}: {
  row: WardRow | undefined;
  now: Instant;
  onClose: () => void;
  /** ROLE BRANCH (bed_manager): another site's ward, with no Enter or stays action. */
  countsOnly?: boolean;
}) {
  // The router is read here, not in the index: this sheet mounts only on phone, so the index
  // still renders where no app router is mounted (unit tests).
  const router = useRouter();
  if (!row) return null;
  return (
    <PhoneSheet
      open
      onClose={onClose}
      title={row.unit.name}
      description={`${row.service ?? "Not placed"} · ${row.siteShort} · ${cohortLabel(row.unit)}`}
      secondary={
        countsOnly
          ? undefined
          : { label: "Stays and discharges", onAction: () => router.push(`/ward-flow/board/${row.unit.id}`) }
      }
      primary={
        countsOnly ? undefined : { label: "Enter ward", onAction: () => router.push(`/ward-flow/ward/${row.unit.id}`) }
      }
      className={styles.phoneSheet}
      data-testid="ward-index-phone-sheet"
    >
      <BedStrip
        counts={{ ...row.states, pendingPreparation: row.pendingPreparation }}
        wardName={row.unit.name}
        className={styles.strip}
      />
      <dl className={styles.phoneSheetFigures}>
        <div>
          <dt>Occupied</dt>
          <dd>{Math.round(row.occupancy * 100)}%</dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd>{row.ready}</dd>
        </div>
        {countsOnly ? (
          <div>
            <dt>Beds</dt>
            <dd>{row.unit.beds}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt>Out today</dt>
              <dd>{row.out}</dd>
            </div>
            <div>
              <dt>Coming in</dt>
              <dd>{row.incoming}</dd>
            </div>
          </>
        )}
      </dl>
      <p className={styles.phoneSheetConfirmed}>
        <Confirmed row={row} now={now} countsOnly={countsOnly} />
      </p>
      <WardProfileBody row={row} inSheet />
    </PhoneSheet>
  );
}

const TABLE_COLUMNS = "minmax(200px, 2.2fr) 100px 80px minmax(120px, 1.4fr) 76px 56px 64px 92px 72px";

function WardTable({
  rows,
  now,
  isDim,
  countsOnly,
}: {
  rows: WardRow[];
  now: Instant;
  isDim: (row: WardRow) => boolean;
  /** ROLE BRANCH (bed_manager): rows for another site's ward, with no Enter. */
  countsOnly: (row: WardRow) => boolean;
}) {
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
            <div
              role="row"
              key={row.unit.id}
              className={styles.tr}
              style={{ gridTemplateColumns: TABLE_COLUMNS }}
              data-dim={isDim(row) ? "true" : undefined}
            >
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
                <BedStrip
                  counts={{ ...row.states, pendingPreparation: row.pendingPreparation }}
                  wardName={row.unit.name}
                />
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
                {countsOnly(row) ? (
                  <span className={siteStyles.countsOnly}>Not shown</span>
                ) : (
                  `${row.out}, ${row.incoming}`
                )}
              </span>
              <span role="cell" className={styles.num}>
                {row.stale ? <StatusGlyph tone="warning" size={8} /> : null}{" "}
                {durMinutes(Math.max(0, now - row.confirmedAt))}
              </span>
              <span role="cell" className={styles.end}>
                {countsOnly(row) ? (
                  <span className={siteStyles.countsOnly}>Counts only</span>
                ) : (
                  <Link
                    className={buttonClass({ variant: "sec", size: "sm" })}
                    href={`/ward-flow/ward/${row.unit.id}`}
                    data-testid={`ward-index-link-${row.unit.id}`}
                    aria-label={`Enter ${row.unit.name}`}
                  >
                    Enter
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
