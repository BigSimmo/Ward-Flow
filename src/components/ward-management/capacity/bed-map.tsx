// src/components/ward-management/capacity/bed-map.tsx
//
// The network's whole bed supply, drawn as one square per bed — MERGE 02's Capacity screen gains
// a picture the table beside it cannot show: whether every ready bed tonight sits in one health
// service, or whether closed beds are piling up at two sites. Design lock reference: the mockup
// named in the build brief that added this section, "Bed map", beneath the existing network table.
//
// ⚠️ **EVERY COUNT HERE IS READ FROM AN EXISTING DERIVATION, NEVER COUNTED AGAIN.** `bedStates`
// (`ward-bed-states.ts`) partitions every unit into the owner's ruled boxes, `ready + pulled +
// closed + occupied === unit.beds`, built on `unitCapacity` (`ward-derivations.ts`) — the same
// partition the bed board's per-bed tiles and `ward-management-network.tsx`'s service clusters read.
// This file draws one more picture from that one partition rather than inventing another.
// "Held" is not a square here: it means only a bed kept for a patient on leave, already inside
// Occupied, and is shown as an "on leave" marker beside the squares, never a fifth state.
//
// 🔴 **WHY THE MAP AND THE TABLE NOW SHARE ONE SOURCE, WRITTEN DOWN RATHER THAN LEFT FOR THE NEXT
// PERSON TO REDISCOVER.** This map depends on every bed landing in exactly one square, so it may
// only read counts GUARANTEED to sum to `unit.beds`. It once read `unitCapacity(unit,
// releases).available` instead of `NetworkWardRow.ready`, because that row was then computed as
// `lockedBedsFree + openBedsFree` (allocatable alone, never `empty`) and could have drawn more or
// fewer squares than a ward has beds once a feed let `allocatable` exceed `empty`. The row now reads
// `bedStates` too, so the map can share it without losing that guarantee.
// The map and `NetworkWardRow` both read `bedStates`, including its reconciliation of live
// reservations against newer capacity observations. Ready and Pulled must be disjoint even when
// the ward's latest offered count includes a bed already reserved for someone.
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { StatusGlyph, WardCapacityRow, WardCapacityRows } from "@/components/wf";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { BED_STATE_DETAILS, BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import type { BedRelease, HealthService, LeaveBed, Unit } from "@/components/ward-management/ward-model";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { countCellText } from "./capacity-derivations";
import styles from "./bed-map.module.css";

/** The four ruled states a bed is drawn in. A `ready` square additionally carries `preparing` — see
 *  `BedSquare` below — never a fifth state of its own. */
type BedSquareState = "ready" | "pulled" | "closed" | "occupied";

/**
 * Grid: ward cards wrapping. Rows: one carousel of ward cards per service. Table: one shared
 * `WardCapacityRow` per ward (v10 Capacity).
 */
export type BedMapLayout = "grid" | "row" | "table";

export type BedMapWard = {
  unit: Unit;
  /** `bedStates().ready` — the same partition as the network table. */
  ready: number;
  /** `bedStates().pulled` — allocated to a named patient who has not arrived yet. */
  pulled: number;
  /** `bedStates().closed` — physically empty, not offered (out-of-service beds fold in here). */
  closed: number;
  /** `bedStates().occupied` — someone is in it; excludes a pulled patient. */
  occupied: number;
  /** Inside `occupied`: beds held for a patient on leave. A marker beside the squares, never one. */
  onLeave: number;
  /**
   * How many discharged beds are still being made ready — `bedsPendingPreparation`, the same function
   * whose result gates `PULL_PATIENT` in the reducer. **Never subtracted from `ready`**: owner
   * ruling 2026-09-05 (see `capacity-derivations.ts`'s `NetworkWardRow.pendingPreparation`), because
   * a bed being cleaned does not change what the ward can staff. This map draws it as a hatch OVER
   * a ready square rather than as a different-coloured square, for exactly that reason — it is
   * not usable this minute. If a later capacity observation no longer offers it as Ready, the
   * preparation record remains visible in words without implying another available bed.
   */
  pendingPreparation: number;
};

export type BedMapServiceGroup = {
  service: HealthService;
  /** Empty when no unit in the network reports to this service on this board — see `ServiceGroup`,
   *  which states that in words rather than heading a group with nothing in it. */
  wards: BedMapWard[];
};

/**
 * One row per unit, reading `bedStates`, `unitCapacity` and `bedsPendingPreparation` — nothing here
 * computes a bed count of its own. Without `admissions` no pull can be told apart, so Pulled is 0
 * and a seeded pulled patient stays inside Occupied (the same fallback as `networkWardRows`).
 *
 * Preparation is an actual discharged-stay record, not a promise that the ward offers that
 * bed now. A later staffable-capacity observation may be zero while preparation remains true.
 * Hatch only the subset representable inside Ready; retain the full record count and explain
 * the remainder in words rather than throwing or changing either observation.
 */
export function bedMapWards(
  units: Unit[],
  bedReleases: BedRelease[],
  admissions: readonly Admission[] = [],
  leaveBeds: readonly LeaveBed[] = [],
): BedMapWard[] {
  return units.map((unit) => {
    const states = bedStates(unit, admissions, bedReleases, leaveBeds);
    const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
    return {
      unit,
      ready: states.ready,
      pulled: states.pulled,
      closed: states.closed,
      occupied: states.occupied,
      onLeave: states.onLeave,
      pendingPreparation,
    };
  });
}

/**
 * Grouped by health service, in `wardServiceOrder` — the same canonical order and the same
 * `siteByCode(unit.siteCode)?.service` lookup `ward-management-network.tsx`'s service clusters
 * already use, so a ward never sits in a different service on this map than it does there.
 *
 * Every service in `wardServiceOrder` gets a group, including one with no wards — an empty array,
 * never an omitted entry — so a caller can say a service reports nothing rather than the service
 * simply not appearing, which is the "a unit missing reads as no such bed exists" failure
 * `ward-management-network.tsx`'s own `LEFT_COLUMN_SERVICES` comment records.
 */
export function groupBedMapWardsByService(wards: BedMapWard[]): BedMapServiceGroup[] {
  return wardServiceOrder.map((service) => ({
    service,
    wards: wards.filter((ward) => {
      const site = siteByCode(ward.unit.siteCode);
      // Every unit in this fixture resolves to a real site (`ward-capacity-screen.dom.test.tsx`
      // asserts "No site matches" never appears on the table beside this map) — an unresolved site
      // is a data contradiction, not a case to place somewhere by default, so this throws rather
      // than silently dropping the ward or guessing its service.
      if (!site) {
        throw new Error(`Bed map: no site matches "${ward.unit.siteCode}" for "${ward.unit.name}".`);
      }
      return site.service === service;
    }),
  }));
}

type BedSquare = {
  key: string;
  state: BedSquareState;
  /** Only ever `true` on a `state: "ready"` square — see `BedMapWard.pendingPreparation`. */
  preparing: boolean;
};

/** `unit.beds` squares, grouped by state so same-coloured squares sit together — a presentation
 *  choice only; nothing about which bed is "first" is a real fact this model holds (the same
 *  discipline `ward-board.tsx`'s own tile-building function records for its per-bed tiles). */
function buildSquares(ward: BedMapWard): BedSquare[] {
  const squares: BedSquare[] = [];
  for (let index = 0; index < ward.ready; index += 1) {
    squares.push({ key: `${ward.unit.id}-ready-${index}`, state: "ready", preparing: index < ward.pendingPreparation });
  }
  for (let index = 0; index < ward.pulled; index += 1) {
    squares.push({ key: `${ward.unit.id}-pulled-${index}`, state: "pulled", preparing: false });
  }
  for (let index = 0; index < ward.closed; index += 1) {
    squares.push({ key: `${ward.unit.id}-closed-${index}`, state: "closed", preparing: false });
  }
  for (let index = 0; index < ward.occupied; index += 1) {
    squares.push({ key: `${ward.unit.id}-occupied-${index}`, state: "occupied", preparing: false });
  }
  return squares;
}

type BedBay = {
  id: string;
  name: string;
  squares: { square: BedSquare; index: number }[];
};

/** Groups bed squares into natural 4-bed bays for rapid visual counting (subitizing) */
function buildBays(squares: BedSquare[]): BedBay[] {
  const bays: BedBay[] = [];
  const baySize = 4;
  for (let i = 0; i < squares.length; i += baySize) {
    const baySquares = squares.slice(i, i + baySize).map((square, offset) => ({
      square,
      index: i + offset,
    }));
    const bayNumber = Math.floor(i / baySize) + 1;
    bays.push({
      id: `bay-${bayNumber}`,
      name: `Bay ${bayNumber}`,
      squares: baySquares,
    });
  }
  return bays;
}

function bedKindsServed(unit: Unit): string {
  if (unit.cohort !== "Adult") return unit.cohort;
  const kinds: string[] = [];
  if (unitHasLockedBeds(unit)) kinds.push("Locked adult");
  if (unitHasOpenBeds(unit)) kinds.push("Open adult");
  return kinds.length > 0 ? kinds.join(" & ") : "Adult (no beds)";
}

const SQUARE_LABEL: Record<BedSquareState, string> = {
  ready: "Ready bed",
  pulled: "Pulled bed — patient not yet arrived",
  closed: "Closed bed — not offered",
  occupied: "Occupied bed",
};

/**
 * Each ruled state's existing stylesheet class. Closed keeps the dotted "not offered" look the
 * mislabelled "held" box always had; Pulled is a bed spoken for, so it takes the occupied fill and
 * is told apart by its own glyph and words. No new colour is introduced for either.
 */
function squareClass(state: BedSquareState): string | undefined {
  // Read at render, never at module load: browser specs import this module without its CSS.
  const classes: Record<BedSquareState, string | undefined> = {
    ready: styles.ready,
    pulled: styles.occupied,
    closed: styles.held,
    occupied: styles.occupied,
  };
  return classes[state];
}

function squareLabel(square: BedSquare): string {
  return square.preparing ? "Ready bed — still being made ready" : SQUARE_LABEL[square.state];
}

function squareClassName(square: BedSquare): string {
  const base = `${styles.square} ${squareClass(square.state)}`;
  return square.preparing ? `${base} ${styles.preparing}` : base;
}

/**
 * Every state this map draws, named once here for the legend AND for the per-square accessible
 * name lookup above — so a reader relying on colour, on the legend's words, or on a screen reader
 * all learn the same five things.
 */
const LEGEND_ITEMS: { key: string; state: BedSquareState; preparing?: boolean; label: string }[] = [
  { key: "ready", state: "ready", label: "Ready" },
  {
    key: "ready-preparing",
    state: "ready",
    preparing: true,
    label: "Ready — still being made ready (counted as ready; not yet pullable)",
  },
  { key: "pulled", state: "pulled", label: `${BED_STATE_LABELS.pulled} — patient not yet arrived` },
  { key: "closed", state: "closed", label: `${BED_STATE_LABELS.closed} — not offered` },
  { key: "occupied", state: "occupied", label: BED_STATE_LABELS.occupied },
];

function BedMapLegend() {
  return (
    <ul className={styles.legend} aria-label="Bed map legend">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.key} className={styles.legendItem}>
          <span
            aria-hidden="true"
            data-bed-map-state={item.state}
            className={
              item.preparing
                ? `${styles.legendSwatch} ${squareClass(item.state)} ${styles.preparing}`
                : `${styles.legendSwatch} ${squareClass(item.state)}`
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * One ward's beds, rendered as a condensed, compact card with:
 * - Clean borders, header with ward name and total beds badge
 * - Color-coded status badges (with honest "none ready" copy when ready is 0)
 * - Proportional capacity ribbon showing occupancy pressure at a glance
 * - ALL 4-bed bay pods and beds rendered simultaneously (zero internal pagination)
 * - Tactile micro-bed styling with pillow indentation, luminous indicators, and glyphs
 * - Interactive hover/focus unclipped floating tooltips
 */
function WardBlock({
  ward,
  selectedUnitId,
  onSelectWard,
  dim = false,
}: {
  ward: BedMapWard;
  selectedUnitId?: string;
  onSelectWard?: (unitId: string) => void;
  /** A highlight that does not match this ward: it recedes by colour and stays. */
  dim?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const squares = useMemo(() => buildSquares(ward), [ward]);
  const bays = useMemo(() => buildBays(squares), [squares]);

  const [hoveredBed, setHoveredBed] = useState<{
    square: BedSquare;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const total = ward.unit.beds;
  const pureReady = Math.max(0, ward.ready - Math.min(ward.ready, ward.pendingPreparation));
  const turnover = Math.min(ward.ready, ward.pendingPreparation);
  const pulled = ward.pulled;
  const closed = ward.closed;
  const occupied = ward.occupied;

  const pureReadyPct = total > 0 ? (pureReady / total) * 100 : 0;
  const turnoverPct = total > 0 ? (turnover / total) * 100 : 0;
  const pulledPct = total > 0 ? (pulled / total) * 100 : 0;
  const closedPct = total > 0 ? (closed / total) * 100 : 0;
  const occupiedPct = total > 0 ? (occupied / total) * 100 : 0;

  const handleBedFocus = (
    e: React.FocusEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
    square: BedSquare,
    index: number,
  ) => {
    const card = cardRef.current;
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    const bedRect = e.currentTarget.getBoundingClientRect();
    const relativeX = bedRect.left - cardRect.left + bedRect.width / 2;
    const clampedX = Math.max(70, Math.min(cardRect.width - 70, relativeX));
    const relativeY = bedRect.top - cardRect.top;
    setHoveredBed({
      square,
      index,
      x: clampedX,
      y: relativeY,
    });
  };

  const handleBedBlur = () => {
    setHoveredBed(null);
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route
    <div
      ref={cardRef}
      className={styles.wardBlock}
      data-selected={selectedUnitId === ward.unit.id || undefined}
      data-dim={dim ? "true" : undefined}
      data-interactive={Boolean(onSelectWard) || undefined}
      data-testid={`ward-bed-map-ward-${ward.unit.id}`}
      onClick={onSelectWard ? () => onSelectWard(ward.unit.id) : undefined}
    >
      <div className={styles.wardBlockHeader}>
        <div className={styles.wardTitleRow}>
          {onSelectWard ? (
            <button
              type="button"
              className={styles.wardSelect}
              aria-pressed={selectedUnitId === ward.unit.id}
              onClick={(event) => {
                event.stopPropagation();
                onSelectWard(ward.unit.id);
              }}
            >
              <span className={styles.wardNameText}>
                <SpelledCodes text={ward.unit.name} />
              </span>
            </button>
          ) : (
            <span className={styles.mapWardName}>
              <SpelledCodes text={ward.unit.name} />
            </span>
          )}
          <span className={styles.bedTotalBadge} title={`${ward.unit.beds} total beds`}>
            {ward.unit.beds}b
          </span>
        </div>

        <div className={styles.wardAvailability}>
          {ward.ready > 0 ? (
            <span className={styles.chipReady}>
              <strong>{countCellText(ward.ready)}</strong> ready
            </span>
          ) : (
            <span className={styles.chipZero}>none ready</span>
          )}
          <span className={styles.chipOccupied}>{countCellText(ward.occupied)} occupied</span>
        </div>
        {ward.pendingPreparation > ward.ready ? (
          <p data-testid={`ward-bed-map-preparation-unoffered-${ward.unit.id}`}>
            {ward.pendingPreparation - ward.ready} discharged bed(s) still being made ready outside the offered Ready
            count. No additional ready bed is implied.
          </p>
        ) : null}
        {(ward.unit.reservationReleaseCapacityConflicts?.length ?? 0) > 0 ? (
          <p data-testid={`ward-bed-map-reservation-release-conflict-${ward.unit.id}`}>
            {ward.unit.reservationReleaseCapacityConflicts?.length} reservation release(s) need capacity re-confirmation
            — an offered count already reported its ceiling. No extra physical vacancy is implied.
          </p>
        ) : null}
        {(ward.unit.arrivalCapacityConflicts?.length ?? 0) > 0 ? (
          <p data-testid={`ward-bed-map-arrival-conflict-${ward.unit.id}`}>
            {ward.unit.arrivalCapacityConflicts?.length} arrival(s) awaiting capacity reconciliation.
          </p>
        ) : null}
        <div className={styles.statusChipsRow}>
          {ward.pendingPreparation > 0 ? (
            <span className={styles.chipTurnover} title={`${ward.pendingPreparation} still being made ready`}>
              <StatusGlyph tone="neutral" size={9} />
              {ward.pendingPreparation} turnover
              <span className={styles.srOnly}> ({ward.pendingPreparation} still being made ready)</span>
            </span>
          ) : null}

          {ward.pulled > 0 ? (
            <span className={styles.chipOccupied} title={BED_STATE_DETAILS.pulled}>
              <StatusGlyph tone="warning" size={9} />
              {countCellText(ward.pulled)} pulled
            </span>
          ) : null}

          {ward.closed > 0 ? (
            <span className={styles.chipHeld} title={BED_STATE_DETAILS.closed}>
              <StatusGlyph tone="closed" size={9} />
              {countCellText(ward.closed)} closed
            </span>
          ) : null}

          {ward.onLeave > 0 ? (
            <span className={styles.chipOccupied} title={BED_STATE_DETAILS.onLeave}>
              {ward.onLeave} on leave
            </span>
          ) : null}
        </div>
      </div>

      {/* Proportional Capacity Ribbon */}
      <div
        className={styles.capacityRibbon}
        role="progressbar"
        aria-label={`${ward.unit.name} capacity: ${ward.ready} ready, ${ward.pulled} pulled, ${ward.closed} closed, ${ward.occupied} occupied`}
        aria-valuenow={ward.occupied}
        aria-valuemin={0}
        aria-valuemax={ward.unit.beds}
      >
        {pureReadyPct > 0 && (
          <div
            className={`${styles.ribbonSegment} ${styles.ribbonReady}`}
            style={{ width: `${pureReadyPct}%` }}
            title={`${pureReady} ready`}
          />
        )}
        {turnoverPct > 0 && (
          <div
            className={`${styles.ribbonSegment} ${styles.ribbonTurnover}`}
            style={{ width: `${turnoverPct}%` }}
            title={`${turnover} turnover`}
          />
        )}
        {pulledPct > 0 && (
          <div
            className={`${styles.ribbonSegment} ${styles.ribbonOccupied}`}
            style={{ width: `${pulledPct}%` }}
            title={`${pulled} pulled`}
          />
        )}
        {closedPct > 0 && (
          <div
            className={`${styles.ribbonSegment} ${styles.ribbonHeld}`}
            style={{ width: `${closedPct}%` }}
            title={`${closed} closed`}
          />
        )}
        {occupiedPct > 0 && (
          <div
            className={`${styles.ribbonSegment} ${styles.ribbonOccupied}`}
            style={{ width: `${occupiedPct}%` }}
            title={`${occupied} occupied`}
          />
        )}
      </div>

      {/* All Bays Section: Displays ALL beds simultaneously without internal pagination */}
      <div className={styles.baysSection}>
        <div className={styles.baysHeaderRow}>
          <span className={styles.baysTitle}>
            Bays{" "}
            <span className={styles.baysCount}>
              ({bays.length} {bays.length === 1 ? "bay" : "bays"} · all beds shown)
            </span>
          </span>
        </div>

        <div className={styles.allBaysGrid} role="group" aria-label={`${ward.unit.name} beds`}>
          {bays.map((bay) => (
            <div key={bay.id} className={styles.bayPod}>
              <div className={styles.bayHeader}>
                <span className={styles.bayLabel}>{bay.name}</span>
              </div>
              <div className={styles.baySquares}>
                {bay.squares.map(({ square, index }) => (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- focusable so keyboard users can open its tooltip
                  <span
                    key={square.key}
                    role="img"
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable so keyboard users can open its tooltip
                    tabIndex={0}
                    aria-label={squareLabel(square)}
                    data-testid={`ward-bed-map-square-${ward.unit.id}`}
                    data-bed-map-state={square.state}
                    data-bed-map-preparing={square.preparing ? "true" : undefined}
                    className={squareClassName(square)}
                    onMouseEnter={(e) => handleBedFocus(e, square, index)}
                    onMouseLeave={handleBedBlur}
                    onFocus={(e) => handleBedFocus(e, square, index)}
                    onBlur={handleBedBlur}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && onSelectWard) {
                        e.preventDefault();
                        onSelectWard(ward.unit.id);
                      }
                    }}
                  >
                    <span className={styles.pillow} aria-hidden="true" />
                    {square.state === "ready" && !square.preparing && (
                      <svg
                        className={styles.bedIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {square.state === "ready" && square.preparing && (
                      <span className={styles.bedGlyph} aria-hidden="true">
                        ⚙
                      </span>
                    )}
                    {square.state === "closed" && (
                      <svg className={styles.bedIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                    {square.state === "pulled" && (
                      <span className={styles.bedGlyph} aria-hidden="true">
                        →
                      </span>
                    )}
                    {square.state === "occupied" && <span className={styles.occupiedDot} aria-hidden="true" />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Unclipped Floating Tooltip */}
      {hoveredBed && (
        <div
          className={styles.tooltipFloating}
          role="tooltip"
          style={{
            left: `${hoveredBed.x}px`,
            top: `${hoveredBed.y}px`,
          }}
        >
          <strong className={styles.tooltipBedTitle}>
            {ward.unit.name} · Bed {String(hoveredBed.index + 1).padStart(2, "0")}
          </strong>
          <span className={styles.tooltipState}>
            {hoveredBed.square.preparing
              ? "Turnover (Cleaning underway)"
              : hoveredBed.square.state === "ready"
                ? "Ready (Available to pull)"
                : hoveredBed.square.state === "pulled"
                  ? "Pulled (Patient not yet arrived)"
                  : hoveredBed.square.state === "closed"
                    ? "Closed (Empty, not offered)"
                    : "Occupied (Inpatient)"}
          </span>
          <span className={styles.tooltipMeta}>{bedKindsServed(ward.unit)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * One health service's wards, or a sentence stating it reports nothing — never a heading over an
 * empty group.
 *
 * All ward cards sit in ONE single horizontal line (.serviceWardTrack), never wrapping.
 * Smooth carousel navigation controls (‹ and ›) allow scrolling horizontally along the single track.
 */
function ServiceGroup({
  group,
  selectedUnitId,
  onSelectWard,
  layout,
  highlightUnitIds,
}: {
  group: BedMapServiceGroup;
  layout: BedMapLayout;
  selectedUnitId?: string;
  onSelectWard?: (unitId: string) => void;
  highlightUnitIds?: ReadonlySet<string>;
}) {
  const dimmed = (unitId: string) => highlightUnitIds !== undefined && !highlightUnitIds.has(unitId);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [activeWardIndex, setActiveWardIndex] = useState(0);
  const activeWardIndexRef = useRef(0);
  const [visibleWardEnd, setVisibleWardEnd] = useState(Math.min(3, group.wards.length));

  // The zero-width fallback needs the latest index without replacing the track ref and observer
  // whenever scrolling changes the visible ward. Update the state and its callback snapshot together.
  const updateActiveWardIndex = useCallback((index: number) => {
    activeWardIndexRef.current = index;
    setActiveWardIndex(index);
  }, []);

  const cardStep = (el: HTMLDivElement) => {
    const cards = el.children;
    return cards.length > 1
      ? (cards[1] as HTMLElement).offsetLeft - (cards[0] as HTMLElement).offsetLeft
      : (cards[0] as HTMLElement | undefined)?.offsetWidth || 262;
  };

  const totalBeds = group.wards.reduce((sum, w) => sum + w.unit.beds, 0);
  const totalReady = group.wards.reduce((sum, w) => sum + w.ready, 0);
  const totalClosed = group.wards.reduce((sum, w) => sum + w.closed, 0);
  // Occupied or Pulled, one decimal: the one occupancy count (`ward-occupancy.ts`) the rail and
  // every other page print for the same service (device audit, 11 Oct 2026).
  const totalPulled = group.wards.reduce((sum, w) => sum + w.pulled, 0);
  const totalInUse = group.wards.reduce((sum, w) => sum + w.occupied, 0) + totalPulled;
  const occPct = totalBeds > 0 ? ((totalInUse / totalBeds) * 100).toFixed(1) : "0.0";

  const checkScrollState = useCallback(() => {
    if (layout === "grid") {
      setHasOverflow(false);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const el = trackRef.current;
    if (!el) return;
    const isJSDOM = el.clientWidth === 0;

    if (isJSDOM) {
      const overflow = group.wards.length > 2;
      setHasOverflow(overflow);
      setCanScrollLeft(activeWardIndexRef.current > 0);
      setCanScrollRight(activeWardIndexRef.current < group.wards.length - 1);
      return;
    }

    const overflow = el.scrollWidth > el.clientWidth + 4;
    const atStart = el.scrollLeft <= 4;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;

    setHasOverflow(overflow);
    setCanScrollLeft(overflow && !atStart);
    setCanScrollRight(overflow && !atEnd);

    const cards = Array.from(el.children) as HTMLElement[];
    const origin = cards[0]?.offsetLeft ?? 0;
    const first = cards.findIndex((card) => card.offsetLeft - origin + card.offsetWidth > el.scrollLeft + 4);
    const end = cards.filter((card) => card.offsetLeft - origin < el.scrollLeft + el.clientWidth - 4).length;
    updateActiveWardIndex(Math.max(0, first));
    setVisibleWardEnd(end);
  }, [group.wards.length, layout, updateActiveWardIndex]);

  const attachTrack = useCallback(
    (element: HTMLDivElement | null) => {
      trackRef.current = element;
      if (element) checkScrollState();
    },
    [checkScrollState],
  );

  useEffect(() => {
    const handleResize = () => checkScrollState();
    window.addEventListener("resize", handleResize);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(handleResize);
    if (trackRef.current) observer?.observe(trackRef.current);
    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [checkScrollState]);

  const scrollFrame = useRef(0);
  const handleScroll = () => {
    if (!scrollFrame.current) {
      scrollFrame.current = window.requestAnimationFrame(() => {
        scrollFrame.current = 0;
        checkScrollState();
      });
    }
  };
  useEffect(
    () => () => {
      if (scrollFrame.current) window.cancelAnimationFrame(scrollFrame.current);
    },
    [],
  );

  const handlePrev = (event: React.MouseEvent) => {
    event.stopPropagation();
    const el = trackRef.current;
    if (!el) return;
    const step = cardStep(el);
    if (el.scrollLeft <= step * 1.2) {
      if (typeof el.scrollTo === "function") {
        el.scrollTo({ left: 0, behavior: wardScrollBehavior() });
      } else {
        el.scrollLeft = 0;
      }
    } else {
      if (typeof el.scrollBy === "function") {
        el.scrollBy({ left: -step, behavior: wardScrollBehavior() });
      } else {
        el.scrollLeft = Math.max(0, el.scrollLeft - step);
      }
    }
    if (el.clientWidth === 0) {
      const index = Math.max(0, activeWardIndexRef.current - 1);
      updateActiveWardIndex(index);
      setCanScrollLeft(index > 0);
      setCanScrollRight(true);
    }
  };

  const handleNext = (event: React.MouseEvent) => {
    event.stopPropagation();
    const el = trackRef.current;
    if (!el) return;
    const step = cardStep(el);
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (el.scrollLeft + step * 1.5 >= maxScroll) {
      if (typeof el.scrollTo === "function") {
        el.scrollTo({ left: maxScroll, behavior: wardScrollBehavior() });
      } else {
        el.scrollLeft = maxScroll;
      }
    } else {
      if (typeof el.scrollBy === "function") {
        el.scrollBy({ left: step, behavior: wardScrollBehavior() });
      } else {
        el.scrollLeft = Math.min(maxScroll, el.scrollLeft + step);
      }
    }
    if (el.clientWidth === 0) {
      const index = Math.min(group.wards.length - 1, activeWardIndexRef.current + 1);
      updateActiveWardIndex(index);
      setCanScrollLeft(true);
      setCanScrollRight(index < group.wards.length - 1);
    }
  };

  if (group.wards.length === 0) {
    return (
      <div className={styles.serviceGroup} data-testid={`ward-bed-map-service-${group.service}`}>
        <p className={styles.serviceAbsent}>{group.service} has no inpatient unit reporting to this board.</p>
      </div>
    );
  }

  const headingId = `ward-bed-map-service-heading-${group.service.replace(/\s+/gu, "-")}`;
  return (
    <section
      className={styles.serviceGroup}
      data-layout={layout}
      data-service={group.service}
      aria-labelledby={headingId}
      data-testid={`ward-bed-map-service-${group.service}`}
    >
      <div className={styles.serviceHeaderBar}>
        <div className={styles.serviceTitleGroup}>
          <h3 id={headingId} className={styles.serviceHeading}>
            <span className={styles.serviceAccentIndicator} aria-hidden="true" />
            <span className={styles.serviceNameText}>
              <SpelledCodes text={group.service} />
            </span>
            <span className={styles.serviceCount}>
              {group.wards.length === 1 ? "1 ward" : `${group.wards.length} wards`}
            </span>
          </h3>
          <span className={styles.serviceCapacityBadge}>
            {totalReady > 0 ? `${totalReady} ready` : "none ready"} · {totalClosed} closed · {occPct}% occupancy
            {totalPulled > 0 ? ` (includes ${totalPulled} pulled)` : ""}
          </span>
        </div>

        {/* Carousel controls embedded in health service region header */}
        {layout === "row" && group.wards.length > 1 && (
          <div className={styles.serviceCarouselControls}>
            <button
              type="button"
              className={styles.serviceArrowBtn}
              onClick={handlePrev}
              disabled={!canScrollLeft}
              aria-label={`Previous wards in ${group.service}`}
              title="Previous wards"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className={styles.serviceCarouselIndicator}>
              {activeWardIndex + 1}–{Math.max(activeWardIndex + 1, visibleWardEnd)} of {group.wards.length}
            </span>
            <button
              type="button"
              className={styles.serviceArrowBtn}
              onClick={handleNext}
              disabled={!canScrollRight}
              aria-label={`Next wards in ${group.service}`}
              title="Next wards"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {layout === "table" ? (
        // v10 Capacity, Table view: one shared `WardCapacityRow` per ward (the Places pattern). The
        // one tint is a ward with a ready bed; a highlight dims the others by colour and hides none.
        <WardCapacityRows label={`${group.service} wards`} className={styles.capacityRows}>
          {group.wards.map((ward) => (
            <WardCapacityRow
              key={ward.unit.id}
              name={ward.unit.name}
              meta={`${ward.unit.siteCode} · ${ward.ready} ready of ${ward.unit.beds}`}
              segments={[
                { id: "occupied", value: ward.occupied, fill: "data-1", label: "Occupied" },
                { id: "ready", value: ward.ready, fill: "ready", label: "Ready" },
                { id: "pulled", value: ward.pulled, fill: "data-2", hatch: true, label: "Pulled" },
                { id: "closed", value: ward.closed, fill: "closed", label: "Closed" },
              ]}
              percent={ward.unit.beds > 0 ? ((ward.occupied + ward.pulled) / ward.unit.beds) * 100 : null}
              alertAt={BED_ALERT_THRESHOLD_PERCENT}
              fit={ward.ready > 0}
              dim={dimmed(ward.unit.id)}
              selected={selectedUnitId === ward.unit.id}
              onSelect={onSelectWard ? () => onSelectWard(ward.unit.id) : undefined}
              actionLabel={onSelectWard ? `Open ${ward.unit.name}` : undefined}
            />
          ))}
        </WardCapacityRows>
      ) : (
        /* Single-line horizontal ward track container with non-overlapping flanking navigation buttons */
        <div className={styles.trackContainer}>
          {layout === "row" && hasOverflow && (
            <button
              type="button"
              className={`${styles.flankingArrow} ${styles.flankingArrowPrev}`}
              onClick={handlePrev}
              disabled={!canScrollLeft}
              style={{ visibility: canScrollLeft ? "visible" : "hidden" }}
              aria-label={`Previous wards in ${group.service}`}
              title="Previous wards"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <div
            ref={attachTrack}
            onScroll={handleScroll}
            className={styles.serviceWardTrack}
            role="region"
            aria-label={`${group.service} wards track`}
          >
            {group.wards.map((ward) => (
              <WardBlock
                key={ward.unit.id}
                ward={ward}
                selectedUnitId={selectedUnitId}
                onSelectWard={onSelectWard}
                dim={dimmed(ward.unit.id)}
              />
            ))}
          </div>

          {layout === "row" && hasOverflow && (
            <button
              type="button"
              className={`${styles.flankingArrow} ${styles.flankingArrowNext}`}
              onClick={handleNext}
              disabled={!canScrollRight}
              style={{ visibility: canScrollRight ? "visible" : "hidden" }}
              aria-label={`Next wards in ${group.service}`}
              title="Next wards"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The network's whole bed supply, one square per bed. Read `bedMapWards`'s and
 * `groupBedMapWardsByService`'s own doc comments for what each figure is and is not.
 *
 * ⚠️ **PRESENTATION ONLY, LIKE THE REST OF THIS SCREEN.** Nothing here ranks a ward for a patient
 * and nothing here reads `ward-eligibility.ts` — see `capacity-derivations.ts`'s own file header,
 * which this component is bound by exactly as the rest of the screen is.
 *
 * 🔴 **`service` — build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2, task C1:
 * "the map groups... are scoped."** `undefined`/`null` (Capacity passes `useServiceScope()`
 * straight through, which is `null` for "All services") draws every group, byte-identical to
 * before this prop existed. A real service filters `groups` down to that ONE entry — filtered
 * AFTER `groupBedMapWardsByService` builds all five, never by handing this a pre-filtered `units`
 * list. Filtering `units` first would make every OTHER service's group compute `wards.length === 0`
 * and print "has no inpatient unit reporting to this board" — a false statement about a service that
 * has real units, just none shown on this narrowed map. Not rendering that group at all makes no
 * claim about it; the scope bar `CapacityScreen` mounts alongside this map is what discloses the
 * narrowing in words.
 */
export function BedMap({
  units,
  bedReleases,
  admissions,
  leaveBeds,
  selectedUnitId,
  onSelectWard,
  service,
  highlightUnitIds,
  initialLayout = "row",
  initialBedDetail = true,
  table,
  onLayoutChange,
}: {
  /**
   * Device audit option A (Capacity, 11 Oct 2026): the page's full ward table, drawn as the map's
   * Table layout so the page has one bed map rather than a map plus a repeated table. Without it
   * the Table layout is the map's own ward rows.
   */
  table?: ReactNode;
  onLayoutChange?: (layout: BedMapLayout) => void;
  initialLayout?: BedMapLayout;
  initialBedDetail?: boolean;
  units: Unit[];
  bedReleases: BedRelease[];
  /** For Pulled and the on-leave marker — see `bedMapWards`. */
  admissions?: readonly Admission[];
  leaveBeds?: readonly LeaveBed[];
  selectedUnitId?: string;
  onSelectWard?: (unitId: string) => void;
  service?: HealthService | null;
  /**
   * The wards a hero or highlight chip picked out. Every other ward dims by colour in every layout
   * and none is hidden (v10 Capacity). Undefined means no highlight.
   */
  highlightUnitIds?: ReadonlySet<string>;
}) {
  const [layout, setLayoutState] = useState<BedMapLayout>(initialLayout);
  const setLayout = (next: BedMapLayout) => {
    setLayoutState(next);
    onLayoutChange?.(next);
  };
  const [bedDetail, setBedDetail] = useState(initialBedDetail);
  const [activeService, setActiveService] = useState<string>();
  const mapRef = useRef<HTMLDivElement>(null);
  const wards = useMemo(
    () => bedMapWards(units, bedReleases, admissions, leaveBeds),
    [units, bedReleases, admissions, leaveBeds],
  );
  const groups = useMemo(() => groupBedMapWardsByService(wards), [wards]);
  const renderedGroups = useMemo(
    () => (service ? groups.filter((group) => group.service === service) : groups),
    [groups, service],
  );
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = Array.from(mapRef.current?.querySelectorAll<HTMLElement>("[data-service]") ?? []);
    const observer = new IntersectionObserver(
      () => {
        // An observer batch contains only changed intersections. A preceding service's trailing
        // edge can still be visible after jumping, so choose from current section positions.
        const visible = sections
          .map((section) => ({ section, bounds: section.getBoundingClientRect() }))
          .filter(({ bounds }) => bounds.bottom > 80 && bounds.top < window.innerHeight * 0.65)
          .sort((a, b) => Math.abs(a.bounds.top - 80) - Math.abs(b.bounds.top - 80))[0];
        if (visible) setActiveService(visible.section.dataset.service);
      },
      { rootMargin: "-80px 0px -35% 0px", threshold: 0 },
    );
    sections.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [service, layout, bedDetail]);
  return (
    <div ref={mapRef} className={styles.map} data-ward-primitive="bed-map" data-bed-detail={bedDetail}>
      <div className={styles.mapToolbar}>
        <div role="group" aria-label="Ward detail level" className={styles.layoutSwitch}>
          <button type="button" aria-pressed={!bedDetail} onClick={() => setBedDetail(false)}>
            Overview
          </button>
          <button type="button" aria-pressed={bedDetail} onClick={() => setBedDetail(true)}>
            Bed detail
          </button>
        </div>
        <div role="group" aria-label="Bed map layout" className={styles.layoutSwitch}>
          <button type="button" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>
            Grid
          </button>
          <button type="button" aria-pressed={layout === "row"} onClick={() => setLayout("row")}>
            Rows
          </button>
          <button type="button" aria-pressed={layout === "table"} onClick={() => setLayout("table")}>
            Table
          </button>
        </div>
        <nav className={styles.serviceNav} aria-label="Bed map service shortcuts">
          {renderedGroups
            .filter((group) => group.wards.length > 0)
            .map((group) => (
              <button
                type="button"
                key={group.service}
                aria-current={
                  (activeService ?? renderedGroups.find((item) => item.wards.length > 0)?.service) === group.service
                    ? "location"
                    : undefined
                }
                onClick={() => {
                  setActiveService(group.service);
                  document
                    .getElementById(`ward-bed-map-service-heading-${group.service.replace(/\s+/gu, "-")}`)
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                {group.service}
                <span>{group.wards.length}</span>
              </button>
            ))}
        </nav>
      </div>
      {bedDetail ? <BedMapLegend /> : null}

      {layout === "table" && table ? (
        table
      ) : (
        <div className={styles.services}>
          {renderedGroups.map((group) => (
            <ServiceGroup
              key={group.service}
              group={group}
              layout={layout}
              selectedUnitId={selectedUnitId}
              onSelectWard={onSelectWard}
              highlightUnitIds={highlightUnitIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
