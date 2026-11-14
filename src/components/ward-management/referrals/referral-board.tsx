"use client";

import { useSharedReadyLookup } from "@/components/ward-management/use-shared-ready";
import { PatientPeekLink } from "@/components/ward-management/patients/patient-peek-link";
import { useLocationSearch } from "@/components/ward-management/ward-url-state";
import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";

import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";
import { BED_MEETING_REFERRALS_HREF } from "@/components/ward-management/bed-meeting/bed-meeting-actions";
import { BEDS_READY_SCOPED_TITLE } from "@/components/ward-management/ward-shared-figures";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import Link from "next/link";
import { useSenderPresentation } from "@/components/ward-management/ward-sender-presentation";
import {
  referralPresentation,
  referralPresentationLists,
} from "@/components/ward-management/ward-partial-view-presenters";
import { presentationDecidedAt, outcomeLabel } from "./referral-board-model";
import {
  acceptedPullDesk,
  acceptedReferralsAwaitingPull,
  acceptedWardOf,
  type AcceptedAwaitingPull,
} from "./accepted-ward-referral";
import { CopyNotesButton } from "./copy-notes-button";
import { referralAcceptanceNotesText } from "@/components/ward-management/referral-notes-text";
import { ChevronLeft, ChevronRight, FileText, ListOrdered, TriangleAlert, UserRound } from "lucide-react";

import { formatSheetMoment } from "@/components/ward-management/ward-clock";
import { overlayOpener } from "@/components/wf/sheet-focus";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { type Referral } from "@/components/ward-management/ward-model";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { createReadmissionIndex, referralReadmissionFlag } from "@/components/ward-management/ward-readmission";
import { ReadmissionFlag, useReadmissionFlagVisible } from "@/components/ward-management/ward-readmission-flag";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { acceptedAddressing, referralClocks } from "@/components/ward-management/ward-referrals";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import {
  Button,
  Card,
  ColumnChart,
  DrawerFootRow,
  Hero,
  JourneyStrip,
  Kbd,
  LiveChip,
  PanelDrawer,
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
import { HistoryFoldProvider } from "./folded-history-context";
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
  waitWords,
  wardArm,
} from "./referral-board-parts";
import { referralWaitLine } from "./referral-wait";
import {
  REFERRAL_ACCEPT_CONTROL,
  REFERRAL_DECLINE_CONTROL,
  REFERRAL_DRAWER_TEST_ID,
  isTyping,
  isbarRecorded,
  otherOverlayOpen,
} from "./referral-board-helpers";
import styles from "./referrals.module.css";
import { demographicLabel, journeyDuration, referralJourneyStages } from "./referral-board-model";
import { DecidedSection, QueuedSection } from "./referral-board-sections";
import { WaitRunway } from "./wait-runway";
import { ReferralAlerts } from "./referral-alerts";
import { BedsStrip, HeroTools, LiveDecisionClock, personLine } from "./referral-panel-parts";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WardDeskEmptyQueue, useWardDeskPlace } from "./referral-ward-desk";
import { wardDeskAnswerCount } from "./home-ward-offers";
import desk from "./referral-desk.module.css";
import panel from "./referral-panel.module.css";
import { PatientTab, TimelineTab } from "./referral-panel-tabs";
import { CommunityTeamLink, useCommunityDesk } from "./referral-community-desk";
import { HighlightPills, decisionStats, deskHeroWords } from "./referral-board-hero";
import { ReferralCoordinatorTop } from "./referral-board-top";
import { HIGHLIGHT_KEYS, HIGHLIGHT_LABELS, highlightTest, type HighlightKey } from "./referral-highlights";

// The bed meeting, ISBAR and shortcut sheets open only on request, so they load after first render.
const IsbarSheet = dynamic(
  withLoadRetry(() => import("./referral-summary-sheet").then((m) => m.ReferralSummarySheet)),
  {
    ssr: false,
  },
);
const ShortcutsSheet = dynamic(
  withLoadRetry(() => import("./referral-board-sheets").then((m) => m.ShortcutsSheet)),
  { ssr: false },
);
const PullAcceptedReferral = dynamic(
  withLoadRetry(() => import("./pull-accepted-referral").then((m) => m.PullAcceptedReferral)),
  {
    ssr: false,
  },
);
import a from "./referral-board.module.css";
import p from "./referral-board-phone.module.css";
import wardPin from "@/components/ward-management/ward-pinned-switch.module.css";
import { ReferralPhoneCard, ReferralPhoneHero, ReferralPhoneTop } from "./referral-board-phone";
import { edSingleColumn, useEdDeskReferrals } from "./referral-ed-desk";
import { EdNextOverdue, ReferralEdRaisedSection } from "./referral-ed-raised-section";
import { focusIsLost, rememberOpener, returnFocusToOpener, useIsPhone, type FocusOpener } from "@/components/wf";
import { focusAfterDecision, focusQueueFallback, nextQueuedId } from "./referral-focus-fallback";
import mph from "./referral-match-phone.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { ListExportButton } from "@/components/ward-management/ward-list-export-button";
import { movementHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { recordIdFromParam } from "@/components/ward-management/shell/ward-record-address";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

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
type InspectorTab = "place" | "patient" | "timeline";
type BoardSheet = "summary" | "keys" | null;

/**
 * Option A (Josh, 9 October 2026): the statewide referral queue as a dense table with a decision
 * panel beside it. The hero carries the page's own tools: highlight pills, the waiting runway,
 * beds ready statewide, Next overdue and the bed meeting list. Filters highlight and never hide a
 * referral; the queue stays longest wait first with the tier only breaking ties (D-32).
 * Redesign (Josh, 31 October 2026): queue rows wrap, the ward offers are a table, the written
 * history folds behind one button and the decision buttons sit in a bar at the panel's foot.
 */
export function ReferralBoard({
  readOnly: readOnlyProp,
  historyOpenOnLoad = false,
  heading = "Referrals",
}: {
  /**
   * Kept for the routes that pass it. Drawer review (6 Nov 2026): the detail is a modal drawer now,
   * so nothing opens until a referral is chosen or linked (`?referral=`).
   */
  defaultSelectFirst?: boolean;
  heading?: string;
  /** Viewing, filters and the detail only: no decision, placement, owner or call control. */
  readOnly?: boolean;
  /** Opens on History rather than the queue (the redesign preview draws it this way). */
  historyOpenOnLoad?: boolean;
} = {}) {
  // H7 (D-MCA (Josh, 14 Nov 2026)): the shared Ready for the selected referral's fit count.
  const readyLookup = useSharedReadyLookup();
  const zone = useClockZoneLabel();
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
  // Community desk (Josh, 31 Oct 2026): the team's own referrals. Its branches are marked
  // "Community desk"; the board's permissions for this desk are unchanged.
  const community = useCommunityDesk();
  const {
    referrals,
    units,
    dispatch,
    rejections,
    movements = [],
    patients = [],
    admissions = [],
    bedReleases = [],
    dayZero,
  } = useWardFlowSelect(
    "referrals",
    "units",
    "dispatch",
    "rejections",
    "movements",
    "patients",
    "admissions",
    "bedReleases",
    "dayZero",
  );
  // ROLE BRANCH (ward): this ward's name, and its own units for beds ready. Every unit on other desks.
  const { ownWardName, bedUnits } = useWardDeskPlace(units);
  const now = useWardFlowClock();
  const router = useOptionalRouter();
  // ED desk view (Josh, 31 Oct 2026): leads with what this ED raised; the queue is its ED reviews.
  const edDeskView = useEdDeskReferrals(movements, now);
  const sender = useSenderPresentation();
  const presentationLists = referralPresentationLists(referrals, sender.referralFor);
  const queued = presentationLists.queued;
  const decidedAtFor = (referral: Referral) => presentationDecidedAt(referral, sender.referralFor(referral));
  // `undefined` = nobody has chosen yet; `null` = the coordinator closed the detail. Only the first
  // falls back to the page's default, and only where the detail sits beside the queue. Below 64rem
  // the detail is a full-screen slide-over, and opening it unasked covered the whole board (queue,
  // "New referral" and rail) before anyone had chosen anything (f997ac75a1 + 81553692fb).
  const [chosenReferralId, setSelectedReferralId] = useState<string | null | undefined>(undefined);
  // A1-17: the shared phone query, so the server's phone guess draws the phone layout first.
  const phoneLayout = useIsPhone();
  const [phoneSheet, setPhoneSheet] = useState<"axis" | "beds" | null>(null);
  // A2-5: `?referral=<id>` (the ED row's "Referred to" link) opens that referral until someone chooses.
  const locationSearch = useLocationSearch();
  const linkedReferralId = recordIdFromParam(new URLSearchParams(locationSearch).get("referral"));
  const [selectionTarget, setSelectionTarget] = useState(linkedReferralId);
  if (selectionTarget !== linkedReferralId) {
    setSelectionTarget(linkedReferralId);
    setSelectedReferralId(undefined);
  }
  const linkedReferralUnavailable = linkedReferralId !== null && !referrals.some((r) => r.id === linkedReferralId);
  const selectedReferralId =
    chosenReferralId === undefined
      ? linkedReferralId !== null
        ? linkedReferralUnavailable
          ? undefined
          : linkedReferralId
        : undefined
      : (chosenReferralId ?? undefined);
  const [chosenView, setView] = useState<"queue" | "history">();
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
  const triggerRef = useRef<FocusOpener | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  // Drawer review (6 Nov 2026): the drawer foot, where the decision's Accept and Decline render.
  const [footSlot, setFootSlot] = useState<HTMLDivElement | null>(null);

  // Audit 24-1 B-03: the queued referral on screen, by id and name, so one decided at another desk
  // closes with a notice naming them rather than handing the panel to the next person in the queue.
  const [watchedReferral, setWatchedReferral] = useState<{ id: string; name: string }>();
  const [decidedHereId, setDecidedHereId] = useState<string>();
  const [leftNotice, setLeftNotice] = useState<string>();

  const handleSelect = useCallback((referralId: string) => {
    // Usability review, 24 Oct 2026: Safari leaves focus on <body> after a tap, so take the shared
    // opener (the last pressed control stands in) rather than the active element alone.
    triggerRef.current = rememberOpener(overlayOpener());
    setLeftNotice(undefined);
    setSelectedReferralId(referralId);
    setInspectorTab("place");
  }, []);
  const closeDetail = useCallback(() => {
    // `null`, not `undefined`: a closed detail stays closed rather than falling back to the default.
    setSelectedReferralId(null);
    // A3 (2 Nov 2026): a phone list is inert while the detail is open, so its row is found again next frame.
    const opener = triggerRef.current;
    if (returnFocusToOpener(opener)) return;
    window.requestAnimationFrame(() => {
      // BA-3: a detail the page opened by itself has no opener, so the queue takes focus instead.
      if (focusIsLost(detailRef.current) && !returnFocusToOpener(opener)) focusQueueFallback();
    });
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
  const runwayProps = {
    queued,
    now,
    selectedId: selectedReferralId,
    isHighlighted: (referral: Referral) => anyHighlight && isHighlighted(referral),
    nameOf,
    umrnOf: (referral: Referral) => resolveSubjectPatient(referral, resolverState).umrn,
  };
  const highlightedCount = anyHighlight ? queued.filter(isHighlighted).length : 0;
  /*
   * Audit round 2 (A2-14): on the phone a chip FILTERS. Dimming greyed the overdue row's act-now
   * marker and left the match below the fold. Desktop keeps highlight-and-dim (Josh, 13 Oct 2026),
   * but an overdue (act-now) row is never dimmed on either.
   */
  const phoneFiltered = phoneLayout && anyHighlight;
  const listedQueued = phoneFiltered ? queued.filter(isHighlighted) : queued;

  // Export (feature 44): the whole queue (highlights only dim on a desktop), never names; the
  // builder loads on the click.
  const exportQueue = async () =>
    (await import("./referral-export")).downloadReferralQueue(
      queued,
      {
        sinceReferralOf: (referral) => referralWaitLine(referral, now),
        umrnOf: (referral) => resolveSubjectPatient(referral, resolverState).umrn,
        // An ASCII separator, so a spreadsheet opened without UTF-8 shows the label cleanly.
        tierOf: (referral) => urgencyTierLabel(referral.urgency).replace(" · ", " - "),
        priorityOf: (referral) => referralPriorityLabel(getReferralPriority(referral, now)),
        fromOf: (referral) =>
          siteByCode(referral.originSiteCode)?.name ?? referral.originSiteCode ?? ORIGIN_NOT_RECORDED,
        needsOf: needWords,
        at: (instant) => formatSheetMoment(instant, dayZero),
      },
      {
        asAt: formatSheetMoment(now, dayZero, { includeYearAndZone: true, zone }),
        scope: "Referral queue; every referral in this desk's queue, regardless of highlights",
      },
    );

  const decided = presentationLists.recentlyDecided;
  // The DENOMINATOR, uncapped. `decided` above is already truncated to the display limit, so its
  // length names how many rows are shown and cannot name how many have been decided.
  const allDecided = presentationLists.decided;
  const decidedTotal = allDecided.length;
  // Community desk: an empty queue opens on History, the team's decided referrals.
  const view = chosenView ?? (communityDesk && queued.length === 0 && decidedTotal > 0 ? "history" : "queue");
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
  // ROLE BRANCH (ward): with nothing queued and nothing open, the decision pane would be an empty panel.
  const wardEmpty = wardDesk && queued.length === 0;
  // A9-30 (F-27): the ward's one "to answer" count, offers straight to the ward included.
  const wardAnswerCount = wardDesk ? wardDeskAnswerCount(queued.length, movements, referrals) : queued.length;
  const emptyWardQueue = wardEmpty && selectedReferral === undefined && !leftNotice;
  // WS-03: an accepted referral with no bed pulled, which the coordinator can pull here in one step.
  const awaitingPull = useMemo(
    () => (readOnly ? [] : acceptedReferralsAwaitingPull(referrals, units, movements)),
    [readOnly, referrals, units, movements],
  );
  // ED desk view: no ED review asked of this desk, so the highlights, runway and empty pane go.
  const edQueueEmpty = edDesk && queued.length === 0;
  const edDetailHidden = edQueueEmpty && selectedReferral === undefined;
  const selectedToPull = awaitingPull.find((entry) => entry.referral.id === selectedReferral?.id);
  const selectedPatientInfo = resolveSubjectPatient(selectedReferral, resolverState);
  const selectedReadyUnits =
    selectedReferral && sender.referralFor(selectedReferral) === undefined
      ? readyUnitCount(selectedReferral, units, now, readyLookup)
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
  const { decidedToday, decisionMinutes, medianDecision, decisionsByHour } = decisionStats(
    allDecided,
    decidedAtFor,
    now,
  );
  const bedsSummary = useMemo(
    // D-115: a bed named for an accepted referral is not offered as ready.
    () => bedsReadySummary(bedUnits, admissions, bedReleases, now, [...movements, ...referrals]),
    [bedUnits, admissions, bedReleases, now, movements, referrals],
  );
  // R5 fold (Josh, 3 Nov 2026): the bed meeting's referrals live on the agenda now. The button
  // counts those waiting in the header's service, as the agenda's Referrals list does.
  const serviceScope = useServiceScope();
  const meetingCount = queued.filter(
    (referral) => serviceScope === null || siteByCode(referral.originSiteCode)?.service === serviceScope,
  ).length;
  const selectedPriority = selectedReferral ? getReferralPriority(selectedReferral, now) : undefined;
  // Audit 1 (CS-15, Josh 20 Oct): the toast names the person decided on, and the detail stays on
  // them. A default "first in queue" detail used to slide to the next person, Accept showing, as
  // soon as the decided one left the queue; the next is opened only when the coordinator picks it.
  const decide = (referral: Referral) => (title: string, completion: ReturnType<WardCommandDispatch>) => {
    setSelectedReferralId(referral.id);
    setDecidedHereId(referral.id);
    watchDecision(referral.id, `${title} · ${nameOf(referral)}`, completion);
    // BA-1: the pressed Accept or Decline is gone, so focus moves to the next referral or the outcome.
    focusAfterDecision(
      nextQueuedId(
        queued.map((queuedReferral) => queuedReferral.id),
        referral.id,
      ),
    );
  };

  function selectAt(step: 1 | -1) {
    if (queued.length === 0) return;
    const index = queued.findIndex((referral) => referral.id === selectedReferralId);
    const next = index === -1 ? (step === 1 ? 0 : queued.length - 1) : (index + step + queued.length) % queued.length;
    handleSelect(queued[next]!.id);
  }

  // The referral Next overdue opens: the next overdue after the chosen one, else the first.
  const nextOverdueReferral = (() => {
    if (overdueQueued.length === 0) return undefined;
    const index = queued.findIndex((referral) => referral.id === selectedReferralId);
    return queued.slice(index + 1).find((referral) => isOverdue(referral, now)) ?? overdueQueued[0]!;
  })();

  function selectNextOverdue() {
    if (nextOverdueReferral === undefined) return;
    setView("queue");
    handleSelect(nextOverdueReferral.id);
  }

  // H-0369: the drawer's body returns to its top only when another referral is chosen; opening or
  // closing a sheet must not move it. The drawer (kit Sheet) moves focus in and back itself.
  useEffect(() => {
    if (!selectedReferralId) return;
    const scroll = detailRef.current?.closest<HTMLElement>("[data-drawer-scroll]");
    if (scroll) scroll.scrollTop = 0;
  }, [selectedReferralId]);

  const onShortcutKey = useEffectEvent((e: KeyboardEvent) => {
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      sheet !== null ||
      otherOverlayOpen() ||
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
      const control = document
        .querySelector(`[data-testid="${REFERRAL_DRAWER_TEST_ID}"]`)
        ?.querySelector<HTMLButtonElement | HTMLSelectElement>(
          key === "a" ? REFERRAL_ACCEPT_CONTROL : REFERRAL_DECLINE_CONTROL,
        );
      if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
      e.preventDefault();
      if (control instanceof HTMLSelectElement) control.focus();
      else control.click();
    } else if (key === "s" && selectedReferralId) {
      e.preventDefault();
      setSheet("summary");
    } else if (key === "m" && !edDesk) {
      // Josh, 31 Oct 2026 (answer 35): the ED desk has no bed meeting list, so M does nothing there.
      e.preventDefault();
      // Page tops (Josh, 9 Nov 2026): the agenda is the slate's Bed meeting chip on every layout, so
      // M goes straight to it through the router, as the chip's link does.
      const meeting = document.querySelector('[data-testid="ward-referral-meeting"]');
      if (meeting) {
        if (router) router.push(BED_MEETING_REFERRALS_HREF);
        else if (meeting instanceof HTMLAnchorElement) meeting.click();
        else window.location.assign(BED_MEETING_REFERRALS_HREF);
      }
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
    // S-9 (audit 13 Oct 2026): an accepted referral was a dead end. It links on to its movement when one is open,
    // otherwise names the next step, holding the bed on the accepting ward, and links the patient record.
    return (
      <>
        {linkedMovement ? (
          <Link
            href={movementHref(linkedMovement.id)}
            className={buttonClass({ variant: "pri", size: "md" })}
            data-testid="ward-referral-open-movement"
          >
            Open movement
          </Link>
        ) : readOnly ? null : selectedToPull &&
          !("refusal" in acceptedPullDesk(routeRole, access, selectedToPull.unitId)) ? (
          // WS-03: the bed is pulled here in one step, with the recorded details. D-191 build
          // answers: by the coordinator or the ward desk of the ward that accepted.
          <Button
            size="md"
            variant="pri"
            onClick={() => setPulling(selectedToPull)}
            data-testid="ward-referral-pull-bed"
            data-placement-action
          >
            Pull the bed
          </Button>
        ) : (
          <Link
            href={`/ward-flow/ward/${targetWardUnitId}?tab=board`}
            className={buttonClass({ variant: "pri", size: "md" })}
            title={`Open ${targetWard?.name ?? "ward"} bed board`}
            data-testid="ward-referral-hold-bed"
            data-placement-action
          >
            Pull the bed
          </Link>
        )}
        {/* Item 27 (10 Nov 2026): the acceptance as plain recorded facts, for the notes. */}
        {accepted?.destination.kind === "psychiatric_ward" ? (
          <CopyNotesButton
            testId="ward-referral-copy-acceptance-notes"
            text={() =>
              referralAcceptanceNotesText(selectedReferral, { patientName: nameOf(selectedReferral), units, now }) ?? ""
            }
          />
        ) : null}
      </>
    );
  };

  const selectedUmrn = selectedPatientInfo.umrn;
  const umrnCopyable = /^UM\d{6}$/.test(selectedUmrn);

  /* The wait clock and the facts grid lead the drawer's scrolling body at every width (drawer review,
   6 Nov 2026), so the head stays light and the decision list gets the height. */
  const renderDetailFacts = (r: Referral) => (
    <>
      {referralPresentation(r, sender.referralFor(r)).kind !== "unavailable" &&
      outcomeLabel(r, sender.referralFor(r)) === "Queued" ? (
        <LiveDecisionClock referral={r} now={now} />
      ) : null}

      <dl className={cx(a.strip, panel.facts)}>
        <div>
          <dt>From</dt>
          <dd>{siteByCode(r.originSiteCode)?.name ?? r.originSiteCode ?? ORIGIN_NOT_RECORDED}</dd>
          <dd className={a.stripSub}>{REFERRAL_SOURCE_WORDS[r.source]}</dd>
        </div>
        {/* U3: once every request is answered there is nothing being asked for, so the cell goes. */}
        {sender.referralFor(r) === undefined && openArms(r).length > 0 ? (
          <div>
            <dt>Asking for</dt>
            <dd>{askingForShort(r)}</dd>
            <dd className={a.stripSub}>
              {/* "Locked", the word the Needs column uses (F-24), not "Secure". */}
              {needWords(r).join(", ") || "No bed needs"}
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
          <dt>Bed and transport</dt>
          <dd>
            {(() => {
              const summary = sender.referralFor(r);
              if (summary === null) return "Destination details unavailable";
              if (summary !== undefined) return "Destination details are restricted";
              return needWords(r).join(", ") || "No bed or transport needs recorded";
            })()}
          </dd>
        </div>
      </dl>
    </>
  );

  // ROLE BRANCH (bed_manager, D-80): the board holds only the lines to the site's own wards, so it is
  // headed with the site and stays read only. With nothing queued, the highlights, the waiting band
  // and the sort notes have nothing to act on, so they are left out until a referral waits.
  const siteScope = siteManager && access.scope.kind === "site" ? access.scope : undefined;
  const siteName = siteScope ? (siteByCode(siteScope.siteCode)?.name ?? siteScope.siteCode) : undefined;
  const siteEmpty = siteManager && queued.length === 0;

  const viewSwitchWith = (className: string) => (
    <Tabs
      label="Referral views"
      idPrefix="ward-referral-view"
      className={className}
      value={view}
      onChange={setView}
      items={[
        { id: "queue", label: "Queue", count: queued.length },
        { id: "history", label: "History", count: decidedTotal },
      ]}
    />
  );
  const viewSwitch = viewSwitchWith(a.viewTabs);
  const toolbarNote = (
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
      ) : view === "queue" && !siteEmpty && !emptyWardQueue ? (
        // Redesign (Josh, 30 Oct 2026): History is newest decision first, so the queue's
        // order note shows on the queue only. ROLE BRANCH (ward): none on an empty ward queue.
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
  );
  // Export (feature 44, #1559) sits with the queue it exports, after the toolbar note.
  const exportButton =
    !phoneLayout && view === "queue" && queued.length > 0 ? (
      <ListExportButton load={exportQueue} testId="ward-referral-export" />
    ) : null;
  // Page tops (Josh, 9 Nov 2026): the coordinator's top is the shared page top (`referral-board-top`);
  // the ward, ED, community and site desks keep their own tops below.
  const coordinatorTop = !community && !wardDesk && !edDesk && !siteManager;
  const phoneSheetNode = (
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
            {...runwayProps}
            onSelect={(id) => {
              setPhoneSheet(null);
              setView("queue");
              handleSelect(id);
            }}
          />
        ) : null}
        {/* ROLE BRANCH (ward): no statewide beds panel on a ward desk. */}
        {siteManager || wardDesk ? null : <BedsReady summary={bedsSummary} compact />}
      </div>
    </Sheet>
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
        <h1 className="sr-only">{heading}</h1>
        {linkedReferralUnavailable && chosenReferralId === undefined ? (
          <p role="status">The requested referral is unavailable. Choose a referral from the queue to continue.</p>
        ) : null}
        {coordinatorTop ? (
          <ReferralCoordinatorTop
            level={2}
            testId={phoneLayout ? undefined : "ward-referral-kpis"}
            isPhone={phoneLayout}
            className={a.heroA}
            {...(({ title, titleMeta }) => ({ title, titleMeta }))(
              deskHeroWords({
                queuedCount: queued.length,
                oldest: oldestClocks ? durMinutes(oldestClocks.sinceReferral) : undefined,
                medianDecision,
                decidedCount: decisionMinutes.length,
              }),
            )}
            overdueCount={overdueQueued.length}
            overdueHighlighted={highlight === "overdue"}
            onOverdueFigure={() => setHighlight((current) => (current === "overdue" ? null : "overdue"))}
            nextOverdue={
              nextOverdueReferral
                ? {
                    by: waitWords(nextOverdueReferral, now).due.replace(/ overdue$/u, ""),
                    name: nameOf(nextOverdueReferral),
                  }
                : undefined
            }
            onNextOverdue={selectNextOverdue}
            beds={bedsSummary}
            onBeds={() => setPhoneSheet("beds")}
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
              if (chosen) setHighlight((current) => (current === chosen ? null : chosen));
            }}
            runway={
              queued.length > 0 ? (
                <WaitRunway
                  {...runwayProps}
                  onSelect={(id) => {
                    setView("queue");
                    handleSelect(id);
                  }}
                />
              ) : null
            }
            axisOpen={phoneSheet === "axis"}
            onAxis={() => setPhoneSheet("axis")}
            viewSwitch={viewSwitchWith}
            view={view}
            tabsAside={
              <>
                {toolbarNote}
                {exportButton}
              </>
            }
          >
            {phoneLayout ? phoneSheetNode : null}
          </ReferralCoordinatorTop>
        ) : phoneLayout ? (
          <ReferralPhoneTop>
            <ReferralPhoneHero
              // ROLE BRANCH (bed_manager): the site code fits the phone eyebrow, read only is said here,
              // and no Beds ready (a figure for placing, which this desk does not do).
              eyebrow={siteScope ? `Referrals · ${siteScope.siteCode} wards · read only` : undefined}
              showBeds={!siteManager}
              count={wardAnswerCount}
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
              placeName={ownWardName}
              edHero={edDeskView.phoneHero(queued.length)}
            />
            {/* Community desk: no bed-type chips on the team's own list.
                ROLE BRANCH (bed_manager): no recipient-type chips; every line is its own site's ward's.
                ROLE BRANCH (ward): no destination-type chips, every line is to this ward. */}
            {recipientFiltersAvailable && !siteManager && !community && !wardDesk && !edQueueEmpty ? (
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
            {phoneSheetNode}
          </ReferralPhoneTop>
        ) : (
          <div className={styles.v6HeroWrap} data-testid="ward-referral-kpis">
            <Hero
              {...deskHeroWords({
                queuedCount: wardDesk ? wardAnswerCount : queued.length,
                ed: edDesk ? edDeskView : undefined,
                community,
                ward: wardDesk ? { name: ownWardName, empty: wardAnswerCount === 0 } : undefined,
                site: siteManager ? { name: siteName, empty: siteEmpty } : undefined,
                oldest: oldestClocks ? durMinutes(oldestClocks.sinceReferral) : undefined,
                medianDecision,
                decidedCount: decisionMinutes.length,
              })}
              className={a.heroA}
              // v10: no New referral in the hero. The header's New referral is the page's one primary.
              aside={<LiveChip state="live" onHero />}
              // ROLE BRANCH (ward): a ward's short queue marks overdue and tier on each row, and its queue
              // and meeting list are the same few people, so no pills, Next overdue, meeting list or runway.
              bar={
                // Community desk: the bed-type highlights sort a coordinator's queue; the team's own list needs none.
                siteEmpty || community || wardDesk || edQueueEmpty ? undefined : (
                  <HighlightPills
                    pills={[...HIGHLIGHT_LABELS, ["refused", "Refused once"] as const]
                      // ROLE BRANCH (bed_manager): only Overdue and Tier 1; the type chips sort lines it never holds.
                      .filter(
                        ([key]) => (recipientFiltersAvailable && !siteManager) || key === "overdue" || key === "tier1",
                      )
                      .map(([key, label]) => ({
                        key,
                        label,
                        count: queued.filter((r) => highlightTest(key, r, now)).length,
                      }))}
                    highlight={highlight}
                    onToggle={(key) => setHighlight((current) => (current === key ? null : key))}
                  />
                )
              }
              barAside={
                community ? (
                  <CommunityTeamLink desk={community} />
                ) : wardDesk ? undefined : edDesk ? (
                  // ED desk view: no bed meeting list; Next overdue only while an ED review waits here.
                  edQueueEmpty ? undefined : (
                    <EdNextOverdue overdueCount={overdueQueued.length} onNextOverdue={selectNextOverdue} />
                  )
                ) : (
                  <HeroTools
                    overdueCount={overdueQueued.length}
                    meetingCount={meetingCount}
                    onNextOverdue={selectNextOverdue}
                  />
                )
              }
              foot={
                // Community desk: no waiting runway over the team's short list and no statewide
                // beds-ready figure (the team places nobody); the title and tabs carry the counts.
                siteEmpty || community || wardDesk ? undefined : (
                  <div className={cx(a.heroBand, redesign.heroBand, panel.heroBandStack)}>
                    {edQueueEmpty ? null : (
                      <WaitRunway
                        {...runwayProps}
                        onSelect={(id) => {
                          setView("queue");
                          handleSelect(id);
                        }}
                      />
                    )}
                    {/* ROLE BRANCH (bed_manager): no Beds ready. It counts beds for placing these referrals,
                      the coordinator's job; the site's own beds are on its Capacity page. */}
                    {siteManager ? null : <BedsStrip summary={bedsSummary} />}
                  </div>
                )
              }
            />
          </div>
        )}

        {/* ED desk view: what this ED raised comes first, above the ED reviews asked of it. */}
        {edDesk ? <ReferralEdRaisedSection view={edDeskView} now={now} /> : null}

        {/* ROLE BRANCH (ward): an empty ward queue has no decision to show, so the queue takes the width. */}
        <div
          className={cx(
            styles.registerLayout,
            a.layout,
            emptyWardQueue && desk.single,
            edDetailHidden && edSingleColumn,
          )}
        >
          <div className={styles.registerQueue} role="region" aria-label="Referral queues" tabIndex={0}>
            <Card className={cx(styles.v6QueueCard, a.queueCard, redesign.wrapRows)}>
              {/* Phone (Josh, 12 Oct 2026): Queue and History pin under the phone header, as Home's
                  queue switch does. The row sits in the queue card beside the list it pins over. */}
              {phoneLayout && !coordinatorTop ? (
                <div className={cx(a.phoneViewRow, wardPin.pinnedSwitch)}>{viewSwitch}</div>
              ) : null}
              {/* Page tops (9 Nov 2026): the coordinator's tabs and notes sit under the hero. */}
              {coordinatorTop ? null : (
                <div className={cx(a.toolbar, redesign.toolbarDesk)}>
                  {phoneLayout ? null : viewSwitch}
                  {/* Redesign (Josh, 30 Oct 2026): no Filter queue box. Seven rows need no search, and the
                      highlights and the app search cover finding one person. */}
                  {toolbarNote}
                  {exportButton}
                </div>
              )}
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
                {/* ROLE BRANCH (ward): an empty ward queue shows one line, below, not two. */}
                {wardEmpty ? null : (
                  <QueuedSection
                    dayZero={dayZero}
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
                )}
                {wardEmpty && wardAnswerCount === 0 ? (
                  <WardDeskEmptyQueue wardName={ownWardName} movements={movements} />
                ) : null}
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
                  undoRole={readOnly ? undefined : routeRole}
                  onPull={!readOnly && routeRole === "coordinator" ? setPulling : undefined}
                />
                {decisionsByHour.length > 0 && decidedToday.length > 0 ? (
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
              {/* ROLE BRANCH (ward): no list to move through in an empty ward queue. */}
              {wardEmpty ? null : (
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
                  {view === "queue" && !siteEmpty ? (
                    <span className={a.phoneFootNote} aria-hidden="true">
                      Longest wait first · tier breaks ties
                    </span>
                  ) : null}
                </div>
              )}
            </Card>
          </div>

          {/* Drawer review (6 Nov 2026): the queue takes the full width. A note that used to fill the
              empty detail column (a referral decided elsewhere, a read-only site desk) sits under it. */}
          {!selectedReferral && (leftNotice || (siteName && queued.length === 0)) ? (
            <section className={styles.registerNote} aria-labelledby="ward-referral-detail-heading">
              <h2 id="ward-referral-detail-heading" className="sr-only">
                Referral detail
              </h2>
              {siteName && queued.length === 0 ? (
                // ROLE BRANCH (bed_manager): nothing queued at its own wards. The hero says the queue
                // is empty, so this says only who answers.
                <p data-testid="ward-referral-read-only-empty">
                  <b>Read only.</b> The coordinator and the receiving ward answer each referral.
                </p>
              ) : null}
              {leftNotice ? (
                <p role="status" data-testid="ward-referral-decided-elsewhere">
                  {leftNotice}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        {/* Drawer review (6 Nov 2026): the chosen referral opens in the kit drawer at every width, as
            Transport, Out of area and Discharges do. Head: the name, UMRN and who, the tier tag and the
            queue pager. Body: the one scroll, led by the wait clock and the From, Asking and Legal
            facts. Foot: one band, Accept first, then Decline beside the other quiet actions. */}
        {selectedReferral
          ? (() => {
              const position = queued.findIndex((referral) => referral.id === selectedReferral.id);
              const followUp = readOnly ? null : followUpAction(selectedReferral);
              const queuedNow = outcomeLabel(selectedReferral, sender.referralFor(selectedReferral)) === "Queued";
              const decisionShown = !readOnly && (isPhone || inspectorTab === "place");
              const primary =
                followUp ??
                (!readOnly && !decisionShown && queuedNow ? (
                  <Button
                    variant="pri"
                    size="md"
                    onClick={() => setInspectorTab("place")}
                    data-testid="ward-referral-foot-decide"
                  >
                    {wardArm(selectedReferral) ? "Accept or decline" : "Decide"}
                  </Button>
                ) : null);
              const pager = (
                <span className={styles.drawerPager} role="group" aria-label="Move through the queue">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={ChevronLeft}
                    aria-label="Previous referral (K)"
                    title="Previous (K)"
                    disabled={queued.length < 2}
                    onClick={() => selectAt(-1)}
                  />
                  <span className={styles.drawerPagerCount}>
                    {position === -1 ? `${queued.length} in queue` : `${position + 1} of ${queued.length}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={ChevronRight}
                    aria-label="Next referral (J)"
                    title="Next (J)"
                    disabled={queued.length < 2}
                    onClick={() => selectAt(1)}
                  />
                </span>
              );
              return (
                <PanelDrawer
                  open
                  onClose={closeDetail}
                  title={
                    <>
                      {/* "Surname, First", as the queue (simplification A8, 19 Oct 2026). */}
                      {selectedPatientInfo.formalName}
                      <span className="sr-only"> {selectedPatientInfo.umrn}</span>
                    </>
                  }
                  titleId="ward-referral-detail-title"
                  subtitle={
                    <span className={styles.drawerSubtitle}>
                      <span className={styles.drawerWho}>
                        {/* Shown, never copied: no UMRN goes on the clipboard (D-71 item 7, 21 Oct 2026). */}
                        <span className={umrnCopyable ? a.mono : undefined}>{selectedUmrn}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{personLine(selectedReferral)}</span>
                      </span>
                      {pager}
                    </span>
                  }
                  tag={
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
                  }
                  closeLabel="Close referral detail (Esc)"
                  tabs={
                    isPhone
                      ? undefined
                      : [
                          ...(readOnly
                            ? []
                            : [
                                {
                                  id: "place" as const,
                                  label: wardArm(selectedReferral) ? "Place" : "Decide",
                                  count: selectedReadyUnits,
                                },
                              ]),
                          { id: "patient" as const, label: "Patient" },
                          {
                            id: "timeline" as const,
                            label: "Timeline",
                            count:
                              sender.referralFor(selectedReferral) === undefined
                                ? referralTimeline(selectedReferral, units).length
                                : undefined,
                          },
                        ]
                  }
                  tab={inspectorTab}
                  onTabChange={setInspectorTab}
                  tabsLabel="Referral detail"
                  bodyLabel="Selected referral detail"
                  testId={REFERRAL_DRAWER_TEST_ID}
                  className={styles.detailDrawer}
                  foot={
                    <>
                      {readOnly && siteManager && !isPhone ? (
                        // ROLE BRANCH (bed_manager, D-80): the read-only note names who answers.
                        <p className={styles.drawerFootNote} data-testid="ward-referral-read-only">
                          Read only. The coordinator and the receiving ward answer this referral.
                        </p>
                      ) : readOnly ? (
                        <p className={styles.drawerFootNote} data-testid="ward-referral-read-only-foot">
                          Read only at this desk
                        </p>
                      ) : null}
                      {primary ? <div className={styles.drawerPrimary}>{primary}</div> : null}
                      <DrawerFootRow className={styles.drawerFootRow}>
                        {/* The decision's Accept and Decline land here (ReferralMatchView footSlot). */}
                        <div ref={setFootSlot} className={styles.decisionSlot} />
                        <button
                          type="button"
                          className={buttonClass({ variant: "sec", size: "md" })}
                          onClick={() => setSheet("summary")}
                          title="Referral (S)"
                        >
                          <FileText size={14} aria-hidden="true" />
                          Referral
                        </button>
                        {selectedReferral.patientId ? (
                          <PatientPeekLink
                            movementId={
                              movements.find(
                                (movement) => movement.referralId === selectedReferral.id && !movement.closure,
                              )?.id
                            }
                            href={patientHref(selectedReferral.patientId)}
                            className={buttonClass({ variant: "sec", size: "md" })}
                            data-testid="ward-referral-open-patient"
                          >
                            <UserRound size={14} aria-hidden="true" />
                            Patient
                          </PatientPeekLink>
                        ) : null}
                      </DrawerFootRow>
                    </>
                  }
                >
                  <div ref={detailRef} className={cx(panel.panel, styles.drawerContent)}>
                    {/* ROLE BRANCH (bed_manager): read only is said once; on a wider screen in the foot. */}
                    {readOnly && !(siteManager && !isPhone) ? (
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
                    {renderDetailFacts(selectedReferral)}
                    {isPhone ? (
                      <>
                        {(() => {
                          const stages = referralJourneyStages(
                            selectedReferral,
                            now,
                            sender.referralFor(selectedReferral),
                          );
                          return stages ? (
                            <section className={mph.journey} aria-labelledby="ward-referral-phone-journey">
                              <p className={mph.ch} id="ward-referral-phone-journey">
                                Movement
                              </p>
                              <JourneyStrip
                                label="Referral movement"
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
                                {/* Community desk: no Next over an empty queue, where it does nothing. */}
                                {community && queued.length === 0 ? null : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={ChevronRight}
                                    onClick={() => selectAt(1)}
                                    title="Next referral (J)"
                                  >
                                    Next
                                  </Button>
                                )}
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
                              footSlot={footSlot}
                              phone={phoneExtras}
                            />
                          );
                        })()}
                      </>
                    ) : (
                      <>
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
                              footSlot={footSlot}
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
                      </>
                    )}
                  </div>
                  <IsbarSheet
                    open={sheet === "summary"}
                    onClose={() => setSheet(null)}
                    referral={selectedReferral}
                    name={selectedPatientInfo.formalName}
                    umrn={selectedUmrn}
                    demographics={demographicLabel(selectedReferral)}
                    now={now}
                    recorded={isbarRecorded(selectedReferral, movements, referrals)}
                  />{" "}
                </PanelDrawer>
              );
            })()
          : null}

        <ShortcutsSheet open={sheet === "keys"} onClose={() => setSheet(null)} />
        {pulling ? (
          <Sheet
            open
            onClose={() => setPulling(undefined)}
            title="Pull the bed"
            description="Check the details, then pull the bed."
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
