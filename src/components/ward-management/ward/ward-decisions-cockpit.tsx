"use client";

import React, { useState, useEffect } from "react";
import type { Unit } from "@/components/ward-management/ward-model";
import styles from "./ward-decisions-cockpit.module.css";

interface WardDecisionsCockpitProps {
  unit: Unit;
}

interface AuditEvent {
  id: string;
  title: string;
  detail: string;
  time: string;
  actor: string;
}

export function WardDecisionsCockpit({ unit }: WardDecisionsCockpitProps) {
  // State for decisions
  const physicalBeds = unit.beds > 0 ? unit.beds : 20;
  const occupiedBeds = 18;
  const [staffedBeds, setStaffedBeds] = useState<number>(18);
  const [handshakeConfirmed, setHandshakeConfirmed] = useState<boolean>(true);

  const [intakeDecision, setIntakeDecision] = useState<"pending" | "accepted" | "declined" | "mo_requested">("pending");
  const [departureDecision, setDepartureDecision] = useState<"pending" | "authorized">("pending");
  const [ndisDecision, setNdisDecision] = useState<"pending" | "escalated" | "postponed">("pending");
  const [s17Decision, setS17Decision] = useState<"pending" | "returned" | "extended" | "breached">("pending");
  const [bed06Decision, setBed06Decision] = useState<"blocked" | "lifted">("blocked");

  const [activeFilter, setActiveFilter] = useState<"all" | "urgent" | "barriers" | "governance">("all");
  const [highlightedGate, setHighlightedGate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [mdtModalOpen, setMdtModalOpen] = useState(false);
  const [mdtCategory, setMdtCategory] = useState("NDIS Housing Lease / SIL Barrier");
  const [mdtText, setMdtText] = useState("Awaiting NDIS accommodation provider call back.");

  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("clinical_mismatch");
  const [declineNotes, setDeclineNotes] = useState("");

  // Audit Trail
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([
    {
      id: "a1",
      title: "Morning Shift Roll-up Signed Off",
      detail: "Declared 18 staffed / 20 physical beds (1:1 specialling limiter recorded)",
      time: "10:22 AWST",
      actor: `NUM ${unit.name || "Dabakarn"}`,
    },
    {
      id: "a2",
      title: "Bed 02 Released to Turnover",
      detail: "Discharge handover signed off; bed cleared for sanitization",
      time: "09:15 AWST",
      actor: "Shift Coordinator Taylor",
    },
  ]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  }

  function addAudit(title: string, detail: string, actor = `NUM ${unit.name || "Dabakarn"}`) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} AWST`;
    setAuditEvents((prev) => [{ id: "aud-" + Date.now(), title, detail, time: timeStr, actor }, ...prev]);
  }

  // Keyboard accessibility for modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMdtModalOpen(false);
        setDeclineModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function jumpToGate(gateId: string) {
    setActiveFilter("all");
    setHighlightedGate(gateId);
    const el = document.getElementById(gateId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      setHighlightedGate((cur) => (cur === gateId ? null : cur));
    }, 2500);
  }

  // Derived counts for filters
  const urgentCount = (intakeDecision === "pending" ? 1 : 0) + (departureDecision === "pending" ? 1 : 0);
  const barrierCount = ndisDecision === "pending" ? 1 : 0;
  const governanceCount = (s17Decision === "pending" ? 1 : 0) + (bed06Decision === "blocked" ? 1 : 0);

  const hasStaffingDeficit = staffedBeds < occupiedBeds;

  return (
    <div className={styles.cockpitWrap} id="wardDecisionsCockpit">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 10000,
            background: "#0f172a",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "6px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
            fontSize: "0.88rem",
            fontWeight: 600,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* ── Top Decision Banner ── */}
      <section className={styles.cockpitBanner} aria-label="Pure Decision Cockpit Protocol">
        <div className={styles.bannerLeft}>
          <span className={styles.bannerTitle}>💡 Pure Ward Decision &amp; Sign-Off Cockpit</span>
          <span className={styles.bannerRuleTag}>NON-DUPLICATION RULE APPLIED</span>
          <p className={styles.bannerSubtext}>
            This tab strictly contains <strong>clinical &amp; operational human sign-offs</strong> required from ward
            staff. Physical bed states live on <strong>Beds ({physicalBeds})</strong>, patient transport journeys on{" "}
            <strong>Arrivals (2)</strong>, and pharmacy scripts/TTAs on <strong>Discharges (15)</strong>.
          </p>
        </div>
        <div className={styles.bannerClock}>
          <span className={styles.bannerClockDot} />
          <span>Shift Clock: 12:29 AWST</span>
        </div>
      </section>

      {/* ── Shift Decision Milestones & Progress Gates (Option 2) ── */}
      <section className={styles.milestonesWrap} aria-label="Shift Milestones & Progress Gates">
        <div className={styles.milestonesHead}>
          <div className={styles.milestonesTitle}>
            <span>⏱️</span>
            <span>Shift Decision Milestones &amp; Progress Gates</span>
            <small style={{ fontWeight: "normal", color: "var(--muted)", marginLeft: "6px" }}>
              Chronological clinical gates for {unit.name || "Dabakarn"} Day Shift (07:00–15:30) · Click gate to
              navigate
            </small>
          </div>
          <span className={styles.bannerClock} style={{ fontSize: "0.78rem" }}>
            <span className={styles.bannerClockDot} />
            <span>Current: 12:29 AWST (Midday Window)</span>
          </span>
        </div>

        <div className={styles.milestonesGrid}>
          {/* Gate 1 */}
          <button
            type="button"
            className={`${styles.milestoneCard} ${highlightedGate === "gate-1" ? styles.activeWindow : ""}`}
            onClick={() => jumpToGate("gate-1")}
          >
            <div className={styles.milestoneTop}>
              <span className={styles.milestoneGate}>GATE 1 · 07:00–09:30</span>
              {hasStaffingDeficit ? (
                <span className={`${styles.milestoneBadge} ${styles.badgeActionDue}`}>⚠️ Deficit (Overcapacity)</span>
              ) : (
                <span className={`${styles.milestoneBadge} ${styles.badgeComplete}`}>✓ Complete</span>
              )}
            </div>
            <div className={styles.milestoneName}>Morning Handshake</div>
            <div className={styles.milestoneDetail}>
              {hasStaffingDeficit
                ? `${staffedBeds} Staffed < ${occupiedBeds} Occupied · Deficit Escalation`
                : `${staffedBeds} Staffed / ${physicalBeds} Physical · Handshake verified`}
            </div>
          </button>

          {/* Gate 2 */}
          <button
            type="button"
            className={`${styles.milestoneCard} ${highlightedGate === "gate-2" ? styles.activeWindow : ""}`}
            onClick={() => jumpToGate("gate-2")}
          >
            <div className={styles.milestoneTop}>
              <span className={styles.milestoneGate}>GATE 2 · 09:30–13:00</span>
              {intakeDecision === "pending" ? (
                <span className={`${styles.milestoneBadge} ${styles.badgeActionDue}`}>🚨 Action Due</span>
              ) : (
                <span className={`${styles.milestoneBadge} ${styles.badgeComplete}`}>✓ Complete</span>
              )}
            </div>
            <div className={styles.milestoneName}>Intake &amp; Admission Sign-off</div>
            <div className={styles.milestoneDetail}>
              {intakeDecision === "pending"
                ? "Aaron K. (45m ED SLA) · Bed 04 proposed"
                : intakeDecision === "accepted"
                  ? "Aaron K. allocated to Bed 04"
                  : intakeDecision === "declined"
                    ? "Aaron K. referral declined"
                    : "ED MO review requested"}
            </div>
          </button>

          {/* Gate 3 */}
          <button
            type="button"
            className={`${styles.milestoneCard} ${highlightedGate === "gate-3" ? styles.activeWindow : ""}`}
            onClick={() => jumpToGate("gate-3")}
          >
            <div className={styles.milestoneTop}>
              <span className={styles.milestoneGate}>GATE 3 · 11:00–14:00</span>
              {departureDecision === "pending" || ndisDecision === "pending" ? (
                <span className={`${styles.milestoneBadge} ${styles.badgeWarning}`}>
                  {departureDecision === "pending" ? "1 Release Ready" : "0 Release"} ·{" "}
                  {ndisDecision === "pending" ? "1 Barrier Active" : "0 Barrier"}
                </span>
              ) : (
                <span className={`${styles.milestoneBadge} ${styles.badgeComplete}`}>✓ Complete</span>
              )}
            </div>
            <div className={styles.milestoneName}>Departures &amp; Barrier Escalation</div>
            <div className={styles.milestoneDetail}>
              {departureDecision === "authorized" ? "Keira departed" : "Keira P. release ready"} ·{" "}
              {ndisDecision === "escalated" ? "Rowan escalated to SW" : "Rowan NDIS delay"}
            </div>
          </button>

          {/* Gate 4 */}
          <button
            type="button"
            className={`${styles.milestoneCard} ${highlightedGate === "gate-4" ? styles.activeWindow : ""}`}
            onClick={() => jumpToGate("gate-4")}
          >
            <div className={styles.milestoneTop}>
              <span className={styles.milestoneGate}>GATE 4 · 14:00–18:00</span>
              {s17Decision === "pending" || bed06Decision === "blocked" ? (
                <span className={`${styles.milestoneBadge} ${styles.badgeNeutral}`}>⏳ Due 13:00</span>
              ) : (
                <span className={`${styles.milestoneBadge} ${styles.badgeComplete}`}>✓ Complete</span>
              )}
            </div>
            <div className={styles.milestoneName}>S17 Leave &amp; Afternoon Census</div>
            <div className={styles.milestoneDetail}>
              {s17Decision === "returned" ? "Marcus returned" : "Marcus V. leave due 13:00"} ·{" "}
              {bed06Decision === "lifted" ? "Bed 06 cleared" : "Bed 06 block"}
            </div>
          </button>
        </div>
      </section>

      {/* ── Action Queue Filter Strip (Option 1) ── */}
      <section className={styles.filterStrip} aria-label="Action Queue Filters">
        <div className={styles.filterSummary}>
          <span>Action Queue</span>
          {urgentCount > 0 ? (
            <span style={{ color: "#dc2626", fontWeight: 700 }}>{urgentCount} Decisions Awaiting Immediate Action</span>
          ) : (
            <span style={{ color: "#16a34a", fontWeight: 700 }}>All Shift Actions Signed Off ✓</span>
          )}
          {barrierCount > 0 && (
            <span style={{ color: "#d97706", fontWeight: 600 }}>&middot; {barrierCount} Flow Barrier</span>
          )}
        </div>

        <div className={styles.filterPills}>
          <button
            type="button"
            className={`${styles.filterPill} ${activeFilter === "all" ? styles.activePill : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            <span>All Gates</span>
            <span className={styles.pillBadge}>4</span>
          </button>

          <button
            type="button"
            className={`${styles.filterPill} ${activeFilter === "urgent" ? styles.activePill : ""}`}
            onClick={() => setActiveFilter("urgent")}
          >
            <span>🚨 Immediate Actions</span>
            <span className={styles.pillBadge}>{urgentCount}</span>
          </button>

          <button
            type="button"
            className={`${styles.filterPill} ${activeFilter === "barriers" ? styles.activePill : ""}`}
            onClick={() => setActiveFilter("barriers")}
          >
            <span>⚠️ Barriers &amp; Escalation</span>
            <span className={styles.pillBadge}>{barrierCount}</span>
          </button>

          <button
            type="button"
            className={`${styles.filterPill} ${activeFilter === "governance" ? styles.activePill : ""}`}
            onClick={() => setActiveFilter("governance")}
          >
            <span>⚖️ Governance &amp; Capacity</span>
            <span className={styles.pillBadge}>{governanceCount}</span>
          </button>
        </div>
      </section>

      {/* Empty State for Immediate Actions */}
      {activeFilter === "urgent" && urgentCount === 0 && (
        <div className={styles.emptyState}>
          <div style={{ fontSize: "2rem" }}>🎉</div>
          <div className={styles.emptyTitle}>No Pending Urgent Actions</div>
          <div className={styles.emptySubtitle}>
            All immediate admission sign-offs and departure releases have been completed for this shift.
          </div>
          <button type="button" className={styles.btnSecondaryAction} onClick={() => setActiveFilter("all")}>
            Show All Shift Gates (4)
          </button>
        </div>
      )}

      {/* ── GATE 1: CAPACITY & STAFFING HANDSHAKE ── */}
      {(activeFilter === "all" || activeFilter === "governance") && (
        <section
          className={`${styles.gateSection} ${highlightedGate === "gate-1" ? styles.haloHighlight : ""}`}
          id="gate-1"
          aria-labelledby="gate1Heading"
        >
          <div className={styles.gateHeader}>
            <div className={styles.gateTitleWrap}>
              <span className={styles.gateIdTag}>GATE 1 · 07:00–09:30</span>
              <h3 className={styles.gateHeading} id="gate1Heading">
                Shift Capacity &amp; Staffing Handshake
              </h3>
            </div>
            {hasStaffingDeficit ? (
              <span className={`${styles.gateStatusBadge} ${styles.badgeActionDue}`}>
                ⚠️ Staffing Deficit · Pending Re-affirmation
              </span>
            ) : (
              <span className={`${styles.gateStatusBadge} ${styles.badgeComplete}`}>
                ✓ Morning Roll-up Verified (10:22)
              </span>
            )}
          </div>

          <div className={`${styles.decisionCard} ${hasStaffingDeficit ? styles.urgentCard : styles.goodCard}`}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span>Physical vs Staffed Capacity Declaration</span>
                {handshakeConfirmed && (
                  <span
                    className={`${styles.statusBadge} ${styles.badgeComplete}`}
                    style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  >
                    ✓ Handshake Confirmed
                  </span>
                )}
              </div>
              <div className={styles.cardTags}>
                <span className={styles.tagPill}>1:1 Specialling Active (Bed 02)</span>
                <span className={styles.tagPill}>High Acuity Deficit</span>
                <span className={styles.tagPill}>Physical Maintenance Block</span>
                <span className={styles.tagPill}>Bay 2 Female Cohort Lock</span>
              </div>
            </div>

            {hasStaffingDeficit && (
              <div
                style={{
                  background: "#fee2e2",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#991b1b",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                }}
              >
                ⚠️ STAFFING DEFICIT: {occupiedBeds} Occupied &gt; {staffedBeds} Staffed Allocatable Beds! Staffing
                deficit must be escalated.
              </div>
            )}

            <div className={styles.cardBody}>
              {unit.name || "Dabakarn"} has <strong>{physicalBeds} physical beds</strong>. Declare staffed and
              clinically allocatable beds for this shift.
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>PHYSICAL</span>
                <strong style={{ fontSize: "1.2rem" }}>{physicalBeds}</strong>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>OCCUPIED</span>
                <strong style={{ fontSize: "1.2rem", color: hasStaffingDeficit ? "#dc2626" : "inherit" }}>
                  {occupiedBeds}{" "}
                  <small style={{ fontSize: "0.8rem", fontWeight: "normal" }}>
                    ({Math.round((occupiedBeds / staffedBeds) * 100)}% {hasStaffingDeficit ? "OVERCAPACITY" : ""})
                  </small>
                </strong>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>
                  STAFFED ALLOCATABLE:
                </span>
                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  style={{ padding: "4px 10px" }}
                  onClick={() => {
                    const next = Math.max(12, staffedBeds - 1);
                    setStaffedBeds(next);
                    setHandshakeConfirmed(false);
                  }}
                  title="Decrement Staffed Beds"
                >
                  -
                </button>
                <strong style={{ fontSize: "1.2rem", minWidth: "28px", textAlign: "center" }}>{staffedBeds}</strong>
                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  style={{ padding: "4px 10px" }}
                  onClick={() => {
                    const next = Math.min(physicalBeds, staffedBeds + 1);
                    setStaffedBeds(next);
                    setHandshakeConfirmed(false);
                  }}
                  title="Increment Staffed Beds"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className={styles.btnPrimaryAction}
                onClick={() => {
                  setHandshakeConfirmed(true);
                  addAudit(
                    "Capacity Handshake Re-affirmed",
                    `Declared ${staffedBeds} staffed beds / ${physicalBeds} physical beds`,
                  );
                  showToast("Capacity Handshake Re-affirmed");
                }}
              >
                Re-affirm Handshake
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── GATE 2: INBOUND INTAKE & ADMISSION SIGN-OFF ── */}
      {(activeFilter === "all" || (activeFilter === "urgent" && intakeDecision === "pending")) && (
        <section
          className={`${styles.gateSection} ${highlightedGate === "gate-2" ? styles.haloHighlight : ""}`}
          id="gate-2"
          aria-labelledby="gate2Heading"
        >
          <div className={styles.gateHeader}>
            <div className={styles.gateTitleWrap}>
              <span className={styles.gateIdTag}>GATE 2 · 09:30–13:00</span>
              <h3 className={styles.gateHeading} id="gate2Heading">
                Inbound Intake &amp; Admission Sign-Off
              </h3>
            </div>
            {intakeDecision === "pending" ? (
              <span className={`${styles.gateStatusBadge} ${styles.badgeActionDue}`}>1 Clinical Decision Due Now</span>
            ) : (
              <span className={`${styles.gateStatusBadge} ${styles.badgeComplete}`}>✓ Decision Recorded</span>
            )}
          </div>

          <div
            className={`${styles.decisionCard} ${intakeDecision === "pending" ? styles.urgentCard : styles.goodCard}`}
          >
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span>Aaron K. (32M) — RPH Emergency Department Referral</span>
              </div>
              <div className={styles.cardTags}>
                <span className={`${styles.tagPill} ${styles.tagUrgent}`}>45m Elapsed in ED (Target &le;60m)</span>
                <span className={styles.tagPill}>Referral #9021</span>
                <span className={styles.tagPill}>Form 3A Involuntary</span>
              </div>
            </div>

            <div className={styles.cardBody}>
              <strong>Diagnosis: Acute Bipolar Mania with Agitation.</strong> Central Bed Flow proposes{" "}
              {unit.name || "Dabakarn"} Bed 04 (Bay 1, High Obs). Senior registrar assessment recommends
              high-observation cohorting.
            </div>

            <div className={styles.cardMeta}>
              <span>Target: Bed 04 (Allocatable Upon Departure)</span>
              <span>&middot;</span>
              <span>Primary Nurse: Staffing Safe Ratio Available</span>
              <span>&middot;</span>
              <span>WA Health Clinical Governance Compliance</span>
            </div>

            {intakeDecision === "pending" ? (
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.btnPrimaryAction}
                  onClick={() => {
                    setIntakeDecision("accepted");
                    addAudit(
                      "Inbound Referral Accepted: Aaron K. allocated to Bed 04 (Form 3A)",
                      "Allocated upon departure of Keira P.",
                    );
                    showToast("Aaron K. accepted to Bed 04");
                  }}
                >
                  ✓ Accept to Bed 04
                </button>

                <button type="button" className={styles.btnDeclineAction} onClick={() => setDeclineModalOpen(true)}>
                  ✕ Decline Referral
                </button>

                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  onClick={() => {
                    setIntakeDecision("mo_requested");
                    addAudit(
                      "Clarification Requested from ED MO",
                      "Clarification requested regarding high-acuity nursing needs",
                    );
                    showToast("Clarification requested from ED Medical Officer");
                  }}
                >
                  ⏳ Request ED MO Review
                </button>
              </div>
            ) : (
              <div className={styles.resolutionBanner}>
                <div className={styles.resolutionText}>
                  <span>
                    ✓ Inbound Referral{" "}
                    {intakeDecision === "accepted"
                      ? "Accepted · Allocated to Bed 04"
                      : intakeDecision === "declined"
                        ? "Declined"
                        : "ED MO Review Requested"}
                  </span>
                  <span className={styles.resolutionSubtext}>
                    {intakeDecision === "accepted"
                      ? "Aaron K. admitted under Form 3A. Bed allocated upon departure of Keira P."
                      : intakeDecision === "declined"
                        ? "Referral declined and redirected back to Central Bed Flow."
                        : "Awaiting ED Medical Officer clinical review clarification."}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.btnUndoAction}
                  onClick={() => {
                    setIntakeDecision("pending");
                    showToast("Aaron K. decision reversed to pending");
                  }}
                >
                  ↺ Undo Decision
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── GATE 3: DEPARTURE AUTHORIZATIONS & BARRIER ESCALATION ── */}
      {(activeFilter === "all" ||
        (activeFilter === "urgent" && departureDecision === "pending") ||
        (activeFilter === "barriers" && ndisDecision === "pending")) && (
        <section
          className={`${styles.gateSection} ${highlightedGate === "gate-3" ? styles.haloHighlight : ""}`}
          id="gate-3"
          aria-labelledby="gate3Heading"
        >
          <div className={styles.gateHeader}>
            <div className={styles.gateTitleWrap}>
              <span className={styles.gateIdTag}>GATE 3 · 11:00–14:00</span>
              <h3 className={styles.gateHeading} id="gate3Heading">
                Departure Authorizations &amp; Barrier Escalation
              </h3>
            </div>
            {departureDecision === "pending" || ndisDecision === "pending" ? (
              <span className={`${styles.gateStatusBadge} ${styles.badgeWarning}`}>
                {departureDecision === "pending" ? "1 Release Ready" : "0 Release"} ·{" "}
                {ndisDecision === "pending" ? "1 Barrier Active" : "0 Barrier"}
              </span>
            ) : (
              <span className={`${styles.gateStatusBadge} ${styles.badgeComplete}`}>
                ✓ Departures &amp; Barriers Processed
              </span>
            )}
          </div>

          {/* Keira Pellingworth */}
          {(activeFilter === "all" || activeFilter === "urgent") && (
            <div
              className={`${styles.decisionCard} ${
                departureDecision === "pending" ? styles.goodCard : styles.goodCard
              }`}
            >
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>
                  <span>Bed 04: Keira Pellingworth (UM100045)</span>
                </div>
                <div className={styles.cardTags}>
                  <span className={`${styles.tagPill} ${styles.tagGood}`}>All Clearances Complete</span>
                  <span className={styles.tagPill}>Community Return</span>
                </div>
              </div>

              <div className={styles.cardBody}>
                Medical clearance &amp; pharmacy discharge scripts (TTAs) completed on /discharges. Escort has arrived
                at ward reception. Sign-off releases bed immediately to Environmental Services for turnaround cleaning.
              </div>

              <div className={styles.cardMeta}>
                <span>Linked Action: Vacates Bed 04 for incoming referral Aaron K.</span>
              </div>

              {departureDecision === "pending" ? (
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => {
                      setDepartureDecision("authorized");
                      addAudit(
                        "Clinical Bed Release Signed: Keira Pellingworth (Bed 04) cleared to turnover cleaning",
                        "Escort verified at reception",
                      );
                      showToast("Keira Pellingworth departure authorized");
                    }}
                  >
                    ✓ Authorize Departure &amp; Vacate Bed
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondaryAction}
                    onClick={() => showToast("Flagged delay for transport review")}
                  >
                    ⚠️ Flag Delay
                  </button>
                </div>
              ) : (
                <div className={styles.resolutionBanner}>
                  <div className={styles.resolutionText}>
                    <span>✓ Departure Authorized &amp; Bed 04 Vacated</span>
                    <span className={styles.resolutionSubtext}>
                      Released to Environmental Services for turnover cleaning (Order #3319). Escort verified.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.btnUndoAction}
                    onClick={() => {
                      setDepartureDecision("pending");
                      showToast("Keira departure reversed to pending");
                    }}
                  >
                    ↺ Undo Authorization
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rowan Ross - NDIS Barrier */}
          {(activeFilter === "all" || activeFilter === "barriers") && (
            <div
              className={`${styles.decisionCard} ${ndisDecision === "pending" ? styles.barrierCard : styles.goodCard}`}
            >
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>
                  <span>Bed 11: Rowan Ross (UM100089)</span>
                </div>
                <div className={styles.cardTags}>
                  <span className={`${styles.tagPill} ${styles.tagBarrier}`}>
                    Barrier: NDIS Supported Housing Unsigned
                  </span>
                  <span className={styles.tagPill}>Bed 11</span>
                </div>
              </div>

              <div className={styles.cardBody}>
                Patient clinically stable and cleared by MDT for 48 hours. Accommodation lease pending SIL provider
                signature. Patient cannot be safely discharged to no fixed address under duty of care.
              </div>

              <div className={styles.cardMeta}>
                <span>Delay Impact: Bed 11 blocked from intake pool</span>
                <span>&middot;</span>
                <span>NDIS Coordinator: Pending Call Back</span>
              </div>

              {ndisDecision === "pending" ? (
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.btnSecondaryAction}
                    onClick={() => {
                      setNdisDecision("escalated");
                      addAudit(
                        "NDIS Barrier Escalated to Senior Social Work & Hospital Flow Hub",
                        "Rowan Ross (Bed 11) - SIL Provider Delay",
                      );
                      showToast("Escalated to Social Work & Flow Hub");
                    }}
                  >
                    📞 Escalate to Social Work &amp; Flow
                  </button>

                  <button
                    type="button"
                    className={styles.btnSecondaryAction}
                    onClick={() => {
                      setNdisDecision("postponed");
                      addAudit(
                        "Discharge Postponed to Tomorrow: Rowan Ross (Bed 11)",
                        "Awaiting SIL accommodation lease",
                      );
                      showToast("Discharge postponed to tomorrow");
                    }}
                  >
                    ⏳ Postpone to Tomorrow (Hold Bed)
                  </button>

                  <button type="button" className={styles.btnSecondaryAction} onClick={() => setMdtModalOpen(true)}>
                    📝 Add MDT Note
                  </button>
                </div>
              ) : (
                <div className={styles.resolutionBanner}>
                  <div className={styles.resolutionText}>
                    <span>
                      ✓ Barrier Handled:{" "}
                      {ndisDecision === "escalated" ? "Escalated to Social Work & Flow Hub" : "Postponed to Tomorrow"}
                    </span>
                    <span className={styles.resolutionSubtext}>
                      {ndisDecision === "escalated"
                        ? "Flow Director notified. Senior Social Worker assigned for SIL provider liaison."
                        : "Bed held on ward overnight. Re-evaluation scheduled for 09:00 MDT handover."}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.btnUndoAction}
                    onClick={() => {
                      setNdisDecision("pending");
                      showToast("NDIS barrier reset to pending");
                    }}
                  >
                    ↺ Reset Barrier
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── GATE 4: PSYCHIATRIC LEAVE & BED RESTRICTIONS ── */}
      {(activeFilter === "all" || activeFilter === "governance") && (
        <section
          className={`${styles.gateSection} ${highlightedGate === "gate-4" ? styles.haloHighlight : ""}`}
          id="gate-4"
          aria-labelledby="gate4Heading"
        >
          <div className={styles.gateHeader}>
            <div className={styles.gateTitleWrap}>
              <span className={styles.gateIdTag}>GATE 4 · 14:00–18:00</span>
              <h3 className={styles.gateHeading} id="gate4Heading">
                Psychiatric Leave (Section 17) &amp; Bed Safety Restrictions
              </h3>
            </div>
            {s17Decision === "pending" || bed06Decision === "blocked" ? (
              <span className={`${styles.gateStatusBadge} ${styles.badgeNeutral}`}>2 Active Governance Items</span>
            ) : (
              <span className={`${styles.gateStatusBadge} ${styles.badgeComplete}`}>
                ✓ All Governance Items Resolved
              </span>
            )}
          </div>

          {/* Marcus V. Section 17 Leave */}
          <div className={`${styles.decisionCard} ${s17Decision === "pending" ? styles.goodCard : styles.goodCard}`}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span>Mental Health Act Section 17 Leave Decision</span>
              </div>
              <div className={styles.cardTags}>
                <span className={`${styles.tagPill} ${styles.tagBarrier}`}>Due Back in 31m (13:00 AWST)</span>
                <span className={styles.tagPill}>Bed 12</span>
              </div>
            </div>

            <div className={styles.cardBody}>
              <strong>Marcus V. (UM100092)</strong> on approved 4-hour unescorted community day leave. Decide whether to
              confirm safe return, grant authorized clinical extension, or declare leave breach under ward clinical
              protocol.
            </div>

            <div className={styles.cardMeta}>
              <span>Authorised Clinical Leave: Community Day Pass (Part 7 Div 2)</span>
              <span>&middot;</span>
              <span>Treating Team: Dr. R. Henderson (Consultant)</span>
            </div>

            {s17Decision === "pending" ? (
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.btnPrimaryAction}
                  onClick={() => {
                    setS17Decision("returned");
                    addAudit(
                      "S17 Leave Return Confirmed: Marcus V. returned to Bed 12",
                      "Mental State Exam completed. Section 17 leave closed.",
                      "Dr. R. Henderson",
                    );
                    showToast("Marcus V. return confirmed");
                  }}
                >
                  ✓ Confirm Patient Returned
                </button>

                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  onClick={() => {
                    setS17Decision("extended");
                    addAudit(
                      "Section 17 Leave Extended (+2h) for Marcus V.",
                      "Authorized by Consultant Psychiatrist Dr. R. Henderson",
                      "Dr. R. Henderson",
                    );
                    showToast("Section 17 leave extended by 2 hours");
                  }}
                >
                  ⏳ Extend Window (+2h)
                </button>

                <button
                  type="button"
                  className={styles.btnDeclineAction}
                  onClick={() => {
                    setS17Decision("breached");
                    addAudit(
                      "SECTION 17 LEAVE BREACH / AWOL DECLARED: Marcus V.",
                      "WA Police notification logged under Form 7A",
                      `NUM ${unit.name || "Dabakarn"}`,
                    );
                    showToast("Section 17 breach declared");
                  }}
                >
                  🚨 Declare Breach / AWOL
                </button>
              </div>
            ) : (
              <div className={styles.resolutionBanner}>
                <div className={styles.resolutionText}>
                  <span>
                    ✓{" "}
                    {s17Decision === "returned"
                      ? "Safe Return Confirmed: Marcus V."
                      : s17Decision === "extended"
                        ? "Leave Extended (+2h): Marcus V."
                        : "Section 17 Breach Recorded: Marcus V."}
                  </span>
                  <span className={styles.resolutionSubtext}>
                    {s17Decision === "returned"
                      ? "Verified returned to Bed 12. Mental State Exam completed. Section 17 leave closed."
                      : s17Decision === "extended"
                        ? "Leave window extended by 2 hours (new due time 15:00 AWST)."
                        : "Police notification logged under Form 7A."}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.btnUndoAction}
                  onClick={() => {
                    setS17Decision("pending");
                    showToast("Marcus V. leave decision reset");
                  }}
                >
                  ↺ Undo Action
                </button>
              </div>
            )}
          </div>

          {/* Bed 06 Safety Restriction */}
          <div className={`${styles.decisionCard} ${bed06Decision === "blocked" ? styles.goodCard : styles.goodCard}`}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span>Bed Safety Restriction (Infection Isolation Precaution)</span>
              </div>
              <div className={styles.cardTags}>
                <span className={`${styles.tagPill} ${styles.tagUrgent}`}>Bed 06 Restricted</span>
              </div>
            </div>

            <div className={styles.cardBody}>
              Bed 06 currently blocked from admissions due to droplet contact precautions (discharged contact patient
              awaiting UV air scrub).
            </div>

            <div className={styles.cardMeta}>
              <span>Infection Prevention &amp; Control Ticket #8812</span>
            </div>

            {bed06Decision === "blocked" ? (
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  onClick={() => {
                    setBed06Decision("lifted");
                    addAudit(
                      "Bed Restriction Lifted: Bed 06 cleared for intake",
                      "UV air scrub complete. Bed returned to allocatable intake pool.",
                      "Infection Prevention",
                    );
                    showToast("Bed 06 restriction lifted");
                  }}
                >
                  ✓ Lift Restriction (Clear for Intake)
                </button>
                <button
                  type="button"
                  className={styles.btnSecondaryAction}
                  onClick={() => showToast("Opened Place Bed Restriction Dialog")}
                >
                  + Place New Bed Restriction
                </button>
              </div>
            ) : (
              <div className={styles.resolutionBanner}>
                <div className={styles.resolutionText}>
                  <span>✓ Restriction Lifted · Bed 06 Cleared</span>
                  <span className={styles.resolutionSubtext}>
                    UV air scrub complete. Bed returned to allocatable intake pool.
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.btnUndoAction}
                  onClick={() => {
                    setBed06Decision("blocked");
                    showToast("Bed 06 re-imposed as restricted");
                  }}
                >
                  ↺ Re-impose Block
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Shift Audit Trail ── */}
      <section className={styles.auditSection} aria-label="Shift Audit Trail">
        <div className={styles.auditHeader}>
          <div className={styles.auditTitle}>
            <span>✓</span>
            <span>Completed Sign-Offs (Today&rsquo;s Shift Audit Trail)</span>
          </div>
          <span className={styles.auditSubhead}>Immutable WA Health clinical log &middot; 24-Hour Standard</span>
        </div>

        <div className={styles.auditList}>
          {auditEvents.map((evt) => (
            <div key={evt.id} className={styles.auditRow}>
              <div>
                <span className={styles.auditAction}>✓ {evt.title}</span>
                <span className={styles.auditDetail}>{evt.detail}</span>
              </div>
              <div className={styles.auditMeta}>
                <span>{evt.time}</span>
                <span style={{ margin: "0 6px" }}>&middot;</span>
                <span>{evt.actor}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MDT Clinical Note Modal ── */}
      {mdtModalOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="mdtModalTitle">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} id="mdtModalTitle">
                📝 Log MDT Discharge Planning Note
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setMdtModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="mdt-patient-bed" className={styles.formLabel}>
                  Patient &amp; Bed
                </label>
                <input
                  id="mdt-patient-bed"
                  type="text"
                  className={styles.formInput}
                  value="Rowan Ross (Bed 11)"
                  disabled
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="mdt-note-category" className={styles.formLabel}>
                  Note Category
                </label>
                <select
                  id="mdt-note-category"
                  className={styles.formSelect}
                  value={mdtCategory}
                  onChange={(e) => setMdtCategory(e.target.value)}
                >
                  <option value="NDIS Housing Lease / SIL Barrier">NDIS Housing Lease / SIL Barrier</option>
                  <option value="Discharge Coordination Update">Discharge Coordination Update</option>
                  <option value="Consultant Review Outcome">Consultant Review Outcome</option>
                  <option value="Pharmacy TTA Clearance">Pharmacy TTA Clearance</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="mdt-clinical-note" className={styles.formLabel}>
                  Clinical Note Text
                </label>
                <textarea
                  id="mdt-clinical-note"
                  className={styles.formTextarea}
                  value={mdtText}
                  onChange={(e) => setMdtText(e.target.value)}
                  placeholder="Enter detailed clinical progression or barrier update..."
                  rows={4}
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnSecondaryAction} onClick={() => setMdtModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimaryAction}
                onClick={() => {
                  setMdtModalOpen(false);
                  addAudit(`MDT Note Added: ${mdtCategory}`, `"${mdtText}" on Rowan Ross (Bed 11)`);
                  showToast("MDT Note saved and logged to audit trail");
                }}
              >
                Save &amp; Log Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decline Referral Modal ── */}
      {declineModalOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="declineModalTitle">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} id="declineModalTitle">
                ✕ Decline Referral: Aaron K.
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setDeclineModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="decline-refusal-reason" className={styles.formLabel}>
                  Mandatory WA Health Refusal Reason
                </label>
                <select
                  id="decline-refusal-reason"
                  className={styles.formSelect}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                >
                  <option value="clinical_mismatch">
                    Clinical Mismatch: Security / Acuity requires High Dependency Unit
                  </option>
                  <option value="high_acuity_staffing">High Acuity Staffing Deficit: Ratios exceeded on ward</option>
                  <option value="cohort_lock">Gender / Vulnerability Cohort Lock</option>
                  <option value="physical_maintenance">Physical Maintenance / Infection Precaution Block</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="decline-clinical-rationale" className={styles.formLabel}>
                  Clinical Rationale &amp; Escalation Notes
                </label>
                <textarea
                  id="decline-clinical-rationale"
                  className={styles.formTextarea}
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                  placeholder="Detail clinical discussion with ED Registrar and on-call consultant..."
                  rows={4}
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnSecondaryAction} onClick={() => setDeclineModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnDeclineAction}
                onClick={() => {
                  setDeclineModalOpen(false);
                  setIntakeDecision("declined");
                  addAudit(
                    `Referral Declined: Aaron K. (${declineReason})`,
                    declineNotes ? `Reason notes: ${declineNotes}` : "Clinical mismatch escalated to Bed Flow",
                  );
                  showToast("Aaron K. referral declined");
                }}
              >
                Confirm Decline &amp; Escalate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
