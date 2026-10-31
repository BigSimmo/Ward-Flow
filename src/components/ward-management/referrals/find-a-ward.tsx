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
 *   "Fits, bed ready", then "Needs review". No ward is suggested or pre-ticked.
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

import { StatusGlyph, cx } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import ph from "./referral-match-phone.module.css";

import { SearchField } from "@/components/wf/search-field";
import { ShowMoreRow } from "@/components/wf/show-more-row";
import styles from "./find-a-ward.module.css";

/** Needs review opens on this many rows, then Show more. */
const REVIEW_FIRST_ROWS = 3;

export type FindAWardRow = {
  unit: Unit;
  /** Whether the ward fits this referral now; only a fitting ward can be ticked. */
  fit: boolean;
  /** Why a ward needs review, in the engine's words. Ignored for a fit. */
  reason?: string;
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
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = `${unit.name} ${siteByCode(unit.siteCode)?.name ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
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
  const fits = shown.filter((row) => row.fit).sort(byName);
  const review = shown.filter((row) => !row.fit).sort(byName);
  const reviewShown = showAllReview || searching ? review : review.slice(0, REVIEW_FIRST_ROWS);
  const askedCount = asked?.count ?? 0;

  const row = ({ unit, fit, reason }: FindAWardRow) => {
    const checked = chosen.includes(unit.id);
    const site = siteByCode(unit.siteCode)?.name;
    const tickable = fit && !disabled && (checked || (canTick?.(unit.id) ?? true));
    return (
      <label
        key={unit.id}
        className={cx(ph.cand, styles.row)}
        data-kind={fit ? "yes" : "review"}
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
            {[site, fit ? `${unit.allocatable.value} ready` : reason].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={ph.lab}>
          <StatusGlyph tone={fit ? "success" : "neutral"} size={9} />
          {fit ? "Fits" : "Review"}
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
      {askedCount + fits.length + review.length === 0 ? (
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
      {review.length > 0 ? (
        <section className={styles.group} aria-labelledby={`${baseId}-review`}>
          <p className={ph.ch} id={`${baseId}-review`}>
            Needs review <span className={ph.k}>{review.length}</span>
          </p>
          <div className={styles.rows} role="group" aria-label="Needs review" id={`${baseId}-review-rows`}>
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
      <p className={styles.note}>
        Listed A to Z, never ranked.
        {note ? <> {note}</> : null}
      </p>
    </div>
  );
}
