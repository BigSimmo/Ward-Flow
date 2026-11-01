"use client";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { AlarmClock, ChevronRight, Clock, Columns3, List, Users, X } from "lucide-react";
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
  copiedAge,
  admissionIdOfInboxId,
  raisedAt,
  resolveAlertSubject,
  shownAgeFrom,
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
import { AcceptedPullRows } from "@/components/ward-management/coordinator/accepted-pull-rows";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { groupSameKind, KindGroup, OwnerMenu } from "./alerts-queue-groups";
import { AlertsSidePanelEmpty, CheckingList, ChecksCard, ChecksChip, ownWardName } from "./alerts-checking";
import { AlertsBroadcastPanel, AlertsHistoryPanel, AlertsNoticesPanel } from "./alerts-tab-panels";
import { BroadcastComposer } from "./broadcast-composer";

import { ForecastAlertsGroup } from "@/components/ward-management/forecast/forecast-alerts-group";
import styles from "./alerts.module.css";
import parts from "./alerts-screen-parts.module.css";
import {
  Button,
  Count,
  Card,
  Drawer,
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
  const deskRole = access.role === "admin" ? "executive" : access.role;
  const coordDesk = access.role === "coordinator";
  const actionDisabledReason = coordDesk ? undefined : "Only the coordinator can change alerts.";
  // Broadcasting is for the coordinator and the site bed manager (`EVENT_ROLE.DISPATCH_BROADCAST_ALERT`).
  const broadcastDisabledReason =
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
  // Nurse in charge: the ward's own name (title, side panel); undefined on any other desk.
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
  // Q111 (Josh, 1 Nov 2026): a ward's acceptance with no bed pulled is act now here too, as on Home.
  // Only the coordinator pulls a bed, so only the coordinator's desk lists it.
  const toPull = useMemo(
    () => (coordDesk ? acceptedReferralsAwaitingPull(referrals, units, movements) : []),
    [coordDesk, referrals, units, movements],
  );
  const actCount = actEntries.length + toPull.length;
  const pullRows =
    toPull.length > 0 ? (
      <AcceptedPullRows toPull={toPull} now={now} phone={isPhone} testId="ward-alerts-accepted-to-pull" />
    ) : null;
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
  // The owners a highlight can pick: an alert nobody owns adds no blank one, and a desk with none gets
  // no owner menu and no Owner arrangement. Transport officer: the owner parts are the coordinator's
  // (only the coordinator takes an alert), so the officer has none.
  const namedOwners = access.role === "officer" ? [] : owners.filter(Boolean);
  // Nurse in charge: a quiet ward gets one line, not two empty groups and a sort rule over nothing.
  const quietWard = wardName !== undefined && allEntries.length === 0;

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
      role: deskRole,
      now: clockNow,
      title: broadcastTitle,
      message: broadcastMessage,
      severity: broadcastSeverity,
      category: broadcastCategory,
      targetScope: broadcastScope,
      targetScopeLabel,
      durationMinutes: broadcastDurationMinutes,
      dispatchedByName: coordDesk ? "State Mental Health Bed Desk Coordinator" : WARD_FLOW_ROLE_LABELS[deskRole],
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
      role: deskRole,
      now: clockNow,
      alertId,
      stoodDownByRole: deskRole,
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
      `- ${entry.item.title}. ${entry.subject.displayName}. ${entry.subject.to ? `${entry.subject.from} to ${entry.subject.to}` : entry.subject.from}. Owner ${entry.owner}.${copiedAge(entry.item, entry.raised, now)}`;
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

  // Alerts redesign (Q112, Josh 1 Nov 2026): the title is the Act now and Waiting figures, Home's
  // count included. "New to you" is gone: nothing on the page explained it.
  const heroTitle =
    actCount > 0 || waitEntries.length > 0
      ? `${actCount} act now, ${waitEntries.length} waiting`
      : wardName
        ? `No alert for ${wardName}`
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
  const urgencyLabels = ["Act now", "Waiting", "Targets running"] as const;
  const urgencyLinked = groupLinkedAlerts([actEntries, waitEntries, runningEntries]);
  const urgencyLink = (section: number) => ({
    items: urgencyLinked.sections[section] ?? [],
    shownEarlier: urgencyLinked.shownEarlier[section] ?? 0,
    sectionLabels: urgencyLabels,
  });
  const urgencyView = quietWard ? (
    <p className={styles.groupEmpty}>Nothing in Act now or Waiting.</p>
  ) : (
    <>
      {groupSection(
        "act",
        "Act now",
        actEntries,
        <GroupHead tone="danger" label="Act now" count={actCount} />,
        "Nothing to act on now.",
        urgencyLink(0),
        pullRows,
      )}
      {access.role === "coordinator" || access.role === "bed_manager" ? (
        <ForecastAlertsGroup
          now={now}
          className={styles.group}
          readOnly={access.role === "bed_manager"}
          head={(count) => <GroupHead tone="warning" label="Forecast" count={count} />}
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
          <GroupHead tone={tone} label={label} count={key === "act" ? actCount : list.length} />
          {key === "act" ? pullRows : null}
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
        label={ownerShort(owner, coordDesk) === "You" ? `You, ${owner}` : owner}
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
  ].filter((item) => access.role !== "officer" || item.id === "now" || item.count > 0); // Officer: no empty tabs.

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

  const onWatch = (kind: AlertKind | undefined) => {
    setTab("now");
    setWatchHighlight((current) => (current === kind ? null : (kind ?? null)));
  };
  // A quiet ward's checks sit under "Checked for <ward>" or in the Checking sheet, already titled.
  const checkingList = (
    <CheckingList checks={checks} watchHighlight={watchHighlight} onWatch={onWatch} showLabel={!quietWard} />
  );
  // Nurse in charge: a quiet ward's side panel lists the checks, so the hero leaves them out.
  const checkingFoot = quietWard ? undefined : <ChecksChip checks={checks}>{checkingList}</ChecksChip>;

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
          actCount={actCount}
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
                  {/* Nurse in charge: one ward needs no arrange-by or owner lens. */}
                  {wardName !== undefined ? null : (
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
                          // A desk with no owner to pick (the transport officer) has no Owner arrangement.
                          ...(namedOwners.length === 0
                            ? []
                            : [
                                {
                                  id: "owner" as const,
                                  label: (
                                    <>
                                      <Users size={14} aria-hidden="true" /> Owner
                                    </>
                                  ),
                                },
                              ]),
                        ]}
                      />
                      <span className={styles.toolbarRule} aria-hidden="true" />
                      {/* Josh, 31 Oct 2026 (answer 17): the desktop keeps Owner as an Arrange by view and
                          drops the owner menu that repeated it. Phones, with no Arrange by, keep the menu. */}
                      {anyHighlight ? (
                        <span className={styles.highlightNote} role="status">
                          {highlightedCount} of {allEntries.length} <SrOnly>synthetic rows</SrOnly> highlighted, all
                          rows stay
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
                  )}
                  {isPhone ? (
                    <>
                      {/* The desktop's owner menu, not a row of chips that ran off the screen. Yours is a
                          hero figure on phone, so the menu lists the other owners. */}
                      {wardName === undefined && namedOwners.some((owner) => ownerShort(owner, coordDesk) !== "You") ? (
                        <div className={parts.phoneOwner}>
                          <OwnerMenu
                            owners={namedOwners.filter((owner) => ownerShort(owner, coordDesk) !== "You")}
                            value={ownerHighlight}
                            onChange={setOwnerHighlight}
                            labelFor={(owner) => ownerShort(owner, coordDesk)}
                            countFor={(owner) => allEntries.filter((entry) => entry.owner === owner).length}
                          />
                        </div>
                      ) : null}
                      <div className={styles.phoneList}>{urgencyView}</div>
                      {quietWard ? null : <p className={styles.phoneNote}>{alertsOrderLine("urgency")}</p>}
                    </>
                  ) : (
                    <>
                      {view === "lanes" ? lanesView : view === "owner" ? ownerView : urgencyView}
                      {quietWard && view === "urgency" ? null : (
                        <p className={styles.orderNote} data-testid="ward-alerts-order-note">
                          {alertsOrderLine(view)}
                        </p>
                      )}
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

            {/* Nurse in charge: a quiet ward has no Today to chart. */}
            {quietWard ? null : (
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
            )}
            {isPhone ? (
              <>
                {quietWard ? null : (
                  <button type="button" className={styles.phoneCard} onClick={() => setPhoneToday(true)}>
                    <Clock size={18} aria-hidden="true" />
                    <span className={styles.phoneCardText}>
                      <span className={styles.phoneCardTitle}>Today</span>
                      <span className={styles.phoneCardMeta}>
                        <b className={styles.mono}>{allEntries.filter((entry) => entry.raised !== undefined).length}</b>{" "}
                        raised · <b className={styles.mono}>{history.filter((entry) => entry.action).length}</b> acted
                        on · <b className={styles.mono}>{(broadcastAlerts ?? []).length}</b> broadcast
                      </span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
                <ChecksCard checks={checks} onOpen={() => setPhoneChecks(true)} />
              </>
            ) : (
              /* Device audit (11 Oct 2026): on an iPad in portrait the Checking strip wraps to three lines,
                 so it becomes the phone's one-tap card there (shown by CSS in that range only). */
              <ChecksCard checks={checks} className={styles.checkingCardPortrait} onOpen={() => setPhoneChecks(true)} />
            )}
            <PhoneSheet open={phoneChecks} onClose={() => setPhoneChecks(false)} title="Checking" height="tall">
              {/* The list itself, not the collapsed chip, so one tap reaches it. */}
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
