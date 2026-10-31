"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useWardFlowSelect } from "../ward-flow-provider";
import { bedsPendingPreparation } from "../ward-bed-availability";
import { readyBedsNow } from "../ward-bed-states";
import type { Admission } from "../ward-admissions";
import { designationSummary, lockedBedsFree, openBedsFree } from "../ward-bed-designation";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { sexDesignationAccepts } from "../ward-eligibility";
import { unitHealthService } from "../ward-service-scope";
import { siteByCode } from "../ward-sites";
import { COHORTS, HEALTH_SERVICES, type BedRelease, type Cohort, type HealthService, type Unit } from "../ward-model";
import { unitHref } from "../shell/ward-facade";
import { useCanOpenHref } from "../shell/ward-access";
import styles from "./ward-tools-sheet.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";

type BedFinderLegalStatus = "voluntary" | "involuntary";

export type BedFinderFilters = {
  cohort: Cohort;
  bed: "any" | "locked" | "open";
  sex: "any" | "Female" | "Male";
  /** Absent until the user chooses one. There is no default (audit 24-1 decision 1). */
  legalStatus?: BedFinderLegalStatus;
  home: HealthService | "any";
};

export type BedFinderRow = {
  unit: Unit;
  service: HealthService | undefined;
  free: number;
  /** When the ward's bed count was last confirmed: the stored time, never a computed one. */
  recordedAt: Instant;
  pending: number;
  home: boolean;
};

export const DEFAULT_BED_FINDER_FILTERS: BedFinderFilters = {
  cohort: "Adult",
  bed: "any",
  sex: "any",
  home: "any",
};

/**
 * Tools, Find a bed (Tools review item 19, 15 Oct 2026; rewritten for audit 24-1 decision 1,
 * 24 Oct 2026). A quick filter over the shared units, not the eligibility engine: it narrows the
 * list for a phone call, and the referral's own gates still decide. Every open ward the filters
 * leave is listed by name, A to Z, with its Ready count and when that count was recorded. It never
 * ranks wards by home service, free beds or suitability: the never-build rule bars a "best match"
 * list. Legal status has no default, so nothing is listed until the user chooses one.
 */
export function findBeds(
  units: readonly Unit[],
  admissions: readonly Admission[],
  releases: BedRelease[],
  filters: BedFinderFilters,
): BedFinderRow[] {
  if (!filters.legalStatus) return [];
  const involuntary = filters.legalStatus === "involuntary";
  return (
    units
      .filter((unit) => !unit.isClosed)
      .filter((unit) => unit.cohort === filters.cohort)
      .filter((unit) => !involuntary || unit.authorised)
      .filter((unit) => filters.sex === "any" || sexDesignationAccepts(unit.sexDesignation, filters.sex))
      .map((unit) => {
        // Capped at the board's Ready figure, so this never shows more beds than the board or the bed
        // summary. NA3-05 (audit 26 Oct 2026): that figure is `readyBedsNow`, which leaves out a bed
        // pulled for an incoming patient; the older min(allocatable, empty) still offered it. The
        // data does not say which beds are empty, so each kind is capped on its own rather than
        // giving the cap to locked beds first.
        const ready = readyBedsNow(unit, admissions, releases);
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
          // The ward's own confirmed count time, as the referral's placement step shows it (CS-10).
          recordedAt: unit.allocatable.confirmedAt,
          pending: bedsPendingPreparation(unit.id, releases),
          home: filters.home !== "any" && service === filters.home,
        };
      })
      // Name order only. Ward names repeat across sites, so the id settles a tie the same way each time.
      .sort((a, b) => a.unit.name.localeCompare(b.unit.name, "en-AU") || a.unit.id.localeCompare(b.unit.id))
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
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
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveBedFinder onNavigate={onNavigate} />
  ) : (
    <OperationalBedFinder onNavigate={onNavigate} />
  );
}
function ExecutiveBedFinder({ onNavigate }: { onNavigate: () => void }) {
  const report = useExecutiveStatistics();
  const [filters, setFilters] = useState<BedFinderFilters>(DEFAULT_BED_FINDER_FILTERS);
  const set =
    <K extends keyof BedFinderFilters>(key: K) =>
    (value: BedFinderFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value }));
  if (!report) return <p role="status">Ready beds are unavailable until this report is ready.</p>;
  const rows = filters.legalStatus
    ? report.wards
        .filter(
          (ward) =>
            !ward.isClosed &&
            ward.cohort === filters.cohort &&
            (filters.legalStatus !== "involuntary" || ward.authorised) &&
            (filters.sex === "any" || sexDesignationAccepts(ward.sexDesignation, filters.sex)),
        )
        .map((ward) => ({
          ward,
          free: filters.bed === "locked" ? ward.lockedReady : filters.bed === "open" ? ward.openReady : ward.beds.ready,
        }))
        .toSorted((a, b) => a.ward.name.localeCompare(b.ward.name, "en-AU") || a.ward.id.localeCompare(b.ward.id))
    : null;
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
        value={filters.legalStatus}
        options={[
          { value: "voluntary", label: "Voluntary" },
          { value: "involuntary", label: "Involuntary" },
        ]}
        onChange={set("legalStatus")}
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
      {rows ? (
        <>
          <p className={styles.result} role="status">
            <strong>{rows.reduce((sum, row) => sum + row.free, 0)}</strong> Ready synthetic beds across{" "}
            <strong>{rows.length}</strong> {rows.length === 1 ? "ward" : "wards"}
          </p>
          <ul className={styles.matchList} aria-label="Ready beds by ward">
            {rows.map(({ ward, free }) => (
              <li key={ward.id}>
                <Link
                  className={styles.matchRow}
                  href={`/ward-flow/statistics/ward/${encodeURIComponent(ward.id)}`}
                  onClick={onNavigate}
                >
                  <span>
                    <strong>{ward.name}</strong>
                    <small>
                      {report.catalogue.sites.find((site) => site.code === ward.siteCode)?.name ?? ward.siteCode} ·{" "}
                      {ward.service}
                      {filters.home === ward.service ? " · Home service" : ""}
                    </small>
                    <small>{ward.sexDesignation}</small>
                  </span>
                  <span className={styles.matchCount}>
                    <b>{free}</b> Ready
                    <small>Recorded {formatInstantWithDay(ward.confirmedAt, report.network.asAt.now)}</small>
                    {ward.pendingPreparation > 0 && <small>{ward.pendingPreparation} pending</small>}
                  </span>
                  <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
          {rows.length === 0 && (
            <p className={styles.empty}>No open ward is left by these filters. Try Any for Bed or Ward for.</p>
          )}
        </>
      ) : (
        <p className={styles.result} role="status">
          Choose a legal status to list wards.
        </p>
      )}
      <p className={styles.note}>
        Listed A to Z by ward name, not ranked. Quick filter only. The referral still checks every rule before a bed is
        offered.
      </p>
    </div>
  );
}
/** One ward's line in the operational list: its name, place, designation and Ready count. */
function BedFinderRowText({ row, now }: { row: BedFinderRow; now: Instant }) {
  return (
    <>
      <span>
        <strong>{row.unit.name}</strong>
        <small>
          {siteByCode(row.unit.siteCode)?.name ?? row.unit.siteCode} · {row.service ?? "Service not recorded"}
          {row.home ? " · Home service" : ""}
        </small>
        <small>{designationSummary(row.unit)}</small>
      </span>
      <span className={styles.matchCount}>
        <b>{row.free}</b> Ready
        <small>Recorded {formatInstantWithDay(row.recordedAt, now)}</small>
        {row.pending > 0 ? <small>{row.pending} pending</small> : null}
      </span>
    </>
  );
}
function OperationalBedFinder({ onNavigate }: { onNavigate: () => void }) {
  const { units, admissions, bedReleases, now } = useWardFlowSelect("units", "admissions", "bedReleases", "now");
  // Access audit (31 Oct 2026): a ward links to its page only for a desk that may open that page,
  // by the same role table the menu reads. Another desk still reads the row, as plain text.
  const canOpen = useCanOpenHref();
  const [filters, setFilters] = useState<BedFinderFilters>(DEFAULT_BED_FINDER_FILTERS);
  const rows = findBeds(units, admissions, bedReleases, filters);
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
      {/* Required, with no default: Involuntary keeps the list to authorised wards. */}
      <Choice<BedFinderLegalStatus>
        label="Legal status"
        value={filters.legalStatus}
        options={[
          { value: "voluntary", label: "Voluntary" },
          { value: "involuntary", label: "Involuntary" },
        ]}
        onChange={set("legalStatus")}
      />
      {/* Labels the wards in that service. It never moves them up the list. */}
      <Choice
        label="Home service"
        value={filters.home}
        options={[
          { value: "any", label: "Any" },
          ...HEALTH_SERVICES.map((service) => ({ value: service, label: service })),
        ]}
        onChange={set("home")}
      />
      {filters.legalStatus ? (
        <>
          <p className={styles.result} role="status">
            <strong>{rows.reduce((sum, row) => sum + row.free, 0)}</strong> Ready synthetic beds across{" "}
            <strong>{rows.length}</strong> {rows.length === 1 ? "ward" : "wards"}
          </p>
          {rows.length > 0 ? (
            <ul className={styles.matchList} aria-label="Ready beds by ward">
              {rows.map((row) => (
                <li key={row.unit.id}>
                  {canOpen(unitHref(row.unit.id)) ? (
                    <Link className={styles.matchRow} href={unitHref(row.unit.id)} onClick={onNavigate}>
                      <BedFinderRowText row={row} now={now} />
                      <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
                    </Link>
                  ) : (
                    <div className={styles.matchRow} data-testid="ward-bed-finder-row-plain">
                      <BedFinderRowText row={row} now={now} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No open ward is left by these filters. Try Any for Bed or Ward for.</p>
          )}
        </>
      ) : (
        <p className={styles.result} role="status">
          Choose Voluntary or Involuntary under Legal status to list wards. Involuntary lists only authorised wards.
        </p>
      )}
      <p className={styles.note}>
        Listed A to Z by ward name, not ranked. Quick filter only. The referral still checks every rule before a bed is
        offered.
      </p>
    </div>
  );
}
