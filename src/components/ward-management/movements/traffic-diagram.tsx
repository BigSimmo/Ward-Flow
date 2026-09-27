"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";

import type { CorridorCount, RefusedCorridorCount } from "./movements-derivations";
import styles from "./traffic-diagram.module.css";

const CANVAS_WIDTH = 820;
const NODE_STEP = 58;
const NODE_TOP = 60;
const LEFT_EDGE = 204;
const RIGHT_EDGE = 616;

type Endpoint = { id: string; label: string; shortLabel?: string };
type CorridorTab = "accepted" | "refused";
type HoverTarget =
  | { type: "endpoint"; id: string; side: "origin" | "destination" }
  | { type: "corridor"; originEdId: string; destinationId: string; key?: string }
  | null;

export function TrafficDiagram({
  corridors,
  refusedCorridors,
  units,
}: {
  corridors: CorridorCount[];
  refusedCorridors: RefusedCorridorCount[];
  units: Unit[];
}) {
  const [activeTab, setActiveTab] = useState<CorridorTab>("accepted");
  const [hover, setHover] = useState<HoverTarget>(null);
  const allOrigins = [
    ...corridors.map((corridor) => corridor.originEdId),
    ...refusedCorridors.map((corridor) => corridor.originEdId),
  ];
  const allDestinations = [
    ...corridors.map((corridor) => corridor.acceptedUnitId),
    ...refusedCorridors.map((corridor) => corridor.unitId),
  ];

  if (allOrigins.length === 0) {
    return <p className={styles.absent}>No accepted or declined corridor is recorded for this day.</p>;
  }

  const origins = uniqueEndpoints(
    allOrigins.map((originEdId) => ({
      id: originEdId,
      shortLabel: edById(originEdId) ? `${edById(originEdId)!.siteCode} ED` : undefined,
      label: edById(originEdId)?.name ?? `Department not found: “${originEdId}”`,
    })),
  );
  const destinations = uniqueEndpoints(
    allDestinations.map((unitId) => {
      const unit = units.find((candidate) => candidate.id === unitId);
      return { id: unitId, label: wardLabel(unitId, unit?.name) };
    }),
  );
  const rowCount = Math.max(origins.length, destinations.length);
  const canvasHeight = Math.max(176, NODE_TOP + Math.max(rowCount - 1, 0) * NODE_STEP + 54);
  const originY = positions(origins);
  const destinationY = positions(destinations);
  const pairOffsets = offsetsByPair(corridors);
  const acceptedPairs = new Set(corridors.map((corridor) => pairKey(corridor.originEdId, corridor.acceptedUnitId)));
  const rankedPairs = Array.from(acceptedPairs, (key) => {
    const stages = corridors.filter((corridor) => pairKey(corridor.originEdId, corridor.acceptedUnitId) === key);
    return { ...stages[0], count: stages.reduce((total, stage) => total + stage.count, 0), stages };
  }).sort((a, b) => b.count - a.count);

  const isHoverActive = hover !== null;

  return (
    <div className={styles.trafficSplit}>
      <div className={styles.diagramColumn}>
        <div className={styles.diagramViewport} tabIndex={0} role="region" aria-label="Movement corridor schematic">
          <div className={styles.diagramCanvas} style={{ "--diagram-height": `${canvasHeight}px` } as CSSProperties}>
            <div className={styles.columnHeading} data-column="origins">
              Emergency departments
            </div>
            <div className={styles.columnHeading} data-column="destinations">
              Receiving wards
            </div>

            <svg
              className={styles.corridors}
              viewBox={`0 0 ${CANVAS_WIDTH} ${canvasHeight}`}
              role="img"
              aria-label={`${acceptedPairs.size} active accepted and ${refusedCorridors.length} declined corridors`}
            >
              {corridors.map((corridor, index) => {
                const from = origins.find((endpoint) => endpoint.id === corridor.originEdId);
                const to = destinations.find((endpoint) => endpoint.id === corridor.acceptedUnitId);
                const y1 = (originY.get(corridor.originEdId) ?? NODE_TOP) + pairOffsets[index];
                const y2 = (destinationY.get(corridor.acceptedUnitId) ?? NODE_TOP) + pairOffsets[index];
                const laneX = laneFor(index, corridors.length + refusedCorridors.length);
                const stage = stageCopy[corridor.stage].label;
                const title = `${from?.label ?? corridor.originEdId} to ${to?.label ?? corridor.acceptedUnitId}: ${corridor.count} ${corridor.count === 1 ? "open movement" : "open movements"}, ${stage}.`;
                const isActive =
                  isHoverActive &&
                  (hover.type === "endpoint"
                    ? hover.side === "origin"
                      ? corridor.originEdId === hover.id
                      : corridor.acceptedUnitId === hover.id
                    : hover.type === "corridor"
                      ? corridor.originEdId === hover.originEdId && corridor.acceptedUnitId === hover.destinationId
                      : false);
                const isDimmed = isHoverActive && !isActive;
                return (
                  <path
                    key={`${corridor.originEdId} ${corridor.acceptedUnitId} ${corridor.stage}`}
                    className={`${styles.corridor}${isActive ? ` ${styles.corridorActive}` : ""}${isDimmed ? ` ${styles.corridorDimmed}` : ""}`}
                    data-kind="accepted"
                    data-active={isActive ? "true" : undefined}
                    data-dimmed={isDimmed ? "true" : undefined}
                    d={orthogonalRoute(y1, y2, laneX)}
                    strokeWidth={2 + Math.min(corridor.count, 4) * 1.25}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() =>
                      setHover({
                        type: "corridor",
                        originEdId: corridor.originEdId,
                        destinationId: corridor.acceptedUnitId,
                        key: `${corridor.originEdId} ${corridor.acceptedUnitId} ${corridor.stage}`,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>{title}</title>
                  </path>
                );
              })}
              {refusedCorridors.map((corridor, index) => {
                const from = origins.find((endpoint) => endpoint.id === corridor.originEdId);
                const to = destinations.find((endpoint) => endpoint.id === corridor.unitId);
                const sharedPair = acceptedPairs.has(pairKey(corridor.originEdId, corridor.unitId));
                const y1 = (originY.get(corridor.originEdId) ?? NODE_TOP) + (sharedPair ? 7 : 0);
                const y2 = (destinationY.get(corridor.unitId) ?? NODE_TOP) + (sharedPair ? 7 : 0);
                const laneX = laneFor(corridors.length + index, corridors.length + refusedCorridors.length);
                const reasons = corridor.reasons.map(reasonLabel).join(", ");
                const isActive =
                  isHoverActive &&
                  (hover.type === "endpoint"
                    ? hover.side === "origin"
                      ? corridor.originEdId === hover.id
                      : corridor.unitId === hover.id
                    : hover.type === "corridor"
                      ? corridor.originEdId === hover.originEdId && corridor.unitId === hover.destinationId
                      : false);
                const isDimmed = isHoverActive && !isActive;
                return (
                  <path
                    key={`${corridor.originEdId} ${corridor.unitId} refused`}
                    className={`${styles.corridor}${isActive ? ` ${styles.corridorActive}` : ""}${isDimmed ? ` ${styles.corridorDimmed}` : ""}`}
                    data-kind="refused"
                    data-active={isActive ? "true" : undefined}
                    data-dimmed={isDimmed ? "true" : undefined}
                    d={orthogonalRoute(y1, y2, laneX)}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() =>
                      setHover({
                        type: "corridor",
                        originEdId: corridor.originEdId,
                        destinationId: corridor.unitId,
                        key: `${corridor.originEdId} ${corridor.unitId} refused`,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>{`${from?.label ?? corridor.originEdId} to ${to?.label ?? corridor.unitId}: ${corridor.count} ${corridor.count === 1 ? "refusal" : "refusals"} today; ${reasons}.`}</title>
                  </path>
                );
              })}
            </svg>

            {origins.map((endpoint) => {
              const isDirectlyHovered =
                hover !== null && hover.type === "endpoint" && hover.side === "origin" && hover.id === endpoint.id;
              const isConnected =
                hover !== null &&
                (hover.type === "corridor"
                  ? hover.originEdId === endpoint.id
                  : hover.type === "endpoint" && hover.side === "destination"
                    ? corridors.some((c) => c.acceptedUnitId === hover.id && c.originEdId === endpoint.id) ||
                      refusedCorridors.some((c) => c.unitId === hover.id && c.originEdId === endpoint.id)
                    : false);
              const isNodeActive = isDirectlyHovered || isConnected;
              const isNodeDimmed = isHoverActive && !isNodeActive;
              return (
                <div
                  key={endpoint.id}
                  className={`${styles.endpointNode}${isNodeActive ? ` ${styles.endpointActive}` : ""}${isNodeDimmed ? ` ${styles.endpointDimmed}` : ""}`}
                  data-side="origin"
                  data-active={isNodeActive ? "true" : undefined}
                  data-dimmed={isNodeDimmed ? "true" : undefined}
                  style={{ top: `${(originY.get(endpoint.id) ?? NODE_TOP) - 22}px` }}
                  onMouseEnter={() => setHover({ type: "endpoint", id: endpoint.id, side: "origin" })}
                  onMouseLeave={() => setHover(null)}
                >
                  <strong title={endpoint.label}>{endpoint.shortLabel ?? endpoint.label}</strong>
                  <small>{endpointSummary(endpoint.id, "origin", corridors, refusedCorridors)}</small>
                </div>
              );
            })}
            {destinations.map((endpoint) => {
              const isDirectlyHovered =
                hover !== null && hover.type === "endpoint" && hover.side === "destination" && hover.id === endpoint.id;
              const isConnected =
                hover !== null &&
                (hover.type === "corridor"
                  ? hover.destinationId === endpoint.id
                  : hover.type === "endpoint" && hover.side === "origin"
                    ? corridors.some((c) => c.originEdId === hover.id && c.acceptedUnitId === endpoint.id) ||
                      refusedCorridors.some((c) => c.originEdId === hover.id && c.unitId === endpoint.id)
                    : false);
              const isNodeActive = isDirectlyHovered || isConnected;
              const isNodeDimmed = isHoverActive && !isNodeActive;
              return (
                <div
                  key={endpoint.id}
                  className={`${styles.endpointNode}${isNodeActive ? ` ${styles.endpointActive}` : ""}${isNodeDimmed ? ` ${styles.endpointDimmed}` : ""}`}
                  data-side="destination"
                  data-active={isNodeActive ? "true" : undefined}
                  data-dimmed={isNodeDimmed ? "true" : undefined}
                  style={{ top: `${(destinationY.get(endpoint.id) ?? NODE_TOP) - 22}px` }}
                  onMouseEnter={() => setHover({ type: "endpoint", id: endpoint.id, side: "destination" })}
                  onMouseLeave={() => setHover(null)}
                >
                  <strong>{endpoint.label}</strong>
                  <small>{endpointSummary(endpoint.id, "destination", corridors, refusedCorridors)}</small>
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.diagramFoot}>
          <div className={styles.legend} aria-label="Corridor key">
            <span>
              <i data-kind="accepted" aria-hidden="true" /> Accepted
            </span>
            <span>
              <i data-kind="refused" aria-hidden="true" /> Declined
            </span>
          </div>
          <details className={styles.key}>
            <summary>Details</summary>
            <div className={styles.keyBody}>
              <p>
                Schematic, not geographic. Line weight reflects active accepted load. Declines have no journey stage of
                their own. Unused corridors are not computed from these records.
              </p>
            </div>
          </details>
        </div>
      </div>

      <aside className={styles.corridorRail} aria-label="Ranked corridors">
        <div className={styles.corridorRailHeader}>
          <h3>Corridors</h3>
          <div className={styles.corridorTabs} role="group" aria-label="Corridor kind">
            <button type="button" aria-pressed={activeTab === "accepted"} onClick={() => setActiveTab("accepted")}>
              Accepted <span>{acceptedPairs.size}</span>
            </button>
            <button type="button" aria-pressed={activeTab === "refused"} onClick={() => setActiveTab("refused")}>
              Declined <span>{refusedCorridors.length}</span>
            </button>
          </div>
        </div>
        {activeTab === "accepted" ? (
          corridors.length === 0 ? (
            <p className={styles.railEmpty}>No open movement currently has an accepting ward.</p>
          ) : (
            <ol className={styles.corridorRanks}>
              {rankedPairs.map((corridor) => {
                const ed = edById(corridor.originEdId);
                const unit = units.find((candidate) => candidate.id === corridor.acceptedUnitId);
                const isItemActive =
                  hover !== null &&
                  hover.type === "corridor" &&
                  hover.originEdId === corridor.originEdId &&
                  hover.destinationId === corridor.acceptedUnitId;
                return (
                  <li
                    key={`${corridor.originEdId} ${corridor.acceptedUnitId} ${corridor.stage} rank`}
                    className={isItemActive ? styles.railItemActive : undefined}
                    onMouseEnter={() =>
                      setHover({
                        type: "corridor",
                        originEdId: corridor.originEdId,
                        destinationId: corridor.acceptedUnitId,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  >
                    <span>
                      {ed ? `${ed.siteCode} ED` : corridor.originEdId} to{" "}
                      {wardLabel(corridor.acceptedUnitId, unit?.name)}
                      <small>
                        {corridor.stages.map((row) => `${stageCopy[row.stage].label} ${row.count}`).join(" · ")}
                      </small>
                    </span>
                    <strong>{corridor.count}</strong>
                  </li>
                );
              })}
            </ol>
          )
        ) : refusedCorridors.length === 0 ? (
          <p className={styles.railEmpty}>No ward refusal is recorded today.</p>
        ) : (
          <ol className={styles.corridorRanks}>
            {refusedCorridors.map((corridor) => {
              const ed = edById(corridor.originEdId);
              const unit = units.find((candidate) => candidate.id === corridor.unitId);
              const isItemActive =
                hover !== null &&
                hover.type === "corridor" &&
                hover.originEdId === corridor.originEdId &&
                hover.destinationId === corridor.unitId;
              return (
                <li
                  key={`${corridor.originEdId} ${corridor.unitId} refused rank`}
                  className={isItemActive ? styles.railItemActive : undefined}
                  onMouseEnter={() =>
                    setHover({
                      type: "corridor",
                      originEdId: corridor.originEdId,
                      destinationId: corridor.unitId,
                    })
                  }
                  onMouseLeave={() => setHover(null)}
                >
                  <span>
                    {ed ? `${ed.siteCode} ED` : corridor.originEdId} to {wardLabel(corridor.unitId, unit?.name)}
                    <small>{corridor.reasons.map(reasonLabel).join(", ")}</small>
                  </span>
                  <strong>{corridor.count}</strong>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </div>
  );
}

function uniqueEndpoints(endpoints: Endpoint[]): Endpoint[] {
  return Array.from(new Map(endpoints.map((endpoint) => [endpoint.id, endpoint])).values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

function positions(endpoints: Endpoint[]): Map<string, number> {
  return new Map(endpoints.map((endpoint, index) => [endpoint.id, NODE_TOP + index * NODE_STEP]));
}

function offsetsByPair(corridors: CorridorCount[]): number[] {
  const groups = new Map<string, number[]>();
  corridors.forEach((corridor, index) => {
    const key = pairKey(corridor.originEdId, corridor.acceptedUnitId);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const offsets = Array.from({ length: corridors.length }, () => 0);
  for (const indexes of groups.values()) {
    indexes.forEach((corridorIndex, pairIndex) => {
      offsets[corridorIndex] = (pairIndex - (indexes.length - 1) / 2) * 6;
    });
  }
  return offsets;
}

function laneFor(index: number, total: number): number {
  if (total <= 1) return (LEFT_EDGE + RIGHT_EDGE) / 2;
  return LEFT_EDGE + 76 + (index / (total - 1)) * (RIGHT_EDGE - LEFT_EDGE - 152);
}

function orthogonalRoute(y1: number, y2: number, laneX: number): string {
  const direction = y2 >= y1 ? 1 : -1;
  const radius = Math.min(10, Math.abs(y2 - y1) / 2);
  if (radius === 0) return `M ${LEFT_EDGE} ${y1} H ${RIGHT_EDGE}`;
  return `M ${LEFT_EDGE} ${y1} H ${laneX - radius} Q ${laneX} ${y1} ${laneX} ${y1 + direction * radius} V ${y2 - direction * radius} Q ${laneX} ${y2} ${laneX + radius} ${y2} H ${RIGHT_EDGE}`;
}

function pairKey(originEdId: string, unitId: string): string {
  return `${originEdId} ${unitId}`;
}

function reasonLabel(reason: string): string {
  return reason.replaceAll("_", " ");
}

function endpointSummary(
  id: string,
  side: "origin" | "destination",
  corridors: CorridorCount[],
  refusedCorridors: RefusedCorridorCount[],
): string {
  const accepted = corridors
    .filter((corridor) => (side === "origin" ? corridor.originEdId : corridor.acceptedUnitId) === id)
    .reduce((sum, corridor) => sum + corridor.count, 0);
  const declined = refusedCorridors
    .filter((corridor) => (side === "origin" ? corridor.originEdId : corridor.unitId) === id)
    .reduce((sum, corridor) => sum + corridor.count, 0);
  return `${accepted} accepted · ${declined} declined`;
}
