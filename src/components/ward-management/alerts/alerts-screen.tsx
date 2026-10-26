"use client";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { AlarmClock, Bell, ChevronRight, Clock, Columns3, List, Activity, Users, X } from "lucide-react";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import {
  activeSnooze,
  currentInboxOwner,
  isSnoozeReason,
  partitionSnoozed,
  snoozeAllowed,
} from "@/components/ward-management/ward-inbox-snooze";
import { inboxItemIsActNow } from "@/components/ward-management/ward-flow-reducer";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { ESCALATION_CONTACTS, type ReleasePullReason } from "@/components/ward-management/ward-change-reasons";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { useOptionalSearchParams } from "@/components/ward-management/ward/ward-screen-helpers";
import { usePageLive } from "@/components/ward-management/ward-page-live";
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
import { directiveAcknowledgements, isAlertLive, replyBoard } from "./global-alert-view";

import {
  broadcastDraftBaseline,
  isBroadcastDraftDirty,
  parseBroadcastDraft,
  serialiseBroadcastDraft,
  type BroadcastDraft,
} from "./broadcast-draft";
import {
  alertActionFor,
  alertGroupOf,
  alertKindOf,
  alertsOrderLine,
  byOldest,
  escalationAppliesTo,
  effectiveOwner,
  isQueueItem,
  minutesText,
  admissionIdOfInboxId,
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
import { groupLinkedAlerts, type LinkedQueueItem } from "./alert-linked-groups";
import { LinkedAlertItem } from "./alert-linked-group";
import { AlertDetail, type AlertDetailHandlers } from "./alert-detail";
import { TodayChart } from "./alerts-visuals";
import { alertChecks } from "./alerts-checks";
import { alertsHistory } from "./alerts-history";
import { AlertsHero, type AlertsTab, type HeroPill } from "./alerts-hero";
import { AlertsBroadcastPanel, AlertsHistoryPanel, AlertsNoticesPanel } from "./alerts-tab-panels";
import { BroadcastComposer } from "./broadcast-composer";

import { ForecastAlertsGroup } from "@/components/ward-management/forecast/forecast-alerts-group";
import styles from "./alerts.module.css";
import {
  Button,
  Count,
  Card,
  Drawer,
  EmptyState,
  FilterChip,
  PhoneSheet,
  PillTabs,
  Segmented,
  SrOnly,
  StatusGlyph,
  TabPanel,
  Tabs,
  useIsPhone,
  type WfTone,
  useIsTabletPortrait,
  useModalFocus,
} from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

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

type ArrangeBy = "urgency" | "lanes" | "owner";

/** A request this screen sent, read back from the event log so a refused act never says it happened. */
type ActionRequest = { type: string; logSequence: number; ok: string; refused: string };

/** The address's query, read on the client only; the server draws the screen without it. */

export function AlertsScreen() {
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  return <AlertsWorkspace key={worldGeneration} />;
}

function AlertsWorkspace() {
  usePrintableDisclosures();
  const access = useEffectiveWardAccess();
  const actionDisabledReason = access.role === "coordinator" ? undefined : "Only the coordinator can change alerts.";
  // Broadcasting is for the coordinator and the site bed manager (`EVENT_ROLE.DISPATCH_BROADCAST_ALERT`).
  const broadcastDisabledReason =
    access.role === "coordinator" || access.role === "bed_manager"
      ? undefined
      : "Only the coordinator or a bed manager can broadcast.";

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
          stuckHandoverMinutes: configuration.transportBookedTargetMinutes,
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
  const releaseHandled = useRef(0);
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
      const subject = resolveAlertSubject(
        movement,
        item.movementId,
        umrnLookup,
        units,
        booking,
        admission,
        item.personId,
      );
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
      if (options.release) setReleaseRequest((count) => count + 1);
    },
    [slideOver],
  );

  // Change 7 (D-77): the Alerts drawer's Release bed opens here as `?alert=<id>&release=1`, so the
  // alert is chosen and its release reason takes focus. Read from the router, so a client-side
  // visit never sees the previous page's query, and each new address is used once, during render.
  const address = useOptionalSearchParams()?.toString() ?? "";
  const [addressUsed, setAddressUsed] = useState("");
  if (address && address !== addressUsed) {
    const query = new URLSearchParams(address);
    const entry = allEntries.find((candidate) => candidate.item.id === query.get("alert"));
    setAddressUsed(address);
    if (entry) select(entry, { release: query.get("release") === "1" });
  }

  useEffect(() => {
    if (releaseRequest === releaseHandled.current || !releaseRef.current) return;
    releaseRef.current.focus();
    releaseHandled.current = releaseRequest;
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
      if (actionDisabledReason) return;
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
      if (actionDisabledReason) return;
      setChosenId(item.id);
      track({
        type: "ACKNOWLEDGE_INBOX_ITEM",
        ok: `"${item.title}" acknowledged and kept on watch.`,
        refused: "Acknowledge was not accepted.",
      });
      dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: clockNow, inboxItemId: item.id });
    },
    onSnooze: (item, until, reason) => {
      if (actionDisabledReason) return;
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
      if (actionDisabledReason) return;
      track({
        type: "UNSNOOZE_INBOX_ITEM",
        ok: `"${item.title}" is back on the queue.`,
        refused: "Return was not accepted.",
      });
      dispatch({ type: "UNSNOOZE_INBOX_ITEM", role: "coordinator", now: clockNow, inboxItemId: item.id });
    },
    onRelease: (item, reason: ReleasePullReason) => {
      if (actionDisabledReason) return;
      if (!item.movementId) return;
      track({
        type: "RELEASE_PULL",
        ok: `Bed released for ${nameOf(item)}. The ward has a notice.`,
        refused: "Release was not accepted. The bed is still pulled.",
      });
      dispatch({ type: "RELEASE_PULL", role: "coordinator", now: clockNow, movementId: item.movementId, reason });
    },
    onEscalate: (item) => {
      if (actionDisabledReason) return;
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
  const checks = alertChecks({ allInbox, openMovements, referrals, movements, now });

  // ---- History: what this session recorded, newest first ----
  const history = useMemo(
    () =>
      alertsHistory({
        inboxAcknowledgements,
        inboxOwnership,
        inboxSnoozes,
        eventLog: state.eventLog,
        broadcastAlerts,
        movements,
        umrnLookup,
        units,
        plannedAdmissions,
        admissions,
        now,
      }),
    [
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
    ],
  );

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
      `- ${entry.item.title}. ${entry.subject.displayName}. ${entry.subject.to ? `${entry.subject.from} to ${entry.subject.to}` : entry.subject.from}. Owner ${entry.owner}.${entry.raised !== undefined ? ` Open ${minutesText(Math.max(0, now - entry.raised))}.` : ""}`;
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
    copyTextToClipboard(text).then(
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

  // Overall review, 20 Oct 2026 (rule A2): the title leads with the Act now figure, the number the
  // menu's "Act-now alerts" row shows. The part of it assigned to you and not yet seen (F-09) follows
  // as its own clause, so it never stands in for the total.
  const heroTitle =
    actEntries.length > 0
      ? `${actEntries.length} act now${needYouCount > 0 ? `, ${needYouCount} new to you` : ""}`
      : "No alert needs you";

  // ---- Queue views ----
  const rowFor = (entry: QueueEntry) =>
    isPhone ? (
      <AlertPhoneRow key={entry.item.id} entry={entry} now={now} handlers={queueHandlers} />
    ) : (
      <AlertRow key={entry.item.id} entry={entry} now={now} maxAge={maxAge} handlers={queueHandlers} />
    );
  // Closing-the-loop (package E): alerts naming one record show as one grouped item. Recorded order,
  // no re-sorting; every alert keeps its own row inside the item. See `alert-linked-groups.ts`.
  const linkedItems = (
    items: LinkedQueueItem<QueueEntry>[],
    listClassName: string,
    sectionLabels: readonly string[],
    renderEntry: (entry: QueueEntry) => ReactNode,
  ) =>
    items.map((queued) =>
      queued.kind === "single" ? (
        renderEntry(queued.entry)
      ) : (
        <LinkedAlertItem
          key={queued.key}
          item={queued}
          sectionLabels={sectionLabels}
          listClassName={listClassName}
          renderEntry={renderEntry}
        />
      ),
    );
  const linkedNote = (count: number) =>
    count > 0 ? (
      <p className={styles.groupEmpty}>
        {count === 1 ? "1 alert here is" : `${count} alerts here are`} shown earlier, grouped with the other alerts on
        the same record.
      </p>
    ) : null;
  const rows = (items: LinkedQueueItem<QueueEntry>[], sectionLabels: readonly string[]) => {
    const listClassName = isPhone ? styles.phoneRows : styles.rows;
    return <ul className={listClassName}>{linkedItems(items, listClassName, sectionLabels, rowFor)}</ul>;
  };
  const groupSection = (
    key: string,
    label: string,
    list: QueueEntry[],
    head: ReactNode,
    empty?: string,
    linked?: { items: LinkedQueueItem<QueueEntry>[]; shownEarlier: number; sectionLabels: readonly string[] },
  ) => (
    <section
      key={key}
      className={styles.group}
      aria-label={label}
      data-testid={key === "snoozed" ? "ward-alerts-snoozed" : undefined}
    >
      {head}
      {list.length === 0 ? (
        <p className={styles.groupEmpty}>{empty}</p>
      ) : linked ? (
        <>
          {linked.items.length > 0 ? rows(linked.items, linked.sectionLabels) : null}
          {linkedNote(linked.shownEarlier)}
        </>
      ) : (
        rows(
          list.map((entry) => ({ kind: "single", entry })),
          [label],
        )
      )}
    </section>
  );
  const urgencyLabels = ["Act now", "Waiting", "Targets running"] as const;
  const urgencyLinked = groupLinkedAlerts([actEntries, waitEntries, runningEntries]);
  const urgencyLink = (section: number) => ({
    items: urgencyLinked.sections[section] ?? [],
    shownEarlier: urgencyLinked.shownEarlier[section] ?? 0,
    sectionLabels: urgencyLabels,
  });
  const urgencyView = (
    <>
      {groupSection(
        "act",
        "Act now",
        actEntries,
        <GroupHead tone="danger" label="Act now" count={actEntries.length} />,
        "None firing now. The conditions checked are named in the header.",
        urgencyLink(0),
      )}
      {access.role === "coordinator" ? (
        <ForecastAlertsGroup
          now={now}
          className={styles.group}
          head={(count) => <GroupHead tone="warning" label="Forecast" count={count} aside="coordinators only" />}
        />
      ) : null}
      {groupSection(
        "wait",
        "Waiting",
        waitEntries,
        <GroupHead tone="warning" label="Waiting" count={waitEntries.length} />,
        "Nothing is waiting on a transport leg or a planned arrival.",
        urgencyLink(1),
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
            undefined,
            urgencyLink(2),
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
  const laneLists: [string, string, WfTone, QueueEntry[]][] = [
    ["act", "Act now", "danger", actEntries],
    ["wait", "Waiting", "warning", [...waitEntries, ...runningEntries]],
    ["snoozed", "Snoozed", "neutral", snoozedEntries],
  ];
  // Snoozed alerts are set aside on purpose, so only Act now and Waiting are grouped.
  const laneLinked = groupLinkedAlerts([actEntries, [...waitEntries, ...runningEntries]]);
  const cardFor = (entry: QueueEntry) => (
    <AlertCard key={entry.item.id} entry={entry} now={now} maxAge={maxAge} handlers={queueHandlers} />
  );
  const lanesView = (
    <div className={styles.lanes}>
      {laneLists.map(([key, label, tone, list], lane) => (
        <section
          key={key}
          className={styles.lane}
          aria-label={label}
          data-testid={key === "snoozed" && list.length > 0 ? "ward-alerts-snoozed" : undefined}
        >
          <GroupHead tone={tone} label={label} count={list.length} />
          {list.length > 0 ? (
            <>
              <ul className={styles.cards}>
                {lane < 2
                  ? linkedItems(laneLinked.sections[lane] ?? [], styles.cards, ["Act now", "Waiting"], cardFor)
                  : list.map(cardFor)}
              </ul>
              {lane < 2 ? linkedNote(laneLinked.shownEarlier[lane] ?? 0) : null}
            </>
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
      undefined,
      { items: groupLinkedAlerts([list]).sections[0] ?? [], shownEarlier: 0, sectionLabels: [owner] },
    );
  });
  const view: ArrangeBy = isPhone ? "urgency" : arrangeBy;

  const tabs = [
    { id: "now" as const, label: "Now", count: activeEntries.length },
    { id: "broadcast" as const, label: "Broadcast", count: (activeBroadcast ? 1 : 0) + livePullNows.length },
    { id: "notices" as const, label: "Notices", count: feedNotices.length },
    { id: "history" as const, label: "History", count: history.length },
  ];

  // Audit 1 (CS-15, Josh 20 Oct): an alert shown because it is first in line, not because somebody
  // chose it, says so above its actions.
  const selectedPanel = selected ? (
    <>
      {chosen ? null : (
        <p className={styles.confirmNote} data-testid="ward-alerts-first-in-line">
          First in line, not chosen yet. Check the name before you act.
        </p>
      )}
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
        actionDisabledReason={actionDisabledReason}
        releaseRef={releaseRef}
      />
    </>
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
        <AlertsHero
          isPhone={isPhone}
          heroTitle={heroTitle}
          openCount={openCount}
          runningText={runningText}
          oldestRaised={oldestRaised}
          now={now}
          live={live}
          actEntries={actEntries}
          waitEntries={waitEntries}
          pill={pill}
          togglePill={togglePill}
          yoursCount={yoursCount}
          handleNext={handleNext}
          broadcastTriggerRef={broadcastTriggerRef}
          openComposer={openComposer}
          broadcastDisabledReason={broadcastDisabledReason}
          activeBroadcast={activeBroadcast}
          setTab={setTab}
          directiveTone={directiveTone}
          broadcastAcks={broadcastAcks}
          phoneToday={phoneToday}
          setPhoneToday={setPhoneToday}
          todayChart={todayChart}
          notifyOn={notifyOn}
          handleNotify={handleNotify}
          nextQueue={nextQueue}
          handleCopy={handleCopy}
          checkingFoot={checkingFoot}
        />

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
                  ) : (
                    <>
                      {view === "lanes" ? lanesView : view === "owner" ? ownerView : urgencyView}
                      <p className={styles.orderNote} data-testid="ward-alerts-order-note">
                        {alertsOrderLine(view)}
                      </p>
                    </>
                  )}
                </TabPanel>
              ) : null}

              {tab === "broadcast" ? (
                <AlertsBroadcastPanel
                  livePullNows={livePullNows}
                  handleStandDown={handleStandDown}
                  activeBroadcast={activeBroadcast}
                  directiveTone={directiveTone}
                  severityLabel={severityLabel}
                  broadcastAcks={broadcastAcks}
                  units={units}
                  now={now}
                  track={track}
                  raise={raise}
                  pastBroadcasts={pastBroadcasts}
                  movements={movements}
                />
              ) : null}

              {tab === "notices" ? (
                <AlertsNoticesPanel feedNotices={feedNotices} now={now} umrnLookup={umrnLookup} />
              ) : null}

              {tab === "history" ? <AlertsHistoryPanel history={history} now={now} /> : null}
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
          <BroadcastComposer
            modalRef={modalRef}
            handleCloseBroadcastModal={handleCloseBroadcastModal}
            modalCloseRef={modalCloseRef}
            broadcastRefused={broadcastRefused}
            broadcastFeedback={broadcastFeedback}
            selectedTemplateId={selectedTemplateId}
            handleSelectTemplate={handleSelectTemplate}
            broadcastType={broadcastType}
            setBroadcastType={setBroadcastType}
            broadcastSeverity={broadcastSeverity}
            setBroadcastSeverity={setBroadcastSeverity}
            broadcastDurationMinutes={broadcastDurationMinutes}
            setBroadcastDurationMinutes={setBroadcastDurationMinutes}
            broadcastScope={broadcastScope}
            setBroadcastScope={setBroadcastScope}
            units={units}
            broadcastTitle={broadcastTitle}
            setBroadcastTitle={setBroadcastTitle}
            broadcastMessage={broadcastMessage}
            setBroadcastMessage={setBroadcastMessage}
            severityLabel={severityLabel}
            broadcastConfirmed={broadcastConfirmed}
            setBroadcastConfirmed={setBroadcastConfirmed}
            broadcastRequest={broadcastRequest}
            broadcastResult={broadcastResult}
            handleDispatchBroadcast={handleDispatchBroadcast}
          />
        )}
      </main>
      <WardPrototypeFooter testId="ward-alerts-governance" />
    </div>
  );
}
