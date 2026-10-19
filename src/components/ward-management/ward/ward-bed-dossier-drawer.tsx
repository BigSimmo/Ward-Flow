"use client";

import type { WardCommandDispatch } from "../ward-shared-client";

import React, { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import styles from "./ward-bed-dossier-drawer.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import { bedGlyphTone, eddMovedBadge, type BedItem } from "./ward-beds-matrix";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import {
  DISCHARGE_BARRIERS,
  isDischargeBarrier,
  LEAVING_DESTINATIONS,
  type DischargeBarrier,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { deriveAfternoonDischarges } from "@/components/ward-management/ward-derivations";
import { stalePreparingReleases } from "@/components/ward-management/ward-bed-availability";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { WardDischargeCriteriaCard, type DischargeCriteriaUpdate } from "./ward-discharge-criteria-card";
import {
  criteriaLedDepartureNote,
  dischargeCriteriaStatus,
  type CriteriaEligibility,
} from "@/components/ward-management/ward-discharge-criteria";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { dayOf, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import {
  Badge,
  Button,
  Icon,
  StatusGlyph,
  buttonClass,
  cx,
  durMinutes,
  useIsPhone,
  type WfTone,
} from "@/components/wf";

interface WardBedDossierDrawerProps {
  selectedBed: number;
  bedItem: BedItem | undefined;
  unit: Unit;
  onClose: () => void;
  drawerLeavingDestination: LeavingDestination;
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  onRecordLeft: (admissionId: string, who: string, destination: LeavingDestination) => void;
  onUpdateBlocker?: (admissionId: string, blocker: string | null) => void;
  onMarkAtEd?: (bedNumber: number) => void;
  onMarkBack?: (bedNumber: number) => void;
  /** Steps to the bed before this one. The arrow shows only when the parent passes it. */
  onPrevBed?: () => void;
  /** Steps to the bed after this one. The arrow shows only when the parent passes it. */
  onNextBed?: () => void;
  bedDrawerRef: React.RefObject<HTMLElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  /** Bed board (v10 pass 3): picks this stay up on the board, to place in another bed. */
  onMove?: () => void;
  /** Bed board (v10 pass 3): opens the board, where a waiting referral can be placed here. */
  onOpenBoard?: () => void;
  /** A4-24: one tap marks a vacated bed being made ready as Ready, so it is offered again. */
  onMarkReady?: () => void;
  /** Item #6: raises a pre-filled ward referral from the selected patient's bed dossier. */
  onRaiseReferral?: () => void;
  /** Item #6: deep-link to the full referral drawer pre-filled with this patient and sending site. */
  fullReferralHref?: string;
  /** Item #5a: role-locked notice with 1-click Switch to Ward desk action when not on Ward desk. */
  roleLockNote?: React.ReactNode;
  /** Top 25 item 5: records the stay's discharge barrier (`SET_DISCHARGE_BARRIER`). Absent when the role cannot. */
  onSetBarrier?: (admissionId: string, barrier: DischargeBarrier | null) => void;
  /** Top 25 item 9 (D-60): set when the criteria led discharge flag is on. */
  criteriaEligibility?: CriteriaEligibility;
  /** Records the stay's discharge criteria (`SET_DISCHARGE_CRITERIA`). Absent when the role cannot. */
  onSetCriteria?: (admissionId: string, update: DischargeCriteriaUpdate) => ReturnType<WardCommandDispatch>;
}

const VITAL_SIGNS_NOTE = "Not recorded in Ward Flow. Check the ward's own observation chart.";

type DrawerTab = "over" | "plan" | "time";
type TabButtons = Map<number, HTMLButtonElement | null>;
const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "over", label: "Overview" },
  { id: "plan", label: "Plan to leave" },
  { id: "time", label: "Timeline" },
];
const TAB_PREFIX = "bed-drawer";

function recordedBlocker(value: string | undefined): BedReleaseBlocker {
  if (value && (BED_RELEASE_BLOCKERS as readonly string[]).includes(value)) {
    return value as BedReleaseBlocker;
  }
  return BED_RELEASE_BLOCKERS[0];
}

/** The same shape the Every bed tile shows, so the badge and the tile always agree. */
function bedTone(bedItem: BedItem | undefined, isReady: boolean): WfTone | null {
  if (isReady && !bedItem?.preparing) return "success";
  return bedItem ? bedGlyphTone(bedItem) : null;
}

/** Shortens "Form 6A Involuntary inpatient" to "Form 6A" for the fact tile; the full label stays in Overview. */
function shortLegal(label: string | undefined): string {
  if (!label) return "Not recorded";
  return label.startsWith("Form ") ? label.split(" ").slice(0, 2).join(" ") : label;
}

function Row({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <>
      <dt className={styles.kvDt}>{label}</dt>
      <dd className={cx(styles.kvDd, wide && styles.kvWide)}>{children}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </section>
  );
}

function FactTile({ label, value, tone }: { label: string; value: string; tone?: WfTone | null }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <b className={styles.factValue} title={value}>
        {tone ? <StatusGlyph tone={tone} /> : null}
        <span className={styles.ell}>{value}</span>
      </b>
    </div>
  );
}

export function WardBedDossierDrawer({
  selectedBed,
  bedItem,
  unit,
  onClose,
  drawerLeavingDestination,
  setDrawerLeavingDestination,
  onRecordLeft,
  onUpdateBlocker,
  onMarkAtEd,
  onMove,
  onOpenBoard,
  onMarkReady,
  onMarkBack,
  onPrevBed,
  onNextBed,
  bedDrawerRef,
  onKeyDown,
  onRaiseReferral,
  fullReferralHref,
  roleLockNote,
  onSetBarrier,
  criteriaEligibility,
  onSetCriteria,
}: WardBedDossierDrawerProps) {
  const { admissions, bedReleases, resolvePatientIdentity } = useWardFlowSelect(
    "admissions",
    "bedReleases",
    "resolvePatientIdentity",
  );
  const now = useWardFlowClock();
  const [tab, setTab] = useState<DrawerTab>("over");
  const [quickBlockerOpen, setQuickBlockerOpen] = useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState<BedReleaseBlocker>(recordedBlocker(bedItem?.blockReason));
  const [shownBed, setShownBed] = useState(selectedBed);
  const tabRefs = useRef<TabButtons>(new Map());
  const isPhone = useIsPhone();
  const blockerSelectRef = useRef<HTMLSelectElement | null>(null);

  // Stepping to another bed keeps the open tab but drops anything half-done on the last bed.
  if (shownBed !== selectedBed) {
    setShownBed(selectedBed);
    setQuickBlockerOpen(false);
    setSelectedBlocker(recordedBlocker(bedItem?.blockReason));
  }

  useWardModalFocus(true, bedDrawerRef, onClose);

  const bedLabel = `Bed ${String(selectedBed).padStart(2, "0")}`;
  const isReady = bedItem?.status === "ready";
  // A4-24: vacated and still being made ready. Not offered until someone taps Ready.
  const isPreparing = isReady && bedItem?.preparing === true;
  const readyWord = isPreparing ? BED_STATE_LABELS.beingMadeReady : "Ready bed";
  const occupantAlias = bedItem?.patientAlias ?? "No occupant recorded";
  const isOccupied = Boolean(bedItem?.patientAlias);
  const isAwayAtEd = bedItem?.awayAtEdHours !== null && bedItem?.awayAtEdHours !== undefined;
  const admission = bedItem?.admissionId ? admissions.find((a) => a.id === bedItem.admissionId) : undefined;
  const tone = bedTone(bedItem, isReady);

  const stayDays = typeof bedItem?.stayDays === "number" ? bedItem.stayDays : null;
  const ageSex = [typeof bedItem?.age === "number" ? String(bedItem.age) : null, bedItem?.sex ?? null];
  const subline = isReady
    ? "No patient is allocated by this drawer. Review current referrals with the flow coordinator."
    : [...ageSex, bedItem?.stayBand ?? (bedItem?.status === "incoming" ? "Arriving" : null)]
        .filter(Boolean)
        .join(" · ") || "On this ward";

  const expectedPlan = bedItem?.pastDate
    ? bedItem.expectedDischargeLabel
      ? `Past the ward's own date (${bedItem.expectedDischargeLabel})`
      : "Past the ward's own date"
    : (bedItem?.expectedDischargeLabel ?? "No date set");

  const goingOut = (() => {
    if (bedItem?.pastDate) return "Past date";
    const at = admission?.expectedDischargeAt;
    if (at == null || !Number.isFinite(at)) return "No date";
    const days = dayOf(at) - dayOf(now);
    if (days <= 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
  })();

  const confirmation =
    bedItem?.dischargeConfirmed === true
      ? bedItem.dischargeConfirmedBy
        ? `Confirmed by ${bedItem.dischargeConfirmedBy}`
        : "Confirmed"
      : "Not yet confirmed";

  // Top 25 item 21: beside the discharge date when the ward has moved it several times.
  const eddMoved = eddMovedBadge(bedItem?.dischargeDateMoves);
  const expectedValue = eddMoved ? (
    <>
      {expectedPlan}{" "}
      <Badge tone="warning" size="sm">
        {eddMoved}
      </Badge>
    </>
  ) : (
    expectedPlan
  );

  const dateMoves =
    typeof bedItem?.dischargeDateMoves === "number"
      ? bedItem.dischargeDateMoves === 0
        ? "Not moved"
        : `Moved ${bedItem.dischargeDateMoves} time${bedItem.dischargeDateMoves === 1 ? "" : "s"}`
      : null;

  const observation = bedItem?.isSpecialling ? "1:1" : bedItem?.highAcuity ? "High acuity" : "Not 1:1";

  // Top 25 item 5: due out within the discharge prep window, the barrier is asked for here.
  const prepHours = Math.round(CLINICAL_VALUES.dischargePrepWindow.value / 60);
  const dueForPrep = admission?.state === "occupied" && deriveAfternoonDischarges([admission], now).length > 0;
  const barrierRow =
    admission && bedItem?.admissionId ? (
      <Row label="Barrier">
        {onSetBarrier && stayDays !== null ? (
          <select
            className={styles.select}
            aria-label="Discharge barrier"
            data-testid="ward-drawer-barrier-select"
            value={admission.dischargeBarrier ?? "None"}
            onChange={(e) => {
              const value = e.target.value;
              onSetBarrier(admission.id, isDischargeBarrier(value) ? value : null);
            }}
          >
            <option value="None">None recorded</option>
            {DISCHARGE_BARRIERS.map((barrier) => (
              <option key={barrier} value={barrier}>
                {barrier}
              </option>
            ))}
          </select>
        ) : (
          (admission.dischargeBarrier ?? "None recorded")
        )}
      </Row>
    ) : null;
  // Top 25 item 4: still being made ready past the set time. A question for the ward, never an
  // automatic opening: Ready below is the only way the bed is offered again.
  const staleFor =
    isPreparing && typeof bedItem?.preparingReleaseId === "string"
      ? stalePreparingReleases(unit.id, bedReleases, now).find(
          (entry) => entry.release.id === bedItem.preparingReleaseId,
        )?.minutes
      : undefined;
  const readyNote =
    staleFor !== undefined ? (
      <p className={styles.meta} data-testid="ward-drawer-cleaning-reminder">
        Being made ready for {durMinutes(staleFor)}. If the bed is ready, tap Ready so it is offered again.
      </p>
    ) : null;
  const prepNote = dueForPrep ? (
    <p className={styles.meta} data-testid="ward-drawer-discharge-prep">
      Due out within {prepHours} hours. Record any discharge barrier now so it can be sorted before the day.
    </p>
  ) : null;
  // Top 25 item 9 (D-60): criteria led discharge, on the Plan to leave tab and the phone sheet.
  const criteriaCard =
    criteriaEligibility !== undefined && admission?.state === "occupied" ? (
      <WardDischargeCriteriaCard
        key={admission.id}
        record={admission.dischargeCriteria}
        eligibility={criteriaEligibility}
        now={now}
        onChange={onSetCriteria ? (update) => onSetCriteria(admission.id, update) : undefined}
      />
    ) : null;
  // D-64: the criteria state beside "Record that they have left". It warns and never blocks.
  const criteriaRecord = criteriaCard && admission ? admission.dischargeCriteria : null;
  const criteriaDepartureNote =
    criteriaRecord && criteriaEligibility !== undefined
      ? criteriaLedDepartureNote(dischargeCriteriaStatus(criteriaRecord, criteriaEligibility, now))
      : null;
  const admittedAt = admission?.arrivedAt ?? admission?.pulledAt ?? null;

  // Only what the stay itself recorded, newest first. Nothing here is inferred.
  const timeline: { at: number; tone: WfTone; label: string }[] = [];
  if (admission) {
    if (admission.pulledAt != null) timeline.push({ at: admission.pulledAt, tone: "info", label: "Bed given" });
    if (admission.arrivedAt != null)
      timeline.push({ at: admission.arrivedAt, tone: "info", label: `Arrived on ${unit.name}` });
    if (admission.dischargeDateSetAt != null)
      timeline.push({
        at: admission.dischargeDateSetAt,
        tone: "neutral",
        label: `Leaving date set${admission.dischargeDateSetBy ? ` by ${admission.dischargeDateSetBy}` : ""}`,
      });
    if (admission.awayAtEmergencyDepartmentSince != null)
      timeline.push({
        at: admission.awayAtEmergencyDepartmentSince,
        tone: "warning",
        label: "Went to an ED, bed held",
      });
    if (admission.dischargeConfirmedAt != null)
      timeline.push({
        at: admission.dischargeConfirmedAt,
        tone: "success",
        label: `Discharge confirmed${admission.dischargeConfirmedBy ? ` by ${admission.dischargeConfirmedBy}` : ""}`,
      });
    if (criteriaRecord && criteriaRecord.items.length > 0) {
      timeline.push({ at: criteriaRecord.setAt, tone: "neutral", label: "Discharge criteria set or reviewed" });
      const metTimes = criteriaRecord.items.map((item) => item.metAt);
      if (metTimes.every((at): at is number => at !== null))
        timeline.push({ at: Math.max(...metTimes), tone: "success", label: "All discharge criteria met" });
    }
    timeline.sort((left, right) => right.at - left.at);
  }

  const openBlockerEditor = () => {
    const opening = !quickBlockerOpen;
    setQuickBlockerOpen(opening);
    if (opening) {
      setTab("plan");
      setTimeout(() => blockerSelectRef.current?.focus(), 0);
    }
  };

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const current = DRAWER_TABS.findIndex((item) => item.id === tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % DRAWER_TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + DRAWER_TABS.length) % DRAWER_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = DRAWER_TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    tabRefs.current.get(next)?.focus();
    const nextTab = DRAWER_TABS.at(next);
    if (nextTab) setTab(nextTab.id);
  };

  const panel = (id: DrawerTab, children: ReactNode) => (
    <div
      role="tabpanel"
      id={`${TAB_PREFIX}-panel-${id}`}
      aria-labelledby={`${TAB_PREFIX}-tab-${id}`}
      hidden={tab !== id}
      className={styles.panel}
    >
      {children}
    </div>
  );

  // The person behind this stay, through the provider's ward-facing identity resolver (FD-23): it
  // reads no referral record, destination or history here. Missing or conflicting links stay
  // unknown, and an unknown person gets no link.
  const person = admission ? resolvePatientIdentity(admission).patient : undefined;
  const personHref = person ? patientHref(person.id) : null;

  if (isPhone) {
    return (
      <PhoneBedSheet
        bedLabel={bedLabel}
        bedItem={bedItem}
        isReady={isReady}
        occupantAlias={occupantAlias}
        isOccupied={isOccupied}
        isAwayAtEd={isAwayAtEd}
        tone={tone}
        stayDays={stayDays}
        observation={observation}
        expectedPlan={expectedValue}
        timeline={timeline}
        now={now}
        personHref={personHref}
        selectedBed={selectedBed}
        quickBlockerOpen={quickBlockerOpen}
        setQuickBlockerOpen={setQuickBlockerOpen}
        selectedBlocker={selectedBlocker}
        setSelectedBlocker={setSelectedBlocker}
        blockerSelectRef={blockerSelectRef}
        drawerLeavingDestination={drawerLeavingDestination}
        setDrawerLeavingDestination={setDrawerLeavingDestination}
        onClose={onClose}
        onRecordLeft={onRecordLeft}
        onUpdateBlocker={onUpdateBlocker}
        onMarkAtEd={onMarkAtEd}
        onMarkBack={onMarkBack}
        onMove={onMove}
        onOpenBoard={onOpenBoard}
        onMarkReady={isPreparing ? onMarkReady : undefined}
        onRaiseReferral={onRaiseReferral}
        fullReferralHref={fullReferralHref}
        roleLockNote={roleLockNote}
        bedDrawerRef={bedDrawerRef}
        onKeyDown={onKeyDown}
        planRows={barrierRow}
        planNote={prepNote}
        planCriteria={criteriaCard}
        leavingCriteriaNote={criteriaDepartureNote}
        readyNote={readyNote}
      />
    );
  }

  return (
    <>
      <div className={`${styles.drawerScrim} ${styles.show}`} onClick={onClose} aria-hidden="true" />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
      <aside
        ref={bedDrawerRef}
        className={`${styles.drawer} ${styles.show}`}
        data-testid="bed-telemetry-drawer"
        aria-labelledby="drawer-bed-title"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && event.target instanceof HTMLElement && event.target.tagName === "SELECT") {
            return;
          }
          onKeyDown(event);
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div className={styles.grab} aria-hidden="true" />
        <header className={styles.drawerHead}>
          <span className={cx(styles.drawerBedBadge, isReady && styles.drawerBedBadgeReady)}>
            {tone ? <StatusGlyph tone={tone} /> : null}
            {bedLabel}
          </span>
          <div className={styles.drawerHeading}>
            <h2 id="drawer-bed-title" className={styles.drawerTitle}>
              {isReady ? readyWord : occupantAlias}
            </h2>
            <p className={styles.drawerKicker}>{subline}</p>
          </div>
          {onPrevBed ? (
            <Button
              variant="ghost"
              iconOnly
              icon={ChevronLeft}
              aria-label="Previous bed"
              className={styles.pill}
              onClick={onPrevBed}
            />
          ) : null}
          {onNextBed ? (
            <Button
              variant="ghost"
              iconOnly
              icon={ChevronRight}
              aria-label="Next bed"
              className={styles.pill}
              onClick={onNextBed}
            />
          ) : null}
          <Button
            variant="ghost"
            iconOnly
            icon={X}
            aria-label="Close bed drawer"
            className={styles.pill}
            onClick={onClose}
          />
        </header>

        {isReady ? (
          <>
            <div className={styles.facts}>
              <FactTile
                label="State"
                value={isPreparing ? BED_STATE_LABELS.beingMadeReady : "Ready"}
                tone={isPreparing ? "neutral" : "success"}
              />
              <FactTile label="Held for" value="No one" />
              {bedItem.designation ? <FactTile label="Bed" value={bedItem.designation} /> : null}
            </div>
            <div className={styles.drawerBody}>
              <Section title="Placement review">
                <dl className={styles.kv}>
                  <Row label="Candidate">No patient match is recorded for this bed.</Row>
                  <Row label="Allocation">
                    The flow coordinator reviews eligibility and current capacity before recording a shared bed
                    reservation.
                  </Row>
                  <Row label="Vital signs">{VITAL_SIGNS_NOTE}</Row>
                </dl>
                {readyNote}
              </Section>
            </div>
          </>
        ) : (
          <>
            <div className={styles.facts}>
              <FactTile label="Stay" value={stayDays === null ? "Not recorded" : `${stayDays}d`} />
              <FactTile label="Legal" value={shortLegal(bedItem?.legalStatusLabel)} />
              <FactTile label="Going out" value={goingOut} tone={bedItem?.pastDate ? "danger" : null} />
              <FactTile label="Observation" value={observation} />
            </div>
            <div className={styles.tabsWrap}>
              {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
              <div role="tablist" aria-label="Bed details" className={styles.tabs} onKeyDown={onTabKeyDown}>
                {DRAWER_TABS.map((item, index) => {
                  const selected = item.id === tab;
                  return (
                    <button
                      key={item.id}
                      ref={(node) => {
                        tabRefs.current.set(index, node);
                      }}
                      type="button"
                      role="tab"
                      id={`${TAB_PREFIX}-tab-${item.id}`}
                      aria-controls={`${TAB_PREFIX}-panel-${item.id}`}
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      className={cx(styles.tab, selected && styles.tabOn)}
                      onClick={() => {
                        setTab(item.id);
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.drawerBody}>
              {panel(
                "over",
                <>
                  <Section title="This person">
                    <dl className={styles.kv}>
                      {bedItem?.preferredName && bedItem.preferredName !== occupantAlias ? (
                        <Row label="Known as">{bedItem.preferredName}</Row>
                      ) : null}
                      {bedItem?.umrn ? (
                        <Row label="Record">
                          <span className={styles.mono}>{bedItem.umrn}</span>
                        </Row>
                      ) : null}
                      {bedItem?.gender ? <Row label="Bed placement">{bedItem.gender}</Row> : null}
                      {bedItem?.suburb || bedItem?.homeRegion ? (
                        <Row label={bedItem.suburb ? "Suburb" : "Region"}>
                          {[bedItem.suburb, bedItem.homeRegion].filter(Boolean).join(", ")}
                        </Row>
                      ) : null}
                      {bedItem?.generalPractitioner ? <Row label="GP">{bedItem.generalPractitioner}</Row> : null}
                      {bedItem?.catchmentCommunityTeam ? (
                        <Row label="Community team">{bedItem.catchmentCommunityTeam}</Row>
                      ) : null}
                    </dl>
                  </Section>
                  <Section title="Why they are here">
                    <dl className={styles.kv}>
                      <Row label="Tentative diagnosis">{bedItem?.tentativeDiagnosis ?? "None recorded"}</Row>
                      <Row label="Admitted">
                        {[
                          admittedAt != null ? formatInstantWithDay(admittedAt, now) : null,
                          stayDays === null
                            ? "length of stay not recorded"
                            : `${stayDays} day${stayDays === 1 ? "" : "s"} here`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Row>
                      {bedItem?.legalStatusLabel ? <Row label="Legal status">{bedItem.legalStatusLabel}</Row> : null}
                    </dl>
                  </Section>
                  <Section title="This shift">
                    <dl className={styles.kv}>
                      <Row label="Where">
                        {isAwayAtEd ? `Away at an ED ${bedItem.awayAtEdHours}h, bed held` : "On the ward"}
                      </Row>
                      <Row label="1:1 nursing">
                        {bedItem?.isSpecialling ? "Specialling recorded (1:1 rostered)" : "No specialling recorded"}
                      </Row>
                      <Row label="High acuity">{bedItem?.highAcuity ? "Requested" : "Not requested"}</Row>
                      <Row label="Vital signs">{VITAL_SIGNS_NOTE}</Row>
                    </dl>
                  </Section>
                </>,
              )}
              {panel(
                "plan",
                <>
                  <Section title="Plan to leave">
                    <dl className={styles.kv}>
                      <Row label="Expected">{expectedValue}</Row>
                      <Row label="Confirmed">{confirmation}</Row>
                      {dateMoves ? <Row label="Date moves">{dateMoves}</Row> : null}
                      <Row label="Blocker">{bedItem?.blockReason ?? "None recorded"}</Row>
                      {barrierRow ??
                        (bedItem?.dischargeBarrier ? <Row label="Barrier">{bedItem.dischargeBarrier}</Row> : null)}
                    </dl>
                    {prepNote}
                    {bedItem?.blockReason && bedItem?.admissionId && onUpdateBlocker ? (
                      <div className={styles.editor}>
                        <Button
                          variant="ghost"
                          className={styles.pill}
                          onClick={() => {
                            if (bedItem.admissionId) onUpdateBlocker(bedItem.admissionId, null);
                            setQuickBlockerOpen(false);
                          }}
                        >
                          Clear blocker
                        </Button>
                      </div>
                    ) : null}
                    {quickBlockerOpen ? (
                      <div className={styles.editor}>
                        <select
                          ref={blockerSelectRef}
                          className={styles.select}
                          value={selectedBlocker}
                          aria-label="Discharge blocker"
                          onChange={(e) => {
                            setSelectedBlocker(e.target.value as BedReleaseBlocker);
                          }}
                        >
                          {BED_RELEASE_BLOCKERS.map((blocker) => (
                            <option key={blocker} value={blocker}>
                              {blocker}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="sec"
                          className={styles.pill}
                          onClick={() => {
                            if (bedItem?.admissionId && onUpdateBlocker) {
                              onUpdateBlocker(bedItem.admissionId, selectedBlocker);
                            }
                            setQuickBlockerOpen(false);
                          }}
                        >
                          Save blocker
                        </Button>
                      </div>
                    ) : null}
                  </Section>
                  {criteriaCard}
                  {isOccupied && bedItem?.admissionId ? (
                    <Section title="Going to">
                      <div className={styles.cardInner}>
                        <select
                          id="drawer-leaving-dest"
                          aria-label="Where are they going?"
                          className={styles.select}
                          value={drawerLeavingDestination}
                          onChange={(e) => {
                            setDrawerLeavingDestination(e.target.value as LeavingDestination);
                          }}
                        >
                          {LEAVING_DESTINATIONS.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                              {destination.label}
                            </option>
                          ))}
                        </select>
                        {bedItem.catchmentCommunityTeam ? (
                          <p className={styles.meta}>
                            <Icon icon={MapPin} size={14} />
                            <span className={styles.ell}>
                              Community team{bedItem.suburb ? ` for ${bedItem.suburb}` : ""}:{" "}
                              {bedItem.catchmentCommunityTeam}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </Section>
                  ) : null}
                </>,
              )}
              {panel(
                "time",
                <Section title="Timeline">
                  {timeline.length > 0 ? (
                    <ul className={styles.timeline}>
                      {timeline.map((event) => (
                        <li key={`${event.label}-${event.at}`}>
                          <StatusGlyph tone={event.tone} />
                          <span className={styles.timelineAt}>{formatInstantWithDay(event.at, now)}</span>
                          <span className={styles.ell}>{event.label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.empty}>Nothing recorded for this stay yet.</p>
                  )}
                </Section>,
              )}
            </div>
          </>
        )}

        <footer className={styles.drawerFoot}>
          {isReady ? (
            <>
              {isPreparing && onMarkReady ? (
                <Button variant="pri" size="lg" className={styles.pill} onClick={onMarkReady}>
                  Ready
                </Button>
              ) : null}
              <Link
                className={buttonClass({
                  variant: isPreparing && onMarkReady ? "sec" : "pri",
                  size: "lg",
                  className: styles.pill,
                })}
                href="/mockups/ward-flow/referrals"
              >
                Review current referrals
              </Link>
              {onOpenBoard && !isPreparing ? (
                <Button variant="sec" size="lg" className={styles.pill} onClick={onOpenBoard}>
                  Place someone here
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {isOccupied && bedItem?.admissionId ? (
                <>
                  {/* The destination is chosen on Plan to leave, so the footer always says which one
                      "Record that they have left" will record. */}
                  <p className={styles.footDestination} id="drawer-leaving-summary">
                    Going to{" "}
                    <strong>
                      {LEAVING_DESTINATIONS.find((destination) => destination.id === drawerLeavingDestination)?.label}
                    </strong>
                    {tab !== "plan" ? (
                      <button
                        type="button"
                        className={styles.footChange}
                        onClick={() => {
                          setTab("plan");
                        }}
                      >
                        Change
                      </button>
                    ) : null}
                  </p>
                  {criteriaDepartureNote ? (
                    <p
                      className={styles.footCriteria}
                      id="drawer-leaving-criteria"
                      data-testid="ward-drawer-leaving-criteria"
                    >
                      {criteriaDepartureNote}
                    </p>
                  ) : null}
                  <Button
                    variant="pri"
                    size="lg"
                    className={styles.pill}
                    aria-describedby={
                      criteriaDepartureNote
                        ? "drawer-leaving-summary drawer-leaving-criteria"
                        : "drawer-leaving-summary"
                    }
                    onClick={() => {
                      if (bedItem.admissionId)
                        onRecordLeft(bedItem.admissionId, occupantAlias, drawerLeavingDestination);
                    }}
                  >
                    Record that they have left
                  </Button>
                </>
              ) : null}
              {/* Blockers and ED trips belong to a stay; a bed with no admission yet (an inbound
                  bed) has nothing for them to change, so they are not offered. */}
              {bedItem?.admissionId ? (
                <>
                  <Button
                    variant="sec"
                    size="lg"
                    className={styles.pill}
                    aria-expanded={quickBlockerOpen}
                    onClick={openBlockerEditor}
                  >
                    {bedItem.blockReason ? "Update blocker" : "Record blocker"}
                  </Button>
                  <Button
                    variant="sec"
                    size="lg"
                    className={styles.pill}
                    onClick={() => {
                      if (isAwayAtEd) onMarkBack?.(selectedBed);
                      else onMarkAtEd?.(selectedBed);
                    }}
                  >
                    {isAwayAtEd ? "Mark them back" : "Mark at an ED"}
                  </Button>
                </>
              ) : null}
              {onMove && bedItem?.stayAdmissionId ? (
                <Button variant="sec" size="lg" className={styles.pill} onClick={onMove}>
                  Move to another bed
                </Button>
              ) : null}
              {isOccupied && onRaiseReferral ? (
                <Button
                  variant="sec"
                  size="lg"
                  className={styles.pill}
                  onClick={onRaiseReferral}
                  data-testid="ward-dossier-raise-referral-btn"
                >
                  Raise ward referral
                </Button>
              ) : null}
              {isOccupied && fullReferralHref ? (
                <Link
                  className={buttonClass({ variant: "ghost", size: "lg", className: styles.pill })}
                  href={fullReferralHref}
                  onClick={onClose}
                  data-testid="ward-dossier-full-referral-link"
                >
                  Open full referral form…
                </Link>
              ) : null}
              {roleLockNote}
            </>
          )}
          <span className={styles.footSpacer} />
          {personHref ? (
            <Link
              className={buttonClass({ variant: "ghost", size: "lg", className: styles.pill })}
              href={personHref}
              onClick={onClose}
            >
              Patient page
              <Icon icon={ChevronRight} size={14} />
            </Link>
          ) : null}
        </footer>
      </aside>
    </>
  );
}

/** What the bed is doing now, in the words the Every bed list uses. */
function nowLabel(bedItem: BedItem | undefined, isReady: boolean): string {
  if (isReady) return "Ready";
  if (!bedItem) return "Not recorded";
  if (bedItem.status === "closed") return "Closed";
  if (bedItem.blockReason) return "Held up";
  if (bedItem.awayAtEdHours != null) return "Away at an ED";
  if (bedItem.status === "leave") return "On leave";
  if (bedItem.status === "incoming") return "Arriving";
  if (bedItem.pastDate) return "Past date";
  if (bedItem.dischargeConfirmed === true || (bedItem.expectedDays != null && bedItem.expectedDays <= 0))
    return "Leaving";
  return "On the ward";
}

const CHIP_LABEL = new Map<WfTone, string>([
  ["danger", "Act now"],
  ["warning", "Needs a look"],
  ["success", "Ready"],
]);

interface PhoneBedSheetProps {
  bedLabel: string;
  bedItem: BedItem | undefined;
  isReady: boolean;
  occupantAlias: string;
  isOccupied: boolean;
  isAwayAtEd: boolean;
  tone: WfTone | null;
  stayDays: number | null;
  observation: string;
  expectedPlan: ReactNode;
  timeline: { at: number; tone: WfTone; label: string }[];
  now: number;
  personHref: string | null;
  selectedBed: number;
  quickBlockerOpen: boolean;
  setQuickBlockerOpen: (open: boolean) => void;
  selectedBlocker: BedReleaseBlocker;
  setSelectedBlocker: (blocker: BedReleaseBlocker) => void;
  blockerSelectRef: React.RefObject<HTMLSelectElement | null>;
  drawerLeavingDestination: LeavingDestination;
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  onClose: () => void;
  onRecordLeft: (admissionId: string, who: string, destination: LeavingDestination) => void;
  onUpdateBlocker?: (admissionId: string, blocker: string | null) => void;
  onMarkAtEd?: (bedNumber: number) => void;
  onMarkBack?: (bedNumber: number) => void;
  onMove?: () => void;
  onOpenBoard?: () => void;
  /** Set only for a bed being made ready (A4-24). */
  onMarkReady?: () => void;
  onRaiseReferral?: () => void;
  fullReferralHref?: string | null;
  roleLockNote?: ReactNode;
  bedDrawerRef: React.RefObject<HTMLElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  /** Top 25: extra Plan to leave rows (flagged), built once by the drawer for both layouts. */
  planRows?: ReactNode;
  /** Top 25: a short note under Plan to leave (flagged). */
  planNote?: ReactNode;
  planCriteria?: ReactNode;
  /** D-64: the criteria led discharge note beside "Record that they have left". Warns, never blocks. */
  leavingCriteriaNote?: string | null;
  /** Top 25: a short note on a bed being made ready (flagged). */
  readyNote?: ReactNode;
}

/**
 * Phone (v10 bed sheet): one scrolling sheet, no tabs. Bed and name lead, then four facts, then
 * This person, Plan to leave and Timeline as plain label rows. Move bed and the blocker sit in the
 * footer; every other action the desktop drawer offers stays in the sheet body.
 */
function PhoneBedSheet({
  bedLabel,
  bedItem,
  isReady,
  occupantAlias,
  isOccupied,
  isAwayAtEd,
  tone,
  stayDays,
  observation,
  expectedPlan,
  timeline,
  now,
  personHref,
  selectedBed,
  quickBlockerOpen,
  setQuickBlockerOpen,
  selectedBlocker,
  setSelectedBlocker,
  blockerSelectRef,
  drawerLeavingDestination,
  setDrawerLeavingDestination,
  onClose,
  onRecordLeft,
  onUpdateBlocker,
  onMarkAtEd,
  onMarkBack,
  onMove,
  onOpenBoard,
  onMarkReady,
  onRaiseReferral,
  fullReferralHref,
  roleLockNote,
  bedDrawerRef,
  onKeyDown,
  planRows,
  planNote,
  planCriteria,
  leavingCriteriaNote,
  readyNote,
}: PhoneBedSheetProps) {
  const chip = tone ? CHIP_LABEL.get(tone) : undefined;
  const sub = [bedItem?.umrn, bedItem?.podLabel ?? bedItem?.designation].filter(Boolean).join(" · ");
  const admissionId = bedItem?.admissionId;
  const canMove = Boolean(onMove && bedItem?.stayAdmissionId);
  // A1-13 (audit round 2): the filled button follows the stay. Leaving means Record that they have
  // left; held up means Update blocker; a settled stay has no primary step.
  const heldUpNow = Boolean(bedItem?.blockReason);
  const leavingNow =
    isOccupied &&
    !heldUpNow &&
    (bedItem?.dischargeConfirmed === true || (bedItem?.expectedDays != null && bedItem.expectedDays <= 0));
  const toggleBlocker = () => {
    const opening = !quickBlockerOpen;
    setQuickBlockerOpen(opening);
    if (opening) setTimeout(() => blockerSelectRef.current?.focus(), 0);
  };

  return (
    <>
      <div className={`${styles.drawerScrim} ${styles.show}`} onClick={onClose} aria-hidden="true" />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
      <aside
        ref={bedDrawerRef}
        className={cx(styles.drawer, styles.show, styles.phoneSheet)}
        data-testid="bed-telemetry-drawer"
        aria-labelledby="drawer-bed-title"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          onKeyDown(event);
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div className={styles.grab} aria-hidden="true" />
        <header className={styles.phoneHead}>
          <div className={styles.drawerHeading}>
            <h2 id="drawer-bed-title" className={styles.phoneTitle}>
              {bedLabel} ·{" "}
              {isReady ? (bedItem?.preparing ? BED_STATE_LABELS.beingMadeReady : "Ready bed") : occupantAlias}
            </h2>
            {sub ? <p className={styles.drawerKicker}>{sub}</p> : null}
            {chip && tone ? (
              <span className={styles.phoneChip}>
                <StatusGlyph tone={tone} />
                {chip}
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            iconOnly
            icon={X}
            aria-label="Close bed drawer"
            className={styles.pill}
            onClick={onClose}
          />
        </header>

        <div className={styles.phoneBody}>
          {isReady ? (
            <>
              <div className={styles.phoneFacts}>
                <FactTile
                  label="Now"
                  value={bedItem?.preparing ? BED_STATE_LABELS.beingMadeReady : "Ready"}
                  tone={bedItem?.preparing ? "neutral" : "success"}
                />
                <FactTile label="Held for" value={bedItem?.heldFor ?? "No one"} />
              </div>
              <h3 className={styles.phoneSec}>Placement</h3>
              <dl className={styles.phoneKv}>
                <Row label="Candidate">No patient match is recorded for this bed.</Row>
                {bedItem?.designation ? <Row label="Bed">{bedItem.designation}</Row> : null}
              </dl>
              {readyNote}
            </>
          ) : (
            <>
              <div className={styles.phoneFacts}>
                <FactTile label="Now" value={nowLabel(bedItem, isReady)} />
                <FactTile label="Stay" value={stayDays === null ? "Not recorded" : `${stayDays}d`} />
                <FactTile label="Legal" value={shortLegal(bedItem?.legalStatusLabel)} />
                <FactTile label="Sex" value={bedItem?.sex ?? "Not recorded"} />
              </div>
              <h3 className={styles.phoneSec}>This person</h3>
              <dl className={styles.phoneKv}>
                {bedItem?.preferredName ? <Row label="Known as">{bedItem.preferredName}</Row> : null}
                <Row label="Observation">{observation}</Row>
                <Row label="Community team">{bedItem?.catchmentCommunityTeam ?? "No community team yet"}</Row>
              </dl>
              <h3 className={styles.phoneSec}>Plan to leave</h3>
              <dl className={styles.phoneKv}>
                <Row label="Expected">{expectedPlan}</Row>
                <Row label="Blocker">{bedItem?.blockReason ?? "None recorded"}</Row>
                {planRows}
                {isOccupied && admissionId ? (
                  // The longest destinations do not fit beside the label at 390px, so the select takes its own line.
                  <Row label="Going to" wide>
                    <select
                      id="drawer-leaving-dest"
                      aria-label="Where are they going?"
                      className={styles.select}
                      value={drawerLeavingDestination}
                      onChange={(e) => {
                        setDrawerLeavingDestination(e.target.value as LeavingDestination);
                      }}
                    >
                      {LEAVING_DESTINATIONS.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.label}
                        </option>
                      ))}
                    </select>
                  </Row>
                ) : null}
              </dl>
              {planNote}
              {bedItem?.blockReason && admissionId && onUpdateBlocker ? (
                <div className={styles.editor}>
                  <Button
                    variant="ghost"
                    className={styles.pill}
                    onClick={() => {
                      onUpdateBlocker(admissionId, null);
                      setQuickBlockerOpen(false);
                    }}
                  >
                    Clear blocker
                  </Button>
                </div>
              ) : null}
              {quickBlockerOpen ? (
                <div className={styles.editor}>
                  <select
                    ref={blockerSelectRef}
                    className={styles.select}
                    value={selectedBlocker}
                    aria-label="Discharge blocker"
                    onChange={(e) => {
                      setSelectedBlocker(e.target.value as BedReleaseBlocker);
                    }}
                  >
                    {BED_RELEASE_BLOCKERS.map((blocker) => (
                      <option key={blocker} value={blocker}>
                        {blocker}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="sec"
                    className={styles.pill}
                    onClick={() => {
                      if (admissionId && onUpdateBlocker) onUpdateBlocker(admissionId, selectedBlocker);
                      setQuickBlockerOpen(false);
                    }}
                  >
                    Save blocker
                  </Button>
                </div>
              ) : null}
              {planCriteria}
              <h3 className={styles.phoneSec}>Timeline</h3>
              {timeline.length > 0 ? (
                <ul className={styles.timeline}>
                  {timeline.map((event) => (
                    <li key={`${event.label}-${event.at}`}>
                      <StatusGlyph tone={event.tone} />
                      <span className={styles.timelineAt}>{formatInstantWithDay(event.at, now)}</span>
                      <span className={styles.ell}>{event.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.phoneEmpty}>Nothing recorded for this stay yet.</p>
              )}
            </>
          )}

          <div className={styles.phoneMore}>
            {isOccupied && admissionId ? (
              <>
                {/* Audit A1-12: the phone says plainly which destination "Has left" records too. */}
                <p className={styles.footDestination} id="drawer-leaving-summary-phone">
                  Going to{" "}
                  <strong>
                    {LEAVING_DESTINATIONS.find((destination) => destination.id === drawerLeavingDestination)?.label}
                  </strong>
                </p>
                {leavingCriteriaNote ? (
                  <p
                    className={styles.footCriteria}
                    id="drawer-leaving-criteria-phone"
                    data-testid="ward-drawer-leaving-criteria"
                  >
                    {leavingCriteriaNote}
                  </p>
                ) : null}
                <Button
                  variant={leavingNow ? "pri" : "sec"}
                  className={styles.pill}
                  aria-describedby={
                    leavingCriteriaNote
                      ? "drawer-leaving-summary-phone drawer-leaving-criteria-phone"
                      : "drawer-leaving-summary-phone"
                  }
                  onClick={() => {
                    onRecordLeft(admissionId, occupantAlias, drawerLeavingDestination);
                  }}
                >
                  Record that they have left
                </Button>
              </>
            ) : null}
            {admissionId ? (
              <Button
                variant="sec"
                className={styles.pill}
                onClick={() => {
                  if (isAwayAtEd) onMarkBack?.(selectedBed);
                  else onMarkAtEd?.(selectedBed);
                }}
              >
                {isAwayAtEd ? "Mark them back" : "Mark at an ED"}
              </Button>
            ) : null}
            {isReady ? (
              <Link
                className={buttonClass({ variant: "sec", className: styles.pill })}
                href="/mockups/ward-flow/referrals"
              >
                Review current referrals
              </Link>
            ) : null}
            {isOccupied && onRaiseReferral ? (
              <Button
                variant="sec"
                className={styles.pill}
                onClick={onRaiseReferral}
                data-testid="ward-dossier-raise-referral-btn"
              >
                Raise ward referral
              </Button>
            ) : null}
            {isOccupied && fullReferralHref ? (
              <Link
                className={buttonClass({ variant: "ghost", className: styles.pill })}
                href={fullReferralHref}
                onClick={onClose}
                data-testid="ward-dossier-full-referral-link"
              >
                Open full referral form…
              </Link>
            ) : null}
            {roleLockNote}
            {personHref ? (
              <Link
                className={buttonClass({ variant: "ghost", className: styles.pill })}
                href={personHref}
                onClick={onClose}
              >
                Patient page
                <Icon icon={ChevronRight} size={14} />
              </Link>
            ) : null}
          </div>
        </div>

        {(isReady && (onOpenBoard || onMarkReady)) || canMove || admissionId ? (
          <footer className={styles.phoneFoot}>
            {isReady && onMarkReady ? (
              <Button variant="pri" size="lg" className={styles.pill} onClick={onMarkReady}>
                Ready
              </Button>
            ) : isReady && onOpenBoard && !bedItem?.preparing ? (
              <Button variant="pri" size="lg" className={styles.pill} onClick={onOpenBoard}>
                Place someone here
              </Button>
            ) : null}
            {canMove ? (
              <Button variant="sec" size="lg" className={styles.pill} onClick={onMove}>
                Move bed
              </Button>
            ) : null}
            {admissionId ? (
              <Button
                variant={heldUpNow ? "pri" : "sec"}
                size="lg"
                className={styles.pill}
                aria-expanded={quickBlockerOpen}
                onClick={toggleBlocker}
              >
                {bedItem?.blockReason ? "Update blocker" : "Record blocker"}
              </Button>
            ) : null}
          </footer>
        ) : null}
      </aside>
    </>
  );
}
