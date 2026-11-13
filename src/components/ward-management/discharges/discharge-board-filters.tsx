"use client";

import { useRef, type KeyboardEvent } from "react";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { DUE_SORT_OPTIONS, type DueSortMode } from "@/components/ward-management/ward-due-sort";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import { AppliedFilter, Button, Card, Menu } from "@/components/wf";
import releaseList from "./discharge-release-list.module.css";
import pageStyles from "./discharges-third-edition.module.css";
import { WORK_STATUS_LABELS, BLOCKER_CATEGORIES } from "./discharge-board-model";
import { useDischargeDeskView } from "./discharge-desk-view";
import { HELD_UP } from "./discharge-release-actions";
import type { DischargeWorkspaceState } from "./use-discharge-workspace-state";

/* The Now/History switch and filter card. Redesign (approved 31 Oct 2026): the Barriers table view is gone;
   the one barrier panel sits beside the list. */

/** Now and History: in the hero on desktop and tablet, under it on a phone (v10). */
/**
 * Now and Recorded. Page tops (Josh approved, 9 Nov 2026): the page's tabs, drawn as the shared
 * folder tabs under the hero (`className` carries `folderTabClasses.switch`), so they are tabs
 * (`aria-selected`) with Now's count beside its word.
 */
/** Now and Recorded share one panel, the workspace below, labelled by whichever tab is selected. */
export const DISCHARGE_TABPANEL_ID = "ward-discharge-population-panel";
export const DISCHARGE_TAB_IDS = {
  releases: "ward-discharge-tab-now",
  records: "ward-discharge-tab-recorded",
} as const;

export function DischargePopulationSwitch({ s, className }: { s: DischargeWorkspaceState; className?: string }) {
  const {
    releaseGroups,
    population,
    setPopulation,
    setStatus,
    setDestination,
    setBlockerCategory,
    setHighlight,
    guarded,
    clearSelection,
    sessionAdopted,
  } = s;
  const toWork = releaseGroups.blocked.length + releaseGroups.confirmed.length + releaseGroups.expected.length;
  const nowRef = useRef<HTMLButtonElement>(null);
  const recordedRef = useRef<HTMLButtonElement>(null);
  function choose(next: "releases" | "records") {
    setPopulation(next);
    setStatus("all");
    setDestination("all");
    setBlockerCategory("all");
    setHighlight(null);
    clearSelection();
  }
  // The tablist's keys (roving tab stop, automatic activation): arrows move between the two tabs and
  // choose the one reached; Home and End go to Now and Recorded.
  function onTabKeyDown(event: KeyboardEvent) {
    let next: "releases" | "records" | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft")
      next = population === "releases" ? "records" : "releases";
    else if (event.key === "Home") next = "releases";
    else if (event.key === "End") next = "records";
    if (next === null || !sessionAdopted) return;
    event.preventDefault();
    (next === "releases" ? nowRef : recordedRef).current?.focus();
    if (next !== population) choose(next);
  }
  return (
    <>
      {!sessionAdopted ? (
        <span className="sr-only" role="status">
          Preparing discharge workspace…
        </span>
      ) : null}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab */}
      <div
        className={className ?? pageStyles.populationSwitch}
        role="tablist"
        aria-label="Now or recorded"
        aria-busy={!sessionAdopted}
        onKeyDown={onTabKeyDown}
      >
        <button
          type="button"
          role="tab"
          id={DISCHARGE_TAB_IDS.releases}
          aria-controls={DISCHARGE_TABPANEL_ID}
          disabled={!sessionAdopted}
          aria-selected={population === "releases"}
          data-testid="ward-discharge-now"
          tabIndex={population === "releases" ? 0 : -1}
          ref={nowRef}
          onClick={() => choose("releases")}
        >
          Now
          {/* Josh, 30 Oct: Now says the hero's figure, the releases listed to work on. */}
          <span className={pageStyles.tabCount} aria-hidden="true">
            {toWork}
          </span>
          <span className="sr-only">, {toWork} to work now</span>
        </button>
        <button
          type="button"
          role="tab"
          id={DISCHARGE_TAB_IDS.records}
          aria-controls={DISCHARGE_TABPANEL_ID}
          aria-selected={population === "records"}
          data-testid="ward-discharge-history"
          disabled={!sessionAdopted}
          tabIndex={population === "records" ? 0 : -1}
          ref={recordedRef}
          onClick={() => choose("records")}
        >
          {/* DC4 (Josh, 3 Nov 2026): History becomes Recorded, the discharges of the last 7 days. */}
          Recorded
          <span className="sr-only">
            , discharges in the last 7 days{guarded.status === "allowed" ? "" : ", unavailable"}
          </span>
        </button>
      </div>
    </>
  );
}

/**
 * One filter as a kit menu, not a browser drop-down (Q12, 3 Nov 2026). The pill shows the filter's
 * name and its current choice, and turns accent when it narrows the list.
 */
function FilterPick({
  label,
  value,
  options,
  onChange,
  testId,
  icon = false,
  alwaysPlain = false,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (id: string) => void;
  testId?: string;
  icon?: boolean;
  /** Sort never narrows the list, so it never turns accent. */
  alwaysPlain?: boolean;
}) {
  const current = options.find((option) => option.id === value)?.label ?? options[0]?.label ?? "";
  const on = !alwaysPlain && value !== "all";
  return (
    <Menu
      label={label}
      items={options.map((option) => ({
        id: option.id,
        label: option.label,
        checkable: "radio" as const,
        checked: option.id === value,
        onSelect: () => onChange(option.id),
      }))}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={`${releaseList.pick}${on ? ` ${releaseList.pickOn}` : ""}`}
          data-testid={testId}
          aria-label={`${label}: ${current}`}
        >
          {icon ? <ArrowDownUp size={14} aria-hidden="true" /> : null}
          <span className={releaseList.pickLabel}>{label}</span>{" "}
          <span className={releaseList.pickValue}>{current}</span>
          <ChevronDown size={14} aria-hidden="true" className={releaseList.pickChevron} />
        </button>
      )}
    />
  );
}

/** The filters: service, ward, held up by and sort; Recorded adds destination. */
export function DischargeFilterCard({ s, bare = false }: { s: DischargeWorkspaceState; bare?: boolean }) {
  const {
    population,
    status,
    setStatus,
    service,
    setService,
    ward,
    setWard,
    destination,
    setDestination,
    blockerCategory,
    setBlockerCategory,
    sortMode,
    setSortMode,
    services,
    scopedUnits,
    clearSelection,
    clearAllFilters,
    filtersActive,
  } = s;
  // ROLE BRANCHES (approved 31 Oct 2026). Nurse in charge: a ward desk sees only its own wards, so the
  // Service filter is left out, and with one ward the Ward filter too (one choice each). Site bed manager:
  // one site is one service, so the Service filter is left out and the Ward filter stays. Every other
  // filter stays.
  const { wardDesk, ownWard, siteName } = useDischargeDeskView(s.units);
  const showService = !wardDesk && siteName === undefined;
  const showWard = ownWard === undefined;
  const blockerLabel = BLOCKER_CATEGORIES.find((category) => category.id === blockerCategory)?.label;
  const wardLabel = scopedUnits.find((unit) => unit.id === ward)?.name;
  return (
    <Card
      as="div"
      className={bare ? pageStyles.filterBare : pageStyles.filterCard}
      aria-label="Discharge filters"
      role="region"
    >
      <div className={pageStyles.filters}>
        {/* DC2 (Josh, 3 Nov 2026): the status chips are gone from here. The hero's counts already pick a
            status, and the list's groups already sort by it, so a third copy only doubled up. */}
        <div className={pageStyles.filterPills}>
          {showService ? (
            <FilterPick
              label="Service"
              value={service}
              options={[{ id: "all", label: "All" }, ...services.map((item) => ({ id: item, label: item }))]}
              onChange={(id) => {
                setService(id);
                setWard("all");
                clearSelection();
              }}
            />
          ) : null}
          {showWard ? (
            <FilterPick
              label="Ward"
              value={ward}
              options={[{ id: "all", label: "All" }, ...scopedUnits.map((unit) => ({ id: unit.id, label: unit.name }))]}
              onChange={(id) => {
                setWard(id);
                clearSelection();
              }}
            />
          ) : null}
          {population === "records" ? (
            <FilterPick
              label="Going to"
              value={destination}
              options={[
                { id: "all", label: "All" },
                ...LEAVING_DESTINATIONS.map((d) => ({ id: d.id, label: d.label })),
              ]}
              onChange={(id) => {
                setDestination(id);
                clearSelection();
              }}
            />
          ) : (
            <FilterPick
              label="Held up by"
              value={blockerCategory}
              options={[
                { id: "all", label: "Any" },
                ...BLOCKER_CATEGORIES.map((category) => ({ id: category.id, label: category.label })),
              ]}
              onChange={(id) => {
                setBlockerCategory(id);
                clearSelection();
              }}
            />
          )}
        </div>
        {population === "records" ? null : (
          <span className={releaseList.sortPick}>
            <FilterPick
              label="Sort"
              icon
              alwaysPlain
              value={sortMode}
              options={DUE_SORT_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
              onChange={(id) => setSortMode(id as DueSortMode)}
              testId="ward-discharges-sort"
            />
          </span>
        )}
      </div>
      {filtersActive ? (
        <div className={pageStyles.appliedRow}>
          {status !== "all" ? (
            <AppliedFilter onRemove={() => setStatus("all")} removeLabel="Remove status filter">
              {status === "blocked" ? HELD_UP : WORK_STATUS_LABELS[status]}
            </AppliedFilter>
          ) : null}
          {showService && service !== "all" ? (
            <AppliedFilter onRemove={() => setService("all")}>{service}</AppliedFilter>
          ) : null}
          {showWard && ward !== "all" && wardLabel ? (
            <AppliedFilter onRemove={() => setWard("all")}>{wardLabel}</AppliedFilter>
          ) : null}
          {blockerCategory !== "all" && blockerLabel ? (
            <AppliedFilter onRemove={() => setBlockerCategory("all")}>{blockerLabel}</AppliedFilter>
          ) : null}
          {destination !== "all" ? (
            <AppliedFilter onRemove={() => setDestination("all")}>
              {LEAVING_DESTINATIONS.find((d) => d.id === destination)?.label ?? destination}
            </AppliedFilter>
          ) : null}
          <Button size="sm" variant="ghost" className={pageStyles.clearButton} onClick={clearAllFilters}>
            Clear all
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
