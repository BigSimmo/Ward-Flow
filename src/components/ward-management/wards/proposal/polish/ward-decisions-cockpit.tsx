"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { Unit } from "@/components/ward-management/ward-model";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import styles from "./ward-decisions-cockpit.module.css";

interface AuditRecord {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  author: string;
}

export interface WardDecisionsCockpitProps {
  unit: Unit;
  demonstration?: boolean;
}

export function WardDecisionsCockpit({ unit, demonstration = false }: WardDecisionsCockpitProps) {
  if (!demonstration)
    return (
      <section className={styles.container} aria-label="Ward decision controls">
        <h2>Decision cockpit</h2>
        <p>
          Not wired in this prototype. This illustrative cockpit does not record clinical decisions or send messages.
        </p>
        <p>Use the ward overview, arrival and discharge controls for supported record updates.</p>
      </section>
    );
  return <WardDecisionsDemonstration unit={unit} />;
}

function WardDecisionsDemonstration({ unit }: { unit: Unit }) {
  // Polish: the shift clock reads the demo clock instead of a fixed "12:29".
  const shiftClock = formatInstant(useWardFlowClock());
  // ─── Shift Capacity Handshake (Gate 1) ───
  const physicalBeds = unit.beds ?? 20;
  const occupiedBeds = 18;
  const [staffedBeds, setStaffedBeds] = useState(18);
  const [censusAffirmed, setCensusAffirmed] = useState(true);
  const [limiters, setLimiters] = useState({
    specialling: true,
    deficit: false,
    maintenance: false,
    genderLock: true,
  });

  // ─── Decisions States (Gates 2, 3, 4) ───
  const [intakeState, setIntakeState] = useState<"pending" | "accepted" | "declined" | "deferred">("pending");
  const [keiraState, setKeiraState] = useState<"pending" | "authorized" | "delayed">("pending");
  const [rowanState, setRowanState] = useState<"pending" | "escalated" | "postponed">("pending");
  const [marcusState, setMarcusState] = useState<"pending" | "returned" | "extended" | "awol">("pending");
  const [bed06State, setBed06State] = useState<"restricted" | "cleared">("restricted");

  // ─── Modals & UI States ───
  const [activeFilter, setActiveFilter] = useState<"all" | "urgent" | "barriers" | "governance">("all");
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [barrierModalOpen, setBarrierModalOpen] = useState(false);
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const openDeclineModal = () => {
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;
    setDeclineModalOpen(true);
  };

  const closeDeclineModal = () => {
    setDeclineModalOpen(false);
    lastActiveElementRef.current?.focus?.();
  };

  const openBarrierModal = () => {
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;
    setBarrierModalOpen(true);
  };

  const closeBarrierModal = () => {
    setBarrierModalOpen(false);
    lastActiveElementRef.current?.focus?.();
  };

  const openHandoverModal = () => {
    lastActiveElementRef.current = document.activeElement as HTMLElement | null;
    setHandoverModalOpen(true);
  };

  const closeHandoverModal = () => {
    setHandoverModalOpen(false);
    lastActiveElementRef.current?.focus?.();
  };

  // Form selections
  const [declineReason, setDeclineReason] = useState("acuity");
  const [barrierPathway, setBarrierPathway] = useState("social-work");
  const [declineNotes, setDeclineNotes] = useState("");
  const [barrierNotes, setBarrierNotes] = useState("");

  const isDeclineDirty = declineNotes.trim().length > 0;
  const { clearDraft: clearDeclineDraft } = useDirtyStateGuard({
    key: `cockpit-decline-${unit.id}`,
    isDirty: isDeclineDirty,
    value: declineNotes,
    onRestore: (cached) => {
      setDeclineNotes(cached);
      setDeclineModalOpen(true);
    },
    confirmMessage: "You have an unsaved clinical decline rationale. Are you sure you want to leave?",
  });

  const isBarrierDirty = barrierNotes.trim().length > 0;
  const { clearDraft: clearBarrierDraft } = useDirtyStateGuard({
    key: `cockpit-barrier-${unit.id}`,
    isDirty: isBarrierDirty,
    value: barrierNotes,
    onRestore: (cached) => {
      setBarrierNotes(cached);
      setBarrierModalOpen(true);
    },
    confirmMessage: "You have an unsaved discharge barrier note. Are you sure you want to leave?",
  });

  // Modal keyboard accessibility (Escape key dismissal & focus restoration)
  useEffect(() => {
    if (!declineModalOpen && !barrierModalOpen && !handoverModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDeclineModalOpen(false);
        setBarrierModalOpen(false);
        setHandoverModalOpen(false);
        lastActiveElementRef.current?.focus?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [declineModalOpen, barrierModalOpen, handoverModalOpen]);

  // ─── Fictional Demonstration Log ───
  const [auditLog, setAuditLog] = useState<AuditRecord[]>([
    {
      id: "a1",
      icon: "✓",
      title: "Morning Shift Roll-up Signed Off",
      detail: "Declared 18 staffed / 20 physical beds (1:1 specialling limiter recorded)",
      time: "10:22 AWST",
      author: `NUM ${unit.name}`,
    },
    {
      id: "a2",
      icon: "✓",
      title: "Bed 02 Released to Turnover",
      detail: "Discharge handover signed off; bed cleared for sanitization",
      time: "09:15 AWST",
      author: "Shift Coordinator Taylor",
    },
  ]);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastText(
      `Demonstration preview only: ${msg}. Not wired in this prototype; no clinical record was changed and no message was sent.`,
    );
    toastTimeoutRef.current = setTimeout(() => {
      setToastText(null);
    }, 3200);
  }, []);

  const addAuditItem = useCallback(
    (icon: string, title: string, detail: string) => {
      const nowTime = new Date().toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Australia/Perth",
      });
      const newItem: AuditRecord = {
        id: `aud-${Date.now()}`,
        icon,
        title: `Demonstration only: ${title}`,
        detail: `Simulated scenario: ${detail} No clinical record was changed and no message was sent.`,
        time: `${nowTime} AWST`,
        author: `NUM ${unit.name}`,
      };
      setAuditLog((prev) => [newItem, ...prev]);
    },
    [unit.name],
  );

  // ─── Actions & Handlers ───
  const toggleLimiter = (key: keyof typeof limiters) => {
    setLimiters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const adjustStaffed = (delta: number) => {
    setStaffedBeds((prev) => Math.max(1, Math.min(physicalBeds, prev + delta)));
  };

  const affirmCensus = () => {
    setCensusAffirmed(true);
    addAuditItem(
      "✓",
      "Capacity Handshake Re-affirmed",
      `Staffed capacity verified at ${staffedBeds} of ${physicalBeds} beds.`,
    );
    showToast(`Staffed capacity affirmed: ${staffedBeds} beds`);
  };

  // Intake Handlers
  const handleAcceptIntake = () => {
    setIntakeState("accepted");
    clearDeclineDraft();
    setDeclineNotes("");
    addAuditItem("✓", "Inbound Referral Accepted", "A.K. allocated to Bed 04 upon departure of K.P..");
    showToast("A.K. accepted into Bed 04");
  };

  const handleDeclineIntakeSubmit = () => {
    setIntakeState("declined");
    closeDeclineModal();
    clearDeclineDraft();
    setDeclineNotes("");
    addAuditItem("✕", "Referral Declined", `A.K. declined: Reason: ${declineReason}. Escalated to Central Bed Flow.`);
    showToast("Referral declined and logged to Central Bed Flow");
  };

  const handleDeferIntake = () => {
    setIntakeState("deferred");
    clearDeclineDraft();
    setDeclineNotes("");
    addAuditItem("⏳", "ED MO Review Requested", "A.K. deferred pending emergency medical officer reassessment.");
    showToast("ED MO Review requested. SLA timer paused.");
  };

  const handleUndoIntake = () => {
    setIntakeState("pending");
    addAuditItem("↺", "Intake Decision Reversed", "A.K. returned to pending intake triage.");
    showToast("Intake decision undone");
  };

  // Departure Handlers
  const handleAuthorizeDeparture = () => {
    setKeiraState("authorized");
    addAuditItem("✓", "Departure Authorized", "K.P. departed ward. Bed 04 vacated and released for turnover cleaning.");
    showToast("K.P. departed · Bed 04 released to cleaning");
  };

  const handleUndoDeparture = () => {
    setKeiraState("pending");
    addAuditItem("↺", "Departure Authorization Rolled Back", "K.P. returned to active census.");
    showToast("Departure authorization undone");
  };

  // Barrier Handlers
  const handleEscalateBarrierSubmit = () => {
    setRowanState("escalated");
    closeBarrierModal();
    clearBarrierDraft();
    setBarrierNotes("");
    addAuditItem(
      "📞",
      "Discharge Barrier Escalated",
      `R.R. (Bed 11) escalated to ${barrierPathway} for urgent NDIS housing resolution.`,
    );
    showToast("Barrier escalated to Social Work & Flow Manager");
  };

  const handlePostponeDischarge = () => {
    setRowanState("postponed");
    clearBarrierDraft();
    setBarrierNotes("");
    addAuditItem("⏳", "Discharge Postponed", "R.R. (Bed 11) discharge deferred to tomorrow.");
    showToast("Discharge postponed to tomorrow");
  };

  const handleUndoBarrier = () => {
    setRowanState("pending");
    addAuditItem("↺", "Barrier Escalation Rolled Back", "R.R. returned to active barrier review.");
    showToast("Barrier escalation undone");
  };

  // Marcus Leave Handlers
  const handleConfirmReturn = () => {
    setMarcusState("returned");
    addAuditItem("✓", "Leave Return Confirmed", "M.V. returned safely to Bed 12. Mental state exam verified.");
    showToast("M.V. confirmed returned to ward");
  };

  const handleExtendLeave = () => {
    setMarcusState("extended");
    addAuditItem("⏳", "Leave Window Extended", "M.V. leave window extended (New return: 15:00 AWST).");
    showToast("Leave window extended");
  };

  const handleDeclareAwol = () => {
    setMarcusState("awol");
    addAuditItem(
      "🚨",
      "Leave Overdue / AWOL Declared",
      "Demonstration only: no absence declaration has been recorded.",
    );
    showToast("AWOL alert broadcast to hospital security");
  };

  const handleUndoMarcus = () => {
    setMarcusState("pending");
    addAuditItem("↺", "Leave Decision Rolled Back", "M.V. returned to pending leave return queue.");
    showToast("Leave decision undone");
  };

  // Bed 06 Handlers
  const handleLiftBed06 = () => {
    setBed06State("cleared");
    addAuditItem(
      "✓",
      "Bed Safety Precaution Lifted",
      "Bed 06 droplet contact restriction lifted following UV air scrub verification.",
    );
    showToast("Bed 06 cleared and released to intake pool");
  };

  const handleRestoreBed06 = () => {
    setBed06State("restricted");
    addAuditItem("↺", "Restriction Re-Imposed", "Bed 06 droplet restriction re-imposed.");
    showToast("Bed 06 restriction re-imposed");
  };

  // Scroll to gate
  const jumpToGate = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Calculate active pending counts
  const pendingIntakes = intakeState === "pending" ? 1 : 0;
  const pendingDepartures = keiraState === "pending" ? 1 : 0;
  const pendingBarriers = rowanState === "pending" ? 1 : 0;
  const pendingLeave = marcusState === "pending" ? 1 : 0;
  const totalPending = pendingIntakes + pendingDepartures + pendingBarriers + pendingLeave;

  return (
    <div className={styles.container}>
      <p role="note">
        Demonstration only. All people, events and actions below are illustrative; no clinical record is changed and no
        message is sent.
      </p>
      {/* ─── Header Non-Duplication Contract Banner ─── */}
      <div className={styles.contractBanner}>
        <div>
          <div className={styles.contractTitle}>
            <span>Illustrative decision cockpit</span>
            <span
              className={`${styles.chip} ${styles.chipNeutral}`}
              style={{ fontSize: "12px", textTransform: "uppercase" }}
            >
              Non-Duplication Rule Applied
            </span>
          </div>
          <div className={styles.contractSubtitle}>
            This optional demonstration shows <strong>fictional clinical interactions</strong>, not recorded sign-offs.
            Physical bed states live on <strong>Beds ({unit.beds})</strong>, patient transit on{" "}
            <strong>Arrivals</strong>, and pharmacy scripts on <strong>Discharges</strong>.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
            onClick={openHandoverModal}
          >
            📋 Handover Summary
          </button>
          <div className={styles.contractClock}>
            <span className={styles.pulseDot} />
            <span>
              Shift clock: <strong>{shiftClock}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ─── Shift Milestone Progress Ribbon ─── */}
      <div className={styles.shiftRibbon}>
        <div className={styles.ribbonHead}>
          <div className={styles.ribbonTitle}>
            <span className={styles.ribbonIcon}>⏱️</span>
            <div>
              <div className={styles.ribbonMainText}>Shift Decision Milestones &amp; Progress Gates</div>
              <div className={styles.ribbonSubText}>
                Chronological clinical gates for {unit.name} Day Shift (07:00–15:30) · Click gate to navigate
              </div>
            </div>
          </div>
          <div className={styles.contractClock}>
            <span className={styles.pulseDot} />
            <span>
              Current: <strong>{shiftClock}</strong>
            </span>
          </div>
        </div>

        <div className={styles.gateGrid}>
          {/* Gate 1 Card */}
          <div
            className={`${styles.gateCard} ${styles.gateComplete}`}
            onClick={() => jumpToGate("gate-1-section")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jumpToGate("gate-1-section");
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.gateCardTop}>
              <span className={styles.gateCardNum}>GATE 1 · 07:00–09:30</span>
              <span className={`${styles.chip} ${styles.chipGood}`}>✓ Complete</span>
            </div>
            <div className={styles.gateCardTitle}>Morning Handshake</div>
            <div className={styles.gateCardSub}>
              {staffedBeds} Staffed / {physicalBeds} Physical · Specialling noted
            </div>
          </div>

          {/* Gate 2 Card */}
          <div
            className={`${styles.gateCard} ${intakeState === "pending" ? styles.gateUrgent : styles.gateComplete}`}
            onClick={() => jumpToGate("gate-2-section")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jumpToGate("gate-2-section");
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.gateCardTop}>
              <span className={styles.gateCardNum}>GATE 2 · 09:30–13:00</span>
              <span className={`${styles.chip} ${intakeState === "pending" ? styles.chipDanger : styles.chipGood}`}>
                {intakeState === "pending" ? "🚨 Action Due" : "✓ Complete"}
              </span>
            </div>
            <div className={styles.gateCardTitle}>Intake &amp; Admission Sign-off</div>
            <div className={styles.gateCardSub}>
              {intakeState === "pending" ? "A.K. (45m ED SLA) · Bed 04 proposed" : "Bed 04 allocated to A.K."}
            </div>
          </div>

          {/* Gate 3 Card */}
          <div
            className={`${styles.gateCard} ${keiraState === "pending" || rowanState === "pending" ? styles.gateReady : styles.gateComplete} ${styles.gateActiveWindow}`}
            onClick={() => jumpToGate("gate-3-section")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jumpToGate("gate-3-section");
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.gateCardTop}>
              <span className={styles.gateCardNum}>GATE 3 · 11:00–14:00</span>
              <span
                className={`${styles.chip} ${keiraState === "pending" || rowanState === "pending" ? styles.chipWarn : styles.chipGood}`}
              >
                {keiraState === "pending" ? "⚠️ 1 Release Ready" : "✓ All Released"}
              </span>
            </div>
            <div className={styles.gateCardTitle}>Departures &amp; Barrier Escalation</div>
            <div className={styles.gateCardSub}>
              {keiraState === "pending"
                ? "K.P. release ready · R.R. NDIS delay"
                : "Keira departed · Turnover clean ordered"}
            </div>
          </div>

          {/* Gate 4 Card */}
          <div
            className={`${styles.gateCard} ${marcusState === "pending" ? styles.gatePending : styles.gateComplete}`}
            onClick={() => jumpToGate("gate-4-section")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jumpToGate("gate-4-section");
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.gateCardTop}>
              <span className={styles.gateCardNum}>GATE 4 · 14:00–18:00</span>
              <span className={`${styles.chip} ${marcusState === "pending" ? styles.chipAccent : styles.chipGood}`}>
                {marcusState === "pending" ? "⏳ Due 13:00" : "✓ Leave Verified"}
              </span>
            </div>
            <div className={styles.gateCardTitle}>Leave &amp; Afternoon Census</div>
            <div className={styles.gateCardSub}>
              {marcusState === "pending"
                ? "M.V. leave due 13:00 · Bed 06 block"
                : "M.V. return confirmed · Bed 06 ready"}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Action Queue Header & Filter Pills ─── */}
      <div className={styles.actionQueueBar}>
        <div className={styles.queueLeft}>
          <div className={styles.queueTitle}>
            <span>Action Queue</span>
            {totalPending > 0 ? (
              <span className={`${styles.chip} ${styles.chipDanger}`}>
                {totalPending} Decision{totalPending === 1 ? "" : "s"} Awaiting Action
              </span>
            ) : (
              <span className={`${styles.chip} ${styles.chipGood}`}>✓ All Shift Decisions Executed</span>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            Ranked by clinical urgency &amp; ED transfer SLA
          </span>
        </div>

        <div className={styles.filterPills} role="toolbar" aria-label="Decision Filter Controls">
          <button
            type="button"
            className={styles.filterPill}
            data-active={activeFilter === "all"}
            aria-pressed={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
          >
            All Gates (4)
          </button>
          <button
            type="button"
            className={styles.filterPill}
            data-active={activeFilter === "urgent"}
            aria-pressed={activeFilter === "urgent"}
            onClick={() => setActiveFilter("urgent")}
          >
            🚨 Immediate Actions ({pendingIntakes + pendingDepartures})
          </button>
          <button
            type="button"
            className={styles.filterPill}
            data-active={activeFilter === "barriers"}
            aria-pressed={activeFilter === "barriers"}
            onClick={() => setActiveFilter("barriers")}
          >
            ⚠️ Barriers &amp; Escalation ({pendingBarriers})
          </button>
          <button
            type="button"
            className={styles.filterPill}
            data-active={activeFilter === "governance"}
            aria-pressed={activeFilter === "governance"}
            onClick={() => setActiveFilter("governance")}
          >
            ⚖️ Governance ({pendingLeave})
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          GATE 1: SHIFT CAPACITY & STAFFING HANDSHAKE (07:00–09:30)
          ═══════════════════════════════════════════════════════════════════ */}
      {(activeFilter === "all" || activeFilter === "governance") && (
        <section className={styles.panel} id="gate-1-section">
          <div className={styles.panelStrip}>
            <div className={styles.panelTitleGroup}>
              <span
                className={`${styles.chip} ${styles.chipGood}`}
                style={{ fontFamily: "var(--mono, monospace)", fontSize: "10.5px" }}
              >
                GATE 1 · 07:00–09:30
              </span>
              <h2 className={styles.panelTitle}>Shift Capacity &amp; Staffing Handshake</h2>
            </div>
            <span className={`${styles.chip} ${styles.chipGood}`}>
              {censusAffirmed ? "✓ Morning Roll-up Verified (10:22)" : "⚠️ Re-affirmation Required"}
            </span>
          </div>

          <div className={styles.panelBody}>
            <div className={styles.capacityRow}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--ink)" }}>
                    Physical vs Staffed Capacity Declaration
                  </span>
                  <span
                    className={`${styles.chip} ${styles.chipNeutral}`}
                    style={{ fontFamily: "var(--mono, monospace)" }}
                  >
                    {physicalBeds} Physical · {occupiedBeds} Occupied
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Active Limiters:</span>
                  <button
                    type="button"
                    className={styles.constraintPill}
                    data-active={limiters.specialling}
                    aria-pressed={limiters.specialling}
                    onClick={() => toggleLimiter("specialling")}
                    title="1:1 Specialling nurse assigned"
                  >
                    1:1 Specialling (Bed 02)
                  </button>
                  <button
                    type="button"
                    className={styles.constraintPill}
                    data-active={limiters.deficit}
                    aria-pressed={limiters.deficit}
                    onClick={() => toggleLimiter("deficit")}
                    title="Nursing deficit"
                  >
                    High Acuity Deficit
                  </button>
                  <button
                    type="button"
                    className={styles.constraintPill}
                    data-active={limiters.maintenance}
                    aria-pressed={limiters.maintenance}
                    onClick={() => toggleLimiter("maintenance")}
                    title="Physical maintenance"
                  >
                    Maintenance Block
                  </button>
                  <button
                    type="button"
                    className={styles.constraintPill}
                    data-active={limiters.genderLock}
                    aria-pressed={limiters.genderLock}
                    onClick={() => toggleLimiter("genderLock")}
                    title="Bay cohort constraint"
                  >
                    Bay 2 Female Lock
                  </button>
                </div>
              </div>

              <div className={styles.capacityControlsWrap}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Staffed:
                  </div>
                  <div className={styles.microStepper}>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => adjustStaffed(-1)}
                      aria-label="Decrease staffed beds"
                    >
                      -
                    </button>
                    <span className={styles.stepperVal}>{staffedBeds}</span>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => adjustStaffed(1)}
                      aria-label="Increase staffed beds"
                    >
                      +
                    </button>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "var(--mono, monospace)",
                      color: "var(--good)",
                      fontWeight: 700,
                    }}
                  >
                    Beds
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                  onClick={affirmCensus}
                >
                  <span>Re-affirm Handshake</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          GATE 2: INBOUND INTAKE & ADMISSION SIGN-OFF (09:30–13:00)
          ═══════════════════════════════════════════════════════════════════ */}
      {(activeFilter === "all" || activeFilter === "urgent") && (
        <section className={styles.panel} id="gate-2-section">
          <div className={styles.panelStrip}>
            <div className={styles.panelTitleGroup}>
              <span
                className={`${styles.chip} ${styles.chipDanger}`}
                style={{ fontFamily: "var(--mono, monospace)", fontSize: "10.5px" }}
              >
                GATE 2 · 09:30–13:00
              </span>
              <h2 className={styles.panelTitle}>Inbound Intake &amp; Admission Sign-Off</h2>
            </div>
            <span className={`${styles.chip} ${intakeState === "pending" ? styles.chipDanger : styles.chipGood}`}>
              {intakeState === "pending" ? "1 Clinical Decision Due Now" : "✓ Complete (Bed 04 Assigned)"}
            </span>
          </div>

          <div className={styles.panelBody}>
            {/* A.K. Decision Card */}
            <div className={styles.decisionCard} data-priority="urgent">
              <div className={styles.decisionCardHead}>
                <div className={styles.decisionCardMeta}>
                  <div className={styles.decisionCardTitle}>
                    <span>A.K. (32M) — RPH ED Referral</span>
                    <span className={`${styles.chip} ${styles.chipDanger}`}>45m SLA Elapsed</span>
                    <span className={`${styles.chip} ${styles.chipNeutral}`}>Candidate for Bed 04</span>
                  </div>
                  <div className={styles.decisionCardDesc}>
                    Acute Bipolar Mania with Agitation. Central Bed Flow proposes admission to Bed 04 (High Obs Bay 1).
                  </div>
                </div>

                {intakeState === "pending" ? (
                  <div className={styles.decisionActions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGood} ${styles.btnSm}`}
                      onClick={handleAcceptIntake}
                    >
                      <span>✓ Accept to Bed 04</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                      onClick={openDeclineModal}
                    >
                      <span>✕ Decline</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                      onClick={handleDeferIntake}
                    >
                      <span>⏳ Request ED MO Review</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Resolved Banner */}
              {intakeState !== "pending" && (
                <div
                  className={`${styles.resolvedBanner} ${intakeState === "accepted" ? styles.bannerGood : styles.bannerDanger}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>{intakeState === "accepted" ? "✓" : "✕"}</span>
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 700 }}>
                        {intakeState === "accepted" && "Inbound Referral Accepted · Allocated to Bed 04"}
                        {intakeState === "declined" && "Referral Declined · Returned to Central Bed Flow"}
                        {intakeState === "deferred" && "ED MO Review Requested · SLA Timer Paused"}
                      </div>
                      <div style={{ fontSize: "11px", opacity: 0.9 }}>
                        {intakeState === "accepted" &&
                          "Demonstration only: no admission or bed allocation has been recorded."}
                        {intakeState === "declined" &&
                          `Clinical reason: ${declineReason}. Documented in statewide queue.`}
                        {intakeState === "deferred" &&
                          "Awaiting medical assessment from RPH Emergency Dept Senior Registrar."}
                      </div>
                    </div>
                  </div>
                  <button type="button" className={styles.btnUndo} onClick={handleUndoIntake}>
                    <span>↺ Undo Decision</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          GATE 3: DEPARTURE AUTHORIZATIONS & BARRIER ESCALATION (11:00–14:00)
          ═══════════════════════════════════════════════════════════════════ */}
      {(activeFilter === "all" || activeFilter === "urgent" || activeFilter === "barriers") && (
        <section className={styles.panel} id="gate-3-section">
          <div className={styles.panelStrip}>
            <div className={styles.panelTitleGroup}>
              <span
                className={`${styles.chip} ${styles.chipGood}`}
                style={{ fontFamily: "var(--mono, monospace)", fontSize: "10.5px" }}
              >
                GATE 3 · 11:00–14:00
              </span>
              <span className={`${styles.chip} ${styles.chipAccent}`} style={{ fontSize: "10px" }}>
                ⚡ Current Midday Window
              </span>
              <h2 className={styles.panelTitle}>Departure Authorizations &amp; Barrier Escalation</h2>
            </div>
            <span
              className={`${styles.chip} ${keiraState === "pending" || rowanState === "pending" ? styles.chipWarn : styles.chipGood}`}
            >
              {keiraState === "pending" ? "1 Release Ready · 1 Barrier Active" : "✓ Departures Cleared"}
            </span>
          </div>

          <div className={styles.panelBody}>
            {/* K.P. */}
            {(activeFilter === "all" || activeFilter === "urgent") && (
              <div className={styles.decisionCard} data-priority="ready">
                <div className={styles.decisionCardHead}>
                  <div className={styles.decisionCardMeta}>
                    <div className={styles.decisionCardTitle}>
                      <span>Bed 04: K.P.</span>
                      <span className={`${styles.chip} ${styles.chipGood}`}>All Clearances Complete</span>
                      <span className={`${styles.chip} ${styles.chipNeutral}`}>Vacates Bed 04 for A.K.</span>
                    </div>
                    <div className={styles.decisionCardDesc}>
                      Discharge clearance complete on /discharges. Escort present at reception. Sign-off releases bed
                      immediately to Environmental Services.
                    </div>
                  </div>

                  {keiraState === "pending" ? (
                    <div className={styles.decisionActions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGood} ${styles.btnSm}`}
                        onClick={handleAuthorizeDeparture}
                      >
                        <span>✓ Sign Off Departure (Release Bed)</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSubtle} ${styles.btnSm}`}
                        onClick={() => {
                          showToast("Transport escort delay flagged in handover log");
                        }}
                      >
                        <span>⚠️ Flag Delay</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                {keiraState !== "pending" && (
                  <div className={`${styles.resolvedBanner} ${styles.bannerGood}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "16px" }}>✓</span>
                      <div>
                        <div style={{ fontSize: "12.5px", fontWeight: 700 }}>
                          Departure Authorized &amp; Bed 04 Vacated
                        </div>
                        <div style={{ fontSize: "11px", opacity: 0.9 }}>
                          Released to Environmental Services for turnover cleaning. Escort verified at ward reception.
                        </div>
                      </div>
                    </div>
                    <button type="button" className={styles.btnUndo} onClick={handleUndoDeparture}>
                      <span>↺ Undo Authorization</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* R.R. (Barrier) */}
            {(activeFilter === "all" || activeFilter === "barriers") && (
              <div className={styles.decisionCard} data-priority="barrier">
                <div className={styles.decisionCardHead}>
                  <div className={styles.decisionCardMeta}>
                    <div className={styles.decisionCardTitle}>
                      <span>Bed 11: R.R.</span>
                      <span className={`${styles.chip} ${styles.chipWarn}`}>
                        Barrier: NDIS Supported Housing Unsigned
                      </span>
                      <span className={`${styles.chip} ${styles.chipNeutral}`}>Delay: Bed 11 Blocked</span>
                    </div>
                    <div className={styles.decisionCardDesc}>
                      Clinically cleared for discharge. Accommodation lease pending SIL provider signature. Cannot be
                      safely discharged without housing.
                    </div>
                  </div>

                  {rowanState === "pending" ? (
                    <div className={styles.decisionActions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                        onClick={openBarrierModal}
                      >
                        <span>📞 Escalate to Social Work &amp; Flow</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSubtle} ${styles.btnSm}`}
                        onClick={handlePostponeDischarge}
                      >
                        <span>⏳ Postpone to Tomorrow</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                {rowanState !== "pending" && (
                  <div
                    className={`${styles.resolvedBanner} ${rowanState === "escalated" ? styles.bannerWarn : styles.bannerGood}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "16px" }}>{rowanState === "escalated" ? "📞" : "⏳"}</span>
                      <div>
                        <div style={{ fontSize: "12.5px", fontWeight: 700 }}>
                          {rowanState === "escalated"
                            ? "Discharge Barrier Escalated"
                            : "Discharge Postponed to Tomorrow"}
                        </div>
                        <div style={{ fontSize: "11px", opacity: 0.9 }}>
                          {rowanState === "escalated"
                            ? "Urgent Social Work Senior Lead & NDIS Coordinator Liaison Dispatched."
                            : "Patient bed held until tomorrow's morning MDT rounds."}
                        </div>
                      </div>
                    </div>
                    <button type="button" className={styles.btnUndo} onClick={handleUndoBarrier}>
                      <span>↺ Undo Action</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          GATE 4: PSYCHIATRIC LEAVE & SAFETY RESTRICTIONS (14:00–18:00)
          ═══════════════════════════════════════════════════════════════════ */}
      {(activeFilter === "all" || activeFilter === "governance") && (
        <section className={styles.panel} id="gate-4-section">
          <div className={styles.panelStrip}>
            <div className={styles.panelTitleGroup}>
              <span
                className={`${styles.chip} ${styles.chipAccent}`}
                style={{ fontFamily: "var(--mono, monospace)", fontSize: "10.5px" }}
              >
                GATE 4 · 14:00–18:00
              </span>
              <h2 className={styles.panelTitle}>Leave &amp; Bed Safety Restrictions</h2>
            </div>
            <span className={`${styles.chip} ${marcusState === "pending" ? styles.chipNeutral : styles.chipGood}`}>
              {marcusState === "pending" ? "2 Active Governance Items" : "✓ Governance Complete"}
            </span>
          </div>

          <div className={styles.panelBody}>
            {/* M.V. */}
            <div className={styles.decisionCard} data-priority="governance">
              <div className={styles.decisionCardHead}>
                <div className={styles.decisionCardMeta}>
                  <div className={styles.decisionCardTitle}>
                    <span>Bed 12: M.V.</span>
                    <span className={`${styles.chip} ${styles.chipWarn}`}>Leave return recorded for 13:00</span>
                  </div>
                  <div className={styles.decisionCardDesc}>
                    Patient on unescorted day leave. If returned, verify mental state and sign off return.
                  </div>
                </div>

                {marcusState === "pending" ? (
                  <div className={styles.decisionActions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGood} ${styles.btnSm}`}
                      onClick={handleConfirmReturn}
                    >
                      <span>✓ Confirm Return</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                      onClick={handleExtendLeave}
                    >
                      <span>Extend leave</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                      onClick={handleDeclareAwol}
                    >
                      <span>🚨 Declare AWOL</span>
                    </button>
                  </div>
                ) : null}
              </div>

              {marcusState !== "pending" && (
                <div
                  className={`${styles.resolvedBanner} ${marcusState === "returned" ? styles.bannerGood : styles.bannerDanger}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>{marcusState === "returned" ? "✓" : "🚨"}</span>
                    <div>
                      <div style={{ fontSize: "12.5px", fontWeight: 700 }}>
                        {marcusState === "returned" && "Patient Returned Safely"}
                        {marcusState === "extended" && "Leave Window Extended"}
                        {marcusState === "awol" && "AWOL Declared — Statutory Alert Triggered"}
                      </div>
                      <div style={{ fontSize: "11px", opacity: 0.9 }}>
                        {marcusState === "returned" && "Mental state exam verified. Leave record closed."}
                        {marcusState === "extended" && "New return target: 15:00 AWST. Treating consultant notified."}
                        {marcusState === "awol" && "Not wired in this prototype. No order has been dispatched."}
                      </div>
                    </div>
                  </div>
                  <button type="button" className={styles.btnUndo} onClick={handleUndoMarcus}>
                    <span>↺ Undo Action</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bed 06 Safety Precaution */}
            <div className={styles.decisionCard} data-priority="governance">
              <div className={styles.decisionCardHead}>
                <div className={styles.decisionCardMeta}>
                  <div className={styles.decisionCardTitle}>
                    <span>Bed 06: Droplet Precaution Restriction</span>
                    <span
                      className={`${styles.chip} ${bed06State === "restricted" ? styles.chipDanger : styles.chipGood}`}
                    >
                      {bed06State === "restricted" ? "Restricted" : "✓ Cleared"}
                    </span>
                  </div>
                  <div className={styles.decisionCardDesc}>
                    {bed06State === "restricted"
                      ? "Bed blocked from admissions awaiting UV air scrub. Orderly report: air scrub ready."
                      : "UV air scrub certified complete. Bed returned to active allocatable pool."}
                  </div>
                </div>

                {bed06State === "restricted" ? (
                  <div className={styles.decisionActions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}
                      onClick={handleLiftBed06}
                    >
                      <span>✓ Lift Restriction (Clear for Intake)</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSubtle} ${styles.btnSm}`}
                      onClick={() => showToast("Contact precaution template opened")}
                    >
                      <span>+ New Restriction</span>
                    </button>
                  </div>
                ) : (
                  <div className={styles.decisionActions}>
                    <button type="button" className={styles.btnUndo} onClick={handleRestoreBed06}>
                      <span>↺ Re-impose Block</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: REAL-TIME AUDIT LOG OF COMPLETED SHIFT DECISIONS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className={styles.auditSection}>
        <div className={styles.panelStrip}>
          <div className={styles.panelTitleGroup}>
            <span style={{ color: "var(--good)", fontWeight: 700 }}>✓</span>
            <h3 className={styles.panelTitle}>Demonstration interaction history</h3>
          </div>
          <span className={`${styles.chip} ${styles.chipNeutral}`} style={{ fontSize: "10.5px" }}>
            Illustrative local log; not a clinical audit record
          </span>
        </div>

        <div className={styles.auditTable}>
          {auditLog.map((item) => (
            <div key={item.id} className={styles.auditRow}>
              <div className={styles.auditLeft}>
                <span
                  className={styles.auditIcon}
                  style={{ color: item.icon === "✕" || item.icon === "🚨" ? "var(--danger)" : "var(--good)" }}
                >
                  {item.icon}
                </span>
                <div>
                  <strong className={styles.auditDesc}>{item.title}</strong>
                  <span style={{ color: "var(--muted)", margin: "0 6px" }}>·</span>
                  <span style={{ color: "var(--ink-soft)" }}>{item.detail}</span>
                </div>
              </div>
              <div className={styles.auditMeta}>
                <span>{item.time}</span>
                <span style={{ margin: "0 4px" }}>·</span>
                <span>{item.author}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Prototype Disclaimer */}
      <footer className={styles.protoBanner}>
        SYNTHETIC PROTOTYPE &middot; Scoped to {unit.name} &middot; Bed decisions remain human-confirmed &middot; Not a
        medical device
      </footer>

      {/* ─── Decline Modal ─── */}
      {declineModalOpen && (
        <div className={styles.drawerBackdrop} role="dialog" aria-modal="true" aria-labelledby="declineTitle">
          <div className={styles.drawerDialog}>
            <div className={styles.drawerHead}>
              <h3 className={styles.drawerTitle} id="declineTitle">
                Decline Inbound Referral
              </h3>
              <button type="button" className={styles.drawerClose} onClick={closeDeclineModal} aria-label="Close">
                &times;
              </button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="patientReferralInput">
                  Patient &amp; Referral
                </label>
                <input
                  id="patientReferralInput"
                  type="text"
                  className={styles.formInput}
                  readOnly
                  value="A.K. (RPH ED Referral #9021)"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="declineReason">
                  Mandatory Clinical Refusal Reason (WA Health Governance)
                </label>
                <select
                  id="declineReason"
                  className={styles.formSelect}
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                >
                  <option value="Acuity exceeds current nursing safe-ratio">
                    Acuity exceeds current nursing safe-ratio on {unit.name}
                  </option>
                  <option value="Gender mix cohort incompatibility">
                    Gender mix incompatibility with current bay cohort (Bay 2 locked female)
                  </option>
                  <option value="Seclusion facility occupied">
                    Requires active seclusion facility (Dabakarn seclusion currently occupied)
                  </option>
                  <option value="Concurrent medical deterioration">
                    Concurrent medical deterioration requires medical admission
                  </option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="declineNotes">
                  Clinical Explanatory Note
                </label>
                <textarea
                  id="declineNotes"
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Provide clinical rationale for senior bed manager review..."
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.drawerFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnSubtle}`} onClick={closeDeclineModal}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDeclineIntakeSubmit}>
                Confirm Clinical Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Barrier Escalation Modal ─── */}
      {barrierModalOpen && (
        <div className={styles.drawerBackdrop} role="dialog" aria-modal="true" aria-labelledby="barrierTitle">
          <div className={styles.drawerDialog}>
            <div className={styles.drawerHead}>
              <h3 className={styles.drawerTitle} id="barrierTitle">
                Escalate Discharge Flow Barrier
              </h3>
              <button type="button" className={styles.drawerClose} onClick={closeBarrierModal} aria-label="Close">
                &times;
              </button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="patientBedInput">
                  Patient &amp; Bed
                </label>
                <input id="patientBedInput" type="text" className={styles.formInput} readOnly value="R.R. (Bed 11)" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="escalationPathway">
                  Escalation Pathway
                </label>
                <select
                  id="escalationPathway"
                  className={styles.formSelect}
                  value={barrierPathway}
                  onChange={(e) => setBarrierPathway(e.target.value)}
                >
                  <option value="Urgent Social Work Senior Lead & NDIS Liaison">
                    Urgent Social Work Senior Lead &amp; NDIS Coordinator Liaison
                  </option>
                  <option value="Hospital Bed Flow Manager">
                    Hospital Bed Flow Manager (Housing Voucher Emergency)
                  </option>
                  <option value="Clinical Director Review">Clinical Director / Consultant Psychiatrist Review</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="barrierNotes">
                  Action Note
                </label>
                <textarea
                  id="barrierNotes"
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Detail specific housing or legal roadblock..."
                  value={barrierNotes}
                  onChange={(e) => setBarrierNotes(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.drawerFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnSubtle}`} onClick={closeBarrierModal}>
                Cancel
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGood}`} onClick={handleEscalateBarrierSubmit}>
                Confirm Barrier Escalation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Handover Summary Modal ─── */}
      {handoverModalOpen && (
        <div className={styles.drawerBackdrop} role="dialog" aria-modal="true" aria-labelledby="handoverTitle">
          <div className={styles.drawerDialog} style={{ maxWidth: "600px" }}>
            <div className={styles.drawerHead}>
              <h3 className={styles.drawerTitle} id="handoverTitle">
                📋 Shift Handover Summary — {unit.name}
              </h3>
              <button type="button" className={styles.drawerClose} onClick={closeHandoverModal} aria-label="Close">
                &times;
              </button>
            </div>
            <div className={styles.drawerBody}>
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  border: "1px solid var(--line)",
                }}
              >
                <strong>Shift Capacity:</strong> {staffedBeds} Staffed / {physicalBeds} Physical beds (1:1 Specialling
                active on Bed 02).
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <strong>Current Status of Shift Gates:</strong>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: "4px",
                  }}
                >
                  <span>Gate 1: Morning Roll-up Handshake</span>
                  <span className={`${styles.chip} ${styles.chipGood}`}>Verified (10:22 AWST)</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: "4px",
                  }}
                >
                  <span>Gate 2: Inbound ED Admission (A.K.)</span>
                  <span
                    className={`${styles.chip} ${intakeState === "accepted" ? styles.chipGood : styles.chipDanger}`}
                  >
                    {intakeState === "accepted" ? "Bed 04 Assigned" : "Action Pending"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: "4px",
                  }}
                >
                  <span>Gate 3: Departure Release (K.P.)</span>
                  <span className={`${styles.chip} ${keiraState === "authorized" ? styles.chipGood : styles.chipWarn}`}>
                    {keiraState === "authorized" ? "Departed & Released" : "Ready for Release"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid var(--line)",
                    paddingBottom: "4px",
                  }}
                >
                  <span>Gate 3: Flow Barrier (R.R.)</span>
                  <span
                    className={`${styles.chip} ${rowanState === "escalated" ? styles.chipWarn : styles.chipDanger}`}
                  >
                    {rowanState === "escalated" ? "Escalated to Social Work" : "NDIS Hold Active"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Gate 4: Leave return (M.V.)</span>
                  <span
                    className={`${styles.chip} ${marcusState === "returned" ? styles.chipGood : styles.chipAccent}`}
                  >
                    {marcusState === "returned" ? "Returned & Verified" : "Due 13:00 AWST"}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.drawerFoot}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ Print Handover Sign-Off
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGood}`} onClick={closeHandoverModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Non-intrusive Toast Notification ─── */}
      {toastText && (
        <div className={styles.toastBox} role="status" aria-live="polite">
          <span>✓</span>
          <span>{toastText}</span>
          <button type="button" className={styles.toastClose} onClick={() => setToastText(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
