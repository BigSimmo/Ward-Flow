"use client";

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
import { isBedCountStale } from "@/components/ward-management/ward-clinical-values";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import { formatInstant, splitDuration } from "@/components/ward-management/ward-clock";
import { originPlace } from "@/components/ward-management/origin-place";
import { OVERDUE_AFTER_MINUTES_BY_TIER } from "@/components/ward-management/ward-operational-defaults";
import { targetHoursText } from "@/components/ward-management/ward-target-hours";
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
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { unitInScope } from "@/components/ward-management/ward-role-access";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { CountBreakdown } from "@/components/ward-management/count-breakdown";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import {
  movementBreakdownRows,
  waitingTransitFacts,
  wardReadyBreakdownRows,
} from "@/components/ward-management/count-breakdown-rows";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { coordinatorReferralQueue, isReferralOverdue } from "@/components/ward-management/ward-referrals";
import {
  movementBelongsToService,
  referralBelongsToService,
  unitHealthService,
} from "@/components/ward-management/ward-service-scope";
import { homeChipFigures, openEdJourneys } from "@/components/ward-management/ward-shared-figures";
import { useAddressTab } from "@/components/ward-management/ward-url-state";
import {
  buttonClass,
  FolderTabs,
  folderTabClasses,
  Hero,
  HeroAct,
  HeroFigures,
  HeroTop,
  LiveChip,
  Menu,
  Segmented,
  SrOnly,
  StatusGlyph,
  type HeroNextStep,
} from "@/components/wf";
import activity from "./home-activity.module.css";
import cards from "./home-cards.module.css";
import styles from "./home.module.css";
import { HomeEdPressure } from "./home-ed-pressure";
import { PlannedList } from "./home-activity-lazy";
import { useHomeCardsSettled } from "./home-cards-settled";
import { useHomeLayout } from "./home-layout";
import { BedsGapCard, HomePlacementDrawer, HomeReleaseSheet, MyListCard } from "./home-list-lazy";
import list from "./home-list.module.css";
import flowStyles from "./home-flow.module.css";
import { HomePinnedCard } from "./home-pinned-card";
import { homeActNowParts } from "./home-act-now-words";
import { HomeSinceBanner } from "./home-since-banner-lazy";
import { HomeOutageCatchUp } from "./home-outage-catch-up-lazy";
import { oldPackCounts, oldPackWords, wardsWithOldPack } from "@/components/ward-management/ward-downtime-pack-prints";
import Link from "next/link";
import catchUpStyles from "./home-outage-catch-up.module.css";
import heroStyles from "./home-hero.module.css";
import { useOptionalRouter } from "@/components/ward-management/ward/ward-screen-helpers";
import type { PlacementSubject } from "./home-placement-drawer";
import { usePlannedRows } from "./planned-rows";
import { waitingHref } from "@/components/ward-management/delays/waiting-href";
import { needsYouCount } from "@/components/ward-management/figures/decision-counts";
import { WardReadyForNextLines } from "../ward/ward-ready-for-next-lines";

// Simplification mock-up (area 2 item 1): Flow folded into Waiting; `?list=queue` redirects there.
const HOME_VIEWS = ["needs", "planned"] as const;
const NEEDS_FOCI = ["all", "act", "decide"] as const;

/** Alerts whose work happens in Placement, so their row button opens it beside the list (Home v7). */
const IN_PLACE_KINDS = new Set(["hold", "declines", "nobed", "unsuitable"]);

/** A bed count older than this is named in the hero's Checking foot (v10 Home chapter). */

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
const REFUSED_MARKER_EXPLANATION =
  "Actions the app refused to record this session. Details are in Today's review, under Stopped by the app.";

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
 *   quieter tabs with counts (No ward yet, Bed agreed, Ready to move, Moving); Later today (was Planned)
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
/** Today's review and Night view under one "More" menu at the end of Home's list tabs. */
function HomeListMoreMenu({ plain = false, refused = 0 }: { plain?: boolean; refused?: number }) {
  // Optional, so Home still renders where no app router is mounted (the preview and the screen tests).
  const router = useOptionalRouter();
  return (
    <Menu
      label="More for this list"
      align="end"
      items={[
        // Home notes 4, issue 4 (Josh, 9 Nov 2026): Today's review replaces the four Registers tabs
        // (Exceptions, Declines, Overrides, Refused) as the one page for what went off-plan today.
        // Batch 3 (one Handover): /review redirects to Governance's Review tab, so go there directly.
        // Plan 1: the refused count rides on the item, so the page that explains it is one tap from the number.
        {
          id: "review",
          label: "Today's review",
          meta: refused > 0 ? `${refused} refused` : undefined,
          onSelect: () => router?.push("/bedchart/governance?tab=review"),
        },
        // Feature plan item 29: the overnight page, with the same figures as the day screens.
        { id: "night", label: "Night view", onSelect: () => router?.push("/bedchart/night") },
        // Simplification mock-up (area 2 item 6): "Alerts history" cut; Alerts is one tap from the bell.
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={`${buttonClass({ variant: "ghost", size: "sm" })} ${plain ? "" : folderTabClasses.more} ${flowStyles.moreCover}`}
          data-testid="ward-home-more"
        >
          <Ellipsis size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={flowStyles.moreText} aria-hidden="true">
            {refused > 0 ? `More · ${refused}` : "More"}
          </span>
          <span className="sr-only">
            {refused > 0 ? `More for this list, ${refused} refused today` : "More for this list"}
          </span>
        </button>
      )}
    />
  );
}

export function CoordinatorScreen() {
  const network = useWardNetwork();
  // Audit four item 1: a site desk's hero Ready and In use count its own site, as the rail does.
  const { scope: deskScope } = useEffectiveWardAccess();
  const siteScope = deskScope.kind === "site" ? deskScope : undefined;
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
    broadcastAlerts,
    patients,
    supportNotifications,
    inboxSnoozes,
    inboxAcknowledgements,
    inboxOwnership,
    downtimePackPrints,
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
    "broadcastAlerts",
    "patients",
    "supportNotifications",
    "inboxSnoozes",
    "inboxAcknowledgements",
    "inboxOwnership",
    "downtimePackPrints",
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
  const router = useOptionalRouter();
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
  // The shortlist's other possible subject. Switching the queue between Patients and Referrals
  // never touches either selection.
  const [selectedReferralId, setSelectedReferralId] = useState<string | undefined>(undefined);
  const queueFocusRef = useRef<HTMLDivElement>(null);
  // The list tabs' row, which the curved folder shape measures.
  const listsNavRef = useRef<HTMLElement>(null);
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

  const scopedFilteredMovements = isInServiceScope ? movements.filter(isInServiceScope) : movements;
  const queue = queueOrder(scopedFilteredMovements, now);

  const referralQueueAll = coordinatorReferralQueue(referrals);
  const referralQueue = isReferralInServiceScope ? referralQueueAll.filter(isReferralInServiceScope) : referralQueueAll;
  // Resolved from the live queue each render. A referral decided in Home's panel (item 6a) leaves the
  // queue but stays open on its outcome, as on the board (CS-15), so its Undo toast still arrives.
  const selectedReferral = selectedReferralId
    ? (referralQueue.find((referral) => referral.id === selectedReferralId) ??
      referrals.find((referral) => referral.id === selectedReferralId))
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
  const canOpenHref = useCanOpenHref();
  /** Item 5: a breakdown row names the person in full (D-83), or says the name is not recorded. */
  const breakdownPerson = (movement: Movement) => {
    const resolved = patientOf(movement);
    return resolved.patient
      ? { name: resolved.formalName, href: patientHref(resolved.patient.id) }
      : { name: "Name not recorded" };
  };

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
          broadcastAlerts,
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
      broadcastAlerts,
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
  // Layout shift on Home (11 Nov 2026): the columns appear once the cards above My list and Later today have arrived.
  const cardsSettled = useHomeCardsSettled(!isPhone && !chosenAlert);
  const releaseAlert = releaseAlertId ? alertEntries.find((entry) => entry.item.id === releaseAlertId) : undefined;
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
        scope: siteScope,
      }),
    [movements, units, referrals, bedReleases, leaveBeds, admissions, now, thresholds, network, siteScope],
  );
  // Journey accountability continues through transit; the ED strip keeps physical inpatient waits.
  // With a service chosen, the hero's ED figures count that service's journeys (stress test, 3 Nov 2026).
  const edJourneys = useMemo(
    () => openEdJourneys(isInServiceScope ? movements.filter(isInServiceScope) : movements, now),
    [now, movements, isInServiceScope],
  );
  // The bed figures (beds ready, occupancy) stay network-wide on purpose (a placement may use any
  // ward), so with a service chosen they say so beside the figure.
  const networkWord = service === null ? "" : " · network-wide";
  const bedsReady = counts.capacity?.value ?? 0;
  // The highlight chips count the queue they highlight (after the ED and service filters), P002/P003.
  const chips = homeChipFigures(queue, now, undefined);

  // v10 hero: the one ring on the page is statewide occupancy, from the one shared count
  // (`ward-occupancy.ts`) every page and the rail read, against the sidebar's alert line.
  const statewideOccupancy = useMemo(() => {
    if (!siteScope) return wardOccupancy(units, admissions, bedReleases).percent;
    const places = wardPlaceLookup(units);
    const siteUnits = units.filter((unit) => unitInScope(siteScope, unit.id, places));
    return wardOccupancy(siteUnits, admissions, bedReleases).percent;
  }, [units, admissions, bedReleases, siteScope]);
  // Checking foot: what this page watched, as counts. Never "All clear". Review finding 14 (12 Nov
  // 2026): with a service chosen, it counts that service's wards only, as the rest of Home does.
  const checkedUnits = service === null ? units : units.filter((unit) => unitHealthService(unit) === service);
  const staleBedCounts = checkedUnits.filter((unit) => isBedCountStale(unit.allocatable.confirmedAt, now)).length;
  const wardsNotReporting = checkedUnits.filter((unit) => isBedCountStale(unit.allocatable.confirmedAt, now)).length;

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
  // Audit four #31: the placement drawer's kit pager steps through My list in its own order: beds to
  // pull, the Act now alerts, then the referrals to decide (the chosen focus narrows it, as the card does).
  const listSteps: { key: string; open: () => void }[] =
    shownView === "planned"
      ? []
      : [
          ...(needsFocus === "decide"
            ? []
            : [
                ...toPull.map((entry) => ({
                  key: `pull:${entry.referral.id}`,
                  open: () => {
                    setSelectedAlertId(undefined);
                    if (entry.movementId) selectMovement(entry.movementId);
                    else {
                      selectMovement(undefined);
                      selectReferral(entry.referral.id);
                    }
                  },
                })),
                ...actEntries.map((entry) => ({
                  key: `alert:${entry.item.id}`,
                  open: () => alertHandlers.onSelect(entry),
                })),
              ]),
          ...(needsFocus === "act"
            ? []
            : referralQueue.map((referral) => ({
                key: `ref:${referral.id}`,
                open: () => {
                  setSelectedAlertId(undefined);
                  selectMovement(undefined);
                  selectReferral(referral.id);
                },
              }))),
        ];
  const openStepKey = chosenAlert
    ? `alert:${chosenAlert.item.id}`
    : selectedReferral
      ? toPull.some((entry) => entry.referral.id === selectedReferral.id)
        ? `pull:${selectedReferral.id}`
        : `ref:${selectedReferral.id}`
      : deferredPanelMovement
        ? `pull:${toPull.find((entry) => entry.movementId === deferredPanelMovement.id)?.referral.id ?? ""}`
        : "";
  const listStepIndex = listSteps.findIndex((step) => step.key === openStepKey);
  const placementPager =
    listStepIndex < 0 || listSteps.length < 2
      ? undefined
      : {
          index: listStepIndex,
          total: listSteps.length,
          noun: "person",
          onStep: (delta: -1 | 1) => listSteps[(listStepIndex + delta + listSteps.length) % listSteps.length]?.open(),
        };
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
      pager={placementPager}
    />
  ) : null;

  // Plan item 2i (proposal): the hero's next step, from the same figures as the hero's toggles.
  // Act now first, then referrals to decide, then past-target waits in the flow; one at a time.
  const actPressed = shownView === "needs" && needsFocus === "act";
  // Audit two #115: the first Act now row as Needs you draws it, accepted referrals with no bed pulled
  // first (their Placement opens on "Pull the bed"), then the alerts, oldest first.
  const openFirstActNow = () => {
    const firstPull = toPull[0];
    const firstAlert = actEntries[0];
    if (firstPull?.movementId) {
      setSelectedAlertId(undefined);
      selectMovement(firstPull.movementId);
    } else if (firstPull) {
      setSelectedAlertId(undefined);
      selectMovement(undefined);
      selectReferral(firstPull.referral.id);
    } else if (firstAlert) {
      alertHandlers.onSelect(firstAlert);
    }
  };
  const decidePressed = shownView === "needs" && needsFocus === "decide";
  // Simplification mock-up (area 2 item 1): past-target waits open Waiting, longest wait first.
  const showOverdue = () => router?.push("/bedchart/waiting?order=longest");
  // Scope: with a service chosen, the step counts only that service's work, never statewide: the
  // hero's own scoped Act now (`heroActNow`), and the scoped referral queue and flow queue Home shows.
  const nextActCount = heroActNow;
  // Josh, 4 Nov 2026 (2i question 2): on tablet and desktop the hero chip that repeats the step's own
  // figure is left out, since the step's button does the same toggle.
  const nextKind: "act" | "decide" | "overdue" | null =
    nextActCount > 0 ? "act" : referralQueue.length > 0 ? "decide" : chips.overdueInQueue > 0 ? "overdue" : null;
  const nextScope = service === null ? "" : ` in ${service}`;
  // R-HOME-1 (mock-up HOME-M1): one answer with its parts, "12 need you: 6 act now, 6 to decide". Act now is
  // the one shared figure the bell and Alerts use (`alertsNowFigures`); to decide is the referral queue.
  const needsYou = nextActCount + referralQueue.length;
  // Controls 1 (C003): the parts ("6 act now", "6 to decide") are said once, in the lines under the title, so
  // the title keeps only the total.
  const needsYouAnswer = `${needsYou} ${needsYou === 1 ? "needs" : "need"} you${nextScope}`;
  const heroNext: HeroNextStep =
    nextActCount > 0
      ? {
          answer: needsYouAnswer,
          // Audit two #115 (P1), for Josh (reverses his 4 Nov button words): the act button opens the
          // first Act now row, as Movements, Alerts and Referrals open their next item. A filter left
          // on from before is cleared, so the row it opens is in view.
          action: actPressed
            ? {
                label: "Show all",
                pressed: true,
                testId: "home-next-action",
                onClick: () => toggleFocus("act"),
              }
            : {
                label: "Open next",
                testId: "home-next-action",
                onClick: openFirstActNow,
              },
        }
      : referralQueue.length > 0
        ? {
            answer: needsYouAnswer,
            action: {
              label: decidePressed ? "Show all" : "Show to decide",
              pressed: decidePressed,
              testId: "home-next-action",
              onClick: () => toggleFocus("decide"),
            },
          }
        : chips.overdueInQueue > 0
          ? {
              answer: `Nothing to act on now${nextScope} · ${chips.overdueInQueue} over target in the flow`,
              action: {
                label: "Open in Waiting",
                pressed: false,
                testId: "home-next-action",
                onClick: showOverdue,
              },
            }
          : { answer: `Nothing needs you now${nextScope}` };
  // Wave 4 (D-191): "3 alerts, 1 accepted with no bed pulled" on its own line under the head.
  // R-HOME-4: one line naming the oldest overdue referral to decide, its tier and wait, opening it.
  const oldestOverdue = referralQueue
    .filter((referral) => isReferralOverdue(referral, now))
    .sort((a, b) => a.raisedAt - b.raisedAt)[0];
  const overdueCount = referralQueue.filter((referral) => isReferralOverdue(referral, now)).length;
  // R-HOME-1: one line for the referrals to decide; it names the oldest overdue one and opens it (R-HOME-4).
  const decideLine =
    referralQueue.length === 0 ? null : oldestOverdue ? (
      <button
        type="button"
        className={heroStyles.actLine}
        data-testid="hero-overdue-referral"
        onClick={() => selectReferral(oldestOverdue.id)}
      >
        {`${referralQueue.length} to decide, ${overdueCount} overdue: Tier ${oldestOverdue.urgency} from ${originPlace(
          oldestOverdue,
        )}, ${splitDuration(Math.max(0, now - oldestOverdue.raisedAt))}, target ${targetHoursText(
          OVERDUE_AFTER_MINUTES_BY_TIER[oldestOverdue.urgency],
        )}`}
      </button>
    ) : (
      <span className={heroStyles.actLine} data-testid="hero-decide-line">{`${referralQueue.length} to decide`}</span>
    );
  const actParts = nextActCount > 0 ? homeActNowParts(nextActCount, toPull.length, nextScope).detail : undefined;
  const actDetail = nextActCount > 0 ? `${nextActCount} act now${actParts ? `: ${actParts}` : ""}` : undefined;
  // Josh, 4 Nov 2026 (2i question 5): the Checking line sits under the step whenever a bed count is
  // stale or a ward is not reporting (every size since the sticky header redesign, 9 Nov 2026).
  // Batch 4 item 24 (Josh approved the drawing 11 Nov 2026, D-142): a pointer to the wards whose
  // outage pack is old or never printed. The list itself lives once, on the Downtime pack screen.
  // Root-cause fix 3.3 (Josh, 13 Nov 2026): "never printed" and "over 24h old" are counted and worded
  // apart. Like the rest of this line, the count is the chosen service's wards, and the line says so.
  const packWords = oldPackWords(
    oldPackCounts(
      wardsWithOldPack(
        downtimePackPrints,
        checkedUnits.map((unit) => unit.id),
        now,
      ),
    ),
  );
  const bedChecks = staleBedCounts + wardsNotReporting > 0;
  const packPointer =
    packWords !== "" ? (
      <Link href="/bedchart/reports/downtime" className={catchUpStyles.pointer} data-testid="home-next-old-packs">
        {packWords}
      </Link>
    ) : null;
  const checkingLine =
    bedChecks || packPointer ? (
      <span data-testid="home-next-checking">
        Checking{nextScope}:{" "}
        {bedChecks ? (
          <>
            {staleBedCounts} stale bed {staleBedCounts === 1 ? "count" : "counts"}, {wardsNotReporting}{" "}
            {wardsNotReporting === 1 ? "ward" : "wards"} not reporting
          </>
        ) : null}
        {bedChecks && packPointer ? ", " : null}
        {packPointer}
      </span>
    ) : undefined;

  return (
    <div className={`${styles.screen} ${activity.glyphScope}`} data-testid="ward-coordinator" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Bed coordinator</h1>

        <div className={styles.body} data-testid="ward-coordinator-body">
          <Hero
            className={`${styles.homeHero} ${heroStyles.hero} ${sheetPlacement ? folderTabClasses.hero : ""}`}
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
            <HeroTop
              className={heroStyles.heroTop}
              figures={
                <HeroFigures
                  items={[
                    {
                      id: "ed",
                      value: edJourneys.total,
                      // PR E swap: the kit's `window` prop once HeroFigures takes it (none shown here).
                      // Wave 4 (D-191, notes item 4): count labels as nouns, as Capacity says them. The
                      // window word ("now") is left out because the page title already says "right now".
                      label: `Open ED movements${service === null ? "" : ` in ${service}`}`,
                      testId: "home-figure-ed",
                      // Item 5: tap the figure to see who is in it, from the same journeys it counts.
                      renderPress: (press) => (
                        <CountBreakdown
                          value={edJourneys.total}
                          noun={`open ED ${edJourneys.total === 1 ? "movement" : "movements"}${service === null ? "" : ` in ${service}`}`}
                          countedAt={now}
                          rows={() => movementBreakdownRows(edJourneys.people, breakdownPerson, now, canOpenHref)}
                          // Audit two #91 (T11): the Waiting and In transit split reads here, not on the ED band.
                          facts={() =>
                            waitingTransitFacts({ waiting: edJourneys.stillInEd, inTransit: edJourneys.inTransit })
                          }
                          className={press.className}
                          id={press.id}
                          labelledBy={press.labelledBy}
                          testId="home-figure-ed-breakdown"
                        >
                          {press.children}
                        </CountBreakdown>
                      ),
                    },
                    {
                      id: "beds",
                      value: bedsReady,
                      label: `Ready${networkWord}`,
                      testId: "home-figure-beds",
                      renderPress: (press) => (
                        <CountBreakdown
                          value={bedsReady}
                          noun={`${bedsReady === 1 ? "bed" : "beds"} ready${networkWord}`}
                          kind="beds"
                          countedAt={now}
                          rows={() => wardReadyBreakdownRows(counts.capacity?.readyWards ?? [], canOpenHref)}
                          className={press.className}
                          id={press.id}
                          labelledBy={press.labelledBy}
                          testId="home-figure-beds-breakdown"
                        >
                          {press.children}
                        </CountBreakdown>
                      ),
                    },
                    ...(statewideOccupancy === null
                      ? []
                      : [
                          {
                            id: "occupancy",
                            value: `${Math.round(statewideOccupancy)}%`,
                            // D-109 (Josh, 9 Nov 2026): the line tests the whole number shown. Ruling 4 (D-191):
                            // the figure reads "In use", as Capacity; at or over the alert line it keeps an
                            // amber dot (said in words to a screen reader) in place of the words "at risk".
                            label:
                              Math.round(statewideOccupancy) >= BED_ALERT_THRESHOLD_PERCENT ? (
                                <span className={heroStyles.figGlyphLabel}>
                                  <StatusGlyph tone="warning" size={9} />
                                  In use
                                  <SrOnly>, at or over the {BED_ALERT_THRESHOLD_PERCENT}% bed alert line</SrOnly>
                                </span>
                              ) : (
                                "In use"
                              ),
                            href: "/bedchart/capacity",
                            testId: "home-figure-occupancy",
                            linkTestId: "ward-home-occupancy-link",
                          },
                        ]),
                  ]}
                />
              }
              act={
                <HeroAct
                  tone={nextKind === "act" ? "danger" : "calm"}
                  kind={nextKind ?? "none"}
                  title={heroNext.answer}
                  titleTestId="hero-next-answer"
                  sub={
                    actDetail || checkingLine || decideLine ? (
                      <>
                        {actDetail ? (
                          <span className={heroStyles.actLine} data-testid="hero-next-detail">
                            {actDetail}
                          </span>
                        ) : null}
                        {decideLine}
                        {checkingLine ? <span className={heroStyles.actLine}>{checkingLine}</span> : null}
                      </>
                    ) : undefined
                  }
                  action={
                    heroNext.action
                      ? {
                          label: heroNext.action.label,
                          // v6 (Josh, 9 Nov 2026): the phone's act row keeps a short label. Audit three
                          // #18: never a bare "Open"; it says what opens.
                          phoneLabel: heroNext.action.pressed
                            ? undefined
                            : heroNext.action.label === "Open next"
                              ? "Open next"
                              : "Show",
                          pressed: heroNext.action.pressed,
                          onClick: heroNext.action.onClick,
                          testId: heroNext.action.testId,
                        }
                      : undefined
                  }
                />
              }
              band={
                <HomeEdPressure
                  onHero
                  now={now}
                  movements={movements}
                  edHref={(edId) => waitingHref(undefined, edId)}
                  service={service}
                  population={
                    // Audit two #91 (T11): the split moved into the first figure's breakdown, so the band
                    // head keeps its title and the link to All EDs.
                    <span data-testid="ward-home-ed-population">
                      Open<SrOnly> All EDs</SrOnly>
                    </span>
                  }
                />
              }
            />
          </Hero>

          {/* Ward wait list (Josh, 9 Nov 2026): a ward that said it is ready for its next patient. */}
          <WardReadyForNextLines now={now} />

          {/* Home flow (Q340, Q345, 3 Nov 2026): one row. Needs you and Flow lead as the raised switch; the
              stages follow, after a rule, as quieter tabs with counts (always shown; one opens Flow there). */}
          {sheetPlacement ? (
            <FolderTabs
              ref={listsNavRef}
              className={flowStyles.nav}
              label="Home lists"
              value={shownView}
              testId="home-lists"
              act={actNowCount > 0 ? 1 : undefined}
              more={<HomeListMoreMenu refused={rejections.length} />}
            >
              <Segmented
                className={`${list.viewSwitch} ${folderTabClasses.switch}`}
                label="Home list"
                size="md"
                value={shownView}
                onChange={(view) => {
                  showView(view);
                  chooseNeedsFocus("all");
                }}
                items={[
                  {
                    id: "needs",
                    label: "Needs you",
                    // Act now plus the referrals to decide (A9-04), the one Needs you figure (D-220).
                    count: needsYouCount(actNowCount, referralQueue.length),
                  },
                  ...(isPhone || layout === "tablet-portrait"
                    ? [{ id: "planned" as const, label: "Later today", count: plannedRows.length }]
                    : []),
                ]}
              />
            </FolderTabs>
          ) : (
            // Desktop and tablet landscape hold one list, so there is no tab bar: "Needs you" is the
            // section heading, with More at its right.
            <div className={flowStyles.needsHead} data-testid="home-lists">
              {/* Audit two #50 (P10): no count here on desktop, where the hero's title already says it. */}
              <h2 className={flowStyles.needsTitle}>Needs you</h2>
              <HomeListMoreMenu plain refused={rejections.length} />
            </div>
          )}

          <div
            className={`${styles.grid} ${list.grid}`}
            data-testid="ward-coordinator-region-grid"
            data-layout={layout}
            data-shortlist-open={hasPanelSubject}
            data-cards-pending={cardsSettled ? undefined : "true"}
            ref={queueFocusRef}
          >
            <div className={`${styles.side} ${list.workCol}`}>
              {/* Features 40 and 31 (9 Nov 2026): what changed since the last review, then this person's
                  pins. Both sit inside the column, under the folder tabs, so the approved tab join is
                  untouched, and both render nothing until there is something to show. */}
              {/* Batch 4 item 25 (D-142): after a recorded outage, the wards still to confirm. */}
              {shownView === "needs" ? <HomeOutageCatchUp now={now} /> : null}
              {/* Wave 4 (D-191, notes item 7): on Needs you the line sits inside its card. */}
              {shownView === "needs" ? null : <HomeSinceBanner now={now} />}
              <HomePinnedCard now={now} phone={isPhone} />
              {shownView === "planned" ? (
                <PlannedList now={now} rows={plannedRows} title="Later today" tabbed />
              ) : (
                <MyListCard
                  act={actEntries}
                  toPull={toPull}
                  since={<HomeSinceBanner now={now} inline />}
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
