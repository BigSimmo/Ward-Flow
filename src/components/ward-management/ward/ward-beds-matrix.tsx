"use client";

import React, { useMemo, useState } from "react";
import styles from "./ward-beds-matrix.module.css";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";

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
  const [quietShiftPreview, setQuietShiftPreview] = useState(false);

  let bedReleasesList: BedRelease[] = [];
  try {
    const wf = useWardFlow();
    if (wf?.bedReleases) bedReleasesList = wf.bedReleases;
  } catch {
    // Isolated tests without provider
  }
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
        bedNumber: 6,
        title: "Away at an ED",
        badge: "1h away",
        badgeTone: "info",
        tag: "1h ago",
        desc: "Patient at ED. Bed still held for them.",
        actions: [{ label: "Mark them back", primary: false }],
        borderTone: "info",
      },
      {
        key: "shift-5",
        bedNumber: 7,
        title: "Away at an ED",
        badge: "6h away",
        badgeTone: "info",
        tag: "6h ago",
        desc: "Patient at ED. Bed still held for them.",
        actions: [{ label: "Mark them back", primary: false }],
        borderTone: "info",
      },
      {
        key: "shift-6",
        bedNumber: 3,
        title: "Pulled bed",
        badge: "13h travelling",
        badgeTone: "purple",
        tag: "13h ago",
        desc: "Pulled for Hazelle Ferrowmoor; taken, not yet arrived.",
        actions: [{ label: "View Transit", primary: false }],
        borderTone: "purple",
      },
      {
        key: "shift-7",
        bedNumber: 18,
        title: "Pulled bed",
        badge: "6h travelling",
        badgeTone: "purple",
        tag: "6h ago",
        desc: "Pulled for Bramwen Ferrowmoor; taken, not yet arrived.",
        actions: [{ label: "View Transit", primary: false }],
        borderTone: "purple",
      },
    ];
  }, []);

  return (
    <div className={styles.matrixWrap}>
      {/* ─────────────────────────────────────────────────────────────
         COMPACT "NEEDS YOU THIS SHIFT" STRIP (IMAGE 4 COMPACTED)
         ───────────────────────────────────────────────────────────── */}
      <section className={styles.shiftBanner} aria-label="Shift actions and alerts">
        <div className={styles.shiftBannerHead}>
          <div className={styles.shiftTitleGroup}>
            <span className={styles.shiftTitle}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5v3.5l2.5 1.5" />
              </svg>
              NEEDS YOU THIS SHIFT
            </span>
            <span className={styles.shiftSubtitle}>
              {quietShiftPreview
                ? "0 actions pending"
                : `${shiftItems.length} clinical and bed flow actions required before handover at 15:30`}
            </span>
          </div>

          <div className={styles.shiftToggleGroup} role="group" aria-label="Shift action view mode">
            <button
              type="button"
              className={`${styles.shiftToggleBtn} ${!quietShiftPreview ? styles.active : ""}`}
              onClick={() => setQuietShiftPreview(false)}
            >
              This shift ({shiftItems.length})
            </button>
            <button
              type="button"
              className={`${styles.shiftToggleBtn} ${quietShiftPreview ? styles.active : ""}`}
              onClick={() => setQuietShiftPreview(true)}
            >
              Preview: quiet shift
            </button>
          </div>
        </div>

        {quietShiftPreview ? (
          <div className={styles.shiftEmptyNotice}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l3 3 7-7" />
            </svg>
            <span>All shift actions cleared &middot; Ward running smoothly with zero flow bottlenecks</span>
          </div>
        ) : (
          <div className={styles.shiftDenseGrid}>
            {shiftItems.map((item) => (
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
                <div className={styles.shiftTextLine}>{item.desc}</div>
                <div className={styles.shiftTileActions}>
                  {item.actions.map((act, i) => (
                    <button
                      key={i}
                      type="button"
                      className={styles.btnShiftAction}
                      onClick={() => setSelectedBed(item.bedNumber)}
                    >
                      {act.label}
                    </button>
                  ))}
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

          <label className={styles.orderSelectLabel}>
            <span>Order</span>
            <select
              className={styles.orderSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "stay" | "room" | "attention")}
              aria-label="Sort beds order"
            >
              <option value="stay">Longest stay first</option>
              <option value="room">Room number</option>
              <option value="attention">Attention needed</option>
            </select>
          </label>
        </div>

        {/* Controls Bar: Filter Pills */}
        <div className={styles.bedsControlsBar}>
          <div className={styles.filterPillsGroup} role="group" aria-label="Filter beds">
            {/* Preserved test contract button: All beds ({unit.beds}) */}
            <button
              type="button"
              className={`${styles.filterPillBtn} ${activeFilter === "all" && selectedPod === "all" ? styles.active : ""}`}
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
              className={`${styles.filterPillBtn} ${activeFilter === "needs-look" ? styles.active : ""}`}
              aria-pressed={activeFilter === "needs-look"}
              onClick={() => setActiveFilter("needs-look")}
            >
              <span>Needs a look</span>
              <span className={styles.filterPillCount}>{needsLookBeds.length}</span>
            </button>

            <button
              type="button"
              className={`${styles.filterPillBtn} ${activeFilter === "ready" ? styles.active : ""}`}
              aria-pressed={activeFilter === "ready"}
              onClick={() => setActiveFilter("ready")}
            >
              <span>Ready</span>
              <span className={styles.filterPillCount}>{readyCount}</span>
            </button>

            <button
              type="button"
              className={`${styles.filterPillBtn} ${activeFilter === "nobody-due" ? styles.active : ""}`}
              aria-pressed={activeFilter === "nobody-due"}
              onClick={() => setActiveFilter("nobody-due")}
            >
              <span>Nobody due out</span>
              <span className={styles.filterPillCount}>{nobodyDueOutBeds.length}</span>
            </button>

            {isMixed ? (
              <>
                <button
                  type="button"
                  className={styles.filterPillBtn}
                  aria-pressed={selectedPod === "locked"}
                  onClick={() => setSelectedPod("locked")}
                >
                  Locked ({lockedCount})
                </button>
                <button
                  type="button"
                  className={styles.filterPillBtn}
                  aria-pressed={selectedPod === "open"}
                  onClick={() => setSelectedPod("open")}
                >
                  Open ({openCount})
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Preserved test contract position caption */}
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
                    data-state={bed.status}
                    onClick={() => handleBedClick(bed)}
                    aria-label={`${bed.bedLabel} ${bed.statusText} ${bed.patientAlias ?? ""}`.trim()}
                  >
                    <div className={styles.bedTopRow}>
                      <span className={styles.bedStatePill}>
                        {isReady ? "READY" : isClosed ? "CLOSED" : isPulled ? "PULLED" : "OCCUPIED"}
                      </span>
                      <span className={styles.bedDaysVal}>
                        {isReady ? "" : stayDaysNum !== null ? `${stayDaysNum} DAYS` : (bed.daysInBed ?? "")}
                      </span>
                    </div>

                    {bed.patientAlias ? (
                      <div>
                        <div className={styles.bedPatientInfo}>
                          {bed.sex ?? "Patient"} &middot; {bed.homeRegion ?? "Perth Metropolitan"}
                        </div>
                        <div className={styles.bedStayBandLabel}>
                          {bed.stayBand ??
                            (stayDaysNum
                              ? stayDaysNum < 14
                                ? "Under 2 weeks"
                                : stayDaysNum < 30
                                  ? "2 weeks – 1 month"
                                  : stayDaysNum < 90
                                    ? "1–3 months"
                                    : "Over 3 months"
                              : "Acute stay")}
                        </div>
                      </div>
                    ) : isReady ? (
                      <div>
                        <div className={styles.bedPatientInfo} style={{ color: "var(--good)" }}>
                          Empty and offered.
                        </div>
                        <div className={styles.bedPatientSub}>Ready; cleaning completion not recorded</div>
                      </div>
                    ) : isClosed ? (
                      <div>
                        <div className={styles.bedPatientInfo} style={{ color: "var(--warn)" }}>
                          Empty, not offered.
                        </div>
                        <div className={styles.bedPatientSub}>Unfillable</div>
                      </div>
                    ) : isPulled ? (
                      <div>
                        <div className={styles.bedPatientInfo}>The ward has already given this bed away.</div>
                        <div className={styles.bedPatientSub}>Allocated</div>
                      </div>
                    ) : (
                      <div>
                        <div className={styles.bedPatientInfo} style={{ color: "var(--muted)" }}>
                          {bed.statusText}
                        </div>
                        <div className={styles.bedPatientSub}>
                          {isAwayAtEd ? `At ED (${bed.awayAtEdHours}h) · Bed held` : "Unoccupied"}
                        </div>
                      </div>
                    )}

                    <div className={styles.bedBottomTags}>
                      {isPastDate && <span className={styles.badgePastDate}>▲ PAST DATE</span>}
                      {isAwayAtEd && <span className={styles.badgeAtEd}>◆ AT ED</span>}
                      {isSelected && <span className={styles.badgeSelected}>SELECTED</span>}
                      {isPulled && <span className={styles.badgePulled}>Allocated</span>}
                      {isClosed && <span className={styles.badgeClosed}>Unfillable</span>}
                      {isReady && <span className={styles.badgeReady}>Fillable Now</span>}
                      {bed.isSpecialling && <span className={styles.bedCardChip}>1:1 Watch</span>}
                      {bed.isHdu && <span className={styles.bedCardChip}>HDU</span>}
                    </div>
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
          <div className={styles.censusSummaryText}>
            18 of this ward&apos;s 20 beds are taken. Longest stay first; beds without a recorded stay follow recorded
            order.
          </div>
          <div className={styles.tentativeDisclaimer}>
            Any diagnosis shown is tentative: a broad category, not a diagnosis this ward has confirmed.
          </div>

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
              <span className={styles.badgePastDate}>▲ Past the ward&apos;s own expected date</span>
            </div>
            <div className={styles.legendItem}>
              <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--line-strong)" }} />
              <span>Out of service &mdash; not fillable</span>
            </div>
            <div className={styles.legendItem}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: "1px solid var(--warn)",
                }}
              />
              <span>Empty, not offered &mdash; not fillable</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
