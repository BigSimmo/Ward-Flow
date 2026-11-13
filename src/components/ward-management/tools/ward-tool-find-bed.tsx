"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ArrowUpRight, Lock, LockOpen, SearchX } from "lucide-react";

import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  designationSummary,
  unitHasLockedBeds,
  unitHasOpenBeds,
} from "@/components/ward-management/ward-bed-designation";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { COHORTS, type Cohort } from "@/components/ward-management/ward-model";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import {
  BED_FINDER_GENDER_REVIEW,
  BED_FINDER_NOTE,
  BED_FINDER_WARD_FOR,
  findBeds,
  wardForAccepts,
  wardForNeedsReview,
  type BedFinderFilters,
} from "@/components/ward-management/tools/ward-bed-finder";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import {
  Button,
  ChipGroup,
  EmptyState,
  FilterChip,
  Segmented,
  ShowMoreRow,
  SrOnly,
  foldHidden,
  foldLimit,
} from "@/components/wf";
import styles from "./ward-tool-find-bed.module.css";

/**
 * Tools mock-up Q317, Find a bed. Forked from the live `WardBedFinder` view; the filtering is still
 * `findBeds` (or the executive report's wards), so the counts match the board. Results come first:
 * the four filters fold into one summary line with a quiet Change. Wards are A to Z, never ranked
 * (never-build rule), and only wards with a Ready bed are listed. Legal status keeps its no-default
 * rule (audit 24-1 decision 1): until one is chosen, the filters stay open and nothing is listed.
 * The last choice is remembered on this device only.
 */

type Filters = Omit<BedFinderFilters, "home">;
type Bed = Filters["bed"];
type Sex = Filters["sex"];
type Legal = NonNullable<Filters["legalStatus"]>;

const STORAGE_KEY = "wf-tools-find-bed";
const LIMIT = 8;
const DEFAULT_FILTERS: Filters = { cohort: "Adult", bed: "any", sex: "any" };

const BED_ITEMS: { id: Bed; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "locked", label: "Locked" },
  { id: "open", label: "Open" },
];
// D-187 item 14 (Q36): Any, Female, Male and the other recorded genders (R7), from the finder's one list.
const SEX_ITEMS: readonly { id: Sex; label: string }[] = BED_FINDER_WARD_FOR.map(({ value, label }) => ({
  id: value,
  label,
}));
const LEGAL_ITEMS: { id: Legal | ""; label: string }[] = [
  { id: "voluntary", label: "Voluntary" },
  { id: "involuntary", label: "Involuntary" },
];

function readStored(): Filters | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Filters>;
    if (!COHORTS.includes(value.cohort as Cohort)) return null;
    if (!BED_ITEMS.some((item) => item.id === value.bed)) return null;
    if (!SEX_ITEMS.some((item) => item.id === value.sex)) return null;
    const legalStatus = LEGAL_ITEMS.some((item) => item.id === value.legalStatus)
      ? (value.legalStatus as Legal)
      : undefined;
    return { cohort: value.cohort as Cohort, bed: value.bed as Bed, sex: value.sex as Sex, legalStatus };
  } catch {
    return null;
  }
}

function writeStored(filters: Filters) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Storage blocked or full: the choice is simply not remembered.
  }
}

function summaryText(filters: Filters): string {
  const bed = filters.bed === "any" ? "Any bed" : filters.bed === "locked" ? "Locked bed" : "Open bed";
  // "Any" alone read as nothing in the summary line (polish 3 Nov), so the ward filter says "ward".
  // D-187 item 14: another gender filters no ward, so the line names the coordinator review instead.
  const sex =
    filters.sex === "any"
      ? "Any ward"
      : wardForNeedsReview(filters.sex)
        ? `${filters.sex}, coordinator review`
        : `${filters.sex} ward`;
  const legal =
    filters.legalStatus === "voluntary"
      ? "Voluntary"
      : filters.legalStatus === "involuntary"
        ? "Involuntary"
        : "Legal status?";
  return [filters.cohort, bed, sex, legal].join(" · ");
}

type FoundRow = {
  id: string;
  name: string;
  place: string;
  free: number;
  /** Ready beds still being made ready: the pull is refused until they are (owner ruling 5 Sept). */
  pending: number;
  locked: boolean;
  open: boolean;
  designation: string;
  href: string;
};

export function ToolFindBed({ onNavigate }: { onNavigate: () => void }) {
  const executive = useExecutiveStatisticsControl().executive;
  // The tool draws only after its row is opened in the browser, so the saved choice is read at once.
  const [filters, setFilters] = useState<Filters>(() => readStored() ?? DEFAULT_FILTERS);
  const [editing, setEditing] = useState(() => !readStored()?.legalStatus);

  const update = (next: Partial<Filters>) => {
    setFilters((current) => {
      const merged = { ...current, ...next };
      writeStored(merged);
      return merged;
    });
  };

  return (
    <div className={styles.body} data-testid="ward-tools-bed-finder">
      <div className={styles.bar}>
        <span className={styles.summary} data-testid="ward-bed-finder-summary">
          {summaryText(filters)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={styles.change}
          onClick={() => setEditing((value) => !value)}
          aria-expanded={editing}
        >
          {editing ? "Done" : "Change"}
        </Button>
      </div>
      {editing ? <FilterPanel filters={filters} onChange={update} /> : null}
      {wardForNeedsReview(filters.sex) ? (
        <p className={styles.prompt} role="note" data-testid="ward-bed-finder-gender-review">
          {BED_FINDER_GENDER_REVIEW}
        </p>
      ) : null}
      {filters.legalStatus ? (
        executive ? (
          <ExecutiveResults filters={filters} onNavigate={onNavigate} />
        ) : (
          <OperationalResults filters={filters} onNavigate={onNavigate} />
        )
      ) : (
        <p className={styles.prompt} role="status">
          Choose a legal status to list wards.
        </p>
      )}
      <p className={styles.note}>{BED_FINDER_NOTE}</p>
    </div>
  );
}

function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (next: Partial<Filters>) => void }) {
  return (
    <div className={styles.panel}>
      <FilterRow label="Age group">
        <Segmented<Cohort>
          label="Age group"
          items={COHORTS.map((cohort) => ({ id: cohort, label: cohort }))}
          value={filters.cohort}
          onChange={(cohort) => onChange({ cohort })}
        />
      </FilterRow>
      <FilterRow label="Bed">
        <Segmented<Bed> label="Bed" items={BED_ITEMS} value={filters.bed} onChange={(bed) => onChange({ bed })} />
      </FilterRow>
      {/* D-187 item 14: five choices, so chips that wrap on a phone, not one segmented track. */}
      <FilterRow label="Ward for">
        <ChipGroup label="Ward for">
          {SEX_ITEMS.map((item) => (
            <FilterChip
              key={item.id}
              pressed={filters.sex === item.id}
              onPressedChange={() => {
                if (filters.sex !== item.id) onChange({ sex: item.id });
              }}
            >
              {item.label}
            </FilterChip>
          ))}
        </ChipGroup>
      </FilterRow>
      {/* Required, with no default: Involuntary keeps the list to authorised wards. */}
      <FilterRow label="Legal status">
        <Segmented<Legal | "">
          label="Legal status"
          items={LEGAL_ITEMS}
          value={filters.legalStatus ?? ""}
          onChange={(legalStatus) => {
            if (legalStatus) onChange({ legalStatus });
          }}
        />
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.filterRow}>
      <span className={styles.filterLabel} aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

function OperationalResults({ filters, onNavigate }: { filters: Filters; onNavigate: () => void }) {
  const { units, admissions, bedReleases, movements, referrals } = useWardFlowSelect(
    "units",
    "admissions",
    "bedReleases",
    "movements",
    "referrals",
  );
  const rows: FoundRow[] = findBeds(units, admissions, bedReleases, { ...filters, home: "any" }, [
    ...movements,
    ...referrals,
  ])
    .filter((row) => row.free > 0)
    .map((row) => ({
      id: row.unit.id,
      name: row.unit.name,
      place: siteByCode(row.unit.siteCode)?.name ?? row.unit.siteCode,
      free: row.free,
      pending: bedsPendingPreparation(row.unit.id, bedReleases),
      locked: unitHasLockedBeds(row.unit),
      open: unitHasOpenBeds(row.unit),
      designation: designationSummary(row.unit),
      href: unitHref(row.unit.id),
    }));
  return <ResultList rows={rows} onNavigate={onNavigate} />;
}

function ExecutiveResults({ filters, onNavigate }: { filters: Filters; onNavigate: () => void }) {
  const report = useExecutiveStatistics();
  if (!report) return <p role="status">Ready beds show once this report is ready.</p>;
  const rows: FoundRow[] = report.wards
    .filter(
      (ward) =>
        !ward.isClosed &&
        // A forensic ward is never offered (D7), here as in the operational finder (M118).
        !ward.forensic &&
        ward.cohort === filters.cohort &&
        (filters.legalStatus !== "involuntary" || ward.authorised) &&
        wardForAccepts(ward.sexDesignation, filters.sex),
    )
    .map((ward) => ({
      ward,
      free: filters.bed === "locked" ? ward.lockedReady : filters.bed === "open" ? ward.openReady : ward.beds.ready,
    }))
    .filter((row) => row.free > 0)
    .toSorted((a, b) => a.ward.name.localeCompare(b.ward.name, "en-AU") || a.ward.id.localeCompare(b.ward.id))
    .map(({ ward, free }) => ({
      id: ward.id,
      name: ward.name,
      place: report.catalogue.sites.find((site) => site.code === ward.siteCode)?.name ?? ward.siteCode,
      free,
      pending: ward.pendingPreparation,
      // The report carries Ready counts by kind, not designations, so the glyph follows those.
      locked: ward.lockedReady > 0,
      open: ward.openReady > 0,
      designation:
        ward.lockedReady > 0 && ward.openReady > 0 ? "Locked and open" : ward.lockedReady > 0 ? "Locked" : "Open",
      href: `/ward-flow/statistics/ward/${encodeURIComponent(ward.id)}`,
    }));
  return <ResultList rows={rows} onNavigate={onNavigate} />;
}

function ResultList({ rows, onNavigate }: { rows: FoundRow[]; onNavigate: () => void }) {
  // Access audit (31 Oct 2026): a ward links only for a desk that may open its page; others read it as text.
  const canOpen = useCanOpenHref();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (rows.length === 0) {
    return <EmptyState icon={SearchX} title="No ready bed fits." meta="Try Any bed." />;
  }
  const total = rows.reduce((sum, row) => sum + row.free, 0);
  const shown = expanded ? rows.length : foldLimit(rows.length, LIMIT);
  const hidden = foldHidden(rows.length, LIMIT);
  return (
    <div className={styles.results}>
      <p className={styles.total} role="status">
        {/* The noun carries the provenance, so the announced count says what it counts. */}
        <span className={styles.mono}>{total}</span> ready synthetic beds in{" "}
        <span className={styles.mono}>{rows.length}</span> {rows.length === 1 ? "ward" : "wards"}
      </p>
      <ul className={styles.list} id={listId} aria-label="Ready beds by ward">
        {rows.slice(0, shown).map((row) => (
          <li key={row.id}>
            {canOpen(row.href) ? (
              <Link className={styles.row} href={row.href} onClick={onNavigate}>
                <RowText row={row} />
                <ArrowUpRight className={styles.go} aria-hidden="true" strokeWidth={1.75} />
              </Link>
            ) : (
              <div className={styles.row} data-testid="ward-bed-finder-row-plain">
                <RowText row={row} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow onClick={() => setExpanded((value) => !value)} expanded={expanded} controls={listId}>
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </ShowMoreRow>
      ) : null}
    </div>
  );
}

function RowText({ row }: { row: FoundRow }) {
  return (
    <>
      <span className={styles.glyphs} title={row.designation}>
        {row.locked ? <Lock aria-hidden="true" size={13} strokeWidth={1.75} /> : null}
        {row.open ? <LockOpen aria-hidden="true" size={13} strokeWidth={1.75} /> : null}
        <SrOnly>{row.designation}.</SrOnly>
      </span>
      <span className={styles.name}>
        <strong>{row.name}</strong>
        <small>
          {row.place}
          {row.pending > 0 ? ` · ${row.pending} being made ready` : null}
        </small>
      </span>
      <span className={styles.count}>
        <b className={styles.mono}>{row.free}</b>
        <small>ready</small>
      </span>
    </>
  );
}
