import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";

import { Icon, SrOnly, StatusGlyph, cx, durMinutes } from "@/components/wf";
import { BedSquares, bedSquareCounts, bedSquaresNotes } from "@/components/ward-management/bed-squares";
import type { Instant } from "@/components/ward-management/ward-clock";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { designationSummary, unitHasLockedBeds, wardCategory } from "@/components/ward-management/ward-bed-designation";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import type { CohortFilter } from "./ward-index";
import styles from "./ward-index.module.css";

// The All wards card and its helpers, split out of `ward-index.tsx` to keep it under its line cap.

export function serviceShortName(service: HealthService): string {
  return service.replace(/ Metro$/u, "");
}

/** Mother and baby wards read as perinatal; the model's cohorts are Adult, Older adult, Youth. */
export function cohortKey(unit: Unit): Exclude<CohortFilter, "all"> {
  if (/mother|baby|perinatal|mbu/iu.test(unit.name)) return "perinatal";
  if (unit.cohort === "Older adult") return "older-adult";
  if (unit.cohort === "Youth") return "youth";
  return "adult";
}

export function cohortLabel(unit: Unit): string {
  return cohortKey(unit) === "perinatal" ? "Perinatal" : unit.cohort;
}

/** Owner ruling 2026-09-04: Open, Locked or Mixed, read from the bed counts. */
export function SecurityLabel({ unit, showOpen = false }: { unit: Unit; showOpen?: boolean }) {
  const category = wardCategory(unit);
  // Audit two #121 (Josh decides): a card shows the badge only for Locked and Mixed; the table keeps all three.
  if (category === "Open" && !showOpen) return null;
  return (
    <span className={styles.acuityBadge} data-category={category} title={designationSummary(unit)}>
      {category !== "Open" ? <Icon icon={Lock} size={14} /> : null}
      {category}
    </span>
  );
}

/** Near full: the signed occupancy surge band (95%), as a fraction. */
export const NEAR_FULL = CLINICAL_VALUES.occupancySurge.value / 100;

/** D-122: the band tests the whole percent the card shows, so 18 of 19 (94.7%, shown 95%) is near full too. */
export function isNearFull(occupancy: number): boolean {
  // A whole percent rounds half up, so the shown figure reaches the band from half a point below it.
  return occupancy >= NEAR_FULL - 0.005;
}

export type WardRow = {
  unit: Unit;
  service: HealthService | null;
  siteName: string;
  siteShort: string;
  states: ReturnType<typeof bedStates>;
  occupancy: number;
  ready: number;
  /** Beds being made ready, off Ready since D-179 item 8: the hollow squares' own figure (`bedStates`). */
  pendingPreparation: number;
  /** Wave 4 bed squares (D-191): discharges still due today and not held up (`isFreeingToday`). */
  dischargesToday: number;
  /** Held-up discharges, as Capacity and Discharges count them (`heldUpReleases`). */
  heldUp: number;
  out: number;
  incoming: number;
  confirmedAt: Instant;
  stale: boolean;
  specialling: number;
};

/** "Maali (Ward 4.2)", not "Maali (Ward 4.2) — open"; the security label already says it. */
export function shortWardName(unit: Pick<Unit, "name">): string {
  return unit.name.split(" — ")[0];
}

/** The card's occupancy as a soft pill, amber from the surge band (95%). */
function OccupancyPill({ row }: { row: WardRow }) {
  const pct = Math.round(row.occupancy * 100);
  const nearFull = isNearFull(row.occupancy);
  return (
    <span className={styles.sharePill} data-tone={nearFull ? "warning" : undefined}>
      {nearFull ? <StatusGlyph tone="warning" size={8} /> : null}
      <b className={styles.num}>{pct}%</b> {nearFull ? "near full" : "in use"}
    </span>
  );
}

export function Confirmed({ row, now }: { row: WardRow; now: Instant }) {
  const age = durMinutes(Math.max(0, now - row.confirmedAt));
  return row.stale ? (
    <span className={styles.confirmed}>
      <StatusGlyph tone="warning" size={8} />
      {/* Site bed manager: another site's count is its own ward's to chase, not this desk's. */}
      Count <b className={styles.num}>{age}</b> old
    </span>
  ) : (
    <span className={styles.confirmed}>
      <b className={styles.num}>{age}</b> since confirmed
    </span>
  );
}

export function WardCard({
  row,
  now,
  onOpen,
  dim = false,
  countsOnly = false,
  headingLevel = 2,
}: {
  row: WardRow;
  now: Instant;
  /** WS1: the card opens the ward's side panel. */
  onOpen: () => void;
  dim?: boolean;
  /** A7 (accessibility check, 2 Nov 2026): h2 under the page title, h3 under a site bed manager's site heading. */
  headingLevel?: 2 | 3;
  /** Site bed manager: another site's ward, drawn as bed counts with no way in. */
  countsOnly?: boolean;
}) {
  const { unit } = row;
  const WardTitle = headingLevel === 3 ? "h3" : "h2";
  return (
    <article
      className={styles.wardCard}
      data-dim={dim ? "true" : undefined}
      data-service={row.service ?? "none"}
      data-cohort={cohortKey(unit)}
      data-avail={row.ready > 0 ? "vacant" : "full"}
      data-acuity={unitHasLockedBeds(unit) ? "high" : "standard"}
    >
      <div className={styles.cardTitleBlock}>
        <div className={styles.cardHead}>
          <WardTitle className={cx(styles.wardTitle, styles.wrapLine)} title={unit.name}>
            {/* The name is the card's one target: it stretches over the card and opens the side panel. */}
            <button type="button" className={styles.cardOpen} aria-haspopup="dialog" onClick={onOpen}>
              {shortWardName(unit)}
            </button>
          </WardTitle>
          <SecurityLabel unit={unit} />
        </div>
        <p className={styles.meta} title={`${row.service ?? ""} · ${row.siteName} · ${unit.cohort}`}>
          {row.service ? serviceShortName(row.service) : "Not placed"} · {row.siteShort} · {cohortLabel(unit)}
        </p>
      </div>
      {/* One large figure, then the strip and the quiet lines at the card's foot, so they line up across a row. */}
      <div className={cx(styles.readyLine, styles.stripFoot)}>
        <span className={styles.readyFigure}>{row.ready}</span>
        <span className={styles.readyWords}>
          ready of <b className={styles.num}>{unit.beds}</b>
        </span>
        <OccupancyPill row={row} />
      </div>
      {/* Wave 4 (D-191, ruling 7): the shared bed squares; the card's line above is their head. */}
      {/* The squares, their note line and a stale count share one block, so a card's rows line up
          with its neighbours' (the grid's subgrid rows, ward-index.module.css). */}
      <div className={styles.cardBeds}>
        <WardBedSquares row={row} className={styles.strip} />
        {/* Second pass (3 Nov 2026): the confirmation age shows on a card only when it is past the
            ward's limit, the one time anyone acts on it. A fresh age is in the side panel. */}
        {row.stale ? (
          <p className={styles.staleLine}>
            <Confirmed row={row} now={now} />
          </p>
        ) : null}
      </div>
      <div className={styles.cardFoot}>
        {/* Site bed manager: out and in are read from people records a site desk is not
            given for other sites, so they would read 0. Its counts-only cards leave them out. */}
        {countsOnly ? (
          <span className={styles.flow}>
            <b className={styles.num}>{unit.beds}</b> beds
          </span>
        ) : (
          <span className={styles.flow}>
            <b className={styles.num}>{row.out}</b> out <span aria-hidden="true">·</span>{" "}
            <b className={styles.num}>{row.incoming}</b> in today
          </span>
        )}
        {countsOnly ? (
          <span className={styles.countsOnly}>Bed counts only</span>
        ) : (
          <Link
            className={styles.cardLink}
            href={`/bedchart/ward/${unit.id}`}
            data-testid={`ward-index-link-${unit.id}`}
            aria-label={`Open ward: ${unit.name}`}
          >
            Open ward
            <ChevronRight strokeWidth={1.75} size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}

/**
 * Wave 4 (D-191, ruling 7): one ward's beds as the shared bed squares, for the card, the phone sheet
 * and the table. The card's own line ("1 ready of 20") is the head, so the squares draw without one;
 * the note line says pulled, held up and the rest in words (a pulled bed is no longer hatched: the
 * hatch means "may move"). The squares are decorative; the card's line, the sheet's figures and the
 * table's Ready column say the counts. Since D-179 item 8 (PR C) a bed being made ready is off
 * Ready and drawn as its own hollow square.
 */
export function WardBedSquares({
  row,
  className,
  notes = true,
}: {
  row: WardRow;
  className?: string;
  notes?: boolean;
}) {
  const { unit, states } = row;
  const counts = bedSquareCounts({
    beds: unit.beds,
    ready: row.ready,
    beingMadeReady: states.beingMadeReady,
    dischargesToday: row.dischargesToday,
    closed: states.closed,
  });
  const squares = (
    <BedSquares
      className={className}
      size={notes ? "map" : "table"}
      head={false}
      counts={counts}
      notes={
        notes
          ? bedSquaresNotes({
              dischargesToday: row.dischargesToday,
              heldUp: row.heldUp,
              pulled: states.pulled,
              prep: row.pendingPreparation,
              closed: states.closed,
              onLeave: states.onLeave,
            })
          : undefined
      }
      testId={`ward-index-squares-${unit.id}`}
    />
  );
  if (notes) return squares;
  // Review FA-3: the table's squares have no note line and the strip is hidden from screen readers,
  // so the cell says the squares in words, from the same counts the strip draws (no new counting).
  const spoken = [
    `${counts.ready} ready`,
    counts.prep > 0 ? `${counts.prep} being made ready` : null,
    counts.free > 0 ? `${counts.free} ${counts.free === 1 ? "discharge" : "discharges"} today` : null,
    counts.closed > 0 ? `${counts.closed} closed` : null,
    `${counts.use} in use${states.pulled > 0 ? `, ${states.pulled} of them pulled` : ""}`,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      {squares}
      <SrOnly>{`${unit.beds} beds: ${spoken}.`}</SrOnly>
    </>
  );
}
