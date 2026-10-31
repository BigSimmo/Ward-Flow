"use client";

import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { BEDS_READY_SCOPED_TITLE } from "@/components/ward-management/ward-shared-figures";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSenderPresentation } from "@/components/ward-management/ward-sender-presentation";
import {
  referralPresentation,
  referralPresentationLists,
} from "@/components/ward-management/ward-partial-view-presenters";
import { presentationDecidedAt, outcomeLabel } from "./referral-board-model";
import { acceptedReferralsAwaitingPull, acceptedWardOf, type AcceptedAwaitingPull } from "./accepted-ward-referral";
import { ChevronRight, ClipboardList, ListOrdered, TriangleAlert, X } from "lucide-react";

import { dayOf, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import { hasOpenSheet, overlayOpener } from "@/components/wf/sheet-focus";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { type Movement, type Referral } from "@/components/ward-management/ward-model";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { createReadmissionIndex, referralReadmissionFlag } from "@/components/ward-management/ward-readmission";
import { ReadmissionFlag, useReadmissionFlagVisible } from "@/components/ward-management/ward-readmission-flag";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { acceptedAddressing, declinedAddressings, referralClocks } from "@/components/ward-management/ward-referrals";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import {
  Avatar,
  Button,
  Card,
  ColumnChart,
  EmptyState,
  Hero,
  JourneyStrip,
  Kbd,
  LiveChip,
  Sheet,
  TabPanel,
  Tabs,
  TierTile,
  buttonClass,
  cx,
  durMinutes,
} from "@/components/wf";

import { ReferralHistoryAndCorrections } from "./referral-history-corrections-lazy";
import { ReferralMatchView } from "./referral-match-lazy";
import { HistoryFoldProvider } from "./folded-history";
import { ReferralPhoneChips } from "./referral-phone-chips";
import { allClinicalValuesSigned } from "@/components/ward-management/ward-clinical-values";
import { useReferralDecisionUndo } from "./use-referral-decision-undo";
import { WardOffersTable } from "./ward-offers-table";
import redesign from "./referral-page.module.css";
import { getReferralPriority, referralPriorityLabel } from "./referral-priority";
import {
  BedsReady,
  REFERRAL_SOURCE_WORDS,
  SummaryButton,
  askingForShort,
  bedsReadySummary,
  isOverdue,
  needWords,
  openArms,
  readyUnitCount,
  referralTimeline,
  wardArm,
} from "./referral-board-parts";
import styles from "./referrals.module.css";
import { demographicLabel, journeyDuration, referralJourneyStages } from "./referral-board-model";
import { DecidedSection, QueuedSection } from "./referral-board-sections";
import { WaitRunway } from "./wait-runway";
import { ReferralAlerts } from "./referral-alerts";
import { BedsStrip, HeroTools, LiveDecisionClock, PanelNav, personLine } from "./referral-panel-parts";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { ScopedMeetingRow } from "./bed-meeting-sheet";
import panel from "./referral-panel.module.css";
import { PatientTab, TimelineTab } from "./referral-panel-tabs";

// The bed meeting, ISBAR and shortcut sheets open only on request, so they load after first render.
const BedMeetingSheet = dynamic(() => import("./bed-meeting-sheet").then((m) => m.BedMeetingSheet), { ssr: false });
const IsbarSheet = dynamic(() => import("./referral-summary-sheet").then((m) => m.ReferralSummarySheet), {
  ssr: false,
});
const ShortcutsSheet = dynamic(() => import("./referral-board-sheets").then((m) => m.ShortcutsSheet), { ssr: false });
const PullAcceptedReferral = dynamic(() => import("./pull-accepted-referral").then((m) => m.PullAcceptedReferral), {
  ssr: false,
});
import a from "./referral-board.module.css";
import p from "./referral-board-phone.module.css";
import wardPin from "@/components/ward-management/ward-pinned-switch.module.css";
import { ReferralPhoneCard, ReferralPhoneHero, ReferralPhoneTop } from "./referral-board-phone";
import { createBrowserStore } from "@/lib/client-store-factory";
import { useIsPhone } from "@/components/wf";
import mph from "./referral-match-phone.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { movementHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { recordIdFromParam } from "@/components/ward-management/shell/ward-record-address";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { recordedMovementMedicalClearance } from "@/components/ward-management/ward-medical-clearance";
import type { IsbarRecorded } from "./referral-board-sheets";

/** The tier due times' status, read from the clinical values file so it changes when they are signed. */
const DUE_TIMES_NOTE = allClinicalValuesSigned([
  "tierOneOverdue",
  "tierTwoOverdue",
  "tierThreeOverdue",
  "anyTierOverdue",
])
  ? "Due times are prototype defaults, signed for the prototype."
  : "Due times are prototype defaults, pending clinical sign-off.";

/**
 * Task 5 (Phase 7, "The front door", spec D9/D10): the coordinator's referral board — the screen
 * the whole phase exists to produce. Queued referrals first, longest wait first, with urgency only
 * breaking a tie (`referralQueueOrder`, `ward-referrals.ts`, Decision D-32); recently decided
 * referrals below that, most recent decision first (`recentlyDecidedReferrals`). The referral
 * clock is rendered prominently on every queued row, and each row keeps its urgency tier visible
 * so the clinician can weigh it without the queue silently reordering anybody.
 *
 * ⚠️ **THAT CLOCK IS `referralWaitLine`, NEVER `referralWaitLabel`** (`./referral-wait.ts`, which
 * carries the reasoning). The label form counts from `raisedAt` to `now` and never stops, so it
 * goes on printing a wait for somebody who was triaged into a department hours ago. `P9-D7` stops
 * the referral clock at triage, and a stopped span is worded as one rather than as a live wait.
 *
 * Selecting a queued referral opens the match view (`ReferralMatchView`) below the board, keyed
 * on the referral's own id so switching selection always starts that view's local state fresh.
 * A decided referral is informational only here — its own match decision already happened, so
 * this board renders no selection control for it.
 *
 * LIVE, like `EscalationBoardPage`, `DischargeBoard` and — since owner decision OD-4 — the shift
 * handover as well: reads `useWardFlow()` fresh on every render, so an
 * ACCEPT_REFERRAL/DECLINE_REFERRAL dispatched from the match view immediately moves that referral
 * from "queued" to "recently decided" here. Every screen in this feature now reads live; there is
 * no frozen one left to contrast against, `HandoverPage` having been the last (`123b0c139`, which
 * recomputes it every render and renames `frozenAt` to `takenAt`).
 *
 * That sentence previously named `HandoverPage`'s frozen snapshot as the counter-example, and had
 * been false since the day that page changed — which is the failure mode worth naming here rather
 * than just correcting. A comment that points at a SIBLING as an example decays when the sibling
 * moves, so nothing in this file can ever fail to catch it, and a reader is not merely misinformed:
 * they are shown a pattern to copy that looks safe because it cites a real precedent. State the
 * property this file has; cite a neighbour only with the commit that fixes what it is being cited for.
 */
/** Where the queue and the selected referral sit side by side. Below it, `referrals.module.css`
 *  (`max-width: 63.9375rem`) turns the detail into a full-screen slide-over with a backdrop. */
const SPLIT_DETAIL_MEDIA_QUERY = "(min-width: 64rem)";
const useSplitDetailLayout = createBrowserStore<boolean>(
  (onStoreChange) => {
    if (typeof window.matchMedia !== "function") return () => {};
    const media = window.matchMedia(SPLIT_DETAIL_MEDIA_QUERY);
    media.addEventListener("change", onStoreChange);
    return () => media.removeEventListener("change", onStoreChange);
  },
  () => (typeof window.matchMedia === "function" ? window.matchMedia(SPLIT_DETAIL_MEDIA_QUERY).matches : false),
  false,
);

type HighlightKey = "overdue" | "tier1" | "ward" | "ed" | "both" | "community" | "refused";
const HIGHLIGHT_KEYS: readonly HighlightKey[] = ["overdue", "tier1", "ward", "ed", "both", "community", "refused"];
type InspectorTab = "place" | "patient" | "timeline";
type BoardSheet = "meeting" | "summary" | "keys" | null;

/**
 * WS-18: the decision's own controls (`referral-match.tsx`) that the A and D keys use. A presses
 * Accept at the chosen ward, or an ED's Accept presentation, which still asks to confirm. The
 * community team's Accept referral decides in one press with no choice before it, so it stays a tap.
 * D opens the ward's decline reasons, or moves to an ED's or a community team's reason list.
 */
const REFERRAL_ACCEPT_CONTROL =
  '[data-testid="ward-referral-match-phone-accept"], [data-testid="ward-referral-match-accept-emergency_department"]';
const REFERRAL_DECLINE_CONTROL =
  '[data-testid="ward-referral-match-decline-open"], [data-testid="ward-referral-match-decline-reason-emergency_department"], [data-testid="ward-referral-match-decline-reason-community_team"]';

/**
 * The hero's highlight chips. Refused once sits in the queue toolbar. P154 (Josh, 27 October 2026,
 * option A): phone and desktop read the same type chips, Ward bed · ED · More than one · Community.
 */
const HIGHLIGHT_LABELS: readonly (readonly [Exclude<HighlightKey, "refused">, string])[] = [
  ["overdue", "Decision overdue"],
  ["tier1", "Tier 1"],
  ["ward", "Ward bed"],
  ["ed", "ED"],
  ["both", "More than one"],
  ["community", "Community"],
];

/**
 * Audit round 2 (A2-13): the type chips count each referral once. A referral that asks for more
 * than one kind of place sits under More than one, not under each kind, so the chips sum to the
 * hero's "awaiting decision" count. P154: desktop pills use the same rule as the phone chips.
 */
function askedKinds(referral: Referral): Set<string> {
  return new Set(openArms(referral).map((arm) => arm.destination.kind));
}

function typeTest(key: "ward" | "ed" | "both" | "community", referral: Referral): boolean {
  const kinds = askedKinds(referral);
  if (key === "both") return kinds.size > 1;
  if (kinds.size !== 1) return false;
  const kind = key === "ward" ? "psychiatric_ward" : key === "ed" ? "emergency_department" : "community_team";
  return kinds.has(kind);
}

function highlightTest(key: HighlightKey, referral: Referral, now: Instant): boolean {
  if (key === "ward" || key === "ed" || key === "both" || key === "community") {
    return typeTest(key, referral);
  }
  switch (key) {
    case "overdue":
      return isOverdue(referral, now);
    case "tier1":
      return referral.urgency === 1;
    case "refused":
      return declinedAddressings(referral).length > 0;
  }
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable === true
  );
}

function subscribeToLocation(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}
function readLinkedReferralId(): string | null {
  // D-39: the link carries an address code; an old link may still carry the raw id.
  return recordIdFromParam(new URLSearchParams(window.location.search).get("referral"));
}

/**
 * Option A (Josh, 9 October 2026): the statewide referral queue as a dense table with a decision
 * panel beside it. The hero carries the page's own tools: highlight pills, the waiting runway,
 * beds ready statewide, Next overdue and the bed meeting list. Filters highlight and never hide a
 * referral; the queue stays longest wait first with the tier only breaking ties (D-32).
 * Redesign (Josh, 31 October 2026): queue rows wrap, the ward offers are a table, the written
 * history folds behind one button and the decision buttons sit in a bar at the panel's foot.
 */
export function ReferralBoard({
  defaultSelectFirst = false,
  readOnly: readOnlyProp,
  historyOpenOnLoad = false,
}: {
  defaultSelectFirst?: boolean;
  /** Viewing, filters and the detail only: no decision, placement, owner or call control. */
  readOnly?: boolean;
  /** Opens on History rather than the queue (the redesign preview draws it this way). */
  historyOpenOnLoad?: boolean;
} = {}) {
  const [historyOpen, setHistoryOpen] = useState(historyOpenOnLoad);
  // D-80: the site bed manager reads its site's referral lines and answers none of them.
  const routeRole = useRouteRole();
  const readOnly = readOnlyProp ?? routeRole === "bed_manager";
  // Desk views (Josh, 31 Oct 2026): one board, with each desk's differences as branches on its role.
  const access = useEffectiveWardAccess();
  const wardDesk = access.role === "ward";
  const edDesk = access.role === "ed";
  const communityDesk = access.role === "community";
  const siteManager = routeRole === "bed_manager";
  const {
    referrals,
    units,
    dispatch,
    rejections,
    movements = [],
    patients = [],
    admissions = [],
    bedReleases = [],
  } = useWardFlowSelect(
    "referrals",
    "units",
    "dispatch",
    "rejections",
    "movements",
    "patients",
    "admissions",
    "bedReleases",
  );
  const now = useWardFlowClock();
  const sender = useSenderPresentation();
  const presentationLists = referralPresentationLists(referrals, sender.referralFor);
  const queued = presentationLists.queued;
  const decidedAtFor = (referral: Referral) => presentationDecidedAt(referral, sender.referralFor(referral));
  // `undefined` = nobody has chosen yet; `null` = the coordinator closed the detail. Only the first
  // falls back to the page's default, and only where the detail sits beside the queue. Below 64rem
  // the detail is a full-screen slide-over, and opening it unasked covered the whole board (queue,
  // "New referral" and rail) before anyone had chosen anything (f997ac75a1 + 81553692fb).
  const [chosenReferralId, setSelectedReferralId] = useState<string | null | undefined>(undefined);
  const splitDetailLayout = useSplitDetailLayout();
  // A1-17: the shared phone query, so the server's phone guess draws the phone layout first.
  const phoneLayout = useIsPhone();
  const [phoneSheet, setPhoneSheet] = useState<"axis" | "beds" | null>(null);
  // A2-5: `?referral=<id>` (the ED row's "Referred to" link) opens that referral until someone chooses.
  const linkedReferralId = useSyncExternalStore(subscribeToLocation, readLinkedReferralId, () => null);
  const selectedReferralId =
    chosenReferralId === undefined
      ? linkedReferralId !== null && referrals.some((referral) => referral.id === linkedReferralId)
        ? linkedReferralId
        : defaultSelectFirst && splitDetailLayout
          ? queued[0]?.id
          : undefined
      : (chosenReferralId ?? undefined);
  const [view, setView] = useState<"queue" | "history">("queue");
  const [chosenHighlight, setHighlight] = useState<HighlightKey | null>(null);
  // A collection count cannot classify rows whose recipient details are withheld. Ignore an
  // earlier recipient filter as well, so switching desks never filters those rows out.
  const recipientFiltersAvailable =
    presentationLists.unavailable.length === 0 &&
    queued.every((referral) => sender.referralFor(referral) === undefined);
  const highlight =
    chosenHighlight !== null && !recipientFiltersAvailable && !["overdue", "tier1"].includes(chosenHighlight)
      ? null
      : chosenHighlight;
  // The board's decisions are dispatched as the coordinator (CO-D2), so Undo is too.
  const watchDecision = useReferralDecisionUndo("coordinator");
  const [chosenTab, setInspectorTab] = useState<InspectorTab>("place");
  // A read-only board has no Place tab, so it opens on the patient.
  const inspectorTab: InspectorTab = readOnly && chosenTab === "place" ? "patient" : chosenTab;
  /* v10 phone: the sheet has no tabs; the timeline and the patient details open in place. */
  const isPhone = useIsPhone();
  const [phoneTimelineOpen, setPhoneTimelineOpen] = useState(false);
  const [phonePatientOpen, setPhonePatientOpen] = useState(false);
  const [sheet, setSheet] = useState<BoardSheet>(null);
  // Held whole, not looked up: the referral leaves the awaiting list once its journey starts,
  // before the bed is pulled, and the sheet must stay open for that second step.
  const [pulling, setPulling] = useState<AcceptedAwaitingPull>();
  const triggerRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  // Audit 24-1 B-03: the queued referral on screen, by id and name, so one decided at another desk
  // closes with a notice naming them rather than handing the panel to the next person in the queue.
  const [watchedReferral, setWatchedReferral] = useState<{ id: string; name: string }>();
  const [decidedHereId, setDecidedHereId] = useState<string>();
  const [leftNotice, setLeftNotice] = useState<string>();

  const handleSelect = useCallback((referralId: string) => {
    // Usability review, 24 Oct 2026: Safari leaves focus on <body> after a tap, so take the shared
    // opener (the last pressed control stands in) rather than the active element alone.
    triggerRef.current = overlayOpener();
    setLeftNotice(undefined);
    setSelectedReferralId(referralId);
    setInspectorTab("place");
  }, []);

  const closeDetail = useCallback(() => {
    // `null`, not `undefined`: a closed detail stays closed rather than falling back to the default.
    setSelectedReferralId(null);
    if (triggerRef.current?.isConnected && typeof triggerRef.current.focus === "function") {
      triggerRef.current.focus();
    }
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlight(null);
  }, []);

  // One state object, so the resolver's identity-keyed index is built once per render, not per row.
  const resolverState = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const nameOf = useCallback(
    (referral: Referral) => resolveSubjectPatient(referral, resolverState).formalName,
    [resolverState],
  );

  const anyHighlight = highlight !== null;
  const isHighlighted = (referral: Referral) => highlight !== null && highlightTest(highlight, referral, now);
  const highlightedCount = anyHighlight ? queued.filter(isHighlighted).length : 0;
  /*
   * Audit round 2 (A2-14): on the phone a chip FILTERS. Dimming greyed the overdue row's act-now
   * marker and left the match below the fold. Desktop keeps highlight-and-dim (Josh, 13 Oct 2026),
   * but an overdue (act-now) row is never dimmed on either.
   */
  const phoneFiltered = phoneLayout && anyHighlight;
  const listedQueued = phoneFiltered ? queued.filter(isHighlighted) : queued;

  const decided = presentationLists.recentlyDecided;
  // The DENOMINATOR, uncapped. `decided` above is already truncated to the display limit, so its
  // length names how many rows are shown and cannot name how many have been decided.
  const allDecided = presentationLists.decided;
  const decidedTotal = allDecided.length;
  const selectedInQueue = selectedReferralId
    ? queued.find((referral) => referral.id === selectedReferralId)
    : undefined;
  if (watchedReferral && !queued.some((referral) => referral.id === watchedReferral.id)) {
    // Decided here, the detail stays on them (CS-15); decided elsewhere, nobody is selected. A
    // default selection (nobody chose yet) would otherwise slide to the new first in queue.
    const stillShown = chosenReferralId === undefined || watchedReferral.id === selectedReferralId;
    if (
      stillShown &&
      watchedReferral.id !== decidedHereId &&
      !presentationLists.unavailable.some((referral) => referral.id === watchedReferral.id)
    ) {
      setSelectedReferralId(null);
      setLeftNotice(`${watchedReferral.name} was decided elsewhere. Choose the next referral from the queue.`);
    }
    setWatchedReferral(undefined);
  } else if (selectedInQueue) {
    if (watchedReferral?.id !== selectedInQueue.id)
      setWatchedReferral({ id: selectedInQueue.id, name: nameOf(selectedInQueue) });
  } else if (watchedReferral) {
    setWatchedReferral(undefined);
  }
  // Any later choice (row, keyboard, link) replaces the notice.
  if (leftNotice && selectedReferralId) setLeftNotice(undefined);
  const selectedReferral = selectedReferralId
    ? referrals.find((referral) => referral.id === selectedReferralId)
    : undefined;
  // WS-03: an accepted referral with no bed pulled, which the coordinator can pull here in one step.
  const awaitingPull = useMemo(
    () => (readOnly ? [] : acceptedReferralsAwaitingPull(referrals, units, movements)),
    [readOnly, referrals, units, movements],
  );
  const selectedToPull = awaitingPull.find((entry) => entry.referral.id === selectedReferral?.id);
  const selectedPatientInfo = resolveSubjectPatient(selectedReferral, resolverState);
  const selectedReadyUnits =
    selectedReferral && sender.referralFor(selectedReferral) === undefined
      ? readyUnitCount(selectedReferral, units, now)
      : undefined;
  const readmissionIndex = useMemo(
    () => createReadmissionIndex({ admissions, patients, referrals, movements, units }),
    [admissions, patients, referrals, movements, units],
  );
  // The flag hides itself off the coordinator's routes; asked here too so the alerts group is not
  // drawn around a flag that renders nothing.
  const readmissionVisible = useReadmissionFlagVisible();
  const selectedReadmission =
    selectedReferral && readmissionVisible ? referralReadmissionFlag(selectedReferral, readmissionIndex) : null;

  const overdueQueued = queued.filter((referral) => isOverdue(referral, now));
  const oldestQueued =
    queued.length > 0
      ? queued.reduce((oldest, r) => (r.raisedAt < oldest.raisedAt ? r : oldest), queued[0])
      : undefined;
  const oldestClocks = oldestQueued ? referralClocks(oldestQueued, now) : undefined;
  const decidedToday = allDecided.filter((r) => {
    const at = decidedAtFor(r);
    return at !== undefined && dayOf(at) === dayOf(now);
  });
  const decisionMinutes = allDecided
    .map((r) => {
      const at = decidedAtFor(r);
      return at === undefined ? undefined : Math.max(0, at - r.raisedAt);
    })
    .filter((minutes): minutes is number => minutes !== undefined)
    .sort((a, b) => a - b);
  const medianDecision =
    decisionMinutes.length === 0
      ? undefined
      : decisionMinutes.length % 2 === 1
        ? decisionMinutes[(decisionMinutes.length - 1) / 2]!
        : Math.round(
            (decisionMinutes[decisionMinutes.length / 2 - 1]! + decisionMinutes[decisionMinutes.length / 2]!) / 2,
          );
  const nowHour = Math.floor(minuteOfDay(now) / 60);
  const decisionHours = Array.from({ length: 8 }, (_, index) => nowHour - 7 + index).filter((hour) => hour >= 0);
  const decisionsByHour = decisionHours.map((hour) => ({
    id: `h${hour}`,
    label: String(hour).padStart(2, "0"),
    value: decidedToday.filter((r) => Math.floor(minuteOfDay(decidedAtFor(r)!) / 60) === hour).length,
  }));
  const bedsSummary = useMemo(
    () => bedsReadySummary(units, admissions, bedReleases, now),
    [units, admissions, bedReleases, now],
  );
  // Round 4 (Josh, 31 Oct 2026): the bed meeting list follows access and filters. It keeps to the
  // header's service (by the referring site), opens on the highlighted referrals, and marks rows
  // whose destination details this desk may not see.
  const serviceScope = useServiceScope();
  const meetingRows: ScopedMeetingRow[] = queued
    .filter((referral) => serviceScope === null || siteByCode(referral.originSiteCode)?.service === serviceScope)
    .map((referral) => {
      const person = resolveSubjectPatient(referral, resolverState);
      return {
        referral,
        name: person.formalName,
        umrn: person.umrn,
        restricted: sender.referralFor(referral) !== undefined,
      };
    });
  const meetingHighlightIds = anyHighlight
    ? new Set(meetingRows.filter((row) => isHighlighted(row.referral)).map((row) => row.referral.id))
    : undefined;
  const meetingHighlightLabel =
    highlight === null
      ? undefined
      : highlight === "refused"
        ? "Refused once"
        : HIGHLIGHT_LABELS.find(([key]) => key === highlight)?.[1];
  const meetingScopeLabel = serviceScope ?? "Statewide";
  const selectedPriority = selectedReferral ? getReferralPriority(selectedReferral, now) : undefined;
  // Audit 1 (CS-15, Josh 20 Oct): the toast names the person decided on, and the detail stays on
  // them. A default "first in queue" detail used to slide to the next person, Accept showing, as
  // soon as the decided one left the queue; the next is opened only when the coordinator picks it.
  const decide = (referral: Referral) => (title: string, completion: ReturnType<WardCommandDispatch>) => {
    setSelectedReferralId(referral.id);
    setDecidedHereId(referral.id);
    watchDecision(referral.id, `${title} · ${nameOf(referral)}`, completion);
  };

  function selectAt(step: 1 | -1) {
    if (queued.length === 0) return;
    const index = queued.findIndex((referral) => referral.id === selectedReferralId);
    const next = index === -1 ? (step === 1 ? 0 : queued.length - 1) : (index + step + queued.length) % queued.length;
    handleSelect(queued[next]!.id);
  }

  function selectNextOverdue() {
    if (overdueQueued.length === 0) return;
    const index = queued.findIndex((referral) => referral.id === selectedReferralId);
    const after = queued.slice(index + 1).find((referral) => isOverdue(referral, now));
    setView("queue");
    handleSelect((after ?? overdueQueued[0]!).id);
  }

  // WS-04 (workflow speed audit, 26 Oct 2026): Decide on Home opens this board on its referral. The
  // decision is brought into view once, so Accept and Decline are not left below the board's header.
  const linkedOpenScrolled = useRef(false);
  const openedFromLink = chosenReferralId === undefined && linkedReferralId !== null;
  useEffect(() => {
    if (!openedFromLink || selectedReferralId !== linkedReferralId || linkedOpenScrolled.current) return;
    linkedOpenScrolled.current = true;
    if (typeof detailRef.current?.scrollIntoView === "function")
      detailRef.current.scrollIntoView({ behavior: wardScrollBehavior(), block: "start" });
  }, [openedFromLink, selectedReferralId, linkedReferralId]);

  // H-0369: the detail panel returns to its top only when another referral is chosen; opening or
  // closing a sheet must not move it.
  useEffect(() => {
    if (!selectedReferralId || !detailRef.current) return;
    detailRef.current.scrollTop = 0;
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      if (typeof detailRef.current.scrollIntoView === "function") {
        detailRef.current.scrollIntoView({ behavior: wardScrollBehavior(), block: "nearest" });
      }
    }
  }, [selectedReferralId]);

  useEffect(() => {
    if (!selectedReferralId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // A sheet over the page closes first; the referral stays open behind it.
      const target = e.target as HTMLElement | null;
      if (
        e.key === "Escape" &&
        sheet === null &&
        !e.defaultPrevented &&
        !hasOpenSheet() &&
        !document.querySelector('[aria-modal="true"]') &&
        target?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        closeDetail();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedReferralId, closeDetail, sheet]);

  const onShortcutKey = useEffectEvent((e: KeyboardEvent) => {
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      sheet !== null ||
      hasOpenSheet() ||
      document.querySelector('[aria-modal="true"]') !== null ||
      isTyping(e.target)
    ) {
      return;
    }
    if (!areCharacterShortcutsEnabled()) return;
    const key = e.key.toLowerCase();
    if (key === "j" || key === "k") {
      e.preventDefault();
      setView("queue");
      selectAt(key === "j" ? 1 : -1);
    } else if (selectedReferralId && (key === "1" || key === "2" || key === "3")) {
      e.preventDefault();
      setInspectorTab(key === "1" ? "place" : key === "2" ? "patient" : "timeline");
    } else if (key === "o") {
      e.preventDefault();
      selectNextOverdue();
    } else if (selectedReferralId && !e.shiftKey && (key === "a" || key === "d")) {
      // WS-18: A and D use the decision's own on-screen controls, so every gate stays: a read-only
      // desk draws none and nothing happens; Accept waits for a ward; Decline asks for a reason.
      const control = detailRef.current?.querySelector<HTMLButtonElement | HTMLSelectElement>(
        key === "a" ? REFERRAL_ACCEPT_CONTROL : REFERRAL_DECLINE_CONTROL,
      );
      if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
      e.preventDefault();
      if (control instanceof HTMLSelectElement) control.focus();
      else control.click();
    } else if (key === "s" && selectedReferralId) {
      e.preventDefault();
      setSheet("summary");
    } else if (key === "m") {
      e.preventDefault();
      setSheet("meeting");
    } else if (e.key === "?") {
      e.preventDefault();
      setSheet("keys");
    }
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => onShortcutKey(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Round 5 (Josh, 31 Oct 2026): an accepted referral's next step (Open movement or Pull the bed)
  // sits with the other actions at the bottom of the panel, not under the name.
  const followUpAction = (selectedReferral: Referral): ReactNode => {
    const accepted = acceptedAddressing(selectedReferral);
    const linkedMovement = movements.find((m) => m.referralId === selectedReferral.id && !m.closure);
    const targetWardUnitId =
      accepted?.acceptedUnitId ?? linkedMovement?.acceptedUnitId ?? acceptedWardOf(selectedReferral, units)?.unitId;
    const targetWard = targetWardUnitId ? units.find((u) => u.id === targetWardUnitId) : undefined;
    if (!targetWardUnitId) return null;
    if (readOnly && !linkedMovement) return null;
    // S-9 (audit 13 Oct 2026): an accepted referral was a dead end. It links on to
    // its movement when one is open, otherwise names the next step, holding the
    // bed on the accepting ward, and links the patient record.
    return (
      <>
        {linkedMovement ? (
          <Link
            href={movementHref(linkedMovement.id)}
            className={buttonClass({ variant: "pri", size: "sm" })}
            data-testid="ward-referral-open-movement"
          >
            Open movement
          </Link>
        ) : readOnly ? null : selectedToPull && routeRole === "coordinator" ? (
          // WS-03: the coordinator pulls the bed here in one step, with the recorded details.
          <Button
            size="sm"
            variant="pri"
            onClick={() => setPulling(selectedToPull)}
            data-testid="ward-referral-pull-bed"
          >
            Pull the bed
          </Button>
        ) : (
          <Link
            href={`/ward-flow/ward/${targetWardUnitId}?tab=board`}
            className={buttonClass({ variant: "pri", size: "sm" })}
            title={`Open ${targetWard?.name ?? "ward"} bed board`}
            data-testid="ward-referral-hold-bed"
          >
            Pull the bed
          </Link>
        )}
      </>
    );
  };

  const selectedUmrn = selectedPatientInfo.umrn;
  const umrnCopyable = /^UM\d{6}$/.test(selectedUmrn);

  /* The wait clock and the facts grid: in the fixed panel top on desktop, inside the scrolling
   sheet on a phone (v10), so the decision list gets the height. */
  const renderDetailFacts = (r: Referral) => (
    <>
      {referralPresentation(r, sender.referralFor(r)).kind !== "unavailable" &&
      outcomeLabel(r, sender.referralFor(r)) === "Queued" ? (
        <LiveDecisionClock referral={r} now={now} />
      ) : null}

      <dl className={cx(a.strip, panel.facts)}>
        <div>
          <dt>From</dt>
          <dd>{siteByCode(r.originSiteCode)?.name ?? r.originSiteCode}</dd>
          <dd className={a.stripSub}>{REFERRAL_SOURCE_WORDS[r.source]}</dd>
        </div>
        {/* U3: once every request is answered there is nothing being asked for, so the cell goes. */}
        {sender.referralFor(r) === undefined && openArms(r).length > 0 ? (
          <div>
            <dt>Asking for</dt>
            <dd>{askingForShort(r)}</dd>
            <dd className={a.stripSub}>
              {/* "Locked", the word the Needs column uses (F-24), not "Secure". */}
              {needWords(r)
                .map((word) => (word === "Secure bed" ? "Locked bed" : word))
                .join(", ") || "No bed needs"}
            </dd>
          </div>
        ) : null}
        {(() => {
          // Round 4: the one place the legal status shows in the panel, amber when it is missing.
          const legal = r.intake?.legalStatus?.trim();
          const missing = !legal || /^not recorded$/i.test(legal);
          return (
            <div data-testid="ward-referral-detail-legal-status" className={missing ? panel.legalMissing : undefined}>
              <dt>Legal status</dt>
              <dd>
                {missing ? <TriangleAlert size={13} aria-hidden="true" /> : null}
                {missing ? "Not recorded" : legal}
              </dd>
            </div>
          );
        })()}
        {/* v10 phone: the facts read as a two by two grid, so the needs get their own cell. */}
        {/* Hidden above the phone by CSS, so screen readers meet it only where it shows. */}
        <div className={a.stripPhone}>
          <dt>Needs</dt>
          <dd>
            {(() => {
              const summary = sender.referralFor(r);
              if (summary === null) return "Destination details unavailable";
              if (summary !== undefined) return "Destination details are restricted";
              const ward = wardArm(r)?.destination;
              const words = [
                ward?.secureBedNeeded ? "Locked bed" : undefined,
                ward?.involuntaryBedNeeded ? "Involuntary" : undefined,
                ward?.highAcuityNursingNeeded ? "High acuity" : undefined,
                r.transportNeeded ? "Transport" : undefined,
              ].filter(Boolean);
              return words.length > 0 ? words.join(", ") : "None";
            })()}
          </dd>
        </div>
      </dl>
    </>
  );

  const viewSwitch = (
    <Tabs
      label="Referral views"
      idPrefix="ward-referral-view"
      className={a.viewTabs}
      value={view}
      onChange={setView}
      items={[
        { id: "queue", label: "Queue", count: queued.length },
        { id: "history", label: "History", count: decidedTotal },
      ]}
    />
  );

  return (
    <div
      className={styles.screen}
      data-testid="ward-referral-board-screen"
      data-referral-view="register"
      data-ward-design="v6"
      data-referral-layout="queue-panel"
    >
      <main id="main-content" className={cx(styles.main, redesign.page)}>
        <h1 className="sr-only">Referrals</h1>
        {phoneLayout ? (
          <ReferralPhoneTop>
            <ReferralPhoneHero
              count={queued.length}
              oldest={oldestClocks ? durMinutes(oldestClocks.sinceReferral) : undefined}
              median={
                medianDecision === undefined ? undefined : (
                  <>
                    decided in <b>{durMinutes(medianDecision)}</b> (median)
                  </>
                )
              }
              overdue={overdueQueued.length}
              tier1={queued.filter((r) => highlightTest("tier1", r, now)).length}
              bedsReady={bedsSummary.total}
              highlight={highlight}
              onHighlight={(key) => {
                setHighlight((current) => (current === key ? null : key));
              }}
              bedsOpen={phoneSheet === "beds"}
              onBeds={() => setPhoneSheet("beds")}
              onNextOverdue={selectNextOverdue}
              onMeeting={() => setSheet("meeting")}
            />
            {recipientFiltersAvailable ? (
              <ReferralPhoneChips
                chips={(["ward", "ed", "both", "community", "refused"] as const)
                  .map((key) => ({
                    key,
                    label: key === "refused" ? "Refused once" : HIGHLIGHT_LABELS.find(([k]) => k === key)![1],
                    count: queued.filter((r) => highlightTest(key, r, now)).length,
                  }))
                  // Review fix 3: an empty highlight hides unless it is the one pressed.
                  .filter((chip) => chip.count > 0 || highlight === chip.key)}
                highlight={highlight}
                onHighlight={(key) => {
                  const chosen = HIGHLIGHT_KEYS.find((k) => k === key);
                  if (!chosen) return;
                  setHighlight((current) => (current === chosen ? null : chosen));
                }}
              />
            ) : null}
            {queued.length > 0 ? (
              <ReferralPhoneCard
                title="Waiting time against due times"
                meta={`${queued.filter((r) => highlightTest("overdue", r, now)).length} overdue · due T1 ${OVERDUE_AFTER_MINUTES_BY_TIER[1] / 60}h · T2 ${OVERDUE_AFTER_MINUTES_BY_TIER[2] / 60}h · T3 ${OVERDUE_AFTER_MINUTES_BY_TIER[3] / 60}h`}
                expanded={phoneSheet === "axis"}
                onOpen={() => setPhoneSheet("axis")}
              />
            ) : null}
            <Sheet
              open={phoneSheet !== null}
              onClose={() => setPhoneSheet(null)}
              title={phoneSheet === "beds" ? BEDS_READY_SCOPED_TITLE : "Waiting time against due times"}
              description={DUE_TIMES_NOTE}
            >
              <div className={p.sheetHero}>
                {phoneSheet === "axis" ? (
                  <WaitRunway
                    compact
                    queued={queued}
                    now={now}
                    selectedId={selectedReferralId}
                    isHighlighted={(referral) => anyHighlight && isHighlighted(referral)}
                    nameOf={nameOf}
                    onSelect={(id) => {
                      setPhoneSheet(null);
                      setView("queue");
                      handleSelect(id);
                    }}
                  />
                ) : null}
                <BedsReady summary={bedsSummary} compact />
              </div>
            </Sheet>
          </ReferralPhoneTop>
        ) : (
          <div className={styles.v6HeroWrap} data-testid="ward-referral-kpis">
            <Hero
              eyebrow="Referrals"
              title={`${queued.length} awaiting decision`}
              titleMeta={
                <span className={cx(a.heroMeta, panel.heroMeta)}>
                  {/* Round 4: shorter. The full median wording stays in its tooltip. */}
                  Oldest <b>{oldestClocks ? durMinutes(oldestClocks.sinceReferral) : "none"}</b>
                  {medianDecision !== undefined ? (
                    <span
                      className={a.heroMedian}
                      title={`Median time to decide across ${decisionMinutes.length} decided referrals`}
                    >
                      {" "}
                      · decided in <b>{durMinutes(medianDecision)}</b> (median)
                    </span>
                  ) : null}
                </span>
              }
              className={a.heroA}
              // v10: no New referral in the hero. The header's New referral is the page's one primary.
              aside={<LiveChip state="live" onHero />}
              bar={
                <div className={cx(a.pills, panel.pills)} role="group" aria-label="Highlight referrals">
                  {/* Review fix 3: every highlight in one place. Refused once joins the set, and a
                      highlight with nobody in it hides unless it is the one pressed. */}
                  {[...HIGHLIGHT_LABELS, ["refused", "Refused once"] as const]
                    .filter(([key]) => recipientFiltersAvailable || key === "overdue" || key === "tier1")
                    .map(([key, label]) => {
                      const count = queued.filter((r) => highlightTest(key, r, now)).length;
                      if (count === 0 && highlight !== key) return null;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={cx(a.pill, panel.pill)}
                          aria-pressed={highlight === key}
                          data-tone={
                            count === 0
                              ? undefined
                              : key === "overdue"
                                ? "danger"
                                : key === "tier1"
                                  ? "warning"
                                  : undefined
                          }
                          data-empty={count === 0 ? "true" : undefined}
                          data-testid={`ward-referral-highlight-${key}`}
                          onClick={() => {
                            setHighlight((current) => (current === key ? null : key));
                          }}
                        >
                          <span className={a.pillCount}>{count}</span>
                          {key === "overdue" ? <TriangleAlert size={12} aria-hidden="true" /> : null}
                          {label}
                          {highlight === key ? (
                            <span className={panel.pillX} aria-hidden="true">
                              <X size={12} aria-hidden="true" />
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              }
              barAside={
                <HeroTools
                  overdueCount={overdueQueued.length}
                  meetingCount={meetingHighlightIds ? meetingHighlightIds.size : meetingRows.length}
                  onNextOverdue={selectNextOverdue}
                  onMeeting={() => setSheet("meeting")}
                />
              }
              foot={
                <div className={cx(a.heroBand, redesign.heroBand, panel.heroBandStack)}>
                  <WaitRunway
                    queued={queued}
                    now={now}
                    selectedId={selectedReferralId}
                    isHighlighted={(referral) => anyHighlight && isHighlighted(referral)}
                    nameOf={nameOf}
                    onSelect={(id) => {
                      setView("queue");
                      handleSelect(id);
                    }}
                  />
                  <BedsStrip summary={bedsSummary} />
                </div>
              }
            />
          </div>
        )}

        <div className={cx(styles.registerLayout, a.layout)}>
          {selectedReferral ? (
            <div
              className={styles.detailBackdrop}
              onClick={closeDetail}
              aria-hidden="true"
              data-testid="ward-referral-detail-backdrop"
            />
          ) : null}
          <div className={styles.registerQueue} role="region" aria-label="Referral queues" tabIndex={0}>
            <Card className={cx(styles.v6QueueCard, a.queueCard, redesign.wrapRows)}>
              {/* Phone (Josh, 12 Oct 2026): Queue and History pin under the phone header, as Home's
                  queue switch does. The row sits in the queue card beside the list it pins over. */}
              {phoneLayout ? <div className={cx(a.phoneViewRow, wardPin.pinnedSwitch)}>{viewSwitch}</div> : null}
              <div className={cx(a.toolbar, redesign.toolbarDesk)}>
                {phoneLayout ? null : viewSwitch}
                {/* Redesign (Josh, 30 Oct 2026): no Filter queue box. Seven rows need no search, and the
                    highlights and the app search cover finding one person. */}
                <span className={a.toolbarNote}>
                  {anyHighlight && view === "queue" ? (
                    <>
                      {anyHighlight ? (
                        <span data-testid="ward-referral-highlight-note">
                          <b>
                            {highlightedCount} of {queued.length}
                          </b>{" "}
                          {phoneFiltered ? "shown" : "highlighted · all rows stay"}
                        </span>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={clearHighlights}>
                        Clear
                      </Button>
                    </>
                  ) : view === "queue" ? (
                    // Redesign (Josh, 30 Oct 2026): History is newest decision first, so the queue's
                    // order note shows on the queue only.
                    <span
                      className={a.orderNote}
                      data-testid="ward-referral-board-order-note"
                      title="Longest wait first, tier breaks ties"
                    >
                      <ListOrdered size={14} aria-hidden="true" />
                      <b>Longest wait first</b>
                      <span className={a.orderTie}> · tier breaks ties</span>
                    </span>
                  ) : null}
                </span>
              </div>
              <TabPanel idPrefix="ward-referral-view" id="queue" hidden={view !== "queue"}>
                {presentationLists.unavailable.length > 0 ? (
                  <div role="status">
                    <p>Referral progress unavailable.</p>
                    {presentationLists.unavailable.map((referral) => (
                      <button
                        type="button"
                        className={a.rowSelect}
                        key={referral.id}
                        onClick={() => handleSelect(referral.id)}
                      >
                        {resolveSubjectPatient(referral, resolverState).umrn}
                      </button>
                    ))}
                  </div>
                ) : null}
                <QueuedSection
                  progressUnavailable={presentationLists.unavailable.length > 0}
                  queued={listedQueued}
                  searchMiss={phoneFiltered && listedQueued.length === 0 && queued.length > 0}
                  filterMiss={phoneFiltered}
                  now={now}
                  selectedId={selectedReferralId}
                  onSelect={handleSelect}
                  units={units}
                  movements={movements}
                  patients={patients}
                  allReferrals={referrals}
                  readmissionIndex={readmissionIndex}
                  isHighlighted={(referral) => anyHighlight && !phoneFiltered && isHighlighted(referral)}
                  isDimmed={(referral) =>
                    anyHighlight && !phoneFiltered && !isHighlighted(referral) && !isOverdue(referral, now)
                  }
                />
                <WardOffersTable
                  movements={movements}
                  referrals={referrals}
                  units={units}
                  patients={patients}
                  now={now}
                />
              </TabPanel>
              <TabPanel idPrefix="ward-referral-view" id="history" className={a.history} hidden={view !== "history"}>
                <DecidedSection
                  decided={decided}
                  decidedTotal={decidedTotal}
                  units={units}
                  movements={movements}
                  patients={patients}
                  now={now}
                  selectedId={selectedReferralId}
                  onSelect={handleSelect}
                />
                {decisionsByHour.length > 0 ? (
                  <div className={styles.v6Chart}>
                    <h3 className={styles.v6Eyebrow}>Decisions by hour</h3>
                    <ColumnChart
                      columns={decisionsByHour}
                      height={72}
                      label="Referral decisions recorded today, by hour"
                    />
                  </div>
                ) : null}
              </TabPanel>
              <div className={a.queueFoot}>
                <span className={a.keyHint} data-kbd-hint="">
                  <Kbd>J</Kbd>
                  <Kbd>K</Kbd> move
                </span>
                <span className={a.keyHint} data-kbd-hint="">
                  <Kbd>Esc</Kbd> close
                </span>
                <button type="button" className={a.keyLink} data-kbd-hint="" onClick={() => setSheet("keys")}>
                  <Kbd>?</Kbd> all shortcuts
                </button>
                {/* v10 phone: the order note sits under the queue instead of in the toolbar. */}
                {view === "queue" ? (
                  <span className={a.phoneFootNote} aria-hidden="true">
                    Longest wait first · tier breaks ties
                  </span>
                ) : null}
              </div>
            </Card>
          </div>

          <div
            ref={detailRef}
            className={cx(styles.registerDetail, a.detail)}
            role="region"
            aria-label="Selected referral detail"
            tabIndex={0}
            data-has-selection={selectedReferral ? "true" : "false"}
          >
            {selectedReferral ? (
              <Card className={cx(styles.v6DetailCard, a.panel, panel.panel)}>
                <div className={cx(a.panelTop, panel.top)}>
                  <div className={cx(a.panelHead, panel.head)}>
                    <Avatar name={selectedPatientInfo.displayName} size="lg" decorative />
                    <div className={a.panelWho}>
                      <h2 className={cx(a.panelName, panel.name)}>
                        {/* "Surname, First", as the queue beside it (simplification A8, 19 Oct 2026). */}
                        {selectedPatientInfo.formalName}
                        <span className="sr-only"> {selectedPatientInfo.umrn}</span>
                      </h2>
                      <p className={cx(a.panelMeta, panel.meta)}>
                        {/* Shown, never copied: no UMRN goes on the clipboard (D-71 item 7, 21 Oct 2026). */}
                        <span className={umrnCopyable ? a.mono : undefined}>{selectedUmrn}</span>
                        <span aria-hidden="true">·</span>
                        <span>{personLine(selectedReferral)}</span>
                      </p>
                    </div>
                    <span
                      className={a.panelTier}
                      data-priority={selectedPriority}
                      data-testid={`ward-referral-inspector-priority-${selectedReferral.id}`}
                      title={urgencyTierLabel(selectedReferral.urgency)}
                    >
                      <span aria-hidden="true">
                        <TierTile tier={selectedReferral.urgency} />
                      </span>
                      <span className="sr-only">
                        {urgencyTierLabel(selectedReferral.urgency)},{" "}
                        {referralPriorityLabel(selectedPriority ?? "routine")}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      iconOnly
                      aria-label="Close referral detail (Esc)"
                      title="Close (Esc)"
                      onClick={closeDetail}
                    />
                  </div>

                  {readOnly ? (
                    <p className={a.panelMeta} data-testid="ward-referral-read-only">
                      Read only. The coordinator and the receiving ward answer this referral.
                    </p>
                  ) : null}
                  <div className={panel.alerts}>
                    <ReferralAlerts
                      hideLegal
                      referral={selectedReferral}
                      readmission={
                        selectedReadmission ? <ReadmissionFlag flag={selectedReadmission} expandable={false} /> : null
                      }
                    />
                  </div>
                  {!isPhone ? renderDetailFacts(selectedReferral) : null}

                  {!isPhone ? (
                    <Tabs
                      label="Referral detail"
                      idPrefix="ward-referral-inspector"
                      className={a.panelTabs}
                      value={inspectorTab}
                      onChange={setInspectorTab}
                      items={[
                        ...(readOnly
                          ? []
                          : [
                              {
                                id: "place" as const,
                                label: wardArm(selectedReferral) ? "Place" : "Decide",
                                count: selectedReadyUnits,
                              },
                            ]),
                        { id: "patient", label: "Patient" },
                        {
                          id: "timeline",
                          label: "Timeline",
                          count:
                            sender.referralFor(selectedReferral) === undefined
                              ? referralTimeline(selectedReferral, units).length
                              : undefined,
                        },
                      ]}
                    />
                  ) : null}
                </div>

                {isPhone ? (
                  <div className={cx(styles.registerDetailBody, a.panelBody, mph.body)}>
                    {renderDetailFacts(selectedReferral)}
                    {(() => {
                      const stages = referralJourneyStages(selectedReferral, now, sender.referralFor(selectedReferral));
                      return stages ? (
                        <section className={mph.journey} aria-labelledby="ward-referral-phone-journey">
                          <p className={mph.ch} id="ward-referral-phone-journey">
                            Journey
                          </p>
                          <JourneyStrip
                            label="Referral journey"
                            stages={stages}
                            formatDuration={journeyDuration}
                            note={false}
                          />
                          {(() => {
                            // U3 (review 12 Oct 2026): words, not "Now: Bed offered 0s".
                            const current = stages.find((stage) => stage.now);
                            return current ? (
                              <p className={mph.journeyNote} aria-hidden="true">
                                {current.label}{" "}
                                {current.minutes < 1 ? "just now" : `${durMinutes(current.minutes)} ago`}
                              </p>
                            ) : null;
                          })()}
                        </section>
                      ) : null;
                    })()}
                    {(() => {
                      // Redesign (Josh, 30 Oct 2026): the pane's show-more controls share one chevron row.
                      const phoneExtras = (
                        <>
                          <button
                            type="button"
                            className={redesign.disclosureRow}
                            aria-expanded={phoneTimelineOpen}
                            onClick={() => setPhoneTimelineOpen((open) => !open)}
                          >
                            {phoneTimelineOpen
                              ? "Hide timeline"
                              : `Show timeline, ${referralTimeline(selectedReferral, units).length} ${referralTimeline(selectedReferral, units).length === 1 ? "event" : "events"}`}
                          </button>
                          {phoneTimelineOpen ? (
                            <TimelineTab referral={selectedReferral} units={units} now={now}>
                              <ReferralHistoryAndCorrections
                                referral={selectedReferral}
                                now={now}
                                dispatch={dispatch}
                                readOnly={readOnly}
                              />
                            </TimelineTab>
                          ) : null}
                          <button
                            type="button"
                            className={redesign.disclosureRow}
                            aria-expanded={phonePatientOpen}
                            onClick={() => setPhonePatientOpen((open) => !open)}
                          >
                            {phonePatientOpen ? "Hide patient details" : "Show patient details"}
                          </button>
                          {phonePatientOpen ? (
                            <PatientTab
                              referral={selectedReferral}
                              now={now}
                              personName={selectedPatientInfo.formalName}
                              readOnly={readOnly}
                            />
                          ) : null}
                          <div className={mph.acts}>
                            <span className={a.spacer} />
                            <SummaryButton onClick={() => setSheet("summary")} />
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={ChevronRight}
                              onClick={() => selectAt(1)}
                              title="Next referral (J)"
                            >
                              Next
                            </Button>
                          </div>
                        </>
                      );
                      // D-80: a read-only board shows the timeline and patient details with no decision list.
                      return readOnly ? (
                        phoneExtras
                      ) : (
                        <ReferralMatchView
                          key={selectedReferral.id}
                          referral={selectedReferral}
                          units={units}
                          now={now}
                          dispatch={dispatch}
                          rejections={rejections}
                          patientInfo={selectedPatientInfo}
                          hideDossierHeader
                          onDecision={decide(selectedReferral)}
                          phone={phoneExtras}
                        />
                      );
                    })()}
                  </div>
                ) : (
                  <TabPanel
                    key={`${selectedReferral.id}-${inspectorTab}`}
                    idPrefix="ward-referral-inspector"
                    id={inspectorTab}
                    className={cx(styles.registerDetailBody, a.panelBody)}
                  >
                    {inspectorTab === "place" && !readOnly ? (
                      <HistoryFoldProvider
                        value={{ open: historyOpen, onToggle: () => setHistoryOpen((open) => !open) }}
                      >
                        <ReferralMatchView
                          key={selectedReferral.id}
                          referral={selectedReferral}
                          units={units}
                          now={now}
                          dispatch={dispatch}
                          rejections={rejections}
                          patientInfo={selectedPatientInfo}
                          hideDossierHeader
                          onDecision={decide(selectedReferral)}
                        />
                      </HistoryFoldProvider>
                    ) : null}
                    {inspectorTab === "patient" ? (
                      <PatientTab
                        referral={selectedReferral}
                        now={now}
                        personName={selectedPatientInfo.formalName}
                        readOnly={readOnly}
                      />
                    ) : null}
                    {inspectorTab === "timeline" ? (
                      <TimelineTab referral={selectedReferral} units={units} now={now}>
                        <ReferralHistoryAndCorrections
                          referral={selectedReferral}
                          now={now}
                          dispatch={dispatch}
                          readOnly={readOnly}
                        />
                      </TimelineTab>
                    ) : null}
                  </TabPanel>
                )}

                {/* Round 4 (Josh, 31 Oct 2026): the panel's useful buttons sit in a quiet bar
                    anchored at the bottom, under the decision. */}
                {!isPhone ? (
                  <div className={panel.bottomBar}>
                    {/* Round 4: what can be done here, on every tab. The Place tab pins its own
                        Decline and Accept; the other tabs offer the way back to them, and a
                        read-only desk says so. */}
                    {readOnly ? (
                      <p className={panel.bottomNote} data-testid="ward-referral-read-only-foot">
                        Read only at this desk
                      </p>
                    ) : followUpAction(selectedReferral) !== null ? (
                      <div className={panel.bottomActions}>{followUpAction(selectedReferral)}</div>
                    ) : inspectorTab !== "place" &&
                      outcomeLabel(selectedReferral, sender.referralFor(selectedReferral)) === "Queued" ? (
                      <div className={panel.bottomActions}>
                        <Button
                          variant="pri"
                          size="sm"
                          onClick={() => setInspectorTab("place")}
                          data-testid="ward-referral-foot-decide"
                        >
                          {wardArm(selectedReferral) ? "Accept or decline" : "Decide"}
                        </Button>
                      </div>
                    ) : null}
                    <PanelNav
                      position={(() => {
                        const index = queued.findIndex((referral) => referral.id === selectedReferral.id);
                        return index === -1 ? undefined : index + 1;
                      })()}
                      total={queued.length}
                      onPrevious={() => selectAt(-1)}
                      onNext={() => selectAt(1)}
                      onSummary={() => setSheet("summary")}
                      patientHref={selectedReferral.patientId ? patientHref(selectedReferral.patientId) : undefined}
                    />
                  </div>
                ) : null}
                <IsbarSheet
                  open={sheet === "summary"}
                  onClose={() => setSheet(null)}
                  referral={selectedReferral}
                  name={selectedPatientInfo.formalName}
                  umrn={selectedUmrn}
                  demographics={demographicLabel(selectedReferral)}
                  now={now}
                  recorded={isbarRecorded(selectedReferral, movements, referrals)}
                />
              </Card>
            ) : (
              <Card className={styles.v6DetailCard}>
                <section className={styles.registerEmpty} aria-labelledby="ward-referral-detail-heading">
                  <h2 id="ward-referral-detail-heading" className="sr-only">
                    Referral detail
                  </h2>
                  <EmptyState
                    icon={ClipboardList}
                    title={
                      readOnly
                        ? "Select a queued referral to review its facts."
                        : "Select a queued referral to review its facts and record a decision."
                    }
                    meta={`${queued.length} awaiting decision · ${decidedTotal} decided`}
                  />
                  {leftNotice ? (
                    <p role="status" data-testid="ward-referral-decided-elsewhere">
                      {leftNotice}
                    </p>
                  ) : null}
                </section>
              </Card>
            )}
          </div>
        </div>

        <BedMeetingSheet
          open={sheet === "meeting"}
          onClose={() => setSheet(null)}
          rows={meetingRows}
          highlightedIds={meetingHighlightIds}
          highlightLabel={meetingHighlightLabel}
          scopeLabel={meetingScopeLabel}
          now={now}
          summary={bedsSummary}
        />
        <ShortcutsSheet open={sheet === "keys"} onClose={() => setSheet(null)} />
        {pulling ? (
          <Sheet
            open
            onClose={() => setPulling(undefined)}
            title="Pull the bed"
            description="Anything already recorded is filled in. Check the details, then pull the bed."
            testId="ward-referral-pull-sheet"
          >
            <PullAcceptedReferral item={pulling} onDone={() => setPulling(undefined)} />
          </Sheet>
        ) : null}

        <WardPrototypeFooter
          testId="ward-referral-board-governance"
          note="It places nobody; coordinators record referral decisions one at a time · Not approved for clinical use"
        />
      </main>
    </div>
  );
}

/** The record's legal status and clearance for the summary: the linked journey's, or the referral's own. */
function isbarRecorded(
  referral: Referral,
  movements: readonly Movement[],
  referrals: readonly Referral[],
): IsbarRecorded {
  const linked = movements.find((movement) => movement.referralId === referral.id && !movement.closure);
  return {
    legalStatus: linked?.legalStatus,
    clearance: linked ? recordedMovementMedicalClearance(linked, referrals) : referral.medicalClearance,
  };
}
