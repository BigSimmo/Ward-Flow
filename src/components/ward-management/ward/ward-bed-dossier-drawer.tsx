"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "./ward-bed-dossier-drawer.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedItem } from "./ward-beds-matrix";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";

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
  bedDrawerRef: React.RefObject<HTMLElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
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
  bedDrawerRef,
  onKeyDown,
}: WardBedDossierDrawerProps) {
  const [activeTab, setActiveTab] = useState<"actions" | "trajectory" | "risk" | "team">("actions");
  const [candidateAllocated, setCandidateAllocated] = useState(false);
  const [quickBlockerOpen, setQuickBlockerOpen] = useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState("Awaiting NDIS accommodation");

  const bedLabel = `Bed ${String(selectedBed).padStart(2, "0")}`;
  const isReady = bedItem?.status === "ready" || (!bedItem?.patientAlias && selectedBed === 20);
  const occupantAlias = bedItem?.patientAlias ?? (isReady ? "Ready Vacant Bed" : "No occupant recorded");
  const stayDaysVal = typeof bedItem?.stayDays === "number" ? bedItem.stayDays : 0;
  const isOccupied = Boolean(bedItem?.patientAlias);
  const isAwayAtEd = bedItem?.awayAtEdHours !== null && bedItem?.awayAtEdHours !== undefined;

  const handleAllocateClick = () => {
    setCandidateAllocated(true);
  };

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
        {/* Header */}
        <header className={styles.drawerHead}>
          <div className={styles.drawerTitleGroup}>
            <span className={`${styles.drawerBedBadge} ${isReady ? styles.drawerBedBadgeReady : ""}`}>{bedLabel}</span>
            <h2 id="drawer-bed-title" className={styles.drawerTitle}>
              {bedLabel} &middot; Patient Dossier
            </h2>
          </div>
          <button type="button" className={styles.drawerCloseBtn} onClick={onClose} aria-label="Close bed drawer">
            &times; Close
          </button>
        </header>

        {/* ─────────────────────────────────────────────────────────────
           VIEW MODE A: READY VACANT BED CONSOLE (BED 20 / READY STATUS)
           ───────────────────────────────────────────────────────────── */}
        {isReady ? (
          <div className={styles.drawerBody}>
            <div className={styles.readyConsoleCard}>
              <div className={styles.readyHeaderRow}>
                <svg
                  viewBox="0 0 16 16"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="var(--good, #059669)"
                  strokeWidth="2.2"
                >
                  <path d="M3 8l3 3 7-7" />
                </svg>
                <h3 className={styles.readyStatusTitle}>Ready for Immediate Allocation</h3>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)" }}>
                This bed is clean, offered, and unassigned. Cleaning completion and infection control clearance have
                been logged for this shift.
              </p>

              <div className={styles.readyMetaGrid}>
                <div className={styles.readyMetaItem}>
                  <span className={styles.readyMetaLabel}>Terminal Clean</span>
                  <span className={styles.readyMetaVal}>Signed off 14:15 AWST</span>
                </div>
                <div className={styles.readyMetaItem}>
                  <span className={styles.readyMetaLabel}>Infection Control</span>
                  <span className={styles.readyMetaVal}>Cleared (MRSA/VRE Neg)</span>
                </div>
                <div className={styles.readyMetaItem}>
                  <span className={styles.readyMetaLabel}>Room Specifications</span>
                  <span className={styles.readyMetaVal}>Single Ensuite (Pod {bedItem?.podLabel ?? "A"})</span>
                </div>
                <div className={styles.readyMetaItem}>
                  <span className={styles.readyMetaLabel}>Observation Line</span>
                  <span className={styles.readyMetaVal}>Direct Station Sightline</span>
                </div>
              </div>
            </div>

            {/* Intake Queue Matching */}
            <div className={styles.actionCard}>
              <span className={styles.actionLabel}>Priority Transfer / Waitlist Match</span>
              {candidateAllocated ? (
                <div className={`${styles.alertBanner} ${styles.alertSuccess}`}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8l3 3 7-7" />
                  </svg>
                  <span>Bed {String(selectedBed).padStart(2, "0")} allocated to Aaron K. Bed locked for transit.</span>
                </div>
              ) : (
                <div className={styles.allocationCandidateCard}>
                  <div className={styles.candidateTitle}>Aaron K. &middot; 34yo Male</div>
                  <div className={styles.candidateSub}>
                    Source: Emergency Dept (Psychiatric Assessment Team) &middot; Wait: 14h &middot; Status: Medically
                    Cleared
                  </div>
                  <button type="button" className={styles.btnPrimaryAction} onClick={handleAllocateClick}>
                    Allocate Bed {String(selectedBed).padStart(2, "0")} to Aaron K. &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* Operational Bed Actions */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h4 className={styles.cardTitle}>Bed Configuration &amp; Safeguards</h4>
              </div>
              <div className={styles.btnGrid}>
                <button type="button" className={styles.btnSecondary} onClick={() => alert("Maintenance hold placed")}>
                  Maintenance Hold
                </button>
                <button type="button" className={styles.btnSecondary} onClick={() => alert("Cohort lock configured")}>
                  Gender / Cohort Lock
                </button>
              </div>
            </div>

            {/* Clinical monitoring status (invariant preserved) */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h4 className={styles.cardTitle}>Clinical monitoring status</h4>
              </div>
              <dl className={styles.factList}>
                <div className={styles.factRow}>
                  <dt className={styles.factDt}>Tentative diagnosis</dt>
                  <dd className={styles.factDd}>Bed currently vacant. Ready for incoming admission.</dd>
                </div>
                <div className={styles.factRow}>
                  <dt className={styles.factDt}>Vital signs</dt>
                  <dd className={styles.factDd}>
                    Not recorded in Ward Flow. Check the ward&apos;s own observation chart.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────
             VIEW MODE B: OCCUPIED INPATIENT CLINICAL COMMAND DOSSIER
             ───────────────────────────────────────────────────────────── */
          <>
            {/* Hero Banner */}
            <div className={styles.heroBanner}>
              <div className={styles.heroStayRow}>
                <div className={styles.heroStayCounter}>
                  <span className={styles.heroStayNumber}>{bedItem?.daysInBed ?? "0d"}</span>
                  <span className={styles.heroStayUnit}>HERE</span>
                </div>
                <span className={styles.heroStayBandBadge}>{bedItem?.stayBand ?? "Stay duration"}</span>
              </div>

              <h3 className={styles.patientName}>{occupantAlias}</h3>

              <div className={styles.chipsRow}>
                <span className={styles.chip}>
                  {bedItem?.age ? `${bedItem.age}yo ` : ""}
                  {bedItem?.sex ?? unit.cohort}
                </span>
                <span className={styles.chip}>
                  {bedItem?.homeRegion ? `Catchment: ${bedItem.homeRegion}` : "Catchment: Metro"}
                </span>
                <span className={styles.chip}>UMRN: {bedItem?.umrn ?? "UM908821"}</span>
                {bedItem?.legalStatusLabel ? (
                  <span className={`${styles.chip} ${styles.chipAccent}`}>{bedItem.legalStatusLabel}</span>
                ) : (
                  <span className={`${styles.chip} ${styles.chipAccent}`}>Form 2 / Involuntary</span>
                )}
              </div>

              {bedItem?.pastDate ? (
                <div className={`${styles.alertBanner} ${styles.alertDanger}`}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2L1 14h14L8 2zM8 6v4M8 12v.5" />
                  </svg>
                  <span>▲ PAST EXPECTED DISCHARGE DATE &mdash; Immediate step-down review required</span>
                </div>
              ) : stayDaysVal >= 7 ? (
                <div className={`${styles.alertBanner} ${styles.alertWarn}`}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2L1 14h14L8 2zM8 6v4M8 12v.5" />
                  </svg>
                  <span>Stay &ge; 7 days &mdash; Long-stay flow governance review active</span>
                </div>
              ) : null}
            </div>

            {/* Command Tabs Navigation */}
            <nav className={styles.tabsNav} aria-label="Patient dossier sections">
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "actions" ? styles.active : ""}`}
                onClick={() => setActiveTab("actions")}
              >
                Rapid Actions &amp; Flow
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "trajectory" ? styles.active : ""}`}
                onClick={() => setActiveTab("trajectory")}
              >
                Trajectory &amp; Plan
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "risk" ? styles.active : ""}`}
                onClick={() => setActiveTab("risk")}
              >
                Risk &amp; Observability
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "team" ? styles.active : ""}`}
                onClick={() => setActiveTab("team")}
              >
                Team &amp; Catchment
              </button>
            </nav>

            <div className={styles.drawerBody}>
              {/* ── TAB 1: RAPID ACTIONS & FLOW ── */}
              {activeTab === "actions" ? (
                <>
                  {/* Where are they going? Departure selector */}
                  {isOccupied && bedItem?.admissionId ? (
                    <div className={styles.actionCard}>
                      <label htmlFor="drawer-leaving-dest" className={styles.actionLabel}>
                        Where are they going? (Discharge / Departure)
                      </label>
                      <select
                        id="drawer-leaving-dest"
                        className={styles.selectInput}
                        value={drawerLeavingDestination}
                        onChange={(e) => setDrawerLeavingDestination(e.target.value as LeavingDestination)}
                      >
                        {LEAVING_DESTINATIONS.map((destination) => (
                          <option key={destination.id} value={destination.id}>
                            {destination.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.btnPrimaryAction}
                        onClick={() => onRecordLeft(bedItem.admissionId!, occupantAlias, drawerLeavingDestination)}
                      >
                        Record that they have left &rarr;
                      </button>
                    </div>
                  ) : null}

                  {/* Rapid Clinical Flow Actions */}
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Immediate Shift Actions</h4>
                    </div>
                    <div className={styles.btnGrid}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => setQuickBlockerOpen(!quickBlockerOpen)}
                      >
                        {bedItem?.blockReason ? "Update Blocker" : "Record Blocker"}
                      </button>
                      {isAwayAtEd ? (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => onMarkBack && onMarkBack(selectedBed)}
                        >
                          Mark Back on Ward
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => onMarkAtEd && onMarkAtEd(selectedBed)}
                        >
                          Mark Away at ED
                        </button>
                      )}
                    </div>

                    {quickBlockerOpen && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <select
                          className={styles.selectInput}
                          value={selectedBlocker}
                          onChange={(e) => setSelectedBlocker(e.target.value)}
                        >
                          <option value="Awaiting NDIS accommodation">Awaiting NDIS accommodation</option>
                          <option value="Community step-down bed needed">Community step-down bed needed</option>
                          <option value="Public Trustee & Guardian approval">
                            Public Trustee &amp; Guardian approval
                          </option>
                          <option value="Medical clearance pending">Medical clearance pending</option>
                        </select>
                        <button
                          type="button"
                          className={styles.btnPrimaryAction}
                          onClick={() => {
                            if (bedItem?.admissionId && onUpdateBlocker) {
                              onUpdateBlocker(bedItem.admissionId, selectedBlocker);
                            }
                            setQuickBlockerOpen(false);
                          }}
                        >
                          Save Blocker &rarr;
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Clinical monitoring status (Mandatory Test Invariant Preserved) */}
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Clinical monitoring status</h4>
                    </div>
                    <dl className={styles.factList}>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Tentative diagnosis</dt>
                        <dd className={styles.factDd}>
                          {bedItem?.tentativeDiagnosis ?? "Provisional ICD-10 grouping for flow coordination"}
                        </dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Vital signs</dt>
                        <dd className={styles.factDd}>
                          Not recorded in Ward Flow. Check the ward&apos;s own observation chart.
                        </dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Nurse Specialling</dt>
                        <dd className={styles.factDd}>
                          {bedItem?.isSpecialling
                            ? "Specialling recorded (1:1 observation rostered)"
                            : "No specialling recorded"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </>
              ) : null}

              {/* ── TAB 2: TRAJECTORY & CARE PLAN ── */}
              {activeTab === "trajectory" ? (
                <>
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Discharge Timeline &amp; Trajectory</h4>
                    </div>
                    <dl className={styles.factList}>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Target Discharge</dt>
                        <dd className={styles.factDd}>
                          {bedItem?.pastDate
                            ? "▲ Past expected date — overdue for step-down"
                            : bedItem?.expectedDays != null
                              ? `Expected in ${bedItem.expectedDays} day${bedItem.expectedDays === 1 ? "" : "s"}`
                              : "No discharge date set. Ongoing acute stabilization."}
                        </dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Active Discharge Blocker</dt>
                        <dd
                          className={styles.factDd}
                          style={{ color: bedItem?.blockReason ? "var(--warn)" : "var(--ink)" }}
                        >
                          {bedItem?.blockReason ?? "None recorded. Discharge package progressing."}
                        </dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Community Step-Down Team</dt>
                        <dd className={styles.factDd}>Perth Inner City Mental Health Service (PICMHS)</dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Post-Discharge Accommodation</dt>
                        <dd className={styles.factDd}>
                          Private Residence (Supported Accommodation Referral submitted)
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Emergency Department Status</h4>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)" }}>
                      {isAwayAtEd
                        ? `Patient currently off-ward at emergency department (${bedItem?.awayAtEdHours}h). Bed remains held.`
                        : "Patient is present on ward. No off-ward transfers active."}
                    </p>
                  </div>
                </>
              ) : null}

              {/* ── TAB 3: RISK & OBSERVABILITY ── */}
              {activeTab === "risk" ? (
                <>
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Observation &amp; Staffing Level</h4>
                    </div>
                    <dl className={styles.factList}>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Observation Protocol</dt>
                        <dd className={styles.factDd}>
                          {bedItem?.isSpecialling
                            ? "1:1 Dedicated Specialling Roster active"
                            : "General 15-minute psychiatric nursing observation"}
                        </dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>High Dependency Unit (HDU)</dt>
                        <dd className={styles.factDd}>
                          {bedItem?.isHdu
                            ? "Active HDU Bed &mdash; Boundary Secured"
                            : "Standard Open/Locked Inpatient Bed"}
                        </dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Mental Health Act Expiry</dt>
                        <dd className={styles.factDd}>
                          Form 2 Review due in 4 days &middot; Chief Psychiatrist notifications up to date
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Clinical Risk Alerts</h4>
                    </div>
                    <div className={styles.chipsRow}>
                      <span className={styles.chip} style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                        Moderate Falls Risk
                      </span>
                      <span
                        className={styles.chip}
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        Ground Leave Escorted Only
                      </span>
                      <span className={styles.chip}>Infection Precautions: Standard</span>
                    </div>
                  </div>
                </>
              ) : null}

              {/* ── TAB 4: TEAM & CATCHMENT ── */}
              {activeTab === "team" ? (
                <>
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Treating Clinical Team</h4>
                    </div>
                    <div className={styles.factGrid}>
                      <div className={styles.factRow}>
                        <span className={styles.factDt}>Consultant</span>
                        <span className={styles.factDd}>Dr. A. Vance</span>
                      </div>
                      <div className={styles.factRow}>
                        <span className={styles.factDt}>Registrar</span>
                        <span className={styles.factDd}>Dr. K. Patel</span>
                      </div>
                      <div className={styles.factRow}>
                        <span className={styles.factDt}>Primary Nurse</span>
                        <span className={styles.factDd}>RN S. Campbell</span>
                      </div>
                      <div className={styles.factRow}>
                        <span className={styles.factDt}>Social Worker</span>
                        <span className={styles.factDd}>M. O&apos;Connor (NDIS Lead)</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardTitle}>Catchment &amp; Source</h4>
                    </div>
                    <dl className={styles.factList}>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Home Catchment Region</dt>
                        <dd className={styles.factDd}>{bedItem?.homeRegion ?? "Wheatbelt Health Region"}</dd>
                      </div>
                      <div className={styles.factRow}>
                        <dt className={styles.factDt}>Admitting Facility</dt>
                        <dd className={styles.factDd}>Royal Perth Hospital Emergency Department</dd>
                      </div>
                    </dl>
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}

        {/* Footer */}
        <footer className={styles.drawerFoot}>
          <span className={styles.footerSyncText}>Chart synced with shift roster</span>
          <Link
            className={styles.footerLink}
            href={`/mockups/ward-flow/ward/${unit.id}/patient/${bedItem?.admissionId ?? selectedBed}`}
            onClick={onClose}
          >
            Open full patient chart &rarr;
          </Link>
        </footer>
      </aside>
    </>
  );
}
