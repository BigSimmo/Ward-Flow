"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useWardFlowSelect } from "../ward-flow-provider";
import { bedsPendingPreparation } from "../ward-bed-availability";
import { readyBedsNow, type ReservationReferral } from "../ward-bed-states";
import type { Admission } from "../ward-admissions";
import { heldBedsByKind } from "../ward-movement-bed-hold";
import { designationSummary, lockedBedsFree, openBedsFree } from "../ward-bed-designation";
import { formatInstantWithDay, type Instant } from "../ward-clock";
import { sexDesignationAccepts } from "../ward-eligibility";
import { authorisationBlocksPlacement } from "../ward-authorisation";
import { unitHealthService } from "../ward-service-scope";
import { siteByCode } from "../ward-sites";
import { COHORTS, HEALTH_SERVICES, type BedRelease, type Cohort, type HealthService, type Unit } from "../ward-model";
import { REFERRAL_GENDERS, type ReferralGender } from "../ward-model-vocabulary";
import { GENDER_PLACEMENT_REFUSAL } from "../ward-change-reasons";
import { unitHref } from "../shell/ward-facade";
import { useCanOpenHref } from "../shell/ward-access";
import styles from "./ward-tools-sheet.module.css";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";

type BedFinderLegalStatus = "voluntary" | "involuntary";

/**
 * D-187 item 14 (Q36): "Ward for" offers the recorded gender list (R7, `REFERRAL_GENDERS`), not
 * Female and Male alone. Female and Male filter by sex designation as before; any other choice
 * filters no ward and shows the coordinator-review message instead.
 */
export type BedFinderWardFor = "any" | ReferralGender;

export const BED_FINDER_WARD_FOR: readonly { value: BedFinderWardFor; label: string }[] = [
  { value: "any", label: "Any" },
  ...REFERRAL_GENDERS.map((gender) => ({ value: gender, label: gender })),
];

/** D-187 item 14 (R7): a gender other than Female or Male needs a coordinator's review on every ward. */
export const wardForNeedsReview = (wardFor: BedFinderWardFor): boolean =>
  wardFor !== "any" && wardFor !== "Female" && wardFor !== "Male";

/** D-187 item 14: the coordinator-review message (R7's `GENDER_PLACEMENT_REFUSAL`), and that no ward is left out. */
export const BED_FINDER_GENDER_REVIEW = `${GENDER_PLACEMENT_REFUSAL} This list is not narrowed by sex designation.`;

/** Whether a ward's sex designation is left in by the "Ward for" choice. D-187 item 14: only Female and Male narrow it. */
export function wardForAccepts(designation: Unit["sexDesignation"], wardFor: BedFinderWardFor): boolean {
  if (wardFor === "Female" || wardFor === "Male") return sexDesignationAccepts(designation, wardFor);
  return true;
}

export type BedFinderFilters = {
  cohort: Cohort;
  bed: "any" | "locked" | "open";
  /** "Ward for" (D-187 item 14): Any, Female, Male, or another recorded gender, which filters no ward. */
  sex: BedFinderWardFor;
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
 * D-189 items 8(a) and 9(i): the Voluntary or Involuntary choice stays required, so its shape holds
 * when Q42 is signed, but authorisation is "not stated" for every ward, so it narrows nothing.
 */
export const BED_FINDER_AUTHORISATION_HINT =
  "Authorisation is not stated for any ward, so this does not narrow the list.";

/**
 * The finder's note: what the quick filter leaves out, so nobody reads its list as a fit list (M118,
 * 10 Nov 2026). It checks cohort and sex only, and drops forensic wards (D7). Authorisation reads
 * through `authorisationBlocksPlacement`, which narrows nothing while every ward is "not stated".
 * Review R6: the note no longer says the referral checks "every rule", as authorisation is not
 * checked while it is not stated; the referral's own gates (`ward-eligibility.ts`) still run.
 */
export const BED_FINDER_NOTE =
  "A to Z, not ranked. Forensic wards are left out. This quick filter does not check security, bay mix or a gender-diverse designation. The referral still runs the other bed checks before a bed is offered.";

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
  /** D-115 item 3: the named holds (open journeys and accepted referrals), so a named bed is not offered. */
  holds: readonly ReservationReferral[],
): BedFinderRow[] {
  if (!filters.legalStatus) return [];
  const involuntary = filters.legalStatus === "involuntary";
  return (
    units
      .filter((unit) => !unit.isClosed)
      // A forensic ward is never offered (D7), so the quick filter leaves it out as every engine path does (M118).
      .filter((unit) => !unit.forensic)
      .filter((unit) => unit.cohort === filters.cohort)
      .filter((unit) => !involuntary || !authorisationBlocksPlacement(unit))
      .filter((unit) => wardForAccepts(unit.sexDesignation, filters.sex))
      .map((unit) => {
        // Capped at the board's Ready figure, so this never shows more beds than the board or the bed
        // summary. NA3-05 (audit 26 Oct 2026): that figure is `readyBedsNow`, which leaves out a bed
        // pulled for an incoming patient; the older min(allocatable, empty) still offered it. The
        // data does not say which beds are empty, so each kind is capped on its own rather than
        // giving the cap to locked beds first.
        const ready = readyBedsNow(unit, admissions, releases, holds);
        // A bed held by name comes off its own kind before the cap (D-115 item 3, CodeRabbit on
        // #1637), so neither kind filter offers a named bed.
        const held = filters.bed === "any" ? undefined : heldBedsByKind(unit, admissions, holds);
        const free =
          filters.bed === "locked"
            ? Math.min(Math.max(0, lockedBedsFree(unit) - (held?.locked ?? 0)), ready)
            : filters.bed === "open"
              ? Math.min(Math.max(0, openBedsFree(unit) - (held?.open ?? 0)), ready)
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
            // A forensic ward is never offered (D7), here as in the operational finder (M118).
            !ward.forensic &&
            ward.cohort === filters.cohort &&
            (filters.legalStatus !== "involuntary" || !authorisationBlocksPlacement(ward)) &&
            wardForAccepts(ward.sexDesignation, filters.sex),
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
      <Choice label="Ward for" value={filters.sex} options={BED_FINDER_WARD_FOR} onChange={set("sex")} />
      {wardForNeedsReview(filters.sex) ? (
        <p className={styles.note} role="note" data-testid="ward-bed-finder-gender-review">
          {BED_FINDER_GENDER_REVIEW}
        </p>
      ) : null}
      <Choice
        label="Legal status"
        value={filters.legalStatus}
        options={[
          { value: "voluntary", label: "Voluntary" },
          { value: "involuntary", label: "Involuntary" },
        ]}
        onChange={set("legalStatus")}
      />
      <p className={styles.note} role="note" data-testid="ward-bed-finder-authorisation-hint">
        {BED_FINDER_AUTHORISATION_HINT}
      </p>
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
      <p className={styles.note}>{BED_FINDER_NOTE}</p>
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
  const { units, admissions, bedReleases, movements, referrals, now } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "movements",
    "referrals",
    "now",
  );
  // Access audit (31 Oct 2026): a ward links to its page only for a desk that may open that page,
  // by the same role table the menu reads. Another desk still reads the row, as plain text.
  const canOpen = useCanOpenHref();
  const [filters, setFilters] = useState<BedFinderFilters>(DEFAULT_BED_FINDER_FILTERS);
  const rows = findBeds(units, admissions, bedReleases, filters, [...movements, ...referrals]);
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
      <Choice label="Ward for" value={filters.sex} options={BED_FINDER_WARD_FOR} onChange={set("sex")} />
      {wardForNeedsReview(filters.sex) ? (
        <p className={styles.note} role="note" data-testid="ward-bed-finder-gender-review">
          {BED_FINDER_GENDER_REVIEW}
        </p>
      ) : null}
      {/* Required, with no default (D-189 item 8(a): it narrows nothing until Q42 is signed). */}
      <Choice<BedFinderLegalStatus>
        label="Legal status"
        value={filters.legalStatus}
        options={[
          { value: "voluntary", label: "Voluntary" },
          { value: "involuntary", label: "Involuntary" },
        ]}
        onChange={set("legalStatus")}
      />
      <p className={styles.note} role="note" data-testid="ward-bed-finder-authorisation-hint">
        {BED_FINDER_AUTHORISATION_HINT}
      </p>
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
          Choose Voluntary or Involuntary under Legal status to list wards.
        </p>
      )}
      <p className={styles.note}>{BED_FINDER_NOTE}</p>
    </div>
  );
}
