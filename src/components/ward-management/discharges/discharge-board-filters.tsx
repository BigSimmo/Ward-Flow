"use client";

import { useId } from "react";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { DUE_SORT_OPTIONS, type DueSortMode } from "@/components/ward-management/ward-due-sort";
import { ArrowDownUp } from "lucide-react";
import { AppliedFilter, Button, Card, ChipGroup, FilterChip, Select } from "@/components/wf";
import pageStyles from "./discharges-third-edition.module.css";
import { WORK_STATUS_LABELS, WORK_ORDER, BLOCKER_CATEGORIES, stageTone } from "./discharge-board-model";
import { useDischargeDeskView } from "./discharge-desk-view";
import { HELD_UP } from "./discharge-release-actions";
import type { DischargeWorkspaceState } from "./use-discharge-workspace-state";

/* The Now/History switch and filter card. Redesign (approved 31 Oct 2026): the Barriers table view is gone;
   the one barrier panel sits beside the list. */

/** Now and History: in the hero on desktop and tablet, under it on a phone (v10). */
export function DischargePopulationSwitch({ s }: { s: DischargeWorkspaceState }) {
  const {
    releaseGroups,
    population,
    setPopulation,
    setStatus,
    setDestination,
    setBlockerCategory,
    setHighlight,
    guarded,
    records,
    clearSelection,
    sessionAdopted,
  } = s;
  return (
    <>
      {!sessionAdopted ? (
        <span className="sr-only" role="status">
          Preparing discharge workspace…
        </span>
      ) : null}
      <div className={pageStyles.populationSwitch} role="group" aria-label="Now or history" aria-busy={!sessionAdopted}>
        <button
          type="button"
          disabled={!sessionAdopted}
          aria-pressed={population === "releases"}
          data-testid="ward-discharge-now"
          onClick={() => {
            setPopulation("releases");
            setStatus("all");
            setDestination("all");
            setBlockerCategory("all");
            setHighlight(null);
            clearSelection();
          }}
        >
          Now
          {/* Josh, 30 Oct: Now says the hero's figure, the releases listed to work on. */}
          <span className="sr-only">
            , {releaseGroups.blocked.length + releaseGroups.confirmed.length + releaseGroups.expected.length} to work
            now
          </span>
        </button>
        <button
          type="button"
          aria-pressed={population === "records"}
          data-testid="ward-discharge-history"
          disabled={!sessionAdopted}
          onClick={() => {
            setPopulation("records");
            setStatus("all");
            setDestination("all");
            setBlockerCategory("all");
            setHighlight(null);
            clearSelection();
          }}
        >
          History
          <span className="sr-only">
            , admission records {guarded.status === "allowed" ? records.length : "unavailable"}
          </span>
        </button>
      </div>
    </>
  );
}

/** The filters: service, ward, status, blocker, link, destination and sort. */
export function DischargeFilterCard({ s, bare = false }: { s: DischargeWorkspaceState; bare?: boolean }) {
  const {
    population,
    status,
    setStatus,
    service,
    setService,
    ward,
    setWard,
    identity,
    setIdentity,
    destination,
    setDestination,
    blockerCategory,
    setBlockerCategory,
    sortMode,
    setSortMode,
    services,
    scopedUnits,
    counts,
    clearSelection,
    clearAllFilters,
    filtersActive,
  } = s;
  const baseId = useId();
  // ROLE BRANCHES (approved 31 Oct 2026). Nurse in charge: a ward desk sees only its own wards, so the
  // Service filter is left out, and with one ward the Ward filter too (one choice each). Site bed manager:
  // one site is one service, so the Service filter is left out and the Ward filter stays. Every other
  // filter stays.
  const { wardDesk, ownWard, siteName } = useDischargeDeskView(s.units);
  const showService = !wardDesk && siteName === undefined;
  const showWard = ownWard === undefined;
  const pill = (key: string, value: string) =>
    `${pageStyles.filterPill}${value !== "all" ? ` ${pageStyles.filterPillOn}` : ""}`;
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
        {/* Mock-up (1 Nov 2026): Status is one row of chips with their counts, so a status is one
            press, not a dropdown. Pressing the chip that is on goes back to every status. */}
        <ChipGroup label="Status" className={pageStyles.statusChips}>
          {WORK_ORDER.map((key) => (
            <FilterChip
              key={key}
              pressed={status === key}
              tone={key === "departed" ? undefined : stageTone(key)}
              count={counts[key]}
              onPressedChange={(on) => {
                setStatus(on ? key : "all");
                clearSelection();
              }}
            >
              {key === "blocked"
                ? HELD_UP
                : population === "releases" && key === "departed"
                  ? "Discharged · 24h"
                  : WORK_STATUS_LABELS[key]}
            </FilterChip>
          ))}
        </ChipGroup>
        <span className={pageStyles.filterDivider} aria-hidden="true" />
        <div className={pageStyles.filterPills}>
          {showService ? (
            <label htmlFor={`${baseId}-discharges-filter-service`} className={pill("service", service)}>
              <span className={pageStyles.filterLabelText}>Service</span>
              <Select
                id={`${baseId}-discharges-filter-service`}
                name="dischargesFilterService"
                value={service}
                boxClassName={pageStyles.filterSelect}
                onChange={(event) => {
                  setService(event.target.value);
                  setWard("all");
                  clearSelection();
                }}
              >
                <option value="all">All</option>
                {services.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </label>
          ) : null}
          {showWard ? (
            <label htmlFor={`${baseId}-discharges-filter-ward`} className={pill("ward", ward)}>
              <span className={pageStyles.filterLabelText}>Ward</span>
              <Select
                id={`${baseId}-discharges-filter-ward`}
                name="dischargesFilterWard"
                value={ward}
                boxClassName={pageStyles.filterSelect}
                onChange={(event) => {
                  setWard(event.target.value);
                  clearSelection();
                }}
              >
                <option value="all">All</option>
                {scopedUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          <label htmlFor={`${baseId}-discharges-filter-blocker`} className={pill("blocker", blockerCategory)}>
            <span className={pageStyles.filterLabelText}>Blocker</span>
            <Select
              id={`${baseId}-discharges-filter-blocker`}
              name="dischargesFilterBlocker"
              value={blockerCategory}
              boxClassName={pageStyles.filterSelect}
              onChange={(event) => {
                setBlockerCategory(event.target.value);
                clearSelection();
              }}
            >
              <option value="all">Any</option>
              {BLOCKER_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </label>
          {population === "records" && (
            <>
              <label htmlFor={`${baseId}-discharges-filter-identity`} className={pill("identity", identity)}>
                <span className={pageStyles.filterLabelText}>Patient link</span>
                <Select
                  id={`${baseId}-discharges-filter-identity`}
                  name="dischargesFilterIdentity"
                  value={identity}
                  boxClassName={pageStyles.filterSelect}
                  onChange={(event) => {
                    setIdentity(event.target.value);
                    clearSelection();
                  }}
                >
                  <option value="all">All</option>
                  <option value="linked">Linked patient</option>
                  <option value="missing">Missing or unavailable</option>
                </Select>
              </label>
              <label htmlFor="discharges-filter-destination" className={pill("destination", destination)}>
                <span className={pageStyles.filterLabelText}>Destination</span>
                <Select
                  id="discharges-filter-destination"
                  name="dischargesFilterDestination"
                  value={destination}
                  boxClassName={pageStyles.filterSelect}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    clearSelection();
                  }}
                >
                  <option value="all">All</option>
                  {LEAVING_DESTINATIONS.map((dest) => (
                    <option key={dest.id} value={dest.id}>
                      {dest.label}
                    </option>
                  ))}
                </Select>
              </label>
            </>
          )}
        </div>
        <label htmlFor={`${baseId}-discharges-sort`} className={pageStyles.sortField}>
          <ArrowDownUp size={14} aria-hidden="true" />
          <span className={pageStyles.filterLabelText}>Sort</span>
          <Select
            id={`${baseId}-discharges-sort`}
            name="dischargesSort"
            value={sortMode}
            boxClassName={pageStyles.filterSelect}
            data-testid="ward-discharges-sort"
            onChange={(event) => {
              setSortMode(event.target.value as DueSortMode);
            }}
          >
            {DUE_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
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
          <Button size="sm" variant="ghost" className={pageStyles.clearButton} onClick={clearAllFilters}>
            Clear all
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
