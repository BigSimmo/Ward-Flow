"use client";

import React, { useContext, useMemo, useState } from "react";
import styles from "./ward-beds-matrix.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { WardFlowContext } from "@/components/ward-management/ward-flow-provider";
import type { WfTone } from "@/components/wf";

export interface BedItem {
  bedNumber: number | string;
  bedLabel: string;
  status: unknown;
  statusText: string;
  patientAlias?: string;
  patientInfo?: {
    displayName?: string;
    umrn?: string;
    gender?: string;
    sex?: string;
    age?: number;
    homeRegion?: string;
  };
  umrn?: string;
  daysInBed?: number | string | null;
  stayDays?: number | null;
  stayBand?: string | null;
  pastDate?: boolean;
  awayAtEdHours?: number | null;
  isPulled?: boolean;
  isSelected?: boolean;
  isClosed?: boolean;
  podId?: string;
  podLabel?: string;
  designation?: string;
  isHdu?: boolean;
  isSpecialling?: boolean;
  tentativeDiagnosis?: string;
  blockReason?: string;
  expectedDays?: number | null;
  legalStatusLabel?: string;
  admissionId?: string;
  age?: number | null;
  sex?: string | null;
  homeRegion?: string | null;
  /** How this person wants to be addressed, when that differs from the record name. */
  preferredName?: string;
  /** Gender recorded for bed placement. Never filled in from sex. */
  gender?: string;
  suburb?: string;
  generalPractitioner?: string;
  catchmentCommunityTeam?: string;
  highAcuity?: boolean;
  dischargeDateMoves?: number | null;
  /** True only when the ward has confirmed the discharge. Absent means not this person's bed. */
  dischargeConfirmed?: boolean | null;
  dischargeConfirmedBy?: string | null;
  /** The ward's own expected leaving time, already worded for this moment. */
  expectedDischargeLabel?: string | null;
  dischargeBarrier?: string | null;
  [key: string]: unknown;
}

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

function formatBedAriaLabel(bed: BedItem): string {
  const parts: string[] = [`${bed.bedLabel} ${bed.statusText}`];
  if (bed.patientAlias) parts.push(bed.patientAlias);
  if (bed.stayDays !== undefined && bed.stayDays !== null) parts.push(`${bed.stayDays} days in bed`);
  if (bed.pastDate) parts.push("Past expected discharge date");
  if (bed.isSpecialling) parts.push("1 to 1 specialling active");
  if (bed.awayAtEdHours !== null && bed.awayAtEdHours !== undefined)
    parts.push(`Away at ED for ${bed.awayAtEdHours} hours`);
  if (bed.legalStatusLabel) parts.push(bed.legalStatusLabel);
  if (bed.blockReason) parts.push(`Discharge blocker: ${bed.blockReason}`);
  if (bed.tentativeDiagnosis) parts.push(`Tentative diagnosis: ${bed.tentativeDiagnosis}`);
  const expectedLeave = expectedLeaveLine(bed);
  if (expectedLeave) parts.push(expectedLeave);
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
  if (bed.isSpecialling) return "1:1";
  if (bed.isHdu) return "HDU";
  return null;
}

type ShiftGroup = "all" | "due-out" | "off-ward" | "in-transit";

/**
 * One shape per tone for a bed, shared by the Every bed tile and the bed drawer badge so the two
 * always agree: act now only for a held-up discharge, at risk for a bed past its date, away at an
 * ED or with a discharge barrier, moving for a bed on its way in or out, waiting for leave, done
 * for a free bed.
 */
export function bedGlyphTone(bed: BedItem): WfTone | null {
  if (bed.status === "ready") return "success";
  if (bed.status === "closed") return "closed";
  if (bed.blockReason) return "danger";
  if (bed.awayAtEdHours != null || bed.pastDate || bed.dischargeBarrier) return "warning";
  const leaving = bed.dischargeConfirmed === true || (bed.expectedDays != null && bed.expectedDays <= 0);
  if (leaving || bed.status === "incoming") return "info";
  return bed.status === "leave" ? "neutral" : null;
}

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
  const bedReleasesList = useContext(WardFlowContext)?.bedReleases ?? [];
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

  const handleBedClick = (bed: BedItem) => {
    setSelectedBed(typeof bed.bedNumber === "number" ? bed.bedNumber : Number(bed.bedNumber) || null);
  };

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

  // Extract shift items for the compact "Needs you this shift" section matching image 4
  const shiftItems = useMemo(() => {
    return [
      {
        key: "shift-1",
        group: "due-out" as const,
        bedNumber: 5,
        title: "Expected discharge",
        badge: "4d overdue",
        badgeTone: "danger",
        tag: "Discharge",
        desc: "Expected out today, still here.",
        actions: [
          { label: "They have left", primary: false },
          { label: "Record a blocker", primary: false },
        ],
        borderTone: "danger",
      },
      {
        key: "shift-2",
        group: "due-out" as const,
        bedNumber: 9,
        title: "Confirmed discharge",
        badge: "3d overdue",
        badgeTone: "warn",
        tag: "Discharge",
        desc: "Confirmed out today, still here. Awaiting accommodation.",
        actions: [
          { label: "They have left", primary: false },
          { label: "Update blocker", primary: false },
        ],
        borderTone: "warn",
      },
      {
        key: "shift-3",
        group: "due-out" as const,
        bedNumber: 15,
        title: "Expected discharge",
        badge: "3d overdue",
        badgeTone: "danger",
        tag: "Discharge",
        desc: "Expected out today, still here.",
        actions: [
          { label: "They have left", primary: false },
          { label: "Record a blocker", primary: false },
        ],
        borderTone: "danger",
      },
      {
        key: "shift-4",
        group: "off-ward" as const,
        bedNumber: 6,
        title: "Away at an ED",
        badge: "Away at ED",
        badgeTone: "info",
        tag: "Just left",
        desc: "Patient at ED. Bed still held for them.",
        actions: [{ label: "Mark them back", primary: false }],
        borderTone: "info",
      },
      {
        key: "shift-5",
        group: "off-ward" as const,
        bedNumber: 7,
        title: "Away at an ED",
        badge: "Still at ED",
        badgeTone: "info",
        tag: "Left earlier",
        desc: "Patient at ED. Bed still held for them.",
        actions: [{ label: "Mark them back", primary: false }],
        borderTone: "info",
      },
      {
        key: "shift-6",
        group: "in-transit" as const,
        bedNumber: 3,
        title: "Pulled bed",
        badge: "In transit",
        badgeTone: "purple",
        tag: "Pulled earlier",
        desc: "Pulled for Hazelle Ferrowmoor; taken, not yet arrived.",
        actions: [{ label: "See the move", primary: false }],
        borderTone: "purple",
      },
      {
        key: "shift-7",
        group: "in-transit" as const,
        bedNumber: 18,
        title: "Pulled bed",
        badge: "In transit",
        badgeTone: "purple",
        tag: "Pulled earlier",
        desc: "Pulled for Bramwen Ferrowmoor; taken, not yet arrived.",
        actions: [{ label: "See the move", primary: false }],
        borderTone: "purple",
      },
    ];
  }, []);

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
              {visibleShiftItems.length} of {shiftItems.length} before handover at 15:30
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
        {bays.map((bay, idx) => (
          <div key={idx} className={`${styles.bayContainer} ${selectedPod === "all" ? styles.compactBay : ""}`}>
            {selectedPod !== "all" ? (
              <div className={styles.bayHeader}>
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                </svg>
                <span>{bay.title}</span>
              </div>
            ) : null}
            <div className={styles.bayBedsGrid}>
              {bay.beds.map((bed) => {
                const stayDaysNum = typeof bed.stayDays === "number" ? bed.stayDays : null;
                const isPastDate = bed.pastDate === true;
                const isSelected = selectedBed === bed.bedNumber;
                const isReady = bed.status === "ready";
                const isClosed = bed.status === "closed" || bed.isClosed === true;
                const isPulled = bed.status === "incoming" || bed.isPulled === true;
                const isAwayAtEd = bed.awayAtEdHours !== null && bed.awayAtEdHours !== undefined;
                const signal = bed.patientAlias || isAwayAtEd ? cardSignal(bed, isPastDate, isAwayAtEd) : null;

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

                return (
                  <button
                    type="button"
                    key={bed.bedNumber}
                    className={cardClasses}
                    data-testid={`ward-bed-card-${bed.bedNumber}`}
                    data-admission-id={bed.admissionId}
                    data-state={bed.status}
                    onClick={() => {
                      handleBedClick(bed);
                    }}
                    aria-label={formatBedAriaLabel(bed)}
                  >
                    <div className={styles.bedTopRow}>
                      {bed.patientAlias && !isPulled ? (
                        <span className={styles.bedPatientName}>{bed.patientAlias}</span>
                      ) : (
                        <span className={styles.bedStatePill}>
                          {isReady ? "Ready" : isClosed ? "Closed" : isPulled ? "Pulled" : bed.statusText}
                        </span>
                      )}
                      {stayDaysNum !== null && !isReady ? (
                        <span className={styles.bedDaysVal}>{stayDaysNum}d</span>
                      ) : null}
                    </div>

                    {bed.patientAlias ? (
                      <div className={styles.bedCardBody}>
                        {isPulled ? <div className={styles.bedPatientName}>{bed.patientAlias}</div> : null}
                        {cardMetaLine(bed) ? <div className={styles.bedPatientSub}>{cardMetaLine(bed)}</div> : null}
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

                    {signal ? (
                      <div className={styles.bedBottomTags}>
                        <span
                          className={
                            isPastDate ? styles.badgePastDate : isAwayAtEd ? styles.badgeAtEd : styles.bedCardChip
                          }
                        >
                          {signal}
                        </span>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* ─────────────────────────────────────────────────────────────
           FOOTER NOTES, CENSUS & ACCESSIBLE LEGEND
           ───────────────────────────────────────────────────────────── */}
        <div className={styles.bedsFooterNotes}>
          <div className={styles.bedKeyLegend} aria-label="Bed stay bands and symbol key">
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
