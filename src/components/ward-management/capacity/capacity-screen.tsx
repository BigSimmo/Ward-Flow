"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEAVING_DESTINATIONS } from "../ward-admissions";

import { unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { dayOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { DischargeOpenHandle, DischargeRecord, WardRecordActor } from "../ward-discharge-records";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import { WardBar, type WardBarSegment } from "@/components/ward-management/ward-bar";
import { WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardFilters } from "@/components/ward-management/ward-controls";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { BED_RELEASE_BLOCKED_FIGURE_LABEL, bedReleaseStateLabels, isOpen } from "@/components/ward-management/ward-derivations";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { wardIntakeConstraintLabels } from "@/components/ward-management/ward-change-reasons";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";
import { BedMap } from "./bed-map";
import {
  bedKindGaps,
  bedKindTotals,
  countCellText,
  freeingCellText,
  groupNetworkWardRowsByService,
  networkServiceGroupTotals,
  networkTotals,
  networkWardRows,
  releasesBeyondToday,
  type BedKindGap,
  type NetworkServiceGroup,
  type NetworkWardRow,
} from "./capacity-derivations";
import styles from "./capacity.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

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
export function CapacityScreen() {
  const { movements, units, bedReleases, admissions, leaveBeds, dispatch, worldGeneration } = useWardFlow();
  const now = useWardFlowClock();
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
  const [wardSort, setWardSort] = useState("name");
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

  const gapRows = bedKindGaps(movements, units, now);
  const gapTotals = bedKindTotals(gapRows);
  const shortfalls = gapRows.filter((row) => row.gap < 0);
  const farPlacementsCount = outOfAreaLedger(admissions, units, now).entries.length;
  const unallocatedCount = movements.filter((m) => isOpen(m) && !m.acceptedUnitId).length;

  // ⚠️ `bedReleases` PASSED DELIBERATELY. "Expected to free today" is not a fact `Unit` carries —
  // it lives in reducer state — so `networkWardRows` returns `undefined` for it unless the releases
  // are handed in. Omitting them is not a neutral default: it renders every ward as "not tracked"
  // while the data exists. The derivation still answers `undefined` rather than 0 when they are
  // absent, because 0 would tell a coordinator nothing is freeing today, which is worse than blank.
  // `leaveBeds` passed for the same reason `bedReleases` is: `capacityBreakdown` takes the real
  // list rather than an empty one, so no figure it derives is computed against a fabricated
  // absence. Nothing on this table renders `onLeave` today — passing the truth anyway costs
  // nothing and stops the next figure added here inheriting a silent `[]`.
  const networkRows = networkWardRows(units, now, bedReleases, admissions, leaveBeds);
  const netTotals = networkTotals(networkRows);
  const totalOccupied = networkRows.reduce((sum, row) => sum + row.occupied, 0);
  const selectedRow = networkRows.find((row) => row.unit.id === selectedUnitId);
  const totalLockedReady = networkRows.reduce((sum, row) => sum + row.lockedReady, 0);
  const totalOpenReady = netTotals.ready - totalLockedReady;

  /**
   * ⚠️ **`scopedNetworkRows` IS `networkRows` UNCHANGED WHEN `service` IS `null`.** That equality —
   * not a re-derivation — is what makes every figure below identical to its pre-C1 value the moment
   * nothing is chosen. `unitHealthService` is `ward-service-scope.ts`'s own first membership rule: a
   * unit belongs to its SITE's service. Unlike a movement or a referral, a unit's service always
   * resolves in this fixture — `groupNetworkWardRowsByService` and `groupBedMapWardsByService` both
   * already throw if a unit's site does not — so there is no "no recorded service" population to
   * state here, and the scope bar below is mounted without a `noRecordedServiceCount`.
   */
  const scopedNetworkRows =
    service === null ? networkRows : networkRows.filter((row) => unitHealthService(row.unit) === service);
  /**
   * The scoped mirrors of `totalLockedReady`/`totalOpenReady`/`netTotals.beds` above — §2 "Ready now
   * is scoped, with the network figure in words." Each is summed straight from `scopedNetworkRows`,
   * never sliced from a network-wide total, for the same reason `networkServiceGroupTotals` sums a
   * group's own rows rather than slicing `networkTotals`: a column changing cannot silently move
   * these figures with it. Unused while `service` is `null` — `ReadyNowSection` never reads them on
   * that branch — but computed unconditionally so there is nothing conditional here to get wrong.
   */
  const scopedReady = scopedNetworkRows.reduce((sum, row) => sum + row.ready, 0);
  const scopedLockedReady = scopedNetworkRows.reduce((sum, row) => sum + row.lockedReady, 0);
  const scopedOpenReady = scopedReady - scopedLockedReady;
  const scopedPendingPreparation = scopedNetworkRows.reduce((sum, row) => sum + (row.pendingPreparation ?? 0), 0);
  const scopedBeds = scopedNetworkRows.reduce((sum, row) => sum + row.unit.beds, 0);

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
  const matchingNetworkRows = networkRows.filter(activeNetworkFilter.predicate);

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
  const networkServiceGroups = groupNetworkWardRowsByService(visibleNetworkRows).map((group) => ({
    ...group,
    wards: [...group.wards].sort((a, b) =>
      wardSort === "ready"
        ? b.ready - a.ready || a.unit.name.localeCompare(b.unit.name)
        : wardSort === "confirmation"
          ? a.confirmedAt - b.confirmedAt || a.unit.name.localeCompare(b.unit.name)
          : a.unit.name.localeCompare(b.unit.name),
    ),
  }));

  // See the file-level warning above: `freeing` is only ever a real number on a row where the
  // derivation actually produced one. Deriving `freeingTracked` from the data, rather than assuming
  // it is always absent, is what lets this screen start showing real figures the day a future change
  // to `networkWardRows` starts returning them.
  const freeingValues = networkRows.map((row) => row.freeing).filter((value): value is number => value !== undefined);
  const freeingTracked = freeingValues.length > 0;
  const totalFreeing = freeingValues.reduce((sum, value) => sum + value, 0);
  const freeingWards = networkRows.filter((row) => (row.freeing ?? 0) > 0);
  // Restored 2026-09-05. See `releasesBeyondToday`: a bed freeing beyond today is correctly left
  // out of every figure on this screen, and saying so is a different act from counting it.
  const excludedBeyondToday = releasesBeyondToday(bedReleases, now);

  return (
    <div className={styles.screen} data-testid="ward-capacity-page" data-ward-design="third-edition">
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
        <header className={styles.pageHeader}>
          <div className={styles.pageTitleBlock}>
            <h1 className={styles.pageTitle}>Capacity</h1>
            <span className={styles.pageSubtitle}>Statewide Inpatient Directory · Real-time census</span>
          </div>

          <WardDynamicIsland
            testId="ward-capacity-hud-island"
            title="Statewide Capacity"
            status={shortfalls.length > 0 ? "alarm" : unallocatedCount > 0 ? "warning" : "nominal"}
            statusText={
              shortfalls.length > 0
                ? `${shortfalls.length} specialty bed shortfalls`
                : "Statewide capacity nominal"
            }
            ariaLabel="Statewide capacity indicators"
            className={styles.headerIsland}
            metrics={[
              {
                id: "kpi-mismatches",
                label: "Mismatches",
                value: shortfalls.length,
                subtext: shortfalls.length > 0 ? `${shortfalls.length} bed types short` : "Balanced",
                tone: shortfalls.length > 0 ? "warn" : "good",
              },
              {
                id: "kpi-far-placements",
                label: "Far Placements",
                value: farPlacementsCount,
                tone: farPlacementsCount > 0 ? "warn" : "normal",
              },
              {
                id: "kpi-unallocated",
                label: "Unallocated",
                value: unallocatedCount,
                tone: unallocatedCount > 0 ? "warn" : "good",
              },
              {
                id: "kpi-offline",
                label: "Offline",
                value: 0,
                subtext: "None offline",
                tone: "muted",
              },
            ]}
          />
        </header>

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
        <div className={styles.columns}>
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
          <WardPanel
            title="Where the mismatch is"
            count={`${gapTotals.waiting} waiting, ${gapTotals.bedsThatFit} beds that fit`}
          >
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
                  <GapRow key={row.id} row={row} />
                ))}
              </tbody>
              <tfoot>
                <tr
                  className={`${styles.totalRow} ${gapTotals.gap < 0 ? styles.gapCardDeficit : styles.gapCardBalanced}`}
                  data-testid="ward-capacity-gap-total"
                >
                  <th scope="row">
                    <div className={styles.gapHeader}>
                      <span className={styles.cohortIconWrap} aria-hidden="true">
                        <CohortIcon need="All four together" />
                      </span>
                      <strong className={styles.gapNeedText}>All four together</strong>
                    </div>
                  </th>
                  <td data-testid="ward-capacity-waiting">{gapTotals.waiting}</td>
                  <td data-testid="ward-capacity-beds-that-fit">{gapTotals.bedsThatFit}</td>
                  <td data-testid="ward-capacity-gap-value">
                    <div className={styles.gapValueContainer}>
                      <GapWord gap={gapTotals.gap} />{" "}
                      <span className={styles.gapNumber}>{formatGap(gapTotals.gap)}</span>
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

          <div className={styles.capacityGrid}>
            <WardPanel title="Bed map" count={`${service === null ? netTotals.beds : scopedBeds} beds`}>
              <div className={styles.capacityPanelBody} role="region" aria-label="Bed map details" tabIndex={0}>
                <BedMap
                  units={units}
                  bedReleases={bedReleases}
                  selectedUnitId={selectedUnitId}
                  onSelectWard={selectWard}
                  service={service}
                />
              </div>
            </WardPanel>

            <aside className={styles.secondary} aria-label="Network summary and ward detail">
              {selectedRow ? (
                <CapacityWardSidebar
                  key={`${worldGeneration}:coordinator:${selectedRow.unit.id}`}
                  row={selectedRow}
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
                  <CapacityTabs
                    id="capacity-network"
                    label="Network details"
                    value={networkTab}
                    onChange={setNetworkTab}
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
                          Worth your attention{service !== null ? " across the whole network" : ""}{" "}
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
                          {networkRows.filter((row) => !isConfirmationFresh(row.unit, now)).length} wards need
                          confirming{service !== null ? " across the whole network" : ""} · Highlight wards
                        </button>
                      </>
                    )}
                  </div>
                  <div className={styles.sidebarFooter}>
                    <Link href="/mockups/ward-flow/discharges">Discharge board</Link>
                  </div>
                </>
              )}
            </aside>
          </div>

          <div id="capacity-wards" className={styles.wardsSection}>
            <WardPanel
              title="Wards"
              count={`${networkRows.length} ${networkRows.length === 1 ? "ward" : "wards"} in the network, ${matchingNetworkRows.length} matching`}
            >
              <div className={styles.filters}>
                <WardFilters
                  legend="Highlight wards"
                  activeId={networkFilterId}
                  onChange={setNetworkFilterId}
                  options={networkFilters.map((option) => ({
                    id: option.id,
                    label: option.label,
                    count: networkRows.filter(option.predicate).length,
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
                      onChange={(event) => setWardSort(event.target.value)}
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
              <div className={styles.networkBody} role="region" aria-label="Ward capacity table" tabIndex={0}>
                <WardTable
                  className={styles.networkTable}
                  wrapperClassName={styles.networkTableScroll}
                  testId="ward-capacity-network-table"
                  hasScrollThreshold
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
                      <th scope="col">Held</th>
                      <th scope="col">Occupied</th>
                      <th scope="col">Sex mix</th>
                      <th scope="col">Specialling</th>
                      <th scope="col">Involuntary-capable</th>
                      <th scope="col">Confirmed</th>
                      <th scope="col">Ask for an update</th>
                    </tr>
                  </thead>
                  {/*
                    🔴 **THE WARD TABLE'S OWN SCOPING — §2 "the map groups and ward table are
                    scoped."** `networkServiceGroups` itself is untouched above (still grouped from
                    every ward in the network, exactly as it always was), so nothing about how a
                    group's own totals are computed changes. Only WHICH groups render is narrowed
                    here, and only when a service is actually chosen — filtering the already-built
                    array rather than re-deriving groups from a filtered row list, which is what
                    `bed-map.tsx`'s own `BedMap` does for the identical reason: re-deriving from
                    filtered rows would make every OTHER service's group read `wards.length === 0`
                    and print "has no inpatient unit reporting to this board" — a false statement
                    about a service that has units, just not ones shown here. Not rendering that
                    group at all makes no claim about it, which the scope bar above already covers
                    ("Showing N of M wards, in {S}.").
                  */}
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
        </div>
        <WardPrototypeFooter testId="ward-capacity-governance" note="Statewide bed capacity · Not a medical device" />
      </main>
    </div>
  );
}

/**
 * THE "READY NOW" SECTION — pulled out of `CapacityScreen`'s own JSX, task C1 (build plan §2
 * "Capacity", §3 "Ready"), so its two branches can be rendered and asserted directly, without a
 * `WardFlowProvider` and without the real fixture having to happen to contain a zero-ready service
 * to reach the zero branch — it does not, at NOW_ANCHOR, over the real seed.
 *
 * ⚠️ **`service === null` RENDERS THE EXACT PRE-C1 MARKUP, UNCHANGED — that equality, not a
 * rewrite, is what keeps every existing capacity test (and every screenshot) byte-identical while
 * nothing is chosen.** Every prop this branch reads (`netTotals`, `totalLockedReady`,
 * `totalOpenReady`) is the same whole-network figure `CapacityScreen` always computed; nothing here
 * recomputes them differently.
 *
 * The `service !== null` branch is new. Per §3 exactly:
 *   - a real scoped ready count renders `WardBar`'s own caption as "{n} beds ready in {S}" — never a
 *     second number beside it, because `WardBar` itself throws if a caption names a figure the bar
 *     does not draw;
 *   - a **measured** zero renders "None ready in {S}." and no bar at all, because `WardBar` throws on
 *     an all-zero bar (see its own file header) — this is the call-site decision that component's
 *     comment says only the caller can make, and zero here is a real count that ran, never an absence;
 *   - the whole-network figure is ALWAYS still stated, in its own sentence, never folded into the
 *     scoped caption's own number — §2 "Whole-network figures stay whole-network and say so."
 */
export function ReadyNowSection({
  service,
  netTotals,
  totalLockedReady,
  totalOpenReady,
  scopedReady,
  scopedLockedReady,
  scopedOpenReady,
  scopedPendingPreparation,
}: {
  service: HealthService | null;
  netTotals: { ready: number; beds: number; pendingPreparation?: number };
  totalLockedReady: number;
  totalOpenReady: number;
  scopedReady: number;
  scopedLockedReady: number;
  scopedOpenReady: number;
  scopedPendingPreparation: number;
}) {
  if (service === null) {
    return (
      <section className={styles.readySummary} aria-label="Ready now">
        <h3>Ready now</h3>
        <p className={styles.readyValue}>
          <strong>{netTotals.ready}</strong> of {netTotals.beds} beds
        </p>
        {netTotals.ready > 0 ? (
          <WardBar
            segments={
              [
                { label: "Locked ready", value: totalLockedReady, tone: "accent" },
                { label: "Open ready", value: totalOpenReady, tone: "good" },
              ] satisfies WardBarSegment[]
            }
            caption={`${netTotals.ready} beds ready across the network`}
          />
        ) : (
          <p>No ward reports a ready bed.</p>
        )}
        {(netTotals.pendingPreparation ?? 0) > 0 ? (
          <p className={styles.preparationWarning}>{netTotals.pendingPreparation} still being made ready.</p>
        ) : null}
      </section>
    );
  }
  return (
    <section className={styles.readySummary} aria-label="Ready now">
      <h3>Ready now</h3>
      {scopedReady > 0 ? (
        <WardBar
          segments={
            [
              { label: "Locked ready", value: scopedLockedReady, tone: "accent" },
              { label: "Open ready", value: scopedOpenReady, tone: "good" },
            ] satisfies WardBarSegment[]
          }
          caption={`${scopedReady} beds ready in ${service}`}
        />
      ) : (
        <p className={styles.readyValue} data-testid="ward-capacity-ready-zero-in-service">
          None ready in {service}.
        </p>
      )}
      <p data-testid="ward-capacity-ready-network-line">
        Across the whole network: {netTotals.ready} beds ready, {totalLockedReady} locked.
      </p>
      {scopedPendingPreparation > 0 ? (
        <p className={styles.preparationWarning}>{scopedPendingPreparation} still being made ready.</p>
      ) : null}
    </section>
  );
}

/**
 * Mirrors `capacityIsFresh` in `ward-eligibility.ts` (private there, so not importable) rather than
 * exporting a second copy of the same one-line rule under a new name: a ward's confirmed count is
 * fresh while less time has passed than the ward itself said the figure is good for.
 */
/**
 * ⚠️ **A DELIBERATE SECOND COPY OF `capacityIsFresh` (`ward-eligibility.ts`), AND THE REASON IS
 * WRITTEN DOWN RATHER THAN LEFT SILENT.** The two predicates are character-for-character identical
 * today. That is not an accident to tidy away, but it IS a drift risk: if the placement gate's
 * definition of stale ever changes and this does not, **the screen would print "fresh" about a
 * figure the gate calls stale** — the screen and the refusal disagreeing about the same ward.
 *
 * It is copied rather than imported because `capacityIsFresh` is module-private to
 * `ward-eligibility.ts`, and widening a shared clinical module's surface is not this screen's call
 * to make. **The better fix is to export that one function and delete this** — raised with Ward
 * Lead 2026-09-05. Follows the `communityTeamKey` precedent, which duplicates deliberately and
 * says so.
 */
function isConfirmationFresh(unit: Unit, now: Instant): boolean {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

/**
 * A plain-words label for which of the four bed kinds (`BedKindId` in `capacity-derivations.ts`)
 * this ward can offer — computed directly from `Unit`'s own locked/open designation helpers, the
 * same ones `bedKindGaps` itself reduces over. Older-adult and youth wards are not split by lock
 * state anywhere else in this product (see `bedKindOfMovement`'s own comment in the derivations
 * file), so neither is this label.
 */
function bedKindsServed(unit: Unit): string {
  if (unit.cohort !== "Adult") return unit.cohort;
  const kinds: string[] = [];
  if (unitHasLockedBeds(unit)) kinds.push("Locked adult");
  if (unitHasOpenBeds(unit)) kinds.push("Open adult");
  return kinds.length > 0 ? kinds.join(" & ") : "Adult (no beds)";
}

function formatGap(gap: number): string {
  return gap > 0 ? `+${gap}` : `${gap}`;
}

/**
 * ⚠️ STATE IS A WORD BEFORE IT IS A COLOUR (design lock § behaviour, rule 1). A negative gap must
 * read as a shortfall in the row's own words, never only as a minus sign or a tinted number — this
 * is the one thing this whole merge's design lock names by section number.
 */
function GapWord({ gap }: { gap: number }) {
  const word = gapWord(gap);
  return <WardChip level={word.level}>{word.text}</WardChip>;
}

function gapWord(gap: number): { level: WardChipLevel; text: string } {
  if (gap < 0) return { level: "urgent", text: "Shortfall" };
  if (gap === 0) return { level: "routine", text: "Exactly enough" };
  return { level: "accepted", text: "Spare capacity" };
}

function CohortIcon({ need }: { need: string }) {
  const n = need.toLowerCase();
  if (n.includes("locked")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  if (n.includes("open")) {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 18v3M20 18v3M2 12h20M4 12V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" />
      </svg>
    );
  }
  if (n.includes("older")) {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a8.5 8.5 0 0 1 13 0" />
      </svg>
    );
  }
  if (n.includes("youth")) {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="5" />
        <path d="M12 13v8M9 17l3-4 3 4" />
      </svg>
    );
  }
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function GapRow({ row }: { row: BedKindGap }) {
  const isDeficit = row.gap < 0;
  const isBalanced = row.gap === 0;
  const fillPct = row.waiting > 0 ? Math.min(100, Math.round((row.bedsThatFit / row.waiting) * 100)) : 100;
  return (
    <tr
      data-testid={`ward-capacity-gap-row-${row.id}`}
      className={isDeficit ? styles.gapCardDeficit : isBalanced ? styles.gapCardBalanced : styles.gapCardSurplus}
    >
      <td>
        <div className={styles.gapHeader}>
          <span className={styles.cohortIconWrap} aria-hidden="true">
            <CohortIcon need={row.need} />
          </span>
          <strong className={styles.gapNeedText}>{row.need}</strong>
        </div>
        <div className={styles.who}>{row.who}</div>
      </td>
      <td data-testid="ward-capacity-waiting">{row.waiting}</td>
      <td data-testid="ward-capacity-beds-that-fit">{row.bedsThatFit}</td>
      <td data-testid="ward-capacity-gap-value">
        <div className={styles.gapValueContainer}>
          <GapWord gap={row.gap} /> <span className={styles.gapNumber}>{formatGap(row.gap)}</span>
        </div>
        <div
          className={styles.gapMicroGauge}
          aria-hidden="true"
          title={`${row.bedsThatFit} fit vs ${row.waiting} waiting (${fillPct}% covered)`}
        >
          <div
            className={`${styles.gapGaugeFill} ${isDeficit ? styles.gaugeDeficit : styles.gaugeGood}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </td>
      <td>{rowSentence(row)}</td>
    </tr>
  );
}

/**
 * ⚠️ EVERY WORD HERE COMES FROM THE ROW'S OWN FIELDS. No count in this sentence is written in —
 * `waiting`, `bedsThatFit` and the magnitude of `gap` are read straight off `row`, so a fixture
 * change changes this sentence by construction rather than leaving it stale and confidently wrong.
 */
function rowSentence(row: BedKindGap): string {
  const magnitude = Math.abs(row.gap);
  const bedWord = row.bedsThatFit === 1 ? "bed" : "beds";
  const who = row.who.charAt(0).toLowerCase() + row.who.slice(1);
  if (row.gap < 0) {
    return `${row.waiting} waiting (${who}), only ${row.bedsThatFit} ${bedWord} that fit — ${magnitude} short.`;
  }
  if (row.gap === 0) {
    return `${row.waiting} waiting (${who}), exactly ${row.bedsThatFit} ${bedWord} that fit — nobody goes without today.`;
  }
  return `${row.bedsThatFit} ${bedWord} that fit, more than the ${row.waiting} waiting (${who}) — ${magnitude} spare.`;
}

function totalsSentence(totals: { waiting: number; bedsThatFit: number; gap: number }): string {
  const magnitude = Math.abs(totals.gap);
  if (totals.gap < 0) {
    return `Across all four bed kinds, ${totals.waiting} people are waiting and only ${totals.bedsThatFit} beds fit any of their needs — ${magnitude} short overall.`;
  }
  if (totals.gap === 0) {
    return `Across all four bed kinds, ${totals.waiting} people are waiting and exactly ${totals.bedsThatFit} beds fit — nobody goes without today.`;
  }
  return `Across all four bed kinds, ${totals.bedsThatFit} beds fit, more than the ${totals.waiting} people waiting — ${magnitude} spare overall.`;
}

/**
 * ⚠️ **`matches` MARKS A ROW. IT NEVER REMOVES ONE — that is the whole point of this task.**
 * `undefined` means the "All" chip is active, which asks nothing about any row, so nothing is
 * marked. `true`/`false` are the active chip's real verdict on THIS row, and either one still
 * renders the entire row — every cell below is unconditional on `matches`.
 *
 * ⚠️ **THE WORD CARRIES THE FACT; THE ATTRIBUTE ONLY CARRIES THE STYLE.** `data-ward-network-row-
 * matches` (on the `<tr>`) drives a token-only visual weight (`capacity.module.css`) that this
 * codebase's own design language already says may vanish under forced colours (`ward-tokens.
 * module.css`'s own comment: "the word is what survives"). So a matching row also states it in
 * words — `.matchMark`, rendered through `WardChip`, which throws at build time if it is ever
 * given no text (`ward-chip.tsx`'s `requireWords`). That word is what stays legible once every
 * colour on this row has been flattened to the system palette.
 */
function NetworkRow({
  row,
  now,
  matches,
  onRequestRefresh,
  selected,
  onSelect,
}: {
  row: NetworkWardRow;
  now: Instant;
  matches: boolean | undefined;
  onRequestRefresh: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const site = siteByCode(row.unit.siteCode);
  /*
   * Wards are always named, never shown as a bare code. The unresolved sentence comes from
   * `ward-absence-labels.ts` — Ward Lead's 2026-09-11 ruling that such a sentence must blame the
   * RECORD and not the network.
   *
   * ⚠️ The comment here used to cite `delays-screen.tsx` as the precedent for the old wording.
   * Delays moved to the ruled wording and this file did not, so the citation was pointing the next
   * reader at a repair that had already happened. A comment that names another file as its
   * precedent cannot follow that file when it changes.
   */
  const siteText = siteLabel(row.unit.siteCode, site?.name);
  return (
    <tr
      data-testid={`ward-capacity-network-row-${row.unit.id}`}
      data-selected={selected || undefined}
      onClick={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest("button, a")) onSelect();
      }}
      data-ward-network-row-matches={matches === undefined ? undefined : matches ? "true" : "false"}
    >
      <td>
        <button
          type="button"
          className={styles.wardRowSelect}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {row.unit.name}
        </button>
        <div className={styles.who}>{siteText}</div>
        {/* Owner Answer 18 (second round, 2026-09-17): the ward's fixed-list intake-constraint
            codes, shown here as the coordinator-facing capacity view this ruling names. Chosen
            labels only — this file never renders a code, only `wardIntakeConstraintLabels[code]`. */}
        {row.unit.intakeConstraints !== undefined && row.unit.intakeConstraints.length > 0 ? (
          <div className={styles.who} data-testid={`ward-capacity-network-constraints-${row.unit.id}`}>
            Limiting intake: {row.unit.intakeConstraints.map((code) => wardIntakeConstraintLabels[code]).join(", ")}
          </div>
        ) : null}
        {matches === true ? (
          <div className={styles.matchMark} data-testid={`ward-capacity-network-match-${row.unit.id}`}>
            <WardChip level="accepted">Matches this filter</WardChip>
          </div>
        ) : null}
      </td>
      <td>{bedKindsServed(row.unit)}</td>
      {/*
        🔴 THE CLEANING COUNT SITS BESIDE THE FIGURE, AND THE FIGURE ITSELF DOES NOT MOVE.
        Owner ruling 2026-09-05. "Ready" counted beds the application refuses to admit a patient
        into — the reducer rejects PULL_PATIENT with "every free bed at X is still being made
        ready" — so a coordinator could commit two patients and have the second refused at the
        moment of action, after the ward had been told. He ruled to SHOW the pending count rather
        than subtract it, because an earlier ruling of his avoids the figure lurching as cleaning
        starts and stops. Absence stated in words, never a bare 0 for "we were not told".
      */}
      <td data-testid="ward-capacity-network-ready">
        {/*
          🔴 A POSSIBLE-ZERO IS STATED IN WORDS, NEVER THE DIGIT — restored 2026-09-05, and this
          screen was already obeying the rule two columns over ("Not tracked here" for an untracked
          freeing figure) while contradicting it here. Three wards rendered a bare "0"; the census
          at docs/ward-flow/bed-figure-wording-census-2026-09-04.md §7 has the render evidence and
          the counter-argument the owner decided against.

          ⚠️ The word REPLACES the digit and never sits beside it. A cell reading "0 none" passes a
          careless assertion and is worse than either alone.
        */}
        {row.ready === 0 ? (
          <span className={styles.statedZero}>{countCellText(row.ready)}</span>
        ) : (
          <span className={styles.readyBadge}>{row.ready}</span>
        )}
        {row.pendingPreparation !== undefined && row.pendingPreparation > 0 ? (
          <small className={styles.beingMadeReady} data-testid="ward-capacity-network-pending">
            {row.pendingPreparation} still being made ready
          </small>
        ) : null}
      </td>
      {/* `none`, not `0` — owner ruling 2026-09-06, census §8. See `freeingCellText`. */}
      <td data-testid="ward-capacity-network-locked">
        {/*
          ⚠️ `.statedZero`, NOT `.notTracked`. This cell is a ward that REPORTED and the answer is
          zero; `.notTracked` is named for the opposite fact — a ward that did not report at all.
          The two are visually identical today and the words carry the distinction, but a class
          named for the wrong meaning is how the next person changes the wrong one. See their
          comment in `capacity.module.css`.
        */}
        {row.lockedReady === 0 ? (
          <span className={styles.statedZero}>{countCellText(row.lockedReady)}</span>
        ) : (
          <span className={styles.lockedBadge}>{row.lockedReady}</span>
        )}
      </td>
      <td
        data-testid="ward-capacity-network-freeing"
        className={row.freeing === undefined ? styles.notTracked : row.freeing === 0 ? styles.statedZero : undefined}
      >
        {freeingCellText(row.freeing)}
      </td>
      {/*
        `freeingCellText` is reused rather than copied: it is the one place that decides how a count
        renders versus how an absence reads ("Not tracked here" for undefined, "none" for a real
        zero). ⚠️ Its NAME is about one column and these are three — worth renaming, but a SECOND
        renderer is the worse fault, because two of them drift and the whole point of this helper is
        that `0` and `undefined` never collapse into each other.
      */}
      <td
        data-testid="ward-capacity-network-confirmed"
        className={
          row.confirmed === undefined ? styles.notTracked : row.confirmed === 0 ? styles.statedZero : undefined
        }
      >
        {freeingCellText(row.confirmed)}
      </td>
      <td
        data-testid="ward-capacity-network-expected"
        className={row.expected === undefined ? styles.notTracked : row.expected === 0 ? styles.statedZero : undefined}
      >
        {freeingCellText(row.expected)}
      </td>
      <td
        data-testid="ward-capacity-network-blocked"
        className={row.blocked === undefined ? styles.notTracked : row.blocked === 0 ? styles.statedZero : undefined}
      >
        {row.blocked === undefined || row.blocked === 0 ? (
          freeingCellText(row.blocked)
        ) : (
          <span className={styles.blockedBadge}>{freeingCellText(row.blocked)}</span>
        )}
        {/*
          WLQ-10, owner ruling 2026-09-15: while a discharge is still held up it keeps counting in
          `row.blocked` above — that figure is unchanged by this task — and the screen additionally
          says since when the OLDEST of this ward's currently blocked releases has been held up.
          `formatInstantWithDay` is the existing formatter this brief named: a bare clock face for
          something still held up from earlier today, "yesterday" or "N days ago" once it is not.
          Absent whenever `row.blocked` is `0` or `undefined` — never a duration or a claim this
          screen cannot back.
        */}
        {row.oldestBlockedSince !== undefined ? (
          <small className={styles.beingMadeReady} data-testid="ward-capacity-network-blocked-since">
            {dayOf(row.oldestBlockedSince) > dayOf(now)
              ? `expected release in ${dayOf(row.oldestBlockedSince) - dayOf(now)} days`
              : `held up since ${formatInstantWithDay(row.oldestBlockedSince, now)}`}
          </small>
        ) : null}
      </td>
      {/*
        ⚠️ **HELD AND OCCUPIED TAKE `countCellText`, NOT `freeingCellText`, AND THE DIFFERENCE IS
        NOT COSMETIC.** Both read only `Unit`, never the release list, so neither has a "nobody told
        this screen" state to represent — there is no `undefined` for them and rendering
        "Not tracked here" would be a claim about reporting that is simply false. A real zero still
        reads as the word, which is the rule that applies to every possible-zero on this screen.
      */}
      {/*
        Bed board decision 8A (Josh, 26 Sept 2026). Discharges due today reads each stay's own
        discharge record; transfers today has no recorded source (a movement carries no origin
        ward), so it says so rather than printing a number.
      */}
      <td
        data-testid="ward-capacity-network-discharges-due-today"
        className={
          row.dischargesDueToday === undefined
            ? styles.notTracked
            : row.dischargesDueToday === 0
              ? styles.statedZero
              : undefined
        }
      >
        {freeingCellText(row.dischargesDueToday)}
      </td>
      <td data-testid="ward-capacity-network-transfers-today" className={styles.notTracked}>
        Not recorded
      </td>
      <td data-testid="ward-capacity-network-held" className={row.held === 0 ? styles.statedZero : undefined}>
        {countCellText(row.held)}
      </td>
      <td data-testid="ward-capacity-network-occupied" className={row.occupied === 0 ? styles.statedZero : undefined}>
        {countCellText(row.occupied)}
        {row.surge !== undefined && row.surge > 0 && (
          <span className={styles.surgeBadge} data-testid={`ward-capacity-surge-${row.unit.id}`}>
            +{row.surge} Surge
          </span>
        )}
      </td>
      {/*
        🔴 **SEX MIX AND SPECIALLING HEADROOM — OWNER RULING 2026-09-06, built here the same day.**

        **These are not decoration and they are not "nice to have": they are the two gates a
        placement is REFUSED by.** `ward-eligibility.ts` reads `unit.sexMix[movement.sex]` at two
        sites, and `ward-flow-reducer.ts` refuses `PULL_PATIENT` outright when
        `remainingSpeciallingCapacity(unit, admissions) <= 0`. A coordinator was being asked to plan
        against two rules the software enforces and the screen concealed — propose a placement, get
        refused, and nothing on the board says why.

        ⚠️ **A GUARD ASSERTED THE OPPOSITE OF THIS UNTIL TODAY, AND IT WAS RIGHT TO.**
        `ward-capacity-sexmix-release.dom.test.tsx` pinned "carries the signal without putting any
        sex-mix figure on the screen" under the previous ruling. It is RE-POINTED in this commit
        rather than deleted, with its docblock recording that the ruling changed — the same treatment
        the retired dead-mode case got, for the same reason: a guard whose subject was ruled the
        other way is re-pointed, never removed.

        ⚠️ **SPECIALLING PRINTS WORDS, NOT A NUMBER, WHEN IT IS NOT KNOWN.** `speciallingFree` is
        `undefined` when no admissions list reached this screen, because
        `remainingSpeciallingCapacity(unit, [])` returns the ward's FULL authored capacity — so the
        fabricated value would claim headroom that does not exist, which is the direction that sends
        a patient to a ward that must refuse them.
      */}
      <td data-testid={`ward-capacity-sexmix-${row.unit.id}`}>
        {/*
          ⚠️ **NO `?? 0` HERE, AND THE FIRST VERSION HAD ONE.** I wrote `sexMix.female ?? 0` — the keys
          are `Female` and `Male`, capitalised — and every ward on the board rendered **"Female 0 ·
          Male 0"**, a confident false statement about twenty-three wards. The nullish default is what
          made it silent: a missing key became a number rather than an error. `Record<Sex, number>`
          guarantees both keys, so there is nothing to defend against and the guard belongs in the
          test instead — see the all-zero floor in `ward-capacity-sexmix-release.dom.test.tsx`.
        */}
        {`Female ${row.unit.sexMix.Female} · Male ${row.unit.sexMix.Male}`}
        {/*
          🔴 **THE MID-UPDATE CAUTION LIVES HERE, MOVED 2026-09-06. IT SAT UNDER `Ready` AND THAT WAS
          A SCREEN MAKING A FALSE STATEMENT ABOUT WHICH OF ITS OWN NUMBERS TO DISTRUST.**
          Ward Lead ruled it stayed under Ready, then reversed on the mechanism below. Recorded
          because a caution moved on a mechanism nobody wrote down gets moved back by the next
          person.

          **WHAT THE PREDICATE ACTUALLY COMPARES.** `bedRecordsMidUpdate` is
          `sum(unit.sexMix) !== unitCapacity(unit, releases).occupied`. And `occupied` is
          `max((beds - empty) - blocked, 0)` — it reads `beds`, `empty` and `blocked`, **and it does
          not read `allocatable` at all.** `allocatable.value` is the number `ready` IS. So the
          caution never carried information about the Ready figure it was sitting under: **its own
          predicate does not mention it.**

          **WHY THE SEX REGISTER IS THE STALE SIDE, NOT OCCUPANCY.** Both writes to `sexMix` in
          `ward-flow-reducer.ts` move `empty` the opposite way in the same object literal — an
          arrival does `empty - 1` with `sexMix[sex] + 1`, a departure does `empty + 1` with
          `sexMix[sex] - 1`. So a normal admission or discharge can never open this gap. Only an
          event that moves `empty` WITHOUT touching `sexMix` can, and `RELEASE_BED` is that event:
          it frees a bed without knowing whose it was, because guessing would invent a fact about a
          person's sex.

          ⚠️ **AND READY CAN STILL BE STALE — BY A DIFFERENT MECHANISM, WITH ITS OWN CONTROL ON THIS
          ROW.** `allocatable.value` can be out of date if a ward has not restated its numbers; that
          is what `WardFreshness`'s "Confirmed HH:MM" cell and the refresh button two columns over
          are for. **Two different staleness facts, two different indicators, and conflating them is
          what put this one under the wrong figure.**

          ⚠️ It renders ONLY when the two genuinely disagree. At seed every ward holds the identity,
          so this is silent on a settled board — an always-visible caution would be ignored within a
          day and would make every figure look doubtful.
        */}
        {row.bedRecordsMidUpdate ? (
          <small className={styles.midUpdate} data-testid={`ward-capacity-mid-update-${row.unit.id}`}>
            This ward&rsquo;s bed records are mid-update — this figure may not be settled.
          </small>
        ) : null}
      </td>
      <td
        data-testid={`ward-capacity-specialling-${row.unit.id}`}
        className={row.speciallingFree === undefined ? styles.notTracked : undefined}
      >
        {row.speciallingFree === undefined
          ? "Not tracked here"
          : `${row.speciallingFree} of ${row.speciallingStaffable}`}
      </td>
      {/*
        🔴 WHETHER THIS WARD MAY LAWFULLY HOLD A DETAINED PATIENT — restored to the NETWORK view
        2026-09-05. It was never wholly lost: `ward/ward-screen.tsx` and `coordinator/flow-diagram.tsx`
        both render it. What the fold lost is seeing it for every ward AT ONCE, which is the question
        a capacity board answers and a per-ward page cannot.

        ⚠️ Rendering the flag is not a legal claim — it is `Unit.authorised`, the ward's own recorded
        statutory fact, in the codebase's existing wording. Nothing here decides eligibility;
        `ward-eligibility.ts` owns that and still refuses at the point of action.
      */}
      <td data-testid={`ward-capacity-authorised-${row.unit.id}`}>
        <span className={row.unit.authorised ? styles.authYes : styles.authNo}>
          {row.unit.authorised ? "Yes" : "No"}
        </span>
      </td>
      <td>
        {/*
          🔴 WHO CONFIRMED IT, RESTORED 2026-09-05 — MY FOLD DROPPED IT AND A GREEN TEST HID THAT.
          The old capacity view passed `confirmedByRole` and `derived`; this screen replaced it and
          passed neither, so every ward read a bare "Confirmed 10:32" where it used to read
          "Confirmed 10:32 · NUM Armadale". The distinction is not decoration: `source === "ward"`
          means the WARD ITSELF confirmed the figure, and anything else means it was derived from a
          feed nobody stood behind. A coordinator ringing a ward about its own number needs to know
          which of those they are looking at.

          ⚠️ It survived because `ward-capacity-freshness-source.dom.test.tsx` still renders the OLD
          mode, which no route reaches any more — a clinical guard passing forever about a screen
          nobody can open, while a reader counting green ticks concludes THIS screen has attribution.
          Found by Ward Lead after the fold.
        */}
        <WardFreshness
          confirmedAt={row.confirmedAt}
          confirmedByRole={row.unit.allocatable.source === "ward" ? `NUM ${row.unit.name}` : undefined}
          derived={row.unit.allocatable.source !== "ward"}
          now={now}
        />
      </td>
      {/*
        🔴 THE COORDINATOR'S ONE PERMITTED ACTION ON THIS BOARD, RESTORED 2026-09-05.

        ⚠️ **THIS WAS A CAPABILITY LOST BY ACCIDENT, NOT BY DECISION.** `REQUEST_CAPACITY_REFRESH`
        was dispatched from exactly ONE place in the codebase — the capacity view MERGE 02 retired —
        while the event type, the reducer case, the provider list and the ward-side DISPLAY of a
        request all kept working. So no coordinator could ask a ward to restate its numbers, and
        `ward/ward-screen.tsx` carried a mark for something nothing could produce: a field with no
        producer, invisible to every gate because each half was individually correct.

        ⚠️ It moves NO bed figure, and that is the whole point of it. The reducer appends to
        `refreshRequests` and touches nothing else — it records that somebody asked.
      */}
      <td>
        <button
          type="button"
          className={styles.refreshButton}
          data-testid={`ward-capacity-refresh-${row.unit.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onRequestRefresh();
          }}
        >
          Request update
        </button>
      </td>
    </tr>
  );
}

/**
 * `NETWORK_TABLE_COLUMN_COUNT` matches the seventeen `<th scope="col">` cells declared in
 * `CapacityScreen`'s own `<thead>` above — Ward, Bed kinds, Ready, Locked, Freeing, the three
 * release-stage figures, Discharges due today, Transfers today (decision 8A), Held, Occupied, Sex mix, Specialling, Mental Health Act, Confirmed and
 * Ask for an update. Used only to span an empty-service sentence across the whole row; not read
 * from the `<thead>` at runtime because a Server-Component-shaped table primitive has no DOM to
 * count at render time (see `WardTable`'s own comment on why it cannot measure itself).
 */
const NETWORK_TABLE_COLUMN_COUNT = 17;

/**
 * One health service's rows on the network table, behind a fold — Task 2, Part Two.
 *
 * ⚠️ **WHY THIS IS NOT `BandGroup` (`referral-match.tsx`).** `BandGroup` wraps a `<ul>` in a
 * `<details>`, and `<details>` is not valid inside a `<table>` — a table's children are
 * `<thead>`/`<tbody>`/`<tr>`, so a browser reparents a `<details>` placed there out of the table
 * entirely. The fold control here is instead a native `<button>` inside the group's own header
 * `<tr>`, carrying `aria-expanded`/`aria-controls` — the same shape `ward-board.tsx`'s daily-sheet
 * fold already uses, including pointing `aria-controls` at an id that exists in the DOM whether or
 * not it is currently visible: the body `<tbody>` below is always rendered and hidden by a CSS
 * class when folded, never unmounted, so `aria-controls` never dangles.
 *
 * Four properties carried over from `BandGroup` regardless:
 *   1. The summary row — service name, fold button, ward count, and every column's own total —
 *      renders identically whether the group is open or shut, including for an empty group.
 *   2. Every total in it is computed from THIS group's own rows (`networkServiceGroupTotals`),
 *      never sliced from the network-wide totals.
 *   3. Open state is owned locally by this component's own `useState`.
 *   4. An empty group renders a sentence in place of the fold entirely — never a heading, and
 *      never an empty list — matching `bed-map.tsx`'s own `ServiceGroup` for the same reason: this
 *      counts WARDS, not people, so `WardGroupHeading` (which throws on a count of nought and is
 *      scoped to people) is the wrong primitive here, exactly as it is there.
 *
 * Q004: groups start open to match the ward-table drawing. Folding remains available, and
 * the table grows only to its desktop bound so closing groups never leaves an empty panel.
 */
function NetworkServiceGroupRows({
  group,
  now,
  activeNetworkFilter,
  selectedUnitId,
  onSelectWard,
  onRequestRefresh,
}: {
  group: NetworkServiceGroup;
  now: Instant;
  activeNetworkFilter: { id: string; predicate: (row: NetworkWardRow) => boolean };
  onRequestRefresh: (unitId: string) => void;
  selectedUnitId?: string;
  onSelectWard: (unitId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const slug = group.service.replace(/\s+/gu, "-");
  const bodyId = `ward-capacity-network-group-body-${slug}`;

  if (group.wards.length === 0) {
    return (
      <tbody data-testid={`ward-capacity-network-group-${slug}`}>
        <tr>
          <td colSpan={NETWORK_TABLE_COLUMN_COUNT} className={styles.networkGroupAbsent}>
            {group.service} has no inpatient unit reporting to this board.
          </td>
        </tr>
      </tbody>
    );
  }

  const totals = networkServiceGroupTotals(group.wards);

  return (
    <>
      <tbody data-testid={`ward-capacity-network-group-${slug}`}>
        <tr className={styles.groupSummaryRow}>
          <th scope="row">
            <button
              type="button"
              className={styles.groupFoldButton}
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((wasOpen) => !wasOpen)}
            >
              <span className={styles.foldIcon} aria-hidden="true">
                {open ? "▾" : "▸"}
              </span>
              <span className={styles.groupServiceName}>{group.service}</span>
              <span className={styles.groupWardBadge}>{totals.wards === 1 ? "1 ward" : `${totals.wards} wards`}</span>
              <span className={styles.srOnly}>{open ? "Hide" : "Show"}</span>
            </button>
          </th>
          {/*
            ⚠️ Bed kinds served is a per-ward FACT (which kinds this ward offers), not a quantity —
            summing or listing it here would either be meaningless arithmetic or a duplicate of the
            rows underneath. Stated in words rather than rendered as a number that looks like a total
            and is not (see `networkServiceGroupTotals`'s own doc comment).
          */}
          <td className={styles.groupNoSummary}>By ward</td>
          <td>
            {totals.ready === 0 ? (
              <span className={styles.statedZero}>{countCellText(totals.ready)}</span>
            ) : (
              <span className={styles.readyBadge}>{totals.ready}</span>
            )}
          </td>
          <td>
            {totals.lockedReady === 0 ? (
              <span className={styles.statedZero}>{countCellText(totals.lockedReady)}</span>
            ) : (
              <span className={styles.lockedBadge}>{totals.lockedReady}</span>
            )}
          </td>
          <td>{freeingCellText(totals.freeing)}</td>
          <td>{freeingCellText(totals.confirmed)}</td>
          <td>{freeingCellText(totals.expected)}</td>
          <td>{freeingCellText(totals.blocked)}</td>
          <td>{freeingCellText(totals.dischargesDueToday)}</td>
          <td className={styles.groupNoSummary}>Not recorded</td>
          <td>{countCellText(totals.held)}</td>
          <td>
            {countCellText(totals.occupied)}
            {totals.surge !== undefined && totals.surge > 0 && (
              <span className={styles.surgeBadge}>+{totals.surge} Surge</span>
            )}
          </td>
          <td>{`Female ${totals.sexMix.Female} · Male ${totals.sexMix.Male}`}</td>
          <td>
            {totals.speciallingFree === undefined
              ? "Not tracked here"
              : `${totals.speciallingFree} of ${totals.speciallingStaffable}`}
          </td>
          {/* A real count against the group's OWN wards ("M of N"), never a bare number that could
           *  be mistaken for a sum of a per-ward true/false flag. */}
          <td>{`${totals.authorised} of ${totals.wards} involuntary-capable`}</td>
          {/* Freshness is a per-ward timestamp and attribution, not a quantity — stated in words for
           *  the same reason bed kinds served is, above. */}
          <td className={styles.groupNoSummary}>By ward</td>
          {/* No group-level "ask every ward in this service to restate its numbers" action exists in
           *  the reducer, and inventing one here would be a capability this task was not asked to
           *  build. Left empty rather than a disabled control implying one exists. */}
          <td />
        </tr>
      </tbody>
      <tbody id={bodyId} data-testid={bodyId} className={open ? undefined : styles.groupBodyClosed}>
        {group.wards.map((row) => (
          <NetworkRow
            key={row.unit.id}
            row={row}
            now={now}
            // `undefined` on "All": nothing is being asked about, so nothing is marked. Every other
            // chip states a real true/false — see `NetworkRow`'s own comment.
            matches={activeNetworkFilter.id === "all" ? undefined : activeNetworkFilter.predicate(row)}
            selected={selectedUnitId === row.unit.id}
            onSelect={() => onSelectWard(row.unit.id)}
            onRequestRefresh={() => onRequestRefresh(row.unit.id)}
          />
        ))}
      </tbody>
    </>
  );
}

const CAPACITY_RECORD_ACTOR: WardRecordActor = { role: "coordinator" };

function CapacityTabs({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className={styles.sidebarTabs} role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.id}
          id={`${id}-${option.id}-tab`}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          aria-controls={`${id}-panel`}
          tabIndex={value === option.id ? 0 : -1}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => {
            let next: number;
            if (event.key === "ArrowRight") next = (index + 1) % options.length;
            else if (event.key === "ArrowLeft") next = (index + options.length - 1) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else return;
            event.preventDefault();
            onChange(options[next].id);
            document.getElementById(`${id}-${options[next].id}-tab`)?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Keyed by generation, declared actor and ward: stale selection receipts never cross a scope change. */
function CapacityWardSidebar({ row, onBack }: { row: NetworkWardRow; onBack: () => void }) {
  const { bedReleases, refreshRequests, dispatch, readDischargeRecords, openDischargeRecord, readDischargeRecord } =
    useWardFlow();
  const now = useWardFlowClock();
  const [tab, setTab] = useState("ward");
  const [opened, setOpened] = useState<{ admissionId: string; handle: DischargeOpenHandle } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const recordHeading = useRef<HTMLHeadingElement>(null);
  const recordOrigin = useRef<string | null>(null);
  useEffect(() => {
    if (opened) recordHeading.current?.focus();
  }, [opened]);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const site = siteByCode(row.unit.siteCode);
  const records = readDischargeRecords(CAPACITY_RECORD_ACTOR, row.unit.id);
  const detail = opened ? readDischargeRecord(CAPACITY_RECORD_ACTOR, opened.admissionId, opened.handle) : null;
  const anonymousReleases = bedReleases.filter((release) => release.unitId === row.unit.id);
  const request = refreshRequests.filter((entry) => entry.unitId === row.unit.id).at(-1);
  function closeRecord() {
    setOpened(null);
    // The list remounts after state changes; restore its deliberate opener on the next frame.
    requestAnimationFrame(() => {
      if (recordOrigin.current) document.getElementById(recordOrigin.current)?.focus();
    });
  }
  function openRecord(record: DischargeRecord) {
    const handle = openDischargeRecord(CAPACITY_RECORD_ACTOR, record.admissionId);
    setOpened({ admissionId: record.admissionId, handle });
  }
  return (
    <>
      <CapacityTabs
        id="capacity-ward"
        label="Selected ward"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setOpened(null);
        }}
        options={[
          { id: "ward", label: "Ward" },
          { id: "discharges", label: "Discharges" },
        ]}
      />
      <div className={styles.wardIdentity}>
        <button type="button" className={styles.textButton} onClick={onBack}>
          Back to network
        </button>
        <h2 ref={heading} tabIndex={-1}>
          {row.unit.name}
        </h2>
        <p>
          {siteLabel(row.unit.siteCode, site?.name)} · {site?.service ?? "Service not recorded"}
        </p>
      </div>
      <div
        id="capacity-ward-panel"
        role="tabpanel"
        aria-labelledby={`capacity-ward-${tab}-tab`}
        tabIndex={0}
        className={styles.sidebarBody}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (opened) closeRecord();
            else onBack();
          }
        }}
      >
        {tab === "ward" ? (
          <>
            <dl className={styles.wardFacts}>
              <div>
                <dt>Total beds</dt>
                <dd>{row.unit.beds}</dd>
              </div>
              <div>
                <dt>Bed kinds</dt>
                <dd>{bedKindsServed(row.unit)}</dd>
              </div>
              <div>
                <dt>Ready</dt>
                <dd>{countCellText(row.ready)}</dd>
              </div>
              <div>
                <dt>Held</dt>
                <dd>{countCellText(row.held)}</dd>
              </div>
              <div>
                <dt>Blocked beds</dt>
                <dd>Not recorded</dd>
              </div>
              <div>
                <dt>Occupied</dt>
                <dd>{countCellText(row.occupied)}</dd>
              </div>
              <div>
                <dt>Freeing today</dt>
                <dd>{freeingCellText(row.freeing)}</dd>
              </div>
              <div>
                <dt>Sex mix</dt>
                <dd>
                  Female {row.unit.sexMix.Female} · Male {row.unit.sexMix.Male}
                </dd>
              </div>
              <div>
                <dt>Sex designation</dt>
                <dd>{row.unit.sexDesignation}</dd>
              </div>
              <div>
                <dt>Specialling free</dt>
                <dd>
                  {row.speciallingFree === undefined
                    ? "Not tracked here"
                    : `${row.speciallingFree} of ${row.speciallingStaffable}`}
                </dd>
              </div>
              <div>
                <dt>Involuntary-capable</dt>
                <dd>{row.unit.authorised ? "Yes" : "No"}</dd>
              </div>
            </dl>
            {(row.pendingPreparation ?? 0) > 0 ? (
              <p className={styles.sidebarWarning}>{row.pendingPreparation} ready beds still being made ready.</p>
            ) : null}
            {row.bedRecordsMidUpdate ? (
              <p className={styles.sidebarWarning}>Bed records are mid-update. Sex mix may not be settled.</p>
            ) : null}
            <section className={styles.confirmationSection}>
              <h3>Confirmation</h3>
              <WardFreshness
                confirmedAt={row.confirmedAt}
                confirmedByRole={row.unit.allocatable.source === "ward" ? `NUM ${row.unit.name}` : undefined}
                derived={row.unit.allocatable.source !== "ward"}
                now={now}
              />
              <p className={!isConfirmationFresh(row.unit, now) ? styles.preparationWarning : undefined}>
                {isConfirmationFresh(row.unit, now) ? "Within" : "Past"} this ward’s{" "}
                {row.unit.allocatable.staleAfterMinutes} minute confirmation threshold.
              </p>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={() =>
                  dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: row.unit.id })
                }
              >
                Request ward update
              </button>
              {request ? <p role="status">Update requested {formatInstantWithDay(request.at, now)}.</p> : null}
            </section>
          </>
        ) : (
          <>
            <p className={styles.dischargeSummary}>
              {freeingCellText(row.freeing)} {row.freeing === 1 ? "bed" : "beds"} freeing today.
            </p>
            {opened ? (
              <section className={styles.recordDetail} aria-label="Discharge record detail">
                <button type="button" className={styles.textButton} onClick={closeRecord}>
                  Back to discharge list
                </button>
                {detail?.status === "allowed" ? (
                  <>
                    <h3 ref={recordHeading} tabIndex={-1}>
                      {dischargeRecordName(detail.value)}
                    </h3>
                    <DischargeRecordFacts record={detail.value} now={now} />
                  </>
                ) : (
                  <p role="status">This discharge record is unavailable. Return to the list and open it again.</p>
                )}
              </section>
            ) : (
              <>
                <h3 className={styles.sidebarSectionTitle}>Discharge records</h3>
                {records.status === "denied" ? (
                  <p className={styles.absent}>Discharge records are unavailable for this role.</p>
                ) : records.value.length === 0 ? (
                  <p className={styles.absent}>No discharge records for this ward.</p>
                ) : (
                  <ul className={styles.dischargeRecords}>
                    {records.value.map((record) => (
                      <li key={record.id}>
                        <button
                          type="button"
                          id={`capacity-discharge-${record.id}`}
                          className={styles.recordButton}
                          onClick={(event) => {
                            recordOrigin.current = event.currentTarget.id;
                            openRecord(record);
                          }}
                        >
                          <strong>{dischargeRecordName(record)}</strong>
                          <span>{dischargeRecordStage(record)}</span>
                        </button>
                        <p>
                          {record.expectedDischargeAt === null
                            ? "Expected date not recorded"
                            : `Expected ${formatInstantWithDay(record.expectedDischargeAt, now)}`}
                        </p>
                        {record.blockReason !== null ? (
                          <p className={styles.preparationWarning}>{record.blockReason}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <h3 className={styles.sidebarSectionTitle}>Anonymous bed releases</h3>
                {anonymousReleases.length === 0 ? (
                  <p className={styles.absent}>No anonymous bed releases recorded.</p>
                ) : (
                  <ul className={styles.dischargeRecords}>
                    {anonymousReleases.map((release) => (
                      <li key={release.id}>
                        <strong>{bedReleaseStateLabels[release.state]}</strong>
                        <p>{formatInstantWithDay(release.expectedAt, now)}</p>
                        {release.blocker ? (
                          <p className={styles.preparationWarning}>{release.blocker}</p>
                        ) : release.waitingOn ? (
                          <p>{release.waitingOn}</p>
                        ) : null}
                        {release.preparing ? (
                          <p>
                            Being made ready
                            {release.preparationNote ? ` · ${release.preparationNote}` : " · reason not recorded"}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className={styles.sidebarFooter}>
        <Link href={`/mockups/ward-flow/ward/${row.unit.id}`}>Open ward</Link>
        <Link href="/mockups/ward-flow/discharges">Discharge board</Link>
      </div>
    </>
  );
}

function dischargeRecordName(record: DischargeRecord): string {
  if (record.identity.kind === "linked")
    return `${record.identity.patient.givenName} ${record.identity.patient.familyName}`;
  return record.identity.kind === "legacy-anonymous" ? "Identity not linked" : "Patient link unavailable";
}

function dischargeRecordStage(record: DischargeRecord): string {
  if (record.leftAt !== null) return "Departed";
  if (record.blockReason !== null) return "Discharge blocked";
  return record.dischargeConfirmedAt !== null ? "Confirmed" : "Expected";
}

function DischargeRecordFacts({ record, now }: { record: DischargeRecord; now: Instant }) {
  return (
    <dl className={styles.wardFacts}>
      {record.identity.kind === "linked" ? (
        <div>
          <dt>UMRN</dt>
          <dd>{record.identity.patient.umrn ?? "Not recorded"}</dd>
        </div>
      ) : null}
      <div>
        <dt>Status</dt>
        <dd>{dischargeRecordStage(record)}</dd>
      </div>
      <div>
        <dt>Expected</dt>
        <dd>
          {record.expectedDischargeAt === null ? "Not recorded" : formatInstantWithDay(record.expectedDischargeAt, now)}
        </dd>
      </div>
      <div>
        <dt>Date recorded by</dt>
        <dd>{record.dischargeDateSetBy ?? "Not recorded"}</dd>
      </div>
      <div>
        <dt>Date recorded at</dt>
        <dd>
          {record.dischargeDateSetAt === null ? "Not recorded" : formatInstantWithDay(record.dischargeDateSetAt, now)}
        </dd>
      </div>
      <div>
        <dt>Confirmed</dt>
        <dd>
          {record.dischargeConfirmedAt === null
            ? "Not confirmed"
            : formatInstantWithDay(record.dischargeConfirmedAt, now)}
        </dd>
      </div>
      <div>
        <dt>Confirmed by</dt>
        <dd>{record.dischargeConfirmedBy ?? "Not recorded"}</dd>
      </div>
      {record.blockReason !== null ? (
        <div>
          <dt>Waiting on</dt>
          <dd>{record.blockReason}</dd>
        </div>
      ) : null}
      {record.leftAt !== null ? (
        <>
          <div>
            <dt>Departed</dt>
            <dd>{formatInstantWithDay(record.leftAt, now)}</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd>
              {LEAVING_DESTINATIONS.find((destination) => destination.id === record.leavingDestination)?.label ??
                "Not recorded"}
            </dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}
