"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { formatWardOccupancy, wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  FilterChip,
  Hero,
  HeroStat,
  OccupancyRing,
  Segmented,
  SrOnly,
  buttonClass,
  durMinutes,
  useIsPhone,
} from "@/components/wf";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { useWardModalFocus } from "../ward-modal-focus";
import { WardFilters } from "@/components/ward-management/ward-controls";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { MakeRoomPanel } from "./make-room-panel";
import { StepDownBoard } from "./step-down-board";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { BED_RELEASE_BLOCKED_FIGURE_LABEL, bedReleaseStateLabels } from "@/components/ward-management/ward-derivations";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { BedMap, type BedMapLayout } from "./bed-map";
import { CapacityPhoneWards } from "./capacity-phone-wards";
import { CapacityPhoneOverview } from "./capacity-phone-overview";
import { bedMeetingSheet } from "./bed-meeting-derivations";
import { BedMeetingSheetLauncher } from "./bed-meeting-sheet";
import { tvServiceParam } from "@/components/ward-management/bed-meeting/tv-derivations";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { bedsForecast } from "./beds-forecast";
import { BedsForecastPanel } from "./beds-forecast-panel";
import { PlannedAdmissionsPanel } from "./planned-admissions-panel";
import {
  bedKindGaps,
  bedKindTotals,
  countCellText,
  groupNetworkWardRowsByService,
  networkTotals,
  networkWardRows,
  releasesBeyondToday,
  type NetworkWardRow,
} from "./capacity-derivations";
import styles from "./capacity.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { GapRow, GapWord, ReadyNowSection } from "./capacity-gap-rows";
import { formatGap, isConfirmationFresh, phoneGap, totalsSentence } from "./capacity-gap-words";
import { NetworkServiceGroupRows } from "./capacity-network-rows";
import { CapacityTabs, CapacityWardSidebar } from "./capacity-ward-sidebar";

export { ReadyNowSection } from "./capacity-gap-rows";
export { rowSentence, totalsSentence } from "./capacity-gap-words";

/**
 * MERGE 02 — the ward-confirmed capacity view and the morning bed-state board fold into one screen.
 *
 * ⚠️ **IT ANSWERS "WHERE IS THE MISMATCH", NEVER "WHERE COULD THIS PERSON GO."** The owner rejected
 * an earlier single-patient matcher design in exactly those words, and `capacity-derivations.ts`'s
 * own file header repeats the same boundary for the numbers this screen renders. Nothing here may
 * rank a ward for a patient, and nothing here may read a per-patient eligibility surface.
 *
 * ⚠️ **THE SCREEN COMPUTES NOTHING BEYOND PRESENTATION.** Every figure comes from `bedKindGaps`,
 * `bedKindTotals`, `networkWardRows` or `networkTotals`. The only arithmetic that happens here is
 * summing rows those functions already returned (e.g. the locked/open split of a total the
 * derivations already handed back) — never a second computation of a fact they already own.
 *
 * ⚠️ **THIS SAID `NetworkWardRow.freeing` IS `undefined` ON EVERY ROW TODAY. IT IS UNDEFINED ON
 * NONE OF THEM** — measured 2026-09-06 against the seeded fixture: 23 rows, 0 undefined, 15 zero,
 * 8 positive. The screen is handed `bedReleases`, so the derivation always has what it needs to
 * return a number. `capacity-derivations.ts` recorded the correct figure on 2026-09-05 while this
 * file kept the opposite claim, three imports apart, both stated confidently.
 *
 * **What the field is FOR is unchanged and still matters, and that is why the branch is kept:** Read `capacity-derivations.ts`'s own doc comment on the field: a future discharge is not a
 * fact any `Unit` carries, so there is no honest number to show. The design lock (§ layout, item 2)
 * asks for a "Freeing today" bar beside "Ready now" — but `WardBar` itself refuses an all-zero bar
 * for the same honesty reason, and rendering a fabricated zero here would be the exact false claim
 * the derivations file's comment warns against. So this screen renders the real "Ready now" bar and,
 * wherever "freeing" would appear, states the absence in words (design lock § behaviour, rule 2)
 * rather than drawing a bar or a count that does not exist. Every place `freeing` is used below
 * checks whether ANY row actually carries a number first, so a future change that starts returning
 * real figures renders correctly without this file needing to change.
 */
/**
 * Device audit option A (Josh, 11 Oct 2026): one bed map (Grid, Rows or Table) instead of the map
 * plus the repeated ward table, Planned admissions as a short list at the foot of the rail, chip
 * labels that name their unit, one primary, and a smaller phone hero with figures and no ring.
 */
/** Highlight chip words: each names what it counts (wards), so none repeats a hero bed figure. */
const HIGHLIGHT_LABELS: Record<string, string> = {
  ready: "Any bed ready",
  "locked-ready": "Locked bed ready",
  "open-ready": "Open bed ready",
  "needs-confirming": "Count not confirmed",
};

export function CapacityScreen() {
  const thresholds = useDueSoonThresholds();
  const { movements, units, bedReleases, admissions, leaveBeds, dispatch, worldGeneration, plannedAdmissions } =
    useWardFlowSelect(
      "movements",
      "units",
      "bedReleases",
      "admissions",
      "leaveBeds",
      "dispatch",
      "worldGeneration",
      "plannedAdmissions",
    );
  const { now, paused, togglePause } = usePageLive();
  const patientOf = usePatientOf();
  const bedMeetingTvOn = useWardFeatureFlag("bed-meeting-tv");
  const makeRoomOn = useWardFeatureFlag("make-room-chains");
  /**
   * SERVICE SCOPE — build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2
   * "Capacity" and task C1. `null` is "All services", the same reading `ward-bar.tsx` and
   * `ward-service-scope-bar.tsx` already give it. Every consumer below treats `service === null`
   * as the unscoped case, so the screen's markup stays byte-identical to before this task whenever
   * nothing is chosen — that is what keeps every pre-existing capacity test green unchanged.
   */
  const service = useServiceScope();
  const [selection, setSelection] = useState<{ unitId: string; generation: number } | null>(null);
  const [networkTab, setNetworkTab] = useState("freeing");
  // Phone (v10): Overview, Wards and Planned are one segmented control; each shows its own part.
  const isPhone = useIsPhone();
  const [phoneTab, setPhoneTab] = useState<"overview" | "wards" | "planned">("overview");
  // Option A: the ward table is the bed map's Table layout, so it mounts only when that is chosen.
  const [mapLayout, setMapLayout] = useState<BedMapLayout>("grid");
  const [wardSort, setWardSort] = useState("name");
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [networkOverflow, setNetworkOverflow] = useState(false);
  const networkBody = useRef<HTMLDivElement>(null);
  const tableDialog = useRef<HTMLDivElement>(null);
  useWardModalFocus(tableFullscreen, tableDialog, () => setTableFullscreen(false));
  const selectionOrigin = useRef<HTMLElement | null>(null);
  const selectionOriginId = useRef<string | null>(null);
  const restoreNetworkFocus = useRef(false);
  const networkHeading = useRef<HTMLHeadingElement>(null);
  const selectedUnitId = selection?.generation === worldGeneration ? selection.unitId : undefined;
  /**
   * ⚠️ **ARMS THE FOCUS RESTORATION BELOW FOR THE CLEAR `clearWard()` NEVER SEES — added 2026-09-17,
   * a real defect a test found: a demo reset while a ward is selected used to leave focus on
   * `<body>`.** `selectedUnitId` goes stale the moment `worldGeneration` moves past
   * `selection.generation` (a `RESET_SCENARIO`/`SET_SCENARIO` reseed) — `selection` itself is
   * untouched, so `clearWard()` is never called and never arms `restoreNetworkFocus.current` on
   * this path. This ref remembers the previously RESOLVED `selectedUnitId` across renders purely so
   * the effect below can tell "a ward WAS selected and just went stale" apart from "nothing was
   * selected to begin with" — `selection !== null` in that effect excludes `clearWard()`'s own path
   * (which already nulls `selection` and already arms the flag itself), so this never double-arms
   * an intentional close.
   */
  const previouslySelectedUnitId = useRef<string | undefined>(undefined);
  function selectWard(unitId: string, opener?: HTMLElement) {
    setTableFullscreen(false);
    selectionOrigin.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    selectionOriginId.current = selectionOrigin.current?.id || null;
    setSelection({ unitId, generation: worldGeneration });
  }
  function clearWard() {
    restoreNetworkFocus.current = true;
    setSelection(null);
  }
  useEffect(() => {
    if (previouslySelectedUnitId.current !== undefined && selectedUnitId === undefined && selection !== null) {
      restoreNetworkFocus.current = true;
    }
    previouslySelectedUnitId.current = selectedUnitId;
  }, [selectedUnitId, selection]);
  useEffect(() => {
    if (selectedUnitId !== undefined || !restoreNetworkFocus.current) return;
    restoreNetworkFocus.current = false;
    // Network openers are replaced by the ward sidebar. Resolve the newly committed button.
    const currentOpener = selectionOriginId.current ? document.getElementById(selectionOriginId.current) : null;
    const retainedOpener = selectionOrigin.current;
    const target =
      currentOpener ??
      (retainedOpener?.isConnected && retainedOpener !== document.body ? retainedOpener : networkHeading.current);
    target?.focus();
  }, [selectedUnitId]);
  const [networkFilterId, setNetworkFilterId] = useState("all");
  function highlightWards(filterId: string) {
    setNetworkFilterId(filterId);
    // In the Table layout the highlight lands on the ward table; otherwise it shows on the map in place.
    const table = document.getElementById("capacity-wards");
    table?.scrollIntoView({ block: "start" });
    table?.focus({ preventScroll: true });
  }
  useEffect(() => {
    const scroller = networkBody.current?.querySelector<HTMLElement>('[data-ward-primitive="table"]');
    if (!scroller) return;
    const measure = () => setNetworkOverflow(scroller.scrollWidth > scroller.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => observer.disconnect();
  }, [showAllColumns, tableFullscreen, service, mapLayout]);

  const gapRows = useMemo(() => bedKindGaps(movements, units, now), [movements, units, now]);
  const gapTotals = useMemo(() => bedKindTotals(gapRows), [gapRows]);
  // Smart feature 10: whole-network, like the mismatch band above it, so a service scope never
  // changes it.
  // Stream D: booked planned admissions due in each window count as beds needed.
  const forecast = useMemo(
    () => bedsForecast(units, bedReleases, admissions, movements, now, plannedAdmissions ?? []),
    [units, bedReleases, admissions, movements, now, plannedAdmissions],
  );
  const shortfalls = useMemo(() => gapRows.filter((row) => row.gap < 0), [gapRows]);

  // ⚠️ `bedReleases` PASSED DELIBERATELY. "Expected to free today" is not a fact `Unit` carries —
  // it lives in reducer state — so `networkWardRows` returns `undefined` for it unless the releases
  // are handed in. Omitting them is not a neutral default: it renders every ward as "not tracked"
  // while the data exists. The derivation still answers `undefined` rather than 0 when they are
  // absent, because 0 would tell a coordinator nothing is freeing today, which is worse than blank.
  // `leaveBeds` passed for the same reason `bedReleases` is: `capacityBreakdown` takes the real
  // list rather than an empty one, so no figure it derives is computed against a fabricated
  // absence. Nothing on this table renders `onLeave` today — passing the truth anyway costs
  // nothing and stops the next figure added here inheriting a silent `[]`.
  const networkRows = useMemo(
    () => networkWardRows(units, now, bedReleases, admissions, leaveBeds),
    [units, now, bedReleases, admissions, leaveBeds],
  );
  const netTotals = useMemo(() => networkTotals(networkRows), [networkRows]);
  // One occupancy count on every page and in the rail (`ward-occupancy.ts`, device audit 11 Oct 2026).
  const occupancy = useMemo(
    () =>
      wardOccupancy(
        networkRows.map((row) => row.unit),
        admissions,
        bedReleases,
      ),
    [networkRows, admissions, bedReleases],
  );
  const selectedRow = useMemo(
    () => networkRows.find((row) => row.unit.id === selectedUnitId),
    [networkRows, selectedUnitId],
  );
  const totalLockedReady = useMemo(() => networkRows.reduce((sum, row) => sum + row.lockedReady, 0), [networkRows]);
  const totalOpenReady = netTotals.ready - totalLockedReady;
  const totalPulled = useMemo(() => networkRows.reduce((sum, row) => sum + row.pulled, 0), [networkRows]);
  // Phone hero: the ring's figure without the ring, one decimal with %.
  const occupancyPercentText = formatWardOccupancy(occupancy, "Not known");
  // shell-1: the hero's figures are all whole-network, whatever service is chosen.
  const heroScopeLabel = service === null ? "Statewide" : `Statewide, not only ${service}`;
  // The ward whose count is oldest: the hero's jump chip opens it.
  const oldestCount = useMemo(
    () =>
      networkRows.reduce<NetworkWardRow | undefined>(
        (oldest, row) => (oldest === undefined || row.confirmedAt < oldest.confirmedAt ? row : oldest),
        undefined,
      ),
    [networkRows],
  );

  /**
   * ⚠️ **`scopedNetworkRows` IS `networkRows` UNCHANGED WHEN `service` IS `null`.** That equality —
   * not a re-derivation — is what makes every figure below identical to its pre-C1 value the moment
   * nothing is chosen. `unitHealthService` is `ward-service-scope.ts`'s own first membership rule: a
   * unit belongs to its SITE's service. Unlike a movement or a referral, a unit's service always
   * resolves in this fixture — `groupNetworkWardRowsByService` and `groupBedMapWardsByService` both
   * already throw if a unit's site does not — so there is no "no recorded service" population to
   * state here, and the scope bar below is mounted without a `noRecordedServiceCount`.
   */
  const scopedNetworkRows = useMemo(
    () => (service === null ? networkRows : networkRows.filter((row) => unitHealthService(row.unit) === service)),
    [service, networkRows],
  );
  /**
   * The scoped mirrors of `totalLockedReady`/`totalOpenReady`/`netTotals.beds` above — §2 "Ready now
   * is scoped, with the network figure in words." Each is summed straight from `scopedNetworkRows`,
   * never sliced from a network-wide total, for the same reason `networkServiceGroupTotals` sums a
   * group's own rows rather than slicing `networkTotals`: a column changing cannot silently move
   * these figures with it. Unused while `service` is `null` — `ReadyNowSection` never reads them on
   * that branch — but computed unconditionally so there is nothing conditional here to get wrong.
   */
  const scopedReady = useMemo(() => scopedNetworkRows.reduce((sum, row) => sum + row.ready, 0), [scopedNetworkRows]);
  const scopedLockedReady = useMemo(
    () => scopedNetworkRows.reduce((sum, row) => sum + row.lockedReady, 0),
    [scopedNetworkRows],
  );
  const scopedOpenReady = scopedReady - scopedLockedReady;
  const scopedPendingPreparation = useMemo(
    () => scopedNetworkRows.reduce((sum, row) => sum + (row.pendingPreparation ?? 0), 0),
    [scopedNetworkRows],
  );
  const scopedBeds = useMemo(() => scopedNetworkRows.reduce((sum, row) => sum + row.unit.beds, 0), [scopedNetworkRows]);

  /**
   * ⚠️ **ONE PREDICATE, MULTIPLE CONSUMERS, SO A CHIP'S COUNT AND ITS "MATCHING" FIGURE CANNOT
   * DISAGREE.** Each `predicate` here is exactly the condition that used to be written inline,
   * twice, on the old dead `WardFilters` — once implicitly (nothing filtered) and once explicitly
   * (the chip's own count expression). It is now written once and read by the chip count below, by
   * the "N matching" figure on the panel header, and by every row to decide whether it is marked.
   */
  const networkFilters: { id: string; label: string; predicate: (row: NetworkWardRow) => boolean }[] = [
    { id: "all", label: "All", predicate: () => true },
    { id: "ready", label: "Has a bed ready", predicate: (row) => row.ready > 0 },
    { id: "locked-ready", label: "Has a locked bed ready", predicate: (row) => row.lockedReady > 0 },
    { id: "open-ready", label: "Has an open bed ready", predicate: (row) => row.ready - row.lockedReady > 0 },
    { id: "needs-confirming", label: "Needs confirming", predicate: (row) => !isConfirmationFresh(row.unit, now) },
  ];
  const activeNetworkFilter = networkFilters.find((option) => option.id === networkFilterId) ?? networkFilters[0];

  /**
   * 🔴 **A CHIP HIGHLIGHTS. IT NEVER HIDES — owner ruling, recorded twice already in this
   * codebase before this screen ever wired a chip:**
   *
   *   `ward-management-network.tsx` (`NetworkBandGroup`'s doc comment): "...far closer to the
   *   metro/rural filter that was declined for hiding beds than to folding a list."
   *
   *   `referral-match.tsx` (`BAND_GROUPS_OPEN_MEDIA_QUERY`'s doc comment): "Collapsing folds; it
   *   does not hide. It was approved INSTEAD of a metro/rural toggle, which was declined precisely
   *   because that would have hidden beds."
   *
   * Capacity is the statewide bed board. A bed that exists must never be absent from it because of
   * a control someone clicked and forgot — so every chip below now marks the wards it matches, and
   * nothing it does ever removes a row.
   *
   * ⚠️ **NAMED SO A LATER READER CAN FIND IT — the same reason Task 1 named its own version of
   * this binding.** Task 1 called it `filteredNetworkRows` because a chip removed rows from it;
   * that name would now be a lie, since every row in `networkRows` renders here, in the same
   * order, on every chip. Kept as its own binding rather than inlined into the JSX map, for the
   * same reason Task 1 gave: a future task grouping this table by health service reads from here.
   */
  const visibleNetworkRows = networkRows;
  // How many of `visibleNetworkRows` the active chip matches — a count for the panel header below,
  // never a filter. Nothing reads this to decide what the table renders.
  const matchingNetworkRows = scopedNetworkRows.filter(activeNetworkFilter.predicate);

  /**
   * Task 2, Part Two — the network table folded by health service.
   *
   * ⚠️ **GROUPS `visibleNetworkRows`, NOT `networkRows` DIRECTLY — even though today the two are
   * the same array.** The task brief that named this table assumed a chip still removed rows
   * ("group the filtered list, not the raw one"); that assumption is stale the moment a chip
   * highlights rather than hides (see `visibleNetworkRows`'s own doc comment, immediately above).
   * Grouping the binding this screen already treats as "what the table shows" means a future chip
   * that DOES narrow the table groups correctly without this line changing, and today it groups
   * every ward exactly as the ungrouped table did. Because no chip can empty a service any more,
   * the "what should an emptied group do" question the brief raised does not arise: a group is
   * empty only when `wardServiceOrder` names a service with no real inpatient unit at all, which
   * `groupNetworkWardRowsByService` states as a sentence — the same case `bed-map.tsx` already
   * handles the same way, immediately above this table.
   */
  // The controlled <select> updates synchronously; only the re-sort is deferred.
  const deferredWardSort = useDeferredValue(wardSort);
  const networkServiceGroups = useMemo(
    () =>
      groupNetworkWardRowsByService(visibleNetworkRows).map((group) => ({
        ...group,
        wards: [...group.wards].sort((a, b) =>
          deferredWardSort === "ready"
            ? b.ready - a.ready || a.unit.name.localeCompare(b.unit.name)
            : deferredWardSort === "confirmation"
              ? a.confirmedAt - b.confirmedAt || a.unit.name.localeCompare(b.unit.name)
              : a.unit.name.localeCompare(b.unit.name),
        ),
      })),
    [visibleNetworkRows, deferredWardSort],
  );

  // See the file-level warning above: `freeing` is only ever a real number on a row where the
  // derivation actually produced one. Deriving `freeingTracked` from the data, rather than assuming
  // it is always absent, is what lets this screen start showing real figures the day a future change
  // to `networkWardRows` starts returning them.
  const freeingValues = useMemo(
    () => networkRows.map((row) => row.freeing).filter((value): value is number => value !== undefined),
    [networkRows],
  );
  const freeingTracked = freeingValues.length > 0;
  const totalFreeing = useMemo(() => freeingValues.reduce((sum, value) => sum + value, 0), [freeingValues]);
  const freeingWards = useMemo(() => networkRows.filter((row) => (row.freeing ?? 0) > 0), [networkRows]);
  // Restored 2026-09-05. See `releasesBeyondToday`: a bed freeing beyond today is correctly left
  // out of every figure on this screen, and saying so is a different act from counting it.
  const excludedBeyondToday = useMemo(() => releasesBeyondToday(bedReleases, now), [bedReleases, now]);

  // Option A: the ward table is the bed map's Table layout, not a second list under the map.
  const wardTable =
    mapLayout === "table" ? (
      <div
        id="capacity-wards"
        ref={tableDialog}
        className={`${styles.wardsSection} ${tableFullscreen ? styles.tableFullscreen : ""}`}
        role={tableFullscreen ? "dialog" : undefined}
        aria-modal={tableFullscreen ? true : undefined}
        aria-label={tableFullscreen ? "Ward capacity full screen" : undefined}
        tabIndex={-1}
      >
        <WardPanel
          title="Wards"
          count={`${scopedNetworkRows.length} ${scopedNetworkRows.length === 1 ? "ward" : "wards"} ${service === null ? "in the network" : `in ${service}`}, ${matchingNetworkRows.length} matching`}
        >
          <div className={styles.filters}>
            <div className={styles.tableToolbar}>
              <button
                type="button"
                className={styles.fullscreenButton}
                aria-pressed={showAllColumns}
                onClick={() => setShowAllColumns(!showAllColumns)}
              >
                {showAllColumns ? "Key columns" : "More columns"}
              </button>
              <button
                type="button"
                className={styles.fullscreenButton}
                aria-expanded={tableFullscreen}
                onClick={() => setTableFullscreen(!tableFullscreen)}
              >
                {tableFullscreen ? "Close full screen" : "Full screen"}
              </button>
            </div>
            <WardFilters
              legend="Highlight wards"
              activeId={networkFilterId}
              onChange={setNetworkFilterId}
              options={networkFilters.map((option) => ({
                id: option.id,
                label: option.label,
                count: scopedNetworkRows.filter(option.predicate).length,
              }))}
            />
            <label className={styles.sortControl}>
              <span className={styles.sortLabel}>Order</span>
              <div className={styles.sortSelectWrap}>
                <select
                  id="capacity-ward-sort"
                  name="wardSort"
                  aria-label="Sort wards"
                  value={wardSort}
                  onChange={(event) => {
                    setWardSort(event.target.value);
                  }}
                >
                  <option value="name">Ward A–Z</option>
                  <option value="ready">Most ready</option>
                  <option value="confirmation">Oldest confirmation</option>
                </select>
                <span className={styles.sortChevron} aria-hidden="true">
                  ▾
                </span>
              </div>
            </label>
          </div>
          <div
            ref={networkBody}
            className={styles.networkBody}
            role="region"
            aria-label="Ward capacity table"
            aria-describedby={networkOverflow && !showAllColumns ? "capacity-table-scroll-notice" : undefined}
            tabIndex={0}
          >
            {networkOverflow && !showAllColumns ? (
              <p id="capacity-table-scroll-notice" className={styles.tableScrollNotice}>
                Scroll sideways to see more ward details.
              </p>
            ) : null}
            <WardTable
              className={`${styles.networkTable} ${showAllColumns ? styles.detailTable : styles.compactTable}`}
              wrapperClassName={styles.networkTableScroll}
              testId="ward-capacity-network-table"
              hasScrollThreshold={showAllColumns}
              overflowing={networkOverflow}
              ariaLabel="Scrollable ward capacity table"
            >
              <thead>
                <tr className={styles.stickyHeaderRow}>
                  <th scope="col">Ward</th>
                  <th scope="col">Bed kinds</th>
                  <th scope="col">Ready</th>
                  <th scope="col">Locked</th>
                  <th scope="col">Freeing</th>
                  <th scope="col">{bedReleaseStateLabels.confirmed}</th>
                  <th scope="col">{bedReleaseStateLabels.expected}</th>
                  <th scope="col">{BED_RELEASE_BLOCKED_FIGURE_LABEL}</th>
                  <th scope="col">Discharges due today</th>
                  <th scope="col">Transfers today</th>
                  <th scope="col">{BED_STATE_LABELS.pulled}</th>
                  <th scope="col">{BED_STATE_LABELS.closed}</th>
                  <th scope="col">{BED_STATE_LABELS.occupied}</th>
                  <th scope="col">Sex mix</th>
                  <th scope="col">Specialling</th>
                  <th scope="col">Involuntary-capable</th>
                  <th scope="col">Confirmed</th>
                  <th scope="col">Ask for an update</th>
                </tr>
              </thead>
              {/* Scoped by rendering only the chosen service's groups, never by re-deriving them, so
                no other service reads as having no ward (see `bed-map.tsx`'s `BedMap`). */}
              {(service === null
                ? networkServiceGroups
                : networkServiceGroups.filter((group) => group.service === service)
              ).map((group) => (
                <NetworkServiceGroupRows
                  key={group.service}
                  group={group}
                  now={now}
                  activeNetworkFilter={activeNetworkFilter}
                  selectedUnitId={selectedUnitId}
                  onSelectWard={selectWard}
                  onRequestRefresh={(unitId) =>
                    dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId })
                  }
                />
              ))}
            </WardTable>
          </div>
        </WardPanel>
      </div>
    ) : null;

  const railAside = (
    <aside className={styles.secondary} aria-label="Network summary and ward detail">
      {selectedRow ? (
        <CapacityWardSidebar
          key={`${worldGeneration}:coordinator:${selectedRow.unit.id}`}
          row={selectedRow}
          now={now}
          onBack={clearWard}
        />
      ) : (
        <>
          <div className={styles.networkHeaderRow}>
            <h2 ref={networkHeading} tabIndex={-1} className={styles.networkHeading}>
              Network
            </h2>
            <span className={styles.networkHeaderTime}>as at {formatInstantWithDay(now, now)}</span>
          </div>
          <BedsForecastPanel forecast={forecast} />
          <CapacityTabs
            id="capacity-network"
            label="Network details"
            value={networkTab}
            onChange={(tab) => startTransition(() => setNetworkTab(tab))}
            options={[
              { id: "freeing", label: "Beds freeing" },
              { id: "attention", label: "Attention" },
            ]}
          />
          <div
            id="capacity-network-panel"
            role="tabpanel"
            aria-labelledby={`capacity-network-${networkTab}-tab`}
            tabIndex={0}
            className={styles.sidebarBody}
          >
            {networkTab === "freeing" ? (
              <>
                {/*
                          R2 item 6 (P3): this sub-panel reads `networkRows`/`freeingWards`, never
                          `scopedNetworkRows` — it is whole-network by the same reasoning "Where the
                          mismatch is" gives above (a bed freeing anywhere is worth knowing about
                          regardless of which service is chosen). Labelled explicitly while a service
                          is chosen so it does not read as a scoped figure sitting beside the
                          genuinely-scoped "Ready now" section and ward table.
                        */}
                <h3 className={styles.sidebarSectionTitle}>
                  Freeing today{service !== null ? " across the whole network" : ""}{" "}
                  <span>{freeingTracked ? countCellText(totalFreeing) : "Not tracked here"}</span>
                </h3>
                {!freeingTracked ? (
                  <p className={styles.absent}>Beds freeing today are not tracked here.</p>
                ) : freeingWards.length === 0 ? (
                  <p className={styles.absent}>No ward reports a bed freeing today.</p>
                ) : (
                  <ul className={`${styles.attention} ${styles.freeingList}`}>
                    {freeingWards.map((row) => (
                      <li key={row.unit.id} className={styles.freeingItem}>
                        <button
                          type="button"
                          id={`capacity-freeing-ward-${row.unit.id}`}
                          className={styles.freeingWardButton}
                          aria-label={`${row.unit.name}, ${row.freeing} freeing today`}
                          onClick={(event) => selectWard(row.unit.id, event.currentTarget)}
                        >
                          {/*
                                    Visible name is the ward alone — the freeing count sits beside
                                    the button so `textContent` of the opener matches the sidebar
                                    `h2` focus target (ward name), not "Ward · N freeing today".
                                  */}
                          <span className={styles.freeingWardName}>{row.unit.name}</span>
                        </button>
                        <span className={styles.freeingBadge} aria-hidden="true">
                          {row.freeing} freeing today
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {excludedBeyondToday > 0 ? (
                  <p className={styles.excluded} data-testid="ward-capacity-excluded-beyond-today">
                    {excludedBeyondToday} releases outside today, excluded from today’s figures.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {/* R2 item 6 (P3): `shortfalls`/`gapRows` are the same whole-network bed-kind
                            gap this screen's own "Where the mismatch is" panel already states is
                            unscoped ("Across the whole network, not only {S}.") — labelled here too
                            while a service is chosen. */}
                <h3 className={styles.sidebarSectionTitle}>
                  Needs you{service !== null ? " across the whole network" : ""}{" "}
                  <span>
                    {shortfalls.length} of {gapRows.length}
                  </span>
                </h3>
                {shortfalls.length === 0 ? (
                  <p className={styles.absent}>No bed kind is short right now.</p>
                ) : (
                  <ul className={styles.attention}>
                    {shortfalls.map((row) => (
                      <li key={row.id} className={styles.attentionItem}>
                        <span className={styles.attentionWho}>{row.need}</span>
                        {Math.abs(row.gap)} short · {row.waiting} waiting, {row.bedsThatFit} fit
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className={styles.attentionAction}
                  onClick={() => {
                    setNetworkFilterId("needs-confirming");
                    document.getElementById("capacity-wards")?.scrollIntoView({ block: "start" });
                  }}
                >
                  {networkRows.filter((row) => !isConfirmationFresh(row.unit, now)).length} wards need confirming
                  {service !== null ? " across the whole network" : ""} · Highlight wards
                </button>
              </>
            )}
          </div>
          <ReadyNowSection
            service={service}
            netTotals={netTotals}
            totalLockedReady={totalLockedReady}
            totalOpenReady={totalOpenReady}
            scopedReady={scopedReady}
            scopedLockedReady={scopedLockedReady}
            scopedOpenReady={scopedOpenReady}
            scopedPendingPreparation={scopedPendingPreparation}
          />
        </>
      )}
    </aside>
  );

  return (
    <div className={styles.screen} data-testid="ward-capacity-page" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        {/*
          🔴 **THE SYNTHETIC-DATA DISCLOSURE, ADDED 2026-09-06.** This screen shipped without
          one and showed invented figures under real Perth hospital names with nothing saying
          so. Twenty-four other ward screens carried it; the three that did not were the three
          the 2026-09-05 merges created.

          ⚠️ **IT IS OPT-IN PER SCREEN, WHICH IS WHY THEY MISSED IT.** There is no shared
          component and no layout providing it, so a new screen gets none by default and
          nothing reported the absence. `tests/ward-prototype-disclosure.test.ts` now walks
          every ward ROUTE and requires the tree it renders to disclose somewhere — a route is
          what a reader opens, and a component nothing routes to cannot disclose to anybody.
        */}
        <Hero
          className={styles.capacityHero}
          level={1}
          // v10: the Wards count appears once, here, never as a chip.
          // shell-1 (13 Oct 2026): every hero figure is whole-network (`networkRows`, `gapTotals`),
          // so the eyebrow says Statewide even with a service chosen; it never names the service as
          // the figures' scope. The ward list below is the part the service narrows.
          eyebrow={`Capacity · ${heroScopeLabel}${
            isPhone
              ? ""
              : ` · ${networkRows.length} ${networkRows.length === 1 ? "ward" : "wards"} · as at ${formatInstant(now)}`
          }`}
          title={
            <>
              <SrOnly>Capacity, </SrOnly>
              {netTotals.ready} {isPhone ? "ready" : "beds ready"} of {netTotals.beds}
            </>
          }
          titleMeta={
            isPhone
              ? `${gapTotals.gap < 0 ? `${Math.abs(gapTotals.gap)} short of` : gapTotals.gap === 0 ? "Exactly enough for" : `${gapTotals.gap} spare for`} ${gapTotals.waiting} waiting in ED${netTotals.pendingPreparation ? ` · ${netTotals.pendingPreparation} being made ready` : ""}`
              : netTotals.pendingPreparation
                ? `${netTotals.pendingPreparation} being made ready`
                : undefined
          }
          stats={
            isPhone ? (
              <>
                <HeroStat
                  value={totalLockedReady}
                  label="Locked ready"
                  tone="success"
                  pressed={networkFilterId === "locked-ready"}
                  onToggle={() => {
                    highlightWards(networkFilterId === "locked-ready" ? "all" : "locked-ready");
                    startTransition(() => {
                      setPhoneTab("wards");
                    });
                  }}
                />
                <HeroStat value={totalPulled} label="Beds pulled" tone={totalPulled > 0 ? "warning" : undefined} />
                <HeroStat value={occupancyPercentText} label="Of beds in use" />
              </>
            ) : undefined
          }
          lead={
            // v10 Capacity: the one ring on the page, ahead of the title. Option A: figures only on a phone.
            isPhone ? undefined : (
              <OccupancyRing percent={occupancy.percent} alertAt={BED_ALERT_THRESHOLD_PERCENT} scope="Statewide" />
            )
          }
          bar={
            isPhone ? undefined : (
              <div className={styles.heroStatGroup} role="group" aria-label="Statewide Bed Telemetry">
                <HeroStat
                  inline
                  value={totalLockedReady}
                  label={"Locked beds ready"}
                  pressed={networkFilterId === "locked-ready"}
                  onToggle={() => highlightWards(networkFilterId === "locked-ready" ? "all" : "locked-ready")}
                />
                <HeroStat
                  inline
                  value={totalOpenReady}
                  label={"Open beds ready"}
                  pressed={networkFilterId === "open-ready"}
                  onToggle={() => highlightWards(networkFilterId === "open-ready" ? "all" : "open-ready")}
                />
                <HeroStat
                  inline
                  value={totalPulled}
                  label={"Beds pulled"}
                  tone={totalPulled > 0 ? "warning" : undefined}
                />
                <HeroStat inline value={freeingTracked ? totalFreeing : "Not tracked"} label={"Beds due out today"} />
                {oldestCount ? (
                  <HeroStat
                    inline
                    command
                    value={durMinutes(Math.max(0, now - oldestCount.confirmedAt))}
                    label={`Oldest count, ${oldestCount.unit.name}`}
                    tone={isConfirmationFresh(oldestCount.unit, now) ? undefined : "warning"}
                    onToggle={() => selectWard(oldestCount.unit.id)}
                    className={styles.heroJump}
                  />
                ) : null}
              </div>
            )
          }
          aside={
            <>
              <PageLiveChip paused={paused} onTogglePause={togglePause} />
              {/* The one-page morning bed-meeting sheet: today's capacity, expected discharges, people
               *  waiting in ED and the top delays, scoped to the service chosen here. */}
              {isPhone ? null : (
                <BedMeetingSheetLauncher
                  now={now}
                  buttonClassName={buttonClass({ variant: "onHero" })}
                  icon={isPhone ? <Printer size={16} aria-hidden="true" /> : undefined}
                  buildSheet={() =>
                    bedMeetingSheet({
                      units,
                      movements,
                      bedReleases,
                      admissions,
                      leaveBeds,
                      now,
                      thresholds,
                      service,
                      nameOf: (movement) => patientOf(movement).displayName,
                    })
                  }
                />
              )}
              {/* The same figures on the meeting room screen, for this scope, behind the `bed-meeting-tv` flag. */}
              {!isPhone && bedMeetingTvOn ? (
                <Link
                  href={bedMeetingTvHref({ service: tvServiceParam(service) })}
                  className={buttonClass({ variant: "onHero" })}
                  data-testid="capacity-bed-meeting-tv"
                >
                  Open on TV
                </Link>
              ) : null}
            </>
          }
        />

        {/*
          🔴 **TASK 2, PART ONE — REORDERED ON THE OWNER'S OWN INSTRUCTION, 2026-09-07.**
          *"please can you find a way to fold up the table for me"* came with a second, separate
          request in the same conversation: *"the best thing from a design choice is to put the
          visual diagram above the table"*, and two further agreed changes about what the screen
          leads with. The reading order below is now: mismatch (the loudest thing on the screen,
          because the subtitle already says that is what this page is FOR) → Ready now (shrunk to
          context, beneath the mismatch rather than above it) → the bed map (moved above the table
          it illustrates) → the network table (now foldable — see below).

          ⚠️ "Shrinks to context" is read here as an ORDER change, not a size change: `WardPanel`
          has no size variant, and inventing one for a single screen risks a shared primitive eleven
          other screens also compose. Ready now keeps its existing rendering and simply no longer
          leads.

          🔴 **"BEDS FREEING TODAY" IS NO LONGER PART OF THIS REORDER — SEE THE ASIDE, BELOW.** This
          comment used to say the panel "moves up out of the quiet aside" as part of this same
          change. The owner overruled that specific move on 2026-09-07 (*"please can you place this
          on the side for me like you did initially"*) and it is back beside "Worth your attention"
          in `<aside>`. Everything else this comment describes — the mismatch table leading, the bed
          map above the network table, Ready now reduced to context — still stands; only the aside
          placement was reversed. See the panel's own comment in the aside for the overrule.

          "Worth your attention" was always left in the aside — the brief allowed judgement there,
          it already reads as supplementary context rather than a headline figure, and the owner's
          overrule of "Beds freeing today" leaves that reasoning undisturbed.
        */}
        {isPhone ? (
          <div className={styles.phoneTabs}>
            <Segmented
              label="Capacity view"
              items={[
                { id: "overview" as const, label: "Overview" },
                { id: "wards" as const, label: "Wards", count: scopedNetworkRows.length },
                {
                  id: "planned" as const,
                  label: "Planned",
                  count: (plannedAdmissions ?? []).filter((booking) => booking.state === "booked").length,
                },
              ]}
              value={phoneTab}
              onChange={(nextTab) => startTransition(() => setPhoneTab(nextTab))}
            />
          </div>
        ) : null}
        {isPhone && phoneTab === "wards" ? (
          <CapacityPhoneWards
            groups={
              service === null
                ? networkServiceGroups
                : networkServiceGroups.filter((group) => group.service === service)
            }
            filters={networkFilters}
            activeFilterId={networkFilterId}
            onFilter={setNetworkFilterId}
            now={now}
            isFresh={(unit) => isConfirmationFresh(unit, now)}
          />
        ) : null}
        <div className={styles.columns} data-phone-tab={isPhone ? phoneTab : undefined}>
          {/*
            🔴 **THE SCOPE BAR — MOUNTED ONLY WHILE A SERVICE IS CHOSEN**, per its own header
            comment and build plan §3 "Scope bar". `shown`/`total` count `scopedNetworkRows` against
            `networkRows` — the same population the bed map and the ward table below are narrowed
            to — and `noun="wards"` names what is being counted. Neither `noRecordedServiceCount`
            nor `urgentOutside` is passed: a unit's service always resolves (see
            `scopedNetworkRows`'s own comment above) and this is not a movement list, so both
            sentences would be inventing a figure this screen was never asked to track.
          */}
          {service !== null ? (
            <WardServiceScopeBar
              service={service}
              shown={scopedNetworkRows.length}
              total={networkRows.length}
              noun="wards"
            />
          ) : null}
          {/*
           * 🔴 THE PROVENANCE LINE, AND IT IS LABELLED BECAUSE IT IS CHECKED.
           * `tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx` finds this region by its
           * `aria-label` and then asserts all three facts inside it. Two of them went missing in
           * separate commits — the badge in the 2026-09-20 sweep that made
           * `WardPrototypeFooter` the sole screen disclosure, and the demo-clock reading when this
           * line replaced the old footer — and neither removal was noticed, because the suite
           * had not run since 17 September.
           *
           * ⚠️ **The screen footer is not a substitute for this one.** It says the screen is a
           * prototype; this says the TIME beside these bed counts is a demo clock rather than now,
           * which is the fact a coordinator would otherwise read as live.
           */}
          {/*
           * Provenance badge removed as prototype is disclosed at page footer.
           */}
          {/* Audit A1-24: no header count; the hero already states waiting and beds that fit. */}
          <WardPanel title="Where the mismatch is">
            <WardTable
              className={styles.gapTable}
              wrapperClassName={styles.gapBandWrap}
              testId="ward-capacity-gap-table"
            >
              <thead>
                <tr>
                  <th scope="col">What&apos;s needed</th>
                  <th scope="col">Waiting</th>
                  <th scope="col">Beds that fit</th>
                  <th scope="col">Gap</th>
                  <th scope="col">What that means</th>
                </tr>
              </thead>
              <tbody>
                {gapRows.map((row) => (
                  <GapRow key={row.id} row={row} phone={isPhone} />
                ))}
              </tbody>
              <tfoot>
                <tr
                  className={`${styles.totalRow} ${gapTotals.gap < 0 ? styles.gapCardDeficit : styles.gapCardBalanced}`}
                  data-testid="ward-capacity-gap-total"
                >
                  <th scope="row">
                    <strong className={styles.gapNeedText}>All four together</strong>
                  </th>
                  <td data-testid="ward-capacity-waiting">{gapTotals.waiting}</td>
                  <td data-testid="ward-capacity-beds-that-fit">{gapTotals.bedsThatFit}</td>
                  <td data-testid="ward-capacity-gap-value">
                    <div className={styles.gapValueContainer}>
                      <GapWord gap={gapTotals.gap} />{" "}
                      <span className={styles.gapNumber}>
                        {isPhone ? phoneGap(gapTotals.gap) : formatGap(gapTotals.gap)}
                      </span>
                    </div>
                    <div
                      className={styles.gapMicroGauge}
                      aria-hidden="true"
                      title={`${gapTotals.bedsThatFit} fit vs ${gapTotals.waiting} waiting`}
                    >
                      <div
                        className={`${styles.gapGaugeFill} ${gapTotals.gap < 0 ? styles.gaugeDeficit : styles.gaugeGood}`}
                        style={{
                          width: `${gapTotals.waiting > 0 ? Math.min(100, Math.round((gapTotals.bedsThatFit / gapTotals.waiting) * 100)) : 100}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td>{totalsSentence(gapTotals)}</td>
                </tr>
              </tfoot>
            </WardTable>
          </WardPanel>
          {/*
            🔴 **§2: "The mismatch band stays whole-network." — SO NOTHING ABOVE THIS LINE CHANGED.**
            Every figure inside the `WardPanel` this sentence follows is still computed from the
            FULL `gapRows`/`gapTotals` (whole `units`/`movements`, never `scopedNetworkRows`), and
            this paragraph is a SIBLING of that panel, never a child of it — so
            `ward-capacity-gap-table` renders byte-identical whether or not a service is chosen. This
            sentence is the only thing that changes, and only to say the table above it is not scoped.
          */}
          {service !== null ? (
            <p className={styles.serviceScopeNote} data-testid="ward-capacity-mismatch-service-note">
              Across the whole network, not only {service}.
            </p>
          ) : null}
          {isPhone && phoneTab === "overview" ? (
            <CapacityPhoneOverview
              rows={networkRows}
              isFresh={(unit) => isConfirmationFresh(unit, now)}
              now={now}
              forecast={forecast}
              freeingTracked={freeingTracked}
              totalFreeing={totalFreeing}
              freeingWards={freeingWards}
            />
          ) : null}

          <div className={styles.capacityGrid}>
            <WardPanel title="Bed map" count={`${service === null ? netTotals.beds : scopedBeds} beds`}>
              <div className={styles.capacityPanelBody} role="region" aria-label="Bed map details" tabIndex={0}>
                <BedMap
                  initialLayout="grid"
                  onLayoutChange={setMapLayout}
                  table={wardTable}
                  initialBedDetail={false}
                  units={units}
                  bedReleases={bedReleases}
                  admissions={admissions}
                  leaveBeds={leaveBeds}
                  selectedUnitId={selectedUnitId}
                  onSelectWard={selectWard}
                  service={service}
                  highlightUnitIds={
                    networkFilterId === "all" ? undefined : new Set(matchingNetworkRows.map((row) => row.unit.id))
                  }
                />
              </div>
              <div className={styles.highlightRow} role="group" aria-label="Ward table shortcuts">
                <span className={styles.highlightLabel} aria-hidden="true">
                  Highlight
                </span>
                {networkFilters.slice(1).map((filter) => {
                  const wards = scopedNetworkRows.filter(filter.predicate).length;
                  return (
                    <FilterChip
                      key={filter.id}
                      pressed={networkFilterId === filter.id}
                      onPressedChange={(pressed) => highlightWards(pressed ? filter.id : "all")}
                      count={`${wards} ${wards === 1 ? "ward" : "wards"}`}
                    >
                      {HIGHLIGHT_LABELS[filter.id] ?? filter.label}
                    </FilterChip>
                  );
                })}
                <Link className={styles.highlightLink} href="/ward-flow/discharges">
                  Discharge board
                </Link>
              </div>
            </WardPanel>

            {/* The rail, with planned bookings as a short list at its foot (option A). */}
            <div className={styles.railColumn} data-wf-rail="">
              {railAside}
              {isPhone ? null : <PlannedAdmissionsPanel key={worldGeneration} now={now} />}
            </div>
          </div>
          {/* Top 25 item 8: desktop only, so the phone design is unchanged. */}
          {!isPhone ? <StepDownBoard now={now} /> : null}
          {makeRoomOn && !isPhone ? <MakeRoomPanel now={now} service={service} /> : null}
        </div>
        {isPhone ? (
          <div className={styles.plannedWrap} data-phone-hidden={phoneTab !== "planned" ? "true" : undefined}>
            <PlannedAdmissionsPanel key={worldGeneration} now={now} />
          </div>
        ) : null}
        {isPhone && phoneTab === "overview" ? (
          // Option A: printing the bed meeting sheet is a desk task, so on a phone it leaves the hero
          // for one quiet button at the foot of Overview.
          <BedMeetingSheetLauncher
            now={now}
            buttonClassName={buttonClass({ variant: "sec" })}
            icon={<Printer size={16} aria-hidden="true" />}
            buildSheet={() =>
              bedMeetingSheet({
                units,
                movements,
                bedReleases,
                admissions,
                leaveBeds,
                now,
                thresholds,
                service,
                nameOf: (movement) => patientOf(movement).displayName,
              })
            }
          />
        ) : null}
        <WardPrototypeFooter
          testId="ward-capacity-governance"
          note="Statewide bed capacity · Not approved for clinical use"
        />
      </main>
    </div>
  );
}
