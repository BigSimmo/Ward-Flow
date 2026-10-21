"use client";

import React, { useCallback, useMemo, useState } from "react";
import styles from "./ward-beds-matrix.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { DAY_SHIFT_END_MINUTE } from "@/components/ward-management/ward-board-time-features";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { cx } from "@/components/wf";
import { bedGlyphTone, eddMovedBadge, type BedItem } from "./ward-bed-tone";
import { observationRatio, observationSummary } from "@/components/ward-management/ward-observation";

export { bedGlyphTone, eddMovedBadge, type BedItem };

interface WardBedsMatrixProps {
  unit: Unit;
  bedsList: BedItem[];
  selectedBed: number | null;
  setSelectedBed: (bed: number | null) => void;
  selectedPod: string;
  setSelectedPod: (pod: string) => void;
  isMixed: boolean;
  now?: number;
}

function formatBedAriaLabel(bed: BedItem, eddMoved: string | null = null): string {
  const parts: string[] = [`${bed.bedLabel} ${bed.statusText}`];
  if (bed.patientAlias) parts.push(bed.patientAlias);
  if (bed.stayDays !== undefined && bed.stayDays !== null) parts.push(`${bed.stayDays} days in bed`);
  if (bed.pastDate) parts.push("Past expected discharge date");
  if (bed.isSpecialling && bed.observation) parts.push(`${observationSummary(bed.observation)} active`);
  if (bed.awayAtEdHours !== null && bed.awayAtEdHours !== undefined)
    parts.push(`Away at ED for ${bed.awayAtEdHours} hours`);
  if (bed.legalStatusLabel) parts.push(bed.legalStatusLabel);
  if (bed.criteriaLedChip) parts.push(bed.criteriaLedChip.phrase);
  if (bed.blockReason) parts.push(`Discharge blocker: ${bed.blockReason}`);
  if (bed.tentativeDiagnosis) parts.push(`Tentative diagnosis: ${bed.tentativeDiagnosis}`);
  const expectedLeave = expectedLeaveLine(bed);
  if (expectedLeave) parts.push(expectedLeave);
  if (eddMoved) parts.push(eddMoved);
  return parts.join(". ").trim();
}

function expectedLeaveLine(bed: BedItem): string | null {
  if (bed.status === "ready" || bed.patientAlias == null) return null;
  if (bed.pastDate === true || (typeof bed.expectedDays === "number" && bed.expectedDays < 0)) {
    return "Past the ward's own date";
  }
  if (typeof bed.expectedDays !== "number") return null;
  if (bed.expectedDays === 0) return "Expected out today";
  if (bed.expectedDays === 1) return "Expected out in 1 day";
  return `Expected out in ${bed.expectedDays} days`;
}

function cardMetaLine(bed: BedItem): string | null {
  const parts: string[] = [];
  if (typeof bed.age === "number") parts.push(String(bed.age));
  if (bed.sex) parts.push(bed.sex);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Short card-face labels. The full recorded phrase stays in the accessible name and the drawer. */
const BLOCKER_CHIP: Record<string, string> = {
  "Awaiting clean": "Clean",
  "Awaiting pharmacy": "Pharmacy",
  "Awaiting placement confirmation": "Placement",
  "Awaiting service coordination": "Coordination",
  "Awaiting accommodation": "Accommodation",
  "Awaiting transport": "Transport",
  "Awaiting receiving-service acceptance": "Acceptance",
  "Awaiting family or carer arrangement": "Family",
  "Funding or plan decision pending": "Funding",
};

function cardSignal(bed: BedItem, isPastDate: boolean, isAwayAtEd: boolean): string | null {
  if (isPastDate) return "Past date";
  if (isAwayAtEd) return "At ED";
  if (typeof bed.expectedDays === "number" && bed.expectedDays >= 0 && bed.expectedDays <= 2) {
    if (bed.expectedDays === 0) return "Out today";
    return `Out in ${bed.expectedDays}d`;
  }
  if (bed.blockReason) return BLOCKER_CHIP[bed.blockReason] ?? bed.blockReason;
  if (bed.isSpecialling && bed.observation) return observationRatio(bed.observation.level);
  if (bed.isHdu) return "HDU";
  return null;
}

type ShiftGroup = "all" | "due-out" | "off-ward" | "in-transit";

interface WardBedCardProps {
  bed: BedItem;
  isSelected: boolean;
  onSelect: (bed: BedItem) => void;
}

function areBedCardPropsEqual(prev: WardBedCardProps, next: WardBedCardProps): boolean {
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.onSelect !== next.onSelect) return false;
  const p = prev.bed;
  const n = next.bed;
  return (
    p.bedNumber === n.bedNumber &&
    p.bedLabel === n.bedLabel &&
    p.status === n.status &&
    p.statusText === n.statusText &&
    p.preparing === n.preparing &&
    p.patientAlias === n.patientAlias &&
    p.stayDays === n.stayDays &&
    p.expectedDays === n.expectedDays &&
    p.departureExpectedAt === n.departureExpectedAt &&
    p.isClosed === n.isClosed &&
    p.isPulled === n.isPulled &&
    p.pastDate === n.pastDate &&
    p.admissionId === n.admissionId &&
    p.awayAtEdHours === n.awayAtEdHours &&
    p.blockReason === n.blockReason &&
    p.isSpecialling === n.isSpecialling &&
    p.observation === n.observation &&
    p.isHdu === n.isHdu &&
    p.age === n.age &&
    p.sex === n.sex &&
    p.legalStatusLabel === n.legalStatusLabel &&
    p.criteriaLedChip?.label === n.criteriaLedChip?.label &&
    p.tentativeDiagnosis === n.tentativeDiagnosis &&
    p.notes === n.notes &&
    p.isPlannedAdmission === n.isPlannedAdmission &&
    p.isLeave === n.isLeave &&
    p.dischargeDateMoves === n.dischargeDateMoves
  );
}

const WardBedCard = React.memo(function WardBedCard({ bed, isSelected, onSelect }: WardBedCardProps) {
  const stayDaysNum = typeof bed.stayDays === "number" ? bed.stayDays : null;
  const isPastDate = bed.pastDate === true;
  const isReady = bed.status === "ready";
  const isClosed = bed.status === "closed" || bed.isClosed === true;
  const isPulled = bed.status === "incoming" || bed.isPulled === true;
  const isAwayAtEd = bed.awayAtEdHours !== null && bed.awayAtEdHours !== undefined;
  const signal = bed.patientAlias || isAwayAtEd ? cardSignal(bed, isPastDate, isAwayAtEd) : null;
  const eddMoved = bed.patientAlias && !isReady ? eddMovedBadge(bed.dischargeDateMoves) : null;
  const criteriaLed = bed.patientAlias && !isReady && !isPulled ? (bed.criteriaLedChip ?? null) : null;

  // Color tint band class based on stay duration
  let bandClass = "";
  if (stayDaysNum !== null && !isReady) {
    if (stayDaysNum < 14) bandClass = styles.band1;
    else if (stayDaysNum < 30) bandClass = styles.band2;
    else if (stayDaysNum < 90) bandClass = styles.band3;
    else bandClass = styles.band4;
  }

  const cardClasses = [
    styles.bedCard,
    bandClass,
    isPastDate ? styles.pastDate : "",
    isSelected ? styles.selected : "",
    isReady ? styles.ready : "",
    isClosed ? styles.closed : "",
    isPulled ? styles.pulled : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = useCallback(() => {
    onSelect(bed);
  }, [onSelect, bed]);

  return (
    <button
      type="button"
      className={cardClasses}
      data-testid={`ward-bed-card-${bed.bedNumber}`}
      data-admission-id={bed.admissionId}
      data-state={bed.status as string}
      onClick={handleClick}
      aria-label={formatBedAriaLabel(bed, eddMoved)}
    >
      <div className={styles.bedTopRow}>
        {bed.patientAlias && !isPulled ? (
          <span className={styles.bedPatientName}>{bed.patientAlias}</span>
        ) : (
          <span className={styles.bedStatePill}>
            {isReady ? "Ready" : isClosed ? "Closed" : isPulled ? "Pulled" : bed.statusText}
          </span>
        )}
        {stayDaysNum !== null && !isReady ? <span className={styles.bedDaysVal}>{stayDaysNum}d</span> : null}
      </div>

      {bed.patientAlias ? (
        <div className={styles.bedCardBody}>
          {isPulled ? <div className={styles.bedPatientName}>{bed.patientAlias}</div> : null}
          {cardMetaLine(bed) ? <div className={styles.bedPatientSub}>{cardMetaLine(bed)}</div> : null}
        </div>
      ) : isReady && bed.preparing ? (
        <div className={styles.bedCardBody}>
          <div className={styles.bedPatientName}>Not offered yet</div>
          <div className={styles.bedPatientSub}>Being made ready</div>
        </div>
      ) : isReady ? (
        <div className={styles.bedCardBody}>
          <div className={styles.bedPatientName}>Offered</div>
          <div className={styles.bedPatientSub}>Ready; cleaning completion not recorded</div>
        </div>
      ) : isClosed ? (
        <div className={styles.bedCardBody}>
          <div className={styles.bedPatientName}>Not offered</div>
        </div>
      ) : isPulled ? (
        <div className={styles.bedCardBody}>
          <div className={styles.bedPatientName}>Given away</div>
        </div>
      ) : (
        <div className={styles.bedCardBody}>
          <div className={styles.bedPatientSub}>{isAwayAtEd ? "Bed held" : "Empty"}</div>
        </div>
      )}

      {signal || eddMoved || criteriaLed ? (
        <div className={styles.bedBottomTags}>
          {signal ? (
            <span className={isPastDate ? styles.badgePastDate : isAwayAtEd ? styles.badgeAtEd : styles.bedCardChip}>
              {signal}
            </span>
          ) : null}
          {eddMoved ? (
            <span className={styles.bedCardChip} data-testid="ward-bed-edd-moved">
              {eddMoved}
            </span>
          ) : null}
          {criteriaLed ? (
            <span
              className={cx(
                styles.bedCardChip,
                criteriaLed.tone === "success" && styles.chipGood,
                criteriaLed.tone === "warning" && styles.chipWarn,
              )}
              data-testid="ward-bed-criteria-led"
            >
              {criteriaLed.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}, areBedCardPropsEqual);

export function WardBedsMatrix({
  unit,
  bedsList,
  selectedBed,
  setSelectedBed,
  selectedPod,
  setSelectedPod,
  isMixed,
}: WardBedsMatrixProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "needs-look" | "ready" | "nobody-due">("all");
  const [sortBy, setSortBy] = useState<"stay" | "room" | "attention">("stay");
  const [shiftGroup, setShiftGroup] = useState<ShiftGroup>("all");

  // Optional: matrix chrome still renders in isolated tests without a provider.
  const bedReleasesList = useOptionalWardFlowSelect("bedReleases")?.bedReleases ?? [];
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleasesList);

  // Filter by pod / locked / open
  const podFilteredBeds = useMemo(
    () => (selectedPod === "all" ? bedsList : bedsList.filter((bed) => bed.podId === selectedPod)),
    [bedsList, selectedPod],
  );

  // Specific counts
  const readyCount = useMemo(() => bedsList.filter((b) => b.status === "ready").length, [bedsList]);
  const lockedCount = useMemo(() => bedsList.filter((b) => b.podId === "locked").length, [bedsList]);
  const openCount = useMemo(() => bedsList.filter((b) => b.podId === "open").length, [bedsList]);

  const needsLookBeds = useMemo(
    () =>
      podFilteredBeds.filter(
        (b) =>
          b.pastDate === true ||
          (b.awayAtEdHours !== null && b.awayAtEdHours !== undefined) ||
          b.isSpecialling === true ||
          b.isHdu === true ||
          b.status === "leave" ||
          b.status === "incoming" ||
          b.blockReason != null,
      ),
    [podFilteredBeds],
  );

  const nobodyDueOutBeds = useMemo(
    () => podFilteredBeds.filter((b) => b.expectedDays == null && b.status !== "ready"),
    [podFilteredBeds],
  );

  // Apply quick filter pills
  const filteredBeds = useMemo(() => {
    if (activeFilter === "needs-look") return needsLookBeds;
    if (activeFilter === "ready") return podFilteredBeds.filter((b) => b.status === "ready");
    if (activeFilter === "nobody-due") return nobodyDueOutBeds;
    return podFilteredBeds;
  }, [activeFilter, needsLookBeds, nobodyDueOutBeds, podFilteredBeds]);

  // Apply sorting
  const sortedBeds = useMemo(() => {
    const list = [...filteredBeds];
    if (sortBy === "stay") {
      return list.sort((a, b) => {
        const aStay = typeof a.stayDays === "number" ? a.stayDays : -1;
        const bStay = typeof b.stayDays === "number" ? b.stayDays : -1;
        return bStay - aStay;
      });
    }
    if (sortBy === "attention") {
      return list.sort((a, b) => {
        const aAtt = a.pastDate ? 2 : a.awayAtEdHours != null ? 1 : 0;
        const bAtt = b.pastDate ? 2 : b.awayAtEdHours != null ? 1 : 0;
        return bAtt - aAtt;
      });
    }
    // Default room number
    return list.sort((a, b) => {
      const aNum = typeof a.bedNumber === "number" ? a.bedNumber : Number(a.bedNumber) || 0;
      const bNum = typeof b.bedNumber === "number" ? b.bedNumber : Number(b.bedNumber) || 0;
      return aNum - bNum;
    });
  }, [filteredBeds, sortBy]);

  const handleBedClick = useCallback(
    (bed: BedItem) => {
      setSelectedBed(typeof bed.bedNumber === "number" ? bed.bedNumber : Number(bed.bedNumber) || null);
    },
    [setSelectedBed],
  );

  // Group beds into Bays (4 beds per bay) for scannable layout and test contract compatibility
  const bays = useMemo(() => {
    const grouped: Array<{ title: string; beds: BedItem[] }> = [];
    for (let i = 0; i < sortedBeds.length; i += 4) {
      const bayNum = Math.floor(i / 4) + 1;
      const slice = sortedBeds.slice(i, i + 4);
      const title = `Bed group ${bayNum} (Beds ${slice[0]?.bedLabel ?? ""} – ${slice[slice.length - 1]?.bedLabel ?? ""})`;
      grouped.push({ title, beds: slice });
    }
    return grouped;
  }, [sortedBeds]);

  // Derive shift items dynamically from the unit's recorded bed items
  const shiftItems = useMemo(() => {
    const items: Array<{
      key: string;
      group: Exclude<ShiftGroup, "all">;
      bedNumber: number;
      title: string;
      badge: string;
      badgeTone: "danger" | "warn" | "info" | "purple";
      tag: string;
      desc: string;
      actions: Array<{ label: string; primary: boolean }>;
      borderTone: "danger" | "warn" | "info" | "purple";
    }> = [];

    for (const bed of bedsList) {
      const bedNumber = typeof bed.bedNumber === "number" ? bed.bedNumber : Number(bed.bedNumber);
      if (!Number.isFinite(bedNumber) || bedNumber <= 0) continue;
      // Due out means the discharge date has arrived or passed. A discharge confirmed for a later day is
      // not "needs you this shift" yet, matching the ward board's own due-out list.
      const isDueOut = bed.pastDate === true || (typeof bed.expectedDays === "number" && bed.expectedDays <= 0);

      if (bed.awayAtEdHours != null || bed.status === "leave") {
        const atEd = bed.awayAtEdHours != null;
        const isAwol = !atEd && bed.statusText === "Absent without leave";
        const tone = isAwol ? "danger" : "info";
        items.push({
          key: `shift-off-${bed.bedLabel}-${bedNumber}`,
          group: "off-ward",
          bedNumber,
          title: atEd ? "Away at an ED" : isAwol ? "Absent without leave" : "On leave",
          badge: atEd ? (bed.awayAtEdHours! >= 4 ? "Still at ED" : "Away at ED") : bed.statusText || "On leave",
          badgeTone: tone,
          tag: atEd && bed.awayAtEdHours! >= 4 ? "Left earlier" : "Just left",
          desc: atEd
            ? "Patient at ED. Bed still held for them."
            : `${bed.patientAlias ?? "Patient"} away from ${unit.name}. Bed still held for them.`,
          actions: [{ label: "Mark them back", primary: false }],
          borderTone: tone,
        });
      } else if (bed.status === "incoming" || bed.isPulled === true) {
        const person = bed.patientAlias ?? "incoming transfer";
        items.push({
          key: `shift-transit-${bed.bedLabel}-${bedNumber}`,
          group: "in-transit",
          bedNumber,
          title: "Pulled bed",
          badge: "In transit",
          badgeTone: "purple",
          tag: "Pulled earlier",
          desc: `Pulled for ${person}; taken, not yet arrived.`,
          actions: [{ label: "See the move", primary: false }],
          borderTone: "purple",
        });
      } else if (isDueOut && bed.status !== "ready" && bed.status !== "closed") {
        const overdueDays =
          typeof bed.expectedDays === "number" && bed.expectedDays < 0 ? Math.abs(bed.expectedDays) : null;
        const confirmed = bed.dischargeConfirmed === true;
        const isOverdue = Boolean(overdueDays) || bed.pastDate === true;
        const badge = overdueDays ? `${overdueDays}d overdue` : bed.pastDate ? "Past date" : "Due today";
        const statusPhrase = isOverdue
          ? `${confirmed ? "Confirmed" : "Expected"} discharge overdue`
          : `${confirmed ? "Confirmed" : "Expected"} out today`;
        items.push({
          key: `shift-due-${bed.bedLabel}-${bedNumber}`,
          group: "due-out",
          bedNumber,
          title: confirmed ? "Confirmed discharge" : "Expected discharge",
          badge,
          badgeTone: confirmed ? "warn" : "danger",
          tag: "Discharge",
          desc: `${statusPhrase}, still here.${bed.blockReason ? ` ${bed.blockReason}.` : ""}`,
          actions: [
            { label: "They have left", primary: false },
            { label: bed.blockReason ? "Update blocker" : "Record a blocker", primary: false },
          ],
          borderTone: confirmed ? "warn" : "danger",
        });
      }
    }

    return items;
  }, [bedsList, unit.name]);

  const dueOutCount = shiftItems.filter((item) => item.group === "due-out").length;
  const offWardCount = shiftItems.filter((item) => item.group === "off-ward").length;
  const inTransitCount = shiftItems.filter((item) => item.group === "in-transit").length;
  const visibleShiftItems = shiftGroup === "all" ? shiftItems : shiftItems.filter((item) => item.group === shiftGroup);

  return (
    <div className={styles.matrixWrap}>
      <section className={styles.shiftBanner} aria-label="Shift actions and alerts">
        <div className={styles.shiftBannerHead}>
          <div className={styles.shiftTitleGroup}>
            <span className={styles.shiftTitle}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5v3.5l2.5 1.5" />
              </svg>
              Needs you this shift
            </span>
            <span className={styles.shiftSubtitle}>
              {visibleShiftItems.length} of {shiftItems.length} before handover at {formatInstant(DAY_SHIFT_END_MINUTE)}
            </span>
          </div>

          <div className={styles.segment} role="group" aria-label="Shift actions">
            {(
              [
                ["all", "All", shiftItems.length],
                ["due-out", "Due out", dueOutCount],
                ["off-ward", "Off the ward", offWardCount],
                ["in-transit", "In transit", inTransitCount],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                className={styles.segmentBtn}
                aria-pressed={shiftGroup === id}
                onClick={() => {
                  setShiftGroup(id);
                }}
              >
                <span>{label}</span>
                <span className={styles.segmentCount}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {visibleShiftItems.length === 0 ? (
          <div className={styles.shiftEmptyNotice}>
            <span>Nothing in this group right now.</span>
          </div>
        ) : (
          <div className={styles.shiftDenseGrid}>
            {visibleShiftItems.map((item) => (
              <div key={item.key} className={styles.shiftTileCompact} data-tone={item.borderTone}>
                <div className={styles.shiftTileTop}>
                  <div className={styles.shiftTagGroup}>
                    <span className={styles.shiftKindPill}>{item.title}</span>
                    <span
                      className={`${styles.shiftStatusBadge} ${
                        item.badgeTone === "danger"
                          ? styles.badgeDanger
                          : item.badgeTone === "warn"
                            ? styles.badgeWarn
                            : item.badgeTone === "purple"
                              ? styles.badgePurple
                              : styles.badgeInfo
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <span className={styles.shiftTimeAgo}>{item.tag}</span>
                </div>
                <div className={styles.shiftTileBody}>
                  <div className={styles.shiftTextLine}>{item.desc}</div>
                  <div className={styles.shiftTileActions}>
                    {item.actions.map((act) => (
                      <button
                        key={act.label}
                        type="button"
                        className={styles.btnShiftAction}
                        onClick={() => {
                          setSelectedBed(item.bedNumber);
                        }}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
         BEDS SECTION: HEADER & FILTER CONTROLS BAR (IMAGE 1 ENHANCED)
         ───────────────────────────────────────────────────────────── */}
      <section className={styles.bedsSection} aria-label="Ward Bed Grid and Capacity">
        <div className={styles.matrixHead}>
          <div className={styles.headingGroup}>
            <h2 className={styles.title}>Every bed, and who is in it</h2>
            <p className={styles.subtitle}>
              Showing {sortedBeds.length} of {unit.beds} beds
            </p>
            <span className="sr-only">{pendingPreparation} still being made ready</span>
          </div>

          <div className={styles.segment} role="group" aria-label="Sort beds order">
            <span className={styles.segmentLabel}>Order</span>
            {(
              [
                ["stay", "Longest stay"],
                ["room", "Room number"],
                ["attention", "Needs attention"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={styles.segmentBtn}
                aria-pressed={sortBy === id}
                onClick={() => {
                  setSortBy(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.bedsControlsBar}>
          <div className={styles.segment} role="group" aria-label="Filter beds">
            <button
              type="button"
              className={styles.segmentBtn}
              aria-pressed={activeFilter === "all" && selectedPod === "all"}
              onClick={() => {
                setActiveFilter("all");
                setSelectedPod("all");
              }}
            >
              <span>All beds ({unit.beds})</span>
            </button>

            <button
              type="button"
              className={styles.segmentBtn}
              aria-pressed={activeFilter === "needs-look"}
              onClick={() => {
                setActiveFilter("needs-look");
              }}
            >
              <span>Needs a look</span>
              <span className={styles.segmentCount}>{needsLookBeds.length}</span>
            </button>

            <button
              type="button"
              className={styles.segmentBtn}
              aria-pressed={activeFilter === "ready"}
              onClick={() => {
                setActiveFilter("ready");
              }}
            >
              <span>Ready</span>
              <span className={styles.segmentCount}>{readyCount}</span>
            </button>

            <button
              type="button"
              className={styles.segmentBtn}
              aria-pressed={activeFilter === "nobody-due"}
              onClick={() => {
                setActiveFilter("nobody-due");
              }}
            >
              <span>Nobody due out</span>
              <span className={styles.segmentCount}>{nobodyDueOutBeds.length}</span>
            </button>

            {isMixed ? (
              <>
                <button
                  type="button"
                  className={styles.segmentBtn}
                  aria-pressed={selectedPod === "locked"}
                  onClick={() => {
                    setSelectedPod("locked");
                  }}
                >
                  <span>Locked</span>
                  <span className={styles.segmentCount}>{lockedCount}</span>
                </button>
                <button
                  type="button"
                  className={styles.segmentBtn}
                  aria-pressed={selectedPod === "open"}
                  onClick={() => {
                    setSelectedPod("open");
                  }}
                >
                  <span>Open</span>
                  <span className={styles.segmentCount}>{openCount}</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        <p className={styles.positionCaption} data-testid="ward-beds-position-caption">
          Bed numbers show position on this board; no bed number is recorded for anyone.
        </p>

        {/* ─────────────────────────────────────────────────────────────
           BAYS CONTAINER & CONTIGUOUS 20-BED GRID (IMAGE 1 ENHANCED)
           ───────────────────────────────────────────────────────────── */}
        {bays.length === 0 ? (
          <div className={styles.shiftEmptyNotice} role="status">
            <span>No beds match the selected filter.</span>
            {(activeFilter !== "all" || selectedPod !== "all") && (
              <button
                type="button"
                className={`${styles.btnShiftAction} ${styles.resetButton}`}
                onClick={() => {
                  setActiveFilter("all");
                  setSelectedPod("all");
                }}
              >
                Show all beds
              </button>
            )}
          </div>
        ) : (
          bays.map((bay, idx) => (
            <div
              key={bay.beds[0] ? `bay-${bay.beds[0].bedNumber}` : `bay-empty-${idx}`}
              className={`${styles.bayContainer} ${selectedPod === "all" ? styles.compactBay : ""}`}
            >
              {selectedPod !== "all" ? (
                <div className={styles.bayHeader}>
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="12" height="12" rx="2" />
                  </svg>
                  <span>{bay.title}</span>
                </div>
              ) : null}
              <div className={styles.bayBedsGrid}>
                {bay.beds.map((bed) => (
                  <WardBedCard
                    key={bed.bedNumber}
                    bed={bed}
                    isSelected={selectedBed === bed.bedNumber}
                    onSelect={handleBedClick}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {/* ─────────────────────────────────────────────────────────────
           FOOTER NOTES, CENSUS & ACCESSIBLE LEGEND
           ───────────────────────────────────────────────────────────── */}
        <div className={styles.bedsFooterNotes}>
          <div className={styles.bedKeyLegend} role="group" aria-label="Bed stay bands and symbol key">
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotBand1}`} />
              <span>Under 2 weeks</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotBand2}`} />
              <span>2 weeks – 1 month</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotBand3}`} />
              <span>1–3 months</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotBand4}`} />
              <span>Over 3 months</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.badgePastDate}>Past date</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} data-kind="closed" />
              <span>Out of service</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.legendSwatch} data-kind="unoffered" />
              <span>Not offered</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
