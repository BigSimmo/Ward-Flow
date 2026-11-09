"use client";

import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { type InboxItem, isOpen } from "@/components/ward-management/ward-derivations";
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
  Hero,
  LiveChip,
  Menu,
  PillTabs,
  Segmented,
  StatusGlyph,
  type HeroNextStep,
} from "@/components/wf";
import { createBrowserStore } from "@/lib/client-store-factory";
import activity from "./home-activity.module.css";
import cards from "./home-cards.module.css";
import styles from "./home.module.css";
import { HomeEdPressure } from "./home-ed-pressure";
import { PlannedList } from "./home-activity-lazy";
import { useHomeLayout } from "./home-layout";
import { BedsGapCard, HomePlacementDrawer, HomeReleaseSheet, MyListCard } from "./home-list-lazy";
import list from "./home-list.module.css";
import flowStyles from "./home-flow.module.css";
import folderStyles from "./home-folder.module.css";
import { HomeFolderShape } from "./home-folder";
import heroStyles from "./home-hero.module.css";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";
import type { PlacementSubject } from "./home-placement-drawer";
import { usePlannedRows } from "./planned-rows";
import { FLOW_STAGES, flowStageOf, type FlowStageId, PriorityQueue, type QueueHighlight } from "./priority-queue";

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
const NEEDS_FOCI = ["all", "act", "decide"] as const;
const DELAYS_HREF = "/ward-flow/waiting";

/** Alerts whose work happens in Placement, so their row button opens it beside the list (Home v7). */
const IN_PLACE_KINDS = new Set(["hold", "declines", "nobed", "unsuitable"]);

/** A bed count older than this is named in the hero's Checking foot (v10 Home chapter). */
const BED_COUNT_FRESH_MINUTES = CLINICAL_VALUES.bedCountFresh.value;

/** Focus target when a selection goes away: the selected queue row, else the active queue choice. */
const QUEUE_FOCUS_SELECTOR = 'button[aria-pressed="true"], [role="radio"][aria-checked="true"]';

/**
 * Hands focus back to the list: its chosen control, else (Home flow, where the list tabs sit above
 * the columns) its first row or row button, so focus never falls to the page.
 */
function focusQueue(root: HTMLElement | null): void {
  const target =
    root?.querySelector<HTMLElement>(QUEUE_FOCUS_SELECTOR) ??
    root?.querySelector<HTMLElement>('[data-testid^="ward-queue-row-"], [data-referral-id] button, li button');
  target?.focus();
}

/** P124: what the footer's "N refused" count means, for a hover and for a screen reader. */
const REFUSED_MARKER_EXPLANATION = "Actions the app refused to record this session. Details are under Refused.";

/**
 * Home: the coordinator's first screen (direction A, owner 10 Oct 2026).
 *
 * One hero band (sticky header redesign, Josh 9 Nov 2026): "Bed flow right now", three figures, the
 * next step with its one button, and the ED strip, all in the slate. Curved folder tabs then lead
 * the lists. Then two columns: the list (My list, or Everyone waiting behind a
 * switch) and a right column with Beds that fit and Placement. Nothing is pre-selected: Placement
 * opens only for the patient, alert or referral the coordinator chose (a bottom sheet on a phone).
 * Today's review (Josh, 9 Nov 2026) replaced the Registers strip and sheet. Nothing on this screen changes state except through the shortlist's own
 * reducer actions.
 *
 * Kept from the third edition: the selection survives a role switch while the movement is open
 * (`focusMovementId`, Task 12), a closed movement stops being explained and hands focus back to
 * the queue, the registers are never ED-filtered, and the service scope narrows only the
 * queue and the ED card, never Beds that fit or the shortlist.
 */
/**
 * Home and Activity (design approved by Josh, 31 Oct 2026, "Yes to all"):
 *
 * - Home flow (Q340, Q341, Q345, 3 Nov 2026): two lists, Needs you and Flow, then the Flow stages as
 *   quieter tabs with counts (Needs a bed, Bed agreed, Ready to move, Moving); Later today (was Planned)
 *   is the rest of the shift from times the records already hold (`planned-model.ts`), in the right
 *   column on desktop and a third tab on a phone;
 * - changes since the last look live in Activity (`activity-panel.tsx`), whose review is explicit
 *   (`activity-changes.ts`); the hero no longer carries a changes chip (sticky header redesign,
 *   9 Nov 2026);
 * - the Checking line sits under the next step, with no "to check" chip;
 * - Beds that fit is a small table that folds to one line while someone is chosen;
 * - Placement still opens only for the person the coordinator chooses (Josh, Home v7, 22 Oct 2026),
 *   but its card names the oldest alert to place;
 * - Today's review and Alerts history sit under one "More" menu at the end of the list tabs.
 */
/** Today's review and Alerts history under one "More" menu at the end of Home's list tabs. */
function HomeListMoreMenu() {
  // Optional, so Home still renders where no app router is mounted (the preview and the screen tests).
  const router = useOptionalRouter();
  return (
    <Menu
      label="More for this list"
      align="end"
      items={[
        // Home notes 4, issue 4 (Josh, 9 Nov 2026): Today's review replaces the four Registers tabs
        // (Exceptions, Declines, Overrides, Refused) as the one page for what went off-plan today.
        { id: "review", label: "Today's review", onSelect: () => router?.push("/ward-flow/review") },
        { id: "alerts", label: "Alerts history", onSelect: () => router?.push("/ward-flow/alerts") },
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={`${buttonClass({ variant: "ghost", size: "sm" })} ${folderStyles.more}`}
          data-testid="ward-home-more"
        >
          <Ellipsis size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={flowStyles.moreText} aria-hidden="true">
            More
          </span>
          <span className="sr-only">More for this list</span>
        </button>
      )}
    />
  );
}

export function CoordinatorScreen() {
  const network = useWardNetwork();
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
    focusMovementId,
    setFocusMovementId,
    configuration,
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
    "focusMovementId",
    "setFocusMovementId",
    "configuration",
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
  // Home flow mock-up (Q343): the stage the tiles opened in the Flow tab; none shows every stage.
  const [flowStage, setFlowStage] = useState<FlowStageId | undefined>(undefined);
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
  // The list tabs' row, which the curved folder shape measures.
  const listsNavRef = useRef<HTMLElement>(null);
  // A highlight (past target, from the next step) marks its rows in the queue; the rest dim, nothing hides.
  const [highlight, setHighlight] = useState<QueueHighlight | undefined>(undefined);
  // Home v7 layouts: two columns (the list, then Beds that fit and Placement) from tablet landscape
  // up, one column on tablet portrait with Placement as a side sheet, phone direction A.
  const layout = useHomeLayout();
  const isPhone = layout === "phone";
  const isTabletPortrait = layout === "tablet-portrait";
  // Where Placement is a sheet over the page, the chosen alert travels inside it.
  const sheetPlacement = isPhone || isTabletPortrait;
  // Later today is a tab only on a phone or tablet portrait; elsewhere it sits in the right column,
  // so an address left on it (a reload or a rotation) falls back to Needs you.
  const shownView = homeView === "planned" && !sheetPlacement ? "needs" : homeView;

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
    focusQueue(queueFocusRef.current);
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
    // Closing clears the drawer's subject but keeps the patient in focus, so Change view still
    // offers that patient's wards and ED. The drawer is modal on every width (H7), so closing it is
    // the only way to reach Change view from Placement, as the side column used to allow.
    setSelectedMovementId(undefined);
    setSelectedUnitId(undefined);
    setSelectedReferralId(undefined);
    focusQueue(queueFocusRef.current);
  }

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
        if (!item.id.startsWith("bed-pull-") && item.title !== "Pull expired, bed still pulled") return item;
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
  // Josh, 3 Nov 2026 (stress test): with a service chosen, Act now lists only that service's
  // patients, like the queue below it. A task with no movement is never hidden.
  const actEntries = alertEntries.filter(
    (entry) => entry.group === "act" && (!isInServiceScope || !entry.movement || isInServiceScope(entry.movement)),
  );
  // WS-02: accepted referrals with no bed pulled sit in Act now beside the alerts, in the same scope.
  const toPull = useMemo(() => {
    const all = acceptedReferralsAwaitingPull(referrals, units, movements);
    return isReferralInServiceScope ? all.filter((entry) => isReferralInServiceScope(entry.referral)) : all;
  }, [referrals, units, movements, isReferralInServiceScope]);
  // Q260: the Act now figure the phone Menu, the bell and Alerts read (`ward-alerts-figures.ts`).
  const scopedActionInbox = useMemo(() => {
    if (!isInServiceScope) return actionInbox;
    return actionInbox.filter((item) => {
      const movement = item.movementId ? movements.find((candidate) => candidate.id === item.movementId) : undefined;
      return !movement || isInServiceScope(movement);
    });
  }, [actionInbox, movements, isInServiceScope]);
  const actNowCount = alertsNowFigures(scopedActionInbox, toPull.length).actNow;
  // Plan item 2i: the hero's Act now is main's service-scoped Act now figure.
  const heroActNow = actNowCount;
  const chosenAlert = selectedAlertId ? alertEntries.find((entry) => entry.item.id === selectedAlertId) : undefined;
  const releaseAlert = releaseAlertId ? alertEntries.find((entry) => entry.item.id === releaseAlertId) : undefined;
  const waitEntries = alertEntries.filter((entry) => entry.group === "wait");
  // Home flow mock-up (Q340): a waiting alert is a mark on its patient's Flow row.
  // Every waiting title on a patient is kept; a waiting alert with no patient stays a row in Needs you.
  const waitingMarks = new Map<string, string>();
  for (const entry of waitEntries) {
    if (!entry.movement) continue;
    const prior = waitingMarks.get(entry.movement.id);
    waitingMarks.set(entry.movement.id, prior ? `${prior} · ${entry.item.title}` : entry.item.title);
  }
  const unmarkedWait = waitEntries.filter((entry) => !entry.movement);
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
  // With a service chosen, the hero's ED figures count that service's journeys (stress test, 3 Nov 2026).
  const edJourneys = useMemo(
    () => openEdJourneys(isInServiceScope ? movements.filter(isInServiceScope) : movements, now),
    [now, movements, isInServiceScope],
  );
  // The bed figures (beds ready, occupancy) and the bed-count checks stay network-wide on purpose
  // (a placement may use any ward), so with a service chosen they say so beside the figure.
  const networkWord = service === null ? "" : " network-wide";
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

  // Not deferred: the placement panel's Offer and Refer act on this movement, so it must always be the one
  // the queue selection and `data-subject-movement` name. A deferred copy could act for the previous patient.
  const deferredPanelMovement = panelMovement;

  // Placement (H7 to H10, Josh 3 Nov 2026): the patient drawer on every screen size, like the
  // Capacity pop-up, for the chosen alert, the chosen patient or the chosen referral.
  const placementSubject: PlacementSubject | undefined = chosenAlert
    ? { kind: "alert", entry: chosenAlert }
    : selectedReferral
      ? { kind: "referral", referral: selectedReferral }
      : deferredPanelMovement
        ? { kind: "movement", movement: deferredPanelMovement }
        : undefined;
  const placementNode = placementSubject ? (
    <HomePlacementDrawer
      // A new subject is a new drawer, so its foot slot and scroll start fresh.
      key={chosenAlert?.item.id ?? selectedReferral?.id ?? deferredPanelMovement?.id}
      subject={placementSubject}
      now={liveNow}
      onClose={closeShortlist}
      selectedUnitId={selectedUnitId}
      onSelectUnit={setSelectedUnitId}
      onRefer={referFromSheet}
      networkNote={service ? "Every ward in the network is considered." : undefined}
    />
  ) : null;

  // Plan item 2i (proposal): the hero's next step, from the same figures as the hero's toggles.
  // Act now first, then referrals to decide, then past-target waits in the flow; one at a time.
  const actPressed = shownView === "needs" && needsFocus === "act";
  const decidePressed = shownView === "needs" && needsFocus === "decide";
  const overduePressed = shownView === "queue" && highlight === "overdue";
  const showOverdue = () => {
    showView("queue");
    setFlowStage(undefined);
    chooseNeedsFocus("all");
    // CodeRabbit (#1380): set from what is shown, so a retained highlight from Needs you is not cleared.
    setHighlight(overduePressed ? undefined : "overdue");
  };
  // Scope: with a service chosen, the step counts only that service's work, never statewide: the
  // hero's own scoped Act now (`heroActNow`), and the scoped referral queue and flow queue Home shows.
  const nextActCount = heroActNow;
  // Josh, 4 Nov 2026 (2i question 2): on tablet and desktop the hero chip that repeats the step's own
  // figure is left out, since the step's button does the same toggle.
  const nextKind: "act" | "decide" | "overdue" | null =
    nextActCount > 0 ? "act" : referralQueue.length > 0 ? "decide" : chips.overdueInQueue > 0 ? "overdue" : null;
  const nextScope = service === null ? "" : ` in ${service}`;
  const heroNext: HeroNextStep =
    nextActCount > 0
      ? {
          answer: `${nextActCount} ${nextActCount === 1 ? "needs" : "need"} a person now${nextScope}`,
          action: {
            label: actPressed ? "Show all" : "Show act now",
            pressed: actPressed,
            testId: "home-next-action",
            onClick: () => toggleFocus("act"),
          },
        }
      : referralQueue.length > 0
        ? {
            answer: `${referralQueue.length} ${referralQueue.length === 1 ? "referral" : "referrals"} to decide${nextScope}`,
            action: {
              label: decidePressed ? "Show all" : "Show to decide",
              pressed: decidePressed,
              testId: "home-next-action",
              onClick: () => toggleFocus("decide"),
            },
          }
        : chips.overdueInQueue > 0
          ? {
              answer: `Nothing to act on now${nextScope} · ${chips.overdueInQueue} past target in the flow`,
              action: {
                label: overduePressed ? "Show all" : "Show past target",
                pressed: overduePressed,
                testId: "home-next-action",
                onClick: showOverdue,
              },
            }
          : { answer: `Nothing needs you now${nextScope}` };
  // Josh, 4 Nov 2026 (2i question 5): the Checking line sits under the step whenever a bed count is
  // stale or a ward is not reporting (every size since the sticky header redesign, 9 Nov 2026).
  const checkingLine =
    staleBedCounts + wardsNotReporting > 0 ? (
      <span data-testid="home-next-checking">
        Checking: {staleBedCounts} stale bed {staleBedCounts === 1 ? "count" : "counts"}, {wardsNotReporting}{" "}
        {wardsNotReporting === 1 ? "ward" : "wards"} not reporting
      </span>
    ) : undefined;

  return (
    <div className={`${styles.screen} ${activity.glyphScope}`} data-testid="ward-coordinator" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Bed coordinator</h1>

        <div className={styles.body} data-testid="ward-coordinator-body">
          <Hero
            className={`${styles.homeHero} ${heroStyles.hero}`}
            // Sticky header redesign (Josh, 9 Nov 2026): one plain title on every size. The header already
            // names the page and place, so the eyebrow ("Modelled network · day shift") is gone.
            title={
              <>
                Bed flow <span className={heroStyles.titleSoft}>right now</span>
              </>
            }
            aside={
              // Device audit (11 Oct 2026): the pause is folded into the Live pill.
              <LiveChip
                state={paused ? "paused" : "live"}
                onHero
                age={formatInstant(now)}
                onTogglePause={togglePause}
              />
            }
          >
            <div className={heroStyles.main}>
              <div className={heroStyles.figures} role="group" aria-label="Figures">
                <p className={heroStyles.figure} data-testid="home-figure-ed">
                  <b>{edJourneys.total}</b>
                  <small>open ED movements{service === null ? "" : ` in ${service}`}</small>
                </p>
                <p className={heroStyles.figure} data-testid="home-figure-beds">
                  <b>{bedsReady}</b>
                  <small>
                    {bedsReady === 1 ? "bed" : "beds"} ready{networkWord}
                  </small>
                </p>
                {statewideOccupancy === null ? null : (
                  <p className={heroStyles.figure} data-testid="home-figure-occupancy">
                    <b>{Math.round(statewideOccupancy)}%</b>
                    <small>
                      <Link
                        href="/ward-flow/capacity"
                        className={heroStyles.figureLink}
                        data-testid="ward-home-occupancy-link"
                      >
                        {statewideOccupancy >= BED_ALERT_THRESHOLD_PERCENT ? "at risk" : "beds in use"}
                      </Link>
                    </small>
                  </p>
                )}
              </div>
              <div className={heroStyles.next} data-wf-hero-next="" data-kind={nextKind ?? "none"}>
                {nextKind === "act" ? <StatusGlyph tone="danger" size={14} className={heroStyles.nextGlyph} /> : null}
                <div className={heroStyles.nextText}>
                  <p className={heroStyles.nextAnswer} data-testid="hero-next-answer">
                    {heroNext.answer}
                  </p>
                  {checkingLine ? <p className={heroStyles.nextChecking}>{checkingLine}</p> : null}
                </div>
                {heroNext.action ? (
                  <Button
                    variant="light"
                    className={heroStyles.nextAction}
                    onClick={heroNext.action.onClick}
                    aria-pressed={heroNext.action.pressed}
                    data-testid={heroNext.action.testId}
                  >
                    {heroNext.action.label}
                  </Button>
                ) : null}
              </div>
            </div>
            <HomeEdPressure
              onHero
              now={now}
              movements={movements}
              selectedEdId={selectedEdId}
              onSelectEd={setSelectedEdId}
              service={service}
              population={
                <span data-testid="ward-home-ed-population">
                  <b>{edJourneys.stillInEd}</b> in ED · <b>{edJourneys.inTransit}</b> in transit
                </span>
              }
            />
          </Hero>

          {/* Home flow (Q340, Q345, 3 Nov 2026): one row. Needs you and Flow lead as the raised switch; the
              stages follow, after a rule, as quieter tabs with counts (always shown; one opens Flow there). */}
          <nav
            ref={listsNavRef}
            className={`${flowStyles.nav} ${folderStyles.nav}`}
            aria-label="Home lists"
            data-testid="home-lists"
            data-act={actNowCount > 0 ? "" : undefined}
          >
            <Segmented
              className={`${list.viewSwitch} ${folderStyles.switch}`}
              label="Home list"
              size="md"
              value={shownView}
              onChange={(view) => {
                showView(view);
                chooseNeedsFocus("all");
                setFlowStage(undefined);
              }}
              items={[
                {
                  id: "needs",
                  label: "Needs you",
                  count: actNowCount + referralQueue.length,
                },
                { id: "queue", label: "Flow", count: queue.length },
                ...(isPhone || layout === "tablet-portrait"
                  ? [{ id: "planned" as const, label: "Later today", count: plannedRows.length }]
                  : []),
              ]}
            />
            <HomeFolderShape navRef={listsNavRef} value={shownView} />
            <span className={`${flowStyles.navRule} ${folderStyles.rule}`} aria-hidden="true" />
            <div className={flowStyles.stageGroup} data-active={shownView === "queue" ? "true" : undefined}>
              <div className={flowStyles.stageTabs}>
                <PillTabs
                  label="Flow stages"
                  className={flowStyles.stagePills}
                  value={shownView === "queue" ? (flowStage ?? "all") : "none"}
                  onChange={(id) => {
                    showView("queue");
                    chooseNeedsFocus("all");
                    setFlowStage(id === "all" ? undefined : (id as FlowStageId));
                  }}
                  items={[
                    { id: "all", label: "All", count: queue.length },
                    // Icon design (Josh, 3 Nov 2026): no act-now triangle on the tabs; the late rows carry it.
                    ...FLOW_STAGES.filter((stage) => stage.id !== "referral").map((stage) => ({
                      id: stage.id,
                      label: stage.label,
                      count: queue.filter((movement) => flowStageOf(movement) === stage.id).length,
                    })),
                  ]}
                />
              </div>
            </div>
            <HomeListMoreMenu />
          </nav>

          <div
            className={`${styles.grid} ${list.grid}`}
            data-testid="ward-coordinator-region-grid"
            data-layout={layout}
            data-shortlist-open={hasPanelSubject}
            ref={queueFocusRef}
          >
            <div className={`${styles.side} ${list.workCol}`}>
              {shownView === "planned" ? (
                <PlannedList now={now} rows={plannedRows} title="Later today" />
              ) : shownView === "queue" ? (
                <PriorityQueue
                  flowStage={flowStage}
                  waitingMarks={waitingMarks}
                  movements={queue}
                  units={units}
                  referralQueue={referralQueue}
                  now={now}
                  selectedId={selectedMovementId}
                  onSelect={(movementId) => {
                    setSelectedAlertId(undefined);
                    selectMovement(movementId);
                  }}
                  filterEdId={activeEdId}
                  onClearFilter={() => setSelectedEdId(undefined)}
                  serviceScope={queueServiceScope}
                  pullHoldMinutes={configuration.pullHoldMinutes}
                  delaysHref={DELAYS_HREF}
                  highlight={highlight}
                  onClearHighlight={() => {
                    setHighlight(undefined);
                    setSelectedEdId(undefined);
                  }}
                  phone={isPhone}
                  pinnedIds={actNowMovementIds}
                />
              ) : (
                <MyListCard
                  act={actEntries}
                  toPull={toPull}
                  wait={unmarkedWait}
                  hideWait={unmarkedWait.length === 0}
                  referralCap={Math.max(0, 8 - actEntries.length - toPull.length) || 2}
                  referrals={referralQueue}
                  units={units}
                  now={now}
                  phone={isPhone}
                  handlers={alertHandlers}
                  selectedReferralId={selectedReferralId}
                  onSelectReferral={(referralId) => {
                    setSelectedAlertId(undefined);
                    selectMovement(undefined);
                    selectReferral(referralId);
                  }}
                  decideHref={referralBoardHref}
                  focus={needsFocus}
                  onShowAll={() => chooseNeedsFocus("all")}
                />
              )}
            </div>
            <div className={`${list.rightCol} ${list.stickyCol}`}>
              {isPhone || chosenAlert ? null : (
                <BedsGapCard now={now} bedsReady={bedsReady} condensed={hasPanelSubject} />
              )}
              {/* Josh's notes 4 (9 Nov 2026): Placement shows only once someone is chosen. The old
                  at-rest prompt repeated the top of My list, so the column now starts with beds. */}
              {/* Later today steps aside while Placement is open, so Placement keeps the whole column. */}
              {!isPhone && layout !== "tablet-portrait" && !hasPanelSubject && !chosenAlert ? (
                <PlannedList now={now} rows={plannedRows} title="Later today" />
              ) : null}
            </div>
          </div>

          {placementNode}
          {releaseSheetUsed ? (
            <HomeReleaseSheet entry={releaseAlert} onClose={() => setReleaseAlertId(undefined)} />
          ) : null}
        </div>
        <WardPrototypeFooter
          testId="ward-coordinator-governance"
          className={cards.footer}
          note={
            <>
              Demo coordinator view · Not approved for clinical use · CAHS wards not modelled
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
