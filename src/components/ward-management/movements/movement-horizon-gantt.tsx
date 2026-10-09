"use client";

import { useId, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { ChartNoAxesGantt, ChevronLeft, ChevronRight } from "lucide-react";
import { IconTile, buttonClass } from "@/components/wf";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { edById } from "@/components/ward-management/ward-sites";
import { HEALTH_SERVICES, type HealthService, type Unit } from "@/components/ward-management/ward-model";

import type {
  CorridorCount,
  MovementHorizonEvent,
  MovementHorizonLane,
  RefusedCorridorCount,
} from "./movements-derivations";
import styles from "./movement-horizon.module.css";

export interface MovementHorizonGanttProps {
  lanes: MovementHorizonLane[];
  corridors: CorridorCount[];
  refusedCorridors: RefusedCorridorCount[];
  units: Unit[];
  now: Instant;
  selectedMovementId?: string | null;
  onSelectMovement?: (id: string) => void;
}

type ZoomHours = 12 | 24 | 48;
type CorridorTab = "accepted" | "refused";

/** v6: six time columns across the window (every 8 hours at 48h, every 2 at 12h). */
const TICK_COUNT = 6;

/**
 * 🔴 **WHY EVENTS IN ONE LANE NEED THEIR OWN ROW.** `movements-derivations.ts`'s
 * `deriveMovementHorizonLanes` gives every event but a live bed hold `startH: 0, durH: 0` — a
 * zero-width "now" marker, and honestly so: this model holds no ETA, no discharge date and no
 * predicted-duration for anything else (see that file's module doc). Two such markers in the same
 * lane land at the identical `left`. Before this fix every bar also shared the same `top` (a bare
 * `8px` in `movement-horizon.module.css`), so the second bar painted directly over the first —
 * only the DOM's first bar was visible or reachable by click/keyboard, and the one underneath was
 * neither. `docs/ward-flow/mockups/movement-gantt-third-edition.html`'s own fixture (`LANES_BY_WARD`)
 * never exercises this case — every one of its invented events sits at a distinct `startH`, and its
 * own `.eventBar` (`top: 9px; bottom: 9px`) and `renderGantt` loop position every bar the same way
 * this chart did before the fix, with no per-row offset — so the drawing gives no layout to follow
 * for two bars sharing a lane. This gives each event in a lane its own vertical row instead, the
 * lane growing tall enough to fit every row rather than clipping or overlapping.
 *
 * `HORIZON_BAR_HEIGHT` (36) and `HORIZON_BAR_TOP`/the inter-row gap (8) are exactly the values this
 * chart already used for its single bar per lane, so a lane with exactly one event renders at its
 * original 52px height — this only adds rows for a lane that has more than one.
 */
export type HorizonDensity = "compact" | "expanded";

export interface DensitySettings {
  barHeight: number;
  barGap: number;
  barTop: number;
  fontSize: string;
  labelPadding: string;
}

export const DENSITY_CONFIG: Record<HorizonDensity, DensitySettings> = {
  compact: {
    barHeight: 22,
    barGap: 2,
    barTop: 6,
    fontSize: "var(--text-xs)",
    labelPadding: "4px 14px",
  },
  expanded: {
    barHeight: 28,
    barGap: 8,
    barTop: 10,
    fontSize: "var(--text-xs)",
    labelPadding: "0 14px",
  },
};

/** The lane track's height in pixels, tall enough to give every one of `eventCount` events its
 *  own row (`rowStep` apart) plus top/bottom padding based on chosen density. */
function laneTrackHeight(eventCount: number, density: HorizonDensity): number {
  const cfg = DENSITY_CONFIG[density];
  const rowStep = cfg.barHeight + cfg.barGap;
  return cfg.barTop + Math.max(1, eventCount) * rowStep + cfg.barTop;
}

/** Deterministic per-lane row order: earliest-starting event first, then `id` so two events that
 *  start at the same hour (the ordinary case — see `HORIZON_BAR_HEIGHT`'s comment above) do not
 *  swap rows between renders. A pure sort for display only; it does not touch `lane.events` or
 *  anything `movements-derivations.ts` returns. */
function stackedLaneEvents(events: MovementHorizonLane["events"]): MovementHorizonLane["events"] {
  return [...events].sort((a, b) => a.startH - b.startH || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

interface TooltipState {
  title: string;
  details: string;
  x: number;
  y: number;
}

export function MovementHorizonGantt({
  lanes,
  corridors,
  refusedCorridors,
  units,
  now,
  selectedMovementId,
  onSelectMovement,
}: MovementHorizonGanttProps) {
  const [zoom, setZoom] = useState<ZoomHours>(48);
  const [scrub, setScrub] = useState<number>(0);
  const [isEnlarged, setIsEnlarged] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [activeCorridorTab, setActiveCorridorTab] = useState<CorridorTab>("accepted");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [serviceFilter, setServiceFilter] = useState<HealthService | "ALL">("ALL");
  const [density, setDensity] = useState<HorizonDensity>("compact");

  const scrubberId = useId();
  const serviceFilterId = useId();
  const horizonRef = useRef<HTMLDivElement>(null);
  useWardModalFocus(isEnlarged, horizonRef, () => setIsEnlarged(false));

  // Handle zoom changes
  const handleZoomChange = (newZoom: ZoomHours) => {
    setZoom(newZoom);
    if (scrub > newZoom) {
      setScrub(newZoom);
    }
  };

  // Handle scrubber changes
  const handleScrubberChange = (value: number) => {
    setScrub(value);
  };

  // Reset scrubber
  const handleResetScrubber = () => {
    setScrub(0);
  };

  // Toggle enlarge
  const handleToggleEnlarge = () => {
    setIsCollapsed(false);
    setIsEnlarged(!isEnlarged);
  };

  // Generate tick markers: the offset over the clock time it lands on.
  const ticks = [];
  const step = zoom / TICK_COUNT;
  for (let i = 0; i < TICK_COUNT; i++) {
    const h = i * step;
    const tickInstant = now + Math.round(h * 60);
    const isNow = i === 0;
    ticks.push({
      h,
      isNow,
      offset: isNow ? "Now" : `+${Math.round(h)}h`,
      time: formatInstantWithDay(tickInstant, now),
    });
  }
  const scrubStep = Math.round(step);

  // Scrubber cursor calculation (strictly 0% to 100% of track)
  const cursorFraction = scrub / zoom;
  const scrubInstant = now + Math.round(scrub * 60);
  const scrubBadgeText =
    scrub === 0 ? `Now, ${formatInstantWithDay(now, now)}` : `+${scrub}h, ${formatInstantWithDay(scrubInstant, now)}`;

  // Corridor calculations for the rail
  const acceptedPairs = new Set(corridors.map((corridor) => `${corridor.originEdId} ${corridor.acceptedUnitId}`));
  const rankedPairs = Array.from(acceptedPairs, (key) => {
    const stages = corridors.filter((corridor) => `${corridor.originEdId} ${corridor.acceptedUnitId}` === key);
    return { ...stages[0], count: stages.reduce((total, stage) => total + stage.count, 0), stages };
  }).sort((a, b) => b.count - a.count);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>, ev: MovementHorizonEvent) => {
    const rect = e.currentTarget.closest(`.${styles.diagWrap}`)?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      title: `${barPatientName(ev)}${ev.ageBand ? ` (${ev.ageBand})` : ""} · ${ev.title}`,
      details: `${ev.origin} ➔ ${ev.dest}${ev.bed ? ` · ${ev.bed}` : ""}${ev.carrier ? ` · ${ev.carrier}` : ""}${ev.durH > 0 ? ` · ${ev.durH.toFixed(1)}h window` : ""}`,
      x: Math.max(6, Math.min(e.clientX - rect.left + 14, rect.width - 280)),
      y: e.clientY - rect.top + 16,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const visibleLanes = lanes.filter((lane) => serviceFilter === "ALL" || lane.service === serviceFilter);
  const selectMovement = (id: string) => {
    setIsEnlarged(false);
    onSelectMovement?.(id);
  };
  const selectedEvent =
    selectedMovementId == null
      ? undefined
      : lanes.flatMap((lane) => lane.events).find((event) => event.id === selectedMovementId);

  return (
    <div
      ref={horizonRef}
      className={`${styles.horizonContainer}${isEnlarged ? ` ${styles.fullscreen}` : ""}`}
      data-testid="ward-movement-horizon"
      role={isEnlarged ? "dialog" : undefined}
      aria-modal={isEnlarged ? true : undefined}
      aria-label={isEnlarged ? "Full screen movement timeline" : undefined}
      tabIndex={isEnlarged ? -1 : undefined}
    >
      {/* v6 card head: tile, title and lane count, then the chart's own controls. */}
      <div className={styles.panelSubHeader}>
        <div className={styles.phScopeInfo}>
          <IconTile icon={ChartNoAxesGantt} />
          <h2 className={styles.phTitle}>{zoom} hour timeline</h2>
          <span className={styles.phLaneCount}>
            {visibleLanes.length === lanes.length
              ? `${lanes.length} receiving wards`
              : `${visibleLanes.length} of ${lanes.length} receiving wards`}
          </span>
        </div>

        <div className={styles.phControls}>
          <div className={styles.serviceFilterWrap}>
            <label htmlFor={serviceFilterId} className={styles.serviceFilterLabel}>
              Service
            </label>
            <select
              id={serviceFilterId}
              className={styles.serviceFilterSelect}
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as HealthService | "ALL")}
              aria-label="Filter movement horizon by health service"
            >
              <option value="ALL">All services ({lanes.length})</option>
              {HEALTH_SERVICES.map((s) => {
                const count = lanes.filter((l) => l.service === s).length;
                return (
                  <option key={s} value={s}>
                    {s} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className={styles.zoomGroup} role="group" aria-label="Row density">
            <button
              type="button"
              className={styles.zmBtn}
              aria-pressed={density === "compact"}
              title="Compact row height"
              onClick={() => setDensity("compact")}
            >
              Compact
            </button>
            <button
              type="button"
              className={styles.zmBtn}
              aria-pressed={density === "expanded"}
              title="Expanded row height"
              onClick={() => setDensity("expanded")}
            >
              Roomy
            </button>
          </div>

          <div className={styles.zoomGroup} role="group" aria-label="Timeline zoom range">
            {([12, 24, 48] as const).map((z) => (
              <button
                key={z}
                type="button"
                className={styles.zmBtn}
                data-zoom={z}
                aria-pressed={zoom === z}
                onClick={() => handleZoomChange(z)}
              >
                {z}h
              </button>
            ))}
          </div>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "sm", className: styles.phBtn })}
            id="enlargeHorizonGantt"
            aria-pressed={isEnlarged}
            onClick={handleToggleEnlarge}
            title={isEnlarged ? "Close full screen timeline (Esc)" : "Open full screen timeline"}
          >
            {isEnlarged ? "Close full screen" : "Enlarge"}
          </button>
          <button
            type="button"
            className={buttonClass({ variant: "ghost", size: "sm", className: styles.phBtn })}
            id="toggleHorizonDiagram"
            aria-controls="horizonDiagramArea"
            aria-expanded={!isCollapsed}
            disabled={isEnlarged}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div id="horizonDiagramArea" className={styles.diagramArea}>
          {/* Scrub row: step back, the slider, step forward, the time it points at, then Reset. */}
          <div className={styles.ganttControlsBar}>
            <div className={styles.ganttScrubberWrap}>
              <label htmlFor={scrubberId} className={styles.ganttScrubLabel}>
                Scrub
              </label>
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm", iconOnly: true, className: styles.scrubStep })}
                aria-label={`Back ${scrubStep} hours`}
                disabled={scrub === 0}
                onClick={() => handleScrubberChange(Math.max(0, scrub - scrubStep))}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <input
                type="range"
                id={scrubberId}
                className={styles.ganttSlider}
                min={0}
                max={zoom}
                step={1}
                value={scrub}
                aria-label="Timeline time scrubber"
                aria-valuemin={0}
                aria-valuemax={zoom}
                aria-valuenow={scrub}
                aria-valuetext={scrubBadgeText}
                onChange={(e) => handleScrubberChange(parseInt(e.target.value, 10))}
              />
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm", iconOnly: true, className: styles.scrubStep })}
                aria-label={`Forward ${scrubStep} hours`}
                disabled={scrub >= zoom}
                onClick={() => handleScrubberChange(Math.min(zoom, scrub + scrubStep))}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <span className={styles.ganttScrubBadge} id="ganttScrubBadgeText">
                {scrubBadgeText}
              </span>
              <button
                type="button"
                className={buttonClass({ variant: "ghost", size: "sm", className: styles.ganttResetBtn })}
                onClick={handleResetScrubber}
              >
                Reset
              </button>
            </div>
            <ul className={styles.ganttLegend} aria-label="Movement horizon legend">
              <li className={styles.ganttLegendItem}>
                <span className={`${styles.ganttSwatch} ${styles.swatchAdmit}`} aria-hidden="true" />
                Inbound admit
              </li>
              <li className={styles.ganttLegendItem}>
                <span className={`${styles.ganttSwatch} ${styles.swatchTransit}`} aria-hidden="true" />
                In transit
              </li>
              <li className={styles.ganttLegendItem}>
                <span className={`${styles.ganttSwatch} ${styles.swatchDelay}`} aria-hidden="true" />
                Bed hold passed
              </li>
            </ul>
          </div>

          {/* Split Container: Gantt Grid + Side Corridor Register */}
          <div className={`${styles.diagSplit}${isEnlarged ? ` ${styles.enlarged}` : ""}`} id="horizonSplit">
            <div className={styles.diagMain}>
              <div
                className={styles.diagWrap}
                id="horizonDiagWrap"
                tabIndex={0}
                role="region"
                aria-label="Movements timeline"
              >
                {/* Floating Tooltip */}
                {tooltip && (
                  <div
                    className={styles.tooltip}
                    style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
                    aria-hidden="true"
                  >
                    <div className={styles.tooltipTitle}>{tooltip.title}</div>
                    <div className={styles.tooltipDetails}>{tooltip.details}</div>
                  </div>
                )}

                <div className={styles.ganttGridTable}>
                  {/* Scrubber Cursor line */}
                  <div
                    className={styles.ganttCursor}
                    style={{
                      left: `calc(var(--horizon-ward-width) + (100% - var(--horizon-ward-width)) * ${cursorFraction})`,
                    }}
                    aria-hidden="true"
                  >
                    <div className={styles.ganttCursorPin} />
                    {scrub > 0 && <div className={styles.ganttCursorTime}>+{scrub}h</div>}
                  </div>

                  {/* Header Row */}
                  <div className={styles.ganttHeaderRow}>
                    <div className={styles.ganttColWard}>Receiving ward</div>
                    <div className={styles.ganttColTicks}>
                      {ticks.map((t) => (
                        <div
                          key={t.h}
                          className={`${styles.ganttTick}${t.isNow ? ` ${styles.nowTick}` : ""}`}
                          title={`${t.offset} ${t.time}`}
                        >
                          <span className={styles.tickOffset}>{t.offset}</span>
                          <span className={styles.tickTime}>{t.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lane Rows */}
                  {visibleLanes.length === 0 ? (
                    <p className={styles.horizonEmpty}>
                      {serviceFilter === "ALL"
                        ? "No open movements with an accepting ward."
                        : `No open movements accepted into ${serviceFilter} wards.`}
                    </p>
                  ) : (
                    visibleLanes.map((lane) => {
                      // F14 (Opus adversarial review, 2026-09-17): a lane whose events are ALL
                      // beyond the current zoom window used to render its row anyway — every bar
                      // inside the row-events loop below returned null for `ev.startH >= zoom`, but
                      // `laneTrackHeight(lane.events.length)` still reserved that row's full height,
                      // drawing a blank strip with no bar and no word explaining it. Filtering to
                      // the window here, before height/order are computed, means a row exists if
                      // and only if it has something to show — the same rule the section-level
                      // empty state above already follows for "no lanes at all".
                      const windowEvents = lane.events.filter((ev) => ev.startH < zoom);
                      if (windowEvents.length === 0) return null;
                      const rowEvents = stackedLaneEvents(windowEvents);
                      const cfg = DENSITY_CONFIG[density];
                      const rowStep = cfg.barHeight + cfg.barGap;
                      const trackHeight = laneTrackHeight(windowEvents.length, density);
                      return (
                        <div
                          key={lane.id}
                          className={styles.ganttLaneRow}
                          style={{ height: `${trackHeight}px` } as CSSProperties}
                        >
                          <div className={styles.ganttLaneLabel} title={lane.name}>
                            <span className={styles.ganttLaneName}>{lane.name}</span>
                            <span className={styles.ganttSvcTag}>{lane.service}</span>
                          </div>
                          <div className={styles.ganttLaneTrack}>
                            {Array.from({ length: TICK_COUNT }).map((_, c) => (
                              <div key={c} className={styles.ganttLaneCol} aria-hidden="true" />
                            ))}

                            {/* Event Bars — each on its own row (`rowStep` above) so two
                                events sharing a start time never share a rectangle. `rowEvents` is
                                already `windowEvents` above, so every entry here is inside the
                                zoom window — nothing left to filter a second time. */}
                            {rowEvents.map((ev, row) => {
                              const leftPct = (ev.startH / zoom) * 100;
                              const widthPct = Math.max((ev.durH / zoom) * 100, 3.2);
                              const maxW = 100 - leftPct;
                              const actualW = Math.min(widthPct, maxW);
                              const barText = formatGanttBarLabel(ev, zoom);
                              const isSelected = selectedMovementId === ev.id;

                              const isScrubMatch =
                                scrub > 0 && ev.startH <= scrub && scrub < ev.startH + Math.max(ev.durH, 1);
                              const swatchClass =
                                ev.type === "admit"
                                  ? styles.barAdmit
                                  : ev.type === "transit"
                                    ? styles.barTransit
                                    : ev.type === "leave"
                                      ? styles.barLeave
                                      : ev.type === "disch"
                                        ? styles.barDisch
                                        : ev.type === "pred"
                                          ? styles.barPred
                                          : styles.barDelay;

                              return (
                                <div
                                  key={ev.id}
                                  className={`${styles.ganttBar} ${swatchClass}${isSelected ? ` ${styles.activeSelect}` : ""}${isScrubMatch ? ` ${styles.scrubActive}` : ""}`}
                                  style={
                                    {
                                      // A bar near the far edge keeps its short name inside the track.
                                      left: `min(${leftPct.toFixed(2)}%, calc(100% - 104px))`,
                                      width: `${actualW.toFixed(2)}%`,
                                      top: `${cfg.barTop + row * rowStep}px`,
                                      height: `${cfg.barHeight}px`,
                                    } as CSSProperties
                                  }
                                  data-mid={ev.id}
                                  tabIndex={0}
                                  role="button"
                                  aria-label={`${barPatientName(ev)}, ${ev.title}: ${ev.origin} to ${ev.dest}${ev.carrier ? `, ${ev.carrier}` : ""}${ev.bed ? `, ${ev.bed}` : ""}`}
                                  onClick={() => selectMovement(ev.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      selectMovement(ev.id);
                                    }
                                  }}
                                  onMouseMove={(e) => handleMouseMove(e, ev)}
                                  onMouseLeave={handleMouseLeave}
                                >
                                  <span className={styles.ganttBarText}>{barText}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Grid Filler Row so background grid columns extend all the way to the bottom */}
                  <div className={styles.ganttFillerRow} aria-hidden="true">
                    <div className={styles.ganttFillerWard} />
                    <div className={styles.ganttFillerTrack}>
                      {Array.from({ length: TICK_COUNT }).map((_, c) => (
                        <div key={c} className={styles.ganttFillerCol} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Diagram Footer */}
              <div className={styles.diagFoot}>
                <span className={styles.diagScope}>
                  {selectedEvent
                    ? `Selected ${formalName(barPatientName(selectedEvent))}.`
                    : "Select a movement to open its record."}
                </span>
              </div>
            </div>

            {/* Side Corridor Rail */}
            <aside className={styles.corridorRail} aria-label="Ranked corridors">
              <div className={styles.corridorRailHeader}>
                <h3>Corridors</h3>
                <div className={styles.corridorTabs} role="group" aria-label="Corridor kind">
                  <button
                    type="button"
                    aria-pressed={activeCorridorTab === "accepted"}
                    onClick={() => setActiveCorridorTab("accepted")}
                  >
                    Accepted <span>{acceptedPairs.size}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeCorridorTab === "refused"}
                    onClick={() => setActiveCorridorTab("refused")}
                  >
                    Declined <span>{refusedCorridors.length}</span>
                  </button>
                </div>
              </div>
              {activeCorridorTab === "accepted" ? (
                corridors.length === 0 ? (
                  <p className={styles.railEmpty}>No open movement currently has an accepting ward.</p>
                ) : (
                  <ol className={styles.corridorRanks}>
                    {rankedPairs.map((corridor) => {
                      const ed = edById(corridor.originEdId);
                      const unit = units.find((candidate) => candidate.id === corridor.acceptedUnitId);
                      const route = `${ed ? `${ed.siteCode} ED` : corridor.originEdId} to ${wardLabel(corridor.acceptedUnitId, unit?.name)}`;
                      const detail = corridor.stages
                        .map((row) => `${stageCopy[row.stage].label} ${row.count}`)
                        .join(" · ");
                      return (
                        <li
                          key={`${corridor.originEdId} ${corridor.acceptedUnitId} ${corridor.stage} rank`}
                          title={`${ed?.name ? `${ed.name} to ` : ""}${wardLabel(corridor.acceptedUnitId, unit?.name)}`}
                        >
                          <span>
                            <span className={styles.corridorRoute}>{route}</span>
                            {/* The department's full name stays for screen readers; sighted readers
                                have it in the row's title. */}
                            {ed?.name ? <span className="sr-only">From {ed.name}.</span> : null}
                            <small>{detail}</small>
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
                    return (
                      <li
                        key={`${corridor.originEdId} ${corridor.unitId} refused rank`}
                        title={`${ed?.name ? `${ed.name} to ` : ""}${wardLabel(corridor.unitId, unit?.name)}`}
                      >
                        <span>
                          <span className={styles.corridorRoute}>
                            {ed ? `${ed.siteCode} ED` : corridor.originEdId} to {wardLabel(corridor.unitId, unit?.name)}
                          </span>
                          <small>{corridor.reasons.map((r) => r.replaceAll("_", " ")).join(", ")}</small>
                        </span>
                        <strong>{corridor.count}</strong>
                      </li>
                    );
                  })}
                </ol>
              )}
              {activeCorridorTab === "refused" && (
                <p className={styles.stripNote}>Declines have no journey stage of their own.</p>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

function formatGanttBarLabel(ev: MovementHorizonEvent, zoom: number): string {
  const pct = (ev.durH / zoom) * 100;
  const sub =
    ev.type === "transit"
      ? "Transit"
      : ev.type === "leave"
        ? "Leave"
        : ev.type === "disch"
          ? "Disch"
          : ev.type === "pred"
            ? "Pred"
            : ev.type === "delay"
              ? "Hold"
              : "Admit";

  // Owner, 26 Sept 2026: the bar names the patient; the WF journey number is not shown.
  // v6 (7 Oct 2026): the bar reads "Surname, I"; the full name stays in the accessible name.
  const name = shortName(barPatientName(ev));
  if (pct < 12) return name;
  if (pct < 22) return `${name} · ${sub}`;
  return `${name} · ${ev.title}`;
}

/** The patient's name for a bar, or the resolver's own "Unknown Patient" when none is linked. */
function barPatientName(ev: MovementHorizonEvent): string {
  return ev.patientName ?? "Unknown Patient";
}

/** "Noor Tremalow" to "Tremalow, Noor". A name already in that order, or one word, is kept. */
function formalName(name: string): string {
  if (name === "Unknown Patient" || name.includes(",")) return name;
  const parts = name.trim().split(/\s+/u);
  if (parts.length < 2) return name;
  const surname = parts[parts.length - 1];
  return `${surname}, ${parts.slice(0, -1).join(" ")}`;
}

/** "Noor Tremalow" to "Tremalow, N", the bar's short label. */
function shortName(name: string): string {
  const formal = formalName(name);
  const [surname, given] = formal.split(", ");
  if (given === undefined || formal === "Unknown Patient") return formal;
  return `${surname}, ${given.charAt(0)}`;
}
