"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  AlarmClock,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  MoreHorizontal,
  Radio,
  Users,
  X,
} from "lucide-react";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
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
import {
  Badge,
  Button,
  Card,
  CardHead,
  Checkbox,
  ChipGroup,
  Count,
  EmptyState,
  Field,
  FilterChip,
  Hero,
  HeroStat,
  HeroTrack,
  IconTile,
  Inset,
  Kbd,
  Select,
  SrOnly,
  StatusGlyph,
  TextInput,
  Textarea,
  buttonClass,
  durMinutes,
  type WfTone,
} from "@/components/wf";

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
      <h3 className={styles.conditionTitle}>
        <Check size={14} aria-hidden="true" className={styles.watchMark} />
        {title}
      </h3>
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

/** Severity as a glyph tone. Red only for what needs action now; routine rows stay neutral. */
function severityGlyph(item: InboxItem): WfTone {
  const tone = getAlertSeverity(item).tone;
  return tone === "danger" ? "danger" : tone === "warn" ? "warning" : "neutral";
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
  prominent = false,
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
  /** The "Needs you" layout: a fuller card with the primary action and inline acknowledge and snooze. */
  prominent?: boolean;
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
        <EmptyState icon={CheckCircle2} title={empty} />
        {isFiltered && onResetFilters && (
          <Button size="sm" variant="ghost" className={styles.btnSm} onClick={onResetFilters}>
            Clear active filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <ul className={prominent ? styles.cardRows : styles.rows}>
      {items.map((item) => {
        const isAcknowledged = Array.isArray(acknowledgements[item.id])
          ? (acknowledgements[item.id] as unknown[]).length > 0
          : Boolean(acknowledgements[item.id]);
        const categoryBadge = getCategoryBadge(item);
        const overdueText = extractOverdue(item.detail);
        const movement = movements?.find((m) => m.id === item.movementId);
        const patientInfo = resolveAlertPatient(movement, item.movementId, patients, referrals, movements, state.units);

        const actionVerb =
          categoryBadge.label === "Form Due Time Passed"

            ? "Re-authorise"
            : categoryBadge.label === "Multiple Declines"
              ? "Intervene"
              : categoryBadge.label === "Reservation Window"
                ? "Extend hold"
                : categoryBadge.label === "Transport Leg"
                  ? "Review leg"
                  : "Action";

        const menu = (
          <div className={styles.quickActionDropdownWrap}>
            <Button
              iconOnly
              icon={prominent ? MoreHorizontal : ChevronDown}
              size="sm"
              variant={prominent ? "sec" : "ghost"}
              className={styles.btnSm}
              aria-label={`More actions for ${item.title} · ${patientInfo.displayName}`}
              title={`More actions for ${patientInfo.displayName}`}
              aria-haspopup="menu"
              aria-expanded={openQuickMenuId === item.id}
              onClick={(e) => {
                e.stopPropagation();
                quickMenuTriggerRef.current = e.currentTarget;
                setOpenQuickMenuId((prev) => (prev === item.id ? null : item.id));
              }}
            />
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
                  <Clock size={14} aria-hidden="true" />
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
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>Escalate to consultant on call</span>
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
                  <Check size={14} aria-hidden="true" />
                  <span>Acknowledge and monitor</span>
                </button>
              </div>
            )}
          </div>
        );

        const primary = (
          <Button
            size="sm"
            variant={prominent ? "pri" : "sec"}
            className={styles.btn}
            aria-label={`${actionVerb} for ${patientInfo.displayName}`}
            title={`${actionVerb}: ${item.title}`}
            data-testid="ward-alerts-action-btn"
            onClick={(e) => onAction?.(item, e.currentTarget)}
          >
            {actionVerb}
          </Button>
        );

        const secondaryLink =
          categoryBadge.label === "Form Due Time Passed" ? (
            <Link className={buttonClass({ size: "sm", className: styles.btn })} href="/mockups/ward-flow/legal-forms">
              View order
            </Link>
          ) : categoryBadge.label === "Multiple Declines" ? (
            <Link
              className={buttonClass({ size: "sm", className: styles.btn })}
              href={
                patientInfo.routeTarget
                  ? `/mockups/ward-flow/people/${encodeURIComponent(patientInfo.routeTarget)}`
                  : "/mockups/ward-flow"
              }
            >
              Trajectory
            </Link>
          ) : null;

        const who = (
          <span className={styles.alertMetaText}>
            <strong className={styles.patientName}>{patientInfo.displayName}</strong>
            <span aria-hidden="true"> · </span>
            <strong className={styles.mono}>{patientInfo.umrn}</strong>
            <span aria-hidden="true"> · </span>
            <span className={styles.locationTag}>{patientInfo.location}</span>
          </span>
        );

        const timing = overdueText ? (
          <span className={styles.overdueText}>{overdueText}</span>
        ) : (
          <span className={styles.alertTiming}>{alertDetail(item)}</span>
        );

        if (prominent) {
          return (
            <li key={item.id} className={styles.alertCard} data-tone={item.tone} data-movement-id={item.movementId}>
              <div className={styles.cardTop}>
                <StatusGlyph tone={severityGlyph(item)} />
                <div className={styles.alertContent}>
                  <span className={styles.alertTitleText}>{item.title}</span>
                  {who}
                  <span className={styles.ownerLine}>
                    {timing}
                    <span aria-hidden="true"> · </span>
                    <span>Owner {item.owner.toLowerCase()}</span>
                  </span>
                </div>
                {isAcknowledged ? (
                  <Badge tone="success" size="sm">
                    Acknowledged
                  </Badge>
                ) : null}
              </div>
              <div className={styles.alertActions}>
                {primary}
                {secondaryLink}
                {menu}
                <span className={styles.actionGap} />
                {!isAcknowledged ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={styles.btn}
                    onClick={() => onQuickAction?.(item, "acknowledge", patientInfo.displayName)}
                  >
                    Acknowledge
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={AlarmClock}
                  className={styles.btn}
                  onClick={() => onQuickAction?.(item, "snooze", patientInfo.displayName)}
                >
                  Snooze 30m
                </Button>
              </div>
            </li>
          );
        }

        return (
          <li key={item.id} className={styles.alertRow} data-tone={item.tone} data-movement-id={item.movementId}>
            <StatusGlyph tone={severityGlyph(item)} />
            <div className={styles.alertContent}>
              <span className={styles.alertHead}>
                <span className={styles.alertTitleText}>{item.title}</span>
                {timing}
                {isAcknowledged ? (
                  <Badge tone="success" size="sm">
                    Acknowledged
                  </Badge>
                ) : null}
              </span>
              {who}
            </div>
            <span className={styles.ownerCell}>{item.owner}</span>
            <div className={styles.rowActions}>
              {primary}
              {secondaryLink}
              {menu}
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
  const [broadcastTitle, setBroadcastTitle] = useState(defaultTmpl?.title ?? "Demo: HDU full — check discharges");
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

  const resetFilters = () => {
    setTierFilter("all");
    setRoleFilter("all");
  };
  const isFiltered = tierFilter !== "all" || roleFilter !== "all";
  const shownCount = filteredNeedsYou.length + filteredOtherRoles.length;
  const tierItems = [
    {
      id: "all" as const,
      label: (
        <>
          <span>All alerts</span>
          <SrOnly>, all active tiers</SrOnly>
        </>
      ),
      count: totalActive,
    },
    {
      id: "emergency" as const,
      label: (
        <>
          <span>Clinical risk</span>
          <SrOnly>, Tier 1: Clinical Emergency / High Risk</SrOnly>
        </>
      ),
      count: tier1Count,
    },
    {
      id: "capacity" as const,
      label: (
        <>
          <span>Capacity and delay</span>
          <SrOnly>, Tier 2: Capacity Pressure / Delay</SrOnly>
        </>
      ),
      count: tier2Count,
    },
    {
      id: "admin" as const,
      label: (
        <>
          <span>Admin and transfer</span>
          <SrOnly>, Tier 3: Administrative &amp; Transfer</SrOnly>
        </>
      ),
      count: tier3Count,
    },
  ];
  const roleChips = [
    { id: "all", label: "All roles", count: totalActive },
    { id: "coordinator", label: "Coordinator", count: coordinatorCount },
    { id: "registrar", label: "Duty registrar", count: registrarCount },
    { id: "bed_manager", label: "Bed manager", count: bedManagerCount },
    { id: "num", label: "NUM", count: numCount },
  ];
  const conditionTiles: {
    id: string;
    label: string;
    value: number;
    tone: WfTone;
    sub: string;
  }[] = [
    {
      id: "kpi-legal-expiries",
      label: "Form expiries passed",
      value: legal.length,
      tone: legal.length > 0 ? "danger" : "success",
      sub:
        legal.length > 0
          ? "Form past expiry, action required"
          : `0 of ${withDeadline.length} with a written deadline passed`,
    },
    {
      id: "kpi-gridlock",
      label: "Placement gridlock",
      value: declined.length,
      tone: declined.length > 0 ? "danger" : "success",
      sub:
        declined.length > 0
          ? "Every destination asked declined"
          : `0 of ${declineCandidates} declined by every ward asked`,
    },
    {
      id: "kpi-ed-wait",
      label: "Prolonged ED wait",
      value: prolongedEdCount,
      tone: prolongedEdCount > 0 ? "warning" : "success",
      sub: "A day or more in ED",
    },
    {
      id: "kpi-active-monitored",
      label: "Active monitored",
      value: totalActive,
      tone: "neutral",
      sub: "Current inbox alerts",
    },
  ];
  const directiveTone: WfTone =
    activeBroadcast?.severity === "critical" ? "danger" : activeBroadcast?.severity === "warning" ? "warning" : "info";
  const severityLabel = (severity: BroadcastSeverity) =>
    severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "Advisory";

  return (
    <div className={styles.screen} data-testid="ward-alerts-page" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Alerts"
          title={
            needsYouCount === 0
              ? "No alert needs you"
              : needsYouCount === 1
                ? "1 alert needs you"
                : `${needsYouCount} alerts need you`
          }
          stats={
            <div className={styles.heroStats} role="group" aria-label="Alert summary">
              <HeroStat value={needsYouCount} label="Needs you" tone={needsYouCount > 0 ? "danger" : undefined} />
              <HeroStat value={otherRolesCount} label="Other roles" />
              <HeroStat value={7} label="Conditions checked" />
              <HeroStat value={activeBroadcast ? 1 : 0} label="Directive live" />
            </div>
          }
          bar={
            <HeroTrack
              label="Escalation tiers"
              items={tierItems}
              value={tierFilter}
              onChange={(next) => setTierFilter(next)}
            />
          }
          barAside={
            <Button
              ref={broadcastTriggerRef}
              variant="light"
              size="sm"
              icon={Radio}
              onClick={(e) => {
                broadcastTriggerRef.current = e.currentTarget;
                setBroadcastRequest(null);
                setBroadcastSuccessNotice(null);
                setBroadcastConfirmed(false);
                setBroadcastModalOpen(true);
              }}
            >
              Broadcast alert
            </Button>
          }
        />

        {/* Broadcast feedback */}
        {broadcastFeedback && (!broadcastRefused || !isBroadcastModalOpen) && (
          <div
            className={styles.feedbackLine}
            role={broadcastRefused ? "alert" : "status"}
            aria-label="Broadcast feedback"
          >
            <StatusGlyph tone={broadcastRefused ? "danger" : "success"} />
            <span className={styles.feedbackText}>{broadcastFeedback}</span>
            <Button
              iconOnly
              icon={X}
              size="sm"
              variant="ghost"
              className={styles.btnSm}
              onClick={() => {
                if (broadcastAccepted) setBroadcastModalOpen(false);
                setBroadcastRequest(null);
                setBroadcastSuccessNotice(null);
              }}
              aria-label="Dismiss notice"
            />
          </div>
        )}

        {/* Active statewide directive */}
        {activeBroadcast && (
          <Card
            as="div"
            className={styles.directiveRow}
            data-severity={activeBroadcast.severity}
            aria-live="assertive"
            aria-atomic="true"
            aria-label="Active Statewide Directive"
          >
            {/* The acknowledged-units count below is announced; this sentence travels with it
                (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
            <span className="sr-only">These counts are invented figures.</span>
            <IconTile icon={Radio} />
            <div className={styles.directiveText}>
              <span className={styles.directiveLine}>
                <strong className={styles.directiveTitle}>{activeBroadcast.title}</strong>
                <span className={styles.quiet}>{activeBroadcast.targetScopeLabel}</span>
              </span>
              <span className={styles.directiveMeta}>
                {activeBroadcast.message}
                <span aria-hidden="true"> · </span>
                Issued {formatInstantWithDay(activeBroadcast.dispatchedAt, now)} by {activeBroadcast.dispatchedByName}
                <span aria-hidden="true"> · </span>
                <span>
                  {activeBroadcast.acknowledgedUnits.length} of {units.length} units acknowledged
                </span>
              </span>
            </div>
            <Badge tone={directiveTone}>{severityLabel(activeBroadcast.severity)} directive</Badge>
            <span className={styles.timeChip}>
              <b>{durMinutes(Math.max(0, now - activeBroadcast.dispatchedAt))}</b> ago
            </span>
            <span className={styles.timeChip}>
              {activeBroadcast.expiresAt > now ? (
                <>
                  <b>{durMinutes(activeBroadcast.expiresAt - now)}</b> left
                </>
              ) : (
                formatTimeRemaining(activeBroadcast.expiresAt, now)
              )}
            </span>
            <Button
              size="sm"
              className={styles.btn}
              aria-label="Stand down this alert"
              onClick={() => handleStandDown(activeBroadcast.id)}
            >
              Stand down
            </Button>
          </Card>
        )}

        {/* Conditions watched */}
        <Card aria-labelledby="alerts-conditions-title" data-testid="ward-alerts-hud-island">
          <CardHead
            id="alerts-conditions-title"
            icon={Activity}
            title="Conditions watched"
            aside={<span className={styles.quiet}>Checked at {formatInstantWithDay(now, now)}</span>}
          />
          <div className={styles.tileGrid}>
            {conditionTiles.map((tile) => (
              <div key={tile.id} className={styles.tile} data-kpi={tile.id}>
                <span className={styles.tileHead}>
                  <span className={styles.tileLabel}>{tile.label}</span>
                  <StatusGlyph tone={tile.tone} size={9} />
                </span>
                <span className={styles.tileValue}>{tile.value}</span>
                <span className={styles.tileSub}>{tile.sub}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Addressed-to filter */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel} id="alerts-role-label">
              Addressed to
            </span>
            <ChipGroup label="Filter by addressed role" className={styles.chipRow}>
              {roleChips.map((chip) => (
                <FilterChip
                  key={chip.id}
                  className={styles.filterBtn}
                  pressed={roleFilter === chip.id}
                  onPressedChange={() => setRoleFilter(chip.id)}
                  count={chip.count}
                >
                  {chip.label}
                </FilterChip>
              ))}
            </ChipGroup>
          </div>
          <div className={styles.filterSummary}>
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {shownCount} of {totalActive}
              <span className="sr-only"> alerts from synthetic records</span>
            </span>
            {isFiltered && (
              <Button size="sm" variant="ghost" className={styles.btnSm} onClick={resetFilters}>
                Reset filters
              </Button>
            )}
          </div>
        </div>

        {/* Alert groups */}
        <div className={styles.panelGrid} id="alerts-results">
          <div className={styles.priorityColumn}>
            <Card aria-labelledby="alerts-needs-you-title">
              <CardHead
                id="alerts-needs-you-title"
                icon={Bell}
                title="Needs you"
                meta={<Count n={filteredNeedsYou.length} />}
                aside={<span className={styles.quiet}>{filteredNeedsYou.length} to act on</span>}
              />
              <div className={styles.panelBody} role="region" aria-label="Needs you alerts" tabIndex={0}>
                <AlertRows
                  prominent
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
                  isFiltered={isFiltered}
                  onResetFilters={resetFilters}
                />
              </div>
            </Card>

            {/* Operational notices */}
            <Card as="section" aria-label="Operational Notices and Shift Communication Feed">
              <CardHead icon={FileText} title="Role notices" meta={<Count n={feedNotices.length} />} />
              {feedNotices.length === 0 ? (
                <div className={styles.feedEmpty}>
                  <span className={styles.emptyMark} aria-hidden="true">
                    <CheckCircle2 size={16} aria-hidden="true" />
                  </span>
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
                        <StatusGlyph tone={isRead ? "neutral" : "info"} size={9} />
                        <div className={styles.feedContent}>
                          <span className={styles.feedTitle}>{notice.sentence}</span>
                          <span className={styles.feedMeta}>
                            To {WARD_FLOW_ROLE_LABELS[notice.to.role]} · raised{" "}
                            {formatInstantWithDay(notice.raisedAt, now)}
                          </span>
                        </div>
                        <span className={styles.feedState}>{isRead ? "Read" : "Unread"}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card as="div" className={styles.scopeCard}>
              <details className={`${styles.contextDetails} source-print`}>
                <summary className={styles.scopeSummary}>
                  <IconTile icon={Eye} />
                  <span className={styles.scopeTitle}>Monitoring scope</span>
                  <Count n={7} />
                  <span className={styles.scopeMeta}>7 watched, 1 not</span>
                  <ChevronDown className={styles.disclosureChevron} aria-hidden="true" size={16} />
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
                    <h3 className={styles.conditionTitle}>
                      <Check size={14} aria-hidden="true" className={styles.watchMark} />
                      Referral awaiting triage
                    </h3>
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
                    <h3 className={styles.conditionTitle}>
                      <Check size={14} aria-hidden="true" className={styles.watchMark} />
                      Override recorded
                    </h3>
                    <p className={styles.watches}>
                      Watches referrals made by override. {overrides.length === 0 ? "None has been recorded." : null}
                    </p>
                    <p className={styles.gap}>
                      <strong>This screen cannot identify a prior gate verdict.</strong> The record keeps who, when,
                      which fixed reason and which wards; it does not retain a prior gate verdict.
                    </p>
                  </section>
                  <section className={styles.conditionWide} aria-label="What this screen does not watch">
                    <h3 className={styles.conditionTitle}>
                      <X size={14} aria-hidden="true" className={styles.watchMark} />
                      What this screen does not watch
                    </h3>
                    <p className={styles.gap}>
                      <strong>Handover sheets.</strong> The design for this screen carries a &ldquo;handover sheet
                      due&rdquo; alert. Nothing in this system records when a shift hands over, so there is no deadline
                      to measure and this screen cannot tell you whether one is due. It is listed here rather than left
                      out, because a screen that silently drops a condition reads as though it checked it.
                    </p>
                  </section>
                </div>
              </details>
            </Card>
          </div>

          <Card aria-labelledby="alerts-other-roles-title" className={styles.otherCard}>
            <CardHead
              id="alerts-other-roles-title"
              icon={Users}
              title="For other roles"
              meta={<Count n={filteredOtherRoles.length} />}
              aside={<span className={styles.quiet}>{filteredOtherRoles.length} elsewhere</span>}
            />
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
                isFiltered={isFiltered}
                onResetFilters={resetFilters}
              />
            </div>
          </Card>
        </div>

        {/* Alert inspector sheet */}
        {selectedAlert && (
          <div className={styles.inspectorOverlay} role="presentation" onClick={handleCloseDrawer}>
            <aside
              ref={drawerRef}
              className={styles.inspectorDrawer}
              role="dialog"
              aria-modal="true"
              aria-labelledby="action-modal-title"
              aria-describedby="action-modal-desc"
              tabIndex={-1}
              onKeyDown={handleDrawerKeyDown}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHead}>
                <IconTile icon={Bell} />
                <div className={styles.drawerHeadTitles}>
                  <h2 id="action-modal-title" className={styles.drawerTitle}>
                    Alert Escalation &amp; Triage
                  </h2>
                  <p id="action-modal-desc" className={styles.drawerSubtitle}>
                    {selectedAlert.title}
                  </p>
                </div>
                <Kbd>esc</Kbd>
                <Button
                  ref={drawerCloseRef}
                  iconOnly
                  icon={X}
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDrawer}
                  aria-label="Close drawer"
                  title="Close drawer (Esc)"
                />
              </div>

              <div className={styles.drawerBody}>
                <div className={styles.drawerSection}>
                  <Badge
                    tone={
                      selectedSeverity.tone === "danger"
                        ? "danger"
                        : selectedSeverity.tone === "warn"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {selectedSeverity.label}
                  </Badge>
                  <div className={styles.drawerPatient}>{selectedPatientName}</div>
                  <div className={styles.quiet}>{alertDetail(selectedAlert)}</div>
                </div>

                <div className={styles.drawerSection}>
                  <h3 className={styles.drawerSectionTitle}>Case Parameters &amp; Tracking</h3>
                  <Inset>
                    <dl className={styles.drawerGrid}>
                      <div>
                        <dt>Origin ED or setting</dt>
                        <dd>{selectedMovement?.originEdId ?? "Emergency Dept"}</dd>
                      </div>
                      <div>
                        <dt>Assigned role</dt>
                        <dd>{selectedAlert.owner}</dd>
                      </div>
                      <div>
                        <dt>Legal status</dt>
                        <dd>{selectedMovement?.legalStatus ?? "Voluntary"}</dd>
                      </div>
                      <div>
                        <dt>Declines logged</dt>
                        <dd>{selectedMovement ? `${selectedMovement.declines.length} units` : "0 units"}</dd>
                      </div>
                      <div>
                        <dt>Board time</dt>
                        <dd>{formatInstantWithDay(now, now)}</dd>
                      </div>
                      <div>
                        <dt>Escalation</dt>
                        <dd>{selectedMovement?.escalation ? "Tier 2 escalated" : "Tier 1 standard"}</dd>
                      </div>
                    </dl>
                  </Inset>
                </div>

                <div className={styles.ackBox}>
                  <span className={styles.ackText}>
                    <StatusGlyph tone={isSelectedAcknowledged ? "success" : "warning"} />
                    {isSelectedAcknowledged ? "Acknowledged by Duty Coordinator" : "Pending coordinator triage"}
                  </span>
                  {!isSelectedAcknowledged ? (
                    <Button size="sm" className={styles.btn} onClick={handleAcknowledge}>
                      Acknowledge Alert
                    </Button>
                  ) : null}
                </div>

                <Field label="Action taken" id="alerts-action-intervention">
                  <Select defaultValue="escalate">
                    <option value="escalate">Escalate to executive director on call (tier 3)</option>
                    <option value="reauthorise">Extend recorded form</option>
                    <option value="override">Declare catchment override for placement</option>
                    <option value="extend_hold">Extend bed hold (30 minute grace window)</option>
                    <option value="dispatch_transport">Dispatch urgent secure transport</option>
                    <option value="acknowledge">Acknowledge and retain on active watch</option>
                  </Select>
                </Field>

                <Field label="Sign-off note" id="alerts-action-note">
                  <Textarea
                    rows={3}
                    placeholder="Record the action taken and who was contacted."
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </Field>
              </div>

              <div className={styles.drawerFoot}>
                {/* D4: Unconnected action confirmation */}
                <span id="ward-alerts-action-confirm-note" className={styles.confirmNote}>
                  Not wired in this prototype.
                </span>
                <Button className={styles.btn} onClick={handleCloseDrawer}>
                  Cancel
                </Button>
                <Button
                  variant="pri"
                  className={styles.btn}
                  data-testid="ward-alerts-action-confirm"
                  aria-disabled="true"
                  aria-describedby="ward-alerts-action-confirm-note"
                  title="Not wired in this prototype."
                  onClick={ignoreUnavailableActivation}
                >
                  Record intervention
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* Broadcast composer sheet */}
        {isBroadcastModalOpen && (
          <div
            ref={modalRef}
            className={styles.modalOverlay}
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
            <div className={styles.composer} onClick={(e) => e.stopPropagation()}>
              <div className={styles.drawerHead}>
                <IconTile icon={Radio} />
                <div className={styles.drawerHeadTitles}>
                  <h2 id="broadcast-title" className={styles.drawerTitle}>
                    Broadcast network alert
                  </h2>
                  <p id="broadcast-desc" className={styles.drawerSubtitle}>
                    Records a synthetic directive for the chosen scope. No external alert is sent.
                  </p>
                </div>
                <Kbd>esc</Kbd>
                <Button
                  ref={modalCloseRef}
                  iconOnly
                  icon={X}
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseBroadcastModal}
                  aria-label="Close broadcast modal"
                  title="Close broadcast modal (Esc)"
                />
              </div>
              <div className={styles.composerBody}>
                {broadcastRefused && (
                  <div className={styles.feedbackLine} role="alert" aria-label="Broadcast feedback">
                    <StatusGlyph tone="danger" />
                    <span className={styles.feedbackText}>{broadcastFeedback}</span>
                  </div>
                )}

                <Field label="Start from" id="alerts-broadcast-template">
                  <Select value={selectedTemplateId} onChange={(e) => handleSelectTemplate(e.target.value)}>
                    {WA_BROADCAST_TEMPLATES.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                      </option>
                    ))}
                    <option value="custom">Custom directive</option>
                  </Select>
                </Field>

                <div className={styles.composerPair}>
                  <Field label="Severity" id="alerts-broadcast-severity">
                    <Select
                      value={broadcastSeverity}
                      onChange={(e) => setBroadcastSeverity(e.target.value as BroadcastSeverity)}
                    >
                      <option value="advisory">Advisory</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Gridlock</option>
                    </Select>
                  </Field>
                  <Field label="Expires" id="alerts-broadcast-duration">
                    <Select
                      value={broadcastDurationMinutes}
                      onChange={(e) => setBroadcastDurationMinutes(Number(e.target.value))}
                    >
                      <option value={60}>1h</option>
                      <option value={120}>2h</option>
                      <option value={240}>4h</option>
                      <option value={480}>8h</option>
                      <option value={720}>12h</option>
                      <option value={1440}>24h</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Target scope" id="alerts-broadcast-target">
                  <Select
                    value={broadcastScope}
                    onChange={(e) => setBroadcastScope(e.target.value as BroadcastTargetScope)}
                  >
                    <option value="all">All 23 inpatient wards and 8 ED desks</option>
                    <option value="metro_adult">Metropolitan adult units</option>
                    <option value="ed_liaison">ED mental health liaison desks</option>
                    <option value="forensic">Frankland Centre forensic</option>
                    <option value="adolescent">CAMHS adolescent acute units</option>
                    <option value="older_adult">Older adult units</option>
                    <option value="regional_wachs">WACHS regional network</option>
                  </Select>
                </Field>

                <Field label="Title" id="alerts-broadcast-title">
                  <TextInput
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Short operational title"
                  />
                </Field>

                <Field label="Directive" id="alerts-broadcast-message">
                  <Textarea
                    rows={3}
                    maxLength={280}
                    placeholder="Enter the flow directive"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    data-gramm="false"
                    data-enable-grammarly="false"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </Field>

                <div className={styles.previewBlock}>
                  <span className={styles.drawerSectionTitle}>Preview on every desk</span>
                  <div className={styles.previewCard}>
                    <StatusGlyph
                      tone={
                        broadcastSeverity === "critical"
                          ? "danger"
                          : broadcastSeverity === "warning"
                            ? "warning"
                            : "info"
                      }
                    />
                    <div className={styles.directiveText}>
                      <strong className={styles.directiveTitle}>{broadcastTitle.trim() || "Untitled directive"}</strong>
                      <span className={styles.quiet}>
                        {severityLabel(broadcastSeverity)} · expires in {durMinutes(broadcastDurationMinutes)}
                      </span>
                    </div>
                  </div>
                </div>

                <Checkbox
                  id="alerts-broadcast-safeguard"
                  checked={broadcastConfirmed}
                  onChange={(e) => setBroadcastConfirmed(e.target.checked)}
                  label="I confirm this directive is clinically authorised for immediate statewide network broadcast."
                />
              </div>
              <div className={styles.drawerFoot}>
                <span className={styles.confirmNote}>Dispatched by the state bed desk coordinator</span>
                <Button className={styles.btn} onClick={handleCloseBroadcastModal}>
                  Cancel
                </Button>
                <Button
                  variant="pri"
                  icon={Radio}
                  className={styles.btn}
                  data-testid="ward-alerts-broadcast-confirm"
                  disabled={
                    !broadcastConfirmed ||
                    !broadcastTitle.trim() ||
                    !broadcastMessage.trim() ||
                    (!!broadcastRequest && !broadcastResult)
                  }
                  onClick={handleDispatchBroadcast}
                >
                  Dispatch
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
      <WardPrototypeFooter testId="ward-alerts-governance" />
    </div>
  );
}
