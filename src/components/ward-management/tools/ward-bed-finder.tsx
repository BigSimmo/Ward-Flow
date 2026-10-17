"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useWardFlowSelect } from "../ward-flow-provider";
import { bedsPendingPreparation, boundedBedAvailability } from "../ward-bed-availability";
import { designationSummary, lockedBedsFree, openBedsFree } from "../ward-bed-designation";
import { sexDesignationAccepts } from "../ward-eligibility";
import { unitHealthService } from "../ward-service-scope";
import { siteByCode } from "../ward-sites";
import { COHORTS, HEALTH_SERVICES, type BedRelease, type Cohort, type HealthService, type Unit } from "../ward-model";
import { unitHref } from "../shell/ward-facade";
import styles from "./ward-tools-sheet.module.css";

export type BedFinderFilters = {
  cohort: Cohort;
  bed: "any" | "locked" | "open";
  sex: "any" | "Female" | "Male";
  involuntary: boolean;
  home: HealthService | "any";
};

export type BedFinderMatch = {
  unit: Unit;
  service: HealthService | undefined;
  free: number;
  pending: number;
  home: boolean;
};

export const DEFAULT_BED_FINDER_FILTERS: BedFinderFilters = {
  cohort: "Adult",
  bed: "any",
  sex: "any",
  involuntary: false,
  home: "any",
};

/**
 * Tools, Find a bed (Tools review item 19, 15 Oct 2026). A quick filter over the shared units, not
 * the eligibility engine: it narrows the list for a phone call, and the referral's own gates still
 * decide. Wards in the patient's home service come first, then the most free beds.
 */
export function findBeds(units: readonly Unit[], releases: BedRelease[], filters: BedFinderFilters): BedFinderMatch[] {
  return units
    .filter((unit) => !unit.isClosed)
    .filter((unit) => unit.cohort === filters.cohort)
    .filter((unit) => !filters.involuntary || unit.authorised)
    .filter((unit) => filters.sex === "any" || sexDesignationAccepts(unit.sexDesignation, filters.sex))
    .map((unit) => {
      // Capped at the board's Ready figure, min(allocatable, empty) under R-B-09, so this never
      // shows more beds than the board or the bed summary. The data does not say which beds are
      // empty, so each kind is capped on its own rather than giving the cap to locked beds first.
      const ready = boundedBedAvailability(unit).available;
      const free =
        filters.bed === "locked"
          ? Math.min(lockedBedsFree(unit), ready)
          : filters.bed === "open"
            ? Math.min(openBedsFree(unit), ready)
            : ready;
      const service = unitHealthService(unit);
      return {
        unit,
        service,
        free,
        pending: bedsPendingPreparation(unit.id, releases),
        home: filters.home !== "any" && service === filters.home,
      };
    })
    .filter((match) => match.free > 0)
    .sort((a, b) => Number(b.home) - Number(a.home) || b.free - a.free || a.unit.name.localeCompare(b.unit.name));
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.choiceRow} role="group" aria-label={label}>
      <span className={styles.choiceLabel}>{label}</span>
      <div className={styles.chips}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.chip}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WardBedFinder({ onNavigate }: { onNavigate: () => void }) {
  const { units, bedReleases } = useWardFlowSelect("units", "bedReleases");
  const [filters, setFilters] = useState<BedFinderFilters>(DEFAULT_BED_FINDER_FILTERS);
  const matches = findBeds(units, bedReleases, filters);
  const set =
    <K extends keyof BedFinderFilters>(key: K) =>
    (value: BedFinderFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className={styles.toolBody} data-testid="ward-tools-bed-finder">
      <Choice
        label="Age group"
        value={filters.cohort}
        options={COHORTS.map((cohort) => ({ value: cohort, label: cohort }))}
        onChange={set("cohort")}
      />
      <Choice
        label="Bed"
        value={filters.bed}
        options={[
          { value: "any", label: "Any" },
          { value: "locked", label: "Locked" },
          { value: "open", label: "Open" },
        ]}
        onChange={set("bed")}
      />
      <Choice
        label="Ward for"
        value={filters.sex}
        options={[
          { value: "any", label: "Any" },
          { value: "Female", label: "Female" },
          { value: "Male", label: "Male" },
        ]}
        onChange={set("sex")}
      />
      <Choice
        label="Legal status"
        value={filters.involuntary ? "involuntary" : "voluntary"}
        options={[
          { value: "voluntary", label: "Voluntary" },
          { value: "involuntary", label: "Involuntary" },
        ]}
        onChange={(value) => set("involuntary")(value === "involuntary")}
      />
      <Choice
        label="Home service"
        value={filters.home}
        options={[
          { value: "any", label: "Any" },
          ...HEALTH_SERVICES.map((service) => ({ value: service, label: service })),
        ]}
        onChange={set("home")}
      />
      <p className={styles.result} role="status">
        <strong>{matches.reduce((sum, match) => sum + match.free, 0)}</strong> synthetic beds free on{" "}
        <strong>{matches.length}</strong> {matches.length === 1 ? "ward" : "wards"}
      </p>
      {matches.length > 0 ? (
        <ul className={styles.matchList} aria-label="Wards with a free bed">
          {matches.slice(0, 6).map((match) => (
            <li key={match.unit.id}>
              <Link className={styles.matchRow} href={unitHref(match.unit.id)} onClick={onNavigate}>
                <span>
                  <strong>{match.unit.name}</strong>
                  <small>
                    {siteByCode(match.unit.siteCode)?.name ?? match.unit.siteCode} ·{" "}
                    {match.service ?? "Service not recorded"}
                    {match.home ? " · Home service" : ""}
                  </small>
                  <small>{designationSummary(match.unit)}</small>
                </span>
                <span className={styles.matchCount}>
                  <b>{match.free}</b> free
                  {match.pending > 0 ? <small>{match.pending} pending</small> : null}
                </span>
                <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>No ward has a free bed that fits. Try Any for bed type or home service.</p>
      )}
      {matches.length > 6 ? (
        <p className={styles.note}>
          Showing 6 of {matches.length} matching wards. Narrow the filters to see other wards.
        </p>
      ) : null}
      <p className={styles.note}>Quick filter only. The referral still checks every rule before a bed is offered.</p>
    </div>
  );
}
