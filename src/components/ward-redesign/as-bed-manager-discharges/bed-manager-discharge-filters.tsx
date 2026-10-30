"use client";

// Forked from src/components/ward-management/discharges/discharge-board-filters.tsx (the filter card only;
// the barrier table and Now/History switch are still imported from there).

import { useId } from "react";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { DUE_SORT_OPTIONS, type DueSortMode } from "@/components/ward-management/ward-due-sort";
import { Button, Card, Select } from "@/components/wf";
import pageStyles from "@/components/ward-management/discharges/discharges-third-edition.module.css";
import {
  type WorkStatus,
  WORK_STATUS_LABELS,
  WORK_ORDER,
  BLOCKER_CATEGORIES,
} from "@/components/ward-management/discharges/discharge-board-model";
import type { DischargeWorkspaceState } from "@/components/ward-management/discharges/use-discharge-workspace-state";

export function BedManagerDischargeFilterCard({
  s,
  oneService = false,
}: {
  s: DischargeWorkspaceState;
  /** Role view (site bed manager): every ward here is the one site's, so the Service filter is left out. */
  oneService?: boolean;
}) {
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
    total,
    clearSelection,
    clearAllFilters,
    filtersActive,
  } = s;
  const baseId = useId();
  return (
    <Card as="div" className={pageStyles.filterCard} aria-label="Discharge filters" role="region">
      <div className={pageStyles.filters}>
        {oneService ? null : (
          <label htmlFor={`${baseId}-discharges-filter-service`} className={pageStyles.filterField}>
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
              <option value="all">All services</option>
              {services.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </label>
        )}
        <label htmlFor={`${baseId}-discharges-filter-ward`} className={pageStyles.filterField}>
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
            <option value="all">All wards</option>
            {scopedUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </label>
        {/* Decision 5 (review 12 Oct 2026): one control per filter. Status narrows from this one
            dropdown (its counts are the hero chips' counts); the hero chips highlight. The tab
            row over the table and the blocker chip row are gone. */}
        <label htmlFor={`${baseId}-discharges-filter-status`} className={pageStyles.filterField}>
          <span className={pageStyles.filterLabelText}>Status</span>
          <Select
            id={`${baseId}-discharges-filter-status`}
            name="dischargesFilterStatus"
            value={status}
            boxClassName={pageStyles.filterSelect}
            data-testid="ward-discharge-filter-status"
            onChange={(event) => {
              const next = event.target.value;
              setStatus(WORK_ORDER.includes(next as WorkStatus) ? (next as WorkStatus) : "all");
              clearSelection();
            }}
          >
            <option value="all">{`All listed · ${total}`}</option>
            {WORK_ORDER.map((key) => (
              <option key={key} value={key}>
                {`${population === "releases" && key === "departed" ? "Discharged · 24h" : WORK_STATUS_LABELS[key]} · ${counts[key]}`}
              </option>
            ))}
          </Select>
        </label>
        <label htmlFor={`${baseId}-discharges-filter-blocker`} className={pageStyles.filterField}>
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
            <option value="all">All blockers</option>
            {BLOCKER_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </label>
        {population === "records" && (
          <>
            <label htmlFor={`${baseId}-discharges-filter-identity`} className={pageStyles.filterField}>
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
                <option value="all">All records</option>
                <option value="linked">Linked patient</option>
                <option value="missing">Missing or unavailable</option>
              </Select>
            </label>
            <label htmlFor="discharges-filter-destination" className={pageStyles.filterField}>
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
                <option value="all">All destinations</option>
                {LEAVING_DESTINATIONS.map((dest) => (
                  <option key={dest.id} value={dest.id}>
                    {dest.label}
                  </option>
                ))}
              </Select>
            </label>
          </>
        )}
        <label htmlFor={`${baseId}-discharges-sort`} className={pageStyles.filterField}>
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
        {filtersActive && (
          <Button size="sm" variant="ghost" className={pageStyles.clearButton} onClick={clearAllFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </Card>
  );
}
