"use client";

import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { setServiceScope, useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type DrawerPagerProps,
  ScrollRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  WardCapacityRow,
  WardCapacityRows,
  WindowWord,
  buttonClass,
  cx,
  durMinutes,
  folderTabClasses,
  useIsPhone,
  useOptionalToast,
} from "@/components/wf";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { bedStates, networkNamedHolds } from "@/components/ward-management/ward-bed-states";
import {
  designationSummary,
  lockedBedsFree,
  unitHasLockedBeds,
  wardCategory,
} from "@/components/ward-management/ward-bed-designation";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import type { Instant } from "@/components/ward-management/ward-clock";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";
import { remainingSpeciallingCapacity } from "@/components/ward-management/ward-admissions";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { isBedCountStale } from "@/components/ward-management/ward-clinical-values";
import { SAMPLE_OBSERVATION_MIX_LABEL } from "@/components/ward-management/ward-sample-choices";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { BedSquaresKey } from "@/components/ward-management/bed-squares";
import { bedsFreeingTodayTotal, networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { heldUpReleases } from "@/components/ward-management/capacity/capacity-held-up";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";

import styles from "./ward-index.module.css";
import { CapacityWardPanel } from "@/components/ward-management/capacity/capacity-ward-drawer";
import { useCapacityModel } from "@/components/ward-management/capacity/capacity-model";
import { HeadingHere } from "@/components/ward-management/hub/hub-heading-here";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { OtherSitesMore, SiteHead, otherSitesFolded } from "./ward-index-site-desk";
import { WardIndexTabs } from "./ward-index-tabs";
import {
  NEAR_FULL,
  WardBedSquares,
  WardCard,
  Confirmed,
  SecurityLabel,
  cohortKey,
  cohortLabel,
  isNearFull,
  serviceShortName,
  shortWardName,
  type WardRow,
} from "./ward-index-card";
export { isNearFull };
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
export type StatusFilter = "all" | "has-ready" | "full" | "stale";
export type CohortFilter = "all" | "adult" | "older-adult" | "youth" | "perinatal";
// D-126 (10 Nov 2026): neutral orders only; no "Most ready" or "Fullest" ranking of wards.
export type OrderBy = "service" | "a-z";
export const STATUS_FILTERS: readonly StatusFilter[] = ["all", "has-ready", "full", "stale"];
export const COHORT_FILTERS: readonly CohortFilter[] = ["all", "adult", "older-adult", "youth", "perinatal"];
export const ORDERS: readonly OrderBy[] = ["service", "a-z"];

/**
 * Area 3 item 1 (mock-up, 26 Nov 2026): Capacity's Wards tab is this directory. Capacity owns the
 * hero, the tab row (with Filters and the view switch) and the ward panel, and keeps every choice
 * in the URL; the directory draws the Filters panel, the bed key, the cards or table and the
 * unplaced foot. The service is the header's own choice, as on a phone.
 */
export type WardDirectoryControl = {
  status: StatusFilter;
  cohort: CohortFilter;
  order: OrderBy;
  view: ViewMode;
  query: string;
  onChange: (
    changes: Partial<{ status: StatusFilter; cohort: CohortFilter; order: OrderBy; view: ViewMode; query: string }>,
    mode?: "push" | "replace",
  ) => void;
  filtersOpen: boolean;
  onFiltersOpen: (open: boolean) => void;
  /** Opens Capacity's own ward panel (Open ward, Discharge board, Bed board, Closures). */
  onOpenWard: (unitId: string) => void;
};

const STATUS_LABELS: Record<Exclude<StatusFilter, "all">, string> = {
  "has-ready": "Has a ready bed",
  full: "Full",
  stale: "Count old",
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

/* The one alert line (device audit, 11 Oct 2026): the rail's Bed alerts threshold, as on Home and
   Capacity. It was 90% here, so All wards drew a "90% line" against everyone else's 85%. */
const SERVICE_LINE = BED_ALERT_THRESHOLD_PERCENT / 100;

export function WardIndex({
  units: unitsOverride,
  directory,
  pageSwitch,
  heroTabs,
  initialQuery = "",
  onQueryChange,
}: {
  units?: Unit[];
  directory?: WardDirectoryControl;
  /** Find (mock-up, 26 Nov 2026): the Find tabs, drawn first in this page's tab row; the page is unchanged. */
  pageSwitch?: ReactNode;
  /** Find (mock-up): the Find tabs, drawn at the top of the hero. */
  heroTabs?: ReactNode;
  /** Find: words carried from another tab's search box. */
  initialQuery?: string;
  /** Find: the search box's words, handed back so the next tab can carry them. */
  onQueryChange?: (query: string) => void;
}) {
  const embedded = directory !== undefined;
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
  const [localStatus, setLocalStatus] = useState<StatusFilter>("all");
  const [localCohort, setLocalCohort] = useState<CohortFilter>("all");
  const [localOrder, setLocalOrder] = useState<OrderBy>("service");
  const [localView, setLocalView] = useState<ViewMode>("cards");
  const [localQuery, setLocalQuery] = useState(initialQuery);
  // Find: the search sits behind Filters, so carried words open it and the box shows what narrowed the cards.
  const [localFiltersOpen, setLocalFiltersOpen] = useState(initialQuery !== "");
  // Embedded in Capacity, every choice is Capacity's (kept in its URL); on its own page, local.
  const status = directory?.status ?? localStatus;
  const cohort = directory?.cohort ?? localCohort;
  const order = directory?.order ?? localOrder;
  const view = directory?.view ?? localView;
  const query = directory?.query ?? localQuery;
  const filtersOpen = directory?.filtersOpen ?? localFiltersOpen;
  const setStatus = (next: StatusFilter) => (directory ? directory.onChange({ status: next }) : setLocalStatus(next));
  const setCohort = (next: CohortFilter) => (directory ? directory.onChange({ cohort: next }) : setLocalCohort(next));
  const setOrder = (next: OrderBy) => (directory ? directory.onChange({ order: next }) : setLocalOrder(next));
  const setView = (next: ViewMode) => (directory ? directory.onChange({ view: next }) : setLocalView(next));
  const setQuery = (next: string) => (directory ? directory.onChange({ query: next }, "replace") : setLocalQuery(next));
  const setFiltersOpen = useCallback(
    (next: boolean | ((open: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(filtersOpen) : next;
      if (directory) directory.onFiltersOpen(value);
      else setLocalFiltersOpen(value);
    },
    [directory, filtersOpen],
  );
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!directory) onQueryChange?.(localQuery);
  }, [directory, localQuery, onQueryChange]);
  // Phone (v10): one list of wards; a tap opens the ward's card as a bottom sheet.
  const isPhone = useIsPhone();
  // shell-15 (Josh, 13 Oct 2026): on a phone the header's service is the one service control, so
  // the page follows it and draws no region chips of its own. Desktop keeps its own chips; inside
  // Capacity the header's picker is the one service choice on every size (C-10).
  const headerService = useServiceScope();
  const serviceFromHeader = isPhone || embedded;
  const service: ServiceFilter = serviceFromHeader ? (headerService ?? "all") : pickedService;
  const setService = (next: ServiceFilter) => {
    if (serviceFromHeader) setServiceScope(next === "all" ? null : next);
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
  }, [setFiltersOpen]);

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
          pendingPreparation: states.beingMadeReady,
          dischargesToday: bedsFreeingTodayTotal(bedReleases, now, new Set([unit.id])) ?? 0,
          heldUp: heldUpReleases(
            bedReleases.filter((release) => release.unitId === unit.id),
            now,
          ).total,
          out: breakdown.confirmedToday + breakdown.expectedToday,
          incoming,
          confirmedAt: unit.allocatable.confirmedAt,
          stale: isBedCountStale(unit.allocatable.confirmedAt, now),
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
  // Wave 4 (D-191, notes item 11): the hero tells one afternoon story with Capacity's figures. "Ready
  // by 15:00" went (it read beside "short"); Discharges · today is the meeting sheet's freeing today,
  // still due later today and not held up (`isFreeingToday`), so the two never disagree.
  const dischargesToday = bedsFreeingTodayTotal(bedReleases, now, new Set(heroUnits.map((unit) => unit.id))) ?? 0;
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
  // A chosen service filters the list to its wards (audit three review); status, cohort and search still highlight.
  const ordered = placed.filter(byService).sort((a, b) => {
    if (order === "a-z") return a.unit.name.localeCompare(b.unit.name);
    return serviceRank(a) - serviceRank(b);
  });

  const isFiltered = service !== "all" || status !== "all" || cohort !== "all" || query !== "";
  const resetFilters = () => {
    if (directory) {
      directory.onChange({ status: "all", cohort: "all", query: "" });
      return;
    }
    setPickedService("all");
    setLocalStatus("all");
    setLocalCohort("all");
    setLocalQuery("");
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
                <Link className={styles.checkName} href={`/bedchart/ward/${row.unit.id}`}>
                  {row.unit.name}
                </Link>
                <span className={styles.checkAge}>
                  Count <b className={styles.num}>{durMinutes(Math.max(0, now - row.confirmedAt))}</b> old
                </span>
                {askWard ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.checkAsk}
                    onClick={() => askWard(row.unit)}
                    aria-label={`Ask ${row.unit.name} to confirm its beds`}
                    data-testid="ward-index-check-ask"
                  >
                    Ask
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  );

  // Inside Capacity, a ward of this desk opens Capacity's own ward panel; another site's ward (a
  // site bed manager's counts-only card) keeps this page's counts-only panel.
  const openRow = (row: WardRow) => {
    if (directory && isOwn(row.unit)) directory.onOpenWard(row.unit.id);
    else if (isPhone) setPhoneWardId(row.unit.id);
    else setDrawerWardId(row.unit.id);
  };

  // Audit four #31: the kit pager on the ward panel and phone sheet steps through the wards in the
  // order shown, skipping the ones that open Capacity's own panel instead.
  const listedRows = deskSite
    ? [...ownOrdered, ...(view !== "cards" && !isPhone ? otherOrdered : otherShown)]
    : ordered;
  const pagerRows = listedRows.filter((row) => !(directory && isOwn(row.unit)));
  const wardPager = (openId: string | null, open: (id: string) => void): DrawerPagerProps | undefined => {
    const index = pagerRows.findIndex((row) => row.unit.id === openId);
    if (openId === null || pagerRows.length < 2 || index < 0) return undefined;
    return {
      index,
      total: pagerRows.length,
      noun: "ward",
      onStep: (delta) => {
        const next = pagerRows[(index + delta + pagerRows.length) % pagerRows.length];
        if (next) open(next.unit.id);
      },
    };
  };

  const body = (
    <>
      {embedded ? null : (
        <Hero
          level={1}
          className={`${pageTop.hero} ${folderTabClasses.hero}`}
          // A site desk says whose wards these are; statewide, the header already says it.
          eyebrow={heroTabs ?? (deskSite ? `Wards · ${deskSite.name}` : undefined)}
          phoneEyebrow={heroTabs ? "show" : undefined}
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
                // Wave 4 (D-191, notes item 11): count labels are nouns, as on Capacity. The title says
                // "right now", so "now" is left off (spec revision); "today" differs, so it stays.
                items={[
                  {
                    id: "ready",
                    value: readyNow,
                    unit: `/ ${totalBeds}`,
                    label: "Ready",
                    testId: "ward-index-figure-ready",
                  },
                  {
                    id: "discharges",
                    value: dischargesToday,
                    label: (
                      <>
                        Expected to leave
                        <WindowWord word="today" className={styles.figWindow} />
                      </>
                    ),
                    testId: "ward-index-figure-discharges",
                  },
                  ...(isPhone
                    ? [
                        {
                          id: "in-use",
                          value: statewidePercent === null ? "Not recorded" : `${Math.round(statewidePercent)}%`,
                          label: "In use",
                          href: "/bedchart/capacity",
                          testId: "ward-index-figure-in-use",
                        },
                      ]
                    : [
                        // A site desk: this figure counts the wards with a ready bed, as its filter does.
                        // Audit two #55: the statewide hero no longer carries Capacity's Short figure.
                        ...(deskSite
                          ? [
                              {
                                id: "with-ready",
                                value: wardsWithReady,
                                label: wardsWithReady === 1 ? "Ward with a ready bed" : "Wards with a ready bed",
                                pressed: status === "has-ready",
                                onClick: () => setStatus(status === "has-ready" ? "all" : "has-ready"),
                                testId: "ward-index-figure-with-ready",
                              },
                            ]
                          : []),
                        {
                          id: "full",
                          value: noReadyCount,
                          // Pressing it highlights those wards, as the Full filter does.
                          label: (
                            <>
                              {noReadyCount === 1 ? "Ward full" : "Wards full"}
                              <SrOnly>, no bed ready</SrOnly>
                            </>
                          ),
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
                    confirmed
                  </>
                }
                // Audit two #55: Ask sits on every Counts to check row; the pill only opens the ward for a desk that cannot ask.
                action={
                  firstToConfirm && !askWard
                    ? {
                        label: "Open",
                        ariaLabel: `Open ${firstToConfirm.name}`,
                        href: `/bedchart/ward/${firstToConfirm.id}`,
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
                  ariaLabel: `${serviceShortName(entry.name)} ${entry.percent === null ? "—" : `${Math.round(entry.percent)}%`}, ${entry.ready} ready: ${entry.name}, ${entry.percent === null ? "share in use not recorded" : `${Math.round(entry.percent)}% in use`}. Show only its wards`,
                  onClick: () => setService(service === entry.id ? "all" : (entry.id as ServiceFilter)),
                }))}
              />
            }
          />
        </Hero>
      )}

      {/* Page tops (Josh, 9 Nov 2026): the service choice is the page's tabs; Filters and the view
            switch sit at the row's right end. The search went from the top (Josh): it is the first
            choice behind Filters, and "/" still opens it. */}
      {embedded ? null : (
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
      )}

      <section className={styles.filters} aria-label="Ward filters">
        {/* Find (mock-up): the service tabs keep the page's own folder look, Filters and the view
              switch at their right end; Find's pinned and recent places, once used, lead the sheet. */}
        {pageSwitch ? <div className={styles.findMemory}>{pageSwitch}</div> : null}
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
                  { id: "stale" as StatusFilter, label: "Count old" },
                ]}
                value={status}
                onChange={setStatus}
              />
            </ScrollRow>
          </div>
          {/* Cohort and Sort wrap as one pair, so a narrow row breaks before Cohort and Sort is
                never left alone on a row (Josh, 28 Nov 2026). */}
          <div className={styles.filterPair}>
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
              <span className={styles.filterLabel}>Sort</span>
              <ScrollRow className={styles.phoneFilterScroll} role="group" aria-label="Sort choices">
                <Segmented
                  className={styles.phoneFilterChoices}
                  label="Sort"
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
        </div>
        {/* Audit 11 Oct 2026: the bed strip key is one line under the filters, not a rail card. */}
        {/* A site desk's phone has its own site headings, so no "Every ward"; unfiltered, the row is empty. */}
        {isPhone && deskSite && !isFiltered ? null : (
          <div className={styles.keyRow}>
            {isPhone ? null : (
              <div className={styles.legendLine} aria-label="Reading a ward" role="note">
                {/* Wave 4 (D-191, ruling 7): the shared bed squares key, in strip order. */}
                <BedSquaresKey />
                <span>One square a bed.</span>
              </div>
            )}
            {/* Audit two #21: "22 wards" shows only when filtered ("8 of 22"); unfiltered the row ends on its legend. */}
            {isFiltered || (isPhone && !deskSite) ? (
              <p className={styles.shownCount} data-testid="ward-index-count-note">
                {isPhone && !deskSite ? <b className={styles.phoneListTitle}>Every ward</b> : null}
                {isFiltered ? (
                  <>
                    {/* A short label; that every ward stays is said to screen readers only. */}
                    <span>
                      {status === "all" && cohort === "all" && query === "" ? (
                        <>
                          {/* D-41 pattern: a filter that hides wards says how many and offers them back. */}
                          <b className={styles.num}>{ordered.length}</b> of{" "}
                          <b className={styles.num}>{placed.length}</b> wards
                          {service !== "all" && ordered.length < placed.length ? (
                            <>
                              {" · "}
                              <button type="button" className={styles.showAllLink} onClick={() => setService("all")}>
                                Show all wards
                              </button>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <b className={styles.num}>{lit.length}</b> of <b className={styles.num}>{ordered.length}</b>{" "}
                          wards highlighted<SrOnly>. The other wards stay.</SrOnly>
                        </>
                      )}
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
                    {serviceFromHeader && status === "all" && cohort === "all" && query === "" ? null : (
                      <Button variant="ghost" size="sm" onClick={resetFilters}>
                        Reset filters
                      </Button>
                    )}
                  </>
                ) : null}
              </p>
            ) : null}
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
        {/* D-276: wider screens show Counts to check above the cards (D-270), so it comes first in
              reading order too, not only on screen. */}
        {isPhone || embedded ? null : rail}
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
                onOpen={openRow}
              />
              <SiteHead title="Other sites" meta="Bed counts only" />
              <WardPhoneList
                rows={otherShown}
                now={now}
                countsOnly
                grouped={order === "service"}
                isDim={(row) => isFiltered && !isLit(row)}
                onOpen={openRow}
              />
              {otherMore}
            </>
          ) : isPhone ? (
            <WardPhoneList
              rows={ordered}
              now={now}
              grouped={order === "service"}
              isDim={(row) => isFiltered && !isLit(row)}
              onOpen={openRow}
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
                    onOpen={() => openRow(row)}
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
                    onOpen={() => openRow(row)}
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
                  onOpen={() => openRow(row)}
                />
              ))}
            </section>
          ) : (
            <WardTable
              rows={deskSite ? [...ownOrdered, ...otherOrdered] : ordered}
              now={now}
              isDim={(row) => isFiltered && !isLit(row)}
              countsOnly={(row) => !isOwn(row.unit)}
              onOpen={openRow}
            />
          )}
        </div>

        {isPhone && !embedded ? (
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
        {isPhone && !embedded ? (
          <PhoneSheet
            open={phoneRailOpen}
            onClose={() => setPhoneRailOpen(false)}
            title="Occupancy by service"
            description={`Bars against the ${SERVICE_LINE * 100}% line, with ready beds`}
            className={styles.phoneRailSheet}
          >
            {rail}
          </PhoneSheet>
        ) : null}
      </div>

      {unplaced.length > 0 ? (
        <section id="wards-unplaced" className={styles.unplaced} data-testid="ward-index-unplaced">
          <h3 className={styles.eyebrow}>Not placed in a health service</h3>
          <ul className={styles.unplacedList}>
            {unplaced.map((row) => (
              <li key={row.unit.id}>
                <Link
                  className={styles.unplacedLink}
                  href={`/bedchart/ward/${row.unit.id}`}
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
          pager={wardPager(phoneWardId, setPhoneWardId)}
          countsOnly={phoneWardId !== null && !rows.some((row) => row.unit.id === phoneWardId && isOwn(row.unit))}
        />
      ) : null}

      {isPhone ? null : (
        // Batch 3 (one Ward panel): All wards opens Capacity's ward panel, with this page's extras
        // (Site · Service, Heading here, Ward profile) as optional props. ward-index-drawer.tsx is
        // now unused; deleting it needs Josh's yes.
        <AllWardsPanel
          unit={drawerRow?.unit}
          place={drawerRow ? `${drawerRow.siteName} · ${drawerRow.service ?? "Service not recorded"}` : ""}
          now={now}
          countsOnly={drawerRow !== undefined && !isOwn(drawerRow.unit)}
          onClose={() => setDrawerWardId(null)}
          pager={wardPager(drawerWardId, setDrawerWardId)}
          profile={drawerRow ? <WardProfileFacts row={drawerRow} /> : null}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <div className={styles.directory} data-testid="capacity-ward-directory" data-ward-design="v10">
        {body}
      </div>
    );
  }
  return (
    <div
      className={styles.screen}
      data-testid="ward-index"
      data-ward-design="v10"
      data-ward-rebuilt-screen="wards-index"
    >
      <main id="main-content" className={styles.main}>
        {body}
        <WardPrototypeFooter
          testId="ward-index-governance"
          note="Invented figures under real WA hospital names. Lists update once a minute."
        />
      </main>
    </div>
  );
}

function slug(service: HealthService): string {
  return service.toLowerCase().split(" ").join("-");
}

/** The ward's profile: its cohort and security. Side panel and phone sheet. */
/**
 * The ward profile (cohort, security, beds being made ready) as All wards' panel shows it, for
 * Capacity's own ward panel now that its Wards tab is the directory (area 3 item 1).
 */
export function WardProfileSection({ unit }: { unit: Unit }) {
  const { admissions, bedReleases, leaveBeds, movements, referrals } = useWardFlowSelect(
    "admissions",
    "bedReleases",
    "leaveBeds",
    "movements",
    "referrals",
  );
  const states = useMemo(
    () => bedStates(unit, admissions, bedReleases, leaveBeds, networkNamedHolds(movements, referrals)),
    [unit, admissions, bedReleases, leaveBeds, movements, referrals],
  );
  return (
    <section className={styles.drawerProfile} aria-label="Ward profile">
      <h3 className={styles.drawerProfileTitle}>Ward profile</h3>
      <WardProfileFacts row={{ unit, pendingPreparation: states.beingMadeReady, specialling: 0 }} />
    </section>
  );
}

function WardProfileFacts({
  row,
  showStaff = false,
}: {
  row: Pick<WardRow, "unit" | "pendingPreparation" | "specialling">;
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
                const nearFull = isNearFull(row.occupancy);
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
  pager,
}: {
  row: WardRow | undefined;
  now: Instant;
  onClose: () => void;
  /** Site bed manager: another site's ward, with no Enter or stays action. */
  countsOnly?: boolean;
  pager?: DrawerPagerProps;
}) {
  // The router is read here, not in the index: this sheet mounts only on phone, so the index
  // still renders where no app router is mounted (unit tests).
  const router = useRouter();
  const canOpen = useCanOpenHref();
  if (!row) return null;
  const statsHref = wardStatisticsHref(row.unit.id);
  return (
    <PhoneSheet
      open
      onClose={onClose}
      title={row.unit.name}
      description={`${row.service ?? "Not placed"} · ${row.siteShort} · ${cohortLabel(row.unit)}`}
      pager={pager}
      secondary={
        !countsOnly && canOpen(statsHref) ? { label: "Statistics", onAction: () => router.push(statsHref) } : undefined
      }
      primary={
        countsOnly
          ? undefined
          : { label: `Open ${row.unit.name}`, onAction: () => router.push(`/bedchart/ward/${row.unit.id}`) }
      }
      className={styles.phoneSheet}
      data-testid="ward-index-phone-sheet"
    >
      <WardBedSquares row={row} className={styles.strip} />
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
        <Confirmed row={row} now={now} />
      </p>
      <WardProfileFacts row={row} showStaff />
    </PhoneSheet>
  );
}

/* Beds holds 20 fixed squares (20 x 6 px + 19 x 2 px gaps); Ward, Service and Occupied give up
   the 40 px it needs, so the table still fits at 1280 (Josh, 28 Nov 2026). */
const TABLE_COLUMNS = "minmax(184px, 2.2fr) 88px 80px minmax(160px, 1.4fr) 64px 56px 64px 92px 72px";

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
      {/* fix-5: the table scrolls inside its own band, so the right-edge fade (820) dims the cut
          columns and never the card's own edge. */}
      <div className={styles.tableScroll}>
        <div role="table" aria-label="Wards" className={styles.table}>
          <div role="rowgroup">
            <div role="row" className={cx(styles.tr, styles.th)} style={{ gridTemplateColumns: TABLE_COLUMNS }}>
              <span role="columnheader">Ward</span>
              <span role="columnheader">Service</span>
              <span role="columnheader">Security</span>
              <span role="columnheader">Beds</span>
              <span role="columnheader">In use</span>
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
                  <SecurityLabel unit={row.unit} showOpen />
                </span>
                <span role="cell">
                  <WardBedSquares row={row} notes={false} />
                </span>
                <span role="cell">
                  <span className={styles.figure}>
                    {isNearFull(row.occupancy) ? <StatusGlyph tone="warning" size={8} /> : null}
                    <b className={styles.num}>{Math.round(row.occupancy * 100)}%</b>
                  </span>
                </span>
                <span role="cell" className={cx(styles.end, styles.bigNum)}>
                  {row.ready}
                </span>
                <span role="cell" className={cx(styles.end, styles.num)}>
                  {countsOnly(row) ? (
                    <span className={styles.countsOnly}>Not shown</span>
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
                    <span className={styles.countsOnly}>Counts only</span>
                  ) : (
                    <Link
                      className={buttonClass({ variant: "sec", size: "sm" })}
                      href={`/bedchart/ward/${row.unit.id}`}
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
      </div>
    </Card>
  );
}

/** All wards' side panel: Capacity's ward panel fed the same `networkWardRows` figures. */
function AllWardsPanel({
  unit,
  place,
  now,
  countsOnly,
  onClose,
  profile,
  pager,
}: {
  unit: Unit | undefined;
  place: string;
  now: Instant;
  countsOnly: boolean;
  onClose: () => void;
  profile: ReactNode;
  pager?: DrawerPagerProps;
}) {
  const { bedReleases, admissions, leaveBeds, movements, referrals } = useWardFlowSelect(
    "bedReleases",
    "admissions",
    "leaveBeds",
    "movements",
    "referrals",
  );
  // WF-FIG-017: a bed held by name is held, not Ready, as on the Capacity network table.
  const row = useMemo(
    () =>
      unit
        ? networkWardRows([unit], now, bedReleases, admissions, leaveBeds, [...movements, ...referrals])[0]
        : undefined,
    [unit, now, bedReleases, admissions, leaveBeds, movements, referrals],
  );
  // Fable batch 3: the same panel as Capacity's, with its "Going out, next 7 days" chart.
  const model = useCapacityModel();
  const week = unit
    ? { days: model.days, row: model.week.rows.find((weekRow) => weekRow.unitId === unit.id) }
    : undefined;
  return (
    <CapacityWardPanel
      week={week}
      row={row}
      now={now}
      onClose={onClose}
      subtitle={place}
      countsOnly={countsOnly}
      pager={pager}
      testId="ward-index-ward-drawer"
    >
      {!countsOnly && unit ? (
        <div className={styles.drawerHeading}>
          <HeadingHere unitId={unit.id} />
        </div>
      ) : null}
      <section className={`${styles.drawerProfile} ${styles.drawerInset}`} aria-label="Ward profile">
        <h3 className={styles.drawerProfileTitle}>Ward profile</h3>
        {profile}
      </section>
    </CapacityWardPanel>
  );
}
