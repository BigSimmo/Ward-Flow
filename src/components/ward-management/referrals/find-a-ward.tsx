"use client";

/**
 * THE ONE "FIND A WARD" LIST (D-91, Josh, 31 Oct 2026: "the two Find a ward lists" become one).
 * Referrals' "Ask more wards" (a community referral, D-76) and the patient record's Destination
 * sheet ("Ask wards", D-77) each drew their own search and ward rows. Both now draw this list, so
 * the same search, groups and rows appear in each; each host keeps its own action (Ask more wards'
 * footer, the Destination sheet's Ask button) and its own rules for what may be ticked.
 *
 * - One page search field (`parts/search-field.tsx`): ward or hospital, with a count line.
 * - Listed A to Z, never ranked (D-71): wards already asked first (when the host has them), then
 *   "Fits, bed ready", then "Needs a recorded reason" and "Not suitable" (R-BEDS-10). No ward is suggested or pre-ticked.
 * - Each row: a checkbox, the ward name and its hospital in full (they wrap, never "…"), then the
 *   ready beds for a fit or the reason for a review. Only a fitting ward can be ticked.
 * - Needs review opens on its first three, then the one Show more (`parts/show-more-row.tsx`). A
 *   search shows every match.
 *
 * Synthetic data only. Typed words stay in memory.
 *
 * Example (the patient record):
 *
 *     <FindAWard query={q} onQueryChange={setQ} rows={rows} chosen={ids} onToggle={toggle}
 *       note="Usually up to 3 wards at once." testIdPrefix="ward-ask-ward" />
 */
import { useId, useState, type ReactNode } from "react";

import { cx, SearchField, ShowMoreRow, StatusGlyph } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { fieldsMatchEveryWord, queryWords } from "@/components/ward-management/search/search-text";
import ph from "./referral-match-phone.module.css";

import styles from "./find-a-ward.module.css";

/** Needs review opens on this many rows, then Show more. */
const REVIEW_FIRST_ROWS = 3;

export type FindAWardRow = {
  unit: Unit;
  /** Whether the ward fits this referral now; only a fitting ward can be ticked. */
  fit: boolean;
  /** Why a ward needs review, in the engine's words. Ignored for a fit. */
  reason?: string;
  /**
   * PL6 / H7 (D-210 (Josh, 14 Nov 2026)): the shared Ready the host read (`readyBedsFor`), printed
   * as "N ready". Never the ward's raw allocatable figure, which ignores pulls, named holds and beds
   * being made ready.
   */
  ready: number;
  /**
   * H8: set when every check passes except that the ward's bed count is old, with the words to show
   * ("Bed count 75 min old, check with the ward"). Such a ward can still be asked, so it can be
   * ticked, and it is listed on its own under "Fits, bed count old".
   */
  stale?: string;
  /**
   * R-BEDS-10 (Josh, 14 Nov 2026): set when no recorded reason can place the person here (the shared
   * classifier's `not_suitable`, or a ward closed to admissions). Listed under "Not suitable", never
   * under "Needs a recorded reason". Display grouping only; who can be ticked is unchanged.
   */
  unsuitable?: boolean;
  /** D-227: set when only the ward's beds fail (the shared classifier's `no_bed`). Listed under "No bed now". */
  noBed?: boolean;
  /**
   * D-228 (Josh, 14 Nov 2026): a fitting ward whose every bed is locked, for a movement that needs an
   * open bed. Listed under "Fits, locked ward" with an amber "Locked", never as an equal fit. Still
   * tickable, with no reason needed.
   */
  locked?: boolean;
};

export type FindAWardProps = {
  /** The typed words, kept by the host (it may clear them when its action completes). */
  query: string;
  onQueryChange: (query: string) => void;
  /** Every ward not yet asked, in any order: the list sorts them A to Z and splits fit from review. */
  rows: readonly FindAWardRow[];
  /** The ward ids ticked. */
  chosen: readonly string[];
  onToggle: (unitId: string, on: boolean) => void;
  /** The host's own limit, for example Ask more wards' hard cap. Leave out for none. */
  canTick?: (unitId: string) => boolean;
  /** No ward can be ticked at all, for example once a ward has accepted. */
  disabled?: boolean;
  /** Wards already asked, each with the host's own answer or action, drawn first. */
  asked?: { count: number; rows: ReactNode };
  /** One quiet line at the foot, after "Listed A to Z, never ranked." */
  note?: ReactNode;
  /** Each row's test id is `${testIdPrefix}-${unit.id}`. */
  testIdPrefix: string;
};

const byName = (a: FindAWardRow, b: FindAWardRow) => a.unit.name.localeCompare(b.unit.name);

/** Every typed word is found in the ward name or its hospital. A host filters its own asked rows with it. */
export function wardMatchesQuery(query: string, unit: Pick<Unit, "name" | "siteCode">): boolean {
  // No searchable word (empty, or only punctuation such as "-") narrows nothing.
  if (queryWords(query).length === 0) return true;
  // Search audit, 8 Nov 2026: folded like every other search, and the site code ("SCGH") counts too.
  return fieldsMatchEveryWord(query, [unit.name, siteByCode(unit.siteCode)?.name, unit.siteCode]);
}

export function FindAWard({
  query,
  onQueryChange,
  rows,
  chosen,
  onToggle,
  canTick,
  disabled = false,
  asked,
  note,
  testIdPrefix,
}: FindAWardProps) {
  const baseId = useId();
  const [showAllReview, setShowAllReview] = useState(false);
  const searching = query.trim().length > 0;
  const shown = rows.filter((row) => wardMatchesQuery(query, row.unit));
  const fits = shown.filter((row) => row.fit && row.stale === undefined && !row.locked).sort(byName);
  const lockedRows = shown.filter((row) => row.fit && row.locked).sort(byName);
  const staleRows = shown.filter((row) => row.fit && row.stale !== undefined && !row.locked).sort(byName);
  const noBedRows = shown.filter((row) => !row.fit && !row.unsuitable && row.noBed).sort(byName);
  const review = shown.filter((row) => !row.fit && !row.unsuitable && !row.noBed).sort(byName);
  const notSuitable = shown.filter((row) => !row.fit && row.unsuitable).sort(byName);
  const reviewShown = showAllReview || searching ? review : review.slice(0, REVIEW_FIRST_ROWS);
  const askedCount = asked?.count ?? 0;

  const row = ({ unit, fit, reason, ready, stale, unsuitable, noBed, locked }: FindAWardRow) => {
    const checked = chosen.includes(unit.id);
    const site = siteByCode(unit.siteCode)?.name;
    const tickable = fit && !disabled && (checked || (canTick?.(unit.id) ?? true));
    return (
      <label
        key={unit.id}
        className={cx(ph.cand, styles.row)}
        data-kind={
          fit
            ? locked
              ? "locked"
              : stale === undefined
                ? "yes"
                : "stale"
            : unsuitable
              ? "unsuitable"
              : noBed
                ? "nobed"
                : "review"
        }
        data-testid={`${testIdPrefix}-${unit.id}`}
      >
        <input
          type="checkbox"
          className={styles.box}
          aria-label={unit.name}
          aria-describedby={`${baseId}-sub-${unit.id}`}
          checked={checked}
          disabled={!tickable}
          onChange={(event) => onToggle(unit.id, event.target.checked)}
        />
        <span className={ph.who}>
          <span className={cx(ph.nm, styles.wrap)}>{unit.name}</span>
          <span className={cx(ph.sub, styles.wrap)} id={`${baseId}-sub-${unit.id}`}>
            {[site, fit ? (stale ?? `${ready} ready`) : reason].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={ph.lab}>
          <StatusGlyph
            tone={fit ? (stale === undefined && !locked ? "success" : "warning") : noBed ? "warning" : "neutral"}
            size={9}
          />
          {fit
            ? locked
              ? "Locked"
              : stale === undefined
                ? "Fits"
                : "Count not current"
            : unsuitable
              ? "Not suitable"
              : noBed
                ? "No bed now"
                : "Needs a reason"}
        </span>
      </label>
    );
  };

  return (
    <div className={styles.finder} data-testid="find-a-ward">
      <SearchField
        className={styles.search}
        id={`${baseId}-search`}
        label="Find a ward"
        placeholder="Ward or hospital"
        value={query}
        onValueChange={onQueryChange}
        count={{ shown: shown.length, total: rows.length, noun: rows.length === 1 ? "ward" : "wards" }}
      />
      {askedCount +
        fits.length +
        lockedRows.length +
        staleRows.length +
        noBedRows.length +
        review.length +
        notSuitable.length ===
      0 ? (
        <p className={styles.empty}>No ward matches that search.</p>
      ) : null}
      {asked && askedCount > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-asked`}>
          <p className={ph.ch} id={`${baseId}-asked`}>
            Asked <span className={ph.k}>{askedCount}</span>
          </p>
          <div className={styles.rows} role="list" aria-labelledby={`${baseId}-asked`}>
            {asked.rows}
          </div>
        </section>
      ) : null}
      {fits.length > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-fits`}>
          <p className={ph.ch} id={`${baseId}-fits`}>
            Fits, bed ready <span className={ph.k}>{fits.length}</span>
          </p>
          {/* Referrals redesign (31 Oct 2026): the group keeps today's name, without the count,
              as both hosts' lists had it, so a screen reader and the tests find it the same way. */}
          <div className={styles.rows} role="group" aria-label="Fits, bed ready">
            {fits.map(row)}
          </div>
        </section>
      ) : null}
      {lockedRows.length > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-locked`}>
          <p className={ph.ch} id={`${baseId}-locked`}>
            Fits, locked ward <span className={ph.k}>{lockedRows.length}</span>
          </p>
          <div className={styles.rows} role="group" aria-label="Fits, locked ward">
            {lockedRows.map(row)}
          </div>
        </section>
      ) : null}
      {staleRows.length > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-stale`}>
          <p className={ph.ch} id={`${baseId}-stale`}>
            Fits, bed count old <span className={ph.k}>{staleRows.length}</span>
          </p>
          <div className={styles.rows} role="group" aria-label="Fits, bed count old">
            {staleRows.map(row)}
          </div>
        </section>
      ) : null}
      {noBedRows.length > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-nobed`}>
          <p className={ph.ch} id={`${baseId}-nobed`}>
            No bed now <span className={ph.k}>{noBedRows.length}</span>
          </p>
          <div className={styles.rows} role="group" aria-label="No bed now">
            {noBedRows.map(row)}
          </div>
        </section>
      ) : null}
      {review.length > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-review`}>
          <p className={ph.ch} id={`${baseId}-review`}>
            Needs a recorded reason <span className={ph.k}>{review.length}</span>
          </p>
          <div className={styles.rows} role="group" aria-label="Needs a recorded reason" id={`${baseId}-review-rows`}>
            {reviewShown.map(row)}
          </div>
          {!searching && review.length > REVIEW_FIRST_ROWS ? (
            <ShowMoreRow
              onClick={() => setShowAllReview((all) => !all)}
              expanded={showAllReview}
              controls={`${baseId}-review-rows`}
            >
              {showAllReview ? "Show fewer" : `Show ${review.length - REVIEW_FIRST_ROWS} more to review`}
            </ShowMoreRow>
          ) : null}
        </section>
      ) : null}
      {notSuitable.length > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-unsuitable`}>
          <p className={ph.ch} id={`${baseId}-unsuitable`}>
            Not suitable <span className={ph.k}>{notSuitable.length}</span>
          </p>
          <div className={styles.rows} role="group" aria-label="Not suitable">
            {notSuitable.map(row)}
          </div>
        </section>
      ) : null}
      <p className={styles.note}>
        Listed A to Z, never ranked.
        {note ? <> {note}</> : null}
      </p>
    </div>
  );
}
