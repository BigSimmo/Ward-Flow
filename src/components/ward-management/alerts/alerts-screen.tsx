"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import {
  AlarmClock,
  Bell,
  BellRing,
  ChevronRight,
  Clock,
  Columns3,
  Copy,
  List,
  Pause,
  Play,
  Radio,
  Activity,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  activeSnooze,
  currentInboxOwner,
  isSnoozeReason,
  partitionSnoozed,
  snoozeAllowed,
  snoozeReasonLabel,
} from "@/components/ward-management/ward-inbox-snooze";
import { inboxItemIsActNow } from "@/components/ward-management/ward-flow-reducer";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { ESCALATION_CONTACTS, type ReleasePullReason } from "@/components/ward-management/ward-change-reasons";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import {
  enableActNowNotifications,
  setActNowNotificationPreference,
  useActNowNotificationPreference,
} from "@/components/ward-management/shell/ward-act-now-notifications";
import {
  WA_BROADCAST_TEMPLATES,
  getActiveBroadcastAlert,
  type BroadcastSeverity,
  type BroadcastTargetScope,
  type BroadcastCategory,
  broadcastKind,
  type BroadcastKind,
} from "./ward-broadcast-model";
import { useDeskInScope } from "@/components/ward-management/shell/ward-access";
import { broadcastScopeCount, directiveAcknowledgements, isAlertLive, replyBoard } from "./global-alert-view";
import { PullNowCard, ReplyBoardList } from "./global-alert-panels";

import {
  broadcastDraftBaseline,
  isBroadcastDraftDirty,
  parseBroadcastDraft,
  serialiseBroadcastDraft,
  type BroadcastDraft,
} from "./broadcast-draft";
import {
  ALERT_KIND_LABELS,
  alertActionFor,
  alertGroupOf,
  alertKindOf,
  byOldest,
  escalationAppliesTo,
  effectiveOwner,
  isQueueItem,
  minutesText,
  admissionIdOfInboxId,
  movementIdOfInboxId,
  bookingOfInboxId,
  raisedAt,
  resolveAlertSubject,
  type AlertKind,
} from "./alerts-model";
import {
  AlertCard,
  AlertPhoneRow,
  AlertRow,
  GroupHead,
  ownerShort,
  type QueueEntry,
  type QueueHandlers,
} from "./alerts-queue";
import { AlertDetail, type AlertDetailHandlers } from "./alert-detail";
import { TimeRing, TodayChart } from "./alerts-visuals";

import styles from "./alerts.module.css";
import {
  Badge,
  Button,
  Count,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  Field,
  FilterChip,
  Hero,
  HeroStat,
  IconTile,
  PhoneHero,
  PhoneSheet,
  PillTabs,
  Kbd,
  LiveChip,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  TabPanel,
  Tabs,
  useIsPhone,
  TextInput,
  Textarea,
  type WfTone,
  useIsTabletPortrait,
  useModalFocus,
} from "@/components/wf";

/**
 * **THE ALERTS SCREEN — what is addressed to a role right now, across every movement and referral.**
 *
 * Command queue (Josh, 9 Oct 2026, round 2 option A): one queue arranged by urgency, lanes or
 * owner, the selected alert beside it with a picture of its recorded times, a Today chart and the
 * broadcast desk in a tab. Filters highlight, they never hide.
 *
 * It never says "nothing is wrong", and that is the whole design. Ward Lead ruling, 2026-09-12:
 * an empty alerts screen saying "all clear" is a clinical claim about the entire service, made by
 * a screen that checked a handful of named conditions against one fixture. The hero's Checking
 * line names every condition it looked at, with its count, whether it is zero or not, and names
 * the one it cannot check.
 */

export { extractOverdue } from "./alerts-model";

const COORDINATOR = WARD_FLOW_ROLE_LABELS.coordinator;

type AlertsTab = "now" | "broadcast" | "notices" | "history";
type ArrangeBy = "urgency" | "lanes" | "owner";
type HeroPill = "act" | "wait" | "mine";

type HistoryEntry = { id: string; at: Instant; tone: WfTone; title: string; sub: string; by: string; action: boolean };

/** A request this screen sent, read back from the event log so a refused act never says it happened. */
type ActionRequest = { type: string; logSequence: number; ok: string; refused: string };

export function AlertsScreen() {
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  return <AlertsWorkspace key={worldGeneration} />;
}

function AlertsWorkspace() {
  usePrintableDisclosures();

  const state = useWardFlowSelect(
    "movements",
    "units",
    "referrals",
    "patients",
    "dispatch",
    "inboxAcknowledgements",
    "inboxOwnership",
    "inboxSnoozes",
    "configuration",
    "broadcastAlerts",
    "notices",
    "plannedAdmissions",
    "admissions",
    "supportNotifications",
    "leaveBeds",
    "eventLog",
  );
  const {
    movements,
    units,
    referrals,
    patients,
    dispatch,
    inboxAcknowledgements,
    inboxOwnership,
    inboxSnoozes,
    configuration,
    broadcastAlerts,
    notices,
  } = state;
  // Events carry the engine clock; what the page shows follows the Live chip, which can pause.
  const clockNow = useWardFlowClock();
  const raise = useWardRaise("coordinator");
  const live = usePageLive();
  const now = live.now;
  // Top 25 item 12: name a stuck handover once the transport booked target has passed.
  const stuckHandoverOn = useWardFeatureFlag("top25-stuck-handover");
  // Phone layout: the selected alert opens in a sheet instead of the side panel.
  const isPhone = useIsPhone();
  // Tablet portrait (v10): the queue takes the width and an alert opens as a slide-over.
  const isTabletPortrait = useIsTabletPortrait();
  const slideOver = isPhone || isTabletPortrait;
  const openMovements = useMemo(() => movements.filter(isOpen), [movements]);
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const plannedAdmissions = state.plannedAdmissions;
  // Every computed row this screen covers, then the snoozed ones set aside: they leave the active
  // list and come back by themselves when their return time passes (stream A, 9 Oct 2026).
  // L1 (site review, 12 Oct 2026): the one task list the header's Tasks badge reads (`taskItems`),
  // so "Now" and the badge agree; the arrival and discharge notification rows are no longer dropped.
  const admissions = state.admissions;
  const supportNotifications = state.supportNotifications;
  const leaveBeds = state.leaveBeds;
  const allInbox = useMemo(
    () =>
      taskItems(
        {
          movements,
          units,
          configuration,
          inboxSnoozes,
          admissions,
          patients,
          referrals,
          supportNotifications,
          plannedAdmissions,
          leaveBeds,
          stuckHandoverMinutes: stuckHandoverOn ? configuration.transportBookedTargetMinutes : undefined,
        },
        now,
      ).filter(isQueueItem),
    [
      movements,
      units,
      configuration,
      inboxSnoozes,
      admissions,
      patients,
      referrals,
      supportNotifications,
      plannedAdmissions,
      leaveBeds,
      stuckHandoverOn,
      now,
    ],
  );
  const { active: inbox, snoozed: snoozedInbox } = useMemo(
    () => partitionSnoozed(allInbox, inboxSnoozes, now),
    [allInbox, inboxSnoozes, now],
  );
  const feedNotices = useMemo(() => [...notices].sort((a, b) => b.raisedAt - a.raisedAt), [notices]);

  const [tab, setTab] = useState<AlertsTab>("now");
  const [arrangeBy, setArrangeBy] = useState<ArrangeBy>("urgency");
  const [pill, setPill] = useState<HeroPill | null>(null);
  const [ownerHighlight, setOwnerHighlight] = useState<string | null>(null);
  const [watchHighlight, setWatchHighlight] = useState<AlertKind | null>(null);
  const [chosenId, setChosenId] = useState<string | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [phoneChecks, setPhoneChecks] = useState(false);
  const [phoneToday, setPhoneToday] = useState(false);
  // A request to focus the release reason once the panel or sheet has drawn it.
  const [releaseRequest, setReleaseRequest] = useState(0);
  const releasePending = useRef(false);
  const releaseRef = useRef<HTMLSelectElement | null>(null);
  const [notifyOn] = useActNowNotificationPreference();

  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastConfirmed, setBroadcastConfirmed] = useState(false);

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
  const [broadcastType, setBroadcastType] = useState<BroadcastKind>(defaultTmpl?.kind ?? "directive");
  const [broadcastSuccessNotice, setBroadcastSuccessNotice] = useState<string | null>(null);
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [broadcastRequest, setBroadcastRequest] = useState<{
    type: "DISPATCH_BROADCAST_ALERT" | "STAND_DOWN_BROADCAST_ALERT";
    logSequence: number;
    title: string;
    scope: BroadcastTargetScope;
    scopeLabel: string;
  } | null>(null);
  const broadcastResult = broadcastRequest
    ? state.eventLog?.find(
        (entry) => entry.sequence > broadcastRequest.logSequence && entry.type === broadcastRequest.type,
      )
    : undefined;
  const broadcastAccepted = broadcastResult?.accepted === true;
  const broadcastRefused = broadcastResult?.accepted === false;
  const isBroadcastModalOpen =
    broadcastModalOpen && !(broadcastAccepted && broadcastRequest?.type === "DISPATCH_BROADCAST_ALERT");
  const actionResult = actionRequest
    ? state.eventLog?.find((entry) => entry.sequence > actionRequest.logSequence && entry.type === actionRequest.type)
    : undefined;

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
      kind: broadcastType === "bed_call" ? "bed_call" : "directive",
    }),
    [
      selectedTemplateId,
      broadcastTitle,
      broadcastMessage,
      broadcastSeverity,
      broadcastCategory,
      broadcastScope,
      broadcastDurationMinutes,
      broadcastType,
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
    setBroadcastType(draft.kind ?? broadcastDraftBaseline(draft.templateId).kind ?? "directive");
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
            ? `Broadcast Directive "${broadcastRequest.title}" shown in this prototype only; no external notifications are sent. Target: ${broadcastRequest.scopeLabel}.`
            : `Broadcast Directive "${broadcastRequest.title}" shown in this prototype for ${broadcastRequest.scopeLabel} only; no external notifications are sent.`
      : actionRequest && actionResult
        ? actionResult.accepted
          ? actionRequest.ok
          : actionRequest.refused
        : broadcastSuccessNotice;
  const feedbackRefused =
    broadcastRefused || (actionResult !== undefined && !actionResult.accepted && !broadcastRequest);

  const activeBroadcast = getActiveBroadcastAlert(broadcastAlerts ?? [], now);
  const deskInScope = useDeskInScope();
  // Ops-11: acknowledgements count against the wards the directive's target covers, as the banner does.
  // A bed call is answered by the wards it asked, never ED desks, so it counts replies as the banner does.
  const broadcastBoard =
    activeBroadcast && broadcastKind(activeBroadcast) !== "directive" ? replyBoard(activeBroadcast, units) : undefined;
  const allAcks = !activeBroadcast
    ? undefined
    : broadcastBoard
      ? { acknowledged: broadcastBoard.answered, of: broadcastBoard.rows.length }
      : directiveAcknowledgements(activeBroadcast, units, deskInScope);
  // A desk that holds none of the asked desks (a community team, the jobs desk) shows no count, not "0 of 0".
  const broadcastAcks = allAcks && (allAcks.of > 0 || !deskInScope) ? allAcks : undefined;
  const livePullNows = (broadcastAlerts ?? []).filter(
    (alert) => broadcastKind(alert) === "pull_now" && isAlertLive(alert, movements, now),
  );

  const modalRef = useRef<HTMLDivElement | null>(null);
  const broadcastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);

  const handleCloseBroadcastModal = useCallback(() => {
    setBroadcastModalOpen(false);
  }, [setBroadcastModalOpen]);

  // The shared modal contract: the page behind is inert and held still, focus starts on the close
  // button, Tab wraps inside, Escape closes only this top layer, and focus returns to the trigger.
  useModalFocus({
    open: isBroadcastModalOpen,
    onClose: handleCloseBroadcastModal,
    panelRef: modalRef,
    initialFocusRef: modalCloseRef,
    returnFocusRef: broadcastTriggerRef,
    focusOnOpen: "immediate",
  });

  useEffect(() => {
    if (broadcastAccepted && broadcastRequest?.type === "DISPATCH_BROADCAST_ALERT") {
      broadcastTriggerRef.current?.focus();
    }
  }, [broadcastAccepted, broadcastRequest]);

  // ---- The queue: one entry per row, everything a row, card or panel reads ----
  const entryFor = useCallback(
    (item: InboxItem, snoozed: boolean): Omit<QueueEntry, "highlighted"> => {
      const movement = movements.find((candidate: Movement) => candidate.id === item.movementId);
      const booking = item.plannedAdmission
        ? { planned: item.plannedAdmission, personLabel: item.personLabel }
        : undefined;
      const dischargeAdmissionId = admissionIdOfInboxId(item.id);
      const admission =
        dischargeAdmissionId !== undefined ? admissions.find((stay) => stay.id === dischargeAdmissionId) : undefined;
      const subject = resolveAlertSubject(movement, item.movementId, umrnLookup, units, booking, admission);
      const owner = effectiveOwner(item, inboxOwnership[item.id]);
      return {
        item,
        movement,
        subject,
        group: alertGroupOf(item),
        owner,
        mine: owner === COORDINATOR,
        raised: raisedAt(item, movement),
        seen: inboxAcknowledgements[item.id]?.at(-1),
        ownedSince: currentInboxOwner(inboxOwnership[item.id], item.since)?.at,
        snooze: snoozed ? activeSnooze(inboxSnoozes[item.id], now, item.since) : undefined,
        action: alertActionFor(item, subject),
      };
    },
    [movements, admissions, umrnLookup, units, inboxOwnership, inboxAcknowledgements, inboxSnoozes, now],
  );
  const isHighlighted = useCallback(
    (entry: Omit<QueueEntry, "highlighted">) =>
      (pill === "act" && entry.group === "act") ||
      (pill === "wait" && entry.group === "wait") ||
      (pill === "mine" && entry.mine) ||
      (ownerHighlight !== null && entry.owner === ownerHighlight) ||
      (watchHighlight !== null && alertKindOf(entry.item.id) === watchHighlight),
    [pill, ownerHighlight, watchHighlight],
  );
  const highlightOn = pill !== null || ownerHighlight !== null || watchHighlight !== null;
  const toEntries = useCallback(
    (items: InboxItem[], snoozed: boolean): QueueEntry[] =>
      items
        .map((item) => entryFor(item, snoozed))
        .map((entry) => {
          const highlighted = isHighlighted(entry);
          return { ...entry, highlighted, dimmed: highlightOn && !highlighted };
        })
        .sort((a, b) => byOldest({ at: a.raised }, { at: b.raised })),
    [entryFor, isHighlighted, highlightOn],
  );
  const activeEntries = useMemo(() => toEntries(inbox, false), [toEntries, inbox]);
  const snoozedEntries = useMemo(() => toEntries(snoozedInbox, true), [toEntries, snoozedInbox]);
  const oldestRaised = useMemo(() => {
    const times = activeEntries.flatMap((entry) =>
      entry.group === "running" || entry.raised === undefined ? [] : [entry.raised],
    );
    return times.length > 0 ? Math.min(...times) : undefined;
  }, [activeEntries]);
  const actEntries = activeEntries.filter((entry) => entry.group === "act");
  const waitEntries = activeEntries.filter((entry) => entry.group === "wait");
  const runningEntries = activeEntries.filter((entry) => entry.group === "running");
  const allEntries = useMemo(() => [...activeEntries, ...snoozedEntries], [activeEntries, snoozedEntries]);
  const countedActive = useMemo(() => activeEntries.filter((entry) => entry.group !== "running"), [activeEntries]);
  const yoursCount = countedActive.filter((entry) => entry.mine).length;
  const needYouCount = actEntries.filter((entry) => entry.mine && !entry.seen).length;
  const highlightedCount = allEntries.filter((entry) => entry.highlighted).length;
  const anyHighlight = highlightOn;
  const maxAge = Math.max(1, ...allEntries.map((entry) => (entry.raised === undefined ? 0 : now - entry.raised)));
  const owners = useMemo(() => {
    const names = [...new Set(allEntries.map((entry) => entry.owner))];
    return names.sort((a, b) => (a === COORDINATOR ? -1 : b === COORDINATOR ? 1 : a.localeCompare(b)));
  }, [allEntries]);

  // "Next alert": act now before waiting, yours first, unacknowledged only, oldest first.
  const nextQueue = useMemo(() => {
    const open = countedActive.filter((entry) => !entry.seen);
    const ranked = [...open].sort(
      (a, b) =>
        (a.group === "act" ? 0 : 1) - (b.group === "act" ? 0 : 1) ||
        (a.mine ? 0 : 1) - (b.mine ? 0 : 1) ||
        byOldest({ at: a.raised }, { at: b.raised }),
    );
    return ranked.length > 0 ? ranked : countedActive;
  }, [countedActive]);
  // Ops-3 (remaining-pages audit, 13 Oct 2026): "open" is the one active list the Now tab and the
  // header's Tasks badge count, running targets included, so the three figures always agree. The
  // running targets are named beside it, so Act now plus Waiting plus running adds up to open.
  const openCount = activeEntries.length;
  const runningText = runningEntries.length > 0 ? ` · ${runningEntries.length} running` : "";

  const chosen = allEntries.find((entry) => entry.item.id === chosenId);
  // On the desktop the panel always shows an alert: the chosen one, else the first in line.
  const selected = chosen ?? (slideOver ? undefined : (nextQueue[0] ?? allEntries[0]));

  const select = useCallback(
    (entry: QueueEntry, options: { release?: boolean } = {}) => {
      setChosenId(entry.item.id);
      if (slideOver) setSheetOpen(true);
      if (options.release) {
        releasePending.current = true;
        setReleaseRequest((count) => count + 1);
      }
    },
    [slideOver],
  );

  useEffect(() => {
    if (!releasePending.current || !releaseRef.current) return;
    releaseRef.current.focus();
    releasePending.current = false;
  }, [releaseRequest, selected, sheetOpen]);

  const handleNext = () => {
    if (nextQueue.length === 0) {
      setBroadcastSuccessNotice("No open alert to move to.");
      return;
    }
    const index = selected ? nextQueue.findIndex((entry) => entry.item.id === selected.item.id) : -1;
    const next = nextQueue[(index + 1) % nextQueue.length]!;
    setTab("now");
    select(next);
    const row = document.querySelector<HTMLElement>(`[data-alert-id="${CSS.escape(next.item.id)}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  };

  // ---- Acts on a row, each read back from the event log ----
  // Notes where the event log stands before each dispatch, so the notice reads the reducer's verdict.
  const track = useCallback(
    (request: Omit<ActionRequest, "logSequence">) => {
      const tail = state.eventLog?.at(-1)?.sequence ?? -1;
      setBroadcastRequest(null);
      setBroadcastSuccessNotice(null);
      setActionRequest((prev) => {
        const prevPending = prev && !state.eventLog?.some((e) => e.sequence > prev.logSequence && e.type === prev.type);
        return { ...request, logSequence: prevPending ? Math.max(tail, prev.logSequence + 1) : tail };
      });
    },
    [state.eventLog],
  );
  const nameOf = useCallback(
    (item: InboxItem) => allEntries.find((entry) => entry.item.id === item.id)?.subject.displayName ?? "this patient",
    [allEntries],
  );
  // Acting on the open alert keeps it open, so the panel never jumps to the next one mid-task.
  const detailHandlers: AlertDetailHandlers = {
    onTake: (item) => {
      setChosenId(item.id);
      // The reducer refuses a role re-taking a row it already owns; no notice for a refused act.
      if (currentInboxOwner(inboxOwnership[item.id], item.since)?.by === COORDINATOR) return;
      track({
        type: "TAKE_INBOX_ITEM_OWNERSHIP",
        ok: `You own "${item.title}" for ${nameOf(item)}.`,
        refused: "Take was not accepted.",
      });
      dispatch({ type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now: clockNow, inboxItemId: item.id });
    },
    onAcknowledge: (item) => {
      setChosenId(item.id);
      track({
        type: "ACKNOWLEDGE_INBOX_ITEM",
        ok: `"${item.title}" acknowledged and kept on watch.`,
        refused: "Acknowledge was not accepted.",
      });
      dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: clockNow, inboxItemId: item.id });
    },
    onSnooze: (item, until, reason) => {
      // Say "snoozed" only for a snooze the reducer accepts: the same cap it enforces.
      if (!isSnoozeReason(reason) || !snoozeAllowed(until, clockNow, inboxItemIsActNow(item.id))) return;
      setChosenId(item.id);
      track({
        type: "SNOOZE_INBOX_ITEM",
        ok: `"${item.title}" snoozed until ${formatInstantWithDay(until, clockNow)}.`,
        refused: "Snooze was not accepted.",
      });
      dispatch({ type: "SNOOZE_INBOX_ITEM", role: "coordinator", now: clockNow, inboxItemId: item.id, until, reason });
    },
    onReturn: (item) => {
      track({
        type: "UNSNOOZE_INBOX_ITEM",
        ok: `"${item.title}" is back on the queue.`,
        refused: "Return was not accepted.",
      });
      dispatch({ type: "UNSNOOZE_INBOX_ITEM", role: "coordinator", now: clockNow, inboxItemId: item.id });
    },
    onRelease: (item, reason: ReleasePullReason) => {
      if (!item.movementId) return;
      track({
        type: "RELEASE_PULL",
        ok: `Bed released for ${nameOf(item)}. The ward has a notice.`,
        refused: "Release was not accepted. The bed is still held.",
      });
      dispatch({ type: "RELEASE_PULL", role: "coordinator", now: clockNow, movementId: item.movementId, reason });
    },
    onEscalate: (item) => {
      setChosenId(item.id);
      const movement = movements.find((candidate: Movement) => candidate.id === item.movementId);
      if (item.movementId && escalationAppliesTo(item, movement, units, now)) {
        track({
          type: "RECORD_ESCALATION",
          ok: `Escalated "${item.title}" for ${nameOf(item)} to ${ESCALATION_CONTACTS[0]}.`,
          refused: "Escalation was not accepted.",
        });
        raise("RECORD_ESCALATION", {
          movementId: item.movementId,
          triedUnitIds: movement?.declines.map((decline) => decline.unitId) ?? [],
          contact: ESCALATION_CONTACTS[0],
        });
      }
      // An alert with no movement, or not about a bed search, has nothing to escalate: the button is disabled, so no notice is made.
    },
  };
  const queueHandlers: QueueHandlers = {
    selectedId: selected?.item.id,
    onSelect: (entry) => select(entry),
    onRelease: (entry) => select(entry, { release: true }),
    onReturn: (entry) => detailHandlers.onReturn(entry.item),
  };

  // ---- Checking: every condition this screen looks at, by name, with its count ----
  const countKind = (kind: AlertKind) => allInbox.filter((item) => alertKindOf(item.id) === kind).length;
  const withDeadline = openMovements.filter((movement: Movement) => movement.legalForm?.dueAt !== undefined);
  const declineCandidates = openMovements.filter((movement: Movement) => movement.declines.length > 0).length;
  const untriaged = (referrals ?? []).filter((referral) => referral.triagedAt === undefined);
  const prolongedEdCount = openMovements.filter(
    (movement: Movement) => movement.originEdId !== undefined && now - movement.openedAt >= LONG_WAIT_MINUTES,
  ).length;
  const overrideCount = movements.reduce((total, movement: Movement) => total + movement.overrides.length, 0);
  const checks: { key: string; kind?: AlertKind; label: string; n: number; href?: string; scope: string }[] = [
    {
      key: "legal",
      kind: "legal",
      label: "Form due passed",
      n: countKind("legal"),
      scope: `Watches every movement carrying a recorded form expiry. ${countKind("legal")} of ${withDeadline.length} with a written deadline passed.`,
    },
    {
      key: "declines",
      kind: "declines",
      label: "Every ward declined",
      n: countKind("declines"),
      scope: `Watches movements where every ward approached has refused and none has accepted. ${countKind("declines")} of ${declineCandidates} declined by every ward asked.`,
    },
    {
      key: "unsuitable",
      kind: "unsuitable",
      label: "Unsuitable destination",
      n: countKind("unsuitable"),
      scope:
        "Watches accepted destinations against an authorised-hospital check for the patient's current recorded status.",
    },
    {
      key: "nobed",
      kind: "nobed",
      label: "No eligible bed",
      n: countKind("nobed"),
      scope:
        "Watches open movements still waiting for a ward where no ward in the network is currently eligible. The patient stays on the waitlist and the bed coordinator is notified.",
    },
    {
      key: "hold",
      kind: "hold",
      label: "Bed hold expired",
      n: countKind("hold"),
      scope: "Watches bed pulls against the time they were held until.",
    },
    {
      key: "transport",
      kind: "transport",
      label: "Transport not left",
      n: countKind("transport"),
      scope: "Watches accepted transport legs that have not departed.",
    },
    {
      key: "planned",
      kind: "planned",
      label: "Planned arrival late",
      n: countKind("planned"),
      scope: "Watches booked planned admissions whose expected arrival time has passed with no arrival recorded.",
    },
    {
      key: "notify",
      kind: "notify",
      label: "Notifications to record",
      n: countKind("notify"),
      scope:
        "Watches recent arrivals, transfers and discharges where a carer, personal support person or advocacy service notification is not recorded.",
    },
    {
      key: "target",
      kind: "target",
      label: "Target overdue",
      n: countKind("target"),
      scope:
        "Watches referral decisions, transfer acceptances and transport bookings against their targets, defaults set in Settings.",
    },
    {
      key: "triage",
      label: "Triage waiting",
      n: untriaged.length,
      href: "/mockups/ward-flow/referrals",
      scope: `Watches referrals that have never been triaged. ${untriaged.length} of ${(referrals ?? []).length} referrals have never been triaged. Opens Referrals.`,
    },
    {
      key: "ed",
      label: "ED over a day",
      n: prolongedEdCount,
      href: "/mockups/ward-flow/delays",
      scope: "Watches open ED waits of a day or more. Opens Delays.",
    },
    {
      key: "override",
      label: "Override recorded",
      n: overrideCount,
      scope:
        "Watches referrals made by override. This screen cannot identify a prior gate verdict. The record keeps who, when, which fixed reason and which wards. It does not retain a prior gate verdict.",
    },
  ];

  // ---- History: what this session recorded, newest first ----
  const history = useMemo(() => {
    const entries: HistoryEntry[] = [];
    const about = (inboxItemId: string) => {
      const movementId = movementIdOfInboxId(inboxItemId);
      const movement = movements.find((candidate: Movement) => candidate.id === movementId);
      const booking = bookingOfInboxId(inboxItemId, plannedAdmissions);
      const dischargeAdmissionId = admissionIdOfInboxId(inboxItemId);
      const admission =
        dischargeAdmissionId !== undefined ? admissions.find((stay) => stay.id === dischargeAdmissionId) : undefined;
      const subject = resolveAlertSubject(movement, movementId, umrnLookup, units, booking, admission);
      const kind = alertKindOf(inboxItemId);
      return `${kind ? ALERT_KIND_LABELS[kind] : "Alert"} for ${subject.displayName} ${subject.umrn}`;
    };
    for (const [id, list] of Object.entries(inboxAcknowledgements)) {
      list.forEach((entry, index) =>
        entries.push({
          id: `ack-${id}-${index}`,
          at: entry.at,
          tone: "success",
          title: "Acknowledged",
          sub: about(id),
          by: entry.by,
          action: true,
        }),
      );
    }
    for (const [id, list] of Object.entries(inboxOwnership)) {
      list.forEach((entry, index) =>
        entries.push({
          id: `own-${id}-${index}`,
          at: entry.at,
          tone: "success",
          title: "Taken",
          sub: about(id),
          by: entry.by,
          action: true,
        }),
      );
    }
    for (const [id, list] of Object.entries(inboxSnoozes)) {
      list.forEach((entry, index) =>
        entries.push({
          id: `snooze-${id}-${index}`,
          at: entry.at,
          tone: "neutral",
          title:
            entry.kind === "snoozed"
              ? `Snoozed to ${formatInstantWithDay(entry.until, now)}, ${snoozeReasonLabel(entry.reason).toLowerCase()}`
              : "Returned to the queue",
          sub: about(id),
          by: entry.by,
          action: true,
        }),
      );
    }
    (state.eventLog ?? []).forEach((entry, index) => {
      if (entry.type !== "RELEASE_PULL" || !entry.accepted || entry.now === undefined) return;
      const movement = movements.find((candidate: Movement) => candidate.id === entry.movementId);
      const subject = resolveAlertSubject(movement, entry.movementId, umrnLookup, units);
      entries.push({
        id: `release-${index}`,
        at: entry.now,
        tone: "success",
        title: "Bed released",
        sub: `${subject.displayName} ${subject.umrn}`,
        by: entry.role ? WARD_FLOW_ROLE_LABELS[entry.role] : "Role not recorded",
        action: true,
      });
    });
    for (const alert of broadcastAlerts ?? []) {
      entries.push({
        id: `bc-${alert.id}`,
        at: alert.dispatchedAt,
        tone: "info",
        title: `Broadcast sent: ${alert.title}`,
        sub: alert.targetScopeLabel,
        by: alert.dispatchedByName,
        action: false,
      });
      if (alert.stoodDownAt !== undefined) {
        entries.push({
          id: `bc-down-${alert.id}`,
          at: alert.stoodDownAt,
          tone: "neutral",
          title: `Broadcast stood down: ${alert.title}`,
          sub: alert.targetScopeLabel,
          by: alert.stoodDownBy ?? "Role not recorded",
          action: false,
        });
      }
    }
    return entries.sort((a, b) => b.at - a.at);
  }, [
    inboxAcknowledgements,
    inboxOwnership,
    inboxSnoozes,
    state.eventLog,
    broadcastAlerts,
    movements,
    umrnLookup,
    units,
    plannedAdmissions,
    admissions,
    now,
  ]);

  // ---- Broadcast ----
  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    if (tmplId === "custom") {
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastSeverity("critical");
      setBroadcastCategory("capacity_gridlock");
      setBroadcastScope("all");
      setBroadcastDurationMinutes(240);
      setBroadcastType("directive");
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
      setBroadcastType(tmpl.kind ?? "directive");
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
    setActionRequest(null);
    setBroadcastRequest({
      type: "DISPATCH_BROADCAST_ALERT",
      logSequence: state.eventLog?.at(-1)?.sequence ?? -1,
      title: broadcastTitle.trim(),
      scope: broadcastScope,
      scopeLabel: targetScopeLabel,
    });
    // The new directive shows on the Broadcast tab, where it can be stood down.
    setTab("broadcast");
    dispatch({
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now: clockNow,
      title: broadcastTitle,
      message: broadcastMessage,
      severity: broadcastSeverity,
      category: broadcastCategory,
      targetScope: broadcastScope,
      targetScopeLabel,
      durationMinutes: broadcastDurationMinutes,
      dispatchedByName: "State Mental Health Bed Desk Coordinator",
      kind: broadcastType === "bed_call" ? "bed_call" : "directive",
    });
  };

  const handleStandDown = (alertId: string) => {
    const alert = broadcastAlerts?.find((entry) => entry.id === alertId);
    setBroadcastSuccessNotice(null);
    setActionRequest(null);
    setBroadcastRequest({
      type: "STAND_DOWN_BROADCAST_ALERT",
      logSequence: state.eventLog?.at(-1)?.sequence ?? -1,
      title: alert?.title ?? "Directive",
      scope: alert?.targetScope ?? "all",
      scopeLabel: alert?.targetScopeLabel ?? "the selected scope",
    });
    dispatch({
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now: clockNow,
      alertId,
      stoodDownByRole: "coordinator",
    });
  };

  const openComposer = (trigger: HTMLButtonElement) => {
    broadcastTriggerRef.current = trigger;
    setBroadcastRequest(null);
    setActionRequest(null);
    setBroadcastSuccessNotice(null);
    setBroadcastConfirmed(false);
    setBroadcastModalOpen(true);
  };

  // ---- Hero tools ----
  const handleNotify = () => {
    setBroadcastRequest(null);
    setActionRequest(null);
    if (notifyOn) {
      setActNowNotificationPreference(false);
      setBroadcastSuccessNotice("Browser notifications off.");
      return;
    }
    void enableActNowNotifications().then((answer) => {
      setBroadcastSuccessNotice(
        answer === "granted"
          ? "Browser notifications on for act-now alerts while this tab is open."
          : answer === "unsupported"
            ? "This browser cannot show notifications."
            : "Notifications are blocked for this site in the browser.",
      );
    });
  };

  const handleCopy = () => {
    setBroadcastRequest(null);
    setActionRequest(null);
    const line = (entry: QueueEntry) =>
      `- ${entry.item.title}. ${entry.subject.displayName} ${entry.subject.umrn}. ${entry.subject.to ? `${entry.subject.from} to ${entry.subject.to}` : entry.subject.from}. Owner ${entry.owner}.${entry.raised !== undefined ? ` Open ${minutesText(Math.max(0, now - entry.raised))}.` : ""}`;
    const sections: [string, QueueEntry[]][] = [
      ["Act now", actEntries],
      ["Waiting", waitEntries],
      ["Snoozed", snoozedEntries],
    ];
    const text = [
      `Alerts at ${formatInstantWithDay(now, now)} (synthetic data)`,
      ...sections.flatMap(([label, list]) => (list.length > 0 ? [`${label} ${list.length}`, ...list.map(line)] : [])),
      activeBroadcast
        ? `Broadcast live: ${activeBroadcast.title}, ends ${formatInstantWithDay(activeBroadcast.expiresAt, now)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setBroadcastSuccessNotice("Copy is not available in this browser.");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setBroadcastSuccessNotice(`Copied ${allEntries.length} alerts for handover.`),
      () => setBroadcastSuccessNotice("Copy was blocked by the browser."),
    );
  };

  const togglePill = (next: HeroPill) => setPill((current) => (current === next ? null : next));
  const clearHighlights = () => {
    setPill(null);
    setOwnerHighlight(null);
    setWatchHighlight(null);
  };

  const directiveTone: WfTone =
    activeBroadcast?.severity === "critical" ? "danger" : activeBroadcast?.severity === "warning" ? "warning" : "info";
  const severityLabel = (severity: BroadcastSeverity) =>
    severity === "critical" ? "Critical" : severity === "warning" ? "Warning" : "Advisory";
  const pastBroadcasts = (broadcastAlerts ?? []).filter(
    (alert) => alert.id !== activeBroadcast?.id && !livePullNows.includes(alert),
  );

  // F-09 (phone review, Oct 2026): the title counts act now alerts assigned to you and not yet
  // seen, a part of the Act now figure, so it says so rather than reading as a different total.
  const heroTitle =
    needYouCount > 0
      ? `${needYouCount} act now, new to you`
      : actEntries.length > 0
        ? `${actEntries.length} to act on now`
        : "No alert needs you";

  // ---- Queue views ----
  const rows = (list: QueueEntry[]) =>
    isPhone ? (
      <ul className={styles.phoneRows}>
        {list.map((entry) => (
          <AlertPhoneRow key={entry.item.id} entry={entry} now={now} handlers={queueHandlers} />
        ))}
      </ul>
    ) : (
      <ul className={styles.rows}>
        {list.map((entry) => (
          <AlertRow key={entry.item.id} entry={entry} now={now} maxAge={maxAge} handlers={queueHandlers} />
        ))}
      </ul>
    );
  const groupSection = (key: string, label: string, list: QueueEntry[], head: ReactNode, empty?: string) => (
    <section
      key={key}
      className={styles.group}
      aria-label={label}
      data-testid={key === "snoozed" ? "ward-alerts-snoozed" : undefined}
    >
      {head}
      {list.length > 0 ? rows(list) : <p className={styles.groupEmpty}>{empty}</p>}
    </section>
  );
  const urgencyView = (
    <>
      {groupSection(
        "act",
        "Act now",
        actEntries,
        <GroupHead tone="danger" label="Act now" count={actEntries.length} />,
        "None firing now. The conditions checked are named in the header.",
      )}
      {groupSection(
        "wait",
        "Waiting",
        waitEntries,
        <GroupHead tone="warning" label="Waiting" count={waitEntries.length} />,
        "Nothing is waiting on a transport leg or a planned arrival.",
      )}
      {runningEntries.length > 0
        ? groupSection(
            "running",
            "Targets running",
            runningEntries,
            <GroupHead
              tone="neutral"
              label="Targets running"
              count={runningEntries.length}
              aside="listed, not counted"
            />,
          )
        : null}
      {snoozedEntries.length > 0
        ? groupSection(
            "snoozed",
            "Snoozed",
            snoozedEntries,
            <GroupHead
              icon={<AlarmClock size={14} aria-hidden="true" />}
              label="Snoozed"
              count={snoozedEntries.length}
              aside="back when due"
            />,
          )
        : null}
    </>
  );
  const lanesView = (
    <div className={styles.lanes}>
      {(
        [
          ["act", "Act now", "danger", actEntries],
          ["wait", "Waiting", "warning", [...waitEntries, ...runningEntries]],
          ["snoozed", "Snoozed", "neutral", snoozedEntries],
        ] as [string, string, WfTone, QueueEntry[]][]
      ).map(([key, label, tone, list]) => (
        <section
          key={key}
          className={styles.lane}
          aria-label={label}
          data-testid={key === "snoozed" && list.length > 0 ? "ward-alerts-snoozed" : undefined}
        >
          <GroupHead tone={tone} label={label} count={list.length} />
          {list.length > 0 ? (
            <ul className={styles.cards}>
              {list.map((entry) => (
                <AlertCard key={entry.item.id} entry={entry} now={now} maxAge={maxAge} handlers={queueHandlers} />
              ))}
            </ul>
          ) : (
            <p className={styles.groupEmpty}>None now</p>
          )}
        </section>
      ))}
    </div>
  );
  const ownerView = owners.map((owner) => {
    const list = allEntries.filter((entry) => entry.owner === owner);
    const actCount = list.filter((entry) => entry.group === "act").length;
    return groupSection(
      `owner-${owner}`,
      owner,
      list,
      <GroupHead
        label={ownerShort(owner) === "You" ? `You, ${owner}` : owner}
        count={list.length}
        aside={`${actCount} act now`}
      />,
    );
  });
  const view: ArrangeBy = isPhone ? "urgency" : arrangeBy;

  const tabs = [
    { id: "now" as const, label: "Now", count: activeEntries.length },
    { id: "broadcast" as const, label: "Broadcast", count: (activeBroadcast ? 1 : 0) + livePullNows.length },
    { id: "notices" as const, label: "Notices", count: feedNotices.length },
    { id: "history" as const, label: "History", count: history.length },
  ];

  const selectedPanel = selected ? (
    <AlertDetail
      key={selected.item.id}
      item={selected.item}
      movement={selected.movement}
      subject={selected.subject}
      units={units}
      now={now}
      mine={selected.mine}
      acknowledgements={inboxAcknowledgements[selected.item.id]}
      ownership={inboxOwnership[selected.item.id]}
      snoozeEntries={inboxSnoozes[selected.item.id]}
      snoozedUntil={selected.snooze}
      configuration={configuration}
      handlers={detailHandlers}
      releaseRef={releaseRef}
    />
  ) : null;

  const todayChart = (
    <TodayChart
      now={now}
      selectedId={selected?.item.id}
      onPick={(id) => {
        const entry = allEntries.find((candidate) => candidate.item.id === id);
        if (entry) select(entry);
      }}
      raised={allEntries
        .filter((entry) => entry.raised !== undefined)
        .map((entry) => ({
          id: entry.item.id,
          at: entry.raised!,
          shape: entry.group === "act" ? ("act" as const) : ("wait" as const),
          title: `${entry.item.title} for ${entry.subject.displayName}. Raised ${formatInstantWithDay(entry.raised!, now)}`,
        }))}
      acted={history
        .filter((entry) => entry.action)
        .map((entry) => ({
          id: entry.id,
          at: entry.at,
          shape: "done" as const,
          title: `${entry.title}, ${formatInstantWithDay(entry.at, now)}`,
        }))}
      broadcasts={(broadcastAlerts ?? []).map((alert) => ({
        id: alert.id,
        from: alert.dispatchedAt,
        until: alert.stoodDownAt ?? alert.expiresAt,
        title: `${alert.title}, sent ${formatInstantWithDay(alert.dispatchedAt, now)}`,
      }))}
    />
  );

  const checkingFoot = (
    <div className={styles.checking}>
      <span className={styles.checkingLabel}>Checking</span>
      <ul className={styles.checkList} aria-label="Conditions checked">
        {checks.map((check) => {
          const scopeId = `alerts-check-${check.key}`;
          const body = (
            <>
              <span className={styles.mono}>{check.n}</span>
              {check.label}
            </>
          );
          return (
            <li key={check.key} aria-label={check.label} data-zero={check.n === 0 ? "true" : undefined}>
              {!check.href && !check.kind ? (
                <span className={styles.check} title={check.scope} aria-describedby={scopeId}>
                  {body}
                </span>
              ) : check.href ? (
                <Link className={styles.check} href={check.href} title={check.scope} aria-describedby={scopeId}>
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.check}
                  title={check.scope}
                  aria-pressed={watchHighlight === check.kind}
                  aria-describedby={scopeId}
                  onClick={() => {
                    setTab("now");
                    setWatchHighlight((current) => (current === check.kind ? null : (check.kind ?? null)));
                  }}
                >
                  {body}
                </button>
              )}
              <SrOnly id={scopeId}>{check.scope}</SrOnly>
            </li>
          );
        })}
        <li aria-label="Not checked: handover sheets" className={styles.notChecked}>
          <span className={styles.check} title="Nothing in this system records when a shift hands over.">
            <X size={12} aria-hidden="true" />
            Not checked: handover sheets
          </span>
          <SrOnly>
            Handover sheets. Nothing in this system records when a shift hands over, so there is no deadline to measure
            and this screen cannot tell you whether one is due.
          </SrOnly>
        </li>
      </ul>
    </div>
  );

  return (
    <div className={styles.screen} data-testid="ward-alerts-page" data-ward-design="v8">
      <main id="main-content" className={styles.main}>
        {isPhone ? (
          <>
            <PhoneHero
              level={1}
              data-testid="ward-alerts-phone-hero"
              title={heroTitle}
              sub={
                openCount > 0
                  ? `${openCount} open${runningText}${
                      oldestRaised !== undefined ? ` · oldest ${minutesText(Math.max(0, now - oldestRaised))}` : ""
                    }`
                  : "Checking every condition below"
              }
              eyebrow="Alerts"
              // F-08: the standard Demo pill, as on every phone hero; Pause below holds the list.
              chip={<LiveChip state={live.paused ? "paused" : "live"} onHero />}
              figures={[
                {
                  id: "act",
                  value: actEntries.length,
                  label: "Act now",
                  tone: "danger",
                  pressed: pill === "act",
                  onPress: () => togglePill("act"),
                },
                {
                  id: "wait",
                  value: waitEntries.length,
                  label: "Waiting",
                  tone: "warning",
                  pressed: pill === "wait",
                  onPress: () => togglePill("wait"),
                },
                {
                  id: "mine",
                  value: yoursCount,
                  // F-09: says what it counts, so it reads beside the title's smaller number.
                  label: "Assigned to you",
                  pressed: pill === "mine",
                  onPress: () => togglePill("mine"),
                },
              ]}
              actions={
                <div className={styles.phoneHeroActions}>
                  {/* Ops-14 (13 Oct 2026): working the next alert is the common action, so it is the
                      one primary; a statewide broadcast stays one tap away as a secondary. */}
                  <Button variant="light" icon={ChevronRight} onClick={handleNext} data-testid="ward-alerts-phone-next">
                    Next alert
                  </Button>
                  <Button
                    ref={broadcastTriggerRef}
                    variant="onHero"
                    icon={Radio}
                    onClick={(event) => openComposer(event.currentTarget)}
                  >
                    Broadcast
                  </Button>
                  <Button
                    variant="onHero"
                    icon={live.paused ? Play : Pause}
                    aria-pressed={live.paused}
                    title={live.paused ? "Resume live updates" : "Hold the list still"}
                    onClick={live.togglePause}
                  >
                    {live.paused ? "Resume" : "Pause"}
                  </Button>
                </div>
              }
            />
            {activeBroadcast ? (
              <button type="button" className={styles.phoneDirective} onClick={() => setTab("broadcast")}>
                <StatusGlyph tone={directiveTone} />
                <span className={styles.phoneCardText}>
                  <span className={styles.phoneCardTitle}>{activeBroadcast.title}</span>
                  <span className={styles.phoneCardMeta}>
                    {broadcastAcks ? (
                      <>
                        <b className={styles.mono}>{broadcastAcks.acknowledged}</b> of{" "}
                        <span className={styles.mono}>{broadcastAcks.of}</span> answered ·{" "}
                      </>
                    ) : null}
                    ends <span className={styles.mono}>{formatInstantWithDay(activeBroadcast.expiresAt, now)}</span>
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ) : null}
            <PhoneSheet open={phoneToday} onClose={() => setPhoneToday(false)} title="Today" height="tall">
              <div className={styles.phoneChecks}>{todayChart}</div>
            </PhoneSheet>
          </>
        ) : (
          <Hero
            level={1}
            eyebrow="Alerts"
            title={heroTitle}
            titleMeta={
              openCount > 0 ? (
                <span className={styles.heroMeta}>
                  <span className={styles.mono}>{openCount}</span> open
                  {runningText}
                  {oldestRaised !== undefined ? (
                    <>
                      {" "}
                      · oldest <span className={styles.mono}>{minutesText(Math.max(0, now - oldestRaised))}</span>
                    </>
                  ) : null}
                </span>
              ) : undefined
            }
            aside={
              <div className={styles.heroTools}>
                <PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />
                <Button
                  variant="onHero"
                  size="sm"
                  icon={notifyOn ? BellRing : Bell}
                  aria-pressed={notifyOn}
                  title="Act-now alerts notify in this open tab. No patient detail is shown."
                  onClick={handleNotify}
                >
                  Notify me
                </Button>
                <Button
                  ref={broadcastTriggerRef}
                  variant="light"
                  size="sm"
                  icon={Radio}
                  onClick={(event) => openComposer(event.currentTarget)}
                >
                  Broadcast alert
                </Button>
              </div>
            }
            bar={
              <div className={styles.heroBar}>
                <div className={styles.heroStats} role="group" aria-label="Alert summary">
                  <HeroStat
                    inline
                    value={actEntries.length}
                    label="Act now"
                    tone="danger"
                    pressed={pill === "act"}
                    onToggle={() => togglePill("act")}
                  />
                  <HeroStat
                    inline
                    value={waitEntries.length}
                    label="Waiting"
                    tone="warning"
                    pressed={pill === "wait"}
                    onToggle={() => togglePill("wait")}
                  />
                  <HeroStat
                    inline
                    value={yoursCount}
                    label="Yours"
                    tone="neutral"
                    pressed={pill === "mine"}
                    onToggle={() => togglePill("mine")}
                  />
                </div>
                {activeBroadcast ? (
                  <button
                    type="button"
                    className={styles.heroBroadcast}
                    title="Open the broadcast desk"
                    onClick={() => setTab("broadcast")}
                  >
                    <TimeRing
                      from={activeBroadcast.dispatchedAt}
                      until={activeBroadcast.expiresAt}
                      now={now}
                      size={30}
                      onHero
                    />
                    <StatusGlyph tone={directiveTone} />
                    <span className={styles.heroBroadcastTitle}>{activeBroadcast.title}</span>
                    <span className={styles.heroBroadcastMeta}>
                      ends <span className={styles.mono}>{formatInstantWithDay(activeBroadcast.expiresAt, now)}</span>
                      {broadcastAcks ? (
                        <span className={styles.deskOnly}>
                          {" "}
                          · <span className={styles.mono}>{broadcastAcks.acknowledged}</span> acknowledged
                        </span>
                      ) : null}
                    </span>
                  </button>
                ) : null}
              </div>
            }
            barAside={
              <div className={styles.heroTools}>
                <Button
                  variant="onHero"
                  size="sm"
                  icon={ChevronRight}
                  aria-label={`Next alert, ${nextQueue.length} in turn`}
                  disabled={nextQueue.length === 0}
                  onClick={handleNext}
                >
                  {/* Next steps through the actionable queue only; running targets are listed, not counted. */}
                  Next of <span className={styles.mono}>{nextQueue.length}</span>
                </Button>
                <Button variant="onHero" size="sm" icon={Copy} className={styles.deskOnly} onClick={handleCopy}>
                  Copy for handover
                </Button>
              </div>
            }
            foot={<div className={styles.checkingFootWide}>{checkingFoot}</div>}
          />
        )}

        {/* Feedback after a broadcast or an act on a row */}
        {broadcastFeedback && (!broadcastRefused || !isBroadcastModalOpen) && (
          <div
            className={styles.feedbackLine}
            role={feedbackRefused ? "alert" : "status"}
            aria-label="Broadcast feedback"
          >
            <StatusGlyph tone={feedbackRefused ? "danger" : "success"} />
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
                setActionRequest(null);
                setBroadcastSuccessNotice(null);
              }}
              aria-label="Dismiss notice"
            />
          </div>
        )}

        <div className={styles.grid}>
          <div className={styles.column}>
            <Card as="section" className={styles.queueCard} aria-label="Alerts">
              <div className={styles.tabsBar}>
                {isPhone ? (
                  // Phone (v10): the four views as pill tabs that stay under the header; a count shows when it is not zero.
                  <PillTabs<AlertsTab>
                    items={tabs.map((item) => (item.count ? item : { ...item, count: undefined }))}
                    value={tab}
                    onChange={setTab}
                    label="Alerts views"
                    idPrefix="alerts"
                    fill
                  />
                ) : (
                  <Tabs items={tabs} value={tab} onChange={setTab} label="Alerts views" idPrefix="alerts" />
                )}
              </div>

              {tab === "now" ? (
                <TabPanel idPrefix="alerts" id="now">
                  <div className={styles.toolbar}>
                    <Segmented
                      label="Arrange by"
                      value={arrangeBy}
                      onChange={setArrangeBy}
                      items={[
                        {
                          id: "urgency",
                          label: (
                            <>
                              <List size={14} aria-hidden="true" /> Urgency
                            </>
                          ),
                        },
                        {
                          id: "lanes",
                          label: (
                            <>
                              <Columns3 size={14} aria-hidden="true" /> Lanes
                            </>
                          ),
                        },
                        {
                          id: "owner",
                          label: (
                            <>
                              <Users size={14} aria-hidden="true" /> Owner
                            </>
                          ),
                        },
                      ]}
                    />
                    <span className={styles.toolbarRule} aria-hidden="true" />
                    {anyHighlight ? null : <span className={styles.quiet}>Highlight</span>}
                    <div className={styles.chipRow} role="group" aria-label="Highlight by owner">
                      {owners.map((owner) => (
                        <FilterChip
                          key={owner}
                          className={styles.filterBtn}
                          pressed={ownerHighlight === owner}
                          onPressedChange={() => setOwnerHighlight((current) => (current === owner ? null : owner))}
                          count={allEntries.filter((entry) => entry.owner === owner).length}
                        >
                          {ownerShort(owner)}
                        </FilterChip>
                      ))}
                    </div>
                    {anyHighlight ? (
                      <span className={styles.highlightNote} role="status">
                        {highlightedCount} of {allEntries.length} <SrOnly>synthetic rows</SrOnly> highlighted, all rows
                        stay
                      </span>
                    ) : null}
                    {anyHighlight ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={styles.btnSm}
                        aria-label={`Clear highlights, ${highlightedCount} highlighted`}
                        onClick={clearHighlights}
                      >
                        Clear <Count n={highlightedCount} />
                      </Button>
                    ) : null}
                  </div>
                  {isPhone ? (
                    <>
                      {owners.length > 0 ? (
                        <div className={styles.phoneChips} role="group" aria-label="Highlight by owner">
                          {/* Yours is a hero figure on phone, so the chips are the other owners. */}
                          {owners
                            .filter((owner) => ownerShort(owner) !== "You")
                            .map((owner) => (
                              <FilterChip
                                key={owner}
                                className={styles.filterBtn}
                                pressed={ownerHighlight === owner}
                                onPressedChange={() =>
                                  setOwnerHighlight((current) => (current === owner ? null : owner))
                                }
                              >
                                <b className={styles.mono}>
                                  {allEntries.filter((entry) => entry.owner === owner).length}
                                </b>
                                {ownerShort(owner)}
                              </FilterChip>
                            ))}
                        </div>
                      ) : null}
                      <div className={styles.phoneList}>{urgencyView}</div>
                      <p className={styles.phoneNote}>Act now first · longest overdue next</p>
                    </>
                  ) : view === "lanes" ? (
                    lanesView
                  ) : view === "owner" ? (
                    ownerView
                  ) : (
                    urgencyView
                  )}
                </TabPanel>
              ) : null}

              {tab === "broadcast" ? (
                <TabPanel idPrefix="alerts" id="broadcast" className={styles.tabBody}>
                  {livePullNows.length > 0 ? (
                    <section className={styles.group} aria-label="Pull now">
                      <GroupHead label="Pull now" count={livePullNows.length} />
                      {livePullNows.map((alert) => (
                        <PullNowCard key={alert.id} alert={alert} onStandDown={handleStandDown} />
                      ))}
                    </section>
                  ) : null}
                  {activeBroadcast ? (
                    <div
                      className={styles.directive}
                      data-severity={activeBroadcast.severity}
                      role="group"
                      aria-live="assertive"
                      aria-atomic="true"
                      aria-label="Active Statewide Directive"
                    >
                      {/* The acknowledged-units count below is announced; this sentence travels with it
                          (tests/ward-announced-figures-carry-their-marker, tier b). Screen readers only. */}
                      <span className="sr-only">These counts are invented figures.</span>
                      <div className={styles.directiveMain}>
                        <div className={styles.directiveHead}>
                          <StatusGlyph tone={directiveTone} />
                          <strong className={styles.directiveTitle}>{activeBroadcast.title}</strong>
                          <Badge tone={directiveTone}>{severityLabel(activeBroadcast.severity)}</Badge>
                        </div>
                        <p className={styles.directiveMessage}>{activeBroadcast.message}</p>
                        <dl className={styles.facts}>
                          <div>
                            <dt>Sent to</dt>
                            <dd>{activeBroadcast.targetScopeLabel}</dd>
                          </div>
                          <div>
                            <dt>Sent</dt>
                            <dd>
                              <span className={styles.mono}>
                                {formatInstantWithDay(activeBroadcast.dispatchedAt, now)}
                              </span>{" "}
                              by {activeBroadcast.dispatchedByName}
                            </dd>
                          </div>
                          <div>
                            <dt>Ends</dt>
                            <dd>
                              <span className={styles.mono}>
                                {formatInstantWithDay(activeBroadcast.expiresAt, now)}
                              </span>
                              , in{" "}
                              <span className={styles.mono}>
                                {minutesText(Math.max(0, activeBroadcast.expiresAt - now))}
                              </span>
                            </dd>
                          </div>
                          {broadcastAcks ? (
                            <div>
                              <dt>Acknowledged</dt>
                              <dd>
                                <span>
                                  {broadcastAcks.acknowledged} of {broadcastAcks.of} units{" "}
                                  {broadcastKind(activeBroadcast) === "directive" ? "acknowledged" : "answered"}
                                </span>
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                        {broadcastKind(activeBroadcast) === "bed_call" ? (
                          <ReplyBoardList alert={activeBroadcast} units={units} now={now} />
                        ) : null}
                        <div className={styles.directiveActions}>
                          <Button
                            size="sm"
                            icon={X}
                            className={styles.btn}
                            aria-label="Stand down this alert"
                            onClick={() => handleStandDown(activeBroadcast.id)}
                          >
                            Stand down
                          </Button>
                          <Button
                            size="sm"
                            icon={Clock}
                            onClick={() => {
                              // The notice reads the reducer's verdict from the event log, as every
                              // other act on this page does, so a refused extension is not reported.
                              track({
                                type: "EXTEND_BROADCAST_ALERT",
                                ok: `Extended "${activeBroadcast.title}".`,
                                refused: "Extension was not accepted.",
                              });
                              raise("EXTEND_BROADCAST_ALERT", { alertId: activeBroadcast.id });
                            }}
                          >
                            Extend
                          </Button>
                          <Button
                            size="sm"
                            icon={Smartphone}
                            disabledReason="Not wired in this prototype."
                            reasonDisplay="tooltip"
                          >
                            Push to phones
                          </Button>
                        </div>
                      </div>
                      <div className={styles.directiveRing}>
                        <TimeRing
                          from={activeBroadcast.dispatchedAt}
                          until={activeBroadcast.expiresAt}
                          now={now}
                          size={96}
                        />
                        <span className={styles.quiet}>time left</span>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Radio}
                      title="No broadcast live"
                      meta={`Checked ${formatInstantWithDay(now, now)}`}
                    />
                  )}
                  {pastBroadcasts.length > 0 ? (
                    <section className={styles.group} aria-label="Earlier broadcasts">
                      <GroupHead label="Earlier this session" count={pastBroadcasts.length} />
                      <ul className={styles.historyList}>
                        {pastBroadcasts.map((alert) => (
                          <li key={alert.id}>
                            <span className={styles.mono}>{formatInstantWithDay(alert.dispatchedAt, now)}</span>
                            <StatusGlyph tone="neutral" size={9} />
                            <span className={styles.historyText}>
                              <span className={styles.historyTitle}>{alert.title}</span>
                              <span className={styles.quiet}>
                                {alert.status === "stood_down"
                                  ? "Stood down"
                                  : isAlertLive(alert, movements, now)
                                    ? "Still live"
                                    : "Ended"}{" "}
                                · {alert.targetScopeLabel}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </TabPanel>
              ) : null}

              {tab === "notices" ? (
                <TabPanel idPrefix="alerts" id="notices">
                  <section className={styles.tabBody} aria-label="Operational Notices and Shift Communication Feed">
                    <GroupHead label="Role notices" count={feedNotices.length} />
                    {feedNotices.length === 0 ? (
                      <div className={styles.feedEmpty}>
                        <p className={styles.none}>No notices have been raised this session.</p>
                        <p className={styles.quiet}>Recorded referral, bed-hold and transport notices appear here.</p>
                      </div>
                    ) : (
                      <ul className={styles.historyList}>
                        {feedNotices.map((notice) => {
                          const isRead = notice.readAt !== undefined;
                          return (
                            <li key={notice.id}>
                              <span className={styles.mono}>{formatInstantWithDay(notice.raisedAt, now)}</span>
                              <StatusGlyph tone={isRead ? "neutral" : "info"} size={9} />
                              <span className={styles.historyText}>
                                <span className={styles.historyTitle}>
                                  {withUmrnInPlaceOfMovementIds(notice.sentence, umrnLookup)}
                                </span>
                                <span className={styles.quiet}>To {WARD_FLOW_ROLE_LABELS[notice.to.role]}</span>
                              </span>
                              <span className={styles.quiet}>{isRead ? "Read" : "Unread"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </TabPanel>
              ) : null}

              {tab === "history" ? (
                <TabPanel idPrefix="alerts" id="history" className={styles.tabBody}>
                  {history.length === 0 ? (
                    <EmptyState
                      icon={Clock}
                      title="Nothing recorded this session"
                      meta="Acknowledgements, takes, snoozes, bed releases and broadcasts"
                    />
                  ) : (
                    <ul className={styles.historyList} aria-label="Recorded this session">
                      {history.map((entry) => (
                        <li key={entry.id}>
                          <span className={styles.mono}>{formatInstantWithDay(entry.at, now)}</span>
                          <StatusGlyph tone={entry.tone} size={9} />
                          <span className={styles.historyText}>
                            <span className={styles.historyTitle}>{entry.title}</span>
                            <span className={styles.quiet}>{entry.sub}</span>
                          </span>
                          <span className={styles.quiet}>{entry.by}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabPanel>
              ) : null}
            </Card>

            <Card as="section" className={styles.todayCard} aria-label="Today">
              <div className={styles.todayHead}>
                <h2 className={styles.todayTitle}>
                  <Clock size={16} aria-hidden="true" />
                  Today
                </h2>
                <span className={styles.legend}>
                  <span>
                    <StatusGlyph tone="danger" size={9} /> Act now
                  </span>
                  <span>
                    <StatusGlyph tone="warning" size={9} /> Waiting
                  </span>
                  <span>
                    <StatusGlyph tone="success" size={9} /> Acted on
                  </span>
                </span>
              </div>
              {todayChart}
            </Card>
            {isPhone ? (
              <>
                <button type="button" className={styles.phoneCard} onClick={() => setPhoneToday(true)}>
                  <Clock size={18} aria-hidden="true" />
                  <span className={styles.phoneCardText}>
                    <span className={styles.phoneCardTitle}>Today</span>
                    <span className={styles.phoneCardMeta}>
                      <b className={styles.mono}>{allEntries.filter((entry) => entry.raised !== undefined).length}</b>{" "}
                      raised · <b className={styles.mono}>{history.filter((entry) => entry.action).length}</b> acted on
                      · <b className={styles.mono}>{(broadcastAlerts ?? []).length}</b> broadcast
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button type="button" className={styles.phoneCard} onClick={() => setPhoneChecks(true)}>
                  <Activity size={18} aria-hidden="true" />
                  <span className={styles.phoneCardText}>
                    <span className={styles.phoneCardTitle}>
                      Checking <span className={styles.mono}>{checks.length}</span> conditions
                    </span>
                    <span className={styles.phoneCardMeta}>
                      <b className={styles.mono}>{checks.filter((check) => check.n > 0).length}</b> firing · handover
                      sheets not checked
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </>
            ) : (
              /* Device audit (11 Oct 2026): on an iPad in portrait the Checking strip wraps to three lines,
                 so it becomes the phone's one-tap card there (shown by CSS in that range only). */
              <button
                type="button"
                className={`${styles.phoneCard} ${styles.checkingCardPortrait}`}
                onClick={() => setPhoneChecks(true)}
              >
                <Activity size={18} aria-hidden="true" />
                <span className={styles.phoneCardText}>
                  <span className={styles.phoneCardTitle}>
                    Checking <span className={styles.mono}>{checks.length}</span> conditions
                  </span>
                  <span className={styles.phoneCardMeta}>
                    <b className={styles.mono}>{checks.filter((check) => check.n > 0).length}</b> firing · handover
                    sheets not checked
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
            <PhoneSheet open={phoneChecks} onClose={() => setPhoneChecks(false)} title="Checking" height="tall">
              <div className={styles.phoneChecks}>{checkingFoot}</div>
            </PhoneSheet>
          </div>

          {slideOver ? null : (
            <aside className={styles.panel} aria-label="Selected alert" data-wf-rail>
              <Card as="div" className={styles.panelCard}>
                {selectedPanel ?? <EmptyState icon={Bell} title="Pick an alert to see it here" />}
              </Card>
            </aside>
          )}
        </div>

        {slideOver && selected ? (
          <Drawer
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={selected.item.title}
            mobileSize="viewport"
          >
            {selectedPanel}
          </Drawer>
        ) : null}

        {/* Broadcast composer sheet */}
        {isBroadcastModalOpen && (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
          <div
            ref={modalRef}
            className={styles.modalOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="broadcast-title"
            aria-describedby="broadcast-desc"
            tabIndex={-1}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseBroadcastModal();
              }
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
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

                <Field label="Type" id="alerts-broadcast-type">
                  <Select value={broadcastType} onChange={(e) => setBroadcastType(e.target.value as BroadcastKind)}>
                    <option value="directive">Directive, wards and ED acknowledge</option>
                    <option value="bed_call">Bed call, wards answer how many beds</option>
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
                      <option value="critical">Critical</option>
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
                    {/* Ops-12: each count is read from the unit list, never typed. */}
                    <option value="all">All inpatient wards and ED desks, {broadcastScopeCount(units, "all")}</option>
                    <option value="metro_adult">
                      Metropolitan adult units, {broadcastScopeCount(units, "metro_adult")}
                    </option>
                    <option value="ed_liaison">
                      ED mental health liaison desks, {broadcastScopeCount(units, "ed_liaison")}
                    </option>
                    <option value="forensic">
                      Frankland Centre forensic, {broadcastScopeCount(units, "forensic")}
                    </option>
                    <option value="adolescent">
                      CAMHS adolescent acute units, {broadcastScopeCount(units, "adolescent")}
                    </option>
                    <option value="older_adult">Older adult units, {broadcastScopeCount(units, "older_adult")}</option>
                    <option value="regional_wachs">
                      WACHS regional network, {broadcastScopeCount(units, "regional_wachs")}
                    </option>
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
                        {severityLabel(broadcastSeverity)} · expires in {minutesText(broadcastDurationMinutes)}
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
