"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { Button, Card, CardHead, FilterChip, SrOnly, durMinutes } from "@/components/wf";
import {
  BedSquares,
  BedSquaresKey,
  bedSquareCounts,
  bedSquaresNotes,
  bedSquaresTag,
  type BedSquaresNote,
} from "@/components/ward-management/bed-squares/bed-squares";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { isFreeingToday } from "@/components/ward-management/ward-releases-expected-to-free";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import { closedBedsPastReview } from "@/components/ward-management/ward-bed-closure-review";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { isConfirmationFresh } from "./capacity-gap-words";
import type { NetworkWardRow } from "./capacity-derivations";
import type { BedMapWard } from "./bed-map";

import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { openStaffRequests } from "@/components/ward-management/staffing/staff-requests";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import type { CapacityModel } from "./capacity-model";
import { UNCHANGED_SHIFTS_LISTED, type CountedFigure } from "./shift-confirmations";
import { heldUpByTomorrow } from "./capacity-held-up-rail";
import { tonightIntakeWindowList } from "./ward-intake-window-list";
import styles from "./capacity-page.module.css";

export type Highlight = "any" | "locked" | "open" | "stale";

const HIGHLIGHTS: readonly { id: Highlight; label: string; test: (row: NetworkWardRow, fresh: boolean) => boolean }[] =
  [
    { id: "any", label: "Any ready", test: (row) => row.ready > 0 },
    { id: "locked", label: "Locked ready", test: (row) => row.lockedReady > 0 },
    { id: "open", label: "Open ready", test: (row) => row.ready - row.lockedReady > 0 },
    { id: "stale", label: "Count old", test: (_row, fresh) => !fresh },
  ];

/**
 * Services open on first view: the two with the most wards a metro coordinator moves between.
 * C11: counted among groups that hold wards, so a site bed manager's own service (the only group
 * with wards on that desk) opens rather than two empty ones ahead of it in network order.
 */
const OPEN_FIRST = 2;

/**
 * The bed map: every ward with its bed squares (shared pattern v1, wave 4), grouped by health
 * service. The ward table that used to repeat it lives on All wards, so the page holds each ward
 * once (design review finding 2).
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
        // Wave 4 (D-191): the label and a mono count of wards ("Any ready 19"); the noun is still
        // spoken, so the count is never read as the hero's bed counts.
        const wards = wardsMatching(entry);
        return (
          <FilterChip
            key={entry.id}
            pressed={highlight === entry.id}
            onPressedChange={(pressed) => onHighlight(pressed ? entry.id : null)}
          >
            <span className={styles.chipWords}>
              {entry.label} <b className={styles.chipN}>{wards}</b> <SrOnly>{wards === 1 ? "ward" : "wards"}</SrOnly>
            </span>
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
  findBed = true,
}: {
  model: CapacityModel;
  onSelectWard: (unitId: string) => void;
  selectedUnitId?: string;
  /** False when the page draws the highlights itself, beside its tabs (desktop page top). */
  highlightsInCard?: boolean;
  /** Owned by the page, so the hero's ready figures can light the same wards. */
  highlight: Highlight | null;
  onHighlight: (highlight: Highlight | null) => void;
  /** Find a bed in the card head (wave 4: it left the hero). False for a desk that opens no finder. */
  findBed?: boolean;
}) {
  const { mapGroups, networkRows, now } = model;
  const canOpen = useCanOpenHref();
  // A model built without releases (a test's slice of it) draws no discharge squares.
  const bedReleases: readonly BedRelease[] = model.bedReleases ?? [];
  const rowOf = new Map(networkRows.map((row) => [row.unit.id, row]));
  // Feature 10: wards with an open "Staff needed" request say so on the note line.
  const staffRequests = useOptionalWardFlowSelect("staffRequests")?.staffRequests;
  const staffAsked = new Set(openStaffRequests({ staffRequests }, now).map((record) => record.unitId));
  const units = mapGroups.flatMap((group) => group.wards.map((ward) => ward.unit));
  const extras = wardExtras(units, bedReleases, now);
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
    () =>
      new Set([
        ...mapGroups
          .filter((group) => group.wards.length > 0)
          .slice(0, OPEN_FIRST)
          .map((group) => group.service),
        ...groupsLitBy(highlight),
      ]),
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
  const wardCount = mapGroups.reduce((sum, group) => sum + group.wards.length, 0);

  return (
    <Card aria-labelledby="capacity-map-title" className={styles.mapCard} id="capacity-bed-map">
      {/* Wave 4 (D-191): Find a bed sits in the map's head (it left the hero); the Grid and Rows
          switch is gone, as the Wards tab is the table. */}
      <CardHead
        id="capacity-map-title"
        title="Bed map"
        meta={`${wardCount} ${wardCount === 1 ? "ward" : "wards"} · counts as at ${formatInstant(now)}`}
        action={
          findBed ? (
            <Button
              size="sm"
              variant="ghost"
              icon={Search}
              onClick={(event) => requestToolsTool("bed-finder", event.currentTarget)}
              data-testid="capacity-map-find-bed"
            >
              Find a bed
            </Button>
          ) : undefined
        }
      />
      {highlightsInCard ? (
        <BedMapHighlights className={styles.highlights} model={model} highlight={highlight} onHighlight={onHighlight} />
      ) : null}
      {/* The key sits at the top of the map, not the foot (wave 4, notes item 5). */}
      <BedSquaresKey label="Bed map key" className={styles.mapKey} />
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
              {/* F-78: the service is a plain heading in words, no colour or badge. */}
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
                    <b>{ready}</b> ready · <b>{beds ? Math.round((inUse / beds) * 100) : 0}%</b> in use · {closed}{" "}
                    closed
                  </span>
                </button>
              </h3>
              <div id={panelId} hidden={!isOpen} className={styles.mapGrid}>
                {group.wards.map((ward) => (
                  <WardCard
                    key={ward.unit.id}
                    ward={ward}
                    row={rowOf.get(ward.unit.id)}
                    now={now}
                    extra={extras.get(ward.unit.id)}
                    staffRequested={staffAsked.has(ward.unit.id)}
                    dimmed={!matches(ward.unit.id)}
                    selected={ward.unit.id === selectedUnitId}
                    onSelect={() => onSelectWard(ward.unit.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {/* Only for a desk that may open the wards list (the executive may not). */}
      {canOpen(WARDS_HREF) ? (
        <div className={styles.cardFoot}>
          <Link href={WARDS_HREF} className={styles.footLink}>
            Every ward as a table
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

/** What a ward's squares and note line need beyond its bed partition. */
export type WardExtra = {
  /** Discharges due later today and not held up: the hatched "may move" squares. */
  dischargesToday: number;
  /** Held up, due by tomorrow (the rail's window), so the ward notes add up to the rail's figure. */
  heldUp: number;
  /** Closed beds past their review time, in warning words ("Bed 22 past review"). */
  pastReview: number[];
  /** Tonight's intake hours, "Admits 22:00 to 05:00". */
  intake?: string;
};

/**
 * Per ward: discharges today (the shared `isFreeingToday` rule, leaving out held-up releases),
 * held up by tomorrow, closed beds past review and tonight's intake window. The last two were their
 * own cards before wave 4; they now sit on the ward's note line.
 */
export function wardExtras(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  now: number,
): Map<string, WardExtra> {
  const extras = new Map<string, WardExtra>();
  const of = (unitId: string) => {
    let extra = extras.get(unitId);
    if (!extra) {
      extra = { dischargesToday: 0, heldUp: 0, pastReview: [] };
      extras.set(unitId, extra);
    }
    return extra;
  };
  const ids = new Set(units.map((unit) => unit.id));
  for (const release of releases) {
    if (ids.has(release.unitId) && release.blocker === null && isFreeingToday(release, now))
      of(release.unitId).dischargesToday += 1;
  }
  const own = releases.filter((release) => ids.has(release.unitId));
  for (const [unitId, count] of heldUpByTomorrow(own, now).byUnit) of(unitId).heldUp = count;
  for (const { unit, mark } of closedBedsPastReview(units, now)) of(unit.id).pastReview.push(mark.bedNumber);
  for (const { unit, intake } of tonightIntakeWindowList(units, now).set)
    of(unit.id).intake = `Admits ${formatInstant(intake.from)} to ${formatInstant(intake.to)}`;
  return extras;
}

/**
 * A ward's squares under the current ready rule. `bedStates().ready` still counts a bed being made
 * ready (owner ruling 5 Sep 2026; F-26 in PR C changes it), so those beds are drawn hollow from
 * inside the ready count and the strip still sums to the ward's beds. The head figure stays
 * `ward.ready` (pass it as `readyFigure`).
 */
export function wardSquareCounts(ward: BedMapWard, dischargesToday: number) {
  const prep = Math.min(ward.pendingPreparation, ward.ready);
  return bedSquareCounts({
    beds: ward.unit.beds,
    ready: ward.ready - prep,
    prep,
    dischargesToday,
    closed: ward.closed,
  });
}

/** The ward's note line, in the shared order (bed-squares.md v1). */
export function wardNotes(
  ward: BedMapWard,
  row: NetworkWardRow | undefined,
  now: number,
  extra: WardExtra | undefined,
  staffRequested: boolean,
): BedSquaresNote[] {
  const stale = row !== undefined && !isConfirmationFresh(row.unit, now);
  // Josh's fifth notes (8 Nov 2026): a count confirmed unchanged shift after shift is flagged here.
  const sameShifts = (ward.unit.allocatable as CountedFigure).unchangedShifts ?? 0;
  return bedSquaresNotes({
    staleFor: stale ? durMinutes(Math.max(0, now - row.confirmedAt)) : undefined,
    dischargesToday: extra?.dischargesToday ?? 0,
    heldUp: extra?.heldUp ?? 0,
    pulled: ward.pulled,
    prep: ward.pendingPreparation,
    closed: ward.closed,
    onLeave: ward.onLeave,
    staffRequested,
    extra: [
      ...(sameShifts >= UNCHANGED_SHIFTS_LISTED
        ? [{ text: `Same count ${sameShifts} shifts`, tone: "warning" as const }]
        : []),
      ...(extra?.pastReview ?? []).map((bed) => ({ text: `Bed ${bed} past review`, tone: "warning" as const })),
      ...(extra?.intake ? [{ text: extra.intake }] : []),
    ],
  });
}

function WardCard({
  ward,
  row,
  now,
  extra,
  dimmed,
  selected,
  onSelect,
  staffRequested = false,
}: {
  ward: BedMapWard;
  staffRequested?: boolean;
  extra: WardExtra | undefined;
  row: NetworkWardRow | undefined;
  now: number;
  dimmed: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  // Wave 4 (D-191, ruling 7): the shared bed squares. The ready figure leads the head (zero is 0,
  // Josh 3 Nov 2026), the neutral cohort and lock tag sits right, the squares take one line, and
  // the note line shows only what needs a look; held up is said there, never as a colour.
  return (
    <button
      type="button"
      className={`${styles.wardCard}${dimmed ? ` ${styles.dimmed}` : ""}`}
      aria-haspopup="dialog"
      data-unit-id={ward.unit.id}
      data-testid={`capacity-map-ward-${ward.unit.id}`}
      data-selected={selected ? "" : undefined}
      onClick={onSelect}
    >
      <span className={styles.wardName}>
        <SpelledCodes text={ward.unit.name} />
      </span>{" "}
      <BedSquares
        figure="lg"
        counts={wardSquareCounts(ward, extra?.dischargesToday ?? 0)}
        // Owner ruling 5 Sep 2026: a bed being made ready is never subtracted from Ready (the hero's
        // figure); it is drawn hollow inside it and named on the note line, until PR C's F-26.
        readyFigure={ward.ready}
        tag={bedSquaresTag(ward.unit)}
        notes={wardNotes(ward, row, now, extra, staffRequested)}
        testId={`capacity-map-squares-${ward.unit.id}`}
      />
    </button>
  );
}
