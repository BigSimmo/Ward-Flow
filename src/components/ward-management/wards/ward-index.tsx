"use client";

import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { setServiceScope, useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BedSingle, ChevronRight, Circle, Lock, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  AppliedFilter,
  Button,
  Card,
  Count,
  EmptyState,
  Hero,
  HeroBand,
  HeroFigures,
  HeroPill,
  HeroQuickChips,
  HeroTop,
  Icon,
  Kbd,
  PhoneSheet,
  ScrollRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  WardCapacityRow,
  WardCapacityRows,
  buttonClass,
  cx,
  durMinutes,
  folderTabClasses,
  useIsPhone,
  useOptionalToast,
} from "@/components/wf";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates, networkNamedHolds } from "@/components/ward-management/ward-bed-states";
import { releasesExpectedToFree } from "@/components/ward-management/ward-shared-figures";
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
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { BedStrip, BedStripLegend } from "@/components/ward-management/wards/bed-strip";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";

import styles from "./ward-index.module.css";
import { WardIndexDrawer } from "./ward-index-drawer";
import { OtherSitesMore, SiteHead, otherSitesFolded } from "./ward-index-site-desk";
import { WardIndexTabs } from "./ward-index-tabs";
import pageTop from "@/components/ward-management/page-top-title.module.css";

/**
 * All wards (v10). One hero band with the ready-bed answer, the statewide occupancy ring and the
 * Checking foot; one filter card (service, search, cards or table; status, cohort, order) whose
 * choices highlight wards and dim the rest, never hide them; then every ward as a card or a table
 * row beside a sticky rail with occupancy by service (shared `WardCapacityRow`). Every figure
 * is read from the provider: bed states from `bedStates`, discharges from `capacityBreakdown`,
 * confirmation age from the ward's own allocatable figure.
 *
 * Redesign (approved by Josh, 3 Nov 2026, WS1 and WS2): one tidy filter row (service, search,
 * Filters, Cards or Table); Status, Cohort and Order sit behind Filters as kit choices, never
 * browser menus. A ward card opens the ward's side panel (`ward-index-drawer.tsx`, Capacity's own
 * ward panel), with Open ward at the card's foot. Card text and ward names wrap. A site bed manager's desk (D-80) sees its own site's wards in full, then every other
 * site as bed counts only (`ward-index-site-desk.tsx`).
 */

/**
 * D-170 item 7 and check pack E1 (Josh, 13 Nov 2026): the ward profile carries no "Admits" lines
 * and no "Forms held" row. The "Admits" sentences were invented and sat under real ward names; they
 * come back only when a service supplies its own words, with a source and date. "Forms held" gave
 * every authorised ward the same list from one yes/no flag, with a forensic chip; both are gone.
 * `tests/ward-fix-D-ward-profile.dom.test.tsx` keeps them out.
 */

export type ServiceFilter = "all" | HealthService;
type StatusFilter = "all" | "has-ready" | "full" | "stale";
type CohortFilter = "all" | "adult" | "older-adult" | "youth" | "perinatal";
// D-126 (10 Nov 2026): neutral orders only; no "Most ready" or "Fullest" ranking of wards.
type OrderBy = "service" | "a-z";

const STATUS_LABELS: Record<Exclude<StatusFilter, "all">, string> = {
  "has-ready": "Has a ready bed",
  full: "Full",
  stale: "Stale count",
};

const COHORT_LABELS: Record<Exclude<CohortFilter, "all">, string> = {
  adult: "Adult",
  "older-adult": "Older adult",
  youth: "Youth",
  perinatal: "Perinatal",
};
export type ViewMode = "cards" | "table";

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
    <span className={styles.acuityBadge} data-category={category} title={designationSummary(unit)}>
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

export function WardIndex({ units: unitsOverride }: { units?: Unit[] }) {
  const {
    units: liveUnits,
    bedReleases,
    movements,
    admissions,
    leaveBeds,
    referrals,
  } = useWardFlowSelect("units", "bedReleases", "movements", "admissions", "leaveBeds", "referrals");
  const units = unitsOverride ?? liveUnits;
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  const raise = useWardRaise("coordinator");
  const toast = useOptionalToast();
  const refreshSave = useWardFormSave(`ward-index-refresh:${worldGeneration}`);
  useEffect(() => {
    if (refreshSave.error) toast?.push({ tone: "warning", title: refreshSave.error });
  }, [refreshSave.error, toast]);
  // Site bed manager (D-80): a site bed manager's hero, checks and first cards are its own
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  // WS1: the ward whose side panel is open (desktop and tablet; the phone keeps its sheet).
  const [drawerWardId, setDrawerWardId] = useState<string | null>(null);
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
      // The search sits behind Filters (page tops): open it first, so the field shows before it takes focus.
      flushSync(() => setFiltersOpen(true));
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // A16-25 (3.4): a bed named for an incoming patient is held here as on Capacity, not Ready.
  const namedHolds = useMemo(() => networkNamedHolds(movements, referrals), [movements, referrals]);
  const rows: WardRow[] = useMemo(
    () =>
      units.map((unit) => {
        const site = siteByCode(unit.siteCode);
        const states = bedStates(unit, admissions, bedReleases, leaveBeds, namedHolds);
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
    [units, admissions, bedReleases, leaveBeds, movements, namedHolds, now],
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

  // Statewide hero counts; a site bed manager's are its own site's wards only.
  const heroRows = siteCode === undefined ? rows : rows.filter((row) => isOwn(row.unit));
  const heroUnits = siteCode === undefined ? units : units.filter(isOwn);
  const totalBeds = heroRows.reduce((sum, row) => sum + row.unit.beds, 0);
  const totalOccupied = heroRows.reduce((sum, row) => sum + Math.round(row.occupancy * row.unit.beds), 0);
  const readyNow = heroRows.reduce((sum, row) => sum + row.ready, 0);
  const shiftEnd = shiftEndInstant(now);
  // A16-05: the shared rule, so a discharge date already passed (overdue) is never added to Ready.
  const freeingByShiftEnd = releasesExpectedToFree(
    bedReleases,
    now,
    shiftEnd,
    new Set(heroUnits.map((unit) => unit.id)),
  ).length;
  const pulled = heroRows.reduce((sum, row) => sum + row.states.pulled, 0);
  const staleCount = heroRows.filter((row) => row.stale).length;
  // Page tops (Josh, 9 Nov 2026): the counts confirmed this shift, the same pill and words as Capacity.
  const confirmations = shiftConfirmations(heroUnits, now);
  const firstToConfirm = confirmations.waiting[0];
  // Asking a ward to confirm its beds is the coordinator's step (REQUEST_CAPACITY_REFRESH), as on
  // Capacity. A site bed manager confirms on the ward's own page; every other desk opens the ward.
  const askWard =
    access.role !== "coordinator" || siteCode !== undefined
      ? undefined
      : (unit: Unit) =>
          refreshSave.submit(
            () => raise("REQUEST_CAPACITY_REFRESH", { unitId: unit.id }),
            () => toast?.push({ tone: "success", title: `Asked ${unit.name} to confirm its beds.` }),
          );

  // Every word, folded, in any order: "SCGH older" finds the SCGH older adult ward (31 Oct 2026).
  const matchesQuery = (row: WardRow) =>
    query.trim() === "" ||
    fieldsMatchEveryWord(query, [row.unit.name, row.siteName, row.unit.siteCode, row.unit.cohort, row.service ?? ""]);

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
    if (order === "a-z") return a.unit.name.localeCompare(b.unit.name);
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
  const noReadyCount = heroPlaced.filter((row) => row.ready === 0).length;
  const wardsWithReady = heroPlaced.length - noReadyCount;
  const staleRows = [...heroRows.filter((row) => row.stale)].sort((a, b) => a.confirmedAt - b.confirmedAt);
  // D-126 (10 Nov 2026): no single "Most ready" ward. The desktop hero chip counts the wards with a
  // ready bed and toggles the Has ready filter; a site desk already has that as a figure.
  const showHasReadyChip = deskSite === undefined && wardsWithReady > 0;
  const drawerRow = drawerWardId === null ? undefined : rows.find((row) => row.unit.id === drawerWardId);
  const statewidePercent = totalBeds > 0 ? (totalOccupied / totalBeds) * 100 : null;
  // Filters counts the filters it holds that are set. Order is not a filter, so it never counts.
  const moreFilterCount = (status !== "all" ? 1 : 0) + (cohort !== "all" ? 1 : 0);
  // Site bed manager: its own site first, then the rest as counts, folded after a few cards.
  const [otherOpen, setOtherOpen] = useState(false);
  const ownOrdered = ordered.filter((row) => isOwn(row.unit));
  const otherOrdered = ordered.filter((row) => !isOwn(row.unit));
  const otherShown =
    otherOpen || isFiltered ? otherOrdered : otherOrdered.slice(0, otherSitesFolded(otherOrdered.length));
  const otherMore = (
    <OtherSitesMore
      shown={otherShown.length}
      total={otherOrdered.length}
      open={otherOpen}
      onToggle={() => setOtherOpen((value) => !value)}
    />
  );

  // The statewide rail. Phone (v10) opens it as a sheet from one link row under the list.
  const rail = (
    <aside className={styles.rail} data-wf-rail="1121" aria-label="Statewide by service">
      {/* Page tops (Josh, 9 Nov 2026): wider screens read occupancy by service in the hero's band. */}
      {isPhone ? (
        <Card as="section" className={cx(styles.railCard, styles.wrapText)} aria-labelledby="ward-service-occupancy">
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
        </Card>
      ) : null}

      <Card as="section" className={cx(styles.railCard, styles.wrapText)} aria-labelledby="ward-counts-to-check">
        <div className={styles.serviceHead}>
          <h2 id="ward-counts-to-check" className={styles.railTitle}>
            Counts to check <Count n={staleRows.length} />
          </h2>
          <span className={styles.serviceMeta}>past each ward&apos;s limit</span>
        </div>
        {staleRows.length === 0 ? (
          <p className={styles.railNote}>
            <b className={styles.num}>0</b> counts past their limit.
          </p>
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
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          className={`${pageTop.hero} ${folderTabClasses.hero}`}
          // A site desk says whose wards these are; statewide, the header already says it.
          eyebrow={deskSite ? `Wards · ${deskSite.name}` : undefined}
          title={
            <>
              <SrOnly>{"All wards, "}</SrOnly>
              Ward beds <span className={styles.titleSoft}>right now</span>
            </>
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
        >
          <HeroTop
            figures={
              <HeroFigures
                label={deskSite ? `${deskSite.name} counts` : "Statewide counts"}
                items={[
                  {
                    id: "ready",
                    value: readyNow,
                    unit: `/ ${totalBeds}`,
                    label: readyNow === 1 ? "bed ready" : "beds ready",
                    testId: "ward-index-figure-ready",
                  },
                  {
                    id: "ready-by",
                    value: readyNow + freeingByShiftEnd,
                    label: `ready by ${formatInstantWithDay(shiftEnd, now)}`,
                    testId: "ward-index-figure-ready-by",
                  },
                  ...(isPhone
                    ? [
                        {
                          id: "in-use",
                          value: statewidePercent === null ? "Not recorded" : `${Math.round(statewidePercent)}%`,
                          label: "in use",
                          href: "/ward-flow/capacity",
                          testId: "ward-index-figure-in-use",
                        },
                      ]
                    : [
                        // A site desk: this figure counts the wards with a ready bed, as its filter does.
                        deskSite
                          ? {
                              id: "with-ready",
                              value: wardsWithReady,
                              label: wardsWithReady === 1 ? "ward with a ready bed" : "wards with a ready bed",
                              pressed: status === "has-ready",
                              onClick: () => setStatus(status === "has-ready" ? "all" : "has-ready"),
                              testId: "ward-index-figure-with-ready",
                            }
                          : { id: "pulled", value: pulled, label: "pulled", testId: "ward-index-figure-pulled" },
                        {
                          id: "full",
                          value: noReadyCount,
                          // Pressing it highlights those wards, as the Full filter does.
                          label: noReadyCount === 1 ? "ward full, no bed ready" : "wards full, no bed ready",
                          pressed: status === "full",
                          onClick: () => setStatus(status === "full" ? "all" : "full"),
                          testId: "ward-index-figure-full",
                        },
                      ]),
                ]}
              />
            }
            pill={
              <HeroPill
                tone={confirmations.waiting.length > 0 || staleCount > 0 ? "warning" : undefined}
                testId="ward-index-confirmed"
                text={
                  <>
                    <b className={styles.pillCount}>
                      {confirmations.confirmed} of {confirmations.total}
                    </b>{" "}
                    {firstToConfirm
                      ? `confirmed · ${firstToConfirm.name} ${durMinutes(Math.max(0, now - firstToConfirm.allocatable.confirmedAt))} old`
                      : "counts confirmed this shift"}
                  </>
                }
                action={
                  firstToConfirm && askWard
                    ? {
                        label: "Ask",
                        ariaLabel: `Ask ${firstToConfirm.name} to confirm its beds`,
                        onClick: () => askWard(firstToConfirm),
                        testId: "ward-index-ask",
                      }
                    : firstToConfirm
                      ? {
                          label: "Open",
                          ariaLabel: `Open ${firstToConfirm.name}`,
                          href: `/ward-flow/ward/${firstToConfirm.id}`,
                          testId: "ward-index-open-count",
                        }
                      : undefined
                }
              />
            }
            // Desktop: the one job chip sits right of the figures (Home's act place), the pill under them.
            act={
              !isPhone && showHasReadyChip ? (
                <HeroQuickChips
                  label="Has ready"
                  items={[
                    {
                      id: "has-ready",
                      label: "Has ready",
                      icon: <BedSingle size={16} strokeWidth={1.75} aria-hidden="true" />,
                      count: wardsWithReady,
                      countTone: "quiet",
                      countLabel: wardsWithReady === 1 ? "ward" : "wards",
                      pressed: status === "has-ready",
                      onClick: () => setStatus(status === "has-ready" ? "all" : "has-ready"),
                      testId: "ward-index-has-ready",
                    },
                  ]}
                />
              ) : undefined
            }
            // A ward desk whose home this is gets no shell Quick bar as a second row.
            quickBar={false}
            band={
              <HeroBand
                title="In use by service"
                testId="ward-index-service-band"
                cells={serviceRows.map((entry) => ({
                  id: entry.id,
                  label: serviceShortName(entry.name),
                  value: entry.percent === null ? "—" : `${Math.round(entry.percent)}%`,
                  note: `${entry.ready} ready`,
                  pressed: service === entry.id,
                  // The name starts with the cell's visible words (WCAG 2.5.3, label in name).
                  ariaLabel: `${serviceShortName(entry.name)} ${entry.percent === null ? "—" : `${Math.round(entry.percent)}%`}, ${entry.ready} ready: ${entry.name}, ${entry.percent === null ? "share in use not recorded" : `${Math.round(entry.percent)}% in use`}. Highlight its wards`,
                  onClick: () => setService(service === entry.id ? "all" : (entry.id as ServiceFilter)),
                }))}
              />
            }
          />
        </Hero>

        {/* Page tops (Josh, 9 Nov 2026): the service choice is the page's tabs; Filters and the view
            switch sit at the row's right end. The search went from the top (Josh): it is the first
            choice behind Filters, and "/" still opens it. */}
        <WardIndexTabs
          isPhone={isPhone}
          service={service}
          onService={setService}
          serviceItems={serviceItems}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
          filterCount={moreFilterCount}
          searching={query !== ""}
          view={view}
          onView={setView}
        />

        <section className={styles.filters} aria-label="Ward filters">
          <div className={styles.moreFilters} id="ward-index-more-filters" data-open={filtersOpen ? "true" : undefined}>
            <TextInput
              ref={searchRef}
              type="search"
              id="wardSearchInput"
              icon={Search}
              placeholder="Ward, hospital or service"
              aria-label="Filter wards by keyword"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              trailing={query || isPhone ? undefined : <Kbd>/</Kbd>}
              autoComplete="off"
              spellCheck={false}
              boxClassName={styles.search}
            />
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Status</span>
              <ScrollRow className={styles.phoneFilterScroll} role="group" aria-label="Status choices">
                <Segmented
                  className={styles.phoneFilterChoices}
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
              </ScrollRow>
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Cohort</span>
              <ScrollRow className={styles.phoneFilterScroll} role="group" aria-label="Cohort choices">
                <Segmented
                  className={styles.phoneFilterChoices}
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
              </ScrollRow>
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Order</span>
              <ScrollRow className={styles.phoneFilterScroll} role="group" aria-label="Order choices">
                <Segmented
                  className={styles.phoneFilterChoices}
                  label="Order"
                  items={[
                    { id: "service" as OrderBy, label: deskSite ? "Site" : "Service" },
                    { id: "a-z" as OrderBy, label: "A to Z" },
                  ]}
                  value={order}
                  onChange={setOrder}
                />
              </ScrollRow>
            </div>
          </div>
          {/* Audit 11 Oct 2026: the bed strip key is one line under the filters, not a rail card. */}
          {/* A site desk's phone has its own site headings, so no "Every ward"; unfiltered, the row is empty. */}
          {isPhone && deskSite && !isFiltered ? null : (
            <div className={styles.keyRow}>
              {isPhone ? null : (
                <div className={styles.legendLine} aria-label="Reading a ward" role="note">
                  <BedStripLegend />
                  <span>One cell a bed.</span>
                </div>
              )}
              <p className={styles.shownCount} data-testid="ward-index-count-note">
                {isPhone && !deskSite ? <b className={styles.phoneListTitle}>Every ward</b> : null}
                {isFiltered ? (
                  <>
                    {/* A short label; that every ward stays is said to screen readers only. */}
                    <span>
                      <b className={styles.num}>{lit.length}</b> of <b className={styles.num}>{placed.length}</b> wards
                      highlighted<SrOnly>. All wards stay.</SrOnly>
                    </span>
                    {/* Second pass: what is set behind Filters shows here, each with its own remove. */}
                    {filtersOpen ? null : (
                      <>
                        {status !== "all" ? (
                          <AppliedFilter onRemove={() => setStatus("all")} removeLabel="Remove the status filter">
                            {STATUS_LABELS[status]}
                          </AppliedFilter>
                        ) : null}
                        {cohort !== "all" ? (
                          <AppliedFilter onRemove={() => setCohort("all")} removeLabel="Remove the cohort filter">
                            {COHORT_LABELS[cohort]}
                          </AppliedFilter>
                        ) : null}
                      </>
                    )}
                    {/* On a phone the service is the header's own choice, so Reset never offers to undo it. */}
                    {isPhone && status === "all" && cohort === "all" && query === "" ? null : (
                      <Button variant="ghost" size="sm" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    )}
                  </>
                ) : isPhone ? null : (
                  // shell-15: the phone shows no count while nothing is filtered. "22 wards", since
                  // "22 of 22" says nothing while nothing is filtered.
                  <span>
                    <b className={styles.num}>{placed.length}</b> {placed.length === 1 ? "ward" : "wards"}
                  </span>
                )}
              </p>
            </div>
          )}
        </section>

        {/* Service anchors: the canonical service order, one heading each, for in-page links. */}
        <div className={styles.serviceAnchors}>
          {wardServiceOrder.map((name) => (
            <section key={name} id={`wards-${slug(name)}`} data-testid={`ward-index-service-${slug(name)}`}>
              <h2>{name}</h2>
            </section>
          ))}
        </div>

        <div className={styles.layout}>
          <div className={styles.wardsColumn}>
            {placed.length === 0 ? (
              <Card className={cx(styles.emptyCard, styles.wrapText)}>
                <EmptyState icon={Circle} title="No wards recorded" meta="The network has no placed wards." />
              </Card>
            ) : isPhone && deskSite ? (
              <>
                <SiteHead title={deskSite.name} meta={`${ownOrdered.length} wards`} />
                <WardPhoneList
                  rows={ownOrdered}
                  now={now}
                  dotKey={false}
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
                {otherMore}
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
                    <WardCard
                      key={row.unit.id}
                      row={row}
                      now={now}
                      dim={isFiltered && !isLit(row)}
                      headingLevel={3}
                      onOpen={() => setDrawerWardId(row.unit.id)}
                    />
                  ))}
                </section>
                <SiteHead
                  title="Other sites"
                  meta={`Bed counts only · ${otherOrdered.length} wards, ${otherOrdered.reduce((sum, row) => sum + row.ready, 0)} ready`}
                />
                <section className={styles.cardGrid} aria-label="Other sites, bed counts">
                  {otherShown.map((row) => (
                    <WardCard
                      key={row.unit.id}
                      row={row}
                      now={now}
                      dim={isFiltered && !isLit(row)}
                      countsOnly
                      headingLevel={3}
                      onOpen={() => setDrawerWardId(row.unit.id)}
                    />
                  ))}
                </section>
                {otherMore}
              </>
            ) : view === "cards" ? (
              <section className={styles.cardGrid} aria-label="Ward cards">
                {ordered.map((row) => (
                  <WardCard
                    key={row.unit.id}
                    row={row}
                    now={now}
                    dim={isFiltered && !isLit(row)}
                    onOpen={() => setDrawerWardId(row.unit.id)}
                  />
                ))}
              </section>
            ) : (
              <WardTable
                rows={deskSite ? [...ownOrdered, ...otherOrdered] : ordered}
                now={now}
                isDim={(row) => isFiltered && !isLit(row)}
                countsOnly={(row) => !isOwn(row.unit)}
                onOpen={(row) => setDrawerWardId(row.unit.id)}
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
              <ChevronRight strokeWidth={1.75} size={16} aria-hidden="true" />
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

        {isPhone ? null : (
          <WardIndexDrawer
            unit={drawerRow?.unit}
            place={drawerRow ? `${drawerRow.siteName} · ${drawerRow.service ?? "Service not recorded"}` : ""}
            now={now}
            countsOnly={drawerRow !== undefined && !isOwn(drawerRow.unit)}
            onClose={() => setDrawerWardId(null)}
            profile={drawerRow ? <WardProfileFacts row={drawerRow} /> : null}
          />
        )}

        <WardPrototypeFooter
          testId="ward-index-governance"
          note="Synthetic prototype. Invented figures under real WA hospital names. Lists update once a minute."
        />
      </main>
    </div>
  );
}

/** "Maali (Ward 4.2)", not "Maali (Ward 4.2) — open"; the security label already says it. */
function shortWardName(unit: Pick<Unit, "name">): string {
  return unit.name.split(" — ")[0];
}

function slug(service: HealthService): string {
  return service.toLowerCase().split(" ").join("-");
}

/** The card's occupancy as a soft pill, amber from the surge band (95%). */
function OccupancyPill({ row }: { row: WardRow }) {
  const pct = Math.round(row.occupancy * 100);
  const nearFull = row.occupancy >= NEAR_FULL;
  return (
    <span className={styles.sharePill} data-tone={nearFull ? "warning" : undefined}>
      {nearFull ? <StatusGlyph tone="warning" size={8} /> : null}
      <b className={styles.num}>{pct}%</b> {nearFull ? "near full" : "in use"}
    </span>
  );
}

function Confirmed({ row, now, countsOnly = false }: { row: WardRow; now: Instant; countsOnly?: boolean }) {
  const age = durMinutes(Math.max(0, now - row.confirmedAt));
  return row.stale ? (
    <span className={styles.confirmed}>
      <StatusGlyph tone="warning" size={8} />
      {/* Site bed manager: another site's count is its own ward's to chase, not this desk's. */}
      <b className={styles.num}>{age}</b> {countsOnly ? "stale" : "stale, ask the nurse unit manager"}
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
  onOpen,
  dim = false,
  countsOnly = false,
  headingLevel = 2,
}: {
  row: WardRow;
  now: Instant;
  /** WS1: the card opens the ward's side panel. */
  onOpen: () => void;
  dim?: boolean;
  /** A7 (accessibility check, 2 Nov 2026): h2 under the page title, h3 under a site bed manager's site heading. */
  headingLevel?: 2 | 3;
  /** Site bed manager: another site's ward, drawn as bed counts with no way in. */
  countsOnly?: boolean;
}) {
  const { unit } = row;
  const WardTitle = headingLevel === 3 ? "h3" : "h2";
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
        <WardTitle className={cx(styles.wardTitle, styles.wrapLine)} title={unit.name}>
          {/* The name is the card's one target: it stretches over the card and opens the side panel. */}
          <button type="button" className={styles.cardOpen} aria-haspopup="dialog" onClick={onOpen}>
            {shortWardName(unit)}
          </button>
        </WardTitle>
        <SecurityLabel unit={unit} />
      </div>
      <p className={styles.meta} title={`${row.service ?? ""} · ${row.siteName} · ${unit.cohort}`}>
        {row.service ? serviceShortName(row.service) : "Not placed"} · {row.siteShort} · {cohortLabel(unit)}
      </p>
      {/* One large figure, then the strip and the quiet lines at the card's foot, so they line up across a row. */}
      <div className={cx(styles.readyLine, styles.stripFoot)}>
        <span className={styles.readyFigure}>{row.ready}</span>
        <span className={styles.readyWords}>
          ready of <b className={styles.num}>{unit.beds}</b>
        </span>
        <OccupancyPill row={row} />
      </div>
      <BedStrip
        counts={{ ...row.states, pendingPreparation: row.pendingPreparation }}
        wardName={unit.name}
        className={styles.strip}
      />
      {/* Second pass (3 Nov 2026): the confirmation age shows on a card only when it is past the
          ward's limit, the one time anyone acts on it. A fresh age is in the side panel. */}
      {row.stale ? (
        <p className={styles.staleLine}>
          <Confirmed row={row} now={now} countsOnly={countsOnly} />
        </p>
      ) : null}
      <div className={styles.cardFoot}>
        {/* Site bed manager: out and in are read from people records a site desk is not
            given for other sites, so they would read 0. Its counts-only cards leave them out. */}
        {countsOnly ? (
          <span className={styles.flow}>
            <b className={styles.num}>{unit.beds}</b> beds
          </span>
        ) : (
          <span className={styles.flow}>
            <b className={styles.num}>{row.out}</b> out <span aria-hidden="true">·</span>{" "}
            <b className={styles.num}>{row.incoming}</b> in today
          </span>
        )}
        {countsOnly ? (
          <span className={styles.countsOnly}>Bed counts only</span>
        ) : (
          <Link
            className={styles.cardLink}
            href={`/ward-flow/ward/${unit.id}`}
            data-testid={`ward-index-link-${unit.id}`}
            aria-label={`Open ward: ${unit.name}`}
          >
            Open ward
            <ChevronRight strokeWidth={1.75} size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

/** The ward's profile: its cohort and security. Side panel and phone sheet. */
function WardProfileFacts({
  row,
  showStaff = false,
}: {
  row: WardRow;
  /** Phone sheet only: the side panel already says specialling free under Today. */
  showStaff?: boolean;
}) {
  const { unit } = row;
  return (
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
          <dd>
            {row.pendingPreparation === 1
              ? "1 bed, not counted as ready"
              : `${row.pendingPreparation} beds, not counted as ready`}
          </dd>
        </>
      ) : null}
      {showStaff ? (
        <>
          <dt>Observation staff in use</dt>
          {/* Review question 8 (D-189 item 2): the sample day's observation levels, labelled as on the ward page. */}
          <dd>
            {row.specialling} · <span data-testid="ward-index-obs-sample">{SAMPLE_OBSERVATION_MIX_LABEL}</span>
          </dd>
        </>
      ) : null}
    </dl>
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
  dotKey = true,
}: {
  rows: WardRow[];
  now: Instant;
  /** With two lists on the page (a site desk), the amber dot's key is said once, under the last. */
  dotKey?: boolean;
  /** Site bed manager: other sites' wards, whose stale counts are not this desk's to chase. */
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
              <h2 className={styles.phoneGroupHead}>
                <span>{group.label}</span>
                <span className={styles.phoneGroupShare}>
                  {beds > 0 ? `${Math.round((occupied / beds) * 100)}%` : ""}
                </span>
              </h2>
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
                        <span className={cx(styles.phoneRowName, styles.wrapLine)}>{shortWardName(row.unit)}</span>
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
      {dotKey ? (
        <p className={styles.phoneDotKey} data-testid="ward-index-phone-dot-key">
          <StatusGlyph tone="warning" size={8} />
          <span>{`Amber dot: ${NEAR_FULL * 100}% or more in use, or a bed count not confirmed in time`}</span>
        </p>
      ) : null}
    </section>
  );
}

/** Phone: the ward as a bottom sheet, with Open ward and Bed board in the footer. */
function WardPhoneSheet({
  row,
  now,
  onClose,
  countsOnly = false,
}: {
  row: WardRow | undefined;
  now: Instant;
  onClose: () => void;
  /** Site bed manager: another site's ward, with no Enter or stays action. */
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
        countsOnly ? undefined : { label: "Bed board", onAction: () => router.push(`/ward-flow/board/${row.unit.id}`) }
      }
      primary={
        countsOnly ? undefined : { label: "Open ward", onAction: () => router.push(`/ward-flow/ward/${row.unit.id}`) }
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
      <WardProfileFacts row={row} showStaff />
    </PhoneSheet>
  );
}

const TABLE_COLUMNS = "minmax(200px, 2.2fr) 100px 80px minmax(120px, 1.4fr) 76px 56px 64px 92px 72px";

function WardTable({
  rows,
  now,
  isDim,
  countsOnly,
  onOpen,
}: {
  rows: WardRow[];
  now: Instant;
  isDim: (row: WardRow) => boolean;
  /** Site bed manager: rows for another site's ward, with no Enter. */
  countsOnly: (row: WardRow) => boolean;
  /** WS1: the ward's name opens its side panel. */
  onOpen: (row: WardRow) => void;
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
                <button
                  type="button"
                  className={cx(styles.wardTitle, styles.tableOpen)}
                  aria-haspopup="dialog"
                  onClick={() => onOpen(row)}
                >
                  {shortWardName(row.unit)}
                </button>
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
                {countsOnly(row) ? <span className={styles.countsOnly}>Not shown</span> : `${row.out}, ${row.incoming}`}
              </span>
              <span role="cell" className={styles.num}>
                {row.stale ? <StatusGlyph tone="warning" size={8} /> : null}{" "}
                {durMinutes(Math.max(0, now - row.confirmedAt))}
              </span>
              <span role="cell" className={styles.end}>
                {countsOnly(row) ? (
                  <span className={styles.countsOnly}>Counts only</span>
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
