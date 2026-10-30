"use client";

import { ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  admissionIdOfInboxId,
  alertActionFor,
  alertGroupOf,
  alertKindOf,
  byOldest,
  effectiveOwner,
  isQueueItem,
  raisedAt,
  resolveAlertSubject,
} from "@/components/ward-management/alerts/alerts-model";
import type { QueueEntry, QueueHandlers } from "@/components/ward-management/alerts/alerts-queue";
import { answerSilenceReminder } from "@/components/ward-management/delays/delays-derivations";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { activeActNowItems, activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import { currentShift } from "@/components/ward-management/ward-board-time-features";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { allDeclines, allOverrides, type InboxItem, isOpen } from "@/components/ward-management/ward-derivations";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { currentInboxOwner } from "@/components/ward-management/ward-inbox-snooze";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import {
  movementBelongsToService,
  noRecordedServiceMovementCount,
  referralBelongsToService,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { homeChipFigures, openEdJourneys } from "@/components/ward-management/ward-shared-figures";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { useAddressTab } from "@/components/ward-management/ward-url-state";
import {
  Button,
  buttonClass,
  CheckingFoot,
  Hero,
  HeroStat,
  LiveChip,
  Menu,
  OccupancyRing,
  Segmented,
  Sheet,
} from "@/components/wf";
import { createBrowserStore } from "@/lib/client-store-factory";
import { ExceptionDrawer, type RegisterTabId } from "@/components/ward-management/coordinator/exception-drawer";
import styles from "@/components/ward-management/coordinator/home.module.css";
import { HomeEdPressure } from "@/components/ward-management/coordinator/home-ed-pressure";
import { useHomeLayout } from "@/components/ward-management/coordinator/home-layout";
import { BedsFitTable, PlacementNext } from "@/components/ward-redesign/home/home-parts";
import redesign from "@/components/ward-redesign/home/home-redesign.module.css";
import { ChosenAlertCard, HomeReleaseSheet, MyListCard } from "@/components/ward-management/coordinator/home-list-lazy";
import list from "@/components/ward-management/coordinator/home-list.module.css";
import { PriorityQueue, type QueueHighlight } from "@/components/ward-management/coordinator/priority-queue";
import { ReferralPlacementPanel, ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel-lazy";
import shortlistStyles from "@/components/ward-management/coordinator/shortlist-panel.module.css";

import { useExplicitReview } from "./activity-changes";
import { ActivityPanel, type ActivityTab } from "./activity-panel";
import mock from "./home-activity.module.css";
import { PlannedList, usePlannedRows } from "./planned-list";

/*
 * Audit S-25: the Home ED filter lasts for this browser session, so opening a patient and coming
 * back keeps it (the "Filtered to" chip shows it is on). sessionStorage, wrapped so a blocked
 * store never throws; the server snapshot is no filter.
 */
const HOME_ED_FILTER_KEY = "ward_flow_home_ed_filter";
const HOME_ED_FILTER_EVENT = "ward_flow_home_ed_filter_change";
let homeEdFilterFallback: string | null | undefined;

function readHomeEdFilter(): string | null {
  try {
    return window.sessionStorage.getItem(HOME_ED_FILTER_KEY);
  } catch {
    return homeEdFilterFallback ?? null;
  }
}

function writeHomeEdFilter(edId: string | undefined): void {
  try {
    if (edId) window.sessionStorage.setItem(HOME_ED_FILTER_KEY, edId);
    else window.sessionStorage.removeItem(HOME_ED_FILTER_KEY);
  } catch {
    // A blocked store: the filter lasts for this page only.
    homeEdFilterFallback = edId ?? null;
  }
  try {
    window.dispatchEvent(new Event(HOME_ED_FILTER_EVENT));
  } catch {
    // Nothing else depends on the notification.
  }
}

function subscribeHomeEdFilter(onChange: () => void) {
  window.addEventListener(HOME_ED_FILTER_EVENT, onChange);
  return () => window.removeEventListener(HOME_ED_FILTER_EVENT, onChange);
}

const useHomeEdFilter = createBrowserStore(subscribeHomeEdFilter, readHomeEdFilter, null);
const HOME_VIEWS = ["needs", "queue", "planned"] as const;
/** Preview only: the event the mock-up shell sends when the app bar's Activity button is pressed. */
const OPEN_ACTIVITY_EVENT = "wf-mockup:open-activity";
const NEEDS_FOCI = ["all", "act", "decide"] as const;
const DELAYS_HREF = "/ward-flow/waiting";

/** Phone renders the first 20 queue rows; the rest are one tap away (v10 Home phone mockup). */
const PHONE_QUEUE_ROWS = 20;
/**
 * Desktop Home scrolls once, so the queue shows its top 10 and a "Show all (N)" button reveals the
 * rest in place (Home placement redesign, Josh 19 Oct 2026). A hero highlight shows every row.
 */
const DESKTOP_QUEUE_ROWS = 10;

/** Alerts whose work happens in Placement, so their row button opens it beside the list (Home v7). */
const IN_PLACE_KINDS = new Set(["hold", "declines", "nobed", "unsuitable"]);

/** A bed count older than this is named in the hero's Checking foot (v10 Home chapter). */
const BED_COUNT_FRESH_MINUTES = CLINICAL_VALUES.bedCountFresh.value;

/** Focus target when a selection goes away: the selected queue row, else the active queue choice. */
const QUEUE_FOCUS_SELECTOR = 'button[aria-pressed="true"], [role="radio"][aria-checked="true"]';

/** P124: what the footer's "N refused" count means, for a hover and for a screen reader. */
const REFUSED_MARKER_EXPLANATION = "Actions the app refused to record this session. Details are under Refused.";

/**
 * Home: the coordinator's first screen (direction A, owner 10 Oct 2026).
 *
 * One hero band that answers "how many wait for how many beds", with four counts under it (Home
 * v7, Josh 22 Oct 2026): Act now and Referrals to decide narrow My list to that group, Overdue
 * waits and Tier 1 highlight those rows in Everyone waiting. New events sits at the right of that
 * row. Then a compact ED strip, then two columns: the list (My list, or Everyone waiting behind a
 * switch) and a right column with Beds that fit and Placement. Nothing is pre-selected: Placement
 * opens only for the patient, alert or referral the coordinator chose (a bottom sheet on a phone).
 * Registers, above the list, opens the registers as a strip under the hero (owner, 8 Oct 2026), or
 * a sheet on a phone. Nothing on this screen changes state except through the shortlist's own
 * reducer actions.
 *
 * Kept from the third edition: the selection survives a role switch while the movement is open
 * (`focusMovementId`, Task 12), a closed movement stops being explained and hands focus back to
 * the queue, the registers are never ED-filtered, and the service scope narrows only the
 * queue and the ED card, never Beds that fit or the shortlist.
 */
/**
 * Home, redesigned (October 2026 design review). A copy of today's `CoordinatorScreen`
 * (`coordinator/coordinator-screen.tsx`) with the review's changes, so the difference between the
 * two files is the design change and every action still works:
 *
 * - the hero's Checking line folds into one chip that opens it;
 * - Beds that fit is a small table (`BedsFitTable`), so no label is cut off;
 * - Placement still opens only for the person the coordinator chooses (Josh, Home v7, 22 Oct 2026),
 *   but its card now names who is first on the list (`PlacementNext`);
 * - on a phone, Registers and Alerts history sit under one "More" menu beside the list tabs.
 */
/**
 * Home and Activity, redesigned (30 October 2026). A copy of the Home redesign above with:
 *
 * - three lists, My List, Waiting and Planned (Josh's words); Planned is the rest of the shift
 *   from times the records already hold (`planned-model.ts`);
 * - the hero's "new since" count replaced by a changes chip that opens the redesigned Activity
 *   panel on Changes (`activity-panel.tsx`), whose review is explicit (`activity-changes.ts`);
 * - the desktop "Since you looked" strip and the phone sheet removed: Activity holds them now.
 *
 * In the mock-up the app bar's Activity button opens this panel too: the preview shell sends
 * `OPEN_ACTIVITY_EVENT` instead of opening the bar's own drawer, while this page is drawn.
 */
export function HomeActivityPage({ openOnLoad }: { openOnLoad?: string }) {
  const network = useWardNetwork();
  const router = useRouter();
  const thresholds = useDueSoonThresholds();
  usePrintableDisclosures();
  const {
    movements,
    units,
    bedReleases,
    leaveBeds,
    admissions,
    rejections,
    referrals,
    dispatch,
    focusMovementId,
    setFocusMovementId,
    configuration,
    scenario,
    plannedAdmissions,
    patients,
    supportNotifications,
    inboxSnoozes,
    inboxAcknowledgements,
    inboxOwnership,
  } = useWardFlowSelect(
    "movements",
    "units",
    "bedReleases",
    "leaveBeds",
    "admissions",
    "rejections",
    "referrals",
    "dispatch",
    "focusMovementId",
    "setFocusMovementId",
    "configuration",
    "scenario",
    "plannedAdmissions",
    "patients",
    "supportNotifications",
    "inboxSnoozes",
    "inboxAcknowledgements",
    "inboxOwnership",
  );
  const liveNow = useWardFlowClock();
  const service = useServiceScope();

  // Live chip pause (rule 9): freezes the clock the lists on this page read. Actions in the
  // shortlist still use the live clock.
  const [paused, setPaused] = useState(false);
  const [frozenNow, setFrozenNow] = useState(liveNow);
  const now = paused ? frozenNow : liveNow;
  function togglePause() {
    setFrozenNow(liveNow);
    setPaused((current) => !current);
  }

  const [selectedMovementId, setSelectedMovementId] = useState<string | undefined>(() => {
    const restored = focusMovementId ? movements.find((movement) => movement.id === focusMovementId) : undefined;
    return restored && isOpen(restored) ? restored.id : undefined;
  });
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  // Home v7 (Josh, 22 Oct 2026): the left column shows "My list" (alerts and referral decisions) or
  // the full queue.
  // H-0186: the chosen list and focus stay in the address, so a reload opens the same list.
  const [homeView, setHomeView] = useAddressTab("list", HOME_VIEWS, "needs");
  const [selectedAlertId, setSelectedAlertId] = useState<string | undefined>(undefined);
  const [releaseAlertId, setReleaseAlertId] = useState<string | undefined>(undefined);
  // Kept mounted after the first release, so its outcome toast survives the sheet closing.
  const [releaseSheetUsed, setReleaseSheetUsed] = useState(false);
  // Act now and Referrals to decide in the hero narrow My list to that group.
  const [needsFocus, chooseNeedsFocus] = useAddressTab("focus", NEEDS_FOCI, "all");
  // Switching lists clears Placement, so it never shows someone the new list does not highlight.
  function showView(view: (typeof HOME_VIEWS)[number]) {
    if (view !== homeView) {
      setSelectedAlertId(undefined);
      selectMovement(undefined);
    }
    setHomeView(view);
  }
  function toggleFocus(next: "act" | "decide") {
    showView("needs");
    chooseNeedsFocus(needsFocus === next ? "all" : next);
  }
  const selectedEdId = useHomeEdFilter() ?? undefined;
  const setSelectedEdId = writeHomeEdFilter;
  // The shortlist's other possible subject. Switching the queue between Patients and Referrals
  // never touches either selection.
  const [selectedReferralId, setSelectedReferralId] = useState<string | undefined>(undefined);
  const queueFocusRef = useRef<HTMLDivElement>(null);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  // Desktop: one strip under the hero, opened from its Exceptions, Declines or New events count.
  // It starts closed. Exceptions and Declines open the registers on their own tab.
  const [heroPanel, setHeroPanel] = useState<"registers" | undefined>(
    openOnLoad === "registers" ? "registers" : undefined,
  );
  const [checksOpen, setChecksOpen] = useState(openOnLoad === "checks");
  const [registerTab, setRegisterTab] = useState<RegisterTabId>("exceptions");
  // Overdue and Tier 1 on the hero highlight their rows in the queue; the rest dim, nothing hides.
  const [highlight, setHighlight] = useState<QueueHighlight | undefined>(undefined);
  function toggleHighlight(next: QueueHighlight) {
    setHighlight((current) => (current === next ? undefined : next));
  }
  function toggleRegisters(tab: RegisterTabId) {
    const showing = heroPanel === "registers" && (tab === "declines") === (registerTab === "declines");
    if (showing) {
      setHeroPanel(undefined);
      return;
    }
    setRegisterTab(tab);
    setHeroPanel("registers");
  }
  // Home v7 layouts: two columns (the list, then Beds that fit and Placement) from tablet landscape
  // up, one column on tablet portrait with Placement as a side sheet, phone direction A.
  const layout = useHomeLayout();
  const isPhone = layout === "phone";
  const isTabletPortrait = layout === "tablet-portrait";
  // Where Placement is a sheet over the page, the chosen alert travels inside it.
  const sheetPlacement = isPhone || isTabletPortrait;
  // Phone sheet (direction A): the registers. The patient sheet is Placement itself, opened by
  // picking a queue row. "Since you looked" moved into Activity.
  const [phoneSheet, setPhoneSheet] = useState<{ kind: "exceptions" } | undefined>(undefined);

  // A ward choice belongs to the movement it was made for, so changing movement clears it.
  function selectMovement(movementId: string | undefined) {
    setSelectedMovementId(movementId);
    setSelectedUnitId(undefined);
    setSelectedReferralId(undefined);
    setFocusMovementId(movementId);
  }

  function selectReferral(referralId: string) {
    setSelectedReferralId(referralId);
  }

  // gated on `isOpen`, so a movement that closes while selected stops being explained.
  const selectedMovement = selectedMovementId
    ? movements.find((movement) => movement.id === selectedMovementId && isOpen(movement))
    : undefined;

  useEffect(() => {
    if (selectedMovementId === undefined || selectedMovement !== undefined) return;
    setFocusMovementId(undefined);
    queueFocusRef.current?.querySelector<HTMLElement>(QUEUE_FOCUS_SELECTOR)?.focus();
  }, [selectedMovementId, selectedMovement, setFocusMovementId]);

  const selectedEd = selectedEdId ? allEmergencyDepartments().find((ed) => ed.id === selectedEdId) : undefined;
  const activeEdId = selectedEd?.id;
  const filteredMovements = activeEdId ? movements.filter((movement) => movement.originEdId === activeEdId) : movements;

  // Item 44 (build plan B1): `null` is All services and filters nothing.
  const isInServiceScope = useMemo(() => {
    if (service === null) return null;
    const chosenService = service;
    return (movement: Movement) => movementBelongsToService(movement, chosenService, units);
  }, [service, units]);
  const isReferralInServiceScope = useMemo(() => {
    if (service === null) return null;
    const chosenService = service;
    return (referral: Referral) => referralBelongsToService(referral, chosenService, units);
  }, [service, units]);

  const scopedFilteredMovements = isInServiceScope ? filteredMovements.filter(isInServiceScope) : filteredMovements;
  // Movements with an active act-now task (`activeActNowItems`). Audit 1, Josh 20 Oct (CS-04): they
  // carry an "Act now" mark on their row and are no longer pinned on top; the queue is wait order.
  const actNowMovementIds = useMemo(
    () =>
      new Set(
        activeActNowItems(
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
          },
          now,
        ).map((item) => item.movementId),
      ),
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
  const queue = queueOrder(scopedFilteredMovements, now);
  const openMovements = useMemo(() => movements.filter(isOpen), [movements]);

  const noRecordedServiceCount = useMemo(() => noRecordedServiceMovementCount(movements, units), [movements, units]);
  const urgentOutsideServiceCount = useMemo(() => {
    if (service === null) return 0;
    return urgentMovementsOutsideService(openMovements, service, units, now, configuration).length;
  }, [service, openMovements, units, now, configuration]);
  const queueServiceScope = service
    ? {
        service,
        shown: isInServiceScope ? movements.filter(isInServiceScope).length : movements.length,
        total: movements.length,
        noRecordedServiceCount,
        urgentOutside: { count: urgentOutsideServiceCount },
      }
    : undefined;

  const referralQueueAll = referralQueueOrder(referrals);
  const referralQueue = isReferralInServiceScope ? referralQueueAll.filter(isReferralInServiceScope) : referralQueueAll;
  // Resolved from the live queue each render, so a referral that leaves the queue drops the selection.
  const selectedReferral = selectedReferralId
    ? referralQueue.find((referral) => referral.id === selectedReferralId)
    : undefined;
  const hasPanelSubject = Boolean(selectedReferral || selectedMovement);
  // Home v7 (Josh, 22 Oct 2026): Placement never previews the first patient in the list. It opens
  // only for a patient, alert or referral the coordinator chose, so they check the name before acting.
  const panelMovement = selectedMovement;

  // A ward choice belongs to the movement it was made for: when the movement in Placement changes,
  // the ward choice goes.
  const panelMovementId = panelMovement?.id;
  const [unitOwnerId, setUnitOwnerId] = useState(panelMovementId);
  if (unitOwnerId !== panelMovementId) {
    setUnitOwnerId(panelMovementId);
    setSelectedUnitId(undefined);
  }
  function closeShortlist() {
    setSelectedAlertId(undefined);
    selectMovement(undefined);
    queueFocusRef.current?.querySelector<HTMLElement>(QUEUE_FOCUS_SELECTOR)?.focus();
  }

  // Placement as a sheet (phone, tablet portrait): Esc closes it, like the scrim.
  const sheetPlacementOpen = hasPanelSubject && sheetPlacement;
  useEffect(() => {
    if (!sheetPlacementOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setSelectedMovementId(undefined);
      setSelectedReferralId(undefined);
      setFocusMovementId(undefined);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetPlacementOpen, setFocusMovementId]);

  const patientOf = usePatientOf();

  /*
   * Option B (Josh, 13 Oct 2026; D-30): Refer on Home's placement shortlist writes a referral, not an
   * instant offer to the ward. It opens the one referral slide-out for this person, from their ED,
   * with the wards already picked here preselected, so the referral reaches the coordinator queue
   * and Referrals like any other. The sheet closes so the slide-out is not under it.
   */
  function referFromSheet(movement: Movement, unitIds: string[]) {
    const personId = patientOf(movement).patient?.id;
    openReferralSheet(
      raiseReferralHref({
        ...(personId ? { patientId: personId } : {}),
        source: "ed_medical",
        refer: "ward",
        originEdId: movement.originEdId,
        unitIds,
      }),
    );
    closeShortlist();
  }

  // The work list is network-wide and open movements only, never scoped to the ED filter.
  // L1 (site review, 12 Oct 2026): the same active task list as the header's Tasks badge
  // (`activeTaskItems`), so snoozed rows leave the count and decision targets join it.
  const actionInbox = useMemo(
    () =>
      activeTaskItems(
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
      ).map((item) => {
        if (!item.id.startsWith("bed-pull-") && item.title !== "Bed pull expired") return item;
        return {
          ...item,
          title: "Pull expired, bed still pulled",
          detail: `${item.detail} · Release the bed or set a new pull time limit`,
        };
      }),
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
  const silenceReminders = useMemo(() => {
    const notes = new Map<string, string>();
    for (const movement of openMovements) {
      const copy = answerSilenceReminder(movement, referrals, now);
      if (copy !== undefined) notes.set(movement.id, copy);
    }
    return notes;
  }, [openMovements, referrals, now]);

  // My list uses the Alerts screen's own rows, built the way `alerts-screen.tsx` builds them, from
  // the same active task list as the header badge.
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const alertEntries = useMemo(() => {
    const coordinator = WARD_FLOW_ROLE_LABELS.coordinator;
    return actionInbox
      .filter(isQueueItem)
      .map((item: InboxItem): QueueEntry => {
        const movement = movements.find((candidate) => candidate.id === item.movementId);
        const booking = item.plannedAdmission
          ? { planned: item.plannedAdmission, personLabel: item.personLabel }
          : undefined;
        const stayId = admissionIdOfInboxId(item.id);
        const admission = stayId !== undefined ? admissions.find((stay) => stay.id === stayId) : undefined;
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
          mine: owner === coordinator,
          raised: raisedAt(item, movement),
          seen: inboxAcknowledgements[item.id]?.at(-1),
          ownedSince: currentInboxOwner(inboxOwnership[item.id], item.since)?.at,
          snooze: undefined,
          // On Home the placement alerts act in place (Placement opens beside the list),
          // so "Find a bed" no longer sends the coordinator to another screen.
          action: IN_PLACE_KINDS.has(alertKindOf(item.id) ?? "")
            ? { kind: "release" as const, label: alertKindOf(item.id) === "hold" ? "Release pulled bed" : "Find a bed" }
            : alertActionFor(item, subject),
          highlighted: false,
        };
      })
      .sort((a, b) => byOldest({ at: a.raised }, { at: b.raised }));
  }, [actionInbox, movements, admissions, umrnLookup, units, inboxOwnership, inboxAcknowledgements]);
  const actEntries = alertEntries.filter((entry) => entry.group === "act");
  // WS-02: accepted referrals with no bed pulled sit in Act now beside the alerts, in the same scope.
  const toPull = useMemo(() => {
    const all = acceptedReferralsAwaitingPull(referrals, units, movements);
    return isReferralInServiceScope ? all.filter((entry) => isReferralInServiceScope(entry.referral)) : all;
  }, [referrals, units, movements, isReferralInServiceScope]);
  const actNowCount = actEntries.length + toPull.length;
  const chosenAlert = selectedAlertId ? alertEntries.find((entry) => entry.item.id === selectedAlertId) : undefined;
  const releaseAlert = releaseAlertId ? alertEntries.find((entry) => entry.item.id === releaseAlertId) : undefined;
  const waitEntries = alertEntries.filter((entry) => entry.group === "wait");
  const alertHandlers: QueueHandlers = {
    selectedId: selectedAlertId,
    onSelect: (entry) => {
      setSelectedAlertId(entry.item.id);
      if (entry.item.movementId) selectMovement(entry.item.movementId);
    },
    onRelease: (entry) => {
      // H-0977: an expired bed pull releases in place, in one sheet with its reason.
      if (alertKindOf(entry.item.id) === "hold" && entry.movement) {
        setReleaseAlertId(entry.item.id);
        setReleaseSheetUsed(true);
        return;
      }
      setSelectedAlertId(entry.item.id);
      if (entry.item.movementId) selectMovement(entry.item.movementId);
    },
    onReturn: () => undefined,
  };

  // OD-3: the coordinator's unrestricted reads. Not scoped to open or to the ED filter: an override
  // or a decline that was made does not stop having been made.
  const overrideRegister = useMemo(() => allOverrides(movements), [movements]);
  const declineRegister = useMemo(() => allDeclines(movements), [movements]);

  // The redesigned Activity panel: Changes come from the real "since last look" comparison, and
  // review is explicit (mock-up state only; nothing in the reducer or storage changes).
  const lastLookWorld = useMemo(
    () => ({ scenario, referrals, movements, units, bedReleases, admissions }),
    [scenario, referrals, movements, units, bedReleases, admissions],
  );
  const alertMovementIds = useMemo(
    () => new Set(alertEntries.flatMap((entry) => (entry.item.movementId ? [entry.item.movementId] : []))),
    [alertEntries],
  );
  const lineContext = useMemo(
    () => ({ referrals, movements, admissions, nameOf: patientOf, alertMovementIds }),
    [referrals, movements, admissions, patientOf, alertMovementIds],
  );
  const review = useExplicitReview({ world: lastLookWorld, now, thresholds, lineContext });
  const changeCount = review.live.length;
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityTab, setActivityTab] = useState<ActivityTab>("changes");
  const captureReview = review.capture;
  const openActivity = useCallback(
    (tab?: ActivityTab) => {
      // Opens on Changes when any wait for review, otherwise on Recent activity.
      setActivityTab(tab ?? (changeCount > 0 ? "changes" : "recent"));
      captureReview();
      setActivityOpen(true);
    },
    [changeCount, captureReview, setActivityTab, setActivityOpen],
  );
  useEffect(() => {
    const onOpen = () => openActivity();
    window.addEventListener(OPEN_ACTIVITY_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ACTIVITY_EVENT, onOpen);
  }, [openActivity]);
  const openedOnLoad = useRef(false);
  useEffect(() => {
    if (openOnLoad !== "activity" || openedOnLoad.current) return;
    openedOnLoad.current = true;
    openActivity();
  }, [openOnLoad, openActivity]);
  const reviewClock = formatInstantWithDay(review.reviewedAt ?? review.shiftStart, now);
  const changesChipLabel =
    changeCount === 0
      ? "No new changes · Activity"
      : `${changeCount === 1 ? "change" : "changes"} since ${
          review.reviewedAt !== undefined ? `your review at ${reviewClock}` : reviewClock
        } · Review`;
  const changesChipOpen = () => openActivity(changeCount > 0 ? "changes" : "recent");
  const plannedRows = usePlannedRows(now);

  // Hero counts: every one is read from an existing derivation, never typed.
  const counts = useMemo(
    () =>
      wardNavCounts({
        movements,
        units,
        referrals,
        bedReleases,
        leaveBeds,
        admissions,
        now,
        sites: network.sites,
        thresholds,
      }),
    [movements, units, referrals, bedReleases, leaveBeds, admissions, now, thresholds, network],
  );
  // Journey accountability continues through transit; the ED strip keeps physical inpatient waits.
  const edJourneys = useMemo(() => openEdJourneys(movements, now), [now, movements]);
  // The queue may also contain ward/community origins, so its population is broader than ED journeys.
  const notWaitingMeta = (
    <span data-testid="ward-home-ed-population">
      {edJourneys.stillInEd} still in ED · {edJourneys.inTransit} in transit or recorded departure
    </span>
  );
  const bedsReady = counts.capacity?.value ?? 0;
  // The highlight chips count the queue they highlight (after the ED and service filters), P002/P003.
  const chips = homeChipFigures(queue, now, selectedEd?.siteCode);

  // v10 hero: the one ring on the page is statewide occupancy, from the one shared count
  // (`ward-occupancy.ts`) every page and the rail read, against the sidebar's alert line.
  const statewideOccupancy = useMemo(
    () => wardOccupancy(units, admissions, bedReleases).percent,
    [units, admissions, bedReleases],
  );
  // Checking foot: what this page watched, as counts. Never "All clear".
  const staleBedCounts = units.filter((unit) => now - unit.allocatable.confirmedAt > BED_COUNT_FRESH_MINUTES).length;
  const wardsNotReporting = units.filter(
    (unit) => now - unit.allocatable.confirmedAt > unit.allocatable.staleAfterMinutes,
  ).length;
  const checkingFoot = (
    <CheckingFoot
      items={[
        {
          id: "stale-counts",
          label: `Bed counts older than ${BED_COUNT_FRESH_MINUTES / 60}h`,
          value: staleBedCounts,
          tone: staleBedCounts > 0 ? "warning" : "neutral",
        },
        {
          id: "not-reporting",
          label: "Wards not reporting",
          value: wardsNotReporting,
          tone: wardsNotReporting > 0 ? "warning" : "neutral",
        },
      ]}
      notChecked={["CAHS inpatient wards, not modelled", "private hospitals, no live feed"]}
    />
  );
  const shiftWord = currentShift(now)
    .name.replace(/ Shift$/u, " shift")
    .toLowerCase();
  const heroTitle = (
    <>
      <span className={styles.heroNum}>{edJourneys.total}</span> open ED journeys,{" "}
      <span className={styles.heroNum}>{bedsReady}</span> {bedsReady === 1 ? "bed" : "beds"} ready
    </>
  );
  // The four registers: a strip under the hero on desktop (opened from its Exceptions count), and
  // the collapsible "Today's answers" card under the queue on a phone. Only one is ever mounted.
  function renderRegisters(placement: "band" | "column") {
    return (
      <ExceptionDrawer
        items={actionInbox}
        silenceReminders={silenceReminders}
        rejections={rejections}
        overrides={overrideRegister}
        declines={declineRegister}
        units={units}
        now={now}
        open={exceptionsOpen}
        placement={placement}
        tab={placement === "band" ? registerTab : undefined}
        onTabChange={placement === "band" ? setRegisterTab : undefined}
        onToggle={() => setExceptionsOpen((open) => !open)}
        // On a phone the open registers stand between a coordinator and Confirm, so choosing a
        // row closes them in the same tap.
        onSelectMovement={(movementId) => {
          selectMovement(movementId);
          setExceptionsOpen(false);
        }}
        onSelectDischarge={() => {
          setExceptionsOpen(false);
        }}
      />
    );
  }

  // Not deferred: the placement panel's Offer and Refer act on this movement, so it must always be the one
  // the queue selection and `data-subject-movement` name. A deferred copy could act for the previous patient.
  const deferredPanelMovement = panelMovement;

  // Placement: the right column from tablet landscape up, a side sheet over a scrim on tablet
  // portrait and the patient sheet on a phone (CSS by `data-layout`).
  const placementNode = hasPanelSubject ? (
    <div className={`${styles.side} ${styles.placementCol}`}>
      <div
        className={`${styles.shortlistBackdrop} ${shortlistStyles.shortlistBackdrop ?? ""}`}
        onClick={closeShortlist}
        aria-hidden="true"
        data-testid="ward-coordinator-shortlist-backdrop"
      />
      <div className={`${styles.shortlistColumn} ${shortlistStyles.shortlistColumn ?? ""}`}>
        <aside
          className={`${styles.shortlistRegion} ${shortlistStyles.shortlistRegion ?? ""}`}
          aria-label={selectedReferral ? "Referral placement" : "Placement"}
          data-testid="ward-home-placement"
          // Journeys prove which movement the panel is for by this attribute.
          data-subject-movement={selectedReferral ? undefined : panelMovement?.id}
        >
          <div className={`${styles.sheetHandle} ${shortlistStyles.sheetHandle ?? ""}`} aria-hidden="true" />
          <header className={styles.shortlistHeader}>
            <h2>{selectedReferral ? "Referral placement" : "Placement"}</h2>
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "sm" })}
              onClick={closeShortlist}
              aria-label="Close shortlist and clear selection"
            >
              Close
            </button>
          </header>
          {service ? (
            <p className={styles.cardNote} data-testid="ward-shortlist-not-scoped">
              Beds are never narrowed by service. Every ward in the network is considered.
            </p>
          ) : null}
          {/* In the Placement sheet (phone, tablet portrait) the alert's reason leads, as it does on desktop. */}
          {sheetPlacement && chosenAlert ? <ChosenAlertCard entry={chosenAlert} now={now} /> : null}
          {selectedReferral ? (
            <ReferralPlacementPanel referral={selectedReferral} now={liveNow} />
          ) : (
            <ShortlistPanel
              movement={deferredPanelMovement}
              now={liveNow}
              units={units}
              bedReleases={bedReleases}
              leaveBeds={leaveBeds}
              admissions={admissions}
              referrals={referrals}
              selectedUnitId={selectedUnitId}
              onSelectUnit={setSelectedUnitId}
              dispatch={dispatch}
              parallelReferralCap={configuration.parallelReferralCap}
              pullHoldMinutes={configuration.pullHoldMinutes}
              onRefer={deferredPanelMovement ? (unitIds) => referFromSheet(deferredPanelMovement, unitIds) : undefined}
            />
          )}
        </aside>
      </div>
    </div>
  ) : null;

  return (
    // `data-mockup-activity-panel` tells the preview shell this page draws its own Activity panel.
    <div
      className={`${styles.screen} ${mock.scope}`}
      data-testid="ward-coordinator"
      data-ward-design="v6"
      data-mockup-activity-panel=""
    >
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Bed coordinator</h1>

        <div className={styles.body} data-testid="ward-coordinator-body">
          <Hero
            className={styles.homeHero}
            // Phone direction A (Josh, 10 Oct 2026): queue first. The same answer as the desktop
            // title, three figures you can tap, then New since and Pause.
            eyebrow={
              isPhone ? `Modelled network · ${shiftWord}` : `Modelled network · mental health beds · ${shiftWord}`
            }
            title={heroTitle}
            // Redesign (Josh, 30 Oct 2026): the synthetic disclosure lives in the app bar and the footer, so
            // the hero keeps only its facts; on a phone they fold to one line.
            titleMeta={
              isPhone ? (
                <span data-testid="ward-home-ed-population">
                  {edJourneys.stillInEd} still in ED · {edJourneys.inTransit} in transit
                  {statewideOccupancy !== null ? ` · ${statewideOccupancy.toFixed(1)}% beds in use` : ""}
                </span>
              ) : (
                notWaitingMeta
              )
            }
            stats={
              isPhone ? (
                <>
                  <HeroStat
                    value={actNowCount}
                    label="Act now"
                    tone={actNowCount > 0 ? "danger" : undefined}
                    pressed={homeView === "needs" && needsFocus === "act"}
                    onToggle={() => toggleFocus("act")}
                  />
                  <HeroStat
                    value={referralQueue.length}
                    label="To decide"
                    tone={referralQueue.length > 0 ? "info" : undefined}
                    pressed={homeView === "needs" && needsFocus === "decide"}
                    onToggle={() => toggleFocus("decide")}
                  />
                  <HeroStat
                    value={chips.overdueInQueue}
                    label={chips.overdueLabel}
                    tone={chips.overdueInQueue > 0 ? "warning" : undefined}
                    pressed={homeView === "queue" && highlight === "overdue"}
                    onToggle={() => {
                      showView("queue");
                      chooseNeedsFocus("all");
                      toggleHighlight("overdue");
                    }}
                  />
                </>
              ) : undefined
            }
            // The one ring on the page leads the hero on desktop and tablet (shared Hero lead slot).
            lead={
              isPhone ? undefined : (
                <OccupancyRing percent={statewideOccupancy} alertAt={BED_ALERT_THRESHOLD_PERCENT} scope="Statewide" />
              )
            }
            bar={
              isPhone ? (
                // Redesign: the phone hero's "since you looked" pill becomes the changes chip. It
                // shows even with nothing new, since it is also the way into Activity.
                <div className={styles.phoneHeroActs}>
                  <Button
                    variant="onHero"
                    className={`${styles.phoneSince} ${mock.changesChip}`}
                    aria-haspopup="dialog"
                    aria-expanded={activityOpen}
                    aria-controls="home-activity-panel"
                    onClick={changesChipOpen}
                    data-testid="home-changes-chip"
                  >
                    {changeCount > 0 ? <b>{changeCount}</b> : null} {changesChipLabel}
                  </Button>
                </div>
              ) : (
                <div className={styles.heroToggles}>
                  <HeroStat
                    inline
                    value={actNowCount}
                    label="Act now"
                    tone={actNowCount > 0 ? "danger" : undefined}
                    pressed={homeView === "needs" && needsFocus === "act"}
                    onToggle={() => toggleFocus("act")}
                  />
                  <HeroStat
                    inline
                    value={referralQueue.length}
                    label="Referrals to decide"
                    tone={referralQueue.length > 0 ? "info" : undefined}
                    pressed={homeView === "needs" && needsFocus === "decide"}
                    onToggle={() => toggleFocus("decide")}
                  />
                  <HeroStat
                    inline
                    value={chips.overdueInQueue}
                    label={chips.overdueLabel}
                    tone={chips.overdueInQueue > 0 ? "warning" : undefined}
                    pressed={homeView === "queue" && highlight === "overdue"}
                    onToggle={() => {
                      showView("queue");
                      chooseNeedsFocus("all");
                      toggleHighlight("overdue");
                    }}
                  />
                  <HeroStat
                    inline
                    value={chips.tierOneInQueue}
                    label={chips.tierOneLabel}
                    pressed={homeView === "queue" && highlight === "tier1"}
                    onToggle={() => {
                      showView("queue");
                      chooseNeedsFocus("all");
                      toggleHighlight("tier1");
                    }}
                  />
                  <HeroStat
                    inline
                    value={staleBedCounts + wardsNotReporting}
                    // The chip says how many; opening it says which (it ran off a tablet's edge).
                    label={staleBedCounts + wardsNotReporting === 1 ? "check to look at" : "checks to look at"}
                    tone={staleBedCounts + wardsNotReporting > 0 ? "warning" : undefined}
                    expanded={checksOpen}
                    onToggle={() => setChecksOpen((open) => !open)}
                  />
                </div>
              )
            }
            barAside={
              isPhone ? undefined : (
                // The changes chip: opens the redesigned Activity panel on Changes.
                <HeroStat
                  inline
                  command
                  value={changeCount > 0 ? changeCount : null}
                  label={changesChipLabel}
                  // No glyph: the info glyph reads "to decide" on this page, which a change is not.
                  onToggle={changesChipOpen}
                  className={mock.changesChip}
                />
              )
            }
            aside={
              isPhone ? (
                // Device audit (11 Oct 2026): the pause is folded into the Live pill.
                <LiveChip
                  state={paused ? "paused" : "live"}
                  onHero
                  age={formatInstant(now)}
                  onTogglePause={togglePause}
                />
              ) : (
                // A5 (20 Oct 2026): Handover is reached from the rail, not from Home.
                <LiveChip state={paused ? "paused" : "live"} onHero onTogglePause={togglePause} />
              )
            }
            foot={
              isPhone ? (
                // P109 (27 Oct 2026): a phone keeps the Checking strip, collapsed, so stale counts still show.
                <details className={styles.checkingPhone}>
                  <summary>
                    Checking: {staleBedCounts} stale bed {staleBedCounts === 1 ? "count" : "counts"},{" "}
                    {wardsNotReporting} {wardsNotReporting === 1 ? "ward" : "wards"} not reporting
                  </summary>
                  {checkingFoot}
                </details>
              ) : checksOpen ? (
                checkingFoot
              ) : undefined
            }
          />

          {heroPanel && !isPhone ? (
            <div id="ward-home-hero-panel" className={styles.registersBand}>
              {renderRegisters("band")}
            </div>
          ) : null}

          <div className={list.edWrap}>
            <HomeEdPressure
              now={now}
              movements={movements}
              selectedEdId={selectedEdId}
              onSelectEd={setSelectedEdId}
              service={service}
            />
          </div>

          <div
            className={`${styles.grid} ${list.grid}`}
            data-testid="ward-coordinator-region-grid"
            data-layout={layout}
            data-shortlist-open={hasPanelSubject}
            ref={queueFocusRef}
          >
            <div className={`${styles.side} ${list.workCol}`}>
              <div className={`${list.switchRow} ${mock.switchRow}`}>
                <Segmented
                  className={`${list.viewSwitch} ${mock.viewSwitch}`}
                  label="Home list"
                  size="md"
                  value={homeView}
                  onChange={(view) => {
                    showView(view);
                    if (view !== "needs") chooseNeedsFocus("all");
                  }}
                  // Josh's words and capitalisation (30 Oct 2026): My List, Waiting, Planned.
                  items={[
                    {
                      id: "needs",
                      label: "My List",
                      tone: actNowCount > 0 ? "danger" : undefined,
                      count: actNowCount + referralQueue.length + waitEntries.length,
                    },
                    // Today's "Everyone waiting" queue; the same number the list's Patients tab shows.
                    { id: "queue", label: "Waiting", count: queue.length },
                    { id: "planned", label: "Planned", count: plannedRows.length },
                  ]}
                />
                {isPhone ? (
                  <Menu
                    label="More for this list"
                    align="end"
                    items={[
                      { id: "registers", label: "Registers", onSelect: () => setPhoneSheet({ kind: "exceptions" }) },
                      { id: "alerts", label: "Alerts history", onSelect: () => router.push("/ward-flow/alerts") },
                    ]}
                    trigger={(props) => (
                      <button type="button" {...props} className={buttonClass({ variant: "ghost", size: "sm" })}>
                        <MoreHorizontal size={16} aria-hidden="true" />
                        <span className="sr-only">More for this list</span>
                      </button>
                    )}
                  />
                ) : null}
                <div className={list.headLinks} style={isPhone ? { display: "none" } : undefined}>
                  {/* Home v7 (Josh, 22 Oct 2026): the hero's Alerts count became Act now, so the
                      registers open from here: the strip under the hero, or a sheet on a phone. */}
                  <button
                    type="button"
                    className={list.headLink}
                    aria-expanded={isPhone ? phoneSheet?.kind === "exceptions" : heroPanel === "registers"}
                    aria-controls={isPhone ? undefined : "ward-home-hero-panel"}
                    onClick={() => (isPhone ? setPhoneSheet({ kind: "exceptions" }) : toggleRegisters("exceptions"))}
                    data-testid="ward-home-registers"
                  >
                    Registers
                  </button>
                  {isPhone ? null : (
                    <Link href="/ward-flow/alerts" className={list.headLink}>
                      Alerts history
                      <ChevronRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
              {homeView === "needs" ? (
                <div className={mock.compactList}>
                  <MyListCard
                    act={actEntries}
                    toPull={toPull}
                    wait={waitEntries}
                    referrals={referralQueue}
                    units={units}
                    now={now}
                    phone={isPhone}
                    handlers={alertHandlers}
                    selectedReferralId={selectedReferralId}
                    // WS-04 (workflow speed audit, 26 Oct 2026): Decide opens the decision itself, the
                    // referral on the Referrals board with Accept and Decline, never a read-only preview.
                    decideHref={referralBoardHref}
                    focus={needsFocus}
                    onShowAll={() => chooseNeedsFocus("all")}
                  />
                </div>
              ) : homeView === "planned" ? (
                <PlannedList now={now} rows={plannedRows} />
              ) : (
                <PriorityQueue
                  movements={queue}
                  units={units}
                  referralQueue={referralQueue}
                  now={now}
                  selectedId={selectedMovementId}
                  onSelect={(movementId) => {
                    setSelectedAlertId(undefined);
                    selectMovement(movementId);
                  }}
                  selectedReferralId={selectedReferralId}
                  onSelectReferral={(referralId) => {
                    setSelectedAlertId(undefined);
                    selectReferral(referralId);
                  }}
                  filterEdId={activeEdId}
                  onClearFilter={() => setSelectedEdId(undefined)}
                  totalMovements={openMovements.length}
                  serviceScope={queueServiceScope}
                  pullHoldMinutes={configuration.pullHoldMinutes}
                  delaysHref={DELAYS_HREF}
                  highlight={highlight}
                  onClearHighlight={() => {
                    setHighlight(undefined);
                    setSelectedEdId(undefined);
                  }}
                  rowCap={isPhone ? PHONE_QUEUE_ROWS : highlight === undefined ? DESKTOP_QUEUE_ROWS : undefined}
                  phone={isPhone}
                  pinnedIds={actNowMovementIds}
                />
              )}
            </div>
            <div className={`${list.rightCol} ${mock.stickyCol}`}>
              {chosenAlert && !sheetPlacement ? (
                <ChosenAlertCard entry={chosenAlert} now={now} onClear={closeShortlist} />
              ) : null}
              {isPhone || chosenAlert ? null : <BedsFitTable now={now} bedsReady={bedsReady} />}
              {/* An alert with no patient journey (a booking, a notification) has nothing to place. */}
              {chosenAlert && !chosenAlert.movement ? null : placementNode}
              {!sheetPlacement && !hasPanelSubject && !chosenAlert ? (
                <PlacementNext next={actEntries.find((entry) => entry.movement)} onOpen={alertHandlers.onSelect} />
              ) : null}
            </div>
          </div>

          {sheetPlacement && chosenAlert && !chosenAlert.movement ? (
            // On a phone or tablet portrait an alert with no patient journey opens in its own sheet.
            <Sheet
              open
              onClose={() => setSelectedAlertId(undefined)}
              title="Chosen alert"
              mobilePlacement="bottom"
              testId="home-alert-sheet"
            >
              <ChosenAlertCard entry={chosenAlert} now={now} />
            </Sheet>
          ) : null}
          {releaseSheetUsed ? (
            <HomeReleaseSheet entry={releaseAlert} onClose={() => setReleaseAlertId(undefined)} />
          ) : null}
          {isPhone && phoneSheet?.kind === "exceptions" ? (
            <Sheet
              open
              onClose={() => setPhoneSheet(undefined)}
              title="Registers"
              description="Choose one to open its patient"
              mobilePlacement="bottom"
              testId="ward-home-exceptions-sheet"
            >
              <ExceptionDrawer
                items={actionInbox}
                silenceReminders={silenceReminders}
                rejections={rejections}
                overrides={overrideRegister}
                declines={declineRegister}
                units={units}
                now={now}
                open
                placement="column"
                onToggle={() => setPhoneSheet(undefined)}
                onSelectMovement={(movementId) => {
                  setPhoneSheet(undefined);
                  selectMovement(movementId);
                }}
                onSelectDischarge={() => setPhoneSheet(undefined)}
              />
            </Sheet>
          ) : null}
          <ActivityPanel
            open={activityOpen}
            onClose={() => setActivityOpen(false)}
            tab={activityTab}
            onTab={setActivityTab}
            review={review}
            now={now}
          />
        </div>
        <WardPrototypeFooter
          testId="ward-coordinator-governance"
          className={redesign.footer}
          note={
            <>
              Demo coordinator view · Not approved for clinical use · Limited demo coverage: CAHS inpatient wards are
              not modelled; private live feeds are unavailable
              <span
                className={styles.refusalMarker}
                data-alert={rejections.length > 0 ? "true" : undefined}
                data-testid="ward-coordinator-refusal-marker"
                title={REFUSED_MARKER_EXPLANATION}
                aria-describedby="ward-coordinator-refusal-explained"
              >
                {rejections.length === 1 ? "1 refused" : `${rejections.length} refused`}
              </span>
              <span id="ward-coordinator-refusal-explained" className="sr-only">
                {REFUSED_MARKER_EXPLANATION}
              </span>
            </>
          }
        />
      </main>
    </div>
  );
}
