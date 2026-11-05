"use client";

import { useWardFormSave } from "../use-ward-form-save";
import { useAlertCommandFeedback, type TrackAlertCommand } from "./use-alert-command-feedback";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { accessPlaceLabel } from "@/components/ward-management/shell/ward-access-labels";
import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { AlarmClock } from "lucide-react";
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
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
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
  admissionIdOfInboxId,
  raisedAt,
  resolveAlertSubject,
  shownAgeFrom,
  type AlertKind,
  alertsNowFigures,
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
import { TodayBand } from "./alerts-today-band";
import { todayMarks } from "./alerts-today-marks";
import { ArrangeSwitch, type ArrangeBy } from "./alerts-view-switch";
import homeStyles from "@/components/ward-management/coordinator/home-list.module.css";
import { alertChecks } from "./alerts-checks";
import { useAlertsHistory } from "./alerts-history";
import { AlertsHero } from "./alerts-hero";
import { AcceptedPullRows, useAcceptedPull } from "@/components/ward-management/coordinator/accepted-pull-rows";
import { AlertPullPhoneRows } from "./alerts-pull-phone-rows";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { groupSameKind, KindGroup } from "./alerts-queue-groups";
import { PhoneOwnerMenu } from "./alerts-phone-owner";
import { AlertsSidePanelEmpty, CheckingList, ChecksCard, ChecksChip, ownWardName } from "./alerts-checking";
import {
  AlertsBroadcastsPanel,
  AlertsClearedPanel,
  AlertsLiveBroadcasts,
  AlertsNoticesGroup,
  useDueReminderCount,
} from "./alerts-tab-panels";
import {
  AlertsViewTabs,
  FeedbackLine,
  FilteredEmpty,
  HighlightNote,
  OpenFilters,
  TodayPhoneCard,
  handoverText,
  useAlertsHashTab,
  useOpenFilter,
  type AlertsTab,
} from "./alerts-log-filters";
import { useForecastAlerts } from "@/components/ward-management/forecast/use-forecast-model";
import log from "./alerts-log.module.css";
import { BroadcastComposer } from "./broadcast-composer";
import { QUICK_STARTS } from "./broadcast-audience";
import { liveBedCallFor, useBroadcastAudience } from "./use-broadcast-audience";

import { ForecastAlertsGroup } from "@/components/ward-management/forecast/forecast-alerts-group";
import styles from "./alerts.module.css";
import parts from "./alerts-screen-parts.module.css";
import {
  Card,
  Drawer,
  PhoneSheet,
  StatusGlyph,
  TabPanel,
  useIsPhone,
  type WfTone,
  useIsTabletPortrait,
  useModalFocus,
} from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

/** Alerts addressed to the current role. Highlights never hide rows.
 * Checking names examined conditions and limits; an empty queue must not claim "all clear".
 */

export { extractOverdue } from "./alerts-model";

const COORDINATOR = WARD_FLOW_ROLE_LABELS.coordinator;

type ActionRequest = Parameters<TrackAlertCommand>[0];

export function AlertsScreen() {
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  return <AlertsWorkspace key={worldGeneration} />;
}

function AlertsWorkspace() {
  usePrintableDisclosures();
  const access = useEffectiveWardAccess();
  const deskRole = access.role === "admin" ? "executive" : access.role;
  const deskRoleLabel = access.role === "admin" ? ACCESS_ROLE_LABELS.admin : WARD_FLOW_ROLE_LABELS[deskRole];
  const coordDesk = access.role === "coordinator";
  const actionDisabledReason = coordDesk ? undefined : "Only the coordinator can change alerts.";
  const broadcastDisabledReason = // coordinator or site bed manager (`EVENT_ROLE.DISPATCH_BROADCAST_ALERT`)
    coordDesk || access.role === "bed_manager"
      ? undefined
      : "Only the coordinator or a site bed manager can broadcast.";

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
    "bedReleases",
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
  const wardName = ownWardName(access, units);
  // Events carry the engine clock; what the page shows follows the Live chip, which can pause.
  const clockNow = useWardFlowClock();
  const raise = useWardRaise(deskRole);
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
  // Every row this screen covers; snoozed ones come back when their time passes (stream A). L1: the
  // one task list the Tasks badge reads (`taskItems`), so "Now" and the badge agree.
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
  // Q181, AL2: unread notices sit in Open; read ones in Cleared.
  const unreadNotices = feedNotices.filter((notice) => notice.readAt === undefined);
  const readNotices = feedNotices.filter((notice) => notice.readAt !== undefined);
  // Where this desk is, in words, for the hero eyebrow and the empty state.
  const deskPlace = accessPlaceLabel(access, units);
  function openLiveBroadcast() {
    setTab("broadcasts");
    window.requestAnimationFrame(() =>
      document.getElementById("alerts-live-broadcast")?.scrollIntoView({ block: "nearest" }),
    );
  }

  const [tab, setTab] = useState<AlertsTab>("now");
  useAlertsHashTab(setTab);
  const [arrangeBy, setArrangeBy] = useState<ArrangeBy>("urgency");
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

  // Alerts redesign (1 Nov 2026): the composer opens on Ask wards for beds, Adult beds today.
  const defaultTmpl =
    WA_BROADCAST_TEMPLATES.find((tmpl) => tmpl.id === QUICK_STARTS.bed_call[0]) ?? WA_BROADCAST_TEMPLATES[0];
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
  const audienceState = useBroadcastAudience(
    state,
    {
      templateId: defaultTmpl?.id ?? "custom",
      scope: defaultTmpl?.targetScope ?? "all",
    },
    broadcastType === "bed_call",
  );
  const { audience: broadcastAudience, setAudience: setBroadcastAudience } = audienceState;
  const [broadcastSuccessNotice, setBroadcastSuccessNotice] = useState<string | null>(null);
  const actionFeedback = useAlertCommandFeedback();
  const [broadcastRequest, setBroadcastRequest] = useState<{
    type: "DISPATCH_BROADCAST_ALERT" | "STAND_DOWN_BROADCAST_ALERT";
    title: string;
    scope: BroadcastTargetScope;
    scopeLabel: string;
  } | null>(null);
  const broadcastSave = useWardFormSave("alerts-broadcast");
  const { forget: forgetBroadcast } = broadcastSave;
  const [broadcastResult, setBroadcastResult] = useState<{ accepted: boolean }>();
  const broadcastAccepted = broadcastResult?.accepted === true;
  const broadcastRefused = !!broadcastSave.error;
  const isBroadcastModalOpen =
    broadcastModalOpen && !(broadcastAccepted && broadcastRequest?.type === "DISPATCH_BROADCAST_ALERT");

  // ONE draft of the WHOLE broadcast form, cached and restored together, so any edit is protected.
  // A restored draft reopens the composer, because a draft is only cached while it is open.
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
      audience: broadcastAudience,
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
      broadcastAudience,
    ],
  );
  const restoreBroadcastDraft = useCallback(
    (raw: string) => {
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
      if (draft.audience) setBroadcastAudience(draft.audience);
      setBroadcastModalOpen(true);
    },
    [
      setBroadcastAudience,
      setBroadcastTitle,
      setBroadcastMessage,
      setBroadcastSeverity,
      setBroadcastDurationMinutes,
      setBroadcastModalOpen,
    ],
  );
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
    broadcastSave.error?.startsWith("Not recorded:") && broadcastRequest?.type === "DISPATCH_BROADCAST_ALERT"
      ? `Broadcast was not accepted. Your draft has been kept. ${broadcastSave.error}`
      : (broadcastSave.error ??
        (broadcastRequest && broadcastResult
          ? broadcastRequest.type === "STAND_DOWN_BROADCAST_ALERT"
            ? broadcastRequest.scope === "all"
              ? "Statewide broadcast directive stood down."
              : `Broadcast directive stood down for ${broadcastRequest.scopeLabel}.`
            : broadcastRequest.scope === "all"
              ? `Broadcast Directive "${broadcastRequest.title}" shown in this prototype only; no external notifications are sent. Target: ${broadcastRequest.scopeLabel}.`
              : `Broadcast Directive "${broadcastRequest.title}" shown in this prototype for ${broadcastRequest.scopeLabel} only; no external notifications are sent.`
          : (actionFeedback.result?.message ?? broadcastSuccessNotice)));
  const feedbackRefused = broadcastRefused || (!!actionFeedback.result?.refused && !broadcastRequest);

  const activeBroadcast = getActiveBroadcastAlert(broadcastAlerts ?? [], now);
  const deskInScope = useDeskInScope();
  const broadcastBoard =
    activeBroadcast && broadcastKind(activeBroadcast) !== "directive" ? replyBoard(activeBroadcast, units) : undefined;
  const allAcks = !activeBroadcast
    ? undefined
    : broadcastBoard
      ? { acknowledged: broadcastBoard.answered, of: broadcastBoard.rows.length }
      : directiveAcknowledgements(activeBroadcast, units, deskInScope);
  const broadcastAcks = allAcks && (allAcks.of > 0 || !deskInScope) ? allAcks : undefined;
  const livePullNows = (broadcastAlerts ?? []).filter(
    (alert) => broadcastKind(alert) === "pull_now" && isAlertLive(alert, movements, now),
  );

  const modalRef = useRef<HTMLDivElement | null>(null);
  const broadcastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);

  const handleCloseBroadcastModal = useCallback(() => {
    forgetBroadcast();
    setBroadcastModalOpen(false);
  }, [setBroadcastModalOpen, forgetBroadcast]);

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
      const recorded = effectiveOwner(item, inboxOwnership[item.id]);
      // #801: only the coordinator takes alerts, so other desks see its rows by its desk name, never "You".
      const owner = recorded === COORDINATOR && !coordDesk ? CHROME_ROLE_LABELS.coordinator : recorded;
      return {
        item,
        movement,
        subject,
        group: alertGroupOf(item),
        owner,
        mine: coordDesk && recorded === COORDINATOR,
        raised: raisedAt(item, movement),
        seen: inboxAcknowledgements[item.id]?.at(-1),
        ownedSince: currentInboxOwner(inboxOwnership[item.id], item.since)?.at,
        snooze: snoozed ? activeSnooze(inboxSnoozes[item.id], now, item.since) : undefined,
        action: alertActionFor(item, subject),
      };
    },
    [movements, admissions, umrnLookup, units, inboxOwnership, inboxAcknowledgements, inboxSnoozes, now, coordDesk],
  );
  const isHighlighted = useCallback(
    (entry: Omit<QueueEntry, "highlighted">) =>
      (ownerHighlight !== null && entry.owner === ownerHighlight) ||
      (watchHighlight !== null && alertKindOf(entry.item.id) === watchHighlight),
    [ownerHighlight, watchHighlight],
  );
  const highlightOn = ownerHighlight !== null || watchHighlight !== null;
  const toEntries = useCallback(
    (items: InboxItem[], snoozed: boolean): QueueEntry[] =>
      items
        .map((item) => entryFor(item, snoozed))
        .map((entry) => {
          const highlighted = isHighlighted(entry);
          // Safety rule 2 (Alerts redesign, 1 Nov 2026): a highlight never dims an act-now row.
          return { ...entry, highlighted, dimmed: highlightOn && !highlighted && entry.group !== "act" };
        })
        .sort((a, b) => byOldest({ at: a.raised }, { at: b.raised })),
    [entryFor, isHighlighted, highlightOn],
  );
  const activeEntries = useMemo(() => toEntries(inbox, false), [toEntries, inbox]);
  const snoozedEntries = useMemo(() => toEntries(snoozedInbox, true), [toEntries, snoozedInbox]);
  const oldestRaised = useMemo(() => {
    // A passed legal form adds no age: its time reads as typed (D-93).
    const times = activeEntries.flatMap((entry) => {
      const from = entry.group === "running" ? undefined : shownAgeFrom(entry.item, entry.raised);
      return from === undefined ? [] : [from];
    });
    return times.length > 0 ? Math.min(...times) : undefined;
  }, [activeEntries]);
  const actEntries = activeEntries.filter((entry) => entry.group === "act");
  const waitEntries = activeEntries.filter((entry) => entry.group === "wait");
  const runningEntries = activeEntries.filter((entry) => entry.group === "running");
  const allEntries = useMemo(() => [...activeEntries, ...snoozedEntries], [activeEntries, snoozedEntries]);
  const countedActive = useMemo(() => activeEntries.filter((entry) => entry.group !== "running"), [activeEntries]);
  const yoursCount = countedActive.filter((entry) => entry.mine).length;
  // Q111 (Josh, 1 Nov 2026): a ward's acceptance with no bed pulled is act now, coordinator's desk only.
  const toPull = useMemo(
    () => (coordDesk ? acceptedReferralsAwaitingPull(referrals, units, movements) : []),
    [coordDesk, referrals, units, movements],
  );
  const { actNow: actCount, outstanding } = alertsNowFigures(inbox, toPull.length); // Q260: as the bell and Menu
  const pull = useAcceptedPull();
  const pullRows =
    toPull.length === 0 ? null : isPhone ? (
      // Visual review: on a phone these rows take the act-now alert row's layout and its action.
      <AlertPullPhoneRows
        toPull={toPull}
        now={now}
        testId="ward-alerts-accepted-to-pull"
        pulling={pull.pulling}
        setPulling={pull.setPulling}
      />
    ) : (
      <AcceptedPullRows
        toPull={toPull}
        now={now}
        phone={false}
        testId="ward-alerts-accepted-to-pull"
        pulling={pull.pulling}
        setPulling={pull.setPulling}
      />
    );
  const highlightedCount = allEntries.filter((entry) => entry.highlighted).length;
  const anyHighlight = highlightOn;
  const maxAge = Math.max(
    1,
    ...allEntries.map((entry) => {
      const from = shownAgeFrom(entry.item, entry.raised);
      return from === undefined ? 0 : now - from;
    }),
  );
  const owners = useMemo(() => {
    const names = [...new Set(allEntries.map((entry) => entry.owner))];
    return names.sort((a, b) => (a === COORDINATOR ? -1 : b === COORDINATOR ? 1 : a.localeCompare(b)));
  }, [allEntries]);
  // The owners a highlight can pick, never a blank one. The transport officer has none (only the
  // coordinator takes an alert).
  const namedOwners = access.role === "officer" ? [] : owners.filter(Boolean);
  // Nurse in charge: a quiet ward gets one line, not two empty groups and a sort rule over nothing.
  const quietWard = wardName !== undefined && allEntries.length === 0;
  // AL2: the Open view's filters, each counted as its group's heading counts it.
  const forecastDesk = access.role === "coordinator" || access.role === "bed_manager";
  const forecastCount = useForecastAlerts(now).length;
  const dueReminders = useDueReminderCount(now);
  const lens = useOpenFilter(quietWard, {
    act: actCount,
    wait: waitEntries.length,
    forecast: forecastDesk ? forecastCount : undefined,
    reminders: dueReminders,
    notices: unreadNotices.length,
    snoozed: snoozedEntries.length,
    // The Yours chip counts every row its filter shows: running and snoozed rows and beds to pull too.
    yours: coordDesk ? allEntries.filter((entry) => entry.mine).length + toPull.length : undefined,
  });

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

  const chosen = allEntries.find((entry) => entry.item.id === chosenId);
  // On the desktop the panel always shows an alert: the chosen one, else the first in line.
  const selected = chosen ?? (slideOver ? undefined : (nextQueue[0] ?? allEntries[0]));

  const select = useCallback(
    (entry: QueueEntry, options: { release?: boolean } = {}) => {
      setChosenId(entry.item.id);
      if (slideOver) setSheetOpen(true);
      if (options.release) setReleaseRequest((count) => count + 1);
    },
    [slideOver, setSheetOpen],
  );

  // Change 7 (D-77): `?alert=<id>&release=1` chooses the alert and focuses its release reason. Read
  // from the router, so each new address is used once, during render.
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
    lens.setFilter("all");
    select(next);
    const row = document.querySelector<HTMLElement>(`[data-alert-id="${CSS.escape(next.item.id)}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  };
  const track: TrackAlertCommand = (request: ActionRequest, record) => {
    setBroadcastRequest(null);
    setBroadcastSuccessNotice(null);
    return actionFeedback.track(request, record);
  };
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
      track(
        {
          type: "TAKE_INBOX_ITEM_OWNERSHIP",
          ok: `You own "${item.title}" for ${nameOf(item)}.`,
          refused: "Take was not accepted.",
        },
        () => dispatch({ type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now: clockNow, inboxItemId: item.id }),
      );
    },
    onAcknowledge: (item) => {
      if (actionDisabledReason) return;
      setChosenId(item.id);
      track(
        {
          type: "ACKNOWLEDGE_INBOX_ITEM",
          ok: `"${item.title}" acknowledged and kept on watch.`,
          refused: "Acknowledge was not accepted.",
        },
        () => dispatch({ type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now: clockNow, inboxItemId: item.id }),
      );
    },
    onSnooze: (item, until, reason) => {
      if (actionDisabledReason) return;
      // Say "snoozed" only for a snooze the reducer accepts: the same cap it enforces.
      if (!isSnoozeReason(reason) || !snoozeAllowed(until, clockNow, inboxItemIsActNow(item.id))) return;
      setChosenId(item.id);
      track(
        {
          type: "SNOOZE_INBOX_ITEM",
          ok: `"${item.title}" snoozed until ${formatInstantWithDay(until, clockNow)}.`,
          refused: "Snooze was not accepted.",
        },
        () =>
          dispatch({
            type: "SNOOZE_INBOX_ITEM",
            role: "coordinator",
            now: clockNow,
            inboxItemId: item.id,
            until,
            reason,
          }),
      );
    },
    onReturn: (item) => {
      if (actionDisabledReason) return;
      track(
        {
          type: "UNSNOOZE_INBOX_ITEM",
          ok: `"${item.title}" is back on the queue.`,
          refused: "Return was not accepted.",
        },
        () => dispatch({ type: "UNSNOOZE_INBOX_ITEM", role: "coordinator", now: clockNow, inboxItemId: item.id }),
      );
    },
    onRelease: (item, reason: ReleasePullReason) => {
      if (actionDisabledReason) return;
      if (!item.movementId) return;
      track(
        {
          type: "RELEASE_PULL",
          ok: `Bed released for ${nameOf(item)}. The ward has a notice.`,
          refused: "Release was not accepted. The bed is still pulled.",
        },
        () =>
          dispatch({ type: "RELEASE_PULL", role: "coordinator", now: clockNow, movementId: item.movementId, reason }),
      );
    },
    onEscalate: (item) => {
      if (actionDisabledReason) return;
      setChosenId(item.id);
      const movement = movements.find((candidate: Movement) => candidate.id === item.movementId);
      if (item.movementId && escalationAppliesTo(item, movement, units, now)) {
        track(
          {
            type: "RECORD_ESCALATION",
            ok: `Escalated "${item.title}" for ${nameOf(item)} to ${ESCALATION_CONTACTS[0]}.`,
            refused: "Escalation was not accepted.",
          },
          () =>
            raise("RECORD_ESCALATION", {
              movementId: item.movementId,
              triedUnitIds: movement?.declines.map((decline) => decline.unitId) ?? [],
              contact: ESCALATION_CONTACTS[0],
            }),
        );
      }
      // An alert with no movement, or not about a bed search, has nothing to escalate: the button is disabled, so no notice is made.
    },
  };
  const queueHandlers: QueueHandlers = {
    selectedId: selected?.item.id,
    firstInLineId: nextQueue[0]?.item.id,
    onSelect: (entry) => select(entry),
    onRelease: (entry) => select(entry, { release: true }),
    onReturn: (entry) => detailHandlers.onReturn(entry.item),
  };

  const checks = alertChecks({ allInbox, openMovements, referrals, movements, now });

  // ---- History: what this session recorded, newest first ----
  const history = useAlertsHistory({
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
  });

  // ---- Broadcast ----
  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    setBroadcastConfirmed(false);
    const base = broadcastDraftBaseline(tmplId);
    audienceState.resetFor(base.templateId, base.scope);
    if (tmplId === "custom") {
      setBroadcastTitle(base.title);
      setBroadcastMessage(base.message);
      setBroadcastSeverity(base.severity);
      setBroadcastCategory(base.category);
      setBroadcastScope(base.scope);
      setBroadcastDurationMinutes(base.durationMinutes);
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
    if (broadcastSave.pending) return;
    if (audienceState.recipients.length === 0) return;
    // Alerts redesign (1 Nov 2026): Everyone, the groups chosen or the units ticked.
    const { targetScope, targetScopeLabel } = audienceState.target;

    setBroadcastSuccessNotice(null);
    actionFeedback.clear();
    setBroadcastRequest({
      type: "DISPATCH_BROADCAST_ALERT",
      title: broadcastTitle.trim(),
      scope: targetScope,
      scopeLabel: targetScopeLabel,
    });
    setBroadcastResult(undefined);
    // The new directive shows at the top of Broadcasts, where it can be stood down (Q181, AL2).
    openLiveBroadcast();
    broadcastSave.submit(
      () =>
        dispatch({
          type: "DISPATCH_BROADCAST_ALERT",
          role: deskRole,
          now: clockNow,
          title: broadcastTitle,
          message: broadcastMessage,
          severity: broadcastSeverity,
          category: broadcastCategory,
          ...audienceState.target,
          durationMinutes: broadcastDurationMinutes,
          dispatchedByName: coordDesk ? "State Mental Health Bed Desk Coordinator" : deskRoleLabel,
          kind: broadcastType === "bed_call" ? "bed_call" : "directive",
        }),
      () => {
        setBroadcastResult({ accepted: true });
        setBroadcastModalOpen(false);
      },
    );
  };

  const handleStandDown = (alertId: string) => {
    if (broadcastSave.pending) return;
    const alert = broadcastAlerts?.find((entry) => entry.id === alertId);
    setBroadcastSuccessNotice(null);
    actionFeedback.clear();
    setBroadcastRequest({
      type: "STAND_DOWN_BROADCAST_ALERT",
      title: alert?.title ?? "Directive",
      scope: alert?.targetScope ?? "all",
      scopeLabel: alert?.targetScopeLabel ?? "the selected scope",
    });
    setBroadcastResult(undefined);
    broadcastSave.submit(
      () =>
        dispatch({
          type: "STAND_DOWN_BROADCAST_ALERT",
          role: deskRole,
          now: clockNow,
          alertId,
          stoodDownByRole: deskRole,
        }),
      () => setBroadcastResult({ accepted: true }),
    );
  };

  const openComposer = (trigger: HTMLButtonElement) => {
    broadcastTriggerRef.current = trigger;
    broadcastSave.forget();
    setBroadcastResult(undefined);
    setBroadcastRequest(null);
    actionFeedback.clear();
    setBroadcastSuccessNotice(null);
    setBroadcastConfirmed(false);
    setBroadcastModalOpen(true);
  };

  const handleNotify = () => {
    setBroadcastRequest(null);
    actionFeedback.clear();
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
    actionFeedback.clear();
    const text = handoverText(
      [
        ["Act now", actEntries],
        ["Waiting", waitEntries],
        ["Snoozed", snoozedEntries],
      ],
      activeBroadcast,
      now,
    );
    copyTextToClipboard(text).then(
      () => setBroadcastSuccessNotice(`Copied ${allEntries.length} alerts for handover.`),
      () => setBroadcastSuccessNotice("Copy was blocked by the browser."),
    );
  };

  const clearHighlights = () => {
    setOwnerHighlight(null);
    setWatchHighlight(null);
  };

  const directiveTone: WfTone =
    activeBroadcast?.severity === "critical" ? "danger" : activeBroadcast?.severity === "warning" ? "warning" : "info";
  const pastBroadcasts = (broadcastAlerts ?? []).filter(
    (alert) => alert.id !== activeBroadcast?.id && !livePullNows.includes(alert),
  );
  const rowFor = (entry: QueueEntry) =>
    isPhone ? (
      <AlertPhoneRow key={entry.item.id} entry={entry} now={now} handlers={queueHandlers} />
    ) : (
      <AlertRow key={entry.item.id} entry={entry} now={now} maxAge={maxAge} handlers={queueHandlers} />
    );
  // Closing-the-loop (package E): alerts naming one record show as one grouped item. Recorded order,
  // no re-sorting; every alert keeps its own row inside the item. See `alert-linked-groups.ts`.
  // Alerts redesign (point 17): runs of one recorded kind also show as one group row.
  const linkedItems = (
    items: LinkedQueueItem<QueueEntry>[],
    listClassName: string,
    sectionLabels: readonly string[],
    renderEntry: (entry: QueueEntry) => ReactNode,
  ) =>
    groupSameKind(items).map((queued) =>
      queued.kind === "single" ? (
        renderEntry(queued.entry)
      ) : queued.kind === "kind" ? (
        <KindGroup key={queued.key} group={queued} now={now} listClassName={listClassName} renderEntry={renderEntry} />
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
        {count === 1 ? "1 alert here is" : `${count} alerts here are`} shown earlier, with its record.
      </p>
    ) : null;
  const rows = (items: LinkedQueueItem<QueueEntry>[], sectionLabels: readonly string[]) => {
    const listClassName = isPhone ? styles.phoneRows : homeStyles.hrows;
    return <ul className={listClassName}>{linkedItems(items, listClassName, sectionLabels, rowFor)}</ul>;
  };
  const groupSection = (
    key: string,
    label: string,
    list: QueueEntry[],
    head: ReactNode,
    empty?: string,
    linked?: { items: LinkedQueueItem<QueueEntry>[]; shownEarlier: number; sectionLabels: readonly string[] },
    lead?: ReactNode,
  ) => (
    <section
      key={key}
      className={styles.group}
      aria-label={label}
      data-testid={key === "snoozed" ? "ward-alerts-snoozed" : undefined}
    >
      {head}
      {lead}
      {list.length === 0 ? (
        lead ? null : (
          <p className={styles.groupEmpty}>{empty}</p>
        )
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
  const nothingNeedsYou = (
    <div className={styles.nothingEmpty} data-testid="ward-alerts-nothing">
      <StatusGlyph tone="success" size={16} />
      <strong>{wardName !== undefined ? "Nothing in the network queue" : "Nothing needs you"}</strong>
      <span>
        {wardName !== undefined ? (
          <>No late or blocked network alerts for {deskPlace}. Your ward&apos;s tasks stay on My ward.</>
        ) : (
          <>Nothing is late or blocked for {deskPlace}. You&apos;ll be told when that changes.</>
        )}
      </span>
    </div>
  );
  const urgencyLabels = ["Act now", "Waiting", "Targets running"] as const;
  const snoozedAct = snoozedEntries.filter((entry) => entry.group === "act");
  const filtered = lens.filter !== "all";
  const actListed = lens.pick([...actEntries, ...snoozedAct]);
  const [waitShown, runningShown, snoozedShown] = [waitEntries, runningEntries, snoozedEntries].map(lens.pick);
  const pullShown = lens.shows("act") ? toPull.length : 0;
  const actHead = lens.filter === "yours" ? actListed.filter((entry) => !entry.snooze).length + pullShown : actCount;
  const showsGroup = (key: string, count: number) => lens.shows(key) && (!filtered || count > 0);
  const filteredNothing =
    filtered &&
    actListed.length + pullShown + waitShown.length + runningShown.length + snoozedShown.length === 0 &&
    (!lens.shows("forecast") || forecastCount === 0) &&
    (!lens.shows("reminders") || dueReminders === 0) &&
    (!lens.shows("notices") || unreadNotices.length === 0);
  const urgencyLinked = groupLinkedAlerts([actListed, waitShown, runningShown]);
  const urgencyLink = (section: number) => ({
    items: urgencyLinked.sections[section] ?? [],
    shownEarlier: urgencyLinked.shownEarlier[section] ?? 0,
    sectionLabels: urgencyLabels,
  });
  // Q179 no: two groups; one line only when both are empty and none of your reminders is due.
  const nothingNow =
    !filtered && actEntries.length + snoozedAct.length + toPull.length + waitEntries.length + dueReminders === 0;
  const urgencyView = quietWard ? (
    dueReminders === 0 && nothingNeedsYou
  ) : (
    <>
      {nothingNow
        ? nothingNeedsYou
        : showsGroup("act", actListed.length + pullShown)
          ? groupSection(
              "act",
              "Act now",
              actListed,
              <GroupHead tone="danger" label="Act now" count={actHead} aside="needs a person now" />,
              "Nothing to act on now.",
              urgencyLink(0),
              pullRows,
            )
          : null}
      {forecastDesk && lens.shows("forecast") ? (
        <ForecastAlertsGroup
          now={now}
          className={styles.group}
          readOnly={access.role === "bed_manager"}
          head={(count) => <GroupHead tone="warning" label="Forecast" count={count} />}
        />
      ) : null}
      {nothingNow || !showsGroup("wait", waitShown.length)
        ? null
        : groupSection(
            "wait",
            "Waiting",
            waitShown,
            <GroupHead tone="warning" label="Waiting" count={waitShown.length} aside="oldest first" />,
            "Nothing is waiting on a transport leg or a planned arrival.",
            urgencyLink(1),
          )}
      {runningShown.length > 0 && lens.shows("running")
        ? groupSection(
            "running",
            "Targets running",
            runningShown,
            <GroupHead
              tone="neutral"
              label="Targets running"
              count={runningShown.length}
              aside="listed, not counted"
            />,
            undefined,
            urgencyLink(2),
          )
        : null}
      {snoozedShown.length > 0 && lens.shows("snoozed")
        ? groupSection(
            "snoozed",
            "Snoozed",
            snoozedShown,
            <GroupHead
              icon={<AlarmClock size={14} aria-hidden="true" />}
              label="Snoozed"
              count={snoozedShown.length}
              aside="back when due"
            />,
          )
        : null}
    </>
  );
  const laneLists: [string, string, WfTone, QueueEntry[]][] = [
    ["act", "Act now", "danger", actListed],
    ["wait", "Waiting", "warning", [...waitShown, ...runningShown]],
    ["snoozed", "Snoozed", "neutral", snoozedShown],
  ];
  // Snoozed alerts are set aside on purpose, so only Act now and Waiting are grouped.
  const laneLinked = groupLinkedAlerts([actListed, [...waitShown, ...runningShown]]);
  const cardFor = (entry: QueueEntry) => (
    <AlertCard key={entry.item.id} entry={entry} now={now} maxAge={maxAge} handlers={queueHandlers} />
  );
  // Lanes (Alerts redesign): the third lane holds Forecast, then Snoozed under it.
  const forecastLane =
    forecastDesk && !filtered ? (
      <ForecastAlertsGroup
        now={now}
        readOnly={access.role === "bed_manager"}
        head={(count) => <GroupHead tone="warning" label="Forecast" count={count} aside="tomorrow" />}
      />
    ) : null;
  const lanesView = (
    <div className={filtered ? `${styles.lanes} ${log.lanesFiltered}` : styles.lanes}>
      {laneLists.map(([key, label, tone, list], lane) =>
        filtered && !showsGroup(key, list.length + (key === "act" ? pullShown : 0)) ? null : (
          // Forecast sits above Snoozed in the third lane as its own region, never inside Snoozed.
          <div key={key} className={styles.lane}>
            {key === "snoozed" ? forecastLane : null}
            <section
              className={parts.laneSection}
              aria-label={label}
              data-testid={key === "snoozed" && list.length > 0 ? "ward-alerts-snoozed" : undefined}
            >
              <GroupHead
                tone={tone}
                label={label}
                count={key === "act" ? actHead : list.length}
                aside={key === "act" ? "most urgent first" : key === "wait" ? "oldest first" : undefined}
              />
              {key === "act" && pullShown > 0 ? pullRows : null}
              {list.length > 0 ? (
                <>
                  <ul className={styles.cards}>
                    {lane < 2
                      ? linkedItems(laneLinked.sections[lane] ?? [], styles.cards, ["Act now", "Waiting"], cardFor)
                      : list.map(cardFor)}
                  </ul>
                  {lane < 2 ? linkedNote(laneLinked.shownEarlier[lane] ?? 0) : null}
                </>
              ) : key === "act" && pullRows ? null : (
                <p className={styles.groupEmpty}>
                  {key === "snoozed"
                    ? "A snoozed alert waits here and returns at its time. A snoozed act-now alert also stays listed in Act now."
                    : "None now"}
                </p>
              )}
            </section>
          </div>
        ),
      )}
    </div>
  );
  const ownerView = owners.map((owner) => {
    // Safety rule 3: act now first inside each owner, then the rest in their recorded order.
    const list = lens
      .pick(allEntries.filter((entry) => entry.owner === owner))
      .sort((a, b) => (a.group === "act" ? 0 : 1) - (b.group === "act" ? 0 : 1));
    const yours = ownerShort(owner, coordDesk) === "You";
    const pulls = yours ? pullShown : 0;
    if (filtered && list.length + pulls === 0) return null;
    // A snoozed act-now alert stays listed but is not counted as act now (review on #1238).
    const ownerAct = list.filter((e) => e.group === "act" && !e.snooze).length + pulls;
    return groupSection(
      `owner-${owner}`,
      owner,
      list,
      <GroupHead
        tone={ownerAct > 0 ? "danger" : undefined}
        icon={ownerAct > 0 ? undefined : <span aria-hidden="true" />}
        label={yours ? `You, ${owner}` : owner}
        count={list.length + pulls}
        aside={ownerAct > 0 ? `${ownerAct} act now` : undefined}
      />,
      undefined,
      { items: groupLinkedAlerts([list]).sections[0] ?? [], shownEarlier: 0, sectionLabels: [owner] },
      pulls > 0 ? pullRows : undefined,
    );
  });
  // Forecast, reminders and notices are not in Lanes or Owner, so their filters show the Urgency list.
  const view: ArrangeBy = isPhone || ["forecast", "reminders", "notices"].includes(lens.filter) ? "urgency" : arrangeBy;

  const liveBroadcasts = (
    <AlertsLiveBroadcasts
      livePullNows={livePullNows}
      handleStandDown={handleStandDown}
      activeBroadcast={activeBroadcast}
      broadcastAcks={broadcastAcks}
      units={units}
      now={now}
      track={track}
      raise={raise}
      deskRole={deskRole}
      onCopyAnswers={(text) =>
        copyTextToClipboard(text).then(
          () => setBroadcastSuccessNotice("Copied the answers."),
          () => setBroadcastSuccessNotice("Copy was blocked by the browser."),
        )
      }
    />
  );
  const noticesGroup = (
    <AlertsNoticesGroup
      notices={unreadNotices}
      now={now}
      umrnLookup={umrnLookup}
      showReminders={lens.shows("reminders")}
      showNotices={lens.shows("notices")}
    />
  );
  // AL2 (Josh, 3 Nov 2026): Open counts what the headline counts; Cleared has no count; Broadcasts
  // counts what is live, and shows only on a desk that has a broadcast or can send one.
  const liveCount = livePullNows.length + (activeBroadcast ? 1 : 0);
  const showBroadcasts = !broadcastDisabledReason || (broadcastAlerts ?? []).length > 0;
  const tabs = [
    { id: "now" as const, label: "Open", count: outstanding },
    { id: "earlier" as const, label: "Cleared", count: 0 },
    ...(showBroadcasts ? [{ id: "broadcasts" as const, label: "Broadcasts", count: liveCount }] : []),
  ];
  const shownTab: AlertsTab = tab === "broadcasts" && !showBroadcasts ? "now" : tab;

  // Josh review (4 Nov 2026): the panel opens on the patient header. The CS-15 "First in line, not
  // chosen yet" line above it is gone; the row stays marked in the list.
  const selectedPanel = selected ? (
    <>
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

  const today = todayMarks(allEntries, history, broadcastAlerts ?? [], now);
  const pickToday = (id: string) => {
    const entry = allEntries.find((candidate) => candidate.item.id === id);
    if (entry) select(entry);
  };
  const todayChart = (
    <TodayChart
      now={now}
      selectedId={selected?.item.id}
      onPick={pickToday}
      raised={today.raised}
      acted={today.acted}
      broadcasts={today.broadcasts}
    />
  );

  const onWatch = (kind: AlertKind | undefined) => {
    setTab("now");
    setWatchHighlight((current) => (current === kind ? null : (kind ?? null)));
  };
  // A quiet ward's checks sit under "Checked for <ward>" or in the Checking sheet, already titled.
  const phoneOwner = (
    <PhoneOwnerMenu
      owners={namedOwners}
      coordDesk={coordDesk}
      value={ownerHighlight}
      onChange={setOwnerHighlight}
      entries={allEntries}
    />
  );
  const checkingList = (
    <CheckingList checks={checks} watchHighlight={watchHighlight} onWatch={onWatch} showLabel={!quietWard} />
  );
  // Nurse in charge: a quiet ward's side panel lists the checks, so the hero leaves them out.
  const checkingFoot = quietWard ? undefined : <ChecksChip checks={checks}>{checkingList}</ChecksChip>;
  // Alerts redesign (1 Nov 2026): on a desktop the Today track and the at-a-glance line sit in the
  // band, in place of the Today card, the band's broadcast button and the Checking row.
  const todayBand =
    isPhone || quietWard ? undefined : (
      <TodayBand
        now={now}
        selectedId={selected?.item.id}
        onPick={pickToday}
        {...today}
        noTimeCount={countedActive.filter((entry) => entry.raised === undefined).length}
        checking={<div className={styles.checkingFootWide}>{checkingFoot}</div>}
        liveBroadcast={activeBroadcast ? { until: activeBroadcast.expiresAt } : undefined}
        onOpenBroadcast={openLiveBroadcast}
      />
    );

  return (
    <div className={styles.screen} data-testid="ward-alerts-page" data-ward-design="v8">
      {pull.sheet}
      <main id="main-content" className={styles.main}>
        <AlertsHero
          isPhone={isPhone}
          wardName={wardName}
          openCount={activeEntries.length}
          runningCount={runningEntries.length}
          oldestRaised={oldestRaised}
          now={now}
          live={live}
          actCount={actCount}
          waitEntries={waitEntries}
          yoursCount={yoursCount}
          handleNext={handleNext}
          broadcastTriggerRef={broadcastTriggerRef}
          openComposer={openComposer}
          broadcastDisabledReason={broadcastDisabledReason}
          activeBroadcast={activeBroadcast}
          onOpenBroadcast={openLiveBroadcast}
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
          todayBand={todayBand}
        />

        {/* Feedback after a broadcast or an act on a row */}
        {broadcastFeedback && (!broadcastRefused || !isBroadcastModalOpen) ? (
          <FeedbackLine
            refused={Boolean(feedbackRefused)}
            text={broadcastFeedback}
            onDismiss={() => {
              if (broadcastAccepted) setBroadcastModalOpen(false);
              setBroadcastRequest(null);
              actionFeedback.clear();
              setBroadcastSuccessNotice(null);
            }}
          />
        ) : null}

        <div className={styles.grid}>
          <div className={styles.column}>
            <Card as="section" className={styles.queueCard} aria-label="Alerts">
              <AlertsViewTabs
                isPhone={isPhone}
                tabs={tabs}
                value={shownTab}
                onChange={setTab}
                arrange={
                  shownTab === "now" && wardName === undefined ? (
                    <ArrangeSwitch value={arrangeBy} onChange={setArrangeBy} withOwner={namedOwners.length > 0} />
                  ) : null
                }
              />

              {shownTab === "now" ? (
                <TabPanel idPrefix="alerts" id="now">
                  {quietWard ? null : (
                    <OpenFilters lens={lens} end={isPhone && wardName === undefined ? phoneOwner : undefined} />
                  )}
                  {/* Nurse in charge: one ward needs no arrange-by or owner lens (Josh, 31 Oct 2026, answer 17). */}
                  {wardName !== undefined || !anyHighlight ? null : (
                    <HighlightNote count={highlightedCount} of={allEntries.length} onClear={clearHighlights} />
                  )}
                  {isPhone ? (
                    <>
                      <div className={styles.phoneList}>
                        {filteredNothing ? <FilteredEmpty lens={lens} /> : urgencyView}
                      </div>
                      {filteredNothing ? null : noticesGroup}
                      {quietWard ? null : <p className={styles.phoneNote}>{alertsOrderLine("urgency")}</p>}
                    </>
                  ) : (
                    <>
                      {filteredNothing ? (
                        <FilteredEmpty lens={lens} />
                      ) : view === "lanes" ? (
                        lanesView
                      ) : view === "owner" ? (
                        ownerView
                      ) : (
                        urgencyView
                      )}
                      {filteredNothing ? null : noticesGroup}
                      {quietWard && view === "urgency" ? null : (
                        <p className={styles.orderNote} data-testid="ward-alerts-order-note">
                          {alertsOrderLine(view)}
                        </p>
                      )}
                    </>
                  )}
                </TabPanel>
              ) : null}

              {shownTab === "earlier" ? (
                <AlertsClearedPanel history={history} readNotices={readNotices} now={now} umrnLookup={umrnLookup} />
              ) : null}
              {shownTab === "broadcasts" ? (
                <AlertsBroadcastsPanel
                  live={liveBroadcasts}
                  anyLive={liveCount > 0}
                  pastBroadcasts={pastBroadcasts}
                  units={units}
                  movements={movements}
                  now={now}
                />
              ) : null}
            </Card>

            {isPhone ? (
              <>
                {quietWard ? null : (
                  <TodayPhoneCard
                    raised={allEntries.filter((entry) => entry.raised !== undefined).length}
                    acted={history.filter((entry) => entry.action).length}
                    broadcast={(broadcastAlerts ?? []).length}
                    onOpen={() => setPhoneToday(true)}
                  />
                )}
                <ChecksCard checks={checks} onOpen={() => setPhoneChecks(true)} />
              </>
            ) : (
              <ChecksCard checks={checks} className={styles.checkingCardPortrait} onOpen={() => setPhoneChecks(true)} />
            )}
            <PhoneSheet open={phoneChecks} onClose={() => setPhoneChecks(false)} title="Checking" height="tall">
              <div className={styles.phoneChecks}>{checkingList}</div>
            </PhoneSheet>
          </div>

          {slideOver ? null : (
            <aside className={styles.panel} aria-label="Selected alert" data-wf-rail>
              <Card as="div" className={styles.panelCard}>
                {selectedPanel ?? (
                  <AlertsSidePanelEmpty wardName={wardName} quiet={allEntries.length === 0} checks={checkingList} />
                )}
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
            modalCloseRef={modalCloseRef}
            onClose={handleCloseBroadcastModal}
            refusedFeedback={broadcastRefused ? broadcastFeedback : null}
            kind={broadcastType}
            onSelectKind={(kind) => handleSelectTemplate(QUICK_STARTS[kind][0])}
            templateId={selectedTemplateId}
            onSelectTemplate={handleSelectTemplate}
            audience={broadcastAudience}
            setAudience={setBroadcastAudience}
            groups={audienceState.groups}
            wardsWithBedNow={audienceState.wardsWithBedNow}
            severity={broadcastSeverity}
            setSeverity={setBroadcastSeverity}
            durationMinutes={broadcastDurationMinutes}
            setDurationMinutes={setBroadcastDurationMinutes}
            title={broadcastTitle}
            setTitle={setBroadcastTitle}
            message={broadcastMessage}
            setMessage={setBroadcastMessage}
            confirmed={broadcastConfirmed}
            setConfirmed={setBroadcastConfirmed}
            sending={broadcastSave.pending}
            liveBedCall={liveBedCallFor(activeBroadcast, audienceState.recipients, now)}
            onExtendLive={(alertId) => {
              const title = broadcastAlerts?.find((alert) => alert.id === alertId)?.title ?? "Live bed call";
              track(
                {
                  type: "EXTEND_BROADCAST_ALERT",
                  ok: `Extended "${title}".`,
                  refused: `Extension of "${title}" was not accepted.`,
                },
                () => raise("EXTEND_BROADCAST_ALERT", { alertId }),
              );
              handleCloseBroadcastModal();
              openLiveBroadcast();
            }}
            senderName={coordDesk ? "Bed coordinator" : deskRoleLabel}
            now={now}
            onSend={handleDispatchBroadcast}
          />
        )}
      </main>
      <WardPrototypeFooter testId="ward-alerts-governance" />
    </div>
  );
}
