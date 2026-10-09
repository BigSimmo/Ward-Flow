"use client";

import React, { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import styles from "./ward-bed-dossier-drawer.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import { bedGlyphTone, type BedItem } from "./ward-beds-matrix";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { dayOf, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { Button, Icon, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";

interface WardBedDossierDrawerProps {
  selectedBed: number;
  bedItem: BedItem | undefined;
  unit: Unit;
  onClose: () => void;
  drawerLeavingDestination: LeavingDestination;
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  onRecordLeft: (admissionId: string, who: string, destination: LeavingDestination) => void;
  onUpdateBlocker?: (admissionId: string, blocker: string) => void;
  onMarkAtEd?: (bedNumber: number) => void;
  onMarkBack?: (bedNumber: number) => void;
  /** Steps to the bed before this one. The arrow shows only when the parent passes it. */
  onPrevBed?: () => void;
  /** Steps to the bed after this one. The arrow shows only when the parent passes it. */
  onNextBed?: () => void;
  bedDrawerRef: React.RefObject<HTMLElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

const VITAL_SIGNS_NOTE = "Not recorded in Ward Flow. Check the ward's own observation chart.";

type DrawerTab = "over" | "plan" | "time";
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
  if (isReady) return "success";
  return bedItem ? bedGlyphTone(bedItem) : null;
}

/** Shortens "Form 6A Involuntary inpatient" to "Form 6A" for the fact tile; the full label stays in Overview. */
function shortLegal(label: string | undefined): string {
  if (!label) return "Not recorded";
  return label.startsWith("Form ") ? label.split(" ").slice(0, 2).join(" ") : label;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className={styles.kvDt}>{label}</dt>
      <dd className={styles.kvDd}>{children}</dd>
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
  onMarkBack,
  onPrevBed,
  onNextBed,
  bedDrawerRef,
  onKeyDown,
}: WardBedDossierDrawerProps) {
  const { admissions, resolvePatientIdentity } = useWardFlow();
  const now = useWardFlowClock();
  const [tab, setTab] = useState<DrawerTab>("over");
  const [quickBlockerOpen, setQuickBlockerOpen] = useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState<BedReleaseBlocker>(recordedBlocker(bedItem?.blockReason));
  const [shownBed, setShownBed] = useState(selectedBed);
  const tabRefs = useRef(new Map<number, HTMLButtonElement | null>());
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

  const dateMoves =
    typeof bedItem?.dischargeDateMoves === "number"
      ? bedItem.dischargeDateMoves === 0
        ? "Not moved"
        : `Moved ${bedItem.dischargeDateMoves} time${bedItem.dischargeDateMoves === 1 ? "" : "s"}`
      : null;

  const observation = bedItem?.isSpecialling ? "1:1" : bedItem?.highAcuity ? "High acuity" : "Not 1:1";
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

  return (
    <>
      <div className={`${styles.drawerScrim} ${styles.show}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={bedDrawerRef}
        className={`${styles.drawer} ${styles.show}`}
        data-testid="bed-telemetry-drawer"
        aria-labelledby="drawer-bed-title"
        role="dialog"
        aria-modal="true"
        onKeyDown={onKeyDown}
      >
        <div className={styles.grab} aria-hidden="true" />
        <header className={styles.drawerHead}>
          <span className={cx(styles.drawerBedBadge, isReady && styles.drawerBedBadgeReady)}>
            {tone ? <StatusGlyph tone={tone} /> : null}
            {bedLabel}
          </span>
          <div className={styles.drawerHeading}>
            <h2 id="drawer-bed-title" className={styles.drawerTitle}>
              {isReady ? "Ready bed" : occupantAlias}
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
              <FactTile label="State" value="Ready" tone="success" />
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
                      <Row label="Expected">{expectedPlan}</Row>
                      <Row label="Confirmed">{confirmation}</Row>
                      {dateMoves ? <Row label="Date moves">{dateMoves}</Row> : null}
                      <Row label="Blocker">{bedItem?.blockReason ?? "None recorded"}</Row>
                      {bedItem?.dischargeBarrier ? <Row label="Barrier">{bedItem.dischargeBarrier}</Row> : null}
                    </dl>
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
            <Link
              className={buttonClass({ variant: "pri", size: "lg", className: styles.pill })}
              href="/mockups/ward-flow/referrals"
            >
              Review current referrals
            </Link>
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
                  <Button
                    variant="pri"
                    size="lg"
                    className={styles.pill}
                    aria-describedby="drawer-leaving-summary"
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
                    onClick={() => (isAwayAtEd ? onMarkBack?.(selectedBed) : onMarkAtEd?.(selectedBed))}
                  >
                    {isAwayAtEd ? "Mark them back" : "Mark at an ED"}
                  </Button>
                </>
              ) : null}
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
