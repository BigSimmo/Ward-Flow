"use client";

import { Clock, ChevronRight } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import styles from "./ward-beds-matrix.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { StatusGlyph, cx, type WfTone } from "@/components/wf";
import { bedGlyphTone, eddMovedBadge, type BedItem } from "./ward-bed-tone";
import { observationRatio, observationSummary } from "@/components/ward-management/ward-observation";
import { plural } from "@/components/ward-management/ward-plural";

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
  if (bed.stayDays !== undefined && bed.stayDays !== null)
    parts.push(`${bed.stayDays} ${bed.stayDays === 1 ? "day" : "days"} in bed`);
  if (bed.pastDate) parts.push("Past expected discharge date");
  if (bed.isSpecialling && bed.observation) parts.push(`${observationSummary(bed.observation)} active`);
  if (bed.awayAtEdHours !== null && bed.awayAtEdHours !== undefined)
    parts.push(`Away at ED for ${bed.awayAtEdHours} ${bed.awayAtEdHours === 1 ? "hour" : "hours"}`);
  if (bed.legalStatusLabel) parts.push(bed.legalStatusLabel);
  if (bed.criteriaLedChip) parts.push(bed.criteriaLedChip.phrase);
  if (bed.blockReason) parts.push(`Held up: ${bed.blockReason}`);
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
  return `Expected out in ${plural(bed.expectedDays, "day", "days")}`;
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

/** The count tiles above the full bed list, each one a filter (WH6). */
type BedListFilter = "all" | "needs-look" | "past-date" | "away" | "ready" | "nobody-due";

function isPastTheirDate(bed: BedItem): boolean {
  return bed.pastDate === true || (typeof bed.expectedDays === "number" && bed.expectedDays < 0);
}

/** Someone has arrived in the bed: a pulled bed's person is not here yet. */
function isPerson(bed: BedItem): boolean {
  return Boolean(bed.patientAlias) && bed.status !== "incoming" && bed.isPulled !== true;
}

function isAwayFromWard(bed: BedItem): boolean {
  return bed.status === "leave" || bed.awayAtEdHours != null;
}

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
    p.closedReview === n.closedReview &&
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
    p.dischargeDateMoves === n.dischargeDateMoves &&
    p.eddDriftDays === n.eddDriftDays &&
    p.dischargeConfirmed === n.dischargeConfirmed &&
    p.expectedDischargeLabel === n.expectedDischargeLabel &&
    p.dischargeBarrier === n.dischargeBarrier &&
    p.umrn === n.umrn &&
    p.homeRegion === n.homeRegion &&
    p.catchmentCommunityTeam === n.catchmentCommunityTeam &&
    p.heldFor === n.heldFor &&
    p.bedHold === n.bedHold
  );
}

/** Stay bar scale: four months fills the bar, so a long stay reads long without a colour band. */
const STAY_BAR_DAYS = 120;

/** When the person is expected out, in words, with its tone: past the date reads first. */
function leavingCell(bed: BedItem): { text: string; tone: "danger" | "warning" | "info" | null } | null {
  if (bed.status === "ready" || bed.patientAlias == null) return null;
  const overdue = typeof bed.expectedDays === "number" && bed.expectedDays < 0 ? Math.abs(bed.expectedDays) : null;
  // Red is act now only (DESIGN-SYSTEM): past the date is amber, as on the bed tile and panel.
  if (overdue) return { text: `${plural(overdue, "day", "days")} past`, tone: "warning" };
  if (bed.pastDate === true) return { text: "Past the ward's date", tone: "warning" };
  if (typeof bed.expectedDays !== "number") return null;
  if (bed.expectedDays === 0) return { text: "Today", tone: "warning" };
  if (bed.expectedDays === 1) return { text: "Tomorrow", tone: "info" };
  return { text: `In ${plural(bed.expectedDays, "day", "days")}`, tone: bed.expectedDays <= 2 ? "info" : null };
}

const WardBedCard = React.memo(function WardBedCard({ bed, isSelected, onSelect }: WardBedCardProps) {
  const stayDaysNum = typeof bed.stayDays === "number" ? bed.stayDays : null;
  const isPastDate = bed.pastDate === true;
  const isReady = bed.status === "ready";
  const isClosed = bed.status === "closed" || bed.isClosed === true;
  const isPulled = bed.status === "incoming" || bed.isPulled === true;
  const isAwayAtEd = bed.awayAtEdHours !== null && bed.awayAtEdHours !== undefined;
  const signal = bed.patientAlias || isAwayAtEd ? cardSignal(bed, isPastDate, isAwayAtEd) : null;
  const eddMoved = bed.patientAlias && !isReady ? eddMovedBadge(bed.dischargeDateMoves, bed.eddDriftDays) : null;
  const criteriaLed = bed.patientAlias && !isReady && !isPulled ? (bed.criteriaLedChip ?? null) : null;
  const tone: WfTone | null = bedGlyphTone(bed);
  const leaving = leavingCell(bed);
  const meta = cardMetaLine(bed);
  const umrn = bed.umrn ?? bed.patientInfo?.umrn;
  const number = String(bed.bedNumber).padStart(2, "0");
  // The "now" chip repeats nothing the leaving column already says.
  const nowChip = signal && signal !== "Past date" && !signal.startsWith("Out ") ? signal : null;

  const handleClick = useCallback(() => {
    onSelect(bed);
  }, [onSelect, bed]);

  let who: React.ReactNode;
  if (bed.patientAlias) {
    who = (
      <>
        <span className={styles.rowName}>{bed.patientAlias}</span>
        <span className={styles.rowSub}>
          {isPulled
            ? "Pulled for them, not yet arrived"
            : [meta, umrn].filter(Boolean).join(" · ") || "Details not recorded"}
        </span>
      </>
    );
  } else if (isReady && bed.preparing) {
    who = (
      <>
        <span className={styles.rowName}>Not offered yet</span>
        <span className={styles.rowSub}>Being made ready</span>
      </>
    );
  } else if (isReady) {
    who = (
      <>
        <span className={styles.rowName}>{bed.heldFor ? `Held for ${bed.heldFor}` : "Offered"}</span>
        <span className={styles.rowSub}>Ready; cleaning completion not recorded</span>
      </>
    );
  } else if (isClosed) {
    who = (
      <>
        <span className={styles.rowName}>Not offered</span>
        <span className={styles.rowSub}>
          {bed.closedReview ? `Closed until reopened · ${bed.closedReview}` : "Closed until it is reopened"}
        </span>
      </>
    );
  } else if (isPulled) {
    who = <span className={styles.rowName}>Given away</span>;
  } else {
    who = <span className={styles.rowSub}>{isAwayAtEd ? "Bed held" : "Empty"}</span>;
  }

  return (
    <button
      type="button"
      className={cx(
        styles.bedRow,
        isSelected && styles.selected,
        isReady && styles.ready,
        isClosed && styles.closed,
        isPulled && styles.pulled,
      )}
      data-testid={`ward-bed-card-${bed.bedNumber}`}
      data-admission-id={bed.admissionId}
      data-state={bed.status as string}
      data-tone={tone ?? undefined}
      onClick={handleClick}
      aria-label={formatBedAriaLabel(bed, eddMoved)}
    >
      <span className={styles.cBed}>
        <b>{number}</b>
        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
      </span>
      <span className={styles.cWho}>{who}</span>
      <span className={styles.cLegal}>
        {bed.patientAlias && !isPulled
          ? (bed.legalStatusLabel ?? <span className={styles.muted}>Not recorded</span>)
          : null}
      </span>
      <span className={styles.cStay}>
        {stayDaysNum !== null && !isReady ? (
          <>
            <span className={styles.stayNum}>{stayDaysNum}d</span>
            <span className={styles.stayBar} aria-hidden="true">
              <i style={{ width: `${Math.max(4, Math.min(100, (stayDaysNum / STAY_BAR_DAYS) * 100))}%` }} />
            </span>
          </>
        ) : null}
      </span>
      <span className={styles.cOut}>
        {leaving ? (
          <span className={styles.outMain} data-tone={leaving.tone ?? undefined}>
            {leaving.text}
          </span>
        ) : bed.patientAlias && !isPulled && !isReady ? (
          <span className={styles.muted}>No date</span>
        ) : null}
        {bed.dischargeConfirmed === true && leaving ? <span className={styles.rowSub}>Confirmed</span> : null}
        {eddMoved ? (
          <span className={styles.rowSub} data-testid="ward-bed-edd-moved">
            {eddMoved}
          </span>
        ) : null}
      </span>
      <span className={styles.cObs}>
        {bed.patientAlias && !isPulled && bed.observation ? observationSummary(bed.observation) : null}
      </span>
      <span className={styles.cNow}>
        {nowChip ? (
          <span className={cx(styles.chip, isAwayAtEd && styles.chipWarn, bed.blockReason && styles.chipAct)}>
            {nowChip}
          </span>
        ) : null}
        {criteriaLed ? (
          <span
            className={cx(
              styles.chip,
              criteriaLed.tone === "success" && styles.chipGood,
              criteriaLed.tone === "warning" && styles.chipWarn,
            )}
            data-testid="ward-bed-criteria-led"
          >
            {criteriaLed.label}
          </span>
        ) : null}
      </span>
      <ChevronRight className={styles.chev} size={14} strokeWidth={1.75} aria-hidden="true" />
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
  now,
}: WardBedsMatrixProps) {
  const [activeFilter, setActiveFilter] = useState<BedListFilter>("all");
  const [sortBy, setSortBy] = useState<"stay" | "room" | "attention">("stay");
  const [shiftGroup, setShiftGroup] = useState<ShiftGroup>("all");

  // Optional: matrix chrome still renders in isolated tests without a provider.
  const bedReleasesList = useOptionalWardFlowSelect("bedReleases")?.bedReleases ?? [];
  // The board clock, so the handover named is the current shift's end (Audit 24-6 TC-02).
  const boardNow = useOptionalWardFlowSelect("now")?.now ?? now;
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleasesList);

  // Filter by pod / locked / open
  const podFilteredBeds = useMemo(
    () => (selectedPod === "all" ? bedsList : bedsList.filter((bed) => bed.podId === selectedPod)),
    [bedsList, selectedPod],
  );

  // Specific counts
  const lockedCount = useMemo(() => bedsList.filter((b) => b.podId === "locked").length, [bedsList]);
  const openCount = useMemo(() => bedsList.filter((b) => b.podId === "open").length, [bedsList]);

  const needsLookBeds = useMemo(
    () =>
      // The same rule as Ward home's Needs a look chip, so the two counts on one page agree: a bed
      // that is not free, past its date, away at an ED, or held up. On leave has its own tile.
      podFilteredBeds.filter(
        (b) =>
          !(b.status === "ready" && b.preparing !== true) &&
          (b.pastDate === true ||
            (b.awayAtEdHours !== null && b.awayAtEdHours !== undefined) ||
            Boolean(b.dischargeBarrier) ||
            b.blockReason != null),
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
    if (activeFilter === "past-date") return podFilteredBeds.filter((b) => isPerson(b) && isPastTheirDate(b));
    if (activeFilter === "away") return podFilteredBeds.filter(isAwayFromWard);
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
      person: string | null;
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
          person: bed.patientAlias ?? null,
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
          person: bed.patientAlias ?? null,
          title: "Pulled bed",
          badge: "In transit",
          badgeTone: "purple",
          tag: "Pulled earlier",
          desc: `Pulled for ${person}. Taken, not yet arrived.`,
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
          person: bed.patientAlias ?? null,
          title: confirmed ? "Confirmed discharge" : "Expected discharge",
          badge,
          badgeTone: confirmed ? "warn" : "danger",
          tag: "Discharge",
          desc: `${statusPhrase}, still here.${bed.blockReason ? ` ${bed.blockReason}.` : ""}`,
          actions: [
            { label: "They have left", primary: false },
            { label: bed.blockReason ? "Update hold-up" : "Record hold-up", primary: false },
          ],
          borderTone: confirmed ? "warn" : "danger",
        });
      }
    }

    return items;
  }, [bedsList, unit.name]);

  // The count tiles (WH6): what a coordinator asks first, each count the beds its press shows.
  const countTiles = useMemo(() => {
    const beds = podFilteredBeds;
    const people = beds.filter(isPerson);
    const stays = people.map((bed) => bed.stayDays).filter((days): days is number => typeof days === "number");
    const median = stays.length > 0 ? [...stays].sort((x, y) => x - y)[Math.floor(stays.length / 2)] : null;
    const longest = stays.length > 0 ? Math.max(...stays) : null;
    const pulled = beds.filter((bed) => bed.status === "incoming" || bed.isPulled === true).length;
    const closed = beds.filter((bed) => bed.status === "closed" || bed.isClosed === true).length;
    const ready = beds.filter((bed) => bed.status === "ready");
    const preparing = ready.filter((bed) => bed.preparing === true).length;
    const atEd = beds.filter((bed) => bed.awayAtEdHours != null).length;
    const tiles: Array<{ id: BedListFilter; label: string; count: number; note: string | null; tone: WfTone | null }> =
      [
        {
          id: "all",
          label: "All beds",
          count: beds.length,
          note: `${people.length} in, ${pulled} pulled, ${closed} closed`,
          tone: null,
        },
        {
          id: "needs-look",
          label: "Needs a look",
          count: needsLookBeds.length,
          note: "Something to check",
          tone: needsLookBeds.length > 0 ? "warning" : null,
        },
        {
          id: "past-date",
          label: "Past their date",
          count: people.filter(isPastTheirDate).length,
          note: longest === null ? "No stays recorded" : `Median ${median}d, longest ${longest}d`,
          tone: people.some(isPastTheirDate) ? "danger" : null,
        },
        {
          id: "away",
          label: "Away or on leave",
          count: beds.filter(isAwayFromWard).length,
          note: atEd > 0 ? `${atEd} at an ED, own bed held` : "Own bed held for them",
          tone: null,
        },
        {
          id: "ready",
          label: "Ready",
          count: ready.length,
          note: preparing > 0 ? `${preparing} being made ready` : "Free to offer now",
          tone: ready.length > 0 ? "success" : null,
        },
        {
          id: "nobody-due",
          label: "No discharge due",
          count: nobodyDueOutBeds.length,
          note: "No expected date set",
          tone: null,
        },
      ];
    return tiles;
  }, [podFilteredBeds, needsLookBeds, nobodyDueOutBeds]);

  const dueOutCount = shiftItems.filter((item) => item.group === "due-out").length;
  const offWardCount = shiftItems.filter((item) => item.group === "off-ward").length;
  const inTransitCount = shiftItems.filter((item) => item.group === "in-transit").length;
  const visibleShiftItems = shiftGroup === "all" ? shiftItems : shiftItems.filter((item) => item.group === shiftGroup);

  const shiftTone = (tone: "danger" | "warn" | "info" | "purple"): WfTone =>
    tone === "danger" ? "danger" : tone === "warn" ? "warning" : "info";

  return (
    <div className={styles.matrixWrap}>
      <section className={styles.card} aria-label="Shift actions and alerts">
        <div className={styles.cardHead}>
          <div className={styles.headText}>
            <h2 className={styles.title}>
              <Clock size={15} strokeWidth={1.75} aria-hidden="true" />
              Before handover
            </h2>
            <span className={styles.subtitle}>
              {visibleShiftItems.length} of {shiftItems.length} before handover
              {/* Audit TC2-13: with no clock there is no shift to name, so no fixed 15:00 is invented. */}
              {boardNow === undefined ? null : ` at ${formatInstantWithDay(shiftEndInstant(boardNow), boardNow)}`}
            </span>
          </div>

          <div className={styles.segment} role="group" aria-label="Shift actions">
            {(
              [
                ["all", "All", shiftItems.length],
                ["due-out", "Discharge due", dueOutCount],
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
                <span>{label}</span> <span className={styles.segmentCount}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {visibleShiftItems.length === 0 ? (
          <p className={styles.emptyNotice}>Nothing in this group right now.</p>
        ) : (
          <ul className={styles.handoverList}>
            {visibleShiftItems.map((item) => (
              <li key={item.key} className={styles.handoverRow} data-tone={item.borderTone}>
                <StatusGlyph tone={shiftTone(item.badgeTone)} size={9} />
                <span className={styles.hBed}>{String(item.bedNumber).padStart(2, "0")}</span>
                <span className={styles.hMain}>
                  <span className={styles.hTitle}>
                    <b>{item.person ?? item.title}</b>
                    <span className={styles.hKind}>{item.person ? item.title : null}</span>
                  </span>
                  <span className={styles.hDesc}>{item.desc}</span>
                </span>
                <span className={styles.hBadge} data-tone={item.badgeTone}>
                  {item.badge}
                </span>
                <span className={styles.hTag}>{item.tag}</span>
                <span className={styles.hActions}>
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
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-label="Ward Bed Grid and Capacity">
        <div className={styles.cardHead}>
          <div className={styles.headText}>
            <h2 className={styles.title}>Every bed, and who is in it</h2>
            {/* Q6 (Josh, 4 Nov 2026): the line only shows while a filter or a pod narrows the list. */}
            {activeFilter !== "all" || selectedPod !== "all" ? (
              <span className={styles.subtitle}>
                Showing {sortedBeds.length} of {unit.beds} beds
              </span>
            ) : null}
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

        {/* WH6 (Josh, 3 Nov 2026): the figures are the filters. Each raised tile counts the beds it
            shows, so a press narrows the list to exactly that number; a second press shows every bed. */}
        <div className={styles.countStrip} role="group" aria-label="Show beds" data-testid="ward-beds-count-strip">
          {countTiles.map((tile) => {
            const on = activeFilter === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                className={styles.countTile}
                aria-pressed={on}
                data-tone={tile.tone ?? undefined}
                aria-label={`${tile.label}, ${plural(tile.count, "bed", "beds")}${tile.note ? `. ${tile.note}` : ""}`}
                onClick={() => {
                  setActiveFilter(on && tile.id !== "all" ? "all" : tile.id);
                }}
              >
                <span className={styles.countLabel} aria-hidden="true">
                  {tile.tone ? <StatusGlyph tone={tile.tone} size={9} /> : null}
                  {tile.label}
                </span>
                <span className={styles.countFigure} aria-hidden="true">
                  {tile.count}
                </span>
                <span className={styles.countNote} aria-hidden="true">
                  {tile.note ?? ""}
                </span>
              </button>
            );
          })}
        </div>

        {isMixed ? (
          <div className={styles.bedsControlsBar}>
            <div className={styles.segment} role="group" aria-label="Locked or open beds">
              {(
                [
                  ["all", "Locked and open", bedsList.length],
                  ["locked", "Locked", lockedCount],
                  ["open", "Open", openCount],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  className={styles.segmentBtn}
                  aria-pressed={selectedPod === id}
                  onClick={() => {
                    setSelectedPod(id);
                  }}
                >
                  <span>{label}</span> <span className={styles.segmentCount}>{count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className={styles.positionCaption} data-testid="ward-beds-position-caption">
          Bed numbers are board positions only.
        </p>

        {bays.length === 0 ? (
          <div className={styles.emptyNotice} role="status">
            <span>No beds match the selected filter.</span>
            {(activeFilter !== "all" || selectedPod !== "all") && (
              <button
                type="button"
                className={styles.btnShiftAction}
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
          <div className={styles.table}>
            {/* Column heads for sighted readers; each row's own name carries every fact. */}
            <div className={styles.tableHead} aria-hidden="true">
              <span>Bed</span>
              <span>Person</span>
              <span>Legal</span>
              <span>Stay</span>
              <span>Expected out</span>
              <span>Observation</span>
              <span>Now</span>
              <span />
            </div>
            {bays.map((bay, idx) => (
              <div key={bay.beds[0] ? `bay-${bay.beds[0].bedNumber}` : `bay-empty-${idx}`} className={styles.bay}>
                {selectedPod !== "all" ? <div className={styles.bayHeader}>{bay.title}</div> : null}
                {bay.beds.map((bed) => (
                  <WardBedCard
                    key={bed.bedNumber}
                    bed={bed}
                    isSelected={selectedBed === bed.bedNumber}
                    onSelect={handleBedClick}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
