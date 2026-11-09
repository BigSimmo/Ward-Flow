"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Card, CardHead, FilterChip, Segmented, StatusGlyph, durMinutes } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { isConfirmationFresh } from "./capacity-gap-words";
import type { NetworkWardRow } from "./capacity-derivations";
import type { BedMapWard } from "./bed-map";

import { Legend } from "./capacity-how-worked-out";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { openBedReleases } from "@/components/ward-management/ward-bed-availability";
import type { BedRelease } from "@/components/ward-management/ward-model";
import type { CapacityModel } from "./capacity-model";
import { UNCHANGED_SHIFTS_LISTED, type CountedFigure } from "./shift-confirmations";
import styles from "./capacity-page.module.css";

export type Highlight = "any" | "locked" | "open" | "stale";

const HIGHLIGHTS: readonly { id: Highlight; label: string; test: (row: NetworkWardRow, fresh: boolean) => boolean }[] =
  [
    { id: "any", label: "Any ready", test: (row) => row.ready > 0 },
    { id: "locked", label: "Locked ready", test: (row) => row.lockedReady > 0 },
    { id: "open", label: "Open ready", test: (row) => row.ready - row.lockedReady > 0 },
    { id: "stale", label: "Count not confirmed", test: (_row, fresh) => !fresh },
  ];

/** Services open on first view: the two with the most wards a metro coordinator moves between. */
const OPEN_FIRST = 2;

/**
 * The bed map: every ward as a card with one square per bed, grouped by health service. Rows is
 * the same map one line per ward. The ward table that used to repeat it lives on All wards, so the
 * page holds each ward once (design review finding 2).
 */
const WARDS_HREF = "/ward-flow/wards";

/**
 * The bed map's highlight chips: each lights the wards it matches and dims the rest; none hides a
 * ward. In the map's title row on a phone; beside the page tabs on wider screens.
 */
export function BedMapHighlights({
  model,
  highlight,
  onHighlight,
  className,
}: {
  model: Pick<CapacityModel, "networkRows" | "now">;
  highlight: Highlight | null;
  onHighlight: (highlight: Highlight | null) => void;
  className?: string;
}) {
  const { networkRows, now } = model;
  const wardsMatching = (entry: (typeof HIGHLIGHTS)[number]) =>
    networkRows.filter((row) => entry.test(row, isConfirmationFresh(row.unit, now))).length;
  return (
    <div className={className} role="group" aria-label="Highlight wards">
      {HIGHLIGHTS.map((entry) => {
        // Redesign (Josh, 30 Oct): the count names its noun, so "15 wards" cannot be read as the
        // hero's bed counts.
        const wards = wardsMatching(entry);
        return (
          <FilterChip
            key={entry.id}
            pressed={highlight === entry.id}
            onPressedChange={(pressed) => onHighlight(pressed ? entry.id : null)}
          >
            {`${entry.label} · ${wards} ${wards === 1 ? "ward" : "wards"}`}
          </FilterChip>
        );
      })}
    </div>
  );
}

export function BedMapCards({
  model,
  onSelectWard,
  selectedUnitId,
  highlight,
  onHighlight,
  highlightsInCard = true,
}: {
  model: CapacityModel;
  onSelectWard: (unitId: string) => void;
  selectedUnitId?: string;
  /** False when the page draws the highlights itself, beside its tabs (desktop page top). */
  highlightsInCard?: boolean;
  /** Owned by the page, so the hero's ready figures can light the same wards. */
  highlight: Highlight | null;
  onHighlight: (highlight: Highlight | null) => void;
}) {
  const { mapGroups, networkRows, now } = model;
  const canOpen = useCanOpenHref();
  // A model built without releases (a test's slice of it) draws plain in-use squares.
  const bedReleases: readonly BedRelease[] = model.bedReleases ?? [];
  const [layout, setLayout] = useState<"grid" | "rows">("grid");
  const rowOf = new Map(networkRows.map((row) => [row.unit.id, row]));
  const lit = (unitId: string, id: Highlight | null) => {
    const row = rowOf.get(unitId);
    const rule = HIGHLIGHTS.find((entry) => entry.id === id);
    return !rule || (row !== undefined && rule.test(row, isConfirmationFresh(row.unit, now)));
  };
  const matches = (unitId: string) => lit(unitId, highlight);
  // Redesign (Josh, 30 Oct): turning a highlight on opens every service group that holds a lit
  // ward, so no match sits folded away. The coordinator can still fold a group afterwards.
  const groupsLitBy = (id: Highlight | null) =>
    id === null
      ? []
      : mapGroups.filter((group) => group.wards.some((ward) => lit(ward.unit.id, id))).map((group) => group.service);
  const [open, setOpen] = useState(
    () => new Set([...mapGroups.slice(0, OPEN_FIRST).map((group) => group.service), ...groupsLitBy(highlight)]),
  );
  const [openedFor, setOpenedFor] = useState(highlight);
  if (openedFor !== highlight) {
    setOpenedFor(highlight);
    const toOpen = groupsLitBy(highlight);
    if (toOpen.length > 0) setOpen((current) => new Set([...current, ...toOpen]));
  }
  const toggleGroup = (service: (typeof mapGroups)[number]["service"]) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next;
    });

  return (
    <Card aria-labelledby="capacity-map-title" className={styles.mapCard} id="capacity-bed-map">
      {/* Polish (Josh, 31 Oct 2026): the highlight chips sit in the title row beside Grid and Rows,
          so the controls take one row, and the grey bed and ward count is gone (the hero has it). */}
      <CardHead
        id="capacity-map-title"
        title="Bed map"
        action={
          <div className={styles.mapControls}>
            {highlightsInCard ? (
              <BedMapHighlights
                className={styles.highlights}
                model={model}
                highlight={highlight}
                onHighlight={onHighlight}
              />
            ) : null}
            <Segmented
              label="Bed map layout"
              items={[
                { id: "grid" as const, label: "Grid" },
                { id: "rows" as const, label: "Rows" },
              ]}
              value={layout}
              onChange={setLayout}
            />
          </div>
        }
      />
      <div className={styles.mapBody}>
        {mapGroups.map((group) => {
          // An empty service is said in words, never dropped: a missing service reads as no such
          // beds exist (census §8 and the old network table's sentence).
          if (group.wards.length === 0) {
            // A site bed manager's map holds its own site only; the other services are in Other sites.
            if (model.site) return null;
            return (
              <p key={group.service} className={styles.mapEmpty}>
                <SpelledCodes text={`${group.service} has no inpatient unit reporting to this board.`} />
              </p>
            );
          }
          const groupRows = group.wards.map((ward) => rowOf.get(ward.unit.id)).filter((row) => row !== undefined);
          const ready = groupRows.reduce((sum, row) => sum + row.ready, 0);
          const closed = group.wards.reduce((sum, ward) => sum + ward.closed, 0);
          const beds = group.wards.reduce((sum, ward) => sum + ward.unit.beds, 0);
          const inUse = group.wards.reduce((sum, ward) => sum + ward.occupied + ward.pulled, 0);
          const isOpen = open.has(group.service);
          const panelId = `capacity-map-${group.service.replace(/\W+/g, "-").toLowerCase()}`;
          return (
            <section key={group.service} className={styles.mapGroup} aria-label={`${group.service} bed map`}>
              <h3 className={styles.mapGroupHead}>
                <button
                  type="button"
                  className={styles.mapGroupToggle}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(group.service)}
                >
                  {isOpen ? (
                    <ChevronDown strokeWidth={1.75} size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight strokeWidth={1.75} size={14} aria-hidden="true" />
                  )}
                  <span className={styles.mapGroupName}>
                    <SpelledCodes text={group.service} />
                  </span>
                  <span className={styles.muted}>{group.wards.length} wards</span>
                  <span className={styles.mapGroupFigures}>
                    <b>{ready} ready</b> · {closed} closed · {beds ? Math.round((inUse / beds) * 100) : 0}% in use
                  </span>
                </button>
              </h3>
              <div id={panelId} hidden={!isOpen} className={layout === "grid" ? styles.mapGrid : styles.mapRows}>
                {group.wards.map((ward) => {
                  const row = rowOf.get(ward.unit.id);
                  return (
                    <WardCard
                      key={ward.unit.id}
                      ward={ward}
                      row={row}
                      now={now}
                      layout={layout}
                      parts={releaseParts(bedReleases, ward.unit.id)}
                      dimmed={!matches(ward.unit.id)}
                      selected={ward.unit.id === selectedUnitId}
                      onSelect={() => onSelectWard(ward.unit.id)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className={styles.cardFoot}>
        <Legend
          label="Bed map key"
          items={[
            { label: "Ready", swatchClassName: styles.cellReady },
            // C4 (Josh, 4 Nov 2026): in-use beds by discharge state, each named here.
            { label: "Confirmed out", swatchClassName: styles.cellConfirmed },
            { label: "Expected out", swatchClassName: styles.cellExpected },
            { label: "Held up", swatchClassName: styles.cellHeldUp },
            { label: "In use", swatchClassName: styles.cellUsed },
            { label: "Closed", swatchClassName: styles.cellClosed },
          ]}
        />
        {/* Only for a desk that may open the wards list (the executive may not). */}
        {canOpen(WARDS_HREF) ? (
          <Link href={WARDS_HREF} className={styles.footLink}>
            Every ward as a table
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

function WardCard({
  ward,
  row,
  now,
  layout,
  parts,
  dimmed,
  selected,
  onSelect,
}: {
  ward: BedMapWard;
  parts: ReleaseParts;
  row: NetworkWardRow | undefined;
  now: number;
  layout: "grid" | "rows";
  dimmed: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const fresh = row ? isConfirmationFresh(row.unit, now) : true;
  const notes = [
    ward.pulled ? `${ward.pulled} pulled` : "",
    ward.closed ? `${ward.closed} closed` : "",
    ward.onLeave ? `${ward.onLeave} on leave` : "",
    ward.pendingPreparation ? `${ward.pendingPreparation} being made ready` : "",
  ].filter(Boolean);
  const inUse = ward.occupied + ward.pulled;
  // Polish (Josh, 31 Oct 2026): the ready figure leads on the right, occupied of total beds sits
  // under the name, the bed strip is always one line, and the note line shows only what needs a
  // look (a stale count first, then pulled, closed, on leave, being made ready). A ward with
  // nothing to note shows no line, instead of "All beds in use or ready".
  const stale = !fresh && row !== undefined;
  // Capacity issue 7 (Josh, 3 Nov 2026): the beds this ward expects to free today, which State
  // bedflow used to show as "+N expected", now sit on the card itself.
  const freeing = row?.freeing ?? 0;
  // Josh's fifth notes (8 Nov 2026): "This shift" is gone, so a count confirmed unchanged shift
  // after shift is flagged on the ward's own card instead.
  const sameShifts = (ward.unit.allocatable as CountedFigure).unchangedShifts ?? 0;
  const sameCount = sameShifts >= UNCHANGED_SHIFTS_LISTED ? sameShifts : 0;
  return (
    <button
      type="button"
      className={`${layout === "grid" ? styles.wardCard : styles.wardRow}${dimmed ? ` ${styles.dimmed}` : ""}`}
      aria-haspopup="dialog"
      data-unit-id={ward.unit.id}
      data-testid={`capacity-map-ward-${ward.unit.id}`}
      data-selected={selected ? "" : undefined}
      onClick={onSelect}
    >
      <span className={styles.wardName}>
        <SpelledCodes text={ward.unit.name} />
      </span>{" "}
      <span className={`${styles.wardReady}${ward.ready ? "" : ` ${styles.wardReadyNone}`}`}>
        {/* Zero is shown as 0 (Josh, 3 Nov 2026, Capacity issue 5), replacing the 6 Sep 2026 ruling
            that spelt it "None". The grey figure still marks a ward with nothing ready. */}
        <b className={styles.wardReadyN}>{ward.ready}</b> ready
      </span>{" "}
      <span className={styles.wardOccupied}>
        {ward.occupied} of {ward.unit.beds} occupied
      </span>
      <BedCells beds={ward.unit.beds} ready={ward.ready} used={inUse} parts={parts} />
      {stale || sameCount || notes.length || freeing > 0 ? (
        <span className={styles.wardNote}>
          {freeing > 0 ? (
            <span className={`${styles.wardNoteItem} ${styles.okInk}`}>+{freeing}&nbsp;freeing&nbsp;today</span>
          ) : null}
          {stale ? (
            <span className={`${styles.wardNoteItem} ${styles.warnInk}`}>
              <StatusGlyph tone="warning" size={8} /> Count {durMinutes(Math.max(0, now - row.confirmedAt))} old
            </span>
          ) : null}
          {sameCount ? (
            <span className={`${styles.wardNoteItem} ${styles.warnInk}`}>
              <StatusGlyph tone="warning" size={8} /> Same count {sameCount}&nbsp;shifts
            </span>
          ) : null}
          {notes.length ? (
            // Each note keeps its words together, so a wrapped line never starts with a dot.
            <span>{notes.map((note) => note.replace(/ /g, "\u00a0")).join(" · ")}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

/** In-use beds by discharge state (C4, Josh, 4 Nov 2026). The rest of the in-use beds are plain "in use". */
type ReleaseParts = { heldUp: number; expected: number; confirmed: number };

/**
 * One ward's open bed releases (`openBedReleases`, the ward page's own window) grouped by state and
 * blocker: a held-up release counts as held up whatever its stage.
 */
export function releaseParts(releases: readonly BedRelease[], unitId: string): ReleaseParts {
  const parts: ReleaseParts = { heldUp: 0, expected: 0, confirmed: 0 };
  for (const release of openBedReleases(releases, unitId)) {
    if (release.blocker !== null) parts.heldUp += 1;
    else if (release.state === "confirmed") parts.confirmed += 1;
    else parts.expected += 1;
  }
  return parts;
}

/**
 * One square per bed: ready, then the in-use beds by how sure their discharge is (confirmed,
 * expected, held up), then the rest in use, then closed. The squares share one line at any bed
 * count (a grid of equal columns), so a large ward never wraps. Decorative; the card says it in
 * words and the bed map key names each colour.
 */
export function BedCells({
  beds,
  ready,
  used,
  parts,
}: {
  beds: number;
  ready: number;
  used: number;
  parts?: ReleaseParts;
}) {
  // A release can never colour more squares than are in use.
  const confirmed = Math.min(parts?.confirmed ?? 0, used);
  const expected = Math.min(parts?.expected ?? 0, used - confirmed);
  const heldUp = Math.min(parts?.heldUp ?? 0, used - confirmed - expected);
  const cellClass = (index: number): string | undefined => {
    if (index < ready) return styles.cellReady;
    const inUse = index - ready;
    if (inUse >= used) return styles.cellClosed;
    // Each coloured square stays an in-use square too, so it counts as one.
    if (inUse < confirmed) return `${styles.cellUsed} ${styles.cellConfirmed}`;
    if (inUse < confirmed + expected) return `${styles.cellUsed} ${styles.cellExpected}`;
    if (inUse < confirmed + expected + heldUp) return `${styles.cellUsed} ${styles.cellHeldUp}`;
    return styles.cellUsed;
  };
  return (
    <span
      className={styles.cells}
      aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${beds}, minmax(0, var(--cell-max, 10px)))` }}
    >
      {Array.from({ length: beds }, (_, index) => (
        <i key={index} className={cellClass(index)} />
      ))}
    </span>
  );
}
