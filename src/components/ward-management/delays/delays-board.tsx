"use client";

/**
 * The Delays board (approved mockup, October 2026): hero counts that filter, "whose move" tiles,
 * the table by blocker, a registers rail that becomes the person's panel, and graphs under it.
 * Figures come from `delays-board-model.ts`; the one write is Escalate, which the screen dispatches.
 */
import { edById } from "@/components/ward-management/ward-sites";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { holdInPlace, returnFocusInPlace, wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Activity, ChevronDown, ChevronRight, ClipboardList, Clock, Flag, SearchCheck, X } from "lucide-react";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import pageTop from "../page-top-hero.module.css";

import {
  formatInstantWithDay,
  formatSheetMoment,
  type Instant,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { activatedControl, hasOpenSheet } from "@/components/wf/sheet-focus";
import Link from "next/link";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientAgeText } from "@/components/ward-management/ward-patients";
import { type Movement, type Unit } from "@/components/ward-management/ward-model";
import { bandIncludes, originCode, tightHours, WAIT_BANDS, windowText, type WaitBandId } from "./wait-bands";
import { FormalName, ShowMoreRow } from "@/components/wf";
import { ListExportButton } from "@/components/ward-management/ward-list-export-button";
import { readDelaysFlat, transitNote, useDelaysFlatStore, useSideScroll, writeDelaysFlat } from "./delays-board-stores";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  FolderTabs,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  PhoneFilterFold,
  PillTabs,
  folderTabClasses,
  PhoneSheet,
  PortraitList,
  PortraitRail,
  TierTile,
  useIsPhone,
  useIsTabletPortrait,
  type PortraitGroup,
} from "@/components/wf";
import { type DelayCause, type DelayGroup, type DelayOwnerId } from "./delays-derivations";
import { BandBar, Glyph, GroupTrend } from "./delays-board-parts";
import {
  NO_FILTERS,
  OVER_8H,
  OVER_24H,
  SILENT_MINUTES,
  H24,
  H8,
  WAIT_THRESHOLD_LABELS,
  bandCounts,
  boardCatchments,
  boardRows,
  catchmentName,
  filterRows,
  hasFilters,
  isPinned,
  ownerTiles,
  runwayBins,
  wardSummary,
  waitingOrderLine,
  waitBand,
  waitTone,
  type BoardFilters,
  type BoardRow,
  isOver24hInEd,
  isOver8hInEd,
} from "./delays-board-model";
import { replaceSearchParams, useLocationSearch } from "@/components/ward-management/ward-url-state";
import { filtersFromSearch, filtersKey, filtersKeyOf, filtersToParams, flatOrderFromSearch } from "./delays-url-state";
import { DelaysBoardGraphs } from "./delays-board-graphs";
import { notWaitingParts, waitingSplit } from "@/components/ward-management/ward-shared-figures";
import { WAITING_VIEWS } from "./waiting-href";
import { inWaitingView, queuedReferralCount } from "./waiting-views";
import styles from "./delays-board.module.css";
import { PersonPanel, Registers } from "./delays-board-panels";
import {
  rememberReturnRow,
  rowWithAttribute,
  useReturnedView,
  useReturnToPlace,
} from "@/components/ward-management/use-return-to-place";
import { WaitBar, phoneUpdate, updateCell } from "./delays-board-rows";
import { legalCell, legalTimeAsTypedWords, phonePrefix } from "./delays-board-rows";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import waitingKeys from "./waiting.module.css";
import polish from "./waiting-polish.module.css";
import { WaitingKeyRow } from "./waiting-hero-bar";
import { useWaitingDeskWords } from "./waiting-desk-words";
import { WaitingOwnerTiles } from "./waiting-owner-tiles";
import { useShorterColumnAnchor } from "./waiting-column-anchor";
import { SearchField } from "@/components/wf";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

/** Groups shown open on first load: the severe ones and "Waiting on you". The rest start folded. */
const OPEN_BY_DEFAULT: readonly DelayCause[] = [
  "legal_breached",
  "legal_expiring",
  "no_eligible_bed",
  "awaiting_coordinator",
];
const GROUP_LIMIT = 5;

const byWait = (a: BoardRow, b: BoardRow) => b.waited - a.waited;
/** The hero chips' icons (page tops, 9 Nov 2026). */
const CHIP_ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export type DelaysBoardProps = {
  groups: DelayGroup[];
  now: Instant;
  units: Unit[];
  /** Whole-network escalations. A row outside the chosen service is marked, never dropped. */
  escalated: Movement[];
  /** Q-12: the severe causes network-wide, plus urgent movements outside the chosen service. */
  attention: { movement: Movement; title: string | undefined }[];
  closedToday: Movement[];
  service: string | null;
  isOutsideService: (movement: Movement) => boolean;
  onEscalate: (movement: Movement) => void;
  /** Rendered under the hero: the alias banner, the service scope bar and any notice. */
  banner?: ReactNode;
  /**
   * The coordinator's daily check, as a hero chip (page tops, 9 Nov 2026): how many to check, whether
   * today's check is recorded, and whether its list is open. The chip opens or closes the list.
   */
  dailyCheck?: { count: number; done: boolean; open: boolean; onToggle: () => void };
  /**
   * Note 8, issue 4 (Josh, 8 Nov 2026): another part of the page (the daily check) asks to open a
   * person here, on a given drawer tab. `n` changes on every ask, so the same person can reopen.
   */
  openRequest?: { id: string; tab: "summary" | "wards"; n: number };
  /** Shown in place of the board's body when nobody is waiting. */
  empty?: ReactNode;
};

const WAITING_ROUTE = "/ward-flow/waiting";
/** What Back brings back with the address's filters (`use-return-to-place.ts`): the opened groups. */
type WaitingPlace = {
  openGroups: Partial<Record<DelayCause, boolean>>;
  moreGroups: Partial<Record<DelayCause, boolean>>;
};
const selectButton = (id: string) => rowWithAttribute("data-testid", `delays-select-${id}`, "button");

/**
 * Waiting's board (October 2026 redesign, round 8 approved 31 Oct 2026). The review's changes: the
 * header's figures no longer overlap (the in-transit note leaves the figures, the Checking line becomes one figure), Longest wait groups people by how long they have
 * waited (over 24 hours all shown, over 8 hours the first four, under 8 hours folded), and each
 * row names its ED by code ("ARM ED") with the full name on hover.
 */
export function DelaysBoard({
  groups,
  now,
  units,
  escalated,
  attention,
  closedToday,
  service,
  isOutsideService,
  onEscalate,
  banner,
  dailyCheck,
  empty,
  openRequest,
}: DelaysBoardProps) {
  const zone = useClockZoneLabel();
  const thresholds = useDueSoonThresholds();
  const patientOf = usePatientOf();
  // Role views (nurse in charge, ED clinician): the desk's own words and lenses (`waiting-desk-words.ts`).
  const desk = useWaitingDeskWords(units);
  const effectiveAccess = useEffectiveWardAccess();
  const accessRole = effectiveAccess.role;
  const { wardDesk, edDesk } = desk;
  // The shared act-now list, as the Handover sheet reads it, so For handover matches its Act now.
  const {
    referrals: allReferrals,
    movements: allMovements,
    configuration,
    inboxSnoozes,
    dayZero,
  } = useWardFlowSelect("referrals", "movements", "configuration", "inboxSnoozes", "dayZero");
  const actNowIds = useMemo(
    () =>
      new Set(
        activeActNowItems({ movements: allMovements, units, configuration, inboxSnoozes }, now).map(
          (item) => item.movementId,
        ),
      ),
    [allMovements, units, configuration, inboxSnoozes, now],
  );
  const rows = useMemo(() => boardRows(groups, now, actNowIds), [groups, now, actNowIds]);
  const bins = useMemo(() => runwayBins(rows), [rows]);
  const catchments = useMemo(() => boardCatchments(rows), [rows]);
  // Role view (nurse in charge): a ward's own list is short; tiles, saved views and graphs only
  // repeat its few rows.
  const wardShort = wardDesk && rows.length <= 8;
  const [chosenFilters, setFilters] = useState<BoardFilters>(NO_FILTERS);
  // DA-15: the filters live in the web address, so a reload or a shared link opens the same list
  // (`delays-url-state.ts`). The address is read after hydration and followed whenever it asks for
  // something new: Back, Forward, or the Menu's severe link (shell-9). Search text stays on this
  // page only. Adjusting state during render is React's pattern for state derived from a store.
  const addressSearch = useLocationSearch();
  const addressKey = filtersKeyOf(addressSearch);
  const [seenAddressKey, setSeenAddressKey] = useState("");
  if (addressKey !== seenAddressKey) {
    setSeenAddressKey(addressKey);
    setFilters((current) => ({ ...filtersFromSearch(addressSearch), search: current.search }));
  }
  // The viewer's own change, written back. A value just read from the address already matches it.
  // Marking it seen at once keeps a second quick tap from being overruled by the first one's address.
  const chosenKey = filtersKey(chosenFilters);
  useEffect(() => {
    if (chosenKey === addressKey) return;
    // The order goes with the filters, so a link copied from a filtered list opens in the order its
    // sender saw, not the receiver's remembered one. Clearing every filter leaves the order key as it
    // was, so a bare address stays bare: each viewer's own order.
    replaceSearchParams({
      ...filtersToParams(chosenFilters),
      ...(chosenKey === ""
        ? {}
        : { order: (flatOrderFromSearch(window.location.search) ?? readDelaysFlat()) ? "longest" : "blocker" }),
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- records what was just written to the address, an external store
    setSeenAddressKey(chosenKey);
  }, [chosenKey, addressKey, chosenFilters]);
  // A blocker filter whose group has emptied (the person was recategorised) stops applying, so no
  // chip names a cause the board no longer shows.
  const filters = useMemo(
    () =>
      chosenFilters.cause !== null && !rows.some((row) => row.cause === chosenFilters.cause)
        ? { ...chosenFilters, cause: null }
        : chosenFilters,
    [chosenFilters, rows],
  );
  // Clear a stored blocker filter once it stops applying, so a later change cannot bring it back.
  // Adjusting state during render is React's pattern for state derived from changed props.
  if (chosenFilters.cause !== null && !rows.some((row) => row.cause === chosenFilters.cause))
    setFilters((current) => ({ ...current, cause: null }));
  // The order the address names wins (a shared link); otherwise the viewer's own remembered choice.
  const storedFlat = useDelaysFlatStore();
  const flat = flatOrderFromSearch(addressSearch) ?? storedFlat;
  const setFlat = (next: boolean) => {
    writeDelaysFlat(next);
    replaceSearchParams({ order: next ? "longest" : "blocker" });
  };
  const returned = useReturnedView<WaitingPlace>(WAITING_ROUTE);
  const [openGroups, setOpenGroups] = useState<WaitingPlace["openGroups"]>(returned?.openGroups ?? {});
  const [moreGroups, setMoreGroups] = useState<WaitingPlace["moreGroups"]>(returned?.moreGroups ?? {});
  // Redesign: which wait bands are open, and which show every row.
  const [bandOpen, setBandOpen] = useState<Partial<Record<WaitBandId, boolean>>>({});
  const [bandMore, setBandMore] = useState<Partial<Record<WaitBandId, boolean>>>({});
  useReturnToPlace<WaitingPlace>(WAITING_ROUTE, { openGroups, moreGroups }, selectButton);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tableRef = useRef<HTMLElement>(null);
  const [sideScrollRef, sideScroll] = useSideScroll();
  // v10 phone: the registers, the longest quiet list and the graphs sit one tap away as cards.
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();
  /* iPad portrait (820px, device audit 11 Oct 2026): list rows and the registers as a slide-over. */
  const portrait = isTabletPortrait && !isPhone;
  // Note 8, issue 5: the shorter of the list and the follow-up column holds in view as the page scrolls.
  const splitRef = useRef<HTMLDivElement>(null);
  useShorterColumnAnchor(splitRef, !isPhone && !portrait);
  const [railOpen, setRailOpen] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState<"registers" | "quiet" | "spread" | null>(null);
  const sheetViewsLabelId = useId();

  const nameOf = useCallback(
    (movement: Movement) => `${patientOf(movement).formalName} ${patientOf(movement).umrn}`,
    [patientOf],
  );
  // Owner ruling, 9 October 2026: filters narrow the table (the approved mockup), and the table
  // always says how many people they hide, with Show everyone. It supersedes, for this board, the
  // 7 September "a chip highlights, it never hides" ruling.
  const shown = useMemo(
    () => filterRows(rows, filters, bins, nameOf, thresholds),
    [rows, filters, bins, nameOf, thresholds],
  );
  // A person the filters hide is never shown as open: their panel closes rather than sit beside no row.
  const selected = selectedId === null ? null : (shown.find((row) => row.movement.id === selectedId) ?? null);
  // Drop the hidden choice too, so Escape, the pressed graph dot and a later clear all agree it closed.
  if (selectedId !== null && selected === null) setSelectedId(null);
  // Drawer review (6 Nov 2026): the person opens in the kit drawer, a modal over the list, so nothing
  // opens until a person is chosen (the ward desk used to open its first person in a side column).
  const filtered = hasFilters(filters);
  // Export (feature 44): the rows the filters leave, never names; the builder loads on the click.
  const exportList = async () =>
    (await import("./delays-export")).downloadWaitingList(
      shown,
      {
        umrnOf: (row) => patientOf(row.movement).umrn,
        edName: (edId) => (edId === undefined ? "Not recorded" : (edById(edId)?.name ?? edId)),
        serviceName: (row) => catchmentName(row.origin),
        causeTitle: (row) => desk.causeTitle(row.cause),
        ownerName: (row) => desk.ownerName(row.owner),
        legalTime: (row) => legalTimeAsTypedWords(row.movement, now, dayZero),
      },
      {
        asAt: formatSheetMoment(now, dayZero, { includeYearAndZone: true, zone }),
        scope: filtered
          ? `Waiting; the ${shown.length} of ${rows.length} people the current filters and search show`
          : "Waiting; everyone on the list, no filter or search applied",
      },
    );

  const set = (patch: Partial<BoardFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };
  const toggle = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? NO_FILTERS[key] : value }));
  };
  const isOpenGroup = (cause: DelayCause) => openGroups[cause] ?? OPEN_BY_DEFAULT.includes(cause);

  // The drawer (kit Sheet) moves focus in, traps it and returns it to the row on close.
  // Note 7 (Josh, 8 Nov 2026): the control that opened the drawer. Closing returns focus there without
  // scrolling, so a person opened from a graph or register does not throw the page to their table row.
  const openerRef = useRef<Element | null>(null);
  const select = (id: string) => {
    openerRef.current = activatedControl();
    rememberReturnRow(WAITING_ROUTE, id);
    setSelectedId((current) => (current === id ? null : id));
  };
  const close = useCallback(() => {
    const previous = selectedId;
    setSelectedId(null);
    if (previous !== null)
      returnFocusInPlace(openerRef.current, () =>
        document.querySelector<HTMLButtonElement>(`[data-testid="delays-select-${previous}"]`),
      );
  }, [selectedId]);
  /** From a graph or the rail: open the person's group, show them, and bring the row into view. */
  const reveal = (id: string) => {
    const row = rows.find((candidate) => candidate.movement.id === id);
    if (row === undefined) return;
    // Note 7: unfolding the person's group must not move the graph or register that was tapped.
    openerRef.current = activatedControl();
    holdInPlace(openerRef.current);
    // Opening someone the filters hide shows everyone first, so their row is there to open.
    if (!shown.some((candidate) => candidate.movement.id === id)) setFilters(NO_FILTERS);
    rememberReturnRow(WAITING_ROUTE, id);
    setSelectedId(id);
    setOpenGroups((current) => ({ ...current, [row.cause]: true }));
    setMoreGroups((current) => ({ ...current, [row.cause]: true }));
    // Longest wait: unfold the person's wait band too, so their row is on screen beside the panel.
    const band = WAIT_BANDS.find((candidate) => candidate.test(row));
    if (band !== undefined) {
      setBandOpen((current) => ({ ...current, [band.id]: true }));
      setBandMore((current) => ({ ...current, [band.id]: true }));
    }
    // The person opens in the drawer, which takes focus; the list behind keeps their row unfolded.
  };

  // Note 8, issue 4: the daily check opens its person here, on the tab that holds the fix.
  const [requestedTab, setRequestedTab] = useState<{ id: string; tab: "summary" | "wards" } | null>(null);
  const handledRequest = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (openRequest === undefined || handledRequest.current === openRequest.n) return;
    handledRequest.current = openRequest.n;
    setRequestedTab({ id: openRequest.id, tab: openRequest.tab });
    reveal(openRequest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per ask; reveal reads current state
  }, [openRequest]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (hasOpenSheet()) return;
      if (selectedId !== null) {
        event.preventDefault();
        close();
      } else if (hasFilters(filters)) {
        event.preventDefault();
        setFilters(NO_FILTERS);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, filters, selectedId]);

  // Audit 6 (Josh, 20 Oct 2026) and Audit 24-4 NA2-10 (24 Oct): both count people still in an ED, as the TV does.
  const over8 = rows.filter(isOver8hInEd).length;
  const over24 = rows.filter(isOver24hInEd).length;
  // Overall review, 20 Oct 2026: the figures lead with the one "waiting" figure (`waitingInEds`, the
  // menu badge's figure too), then name whoever else is on this list ("8 in transit"), so they add
  // up to the list's own count.
  const split = useMemo(() => waitingSplit(rows.map((row) => row.movement)), [rows]);
  // Decision 1: the colour key shows only when a row carries a typed legal time for it to explain.
  const anyTypedTime = rows.some((row) => currentLegalDueAt(row.movement) !== undefined);
  const urgentMinutes = thresholds.urgentMinutes;
  // B4 (Josh, 19 Oct 2026): the 1 hour chip names its noun, beside the 3 hour Form due view.
  const dueSoonLabel = `Form due within ${windowText(urgentMinutes)}`;
  // Referrals in the Referrals decision queue are not movements yet, so the list only counts them.
  const scope = useServiceScope();
  const queuedReferrals = useMemo(() => queuedReferralCount(allReferrals, scope, units), [allReferrals, scope, units]);
  const referralsLine = (
    <p className={`${styles.footNote} ${waitingKeys.referralsLine}`} data-testid="delays-referrals-line">
      {/* Role view (nurse in charge): the referrals counted are this ward's own to answer. */}
      {queuedReferrals === 0
        ? `No referrals awaiting ${wardDesk ? "your ward's" : "a"} decision.`
        : `${queuedReferrals} ${queuedReferrals === 1 ? "referral" : "referrals"} awaiting ${wardDesk ? "your ward's" : "a"} decision, not yet on this list.`}{" "}
      <Link href="/ward-flow/referrals" className={styles.lnk}>
        {wardDesk ? "Open Referrals to answer" : "Open Referrals"}
      </Link>
    </p>
  );

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.owner !== null)
    chips.push({
      key: "owner",
      label: desk.ownerName(filters.owner),
      clear: () => {
        set({ owner: null });
      },
    });
  if (filters.edId != null)
    chips.push({
      key: "ed",
      label: edById(filters.edId)?.name ?? filters.edId,
      clear: () => {
        set({ edId: null });
      },
    });
  if (filters.origin !== null)
    chips.push({
      key: "origin",
      label: catchmentName(filters.origin),
      clear: () => {
        set({ origin: null });
      },
    });
  if (filters.cause !== null)
    chips.push({
      key: "cause",
      label: desk.causeTitle(filters.cause),
      clear: () => {
        set({ cause: null });
      },
    });
  if (filters.dueSoon)
    chips.push({
      key: "due",
      label: dueSoonLabel,
      clear: () => {
        set({ dueSoon: false });
      },
    });
  if (filters.severe)
    chips.push({
      key: "severe",
      label: `At a time limit or nowhere to go · ${rows.filter((row) => row.severe).length}`,
      clear: () => {
        set({ severe: false });
      },
    });
  if (filters.breached)
    chips.push({
      key: "breached",
      label: "Form past its time",
      clear: () => {
        set({ breached: false });
      },
    });
  // The 12h step and No update 2h+ no longer have a chip of their own (overall review, 20 Oct 2026),
  // so when a link or the Longest quiet register turns one on it shows here, with a remove.
  if (filters.threshold === 2)
    chips.push({
      key: "threshold",
      label: `Waited ${WAIT_THRESHOLD_LABELS[2]}`,
      clear: () => {
        set({ threshold: 0 });
      },
    });
  if (filters.silent)
    chips.push({
      key: "silent",
      label: `No update ${SILENT_MINUTES / 60}h+`,
      clear: () => {
        set({ silent: false });
      },
    });
  if (filters.bin !== null) {
    const bin = bins[filters.bin];
    chips.push({
      key: "bin",
      label: `Crossing ${formatInstantWithDay(now + bin.from, now)} to ${formatInstantWithDay(now + bin.to, now)}`,
      clear: () => {
        set({ bin: null });
      },
    });
  }

  // Phone: only the first act-now row of yours in reading order carries the red edge, so one row
  // reads as the next thing to do rather than every urgent row shouting at once.
  let actRowMarked = false;
  const renderRow = (row: BoardRow) => {
    const { movement } = row;
    const patient = patientOf(movement);
    const isSelected = selectedId === movement.id;
    const ward = wardSummary(row, units);
    const isActRow =
      isPhone &&
      !actRowMarked &&
      row.owner === "yours" &&
      (row.cause === "legal_expiring" || row.cause === "legal_breached" || row.waited > OVER_24H);
    if (isActRow) actRowMarked = true;
    return [
      <tr
        role="row"
        key={movement.id}
        className={styles.r}
        data-severe={row.severe}
        aria-selected={isSelected}
        data-act={isActRow ? "true" : undefined}
        data-form-due={isPinned(row, thresholds) ? "true" : undefined}
        data-testid={`delays-row-${movement.id}`}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a, [data-legal-tip]") === null) select(movement.id);
        }}
      >
        <td role="cell" className={styles.who}>
          <button
            type="button"
            className={styles.whoBtn}
            aria-expanded={isSelected}
            onClick={() => {
              select(movement.id);
            }}
            data-testid={`delays-select-${movement.id}`}
          >
            <b className={`${styles.ellBlock} ${waitingKeys.phWrapLine}`}>
              <FormalName name={patient.formalName} />
            </b>
            <span className={`${styles.ellBlock} ${waitingKeys.phWrapLine}`} data-ward-type-floor="delays-profile">
              {isPhone ? phonePrefix(row, now, thresholds, dayZero) : null}
              {/* Josh, 30 Oct 2026: on a phone the ED leads, so a form shown first never cuts it off.
                  Role view (as ED clinician): every row is this ED's, so its code is left off. */}
              {(isPhone
                ? [
                    edDesk ? undefined : originCode(movement),
                    transitNote(movement, now),
                    `${patient.umrn}${patientAgeText(patient.patient, dayZero, now)}`,
                  ]
                : [
                    `${patient.umrn}${patientAgeText(patient.patient, dayZero, now)}`,
                    transitNote(movement, now),
                    edDesk ? undefined : originCode(movement),
                  ]
              )
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
        </td>
        <td role="cell" className={styles.cWait}>
          <span className={styles.wcell}>
            <span className={`${styles.wt} ${styles.num}`} data-ward-type-floor="delays-wait">
              <Glyph tone={waitTone(row.waited)} />
              {row.sinceReferral !== undefined ? (
                <>
                  {splitDuration(row.sinceReferral)}
                  <span className={styles.lg}>{` since referral · ${splitDuration(row.waited)} in ED`}</span>
                </>
              ) : (
                <>
                  {splitDuration(row.waited)}
                  <span className={styles.lg}> in ED</span>
                </>
              )}
            </span>
            <WaitBar row={row} />
          </span>
        </td>
        <td role="cell" className={styles.cTier}>
          <TierTile tier={movement.urgency} label={urgencyTierLabel(movement.urgency)} />
        </td>
        <td role="cell" className={styles.cWard} data-ward-type-floor="delays-cause">
          <span className={styles.lg}>
            {flat ? (
              <span className={styles.ell}>{desk.causeTitle(row.cause)}</span>
            ) : (
              <>
                <Glyph tone={ward.tone} />
                <span className={styles.ell}>{ward.text}</span>
              </>
            )}
          </span>
        </td>
        <td role="cell" className={styles.cLegal}>
          {legalCell(row, now, thresholds, dayZero)}
        </td>
        <td role="cell" className={styles.cUpd} data-ward-type-floor="delays-since">
          {isPhone ? phoneUpdate(row) : updateCell(row, now)}
        </td>
      </tr>,
    ];
  };

  /** Up, down, Home and End move between the people in the table. */
  const onListKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const current = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-testid^="delays-select-"]');
    if (current === null) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-testid^="delays-select-"]'),
    );
    const index = buttons.indexOf(current);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? Math.min(buttons.length - 1, index + 1)
            : Math.max(0, index - 1);
    event.preventDefault();
    buttons[next]?.focus();
  };

  let body: ReactNode[] = [];
  if (!flat) {
    for (const group of groups) {
      const list = shown.filter((row) => row.cause === group.cause).sort(byWait);
      if (list.length === 0) continue;
      const open = isOpenGroup(group.cause);
      const limit = moreGroups[group.cause] ? list.length : GROUP_LIMIT;
      const owner = list[0].owner;
      body.push(
        <tr
          role="row"
          key={`group-${group.cause}`}
          className={`${styles.grpH} ${polish.groupRow}`}
          data-tone={list[0].severe ? "danger" : desk.tagOwner(owner) === "yours" ? "accent" : undefined}
          data-open={open || undefined}
        >
          <td role="cell" colSpan={6}>
            <button
              type="button"
              className={styles.gin}
              aria-expanded={open}
              onClick={() => {
                setOpenGroups((current) => ({ ...current, [group.cause]: !open }));
              }}
              data-testid={`delays-cause-${group.cause}`}
              data-severe={list[0].severe}
            >
              <ChevronDown size={14} aria-hidden="true" className={open ? undefined : styles.folded} />
              <Glyph tone={list[0].severe ? "danger" : undefined} />
              {/* Audit 11 Oct 2026, phone: a short heading so the bed pull row is not cut short. */}
              <span className={styles.gTitle} title={group.title}>
                {isPhone && group.cause === "bed_pull_expired" ? (
                  <>
                    <span aria-hidden="true">Pull expired</span>
                    <span className="sr-only">{group.title}</span>
                  </>
                ) : (
                  group.title
                )}
              </span>
              <span className={styles.k} data-delays-group-count>
                {list.length}
              </span>
              <span className={polish.ownerTag} data-owner={desk.tagOwner(owner)}>
                {desk.moveWord(owner)}
              </span>
              <span className={styles.sp} />
              <span className={polish.longest}>
                <span className={polish.longestLabel}>Longest</span>
                <span className={styles.num}>{splitDuration(list[0].waited)}</span>
              </span>
              <BandBar bands={bandCounts(list)} className={`${styles.minibar} ${polish.groupBar}`} />
              {isPhone ? <GroupTrend rows={list} /> : null}
            </button>
          </td>
        </tr>,
      );
      if (open) {
        body.push(...list.slice(0, limit).flatMap(renderRow));
        if (list.length > limit)
          body.push(
            <tr role="row" key={`more-${group.cause}`} className={styles.more}>
              <td role="cell" colSpan={6}>
                <ShowMoreRow
                  onClick={() => {
                    setMoreGroups((current) => ({ ...current, [group.cause]: true }));
                  }}
                >
                  {`Show ${list.length - limit} more`}
                </ShowMoreRow>
              </td>
            </tr>,
          );
      }
    }
  } else {
    // Audit 1, Josh 20 Oct (CS-04, NB-6b): longest wait first for everyone. A recorded form time
    // due soon no longer pins a row; its legal cell and `data-form-due` still mark it.
    for (const band of WAIT_BANDS) {
      const list = shown.filter(band.test).sort(byWait);
      if (list.length === 0) continue;
      // Role view (nurse in charge): a short ward list opens every band in full rather than folding it.
      const open = bandOpen[band.id] ?? (wardShort || band.limit > 0);
      const limit = bandMore[band.id] || wardShort ? list.length : band.limit;
      const includes = bandIncludes(list); // "includes 3 in transit" (Josh, 30 Oct 2026)
      body.push(
        <tr
          role="row"
          key={`band-${band.id}`}
          className={`${styles.grpH} ${polish.groupRow}`}
          data-tone={band.tone}
          data-open={open || undefined}
        >
          <td role="cell" colSpan={6}>
            <button
              type="button"
              className={styles.gin}
              aria-expanded={open}
              // CB-3 (axe 4.14 label-content-name-mismatch): the band's visible words first, in order,
              // then how many people that is and whether all are in an ED.
              aria-label={`${band.title}, ${list.length}${includes && !isPhone ? `, ${includes}` : ""}, ${open ? (isPhone && includes) || band.note : "folded"}. ${list.length} ${list.length === 1 ? "person" : "people"}${includes ? "" : ", all in an ED"}`}
              onClick={() => setBandOpen((current) => ({ ...current, [band.id]: !open }))}
              data-testid={`delays-band-${band.id}`}
            >
              <ChevronDown size={14} aria-hidden="true" className={open ? undefined : styles.folded} />
              <Glyph tone={band.tone} />
              <span className={styles.gTitle}>{band.title}</span> <span className={styles.k}>{list.length}</span>{" "}
              {includes && !isPhone ? <span className={styles.mut}>{includes}</span> : null}
              <span className={styles.sp} />{" "}
              <span className={styles.mut}>{open ? (isPhone && includes) || band.note : "folded"}</span>
            </button>
          </td>
        </tr>,
      );
      if (open) {
        body.push(...list.slice(0, limit).flatMap(renderRow));
        if (list.length > limit)
          body.push(
            <tr role="row" key={`more-${band.id}`} className={styles.more}>
              <td role="cell" colSpan={6}>
                <ShowMoreRow onClick={() => setBandMore((current) => ({ ...current, [band.id]: true }))}>
                  {`Show ${list.length - limit} more`}
                </ShowMoreRow>
              </td>
            </tr>,
          );
      }
    }
  }
  // A person filtered out must never look like a person placed. Whenever filters hide anyone, the
  // table says how many, with a way to show everyone (owner ruling, 9 October 2026).
  const hidden = rows.length - shown.length;
  if (hidden > 0 && shown.length > 0)
    body.push(
      <tr role="row" key="hidden" className={styles.more}>
        <td role="cell" colSpan={6} className={styles.hiddenNote} data-testid="delays-hidden-note">
          {`${hidden} more ${hidden === 1 ? "person is" : "people are"} waiting, hidden by the filters above.`}{" "}
          <button
            type="button"
            className={styles.lnk}
            onClick={() => {
              setFilters(NO_FILTERS);
            }}
          >
            Show everyone
          </button>
        </td>
      </tr>,
    );
  if (shown.length === 0)
    body = [
      <tr role="row" key="none">
        <td role="cell" colSpan={6} className={styles.none}>
          {`Nobody matches these filters. ${rows.length} ${rows.length === 1 ? "person is" : "people are"} waiting, all hidden.`}{" "}
          <button
            type="button"
            className={styles.lnk}
            onClick={() => {
              setFilters(NO_FILTERS);
            }}
          >
            Show everyone
          </button>
        </td>
      </tr>,
    ];
  const registers = (
    <Registers
      escalated={escalated}
      attention={attention}
      closedToday={closedToday}
      rows={rows}
      now={now}
      units={units}
      service={service}
      isOutsideService={isOutsideService}
      silentPressed={filters.silent}
      onSilent={() => {
        set({ silent: !filters.silent });
      }}
      onPick={reveal}
    />
  );
  const portraitGroups: PortraitGroup[] = useMemo(() => {
    if (!portrait) return [];
    const portraitRow = (row: BoardRow) => {
      const patient = patientOf(row.movement);
      const ward = wardSummary(row, units);
      return {
        id: row.movement.id,
        name: patient.formalName,
        sub: [
          `${patient.umrn}${patientAgeText(patient.patient, dayZero, now)}`,
          transitNote(row.movement, now),
          edDesk ? undefined : originCode(row.movement),
        ]
          .filter(Boolean)
          .join(" · "),
        figure:
          row.sinceReferral !== undefined
            ? `${splitDuration(row.sinceReferral)} since referral · ${splitDuration(row.waited)} in ED`
            : `${splitDuration(row.waited)} in ED`,
        figureNote: phoneUpdate(row),
        tone: waitTone(row.waited),
        next: flat ? desk.causeTitle(row.cause) : ward.text,
        actNow:
          row.owner === "yours" &&
          (row.cause === "legal_expiring" || row.cause === "legal_breached" || row.waited > OVER_24H),
        selected: selectedId === row.movement.id,
      };
    };
    // Redesign: the same three wait bands as the desktop table, each one foldable.
    return flat
      ? WAIT_BANDS.map((band) => {
          const list = shown.filter(band.test).sort(byWait);
          return {
            id: band.id,
            title: band.title,
            tone: band.tone,
            note: [bandIncludes(list), band.note].filter(Boolean).join(" · "),
            // As on the desktop table and the phone: a band with no first-load rows ("Under 8 hours") starts folded.
            folded: !wardShort && band.limit === 0,
            rows: list.map(portraitRow),
          };
        }).filter((group) => group.rows.length > 0)
      : groups.map((group) => {
          const list = shown.filter((row) => row.cause === group.cause).sort(byWait);
          return {
            id: group.cause,
            title: group.title,
            tone: list[0]?.severe ? ("danger" as const) : undefined,
            note: list[0] ? `${desk.ownerName(list[0].owner)} to clear` : undefined,
            rows: list.map(portraitRow),
          };
        });
  }, [portrait, flat, shown, groups, units, now, dayZero, selectedId, patientOf, desk, edDesk, wardShort]);
  // Role view (nurse in charge): the registers are the coordinator's, so a ward desk has no rail.
  const portraitRail =
    portrait && !wardDesk ? (
      <PortraitRail
        title="Today's follow-up"
        summary={`Attention ${attention.length} · Escalated ${escalated.length}`}
        description="Who needs acting on, who is escalated, what was done today and the longest quiet"
        open={railOpen}
        onOpenChange={setRailOpen}
      >
        <Registers
          titled={false}
          escalated={escalated}
          attention={attention}
          closedToday={closedToday}
          rows={rows}
          now={now}
          units={units}
          service={service}
          isOutsideService={isOutsideService}
          silentPressed={filters.silent}
          onSilent={() => {
            set({ silent: !filters.silent });
            setRailOpen(false);
          }}
          onPick={(id) => {
            setRailOpen(false);
            reveal(id);
          }}
        />
      </PortraitRail>
    ) : null;
  // Role views: the whose-move tiles named from the desk's side.
  const tiles = ownerTiles(rows).map((tile) =>
    wardDesk || edDesk ? { ...tile, name: desk.ownerName(tile.owner) } : tile,
  );
  // C1: the filters that are on, for the phone Filter button. The 12h step and No update 2h+ are
  // already in `chips`; the hero's 8h and 24h figures count once here. The search box is separate.
  const filterCount =
    chips.length +
    (filters.threshold === 1 || filters.threshold === 3 ? 1 : 0) +
    (filters.locked ? 1 : 0) +
    (filters.view !== null ? 1 : 0);
  /** The quick filter chips: inline above the list, or in the phone Filter sheet (C1). */
  /* B4 saved views: each narrows the list and keeps its order. One view at a time. */
  // Role view (nurse in charge): saved views narrow a long list; a ward's few rows need none.
  const viewChips = wardShort ? null : (
    <>
      {WAITING_VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          className={styles.chip}
          aria-pressed={filters.view === view}
          title={tightHours(desk.viewHint(view, thresholds))}
          onClick={() => {
            set({ view: filters.view === view ? null : view });
          }}
          data-testid={`delays-view-${view}`}
        >
          {/* Josh, 30 Oct 2026: no "(as written)" on form labels. */}
          {tightHours(desk.viewLabel(view, thresholds).replace(" (as written)", ""))}{" "}
          <span className={styles.k}>{rows.filter((row) => inWaitingView(view, row, thresholds)).length}</span>
        </button>
      ))}
      {/* Overall review, 20 Oct 2026: only the views and Locked bed stay here (see delays-url-state.ts). */}
      <button
        type="button"
        className={styles.chip}
        aria-pressed={filters.locked}
        // F-24: "locked" is the app's word for a secure bed, so the chip keeps it and hints.
        title="People who need a secure (locked) bed"
        onClick={() => {
          set({ locked: !filters.locked });
        }}
      >
        Locked bed <span className={styles.k}>{rows.filter((row) => row.locked).length}</span>
      </button>
    </>
  );
  /* D-91: the one page search field; the placeholder names only what is searched. */
  const searchField = (
    <SearchField
      className={`${waitingKeys.searchField} ${polish.search}`}
      value={filters.search}
      onValueChange={(search) => set({ search })}
      // Role view (as ED clinician): one ED, so the search finds a person only.
      placeholder={edDesk ? "Name or UMRN" : "Name, UMRN or ED"}
      label={edDesk ? "Find a person" : "Find a person or ED"}
    />
  );
  // Round 4 (`waiting-hero-bar.tsx`), now a hero chip (page tops, 9 Nov 2026): who passes 8h next,
  // and how many more within the hour. The chip opens that person's row.
  const under8 = rows.filter((row) => row.waited < OVER_8H).sort((x, y) => y.waited - x.waited);
  const next8 = under8[0];
  const next8Within = under8.filter((row) => OVER_8H - row.waited <= 60).length;
  // Plan item 2i (proposal): the hero's next step is the desk's own move. A coordinator's is "yours",
  // an ED desk's is the ED's and a ward desk's is the wards'. The figures are the whose-move tile's
  // own rows, so the sentence and the tile can never disagree.
  // A site bed manager reads this list with the coordinator's words, but the coordinator's move is
  // not theirs: their step is their site's wards (a ward to answer or a bed to be ready).
  const siteDesk = accessRole === "bed_manager";
  const ownOwner: DelayOwnerId = edDesk ? "ed" : wardDesk || siteDesk ? "wards" : "yours";
  const ownTile = tiles.find((tile) => tile.owner === ownOwner);
  const ownCount = ownTile?.rows.length ?? 0;
  const ownPressed = filters.owner === ownOwner;
  const moveWords = siteDesk ? "waiting on your site's wards" : "waiting on your move";
  // A chosen service is named, so the sentence never reads as the statewide figure.
  const inService = service === null || wardDesk || edDesk || siteDesk ? "" : ` in ${service}`;
  // Page tops (Josh, 9 Nov 2026): the act row says it short ("41 on your move"); the tile's own sub
  // fact stays as its quiet second line, said as typed.
  const moveShort = siteDesk ? "on your site's wards" : "on your move";
  const ownSub =
    ownTile && ownCount > 0 && ownTile.sub.count > 0
      ? ownOwner === "yours"
        ? `${ownTile.sub.count} with a form due or past its time`
        : ownOwner === "wards"
          ? `${ownTile.sub.count} with no suitable bed`
          : undefined
      : undefined;
  const filterRow = (inSheet: boolean) => (
    <div className={`${styles.chead} ${styles.fRow}${inSheet ? ` ${styles.fRowSheet}` : ` ${polish.filterRow}`}`}>
      {/* Design review (22 Oct 2026, Josh approved): in the phone Filter sheet the views sit under
          a Views label in a two by two grid lined up with the sheet title, not a ragged wrap. */}
      {inSheet && viewChips !== null ? (
        <div className={styles.sheetViews}>
          <p className={styles.sheetViewsLabel} id={sheetViewsLabelId}>
            Views
          </p>
          <div className={styles.sheetViewGrid} role="group" aria-labelledby={sheetViewsLabelId}>
            {viewChips}
          </div>
        </div>
      ) : (
        viewChips
      )}
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className={styles.chip}
          aria-pressed="true"
          aria-label={`Remove filter ${chip.label}`}
          onClick={chip.clear}
        >
          {chip.label}
          <X size={12} aria-hidden="true" />
        </button>
      ))}
      <span className={styles.sp} />
      {filtered ? (
        <button
          type="button"
          className={styles.lnk}
          onClick={() => {
            setFilters(NO_FILTERS);
          }}
        >
          Clear
        </button>
      ) : null}
      {inSheet ? null : <ListExportButton load={exportList} disabled={shown.length === 0} testId="delays-export" />}
    </div>
  );

  return (
    <>
      <Hero
        level={1}
        // Role views: a ward desk's list is only the people coming to its ward.
        eyebrow={wardDesk ? (desk.ownWardName ? `Waiting · coming to ${desk.ownWardName}` : "Waiting") : undefined}
        title={
          <>
            ED waits <span className={pageTop.titleSoft}>right now</span>
          </>
        }
        testId="delays-hero"
        className={`${styles.delaysHero} ${pageTop.hero} ${folderTabClasses.hero}`}
        aside={<LiveChip state="live" onHero />}
      >
        <HeroTop
          testId="delays-top"
          // Page tops (Josh, 9 Nov 2026): the waiting figure and who is not waiting, then the 8h
          // and 24h counts, each of which filters the list.
          figures={
            <HeroFigures
              label="Filter by the headline counts"
              items={[
                { id: "waiting", value: split.waiting, label: "in ED", testId: "delays-stat-waiting" },
                ...notWaitingParts(split).map((part) => {
                  const space = part.indexOf(" ");
                  return { id: part, value: part.slice(0, space), label: part.slice(space + 1) };
                }),
                ...(isPhone
                  ? []
                  : [
                      {
                        id: "over8",
                        value: over8,
                        label: `over ${H8}`,
                        testId: "delays-stat-over8",
                        linkTestId: "delays-stat-over8-filter",
                        onClick: over8 > 0 || filters.threshold === 1 ? () => toggle("threshold", 1) : undefined,
                      },
                    ]),
                {
                  id: "over24",
                  value: over24,
                  label: `past ${H24}`,
                  testId: "delays-stat-over24",
                  linkTestId: "delays-stat-over24-filter",
                  onClick: over24 > 0 || filters.threshold === 3 ? () => toggle("threshold", 3) : undefined,
                },
              ]}
            />
          }
          act={
            ownCount > 0 || ownPressed ? (
              <HeroAct
                tone="danger"
                testId="delays-next"
                titleTestId="hero-next-answer"
                title={`${ownCount} ${moveShort}${inService}`}
                sub={ownSub}
                action={{
                  label: ownPressed ? "Show everyone" : ownCount === 1 ? "Show them" : `Show these ${ownCount}`,
                  phoneLabel: ownPressed ? "All" : "Show",
                  pressed: ownPressed,
                  testId: "delays-next-action",
                  onClick: () =>
                    setFilters((current) => ({
                      ...current,
                      owner: current.owner === ownOwner ? null : ownOwner,
                      cause: null,
                    })),
                }}
              />
            ) : (
              <HeroAct
                tone="calm"
                testId="delays-next"
                titleTestId="hero-next-answer"
                title={`Nobody is ${moveWords}${inService}`}
              />
            )
          }
          chips={
            <HeroQuickChips
              label="Waiting tools"
              items={[
                ...(dailyCheck && dailyCheck.count > 0
                  ? [
                      {
                        id: "check",
                        label: "Daily check",
                        icon: <ClipboardList {...CHIP_ICON} />,
                        count: dailyCheck.done ? undefined : dailyCheck.count,
                        countLabel: " to check",
                        pressed: dailyCheck.open,
                        onClick: dailyCheck.onToggle,
                        testId: "ward-missed-check",
                      },
                    ]
                  : []),
                ...(next8
                  ? [
                      {
                        id: "next8",
                        label: `Next over ${H8} · ${formatInstantWithDay(now + (OVER_8H - next8.waited), now)}`,
                        icon: <Clock {...CHIP_ICON} />,
                        count: next8Within > 1 ? next8Within - 1 : undefined,
                        countTone: "quiet" as const,
                        countLabel: " more within the hour",
                        onClick: () => reveal(next8.movement.id),
                        testId: "delays-hero-next8",
                      },
                    ]
                  : []),
                ...(wardDesk
                  ? []
                  : [
                      {
                        id: "find",
                        label: "Find a bed",
                        icon: <SearchCheck {...CHIP_ICON} />,
                        onClick: () =>
                          requestToolsTool(
                            "bed-finder",
                            document.activeElement instanceof HTMLElement ? document.activeElement : undefined,
                          ),
                      },
                    ]),
              ]}
            />
          }
          band={
            // Phone: whose move as one slim band, in place of the sliding tiles under the hero.
            isPhone && !wardShort ? (
              <HeroBand
                title="Whose move"
                aside="longest wait"
                testId="delays-whose-move"
                cells={tiles.map((tile) => {
                  const longest = tile.rows.reduce((most, row) => Math.max(most, row.waited), 0);
                  const band = waitBand(longest);
                  return {
                    id: tile.owner,
                    label: tile.name,
                    value: tile.rows.length,
                    sub: tile.rows.length > 0 ? splitDuration(longest) : undefined,
                    subTone: band === 3 ? ("danger" as const) : band >= 1 ? ("warning" as const) : undefined,
                    pressed: filters.owner === tile.owner,
                    testId: `delays-owner-${tile.owner}`,
                    onClick: () =>
                      setFilters((current) => ({
                        ...current,
                        owner: current.owner === tile.owner ? null : tile.owner,
                        cause: null,
                      })),
                  };
                })}
              />
            ) : undefined
          }
        />
      </Hero>
      {/* Page tops (Josh, 9 Nov 2026): the list's order is the page's tabs, under the hero. The views
          sit beside them on a laptop; on a phone they fold into Filter at the row's end. */}
      {empty !== undefined ? null : (
        <FolderTabs
          label="Waiting list"
          value={flat ? "flat" : "cause"}
          testId="delays-tabs"
          more={
            isPhone ? (
              <PhoneFilterFold
                count={filterCount}
                title="Filter the list"
                className={`${styles.phoneFold} ${folderTabClasses.more}`}
                data-testid="delays-filter-fold"
              >
                {filterRow(true)}
              </PhoneFilterFold>
            ) : undefined
          }
        >
          <PillTabs
            className={folderTabClasses.switch}
            label="Order the table"
            value={flat ? "flat" : "cause"}
            onChange={(id) => setFlat(id === "flat")}
            items={[
              { id: "flat", label: "Longest wait" },
              { id: "cause", label: "By hold-up" },
            ]}
          />
          {isPhone ? null : (
            <>
              <span className={folderTabClasses.rule} aria-hidden="true" />
              <div className={`${folderTabClasses.filters} ${polish.topFilters}`}>{filterRow(false)}</div>
            </>
          )}
        </FolderTabs>
      )}
      {banner}
      {empty !== undefined ? (
        <div className={styles.split} data-single={wardDesk || undefined}>
          <section className={`${styles.card} ${styles.emptyCard}`} aria-label="Waiting">
            {empty}
            {referralsLine}
          </section>
          {/* Role view (nurse in charge): the registers are the coordinator's. */}
          {wardDesk ? null : registers}
        </div>
      ) : (
        <>
          {/* Role view (nurse in charge): on a short list the whose-move tiles repeat the Blocker column.
              Page tops (9 Nov 2026): a phone has them as the hero's Whose move band instead. */}
          {wardShort || isPhone ? null : (
            <WaitingOwnerTiles
              tiles={tiles}
              pressed={filters.owner}
              isPhone={isPhone}
              onPress={(owner) =>
                setFilters((current) => ({ ...current, owner: current.owner === owner ? null : owner, cause: null }))
              }
            />
          )}

          <div
            ref={splitRef}
            className={`${styles.split} ${polish.split}`}
            data-portrait={portrait ? "slide" : undefined}
            // Role view (nurse in charge, Josh 31 Oct 2026): no registers rail, so with the person panel
            // closed the list takes the full width instead of leaving an empty column.
            data-single={wardDesk || undefined}
          >
            <section
              ref={tableRef}
              id="delays-table"
              className={`${styles.card} ${styles.tableCard}`}
              aria-label="Waiting"
              data-ward-primitive="panel"
              tabIndex={-1}
            >
              {/* Not pinned (spec item 9): the order switch moved up into the tabs, so on a phone this
                  head is an empty band, and pinned it painted over the pinned tab row. */}
              <div className={`${styles.chead} ${polish.tableHead}`} data-testid="delays-table-head">
                <h2>{flat ? "Waiting" : "Waiting by reason"}</h2>
                <span
                  className={styles.meta}
                  data-testid="delays-shown-count"
                >{`${shown.length} of ${rows.length}`}</span>
                <span className={`${styles.meta} ${polish.orderNote}`} data-testid="delays-order-note">
                  {waitingOrderLine(flat)}
                </span>
                <span className={styles.sp} />
                {/* Round 4: search and the order switch share one line, at one height. */}
                {searchField}
              </div>
              {/* Page tops (9 Nov 2026): the order switch, the views and the phone's Filter moved up
                  into the tabs under the hero. */}
              {portrait ? (
                <div className={styles.portraitBody}>
                  <div className={styles.portraitTools}>{portraitRail}</div>
                  <PortraitList label="Waiting" groups={portraitGroups} onOpen={select} />
                </div>
              ) : null}
              {/* DA-26 (design audit): while the table scrolls sideways it is a tab stop, so the
                  hidden columns can be reached by keyboard, and its cut edge fades. */}
              <div
                ref={sideScrollRef}
                className={`${styles.tableWrap} ${waitingKeys.phoneTimes}`}
                hidden={portrait}
                data-more-before={sideScroll.before || undefined}
                data-more-after={sideScroll.after || undefined}
                tabIndex={sideScroll.before || sideScroll.after ? 0 : undefined}
                role={sideScroll.before || sideScroll.after ? "region" : undefined}
                aria-label={sideScroll.before || sideScroll.after ? "Waiting list, scrolls sideways" : undefined}
              >
                {/* Decision 1 (Josh, 30 Oct 2026): the one colour key for typed legal times sits beside
                    the tier key, on the list it explains. */}
                <WaitingKeyRow anyTypedTime={anyTypedTime} />
                <table className={`${styles.tbl} ${polish.noEdge}`} data-testid="delays-waiting-list" role="table">
                  <colgroup>
                    <col className={styles.colP} />
                    <col className={styles.colW} />
                    <col className={styles.colT} />
                    <col className={styles.colB} />
                    <col className={styles.colL} />
                    <col className={styles.colU} />
                  </colgroup>
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">
                        Person
                      </th>
                      <th scope="col" role="columnheader">
                        Waited
                      </th>
                      <th scope="col" role="columnheader">
                        <abbr title="Urgency tier">T</abbr>
                      </th>
                      <th scope="col" role="columnheader">
                        {flat ? "Held up by" : "Wards"}
                      </th>
                      <th scope="col" role="columnheader">
                        Legal
                      </th>
                      <th scope="col" role="columnheader">
                        Last update
                      </th>
                    </tr>
                  </thead>
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
                  <tbody role="rowgroup" onKeyDown={onListKey}>
                    {body}
                  </tbody>
                </table>
              </div>
              {referralsLine}
            </section>

            {isPhone || portrait || wardDesk
              ? null
              : // Role view (nurse in charge): escalation and the quiet list are the coordinator's chase.
                registers}
          </div>

          {/* Drawer review (6 Nov 2026): the person opens in the kit drawer, over the full-width list. */}
          {selected !== null ? (
            <PersonPanel
              row={selected}
              units={units}
              now={now}
              onClose={close}
              onEscalate={onEscalate}
              initialTab={requestedTab?.id === selected.movement.id ? requestedTab.tab : undefined}
            />
          ) : null}

          {/* Role view (nurse in charge): registers, quiet list, graphs and network delays are the coordinator's. */}
          {isPhone && !wardDesk ? (
            <div className={styles.phCards} data-testid="delays-phone-cards">
              <button type="button" className={styles.phCard} onClick={() => setPhoneSheet("registers")}>
                <Flag size={16} aria-hidden="true" className={styles.phCardIcon} />
                <span className={styles.phCardText}>
                  <span className={styles.phCardTitle}>Today&apos;s follow-up</span>
                  <span className={styles.phCardMeta}>
                    Attention <b>{attention.length}</b> · Escalated <b>{escalated.length}</b> · Done today{" "}
                    <b>{closedToday.length}</b>
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" className={styles.phCardIcon} />
              </button>
              <button type="button" className={styles.phCard} onClick={() => setPhoneSheet("quiet")}>
                <Activity size={16} aria-hidden="true" className={styles.phCardIcon} />
                <span className={styles.phCardText}>
                  <span className={styles.phCardTitle}>Longest quiet</span>
                  <span className={styles.phCardMeta}>Who has gone longest with nothing recorded</span>
                </span>
                <ChevronRight size={16} aria-hidden="true" className={styles.phCardIcon} />
              </button>
              <button type="button" className={styles.phCard} onClick={() => setPhoneSheet("spread")}>
                <Activity size={16} aria-hidden="true" className={styles.phCardIcon} />
                <span className={styles.phCardText}>
                  <span className={styles.phCardTitle}>Wait spread and the hours ahead</span>
                  <span className={styles.phCardMeta}>Where the waits sit, and who crosses {H8} next</span>
                </span>
                <ChevronRight size={16} aria-hidden="true" className={styles.phCardIcon} />
              </button>
              <div className={styles.phCard}>
                <Glyph tone="success" />
                <span className={styles.phCardText}>
                  <span className={styles.phCardTitle}>Delays with no named person</span>
                  <span className={styles.phCardMeta}>{edDesk ? "None recorded" : "None recorded statewide"}</span>
                </span>
              </div>
              <PhoneSheet
                open={phoneSheet === "registers" || phoneSheet === "quiet"}
                onClose={() => setPhoneSheet(null)}
                title={phoneSheet === "quiet" ? "Longest quiet" : "Today's follow-up"}
                description={
                  phoneSheet === "quiet"
                    ? "Who has gone longest with nothing recorded"
                    : "Who needs acting on, who is escalated and what was done today"
                }
                height="tall"
              >
                <Registers
                  titled={false}
                  escalated={escalated}
                  attention={attention}
                  closedToday={closedToday}
                  rows={rows}
                  now={now}
                  units={units}
                  service={service}
                  isOutsideService={isOutsideService}
                  silentPressed={filters.silent}
                  onSilent={() => {
                    set({ silent: !filters.silent });
                    setPhoneSheet(null);
                  }}
                  onPick={(id) => {
                    setPhoneSheet(null);
                    reveal(id);
                  }}
                  part={phoneSheet === "quiet" ? "quiet" : "registers"}
                />
              </PhoneSheet>
              <PhoneSheet
                open={phoneSheet === "spread"}
                onClose={() => setPhoneSheet(null)}
                title="Wait spread and the hours ahead"
                height="tall"
              >
                <DelaysBoardGraphs
                  rows={rows}
                  shown={shown}
                  bins={bins}
                  now={now}
                  filters={filters}
                  catchments={catchments}
                  selectedId={selectedId}
                  onFilters={(patch, toFlat) => {
                    set(patch);
                    if (toFlat) setFlat(true);
                  }}
                  onClear={() => {
                    setFilters(NO_FILTERS);
                  }}
                  onPick={(id) => {
                    setPhoneSheet(null);
                    reveal(id);
                  }}
                  onToTable={() => {
                    setPhoneSheet(null);
                    tableRef.current?.scrollIntoView({ behavior: wardScrollBehavior(), block: "start" });
                  }}
                />
              </PhoneSheet>
            </div>
          ) : null}

          {isPhone || wardShort ? null : (
            <DelaysBoardGraphs
              rows={rows}
              shown={shown}
              bins={bins}
              now={now}
              filters={filters}
              catchments={catchments}
              selectedId={selectedId}
              onFilters={(patch, toFlat) => {
                set(patch);
                if (toFlat) setFlat(true);
              }}
              onClear={() => {
                setFilters(NO_FILTERS);
              }}
              onPick={reveal}
              onToTable={() => {
                tableRef.current?.scrollIntoView({ behavior: wardScrollBehavior(), block: "start" });
                tableRef.current?.focus({ preventScroll: true });
              }}
            />
          )}
        </>
      )}
    </>
  );
}
