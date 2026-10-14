"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  CommandPalette,
  GroupHead,
  NeedsYou,
  PhoneSheet,
  UndoHairline,
  type CommandPaletteItem,
  type WfTone,
} from "@/components/wf";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";

function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "ok" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
}) {
  const mapped: WfTone = tone === "ok" ? "success" : tone;
  return <Badge tone={mapped}>{children}</Badge>;
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <GroupHead title={title} />
      {subtitle ? <p className={styles.cardBody}>{subtitle}</p> : null}
    </div>
  );
}
import {
  CLD_DEFAULT_CONDITIONS,
  DISCHARGE_DELAY_REASONS,
  PHONE_WALK_ROUND_VIEWPORT,
  canPreMatchCleaningBed,
  completeCleanAndOpenBed,
  createUndoWindowState,
  deriveAfternoonDischarges,
  deriveAwolTrackerSummary,
  deriveCtoFollowUpHandshake,
  deriveDischargeLoungeEligible,
  deriveEdBreachLadder,
  deriveEddDriftBadge,
  deriveGhostPreparingBeds,
  deriveInterWardStepDownSwaps,
  deriveLeaveFastTrack,
  deriveMaroonedPatientDossier,
  derivePaperLegalExpiryRadar,
  derivePreFlightAdmissionsPacket,
  deriveRefusalRecoveryAction,
  deriveRoleNeedsYouItems,
  deriveSilentWards,
  deriveStepDownPullBoard,
  deriveStuckHandoverSla,
  deriveTMinus24hDischargePrompts,
  deriveTopCompatibleWards,
  dispatchParallelDischargeSupport,
  dischargeDelayReasonLabels,
  evaluateCriteriaLedDischarge,
  initialWardBroadcastState,
  releaseBedToDischargeLounge,
  wardBroadcastReducer,
  type DischargeDelayReason,
  type SupportServiceDispatch,
  type UndoWindowState,
} from "@/components/ward-management/ward-top25-features";
import styles from "./ward-top25-cockpit.module.css";

export interface WalkRoundRowItem {
  id: string;
  bedLabel: string;
  statusLabel: string;
  eddLabel: string;
  primaryActionLabel: string;
}

export interface PhoneWalkRoundSheetProps {
  unitName?: string;
  rows?: readonly WalkRoundRowItem[];
  onPrimaryAction?: (rowId: string) => void;
}

const DEFAULT_WALK_ROUND_ROWS: readonly WalkRoundRowItem[] = [
  {
    id: "wr-bed-1",
    bedLabel: "Bed 01 · Single Room",
    statusLabel: "Confirmed discharge today",
    eddLabel: "EDD 10:00",
    primaryActionLabel: "Confirm Morning Discharge",
  },
  {
    id: "wr-bed-2",
    bedLabel: "Bed 02 · Shared Bay A",
    statusLabel: "Overnight leave (extended)",
    eddLabel: "Leave Return Due",
    primaryActionLabel: "Convert Leave to Discharge",
  },
  {
    id: "wr-bed-3",
    bedLabel: "Bed 03 · Shared Bay B",
    statusLabel: "Preparing / Cleaning (95m)",
    eddLabel: "Ready for Pull",
    primaryActionLabel: "Cleaning Complete — Open Bed",
  },
];

/**
 * #23 — Mobile Walk-Round Bottom-Sheet (`390×844` Thumb-Zone Mode).
 * Enforces single-column `52px` row height, one primary action per card, and bottom-sheet drawer
 * for detail editing during 08:30 ward walk-rounds.
 */
export function PhoneWalkRoundSheet({
  unitName = "Bentley Adult Acute Ward 7",
  rows = DEFAULT_WALK_ROUND_ROWS,
  onPrimaryAction,
}: PhoneWalkRoundSheetProps) {
  const [selectedRow, setSelectedRow] = useState<WalkRoundRowItem | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const handleAction = (row: WalkRoundRowItem) => {
    setCompletedIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
    onPrimaryAction?.(row.id);
  };

  return (
    <div
      className={styles.phoneWalkRoundFrame}
      data-testid="phone-walk-round-sheet"
      data-viewport={`${PHONE_WALK_ROUND_VIEWPORT.width}x${PHONE_WALK_ROUND_VIEWPORT.height}`}
      data-row-height={PHONE_WALK_ROUND_VIEWPORT.rowHeightPx}
    >
      <div className={styles.phoneWalkRoundHeader}>
        <strong>{unitName} · 08:30 Walk-Round</strong>
        <Chip tone="info">390×844 Mobile</Chip>
      </div>
      <ul className={styles.phoneWalkRoundList}>
        {rows.map((row) => {
          const done = completedIds.includes(row.id);
          return (
            <li key={row.id} className={styles.phoneWalkRoundRow}>
              <div className={styles.phoneWalkRoundInfo}>
                <span className={styles.phoneWalkRoundBed}>{row.bedLabel}</span>
                <span className={styles.phoneWalkRoundMeta}>
                  {row.statusLabel} · {row.eddLabel}
                </span>
              </div>
              <div className={styles.cardActions}>
                <Button
                  className={styles.mobileTapTarget}
                  size="sm"
                  variant={done ? "ghost" : "pri"}
                  onClick={() => handleAction(row)}
                >
                  {done ? "Completed" : row.primaryActionLabel}
                </Button>
                <Button
                  className={styles.mobileTapTarget}
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRow(row)}
                >
                  Sheet
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <PhoneSheet
        open={selectedRow !== null}
        onClose={() => setSelectedRow(null)}
        title={selectedRow ? selectedRow.bedLabel : "Walk-Round Bed Sheet"}
      >
        {selectedRow ? (
          <div className={styles.cardBody}>
            <p>{selectedRow.statusLabel}</p>
            <Button
              size="sm"
              variant="pri"
              onClick={() => {
                handleAction(selectedRow);
                setSelectedRow(null);
              }}
            >
              {selectedRow.primaryActionLabel}
            </Button>
          </div>
        ) : null}
      </PhoneSheet>
    </div>
  );
}

export interface WardTop25CockpitProps {
  initialState?: WardFlowState;
}

/**
 * Interactive cockpit surfacing all 25 items of the Perfected Top 25 Master List for Ward Flow.
 * Built with existing Next.js / v10 design system components (`NeedsYou`, `UndoHairline`,
 * `CommandPalette`, `PhoneSheet`, `WardBroadcastBanner`) and pure derivations.
 */
export function WardTop25Cockpit({ initialState }: WardTop25CockpitProps) {
  const state = useMemo(() => initialState ?? seedWardFlowState(), [initialState]);
  const now = state.auditCaptureStartedAt;

  // #6 Role-Scoped Needs You Filter
  const [activeRole, setActiveRole] = useState<"coordinator" | "ward" | "ed">("coordinator");

  // #1 Parallel Support-Service Dispatches
  const [dispatchedServices, setDispatchedServices] = useState<SupportServiceDispatch[]>([]);

  // #2 Fan-out Referrals
  const [fannedOutUnitIds, setFannedOutUnitIds] = useState<string[]>([]);

  // #4 Ghost Preparing Bed State
  const [ghostUnitState, setGhostUnitState] = useState<{
    id: string;
    availableBeds: number;
    preparingBeds: number;
    cleanedBedIds?: string[];
  }>({
    id: state.units[0]?.id ?? "rph-adult-open",
    availableBeds: state.units[0]?.allocatable.value ?? 2,
    preparingBeds: 1,
    cleanedBedIds: [],
  });

  // #5 Early Barrier Selection
  const [selectedBarrier, setSelectedBarrier] = useState<DischargeDelayReason>(DISCHARGE_DELAY_REASONS[0]);

  // #9 Criteria-Led Discharge (CLD) State
  const [cldConditions, setCldConditions] = useState<Record<string, boolean>>({
    [CLD_DEFAULT_CONDITIONS[0]]: true,
    [CLD_DEFAULT_CONDITIONS[1]]: true,
    [CLD_DEFAULT_CONDITIONS[2]]: false,
  });

  // #14 Pre-Flight Admissions Packet State
  const [preFlight, setPreFlight] = useState({
    medicalClearance: true,
    legalPaperwork: true,
    contrabandSearch: true,
    medicationChart: false,
  });

  // #17 8-Second Undo Hairline State
  const [undoWindow, setUndoWindow] = useState<UndoWindowState | null>(() =>
    createUndoWindowState({
      actionId: "undo-demo-decline",
      label: "Declined referral to Bentley Ward 7",
      createdAtMs: 1000,
      durationMs: 8000,
    }),
  );
  const clearUndoWindow = useCallback(() => setUndoWindow(null), []);

  // #18 Discharge Lounge State
  const [loungeUnit, setLoungeUnit] = useState<{
    id: string;
    availableBeds: number;
    loungeOccupied: number;
    releasedCandidateIds?: string[];
  }>({
    id: "scgh-adult-open",
    availableBeds: 1,
    loungeOccupied: 0,
    releasedCandidateIds: [],
  });

  // #22 Global Command Palette State
  const [paletteOpen, setPaletteOpen] = useState(false);

  // #25 Broadcast Alert Auto-Expiry & Stand-Down State
  const [broadcastState, setBroadcastState] = useState(() =>
    wardBroadcastReducer(initialWardBroadcastState, {
      type: "CREATE_BROADCAST_ALERT",
      id: "top25-bcast-1",
      title: "Code Yellow Capacity Surge — Review Morning Discharges",
      message: "Statewide metropolitan adult occupancy at 97%. Prioritise morning CLD and step-down pulls.",
      severity: "critical",
      author: "State Bed Coordination Desk",
      now: "2026-10-15T08:00:00.000Z",
    }),
  );

  // Pure derivations across all 25 items
  const afternoonDischarges = useMemo(() => deriveAfternoonDischarges(state.admissions, now), [state.admissions, now]);
  const sampleMovement = state.movements[0];
  const topCompatibleWards = useMemo(
    () => (sampleMovement ? deriveTopCompatibleWards(sampleMovement, state.units, 3, now) : []),
    [sampleMovement, state.units, now],
  );
  const refusalRecovery = useMemo(() => deriveRefusalRecoveryAction("gender_mismatch"), []);
  const ghostAlerts = useMemo(
    () =>
      deriveGhostPreparingBeds(
        [
          {
            id: "bed-prep-101",
            unitId: ghostUnitState.id,
            status: ghostUnitState.preparingBeds > 0 ? "preparing" : "available",
            preparingStartedAt: "2026-10-15T08:00:00.000Z",
          },
        ],
        "2026-10-15T09:45:00.000Z",
      ),
    [ghostUnitState],
  );
  const tMinus24hPrompts = useMemo(
    () =>
      deriveTMinus24hDischargePrompts(
        [
          {
            id: "adm-t24-1",
            unitId: "rph-adult-open",
            edd: "2026-10-16T08:00:00.000Z",
          },
        ],
        "2026-10-15T10:00:00.000Z",
      ),
    [],
  );
  const roleItems = useMemo(
    () =>
      deriveRoleNeedsYouItems(
        [
          { id: "ny-1", role: "coordinator", title: "Silent ward escalation (unanswered referral)", priority: 1 },
          { id: "ny-2", role: "ward", title: "Confirm morning TTO & cleaning pre-stage", priority: 1 },
          { id: "ny-3", role: "ed", title: "Complete 4-tick Pre-Flight Admissions Packet", priority: 1 },
        ],
        activeRole,
      ),
    [activeRole],
  );
  const silentWards = useMemo(() => deriveSilentWards(state.movements, now + 260), [state.movements, now]);
  const stepDownMatches = useMemo(
    () =>
      deriveStepDownPullBoard(
        [{ id: "sd-cand-1", fromUnitId: "fsh-hdu", securityLevel: "HDU", stepDownReady: true, cohort: "Adult" }],
        [{ id: "fsh-open", securityLevel: "Open", availableBeds: 2, cohort: "Adult" }],
      ),
    [],
  );
  const cldEval = useMemo(
    () =>
      evaluateCriteriaLedDischarge({
        consultantAuthorised: true,
        conditionsMet: cldConditions,
      }),
    [cldConditions],
  );
  const leaveFastTrack = useMemo(
    () =>
      deriveLeaveFastTrack(
        { id: "lv-1", unitId: "rph-adult-open", leaveStartedAt: "2026-10-14T08:00:00.000Z" },
        "2026-10-15T10:00:00.000Z",
      ),
    [],
  );
  const ctoHandshake = useMemo(
    () =>
      deriveCtoFollowUpHandshake({
        admissionId: "adm-cto-1",
        isCto: true,
        assignedCaseManager: null,
        followUpAppointmentAt: null,
      }),
    [],
  );
  const stuckHandover = useMemo(
    () =>
      deriveStuckHandoverSla(
        { movementId: "mov-sla-1", acceptedAt: "2026-10-15T06:00:00.000Z", stage: "accepted" },
        "2026-10-15T09:30:00.000Z",
      ),
    [],
  );
  const edLadder = useMemo(
    () =>
      deriveEdBreachLadder(
        [
          { id: "ed-wait-25h", arrivedAt: "2026-10-14T08:00:00.000Z" },
          { id: "ed-wait-13h", arrivedAt: "2026-10-14T20:00:00.000Z" },
          { id: "ed-wait-9h", arrivedAt: "2026-10-15T00:30:00.000Z" },
        ],
        "2026-10-15T09:30:00.000Z",
      ),
    [],
  );
  const preFlightResult = useMemo(() => derivePreFlightAdmissionsPacket(preFlight), [preFlight]);
  const cleaningPreMatchAllowed = useMemo(() => canPreMatchCleaningBed({ id: "bed-clean-1", status: "preparing" }), []);
  const swapPairs = useMemo(
    () =>
      deriveInterWardStepDownSwaps([
        { id: "sw-1", fromUnitId: "fsh-hdu", toUnitId: "fsh-open", reason: "step_down" },
        { id: "sw-2", fromUnitId: "fsh-open", toUnitId: "fsh-hdu", reason: "step_up_acuity" },
      ]),
    [],
  );
  const loungeEligible = useMemo(
    () =>
      deriveDischargeLoungeEligible([
        {
          id: "dl-1",
          clinicallyCleared: true,
          scriptsReady: true,
          awaitingAfternoonTransport: true,
          highRisk: false,
          seclusion: false,
          legalStatus: "voluntary",
        },
      ]),
    [],
  );
  const paperExpiryRadar = useMemo(
    () =>
      derivePaperLegalExpiryRadar(
        [
          { id: "form-crit", formType: "Form 1A", expiresAt: "2026-10-15T10:45:00.000Z" },
          { id: "form-warn", formType: "Form 3B", expiresAt: "2026-10-15T13:00:00.000Z" },
        ],
        "2026-10-15T10:00:00.000Z",
      ),
    [],
  );
  const maroonedDossier = useMemo(
    () =>
      deriveMaroonedPatientDossier([
        { id: "mp-28d", daysDelayed: 28, barrierCategory: "ndis_support", clinicallyReadyForDischarge: true },
        { id: "mp-14d", daysDelayed: 14, barrierCategory: "sat_hearing", clinicallyReadyForDischarge: true },
      ]),
    [],
  );
  const eddDrift = useMemo(
    () =>
      deriveEddDriftBadge({
        eddRevisions: ["2026-10-10", "2026-10-12", "2026-10-14", "2026-10-16"],
      }),
    [],
  );
  const awolSummary = useMemo(
    () =>
      deriveAwolTrackerSummary(
        {
          patientId: "SYNTH-AWOL-01",
          unitId: "gyl-secure-1",
          reportedAt: "2026-10-15T04:00:00.000Z",
          wapolNotified: true,
          nextOfKinNotified: false,
          bedHeld: true,
        },
        "2026-10-15T09:00:00.000Z",
      ),
    [],
  );

  const commandItems: CommandPaletteItem[] = useMemo(
    () => [
      {
        id: "cmd-fanout",
        label: "Fan Out Parallel Referrals (Top 3 Compatible Wards)",
        category: "Flow Action",
        keywords: ["refer", "parallel", "shortlist"],
        onSelect: () => setFannedOutUnitIds(topCompatibleWards.map((w) => w.unit.id)),
      },
      {
        id: "cmd-discharge-support",
        label: "Dispatch Parallel Pharmacy + Transport + Cleaning",
        category: "Discharge Unblocker",
        keywords: ["tto", "pharmacy", "cleaning", "morning"],
        onSelect: () =>
          setDispatchedServices(
            dispatchParallelDischargeSupport({
              admissionId: afternoonDischarges[0]?.id ?? "ADM-DEMO-1",
              unitId: afternoonDischarges[0]?.unitId ?? "rph-adult-open",
              now: "2026-10-15T08:30:00.000Z",
            }),
          ),
      },
      ...state.units.slice(0, 5).map((u) => ({
        id: `cmd-unit-${u.id}`,
        label: `Jump to ${u.name}`,
        category: "Ward",
        keywords: [u.siteCode, u.cohort],
        onSelect: () =>
          setUndoWindow(
            createUndoWindowState({
              actionId: `undo-jump-${u.id}`,
              label: `Jumped to ${u.name}`,
              createdAtMs: Date.now(),
            }),
          ),
      })),
    ],
    [topCompatibleWards, afternoonDischarges, state.units],
  );

  const loungeCandidateId = loungeEligible[0]?.id ?? "dl-1";
  const isLoungeCandidateReleased = Boolean(loungeUnit.releasedCandidateIds?.includes(loungeCandidateId));

  return (
    <div className={styles.cockpit} data-testid="ward-top25-cockpit">
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <span className={styles.eyebrow}>Perfected Master List · 25 High-Yield Flow Improvements</span>
          <h2 className={styles.title}>Ward Flow Top 25 Operational Command Cockpit</h2>
        </div>
        <div className={styles.headerControls}>
          <Button size="sm" onClick={() => setActiveRole("coordinator")}>
            Coordinator Desk
          </Button>
          <Button size="sm" onClick={() => setActiveRole("ward")}>
            Ward NUM Desk
          </Button>
          <Button size="sm" onClick={() => setActiveRole("ed")}>
            ED Bed Desk
          </Button>
          <Button size="sm" variant="pri" onClick={() => setPaletteOpen(true)}>
            Command Palette (Ctrl+K)
          </Button>
        </div>
      </div>

      {/* #6 Role-Scoped Needs You Action Strip */}
      <NeedsYou
        label={`Needs You (${activeRole.toUpperCase()})`}
        items={roleItems.map((item) => ({
          id: item.id,
          title: item.title,
          label: item.title,
          tone: "warning" as const,
          actionLabel: item.actionLabel ?? "Resolve",
          onAction: () =>
            setUndoWindow(
              createUndoWindowState({
                actionId: `undo-${item.id}`,
                label: `Actioned: ${item.title}`,
                createdAtMs: Date.now(),
              }),
            ),
        }))}
      />

      {/* #17 8-Second Undo Hairline Window */}
      {undoWindow ? (
        <UndoHairline
          message={undoWindow.label}
          durationMs={undoWindow.durationMs}
          onUndo={clearUndoWindow}
          onExpire={clearUndoWindow}
        />
      ) : null}

      {/* Tier 1: Direct Bed-Unlockers & Referral Velocity Multipliers (#1–#7) */}
      <SectionHead
        title="Tier 1 · Direct Bed-Unlockers & Referral Velocity Multipliers (#1–#7)"
        subtitle="Parallel morning discharge unblocking, 3-ward fan-out, inline refusal recovery, and ghost-bed auto-expiry"
      />
      <div className={styles.tierGrid}>
        {/* #1 Afternoon Discharge & Parallel Support-Service Unblocker */}
        <article className={styles.card} data-testid="top25-item-1">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#1</span>
            <h3 className={styles.cardTitle}>Afternoon Discharge & Parallel Support Unblocker</h3>
            <Chip tone="warning">{afternoonDischarges.length} Scheduled</Chip>
          </div>
          <p className={styles.cardBody}>
            Simultaneously dispatches Pharmacy (TTO), Transport, and Environmental Cleaning to convert 16:00 discharges
            into 10:00 morning bed releases.
          </p>
          {dispatchedServices.length > 0 ? (
            <div className={styles.cardBody}>Dispatched: {dispatchedServices.map((s) => s.service).join(", ")}</div>
          ) : null}
          <div className={styles.cardActions}>
            <Button
              size="sm"
              variant="pri"
              onClick={() =>
                setDispatchedServices(
                  dispatchParallelDischargeSupport({
                    admissionId: afternoonDischarges[0]?.id ?? "ADM-DEMO-1",
                    unitId: afternoonDischarges[0]?.unitId ?? "rph-adult-open",
                    now: "2026-10-15T08:30:00.000Z",
                  }),
                )
              }
            >
              Confirm Morning Discharge & Dispatch Support
            </Button>
          </div>
        </article>

        {/* #2 One-Tap Multi-Ward Parallel Referral Fan-Out */}
        <article className={styles.card} data-testid="top25-item-2">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#2</span>
            <h3 className={styles.cardTitle}>One-Tap Multi-Ward Parallel Referral Fan-Out</h3>
            <Chip tone="info">Top {topCompatibleWards.length} Ready</Chip>
          </div>
          <p className={styles.cardBody}>
            Pre-selects the top {topCompatibleWards.length} compatible wards (
            {topCompatibleWards.map((w) => w.unit.name).join(", ") || "eligible units"}) and fans out in one click,
            auto-withdrawing remaining requests on first acceptance.
          </p>
          {fannedOutUnitIds.length > 0 ? (
            <div className={styles.cardBody}>Referred in parallel: {fannedOutUnitIds.join(", ")}</div>
          ) : null}
          <div className={styles.cardActions}>
            <Button
              size="sm"
              variant="pri"
              onClick={() => setFannedOutUnitIds(topCompatibleWards.map((w) => w.unit.id))}
            >
              Refer Top 3 Compatible Wards
            </Button>
          </div>
        </article>

        {/* #3 Inline Refusal Recovery & Guided Next-Best Action */}
        <article className={styles.card} data-testid="top25-item-3">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#3</span>
            <h3 className={styles.cardTitle}>Inline Refusal Recovery & Guided Next-Best Action</h3>
            <Chip tone="danger">{refusalRecovery.targetFilter}</Chip>
          </div>
          <p className={styles.cardBody}>
            {refusalRecovery.title}: {refusalRecovery.description}
          </p>
          <div className={styles.cardActions}>
            <Button
              size="sm"
              onClick={() =>
                setUndoWindow(
                  createUndoWindowState({
                    actionId: "undo-refusal-recovery",
                    label: `Applied filter: ${refusalRecovery.actionLabel}`,
                    createdAtMs: Date.now(),
                  }),
                )
              }
            >
              {refusalRecovery.actionLabel}
            </Button>
          </div>
        </article>

        {/* #4 "Preparing / Cleaning" Ghost-Bed Auto-Expiry & One-Tap Clear */}
        <article className={styles.card} data-testid="top25-item-4">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#4</span>
            <h3 className={styles.cardTitle}>Preparing / Cleaning Ghost-Bed Auto-Expiry</h3>
            <Chip tone={ghostAlerts.length > 0 ? "warning" : "ok"}>
              {ghostUnitState.availableBeds} Available · {ghostUnitState.preparingBeds} Preparing
            </Chip>
          </div>
          <p className={styles.cardBody}>
            {ghostAlerts.length > 0
              ? `Bed ${ghostAlerts[0]?.id} preparing for ${ghostAlerts[0]?.elapsedMinutes}m (>60m SLA).`
              : "All preparing beds cleared and open for immediate pull."}
          </p>
          <div className={styles.cardActions}>
            <Button
              size="sm"
              variant="pri"
              disabledReason={ghostAlerts.length === 0 ? "Preparing bed already cleared" : undefined}
              onClick={() => setGhostUnitState((prev) => completeCleanAndOpenBed(prev, "bed-prep-101"))}
            >
              Cleaning Complete — Open Bed
            </Button>
          </div>
        </article>

        {/* #5 T-Minus 24h Discharge Prep & Early Barrier Tagging */}
        <article className={styles.card} data-testid="top25-item-5">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#5</span>
            <h3 className={styles.cardTitle}>Prior-Day Discharge Prep & Barrier Tagging</h3>
            <Chip tone="info">{tMinus24hPrompts.length} Due Tomorrow</Chip>
          </div>
          <p className={styles.cardBody}>Early barrier taxonomy: {dischargeDelayReasonLabels[selectedBarrier]}</p>
          <div className={styles.cardActions}>
            <select
              aria-label="Early discharge barrier reason"
              value={selectedBarrier}
              onChange={(e) => setSelectedBarrier(e.target.value as DischargeDelayReason)}
            >
              {DISCHARGE_DELAY_REASONS.map((code) => (
                <option key={code} value={code}>
                  {dischargeDelayReasonLabels[code]}
                </option>
              ))}
            </select>
          </div>
        </article>

        {/* #7 Automated Silent-Ward Escalation & Re-Allocation Loop */}
        <article className={styles.card} data-testid="top25-item-7">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#7</span>
            <h3 className={styles.cardTitle}>Automated Silent-Ward Escalation Loop</h3>
            <Chip tone="danger">{silentWards.length} Unanswered</Chip>
          </div>
          <p className={styles.cardBody}>
            Flags unanswered ward referrals for amber NUM nudge and red coordinator re-allocation.
          </p>
          <div className={styles.cardActions}>
            <Button
              size="sm"
              onClick={() =>
                setUndoWindow(
                  createUndoWindowState({
                    actionId: "undo-silent-ward-switch",
                    label: "Re-allocated unanswered referral to next compatible ward",
                    createdAtMs: Date.now(),
                  }),
                )
              }
            >
              Switch to Next Compatible Ward
            </Button>
          </div>
        </article>
      </div>

      {/* Tier 2: High-Impact Clinical & Step-Down Accelerators (#8–#15) */}
      <SectionHead
        title="Tier 2 · High-Impact Clinical & Step-Down Accelerators (#8–#15)"
        subtitle="HDU step-down pull board, Criteria-Led Discharge, leave fast-track, CTO handshake, and ED escalation ladder"
      />
      <div className={styles.tierGrid}>
        {/* #8 HDU / Secure-to-Acute Step-Down Pull Board */}
        <article className={styles.card} data-testid="top25-item-8">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#8</span>
            <h3 className={styles.cardTitle}>HDU / Secure-to-Acute Step-Down Pull Board</h3>
            <Chip tone="ok">{stepDownMatches.length} Match</Chip>
          </div>
          <p className={styles.cardBody}>
            Pairs step-down-ready HDU occupants with open acute beds (
            {stepDownMatches[0]?.compatibleOpenUnitIds.join(", ")}) to unlock high-acuity capacity for ED arrivals.
          </p>
        </article>

        {/* #9 Criteria-Led Discharge (CLD) Weekend & Morning Unlocker */}
        <article className={styles.card} data-testid="top25-item-9">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#9</span>
            <h3 className={styles.cardTitle}>Criteria-Led Discharge (CLD) Unlocker</h3>
            <Chip tone={cldEval.canNurseExecuteDischarge ? "ok" : "warning"}>
              {cldEval.metCount}/{cldEval.totalCount} Criteria Met
            </Chip>
          </div>
          <p className={styles.cardBody}>
            {cldEval.canNurseExecuteDischarge
              ? "All consultant criteria met — Shift Coordinator may execute morning discharge."
              : `Awaiting: ${cldEval.unmetConditions.join(", ")}`}
          </p>
          <div className={styles.cardActions}>
            <Button
              size="sm"
              variant="pri"
              onClick={() =>
                setCldConditions({
                  [CLD_DEFAULT_CONDITIONS[0]]: true,
                  [CLD_DEFAULT_CONDITIONS[1]]: true,
                  [CLD_DEFAULT_CONDITIONS[2]]: true,
                })
              }
            >
              Mark All CLD Criteria Met
            </Button>
          </div>
        </article>

        {/* #10 Leave-to-Discharge Fast-Track & 1-Tap Return */}
        <article className={styles.card} data-testid="top25-item-10">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#10</span>
            <h3 className={styles.cardTitle}>Leave-to-Discharge Fast-Track & 1-Tap Return</h3>
            <Chip tone="warning">{leaveFastTrack.elapsedHours}h on Leave</Chip>
          </div>
          <p className={styles.cardBody}>
            {leaveFastTrack.promptsDischargeConversion
              ? "Extended overnight leave — prompt to convert to formal discharge or restore in 1 tap."
              : "Active trial leave."}
          </p>
        </article>

        {/* #11 CTO & 7-Day Follow-Up Handshake */}
        <article className={styles.card} data-testid="top25-item-11">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#11</span>
            <h3 className={styles.cardTitle}>CTO & 7-Day Follow-Up Handshake</h3>
            <Chip tone={ctoHandshake.warningActive ? "warning" : "ok"}>Advisory</Chip>
          </div>
          <p className={styles.cardBody}>{ctoHandshake.summary}</p>
        </article>

        {/* #12 Stuck-Handover SLA Timer & Escalation Nudge */}
        <article className={styles.card} data-testid="top25-item-12">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#12</span>
            <h3 className={styles.cardTitle}>Stuck-Handover SLA Timer & Escalation Nudge</h3>
            <Chip tone={stuckHandover.isStuck ? "danger" : "ok"}>{stuckHandover.elapsedMinutes}m Accepted</Chip>
          </div>
          <p className={styles.cardBody}>{stuckHandover.actionLabel}</p>
        </article>

        {/* #13 ED Long-Wait Escalation Ladder */}
        <article className={styles.card} data-testid="top25-item-13">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#13</span>
            <h3 className={styles.cardTitle}>ED Long-Wait Escalation Ladder</h3>
            <Chip tone="danger">Top Wait {edLadder[0]?.waitHours ?? 0}h</Chip>
          </div>
          <p className={styles.cardBody}>Tiers: {edLadder.map((e) => `${e.id} (${e.tier})`).join(" · ")}</p>
        </article>

        {/* #14 Pre-Flight Admissions Packet (4-Tick Clearance Card) */}
        <article className={styles.card} data-testid="top25-item-14">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#14</span>
            <h3 className={styles.cardTitle}>Pre-Flight Admissions Packet (4-Tick Card)</h3>
            <Chip tone={preFlightResult.allComplete ? "ok" : "warning"}>
              {preFlightResult.completedCount}/{preFlightResult.totalCount} Complete
            </Chip>
          </div>
          <p className={styles.cardBody}>
            {preFlightResult.allComplete
              ? "All 4 pre-flight clearances complete — ready for transport collection."
              : `Missing: ${preFlightResult.missingItems.join(", ")}`}
          </p>
          <div className={styles.cardActions}>
            <Button size="sm" onClick={() => setPreFlight((prev) => ({ ...prev, medicationChart: true }))}>
              Complete Medication Chart Tick
            </Button>
          </div>
        </article>

        {/* #15 Cleaning-Bed Pre-Match (Transport-During-Clean Overlap) */}
        <article className={styles.card} data-testid="top25-item-15">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#15</span>
            <h3 className={styles.cardTitle}>Cleaning-Bed Pre-Match (Transport Overlap)</h3>
            <Chip tone={cleaningPreMatchAllowed ? "ok" : "neutral"}>
              {cleaningPreMatchAllowed ? "Pre-Match Enabled" : "Locked"}
            </Chip>
          </div>
          <p className={styles.cardBody}>
            Allows bed allocation and transport booking to run concurrently while environmental cleaning finishes.
          </p>
        </article>
      </div>

      {/* Tier 3: Network Optimization, Safety & Ergonomic Multipliers (#16–#22) */}
      <SectionHead
        title="Tier 3 · Network Optimization, Safety & Ergonomic Multipliers (#16–#22)"
        subtitle="1-for-1 inter-ward swaps, virtual discharge lounge, paper-form expiry radar, marooned dossier, and EDD drift"
      />
      <div className={styles.tierGrid}>
        {/* #16 Inter-Ward Step-Down Swap Matcher */}
        <article className={styles.card} data-testid="top25-item-16">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#16</span>
            <h3 className={styles.cardTitle}>Inter-Ward Step-Down Swap Matcher</h3>
            <Chip tone="info">{swapPairs.length} Mutual Swap</Chip>
          </div>
          <p className={styles.cardBody}>
            Matched 1-for-1 exchange between {swapPairs[0]?.unitA} and {swapPairs[0]?.unitB} when both wards are at full
            occupancy.
          </p>
        </article>

        {/* #18 Virtual Discharge Lounge / Transit Chair Early Bed Release */}
        <article className={styles.card} data-testid="top25-item-18">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#18</span>
            <h3 className={styles.cardTitle}>Virtual Discharge Lounge Early Bed Release</h3>
            <Chip tone="ok">
              {loungeUnit.availableBeds} Bed Free · {loungeUnit.loungeOccupied} in Lounge
            </Chip>
          </div>
          <p className={styles.cardBody}>
            {loungeEligible.length} low-risk cleared patient eligible to move to transit lounge, releasing the acute bed
            immediately.
          </p>
          <div className={styles.cardActions}>
            <Button
              size="sm"
              variant="pri"
              disabledReason={isLoungeCandidateReleased ? "Patient already moved to transit lounge" : undefined}
              onClick={() => setLoungeUnit((prev) => releaseBedToDischargeLounge(prev, loungeCandidateId))}
            >
              Move to Discharge Lounge & Release Bed
            </Button>
          </div>
        </article>

        {/* #19 Paper-Form Statutory Expiry Radar */}
        <article className={styles.card} data-testid="top25-item-19">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#19</span>
            <h3 className={styles.cardTitle}>Paper-Form Statutory Expiry Radar</h3>
            <Chip tone="danger">{paperExpiryRadar[0]?.urgency}</Chip>
          </div>
          <p className={styles.cardBody}>
            Tracks manually entered paper form timestamps (
            {paperExpiryRadar.map((f) => `${f.formType}: ${f.remainingMinutes}m`).join(", ")}).
          </p>
        </article>

        {/* #20 Marooned Long-Stay Patient Escalation Dossier */}
        <article className={styles.card} data-testid="top25-item-20">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#20</span>
            <h3 className={styles.cardTitle}>Marooned Long-Stay Escalation Dossier</h3>
            <Chip tone="warning">{maroonedDossier[0]?.estimatedBedDaysSaved ?? 0}d Delayed</Chip>
          </div>
          <p className={styles.cardBody}>{maroonedDossier[0]?.escalationSummary}</p>
        </article>

        {/* #21 EDD Drift & Confidence Indicator */}
        <article className={styles.card} data-testid="top25-item-21">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#21</span>
            <h3 className={styles.cardTitle}>EDD Drift & Confidence Indicator</h3>
            <Chip tone={eddDrift.confidence === "low" ? "danger" : "info"}>{eddDrift.label}</Chip>
          </div>
          <p className={styles.cardBody}>
            Confidence: {eddDrift.confidence.toUpperCase()} ({eddDrift.revisionCount} revisions recorded).
          </p>
        </article>
      </div>

      {/* Tier 4: Mobile Walk-Round, Safety & Lifecycle Completion (#23–#25) */}
      <SectionHead
        title="Tier 4 · Mobile Walk-Round, AWOL Safety & Broadcast Lifecycle (#23–#25)"
        subtitle="390×844 thumb-zone walk-round sheet, AWOL safety & bed-hold tracker, and broadcast auto-expiry"
      />
      <div className={styles.tierGrid}>
        {/* #23 Mobile Walk-Round Bottom-Sheet */}
        <PhoneWalkRoundSheet />

        {/* #24 AWOL / Unauthorised Leave Immediate Safety & Bed-Hold Tracker */}
        <article className={styles.card} data-testid="top25-item-24">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#24</span>
            <h3 className={styles.cardTitle}>AWOL / Unauthorised Leave Safety & Bed-Hold Tracker</h3>
            <Chip tone={awolSummary.holdWarningActive ? "danger" : "warning"}>{awolSummary.bedStatus}</Chip>
          </div>
          <p className={styles.cardBody}>
            Unit {awolSummary.unitId} · {awolSummary.elapsedMinutes}m elapsed · Police notified:{" "}
            {awolSummary.wapolNotified ? "Yes" : "No"} · Next-of-kin notified:{" "}
            {awolSummary.nextOfKinNotified ? "Yes" : "Pending"}
          </p>
        </article>

        {/* #25 Broadcast Alert Auto-Expiry & Stand-Down Lifecycle */}
        <article className={styles.card} data-testid="top25-item-25">
          <div className={styles.cardHeader}>
            <span className={styles.cardRank}>#25</span>
            <h3 className={styles.cardTitle}>Broadcast Alert Auto-Expiry & Stand-Down Lifecycle</h3>
            <Chip tone={broadcastState.activeAlert ? "danger" : "ok"}>
              {broadcastState.activeAlert ? "Active Surge Alert" : "Stood Down"}
            </Chip>
          </div>
          <WardBroadcastBanner
            activeAlert={broadcastState.activeAlert}
            now="2026-10-15T08:30:00.000Z"
            onExtend={() => setBroadcastState((prev) => wardBroadcastReducer(prev, { type: "EXTEND_BROADCAST_ALERT" }))}
            onClear={() => setBroadcastState((prev) => wardBroadcastReducer(prev, { type: "CLEAR_BROADCAST_ALERT" }))}
          />
        </article>
      </div>

      {/* #22 Global Command Palette Modal */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        enableGlobalShortcut={false}
        items={commandItems}
        placeholder="Jump to ward, patient, or flow action (Ctrl+K)..."
      />
    </div>
  );
}
