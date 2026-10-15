import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./template-component.module.css";
import { computeBarLayout, groupEventsByLane, HorizonEventItem, ClinicalEventType } from "./template-derivations";

export interface HorizonGanttProps {
  events: HorizonEventItem[];
  defaultZoomHours?: 12 | 24 | 48;
  onSelectEvent?: (event: HorizonEventItem) => void;
}

const TYPE_STYLE_MAP: Record<ClinicalEventType, string> = {
  admit: styles.barAdmit,
  transit: styles.barTransit,
  leave: styles.barLeave,
  discharge: styles.barDischarge,
  delay: styles.barDelay,
  predicted: styles.barPredicted,
};

export function HorizonGantt({ events, defaultZoomHours = 48, onSelectEvent }: HorizonGanttProps) {
  const [zoomHours, setZoomHours] = useState<12 | 24 | 48>(defaultZoomHours);
  const [scrubHours, setScrubHours] = useState<number>(0);
  const [selectedEvent, setSelectedEvent] = useState<HorizonEventItem | null>(null);

  const lastActiveTriggerRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Group events by discrete ward lanes
  const laneGroups = useMemo(() => {
    return groupEventsByLane(events, "wardName");
  }, [events]);

  const laneNames = useMemo(() => Object.keys(laneGroups), [laneGroups]);

  // Handle Event Click & Focus Transition
  const handleEventClick = useCallback(
    (ev: HorizonEventItem, targetElement: HTMLElement) => {
      lastActiveTriggerRef.current = targetElement;
      setSelectedEvent(ev);
      onSelectEvent?.(ev);
    },
    [onSelectEvent],
  );

  // Close Detail Drawer & Restore Focus
  const handleCloseDrawer = useCallback(() => {
    setSelectedEvent(null);
    lastActiveTriggerRef.current?.focus();
  }, []);

  // Keyboard Trap & Escape Listener
  useEffect(() => {
    if (!selectedEvent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleCloseDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.querySelector<HTMLElement>('button, [tabindex="0"]')?.focus();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedEvent, handleCloseDrawer]);

  return (
    <div className={styles.horizonContainer} role="region" aria-label="Movement Horizon">
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>Movement Horizon ({events.length} movements active)</div>

        <div className={styles.controlsGroup}>
          {/* Zoom Buttons */}
          <div className={styles.zoomButtonGroup} role="group" aria-label="Timeline zoom range">
            {([12, 24, 48] as const).map((h) => (
              <button
                key={h}
                type="button"
                className={`${styles.zoomBtn} ${zoomHours === h ? styles.zoomBtnActive : ""}`}
                onClick={() => setZoomHours(h)}
                aria-pressed={zoomHours === h}
              >
                {h}h
              </button>
            ))}
          </div>

          {/* Time Scrubber */}
          <div className={styles.scrubberWrapper}>
            <label htmlFor="timeline-scrubber">Time Scrub:</label>
            <input
              id="timeline-scrubber"
              type="range"
              className={styles.scrubberInput}
              min={0}
              max={zoomHours}
              value={scrubHours}
              onChange={(e) => setScrubHours(Number(e.target.value))}
              aria-label="Timeline time offset scrubber"
              aria-valuenow={scrubHours}
              aria-valuemin={0}
              aria-valuemax={zoomHours}
            />
            <span>T+{scrubHours}h</span>
          </div>
        </div>
      </div>

      {/* Lanes */}
      <div className={styles.laneContainer}>
        {laneNames.map((laneName) => {
          const laneEvents = laneGroups[laneName] || [];

          return (
            <div key={laneName} className={styles.laneRow}>
              <div className={styles.laneHeader} title={laneName}>
                {laneName}
              </div>

              <div className={styles.laneTrack}>
                {laneEvents.map((ev) => {
                  const layout = computeBarLayout(ev, zoomHours, scrubHours);
                  const modeClass =
                    layout.labelMode === "id"
                      ? styles.modeId
                      : layout.labelMode === "compact"
                        ? styles.modeCompact
                        : styles.modeFull;

                  return (
                    <div
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      className={`${styles.eventBar} ${TYPE_STYLE_MAP[ev.type]} ${modeClass}`}
                      style={{
                        left: `${layout.leftPct}%`,
                        width: `${layout.widthPct}%`,
                      }}
                      onClick={(e) => handleEventClick(ev, e.currentTarget)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleEventClick(ev, e.currentTarget);
                        }
                      }}
                      aria-label={`${ev.patientId} ${ev.patientName} ${ev.statusLabel}`}
                    >
                      <span className={styles.eventId}>{ev.patientId}</span>
                      <span className={styles.eventStatusBadge}> · {ev.statusLabel}</span>
                      <span className={styles.eventFullTitle}> · {ev.patientName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Drawer */}
      {selectedEvent && (
        <div className={styles.drawerBackdrop} onClick={handleCloseDrawer} role="presentation">
          <div
            ref={drawerRef}
            className={styles.drawerPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <h3 id="drawer-heading" className={styles.drawerTitle}>
                Movement Details
              </h3>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={handleCloseDrawer}
                aria-label="Close movement details"
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedEvent.patientName}</div>
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                  {selectedEvent.patientId} · {selectedEvent.wardName}
                </div>
              </div>

              <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: 6, fontSize: 13 }}>
                <div>
                  <strong>Status:</strong> {selectedEvent.statusLabel}
                </div>
                <div>
                  <strong>Statutory Authority:</strong> {selectedEvent.statutoryForm || "Voluntary Inpatient"}
                </div>
                {selectedEvent.escortRequired && (
                  <div>
                    <strong>Escort:</strong> {selectedEvent.escortRequired}
                  </div>
                )}
                <div>
                  <strong>Planned Duration:</strong> {selectedEvent.durationHours} hours
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
