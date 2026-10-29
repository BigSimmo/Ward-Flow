"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";

import { Card, CardHead, FilterChip, Segmented, durMinutes } from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { isConfirmationFresh } from "@/components/ward-management/capacity/capacity-gap-words";
import type { NetworkWardRow } from "@/components/ward-management/capacity/capacity-derivations";
import type { BedMapWard } from "@/components/ward-management/capacity/bed-map";

import { Legend } from "../parts/how-worked-out";
import type { CapacityModel } from "./use-capacity-model";
import styles from "./capacity-redesign.module.css";

export type Highlight = "any" | "locked" | "open" | "stale";

const HIGHLIGHTS: readonly { id: Highlight; label: string; test: (row: NetworkWardRow, fresh: boolean) => boolean }[] =
  [
    { id: "any", label: "Any bed ready", test: (row) => row.ready > 0 },
    { id: "locked", label: "Locked bed ready", test: (row) => row.lockedReady > 0 },
    { id: "open", label: "Open bed ready", test: (row) => row.ready - row.lockedReady > 0 },
    { id: "stale", label: "Count not confirmed", test: (_row, fresh) => !fresh },
  ];

/** Services open on first view: the two with the most wards a metro coordinator moves between. */
const OPEN_FIRST = 2;

/**
 * The bed map: every ward as a card with one square per bed, grouped by health service. Rows is
 * the same map one line per ward. The ward table that used to repeat it lives on All wards, so the
 * page holds each ward once (design review finding 2).
 */
export function BedMapCards({
  model,
  onSelectWard,
  selectedUnitId,
  highlight,
  onHighlight,
}: {
  model: CapacityModel;
  onSelectWard: (unitId: string) => void;
  selectedUnitId?: string;
  /** Owned by the page, so the hero's ready figures can light the same wards. */
  highlight: Highlight | null;
  onHighlight: (highlight: Highlight | null) => void;
}) {
  const { mapGroups, networkRows, totals, now } = model;
  const [layout, setLayout] = useState<"grid" | "rows">("grid");
  const [open, setOpen] = useState(() => new Set(mapGroups.slice(0, OPEN_FIRST).map((group) => group.service)));
  const rowOf = new Map(networkRows.map((row) => [row.unit.id, row]));
  const matches = (unitId: string) => {
    const row = rowOf.get(unitId);
    const rule = HIGHLIGHTS.find((entry) => entry.id === highlight);
    return !rule || (row !== undefined && rule.test(row, isConfirmationFresh(row.unit, now)));
  };
  const toggleGroup = (service: (typeof mapGroups)[number]["service"]) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next;
    });

  return (
    <Card aria-labelledby="capacity-map-title" className={styles.mapCard} id="capacity-bed-map">
      <CardHead
        id="capacity-map-title"
        title="Bed map"
        meta={`${totals.beds} beds · ${totals.wards} wards`}
        action={
          <Segmented
            label="Bed map layout"
            items={[
              { id: "grid" as const, label: "Grid" },
              { id: "rows" as const, label: "Rows" },
            ]}
            value={layout}
            onChange={setLayout}
          />
        }
      />
      <div className={styles.mapBody}>
        <div className={styles.highlights} role="group" aria-label="Highlight wards">
          <span className={styles.kickerInline} aria-hidden="true">
            Highlight
          </span>
          {HIGHLIGHTS.map((entry) => (
            <FilterChip
              key={entry.id}
              pressed={highlight === entry.id}
              onPressedChange={(pressed) => onHighlight(pressed ? entry.id : null)}
              count={networkRows.filter((row) => entry.test(row, isConfirmationFresh(row.unit, now))).length}
            >
              {entry.label}
            </FilterChip>
          ))}
        </div>
        {mapGroups.map((group) => {
          if (group.wards.length === 0) return null;
          const groupRows = group.wards.map((ward) => rowOf.get(ward.unit.id)).filter((row) => row !== undefined);
          const ready = groupRows.reduce((sum, row) => sum + row.ready, 0);
          const closed = group.wards.reduce((sum, ward) => sum + ward.closed, 0);
          const beds = group.wards.reduce((sum, ward) => sum + ward.unit.beds, 0);
          const inUse = group.wards.reduce((sum, ward) => sum + ward.occupied + ward.pulled, 0);
          const isOpen = open.has(group.service);
          const panelId = `capacity-map-${group.service.replace(/\W+/g, "-").toLowerCase()}`;
          return (
            <section key={group.service} className={styles.mapGroup} aria-label={group.service}>
              <h3 className={styles.mapGroupHead}>
                <button
                  type="button"
                  className={styles.mapGroupToggle}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(group.service)}
                >
                  {isOpen ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                  <span className={styles.mapGroupName}>{group.service}</span>
                  <span className={styles.muted}>{group.wards.length} wards</span>
                  <span className={styles.mapGroupFigures}>
                    <b>{ready} ready</b> · {closed} closed · {beds ? ((inUse / beds) * 100).toFixed(1) : "0"}% in use
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
            { label: "Occupied or pulled", swatchClassName: styles.cellUsed },
            { label: "Closed", swatchClassName: styles.cellClosed },
          ]}
        />
        <Link href="/ward-flow/wards" className={styles.footLink}>
          Every ward as a table
        </Link>
      </div>
    </Card>
  );
}

function WardCard({
  ward,
  row,
  now,
  layout,
  dimmed,
  selected,
  onSelect,
}: {
  ward: BedMapWard;
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
  const occupied = ward.occupied + ward.pulled;
  return (
    <button
      type="button"
      className={`${layout === "grid" ? styles.wardCard : styles.wardRow}${dimmed ? ` ${styles.dimmed}` : ""}`}
      aria-haspopup="dialog"
      data-selected={selected ? "" : undefined}
      onClick={onSelect}
    >
      <span className={styles.wardName}>
        <SpelledCodes text={ward.unit.name} />
      </span>
      <span className={styles.wardBeds}>{ward.unit.beds} beds</span>
      <span className={styles.wardReady}>
        <b className={styles.wardReadyN}>{ward.ready}</b>
        {ward.ready ? "ready" : "none ready"}
      </span>
      <span className={styles.wardOccupied}>{occupied} occupied</span>
      <BedCells beds={ward.unit.beds} ready={ward.ready} used={occupied} />
      <span className={styles.wardNote}>
        {!fresh && row ? (
          <span className={styles.warnInk}>
            <Clock size={12} aria-hidden="true" /> Count {durMinutes(Math.max(0, now - row.confirmedAt))} old
          </span>
        ) : notes.length ? (
          notes.join(" · ")
        ) : (
          "All beds in use or ready"
        )}
      </span>
    </button>
  );
}

/** One square per bed: ready, then occupied or pulled, then closed. Decorative; the card says it in words. */
function BedCells({ beds, ready, used }: { beds: number; ready: number; used: number }) {
  return (
    <span className={styles.cells} aria-hidden="true">
      {Array.from({ length: beds }, (_, index) => (
        <i
          key={index}
          className={index < ready ? styles.cellReady : index < ready + used ? styles.cellUsed : styles.cellClosed}
        />
      ))}
    </span>
  );
}
