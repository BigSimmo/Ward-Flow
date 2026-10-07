"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  BellRing,
  ChevronDown,
  BedDouble,
  ClipboardList,
  Radio,
  Truck,
  Users,
  X,
  Info,
} from "lucide-react";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById } from "@/components/ward-management/ward-sites";
import {
  WA_BROADCAST_TEMPLATES,
  getActiveBroadcastAlert,
  formatTimeRemaining,
  type BroadcastSeverity,
  type BroadcastTargetScope,
  type BroadcastCategory,
} from "./ward-broadcast-model";

import {
  isBroadcastDraftDirty,
  parseBroadcastDraft,
  serialiseBroadcastDraft,
  type BroadcastDraft,
} from "./broadcast-draft";

import styles from "./alerts.module.css";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";

/**
 * **THE ALERTS SCREEN — what is addressed to a role right now, across every movement and referral.**
 *
 * It never says "nothing is wrong", and that is the whole design. Ward Lead ruling, 2026-09-12:
 * an empty alerts screen saying "all clear" is a clinical claim about the entire service, made by
 * a screen that checked SEVEN named conditions against one fixture. This screen reports on every
 * condition it looked at, by name, whether the section is empty or not.
 */

function itemsInCategory(items: InboxItem[], category: keyof typeof INBOX_CATEGORIES): InboxItem[] {
  const prefix = INBOX_CATEGORIES[category].idPrefix;
  return items.filter((item) => item.id.startsWith(prefix));
}

function tierOfItem(item: InboxItem): "emergency" | "capacity" | "admin" {
  if (
    item.id.startsWith(INBOX_CATEGORIES.legal_timing_breached.idPrefix) ||
    item.id.startsWith(INBOX_CATEGORIES.destination_unlawful.idPrefix)
  ) {
    return "emergency";
  }
  if (
    item.id.startsWith(INBOX_CATEGORIES.destinations_declined.idPrefix) ||
    item.id.startsWith(INBOX_CATEGORIES.bed_pull_expired.idPrefix)
  ) {
    return "capacity";
  }
  return "admin";
}

function getAlertSeverity(item: InboxItem): { tone: "danger" | "warn" | "accent"; label: string } {
  const tier = tierOfItem(item);
  if (tier === "emergency" || item.tone === "danger") {
    return { tone: "danger", label: "Critical" };
  }
  if (tier === "capacity") {
    return { tone: "warn", label: "Urgent" };
  }
  return { tone: "accent", label: "Routine" };
}

function roleMatches(item: InboxItem, role: string): boolean {
  if (role === "all") return true;
  const owner = item.owner.toLowerCase();
  if (role === "coordinator") {
    return owner.includes("coordinator") || tierOfItem(item) === "emergency";
  }
  if (role === "registrar") {
    return owner.includes("ed") || owner.includes("registrar") || owner.includes("team");
  }
  if (role === "bed_manager") {
    return owner.includes("bed") || owner.includes("manager");
  }
  if (role === "num") {
    return owner.includes("ward") || owner.includes("nurse") || owner.includes("num");
  }
  return true;
}

/**
 * Who an alert is about, read only from the model's own links.
 *
 * A typed-in table of 35 names, record numbers and places used to fill the gaps here, keyed by
 * movement id. None of its rows matched the record: 16 put another patient's name on the movement
 * and the rest invented a person the model does not hold (25 September 2026 audit, A1 and A7). A
 * movement linked to nobody now says so, in the resolver's own words.
 */
function resolveAlertPatient(
  movement: Movement | undefined,
  movementId: string | undefined,
  patientsList?: Patient[],
  referralsList?: Referral[],
  movementsList?: Movement[],
  unitsList?: readonly { id: string; name: string }[],
): { displayName: string; umrn: string; location: string; routeTarget: string } {
  const mid = movement?.id ?? movementId ?? "";
  const info = resolveSubjectPatient(movement ?? { id: mid }, {
    patients: patientsList,
    referrals: referralsList,
    movements: movementsList,
  });

  let location = "";
  if (movement) {
    if (movement.originEdId) {
      location = edById(movement.originEdId)?.name ?? movement.originEdId;
    } else if (movement.acceptedUnitId) {
      location = unitsList?.find((u) => u.id === movement.acceptedUnitId)?.name ?? movement.acceptedUnitId;
    }
  }
  if (!location) location = "Location not recorded";

  const routeTarget = info.patient?.id ?? mid;

  return { displayName: info.displayName, umrn: info.umrn, location, routeTarget };
}

function getCategoryBadge(item: InboxItem): { tone: "danger" | "warn" | "accent"; label: string } {
  if (item.id.startsWith(INBOX_CATEGORIES.legal_timing_breached.idPrefix)) {
    return { tone: "danger", label: "Form Due Time Passed" };
  }
  if (item.id.startsWith(INBOX_CATEGORIES.destinations_declined.idPrefix)) {
    return { tone: "danger", label: "Multiple Declines" };
  }
  if (item.id.startsWith(INBOX_CATEGORIES.destination_unlawful.idPrefix)) {
    return { tone: "danger", label: "Destination Review" };
  }
  if (item.id.startsWith(INBOX_CATEGORIES.bed_pull_expired.idPrefix)) {
    return { tone: "warn", label: "Reservation Window" };
  }
  if (item.id.startsWith(INBOX_CATEGORIES.transport_awaiting_departure.idPrefix)) {
    return { tone: "accent", label: "Transport Leg" };
  }
  return { tone: "accent", label: "Operational Alert" };
}

function getPatientDisplayName(
  movement: Movement | undefined,
  referralsList: Referral[],
  patientsList: Patient[],
  unitsList?: readonly { id: string; name: string }[],
  state: { units?: readonly { id: string; name: string }[] } = { units: unitsList },
): string {
  if (!movement) return "Patient not recorded";
  const p = resolveAlertPatient(movement, movement.id, patientsList, referralsList, undefined, state.units);
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  return `${p.displayName} (UMRN: ${p.umrn}) · ${p.location}`;
}

/**
 * A labelled context section that remains reachable whether or not its condition has rows.
 * `watches` is permanent scope text; `none` appears only when the measured set is empty.
 */
function ConditionContext({
  title,
  watches,
  none,
  items,
}: {
  title: string;
  watches: string;
  none: string;
  items: InboxItem[];
}) {
  return (
    <section className={styles.condition} aria-label={title}>
      <h3 className={styles.conditionTitle}>{title}</h3>
      <p className={styles.watches}>{watches}</p>
      {items.length === 0 ? <p className={styles.none}>{none}</p> : null}
    </section>
  );
}

export function extractOverdue(detail: string): string | null {
  const match = detail.match(/(\d+\s*d(?:\s*\d+\s*h)?\s*overdue|\d+\s*[hm]\s*(?:\d+\s*m)?\s*overdue)/i);
  return match ? match[1] : null;
}

/** Remove the legacy movement reference from presentation, preserving the recorded detail. */
function alertDetail(item: InboxItem): string {
  const prefix = `${item.movementId} · `;
  return item.movementId && item.detail.startsWith(prefix) ? item.detail.slice(prefix.length) : item.detail;
}

function AlertRows({
  items,
  empty,
  onAction,
  onQuickAction,
  acknowledgements,
  patients,
  referrals,
  movements,
  units,
  state = { units },
  isFiltered,
  onResetFilters,
}: {
  items: InboxItem[];
  empty: string;
  onAction?: (item: InboxItem, triggerEl: HTMLElement) => void;
  onQuickAction?: (item: InboxItem, action: "snooze" | "escalate" | "acknowledge", patientName: string) => void;
  acknowledgements: Record<string, unknown>;
  patients?: Patient[];
  referrals?: Referral[];
  movements?: Movement[];
  units?: readonly { id: string; name: string }[];
  state?: { units?: readonly { id: string; name: string }[] };
  isFiltered?: boolean;
  onResetFilters?: () => void;
}) {
  const [openQuickMenuId, setOpenQuickMenuId] = useState<string | null>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const quickMenuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openQuickMenuId) return;
    quickMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const handleClickOutside = () => setOpenQuickMenuId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenQuickMenuId(null);
        quickMenuTriggerRef.current?.focus();
      }
    };
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openQuickMenuId]);

  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <p className={styles.alertsEmpty}>{empty}</p>
        {isFiltered && onResetFilters && (
          <button type="button" className={styles.resetFilterBtn} onClick={onResetFilters}>
            Clear active filters
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className={styles.rows}>
      {items.map((item) => {
        const isAcknowledged = Array.isArray(acknowledgements[item.id])
          ? (acknowledgements[item.id] as unknown[]).length > 0
          : Boolean(acknowledgements[item.id]);
        const severity = getAlertSeverity(item);
        const categoryBadge = getCategoryBadge(item);
        const overdueText = extractOverdue(item.detail);
        const movement = movements?.find((m) => m.id === item.movementId);
        const patientInfo = resolveAlertPatient(movement, item.movementId, patients, referrals, movements, state.units);

        const actionVerb =
          categoryBadge.label === "Form Due Time Passed"
            ? "Record Renewal"
            : categoryBadge.label === "Multiple Declines"
              ? "Intervene"
              : categoryBadge.label === "Reservation Window"
                ? "Extend Hold"
                : categoryBadge.label === "Transport Leg"
                  ? "Review Leg"
                  : "Action";

        return (
          <li key={item.id} className={styles.alertCard} data-tone={item.tone} data-movement-id={item.movementId}>
            <div className={styles.alertIcon} data-tone={severity.tone}>
              {categoryBadge.label === "Reservation Window" ? (
                <BedDouble className={styles.tabIcon} aria-hidden="true" />
              ) : categoryBadge.label === "Transport Leg" ? (
                <Truck className={styles.tabIcon} aria-hidden="true" />
              ) : severity.tone === "danger" ? (
                <AlertCircle className={styles.tabIcon} aria-hidden="true" />
              ) : severity.tone === "warn" ? (
                <AlertTriangle className={styles.tabIcon} aria-hidden="true" />
              ) : (
                <Clock className={styles.tabIcon} aria-hidden="true" />
              )}
            </div>
            <div className={styles.alertContent}>
              <div className={styles.alertHead}>
                <span className={styles.alertTitleText}>{item.title}</span>
                {overdueText && (
                  <span className={styles.overdueChip} data-tone={severity.tone}>
                    <Clock className={styles.chipIcon} aria-hidden="true" />
                    {overdueText}
                  </span>
                )}
                {!overdueText && <span className={styles.alertTiming}>{alertDetail(item)}</span>}
                <span className={styles.alertMetaText}>
                  <strong className={styles.patientName}>{patientInfo.displayName}</strong> · UMRN:{" "}
                  <strong>{patientInfo.umrn}</strong> •{" "}
                  <span className={styles.locationTag}>{patientInfo.location}</span> · Owner: {item.owner}
                </span>
                {isAcknowledged && (
                  <span className={styles.badge} data-tone="good">
                    <Check className={styles.btnIcon} aria-hidden="true" />
                    Acknowledged
                  </span>
                )}
              </div>
            </div>
            <div className={styles.alertActions}>
              <button
                type="button"
                aria-label={`${actionVerb} for ${patientInfo.displayName}`}
                title={`${actionVerb}: ${item.title}`}
                data-testid="ward-alerts-action-btn"
                className={`${styles.btn} ${styles.btnSm} ${severity.tone === "danger" ? styles.btnDanger : ""}`}
                onClick={(e) => onAction?.(item, e.currentTarget)}
              >
                {actionVerb}
              </button>
              {categoryBadge.label === "Form Due Time Passed" && (
                <Link
                  className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondaryLink}`}
                  href="/mockups/ward-flow/legal-forms"
                >
                  View Order
                </Link>
              )}
              {categoryBadge.label === "Multiple Declines" && (
                <Link
                  className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondaryLink}`}
                  href={
                    patientInfo.routeTarget
                      ? `/mockups/ward-flow/people/${encodeURIComponent(patientInfo.routeTarget)}`
                      : "/mockups/ward-flow"
                  }
                >
                  Trajectory
                </Link>
              )}

              {/* Inline Quick Action Dropdown */}
              <div className={styles.quickActionDropdownWrap}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSm} ${styles.quickActionTrigger}`}
                  aria-label={`More actions for ${item.title} · ${patientInfo.displayName}`}
                  title={`More actions for ${patientInfo.displayName}`}
                  aria-haspopup="menu"
                  aria-expanded={openQuickMenuId === item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    quickMenuTriggerRef.current = e.currentTarget;
                    setOpenQuickMenuId((prev) => (prev === item.id ? null : item.id));
                  }}
                >
                  <ChevronDown className={styles.btnIcon} aria-hidden="true" />
                </button>
                {openQuickMenuId === item.id && (
                  <div
                    ref={quickMenuRef}
                    className={styles.quickActionMenu}
                    role="menu"
                    aria-label={`Actions for ${patientInfo.displayName}`}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenQuickMenuId(null);
                    }}
                    onKeyDown={(event) => {
                      const options = Array.from(
                        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
                      );
                      const current = options.indexOf(document.activeElement as HTMLButtonElement);
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? options.length - 1
                            : event.key === "ArrowDown"
                              ? (current + 1) % options.length
                              : event.key === "ArrowUp"
                                ? (current - 1 + options.length) % options.length
                                : -1;
                      if (next < 0) return;
                      event.preventDefault();
                      options[next]?.focus();
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.quickActionMenuItem}
                      onClick={() => {
                        setOpenQuickMenuId(null);
                        onQuickAction?.(item, "snooze", patientInfo.displayName);
                      }}
                    >
                      <Clock className={styles.btnIcon} aria-hidden="true" />
                      <span>Snooze 30m</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.quickActionMenuItem}
                      onClick={() => {
                        setOpenQuickMenuId(null);
                        onQuickAction?.(item, "escalate", patientInfo.displayName);
                      }}
                    >
                      <AlertTriangle className={styles.btnIcon} aria-hidden="true" />
                      <span>Escalate to Consultant On-Call</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.quickActionMenuItem}
                      onClick={() => {
                        setOpenQuickMenuId(null);
                        onQuickAction?.(item, "acknowledge", patientInfo.displayName);
                      }}
                    >
                      <Check className={styles.btnIcon} aria-hidden="true" />
                      <span>Acknowledge &amp; Monitor</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AlertsScreen() {
  const { worldGeneration } = useWardFlow();
  return <AlertsWorkspace key={worldGeneration} />;
}

function AlertsWorkspace() {
  usePrintableDisclosures();

  const state = useWardFlow();
  const { movements, units, referrals, patients, dispatch, inboxAcknowledgements, broadcastAlerts, notices } = state;
  const now = useWardFlowClock();
  const openMovements = useMemo(() => movements.filter(isOpen), [movements]);
  const inbox = useMemo(() => buildActionInbox(openMovements, now, units), [openMovements, now, units]);
  const feedNotices = useMemo(() => [...notices].sort((a, b) => b.raisedAt - a.raisedAt), [notices]);

  const [tierFilter, setTierFilter] = useState<"all" | "emergency" | "capacity" | "admin">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastConfirmed, setBroadcastConfirmed] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<InboxItem | null>(null);

  const defaultTmpl = WA_BROADCAST_TEMPLATES[0];
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTmpl?.id ?? "custom");
  const [broadcastTitle, setBroadcastTitle] = useState(
    defaultTmpl?.title ?? "Critical HDU Capacity: Immediate Discharge & Step-Down Review",
  );
  const [broadcastMessage, setBroadcastMessage] = useState(defaultTmpl?.defaultMessage ?? "");

  const [broadcastSeverity, setBroadcastSeverity] = useState<BroadcastSeverity>(defaultTmpl?.severity ?? "critical");
  const [broadcastCategory, setBroadcastCategory] = useState<BroadcastCategory>(
    defaultTmpl?.category ?? "capacity_gridlock",
  );
  const [broadcastScope, setBroadcastScope] = useState<BroadcastTargetScope>(defaultTmpl?.targetScope ?? "all");
  const [broadcastDurationMinutes, setBroadcastDurationMinutes] = useState(defaultTmpl?.defaultDurationMinutes ?? 240);
  const [broadcastSuccessNotice, setBroadcastSuccessNotice] = useState<string | null>(null);
  const [broadcastRequest, setBroadcastRequest] = useState<{
    type: "DISPATCH_BROADCAST_ALERT" | "STAND_DOWN_BROADCAST_ALERT";
    logOffset: number;
    title: string;
    scope: BroadcastTargetScope;
    scopeLabel: string;
  } | null>(null);
  const broadcastResult = broadcastRequest
    ? state.eventLog?.slice(broadcastRequest.logOffset).find((entry) => entry.type === broadcastRequest.type)
    : undefined;
  const broadcastAccepted = broadcastResult?.accepted === true;
  const broadcastRefused = broadcastResult?.accepted === false;
  const isBroadcastModalOpen =
    broadcastModalOpen && !(broadcastAccepted && broadcastRequest?.type === "DISPATCH_BROADCAST_ALERT");

  // ONE draft of the WHOLE broadcast form (template, title, severity, category, target scope, duration
  // and message), cached and restored together; dirtiness is derived from the complete form, so a
  // title-only or scope-only edit is protected too. A restored draft reopens the composer it came
  // from, because a draft is only cached while the composer is open.
  const broadcastDraft = useMemo<BroadcastDraft>(
    () => ({
      templateId: selectedTemplateId,
      title: broadcastTitle,
      message: broadcastMessage,
      severity: broadcastSeverity,
      category: broadcastCategory,
      scope: broadcastScope,
      durationMinutes: broadcastDurationMinutes,
    }),
    [
      selectedTemplateId,
      broadcastTitle,
      broadcastMessage,
      broadcastSeverity,
      broadcastCategory,
      broadcastScope,
      broadcastDurationMinutes,
    ],
  );
  const restoreBroadcastDraft = useCallback((raw: string) => {
    const draft = parseBroadcastDraft(raw);
    if (!draft) return;
    setSelectedTemplateId(draft.templateId);
    setBroadcastTitle(draft.title);
    setBroadcastMessage(draft.message);
    setBroadcastSeverity(draft.severity);
    setBroadcastCategory(draft.category);
    setBroadcastScope(draft.scope);
    setBroadcastDurationMinutes(draft.durationMinutes);
    setBroadcastModalOpen(true);
  }, []);
  const { clearDraft: clearBroadcastDraft } = useDirtyStateGuard({
    key: "alerts-broadcast-directive",
    isDirty: isBroadcastModalOpen && isBroadcastDraftDirty(broadcastDraft),
    value: serialiseBroadcastDraft(broadcastDraft),
    onRestore: restoreBroadcastDraft,
    confirmMessage: "You have an unsaved statewide broadcast directive. Are you sure you want to leave?",
  });

  useEffect(() => {
    if (broadcastAccepted && broadcastRequest?.type === "DISPATCH_BROADCAST_ALERT") {
      clearBroadcastDraft();
    }
  }, [broadcastAccepted, broadcastRequest, clearBroadcastDraft]);
  const broadcastFeedback =
    broadcastRequest && broadcastResult
      ? broadcastRefused
        ? broadcastRequest.type === "DISPATCH_BROADCAST_ALERT"
          ? "Broadcast was not accepted. Your draft has been kept."
          : "Stand-down was not accepted. Review the directive."
        : broadcastRequest.type === "STAND_DOWN_BROADCAST_ALERT"
          ? broadcastRequest.scope === "all"
            ? "Statewide broadcast directive stood down."
            : `Broadcast directive stood down for ${broadcastRequest.scopeLabel}.`
          : broadcastRequest.scope === "all"
            ? `Broadcast Directive "${broadcastRequest.title}" dispatched statewide. Target: ${broadcastRequest.scopeLabel}.`
            : `Broadcast Directive "${broadcastRequest.title}" dispatched to ${broadcastRequest.scopeLabel}.`
      : broadcastSuccessNotice;

  const activeBroadcast = getActiveBroadcastAlert(broadcastAlerts ?? [], now);

  const drawerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const broadcastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);

  const handleCloseDrawer = useCallback(() => {
    setSelectedAlert(null);
    lastFocusRef.current?.focus();
  }, [setSelectedAlert]);

  const handleCloseBroadcastModal = useCallback(() => {
    setBroadcastModalOpen(false);
    setTimeout(() => {
      broadcastTriggerRef.current?.focus();
    }, 0);
  }, [setBroadcastModalOpen]);

  const trapFocus = (e: React.KeyboardEvent<HTMLElement>, container: HTMLElement | null) => {
    if (e.key !== "Tab" || !container) return;
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleDrawerKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCloseDrawer();
      return;
    }
    trapFocus(e, drawerRef.current);
  };

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCloseBroadcastModal();
      return;
    }
    trapFocus(e, modalRef.current);
  };

  const legal = useMemo(() => itemsInCategory(inbox, "legal_timing_breached"), [inbox]);
  const declined = useMemo(() => itemsInCategory(inbox, "destinations_declined"), [inbox]);
  const unlawful = useMemo(() => itemsInCategory(inbox, "destination_unlawful"), [inbox]);
  const pullExpired = useMemo(() => itemsInCategory(inbox, "bed_pull_expired"), [inbox]);
  const transport = useMemo(() => itemsInCategory(inbox, "transport_awaiting_departure"), [inbox]);

  const withDeadline = openMovements.filter((movement: Movement) => movement.legalForm?.dueAt !== undefined);
  const declineCandidates = openMovements.filter((movement: Movement) => movement.declines.length > 0).length;
  const overrides = movements.flatMap((movement: Movement) => movement.overrides);
  const untriaged = (state.referrals ?? []).filter((referral) => referral.triagedAt === undefined);
  const needsYouCount = legal.length + declined.length + unlawful.length;
  const otherRolesCount = pullExpired.length + transport.length;
  const totalActive = needsYouCount + otherRolesCount;

  // Prolonged ED stays (>24h)
  const prolongedEdCount = openMovements.filter(
    (m: Movement) => m.originEdId !== undefined && now - m.openedAt >= 1440,
  ).length;

  // Tier counts
  const tier1Count = legal.length + unlawful.length;
  const tier2Count = declined.length + pullExpired.length;
  const tier3Count = transport.length;

  // Role counts
  const coordinatorCount = inbox.filter((item) => roleMatches(item, "coordinator")).length;
  const registrarCount = inbox.filter((item) => roleMatches(item, "registrar")).length;
  const bedManagerCount = inbox.filter((item) => roleMatches(item, "bed_manager")).length;
  const numCount = inbox.filter((item) => roleMatches(item, "num")).length;

  const [snoozedAlertIds, setSnoozedAlertIds] = useState<string[]>([]);

  const handleQuickAction = useCallback(
    (item: InboxItem, action: "snooze" | "escalate" | "acknowledge", patientName: string) => {
      setBroadcastRequest(null);
      setBroadcastModalOpen(false);
      if (action === "snooze") {
        setSnoozedAlertIds((prev) => [...prev, item.id]);
        setBroadcastSuccessNotice(`Alert for ${patientName} snoozed for 30 minutes.`);
      } else if (action === "escalate") {
        setBroadcastSuccessNotice(`Escalated "${item.title}" to Consultant Psychiatrist on-call.`);
      } else if (action === "acknowledge") {
        dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now, inboxItemId: item.id });
        setBroadcastSuccessNotice(`Alert "${item.title}" acknowledged and retained on active watch.`);
      }
    },
    [dispatch, now],
  );

  // Filtered collections
  const filteredNeedsYou = useMemo(() => {
    const allNeeds = [...legal, ...declined, ...unlawful];
    return allNeeds.filter((item) => {
      if (snoozedAlertIds.includes(item.id)) return false;
      if (tierFilter !== "all" && tierOfItem(item) !== tierFilter) return false;
      if (roleFilter !== "all" && !roleMatches(item, roleFilter)) return false;
      return true;
    });
  }, [legal, declined, unlawful, tierFilter, roleFilter, snoozedAlertIds]);

  const filteredOtherRoles = useMemo(() => {
    const allOther = [...pullExpired, ...transport];
    return allOther.filter((item) => {
      if (snoozedAlertIds.includes(item.id)) return false;
      if (tierFilter !== "all" && tierOfItem(item) !== tierFilter) return false;
      if (roleFilter !== "all" && !roleMatches(item, roleFilter)) return false;
      return true;
    });
  }, [pullExpired, transport, tierFilter, roleFilter, snoozedAlertIds]);

  // Selected alert details
  const selectedMovement = useMemo(() => {
    if (!selectedAlert) return undefined;
    return openMovements.find((m) => m.id === selectedAlert.movementId);
  }, [selectedAlert, openMovements]);

  const selectedPatientName = useMemo(() => {
    return getPatientDisplayName(selectedMovement, referrals, patients, state.units);
  }, [selectedMovement, referrals, patients, state.units]);

  const selectedSeverity = useMemo(() => {
    return selectedAlert ? getAlertSeverity(selectedAlert) : { tone: "accent" as const, label: "Routine" };
  }, [selectedAlert]);

  const isSelectedAcknowledged = selectedAlert ? (inboxAcknowledgements[selectedAlert.id]?.length ?? 0) > 0 : false;

  // Escape key handler for drawer and modal
  useEffect(() => {
    if (!selectedAlert && !isBroadcastModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedAlert) {
          handleCloseDrawer();
        }
        if (isBroadcastModalOpen) {
          handleCloseBroadcastModal();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAlert, isBroadcastModalOpen, handleCloseDrawer, handleCloseBroadcastModal]);

  // Focus on open
  useEffect(() => {
    if (selectedAlert) {
      drawerCloseRef.current?.focus();
    }
  }, [selectedAlert]);

  useEffect(() => {
    if (isBroadcastModalOpen) {
      modalCloseRef.current?.focus();
    }
  }, [isBroadcastModalOpen]);

  useEffect(() => {
    if (broadcastAccepted && broadcastRequest?.type === "DISPATCH_BROADCAST_ALERT") {
      broadcastTriggerRef.current?.focus();
    }
  }, [broadcastAccepted, broadcastRequest]);

  const handleOpenAction = (item: InboxItem, triggerEl: HTMLElement) => {
    lastFocusRef.current = triggerEl;
    setSelectedAlert(item);
  };

  const handleAcknowledge = () => {
    if (!selectedAlert) return;
    dispatch({
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now,
      inboxItemId: selectedAlert.id,
    });
  };

  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (tmplId === "custom") {
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastSeverity("critical");
      setBroadcastCategory("capacity_gridlock");
      setBroadcastScope("all");
      setBroadcastDurationMinutes(240);
      return;
    }
    const tmpl = WA_BROADCAST_TEMPLATES.find((t) => t.id === tmplId);
    if (tmpl) {
      setBroadcastTitle(tmpl.title);
      setBroadcastMessage(tmpl.defaultMessage);
      setBroadcastSeverity(tmpl.severity);
      setBroadcastCategory(tmpl.category);
      setBroadcastScope(tmpl.targetScope);
      setBroadcastDurationMinutes(tmpl.defaultDurationMinutes);
    }
  };

  const handleDispatchBroadcast = () => {
    if (!broadcastConfirmed || !broadcastTitle.trim() || !broadcastMessage.trim()) return;
    if (broadcastRequest && !broadcastResult) return;
    const targetScopeLabel =
      broadcastScope === "all"
        ? "All Inpatient Units & ED Liaison Desks"
        : broadcastScope === "metro_adult"
          ? "Metropolitan Adult Acute Services"
          : broadcastScope === "ed_liaison"
            ? "Emergency Department Mental Health Liaison"
            : broadcastScope === "forensic"
              ? "Frankland Centre Forensic Mental Health"
              : broadcastScope === "adolescent"
                ? "CAMHS Adolescent Acute Units"
                : broadcastScope === "older_adult"
                  ? "Psychogeriatric & Older Adult Units"
                  : "WACHS Regional Mental Health Network";

    setBroadcastSuccessNotice(null);
    setBroadcastRequest({
      type: "DISPATCH_BROADCAST_ALERT",
      logOffset: state.eventLog?.length ?? 0,
      title: broadcastTitle.trim(),
      scope: broadcastScope,
      scopeLabel: targetScopeLabel,
    });
    dispatch({
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now,
      title: broadcastTitle,
      message: broadcastMessage,
      severity: broadcastSeverity,
      category: broadcastCategory,
      targetScope: broadcastScope,
      targetScopeLabel,
      durationMinutes: broadcastDurationMinutes,
      dispatchedByName: "State Mental Health Bed Desk Coordinator",
    });
  };

  const handleStandDown = (alertId: string) => {
    const alert = broadcastAlerts?.find((entry) => entry.id === alertId);
    setBroadcastSuccessNotice(null);
    setBroadcastRequest({
      type: "STAND_DOWN_BROADCAST_ALERT",
      logOffset: state.eventLog?.length ?? 0,
      title: alert?.title ?? "Directive",
      scope: alert?.targetScope ?? "all",
      scopeLabel: alert?.targetScopeLabel ?? "the selected scope",
    });
    dispatch({
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now,
      alertId,
      stoodDownByRole: "coordinator",
    });
  };

  return (
    <div className={styles.screen} data-testid="ward-alerts-page" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        {/* Clinical Page Header — Action & Status Deck */}
        <header className={styles.pageHeader}>
          <div className={styles.headerLeftDeck}>
            <h1 aria-label="Alerts and Operational Notices">Alerts</h1>
            <dl className={styles.summary} aria-label="Alert summary">
              <div data-tone={needsYouCount > 0 ? "danger" : "quiet"}>
                <dt>Needs you</dt>
                <dd>{needsYouCount}</dd>
              </div>
              <div>
                <dt>Other roles</dt>
                <dd>{otherRolesCount}</dd>
              </div>
              <div>
                <dt>Conditions checked</dt>
                <dd>7</dd>
              </div>
            </dl>
          </div>
          <div className={styles.pageHeaderActions}>
            <button
              ref={broadcastTriggerRef}
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBroadcast}`}
              onClick={(e) => {
                broadcastTriggerRef.current = e.currentTarget;
                setBroadcastRequest(null);
                setBroadcastSuccessNotice(null);
                setBroadcastConfirmed(false);
                setBroadcastModalOpen(true);
              }}
            >
              <Radio className={styles.btnIcon} aria-hidden="true" />
              <span>Broadcast Network Alert</span>
            </button>
          </div>
        </header>

        {/* Broadcast Toast Notification */}
        {broadcastFeedback && (!broadcastRefused || !isBroadcastModalOpen) && (
          <div
            className={`${styles.toastSuccess}${broadcastRefused ? ` ${styles.toastRefused}` : ""}`}
            role={broadcastRefused ? "alert" : "status"}
            aria-label="Broadcast feedback"
          >
            {broadcastRefused ? (
              <AlertTriangle className={styles.btnIcon} aria-hidden="true" />
            ) : (
              <Check className={styles.btnIcon} aria-hidden="true" />
            )}
            <span>{broadcastFeedback}</span>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm}`}
              style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer" }}
              onClick={() => {
                if (broadcastAccepted) setBroadcastModalOpen(false);
                setBroadcastRequest(null);
                setBroadcastSuccessNotice(null);
              }}
              aria-label="Dismiss notice"
            >
              <X className={styles.tabIcon} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Active Statewide Broadcast Directive Banner Card */}
        {activeBroadcast && (
          <div
            className={styles.activeDirectiveCard}
            data-severity={activeBroadcast.severity}
            aria-live="assertive"
            aria-atomic="true"
            aria-label="Active Statewide Directive"
          >
            {/* The acknowledged-units count below is announced; this sentence travels with it
                (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
            <span className="sr-only">These counts are invented figures.</span>
            <div className={styles.directiveHead}>
              <span className={styles.directivePulse} aria-hidden="true" />
              <span
                className={styles.badge}
                data-tone={
                  activeBroadcast.severity === "critical"
                    ? "danger"
                    : activeBroadcast.severity === "warning"
                      ? "warn"
                      : "accent"
                }
              >
                {activeBroadcast.severity.toUpperCase()} DIRECTIVE
              </span>
              <span className={styles.directiveTitle}>{activeBroadcast.title}</span>
              <span
                className={styles.overdueChip}
                data-tone={activeBroadcast.severity === "critical" ? "danger" : "warn"}
              >
                <Clock className={styles.chipIcon} aria-hidden="true" />
                {formatTimeRemaining(activeBroadcast.expiresAt, now)}
              </span>
            </div>
            <p className={styles.directiveBody}>{activeBroadcast.message}</p>
            <div className={styles.directiveMetaRow}>
              <span>
                <strong>Target Scope:</strong> {activeBroadcast.targetScopeLabel}
              </span>
              <span>
                <strong>Dispatched By:</strong> {activeBroadcast.dispatchedByName}
              </span>
            </div>
            <div className={styles.directiveFoot}>
              <span className={styles.ackTally}>
                <Check className={styles.btnIcon} aria-hidden="true" />
                {activeBroadcast.acknowledgedUnits.length} of {units.length} Clinical Units Acknowledged
              </span>
              <button
                type="button"
                className={styles.btnDangerOutline}
                onClick={() => handleStandDown(activeBroadcast.id)}
              >
                <AlertCircle className={styles.btnIcon} aria-hidden="true" />
                <span>Stand down this alert</span>
              </button>
            </div>
          </div>
        )}

        {/* Contextual Dynamic HUD Island */}
        <WardDynamicIsland
          title="Clinical Alerts"
          className={styles.alertsHud}
          status={legal.length > 0 || declined.length > 0 ? "alarm" : prolongedEdCount > 0 ? "warning" : "nominal"}
          statusText={
            legal.length > 0
              ? `${legal.length} form expiries passed`
              : declined.length > 0
                ? `${declined.length} placement gridlocks`
                : prolongedEdCount > 0
                  ? `${prolongedEdCount} prolonged ED waits`
                  : "All clinical escalation tiers nominal"
          }
          ariaLabel="Clinical alerts summary indicators"
          testId="ward-alerts-hud-island"
          metrics={[
            {
              id: "kpi-legal-expiries",
              label: "Form expiries passed",
              value: legal.length,
              tone: legal.length > 0 ? "danger" : "good",
              subtext:
                legal.length > 0
                  ? "Form past expiry / action required"
                  : `0 of ${withDeadline.length} with a written deadline passed`,
            },
            {
              id: "kpi-gridlock",
              label: "Placement Gridlock",
              value: declined.length,
              tone: declined.length > 0 ? "danger" : "good",
              subtext:
                declined.length > 0
                  ? "Every destination asked declined"
                  : `0 of ${declineCandidates} declined by every ward asked`,
            },
            {
              id: "kpi-ed-wait",
              label: "Prolonged ED Wait",
              value: prolongedEdCount,
              subtext: "A day or more in ED",
              tone: prolongedEdCount > 0 ? "warn" : "good",
            },
            {
              id: "kpi-active-monitored",
              label: "Active Monitored",
              value: totalActive,
              subtext: "Current inbox alerts",
              tone: "accent",
            },
          ]}
        />

        {/* Unified Operational Filter & Control Toolbar */}
        <div className={styles.toolbarCard}>
          {/* 3 Escalation Tier Tabs */}
          <div
            className={styles.tierTabBar}
            role="tablist"
            aria-label="Escalation Tiers"
            onKeyDown={(event) => {
              const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : event.key === "ArrowRight"
                      ? (current + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (current - 1 + tabs.length) % tabs.length
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              tabs[next]?.focus();
              tabs[next]?.click();
            }}
          >
            <button
              type="button"
              role="tab"
              id="alerts-tier-all"
              aria-controls="alerts-results"
              aria-label={`All alerts, all active tiers (${totalActive})`}
              tabIndex={tierFilter === "all" ? 0 : -1}
              aria-selected={tierFilter === "all"}
              className={`${styles.tierTab} ${tierFilter === "all" ? styles.tierTabActive : ""}`}
              onClick={() => setTierFilter("all")}
            >
              <Layers className={styles.tabIcon} aria-hidden="true" />
              <span>All alerts</span>
              <span className={styles.tabCount}>{totalActive}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="alerts-tier-emergency"
              aria-controls="alerts-results"
              aria-label={`Clinical risk, Tier 1: Clinical Emergency / High Risk (${tier1Count})`}
              tabIndex={tierFilter === "emergency" ? 0 : -1}
              aria-selected={tierFilter === "emergency"}
              className={`${styles.tierTab} ${tierFilter === "emergency" ? styles.tierTabActive : ""}`}
              onClick={() => setTierFilter("emergency")}
            >
              <AlertCircle className={styles.tabIcon} aria-hidden="true" />
              <span>Clinical risk</span>
              <span className={styles.tabCount} data-tone="danger">
                {tier1Count}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              id="alerts-tier-capacity"
              aria-controls="alerts-results"
              aria-label={`Capacity & delay, Tier 2: Capacity Pressure / Delay (${tier2Count})`}
              tabIndex={tierFilter === "capacity" ? 0 : -1}
              aria-selected={tierFilter === "capacity"}
              className={`${styles.tierTab} ${tierFilter === "capacity" ? styles.tierTabActive : ""}`}
              onClick={() => setTierFilter("capacity")}
            >
              <BedDouble className={styles.tabIcon} aria-hidden="true" />
              <span>Capacity &amp; delay</span>
              <span className={styles.tabCount} data-tone="warn">
                {tier2Count}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              id="alerts-tier-admin"
              aria-controls="alerts-results"
              aria-label={`Admin & transfer, Tier 3: Administrative & Transfer (${tier3Count})`}
              tabIndex={tierFilter === "admin" ? 0 : -1}
              aria-selected={tierFilter === "admin"}
              className={`${styles.tierTab} ${tierFilter === "admin" ? styles.tierTabActive : ""}`}
              onClick={() => setTierFilter("admin")}
            >
              <ClipboardList className={styles.tabIcon} aria-hidden="true" />
              <span>Admin &amp; transfer</span>
              <span className={styles.tabCount} data-tone="accent">
                {tier3Count}
              </span>
            </button>
          </div>

          {/* Role-Based Addressed Filter Pills */}
          <div className={styles.filterBar} role="region" aria-label="Filter by Addressed Role">
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Addressed to</span>
              <button
                type="button"
                className={`${styles.filterBtn} ${roleFilter === "all" ? styles.filterBtnActive : ""}`}
                aria-pressed={roleFilter === "all"}
                onClick={() => setRoleFilter("all")}
              >
                <Users className={styles.btnIcon} aria-hidden="true" />
                All Roles ({totalActive})
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${roleFilter === "coordinator" ? styles.filterBtnActive : ""}`}
                aria-pressed={roleFilter === "coordinator"}
                onClick={() => setRoleFilter("coordinator")}
              >
                Coordinator ({coordinatorCount})
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${roleFilter === "registrar" ? styles.filterBtnActive : ""}`}
                aria-pressed={roleFilter === "registrar"}
                onClick={() => setRoleFilter("registrar")}
              >
                Duty Registrar ({registrarCount})
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${roleFilter === "bed_manager" ? styles.filterBtnActive : ""}`}
                aria-pressed={roleFilter === "bed_manager"}
                onClick={() => setRoleFilter("bed_manager")}
              >
                Bed Manager ({bedManagerCount})
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${roleFilter === "num" ? styles.filterBtnActive : ""}`}
                aria-pressed={roleFilter === "num"}
                onClick={() => setRoleFilter("num")}
              >
                NUM ({numCount})
              </button>
            </div>
            <div className={styles.filterSummary}>
              <span role="status" aria-live="polite" aria-atomic="true">
                Showing {filteredNeedsYou.length + filteredOtherRoles.length} of {totalActive} alerts from synthetic
                records
              </span>
              {(tierFilter !== "all" || roleFilter !== "all") && (
                <button
                  type="button"
                  className={styles.resetFilterBtn}
                  onClick={() => {
                    setTierFilter("all");
                    setRoleFilter("all");
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Alert Groups */}
        <div
          className={styles.panelGrid}
          id="alerts-results"
          role="tabpanel"
          aria-labelledby={`alerts-tier-${tierFilter}`}
        >
          <div className={styles.priorityColumn}>
            <WardPanel title="Needs you" count={`${filteredNeedsYou.length} to act on`}>
              <div className={styles.panelBody} role="region" aria-label="Needs you alerts" tabIndex={0}>
                <AlertRows
                  items={filteredNeedsYou}
                  empty="No high-priority clinical or legal conditions are currently active."
                  onAction={handleOpenAction}
                  onQuickAction={handleQuickAction}
                  acknowledgements={inboxAcknowledgements}
                  patients={patients}
                  referrals={referrals}
                  movements={movements}
                  units={units}
                  state={state}
                  isFiltered={tierFilter !== "all" || roleFilter !== "all"}
                  onResetFilters={() => {
                    setTierFilter("all");
                    setRoleFilter("all");
                  }}
                />
              </div>
            </WardPanel>

            {/* Operational Notices & Shift Communication Feed */}
            <section className={styles.feedSection} aria-label="Operational Notices and Shift Communication Feed">
              <div className={styles.feedHead}>
                <div className={styles.feedHeadTitleGroup}>
                  <BellRing className={styles.feedIconAccent} aria-hidden="true" />
                  <h2>Role notices</h2>
                </div>
                <span className={styles.feedCount}>{feedNotices.length} recorded</span>
              </div>
              {feedNotices.length === 0 ? (
                <div className={styles.feedEmptyCard}>
                  <Info className={styles.feedIconAccent} aria-hidden="true" />
                  <div>
                    <p className={styles.none}>No notices have been raised this session.</p>
                    <p className={styles.feedEmptySub}>
                      Recorded referral, bed-hold and transport notices appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className={styles.feedList}>
                  {feedNotices.map((notice) => {
                    const isRead = notice.readAt !== undefined;
                    return (
                      <li key={notice.id} className={styles.feedItem}>
                        <div className={styles.feedIcon}>
                          <Info className={styles.tabIcon} aria-hidden="true" />
                        </div>
                        <div className={styles.feedContent}>
                          <div className={styles.feedItemHead}>
                            <span className={styles.badge} data-tone="accent">
                              Notice
                            </span>
                            <span className={styles.feedTitle}>{notice.sentence}</span>
                            <span className={styles.feedMeta}>
                              • To: {WARD_FLOW_ROLE_LABELS[notice.to.role]} • Raised{" "}
                              {formatInstantWithDay(notice.raisedAt, now)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className={styles.badge} data-tone={isRead ? "good" : "accent"}>
                            {isRead ? "Read" : "Unread"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <details className={`${styles.contextDetails} source-print`}>
              <summary>
                <Info className={styles.btnIcon} aria-hidden="true" />
                Monitoring scope &amp; limitations
                <ChevronDown className={styles.disclosureChevron} aria-hidden="true" />
              </summary>
              <div className={styles.contextGrid}>
                <ConditionContext
                  title="Form expiry passed"
                  watches="Watches every movement carrying a recorded form expiry, and fires when one passes."
                  none={`No recorded form expiry has passed. ${withDeadline.length} ${
                    withDeadline.length === 1 ? "movement carries" : "movements carry"
                  } one and none is overdue — that is a count, not a gap.`}
                  items={legal}
                />
                <ConditionContext
                  title="Every ward asked has declined"
                  watches="Watches movements where every ward approached has refused and none has accepted."
                  none="No movement has been refused by every ward it asked."
                  items={declined}
                />
                <ConditionContext
                  title="Destination no longer suitable"
                  watches="Watches accepted destinations against an authorised-hospital check for the patient's current recorded status."
                  none="No accepted destination has failed an authorised-hospital check."
                  items={unlawful}
                />
                <ConditionContext
                  title="Bed hold expired"
                  watches="Watches bed pulls against the time they were held until."
                  none="No bed hold has lapsed."
                  items={pullExpired}
                />
                <ConditionContext
                  title="Transport waiting to leave"
                  watches="Watches accepted transport legs that have not departed."
                  none="No accepted transport leg is still waiting to leave."
                  items={transport}
                />
                <section className={styles.condition} aria-label="Referral awaiting triage">
                  <h3 className={styles.conditionTitle}>Referral awaiting triage</h3>
                  <p className={styles.watches}>
                    Watches referrals that have never been triaged. Read from the referrals themselves, not from the
                    action inbox — no inbox category covers triage.
                  </p>
                  {untriaged.length === 0 ? (
                    <p className={styles.none}>Every referral has been triaged.</p>
                  ) : (
                    <p className={styles.count}>
                      <strong>
                        {untriaged.length} of {(state.referrals ?? []).length}
                      </strong>{" "}
                      referrals have never been triaged.
                    </p>
                  )}
                </section>
                <section className={styles.condition} aria-label="Override recorded">
                  <h3 className={styles.conditionTitle}>Override recorded</h3>
                  <p className={styles.watches}>
                    Watches referrals made by override. {overrides.length === 0 ? "None has been recorded." : null}
                  </p>
                  <p className={styles.gap}>
                    <strong>This screen cannot identify a prior gate verdict.</strong> The record keeps who, when, which
                    fixed reason and which wards; it does not retain a prior gate verdict.
                  </p>
                </section>
                <section className={styles.condition} aria-label="What this screen does not watch">
                  <h3 className={styles.conditionTitle}>What this screen does not watch</h3>
                  <p className={styles.gap}>
                    <strong>Handover sheets.</strong> The design for this screen carries a &ldquo;handover sheet
                    due&rdquo; alert. Nothing in this system records when a shift hands over, so there is no deadline to
                    measure and this screen cannot tell you whether one is due. It is listed here rather than left out,
                    because a screen that silently drops a condition reads as though it checked it.
                  </p>
                </section>
              </div>
            </details>
          </div>

          <WardPanel title="For other roles" count={`${filteredOtherRoles.length} elsewhere`}>
            <div className={styles.panelBody} role="region" aria-label="Alerts for other roles" tabIndex={0}>
              <AlertRows
                items={filteredOtherRoles}
                empty="No bed-hold or accepted-transport alert is firing for another role."
                onAction={handleOpenAction}
                onQuickAction={handleQuickAction}
                acknowledgements={inboxAcknowledgements}
                patients={patients}
                referrals={referrals}
                movements={movements}
                units={units}
                state={state}
                isFiltered={tierFilter !== "all" || roleFilter !== "all"}
                onResetFilters={() => {
                  setTierFilter("all");
                  setRoleFilter("all");
                }}
              />
            </div>
          </WardPanel>
        </div>

        {/* Right Inspector Drawer for Alert Escalation & Triage */}
        {selectedAlert && (
          <div className={styles.inspectorOverlay} role="presentation" onClick={handleCloseDrawer}>
            <aside
              ref={drawerRef}
              className={`${styles.inspectorDrawer} ${styles.drawer}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="action-modal-title"
              aria-describedby="action-modal-desc"
              tabIndex={-1}
              onKeyDown={handleDrawerKeyDown}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHead}>
                <div className={styles.drawerHeadTitles}>
                  <h3 id="action-modal-title" className={styles.drawerTitle}>
                    Alert Escalation &amp; Triage
                  </h3>
                  <p id="action-modal-desc" className={styles.drawerSubtitle}>
                    {selectedAlert.title}
                  </p>
                </div>
                <button
                  ref={drawerCloseRef}
                  type="button"
                  className={styles.drawerClose}
                  onClick={handleCloseDrawer}
                  aria-label="Close drawer"
                  title="Close drawer (Esc)"
                >
                  <X className={styles.tabIcon} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.drawerBody}>
                {/* Clinical Status & Owner Header */}
                <div className={styles.drawerSection}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className={styles.badge} data-tone={selectedSeverity.tone}>
                      {selectedSeverity.label}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--t-2)", fontWeight: 650, color: "var(--ink)" }}>
                    {selectedPatientName}
                  </div>
                  <div style={{ fontSize: "var(--t-1)", color: "var(--ink-soft)" }}>{alertDetail(selectedAlert)}</div>
                </div>

                {/* Case Parameters */}
                <div className={styles.drawerSection}>
                  <h4 className={styles.drawerSectionTitle}>Case Parameters &amp; Tracking</h4>
                  <div className={styles.drawerGrid}>
                    <div className={styles.drawerField}>
                      <span className={styles.drawerFieldLabel}>Origin ED / Setting</span>
                      <span className={styles.drawerFieldValue}>
                        {selectedMovement?.originEdId ?? "Emergency Dept"}
                      </span>
                    </div>
                    <div className={styles.drawerField}>
                      <span className={styles.drawerFieldLabel}>Assigned Role</span>
                      <span className={styles.drawerFieldValue}>{selectedAlert.owner}</span>
                    </div>
                    <div className={styles.drawerField}>
                      <span className={styles.drawerFieldLabel}>Legal Status</span>
                      <span className={styles.drawerFieldValue}>{selectedMovement?.legalStatus ?? "Voluntary"}</span>
                    </div>
                    <div className={styles.drawerField}>
                      <span className={styles.drawerFieldLabel}>Declines Logged</span>
                      <span className={styles.drawerFieldValue}>
                        {selectedMovement ? `${selectedMovement.declines.length} Units` : "0 Units"}
                      </span>
                    </div>
                    <div className={styles.drawerField}>
                      <span className={styles.drawerFieldLabel}>Current Clock</span>
                      <span className={styles.drawerFieldValue}>{formatInstant(now)}</span>
                    </div>
                    <div className={styles.drawerField}>
                      <span className={styles.drawerFieldLabel}>Escalation Level</span>
                      <span className={styles.drawerFieldValue}>
                        {selectedMovement?.escalation ? "Tier 2 Escalated" : "Tier 1 Standard"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acknowledgment Status Panel */}
                <div className={styles.ackBox}>
                  <div className={styles.ackText}>
                    {isSelectedAcknowledged ? (
                      <>
                        <CheckCircle2 className={styles.tabIcon} style={{ color: "var(--good)" }} aria-hidden="true" />
                        <span>Acknowledged by Duty Coordinator</span>
                      </>
                    ) : (
                      <>
                        <Clock className={styles.tabIcon} style={{ color: "var(--warn)" }} aria-hidden="true" />
                        <span>Pending Coordinator Triage</span>
                      </>
                    )}
                  </div>
                  {!isSelectedAcknowledged ? (
                    <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={handleAcknowledge}>
                      Acknowledge Alert
                    </button>
                  ) : (
                    <span className={styles.badge} data-tone="good">
                      Active In Progress
                    </span>
                  )}
                </div>

                {/* Triage & Escalation Form */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-action-intervention">
                    Action Taken / Clinical Intervention
                  </label>
                  <select id="alerts-action-intervention" className={styles.formSelect} defaultValue="escalate">
                    <option value="escalate">Escalate to Executive Director on Call (Tier 3)</option>
                    <option value="reauthorise">Extend recorded form</option>
                    <option value="override">Declare Catchment Override for Placement</option>
                    <option value="extend_hold">Extend Bed Hold (30-Minute Grace Window)</option>
                    <option value="dispatch_transport">Dispatch Urgent Mental Health Secure Transport</option>
                    <option value="acknowledge">Acknowledge &amp; Retain on Active Watch</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-action-note">
                    Clinician Sign-off Notes &amp; Rationale
                  </label>
                  <textarea
                    id="alerts-action-note"
                    className={styles.formTextarea}
                    placeholder="Record the action taken and who was contacted."
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className={styles.drawerFoot}>
                <button type="button" className={styles.btn} onClick={handleCloseDrawer}>
                  Cancel
                </button>
                {/* D4: Unconnected action confirmation */}
                <button
                  type="button"
                  data-testid="ward-alerts-action-confirm"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  aria-disabled="true"
                  aria-describedby="ward-alerts-action-confirm-note"
                  title="Not wired in this prototype."
                  onClick={ignoreUnavailableActivation}
                >
                  Record Intervention
                </button>
                <span id="ward-alerts-action-confirm-note" className={styles.confirmNote}>
                  Not wired in this prototype.
                </span>
              </div>
            </aside>
          </div>
        )}

        {/* Broadcast Statewide Network Alert Modal */}
        {isBroadcastModalOpen && (
          <div
            ref={modalRef}
            className={`${styles.modal} ${styles.modalOverlay}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="broadcast-title"
            aria-describedby="broadcast-desc"
            tabIndex={-1}
            onKeyDown={handleModalKeyDown}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseBroadcastModal();
              }
            }}
          >
            <div className={`${styles.modalDialog} ${styles.card}`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHead}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Radio className={styles.titleIcon} aria-hidden="true" style={{ color: "var(--accent)" }} />
                  <h3 id="broadcast-title">Broadcast Statewide Network Alert</h3>
                </div>
                <button
                  ref={modalCloseRef}
                  type="button"
                  className={`${styles.btn} ${styles.btnSm}`}
                  onClick={handleCloseBroadcastModal}
                  aria-label="Close broadcast modal"
                  title="Close broadcast modal (Esc)"
                >
                  <X className={styles.tabIcon} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p id="broadcast-desc" className={styles.modalIntro}>
                  Record a synthetic directive for the selected scope. No external alerts are sent.
                </p>
                {broadcastRefused && (
                  <div
                    className={`${styles.toastSuccess} ${styles.toastRefused}`}
                    role="alert"
                    aria-label="Broadcast feedback"
                  >
                    <AlertTriangle className={styles.btnIcon} aria-hidden="true" />
                    <span>{broadcastFeedback}</span>
                  </div>
                )}

                {/* Clinical Protocol & Bed Flow Template */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-broadcast-template">
                    WA Clinical Protocol &amp; Flow Template
                  </label>
                  <select
                    id="alerts-broadcast-template"
                    className={styles.formSelect}
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                  >
                    {WA_BROADCAST_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        [{tmpl.severity.toUpperCase()}] {tmpl.name}
                      </option>
                    ))}
                    <option value="custom">Custom Ad-Hoc Directive...</option>
                  </select>
                </div>

                {/* Directive Title */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-broadcast-title">
                    Directive Headline / Title
                  </label>
                  <input
                    id="alerts-broadcast-title"
                    type="text"
                    className={styles.formInput}
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Short descriptive operational title..."
                  />
                </div>

                {/* Alert Urgency Level Selector */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-broadcast-severity">
                    Alert Urgency &amp; Severity Level
                  </label>
                  <select
                    id="alerts-broadcast-severity"
                    className={styles.formSelect}
                    value={broadcastSeverity}
                    onChange={(e) => {
                      const sev = e.target.value as BroadcastSeverity;
                      setBroadcastSeverity(sev);
                    }}
                  >
                    <option value="critical">Critical Network Gridlock (Red / High-Visibility Banner)</option>
                    <option value="warning">Operational Escalation / Warning (Amber)</option>
                    <option value="advisory">Clinical &amp; Transport Advisory (Blue)</option>
                  </select>
                </div>

                {/* Clear Visual Severity Indicator */}
                <div
                  className={styles.severityCard}
                  data-severity={broadcastSeverity === "critical" ? "critical" : "operational"}
                >
                  <div className={styles.severityIcon}>
                    {broadcastSeverity === "critical" ? (
                      <AlertCircle className={styles.titleIcon} aria-hidden="true" />
                    ) : broadcastSeverity === "warning" ? (
                      <AlertTriangle className={styles.titleIcon} aria-hidden="true" />
                    ) : (
                      <Clock className={styles.titleIcon} aria-hidden="true" />
                    )}
                  </div>
                  <div className={styles.severityContent}>
                    <div className={styles.severityHead}>
                      <span
                        className={styles.badge}
                        data-tone={
                          broadcastSeverity === "critical"
                            ? "danger"
                            : broadcastSeverity === "warning"
                              ? "warn"
                              : "accent"
                        }
                      >
                        {broadcastSeverity.toUpperCase()} PRIORITY
                      </span>
                      <span className={styles.severityTitle}>
                        {broadcastSeverity === "critical"
                          ? "Statewide Gridlock Directive"
                          : broadcastSeverity === "warning"
                            ? "Operational Flow Warning"
                            : "Standard Network Advisory"}
                      </span>
                    </div>
                    <div className={styles.severityDesc}>
                      {broadcastSeverity === "critical"
                        ? "Immediate high-visibility directive banner displayed across all 23 inpatient wards and 8 ED consoles."
                        : broadcastSeverity === "warning"
                          ? "Operational escalation displayed in shift communications, bed desk consoles, and unit rosters."
                          : "Advisory notice displayed in shift communications and general role notice streams."}
                    </div>
                  </div>
                </div>

                {/* Broadcast Target Facility */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-broadcast-target">
                    Broadcast Target Scope
                  </label>
                  <select
                    id="alerts-broadcast-target"
                    className={styles.formSelect}
                    value={broadcastScope}
                    onChange={(e) => setBroadcastScope(e.target.value as BroadcastTargetScope)}
                  >
                    <option value="all">All 23 Inpatient Wards &amp; 8 ED Desks</option>
                    <option value="metro_adult">
                      Metropolitan Adult Units Only (FSH, SCGH, RPH, Bentley, Fremantle, Armadale)
                    </option>
                    <option value="ed_liaison">Emergency Department Mental Health Liaison Only</option>
                    <option value="forensic">Frankland Centre Forensic Mental Health Only</option>
                    <option value="adolescent">CAMHS Adolescent Acute Units Only (Bentley &amp; PCH)</option>
                    <option value="older_adult">Psychogeriatric &amp; Older Adult Units Only</option>
                    <option value="regional_wachs">WACHS Regional Mental Health Network</option>
                  </select>
                </div>

                {/* Directive Duration */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-broadcast-duration">
                    Directive Duration
                  </label>
                  <select
                    id="alerts-broadcast-duration"
                    className={styles.formSelect}
                    value={broadcastDurationMinutes}
                    onChange={(e) => setBroadcastDurationMinutes(Number(e.target.value))}
                  >
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                    <option value={240}>4 hours (Standard shift duration)</option>
                    <option value={480}>8 hours</option>
                    <option value={720}>12 hours</option>
                    <option value={1440}>24 hours</option>
                  </select>
                </div>

                {/* Message Body */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="alerts-broadcast-message">
                    Message Body &amp; Clinical Instructions
                  </label>
                  <textarea
                    id="alerts-broadcast-message"
                    className={styles.formTextarea}
                    placeholder="Enter urgent clinical or flow directive..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>

                {/* Explicit Confirmation Safeguard */}
                <div className={styles.safeguardCard}>
                  <div className={styles.safeguardRow}>
                    <input
                      type="checkbox"
                      id="alerts-broadcast-safeguard"
                      className={styles.safeguardCheckbox}
                      checked={broadcastConfirmed}
                      onChange={(e) => setBroadcastConfirmed(e.target.checked)}
                    />
                    <label htmlFor="alerts-broadcast-safeguard" className={styles.safeguardLabel}>
                      I confirm this directive is clinically authorised for immediate statewide network broadcast.
                    </label>
                  </div>
                  <div className={styles.safeguardNotice}>
                    Statewide broadcasts transmit immediate visual alerts to duty coordinators, bed managers, and
                    registrars across all health service regions.
                  </div>
                </div>
              </div>
              <div className={styles.modalFoot}>
                <button type="button" className={styles.btn} onClick={handleCloseBroadcastModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="ward-alerts-broadcast-confirm"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={
                    !broadcastConfirmed ||
                    !broadcastTitle.trim() ||
                    !broadcastMessage.trim() ||
                    (!!broadcastRequest && !broadcastResult)
                  }
                  onClick={handleDispatchBroadcast}
                >
                  <Radio className={styles.btnIcon} aria-hidden="true" />
                  <span>Dispatch Broadcast</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <WardPrototypeFooter testId="ward-alerts-governance" />
    </div>
  );
}
