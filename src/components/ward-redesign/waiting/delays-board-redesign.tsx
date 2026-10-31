"use client";

/**
 * The Delays board (approved mockup, October 2026): hero counts that filter, "whose move" tiles,
 * the table by blocker, a registers rail that becomes the person's panel, and graphs under it.
 * Figures come from `delays-board-model.ts`; the one write is Escalate, which the screen dispatches.
 */
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Activity, ChevronDown, ChevronRight, Flag, X } from "lucide-react";

import { formatInstantWithDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import Link from "next/link";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useDueSoonThresholds, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { type Movement, type Unit } from "@/components/ward-management/ward-model";
import {
  bandIncludes,
  originCode,
  tightHours,
  WAIT_BANDS,
  waitingCauseTitle as causeTitle,
  windowText,
  type WaitBandId,
} from "./wait-bands";
import { ShowMoreRow } from "@/components/ward-redesign/parts/show-more-row";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  CheckingFoot,
  Hero,
  LiveChip,
  PhoneFilterFold,
  PhoneSheet,
  PortraitList,
  PortraitRail,
  TierTile,
  useIsPhone,
  useIsTabletPortrait,
  type PortraitGroup,
  type WfTone,
} from "@/components/wf";
import { type DelayCause, type DelayGroup } from "@/components/ward-management/delays/delays-derivations";
import { BandBar, Glyph } from "@/components/ward-management/delays/delays-board-parts";
import {
  NO_FILTERS,
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
  isBreached,
  isDueSoon,
  isPinned,
  ownerName,
  ownerTiles,
  runwayBins,
  wardSummary,
  waitingOrderLine,
  waitTone,
  type BoardFilters,
  type BoardRow,
  isOver24hInEd,
  isOver8hInEd,
} from "@/components/ward-management/delays/delays-board-model";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { createBrowserStore } from "@/lib/client-store-factory";
import { replaceSearchParams, useLocationSearch } from "@/components/ward-management/ward-url-state";
import {
  filtersFromSearch,
  filtersKey,
  filtersKeyOf,
  filtersToParams,
  flatOrderFromSearch,
} from "@/components/ward-management/delays/delays-url-state";
import { DelaysBoardGraphs } from "@/components/ward-redesign/waiting/waiting-board-graphs";
import { notWaitingParts, waitingSplit } from "@/components/ward-management/ward-shared-figures";
import { WAITING_VIEWS } from "@/components/ward-management/delays/waiting-href";
import {
  inWaitingView,
  queuedReferralCount,
  waitingViewHint,
  waitingViewLabel,
} from "@/components/ward-management/delays/waiting-views";
import styles from "@/components/ward-management/delays/delays-board.module.css";
import wardPin from "@/components/ward-management/ward-pinned-switch.module.css";
import { PersonPanel, Registers } from "./delays-board-panels-redesign";
import {
  rememberReturnRow,
  rowWithAttribute,
  useReturnedView,
  useReturnToPlace,
} from "@/components/ward-management/use-return-to-place";
import { WaitBar, phoneUpdate, updateCell } from "@/components/ward-management/delays/delays-board-rows";
import { RowTimeline } from "@/components/ward-redesign/waiting/waiting-row-timeline";
import { legalCellAsTyped, phonePrefixAsTyped } from "./waiting-legal-cells";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import waitingKeys from "@/components/ward-redesign/waiting/waiting-redesign.module.css";
import polish from "@/components/ward-redesign/waiting/waiting-polish.module.css";
import { WaitingHeroBar, WaitingKeyRow, moveWord } from "@/components/ward-redesign/waiting/waiting-hero-bar";
import phoneRows from "@/components/ward-redesign/parts/phone-rows.module.css";
import { SearchField } from "@/components/ward-redesign/parts/search-field";

/** Groups shown open on first load: the severe ones and "Waiting on you". The rest start folded. */
const OPEN_BY_DEFAULT: readonly DelayCause[] = [
  "legal_breached",
  "legal_expiring",
  "no_eligible_bed",
  "awaiting_coordinator",
];
const GROUP_LIMIT = 5;

/*
 * Audit A3-14: the board opens on Longest wait (forms due first, then longest wait) and remembers
 * the viewer's own choice in this browser. Same safe localStorage pattern as the wallboard store:
 * a blocked or private store never throws, and the server snapshot is the default.
 */
const DELAYS_ORDER_STORAGE_KEY = "ward_flow_delays_order";
const DELAYS_ORDER_CHANGE_EVENT = "ward_flow_delays_order_change";
let delaysOrderFallback: boolean | undefined;

function readDelaysFlat(): boolean {
  try {
    return window.localStorage.getItem(DELAYS_ORDER_STORAGE_KEY) !== "blocker";
  } catch {
    return delaysOrderFallback ?? true;
  }
}

function writeDelaysFlat(flat: boolean): void {
  try {
    window.localStorage.setItem(DELAYS_ORDER_STORAGE_KEY, flat ? "longest" : "blocker");
  } catch {
    // Private browsing or a blocked store: the choice lasts for this page only.
    delaysOrderFallback = flat;
  }
  try {
    window.dispatchEvent(new Event(DELAYS_ORDER_CHANGE_EVENT));
  } catch {
    // Nothing else depends on the notification.
  }
}

function subscribeDelaysOrder(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DELAYS_ORDER_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DELAYS_ORDER_CHANGE_EVENT, onChange);
  };
}

const useDelaysFlatStore = createBrowserStore(subscribeDelaysOrder, readDelaysFlat, true);

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
  /** Round 4: the daily check's tile in the header (laptop, coordinator). */
  heroCheck?: ReactNode;
  /** Shown in place of the board's body when nobody is waiting. */
  empty?: ReactNode;
};

/**
 * Audit A3-16: a collected patient is on the road, not in the ED. Their row says so; the waiting
 * count is unchanged until the rule for collected patients is agreed.
 */
function transitNote(movement: Movement, now: Instant): string | undefined {
  const collectedAt = movement.transport?.collectedAt;
  if (collectedAt === undefined || movement.transport?.cancelledAt !== undefined || movement.stage === "arrived")
    return undefined;
  return `In transit since ${formatInstantWithDay(collectedAt, now)}`;
}

/** Below 64rem the person's panel is a sheet over the table (see delays-board.module.css). */
const SHEET_QUERY = "(max-width: 64rem)";

function isSheetLayout(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(SHEET_QUERY).matches;
}

function subscribeSheetLayout(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(SHEET_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

/** True at or below 64rem, where the person's panel is a sheet over the table. */
function useSheetLayout(): boolean {
  return useSyncExternalStore(subscribeSheetLayout, isSheetLayout, () => false);
}

const byWait = (a: BoardRow, b: BoardRow) => b.waited - a.waited;

/** DA-26 (design audit): which edges of a sideways-scrolling area still hide content. */
function useSideScroll(): [(node: HTMLDivElement | null) => void, { before: boolean; after: boolean }] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ before: false, after: false });
  useEffect(() => {
    if (node === null || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const before = node.scrollLeft > 1;
      const after = node.scrollLeft < node.scrollWidth - node.clientWidth - 1;
      setEdges((current) => (current.before === before && current.after === after ? current : { before, after }));
    };
    // The observer reports once on observe, so the first measure needs no direct call.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    node.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [node]);
  return [setNode, edges];
}
const WAITING_ROUTE = "/ward-flow/waiting";
/** What Back brings back with the address's filters (`use-return-to-place.ts`): the opened groups. */
type WaitingPlace = {
  openGroups: Partial<Record<DelayCause, boolean>>;
  moreGroups: Partial<Record<DelayCause, boolean>>;
};
const selectButton = (id: string) => rowWithAttribute("data-testid", `delays-select-${id}`, "button");

/**
 * Waiting's board, redesigned (October 2026 design review). A copy of `delays/delays-board.tsx`
 * with the review's changes: the header's figures no longer overlap (the in-transit note leaves the
 * figures, the Checking line becomes one figure), Longest wait groups people by how long they have
 * waited (over 24 hours all shown, over 8 hours the first four, under 8 hours folded), and each
 * row names its ED by code ("ARM ED") with the full name on hover.
 */
export function DelaysBoardRedesign({
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
  heroCheck,
  empty,
}: DelaysBoardProps) {
  const thresholds = useDueSoonThresholds();
  const patientOf = usePatientOf();
  // The shared act-now list, as the Handover sheet reads it, so For handover matches its Act now.
  const {
    referrals: allReferrals,
    movements: allMovements,
    configuration,
    inboxSnoozes,
  } = useWardFlowSelect("referrals", "movements", "configuration", "inboxSnoozes");
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
  const panelRef = useRef<HTMLElement>(null);
  const sheet = useSheetLayout();
  // v10 phone: the registers, the longest quiet list and the graphs sit one tap away as cards.
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();
  /* iPad portrait (820px, device audit 11 Oct 2026): list rows and the registers as a slide-over. */
  const portrait = isTabletPortrait && !isPhone;
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
  const filtered = hasFilters(filters);

  const set = (patch: Partial<BoardFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };
  const toggle = <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: current[key] === value ? NO_FILTERS[key] : value }));
  };
  const isOpenGroup = (cause: DelayCause) => openGroups[cause] ?? OPEN_BY_DEFAULT.includes(cause);

  // On a phone or tablet the person's panel is a sheet, so an explicit row choice brings it into view.
  const explicitSelect = useRef(false);
  const select = (id: string) => {
    rememberReturnRow(WAITING_ROUTE, id);
    explicitSelect.current = selectedId !== id;
    setSelectedId((current) => (current === id ? null : id));
  };
  useEffect(() => {
    if (!explicitSelect.current || selectedId === null) return;
    explicitSelect.current = false;
    if (!sheet) return;
    // Focus is the shared modal lifecycle's job (useWardModalFocus below); this only scrolls.
    window.requestAnimationFrame(() => {
      document.getElementById("delays-person-panel")?.scrollIntoView({ block: "start" });
    });
  }, [selectedId, sheet]);
  const close = useCallback(() => {
    const previous = selectedId;
    setSelectedId(null);
    if (previous !== null)
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>(`[data-testid="delays-select-${previous}"]`)?.focus(),
      );
  }, [selectedId]);
  /** From a graph or the rail: open the person's group, show them, and bring the row into view. */
  const reveal = (id: string) => {
    const row = rows.find((candidate) => candidate.movement.id === id);
    if (row === undefined) return;
    // Opening someone the filters hide shows everyone first, so their row is there to open.
    if (!shown.some((candidate) => candidate.movement.id === id)) setFilters(NO_FILTERS);
    // On a phone or tablet the panel is a sheet over the table, so focus goes to the sheet instead.
    explicitSelect.current = true;
    rememberReturnRow(WAITING_ROUTE, id);
    setSelectedId(id);
    setOpenGroups((current) => ({ ...current, [row.cause]: true }));
    setMoreGroups((current) => ({ ...current, [row.cause]: true }));
    if (sheet) return;
    window.requestAnimationFrame(() => {
      const button = document.querySelector<HTMLButtonElement>(`[data-testid="delays-select-${id}"]`);
      button?.scrollIntoView({ block: "center", behavior: wardScrollBehavior() });
      button?.focus({ preventScroll: true });
    });
  };

  // As a sheet the panel joins the shared modal stack: focus stays inside it and only the topmost
  // sheet answers Escape. Beside the table (wider screens) it is an ordinary panel.
  useWardModalFocus(sheet && selected !== null, panelRef, close);

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
  const dueSoon = rows.filter((row) => isDueSoon(row, thresholds)).length;
  const breached = rows.filter(isBreached).length;
  const formsPast = breached === 1 ? "form past its time" : "forms past their time";
  // Overall review, 20 Oct 2026: the title leads with the one "waiting" figure (`waitingInEds`, the
  // menu badge's figure too), then names whoever else is on this list ("8 in transit"), so the words
  // add up to the list's own count.
  const split = useMemo(() => waitingSplit(rows.map((row) => row.movement)), [rows]);
  const heroTitle = [`${split.waiting} waiting in ED`, ...notWaitingParts(split)].join(", ");
  const silentCount = rows.filter((row) => row.silent).length;
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
      {queuedReferrals === 0
        ? "No referrals awaiting a decision."
        : `${queuedReferrals} ${queuedReferrals === 1 ? "referral" : "referrals"} awaiting a decision, not yet on this list.`}{" "}
      <Link href="/ward-flow/referrals" className={styles.lnk}>
        Open Referrals
      </Link>
    </p>
  );

  const heroStat = (
    value: number,
    label: string,
    tone: WfTone | undefined,
    pressed: boolean,
    onPress: (() => void) | undefined,
    testId: string,
  ) => {
    const body = (
      <>
        <span className={styles.statV}>{value}</span>
        <span className={styles.statL}>
          <Glyph tone={value > 0 ? tone : undefined} />
          {label}
        </span>
      </>
    );
    // A count with nobody behind it has nothing to filter, so it is plain text, not a dead button.
    if (onPress === undefined)
      return (
        <div className={`${styles.stat} ${styles.statStatic}`} data-testid={testId}>
          {body}
        </div>
      );
    return (
      <button type="button" className={styles.stat} aria-pressed={pressed} onClick={onPress} data-testid={testId}>
        {body}
      </button>
    );
  };

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.owner !== null)
    chips.push({
      key: "owner",
      label: ownerName(filters.owner),
      clear: () => {
        set({ owner: null });
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
      label: causeTitle(filters.cause),
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
            <b className={`${styles.ellBlock} ${waitingKeys.phWrapLine}`}>{patient.formalName}</b>
            <span className={`${styles.ellBlock} ${waitingKeys.phWrapLine}`} data-ward-type-floor="delays-profile">
              {isPhone ? phonePrefixAsTyped(row, now, thresholds) : null}
              {/* Josh, 30 Oct 2026: on a phone the ED leads, so a form shown first never cuts it off. */}
              {(isPhone
                ? [originCode(movement), transitNote(movement, now), patient.umrn]
                : [patient.umrn, transitNote(movement, now), originCode(movement)]
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
              {splitDuration(row.waited)}
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
              <span className={styles.ell}>{causeTitle(row.cause)}</span>
            ) : (
              <>
                <Glyph tone={ward.tone} />
                <span className={styles.ell}>{ward.text}</span>
              </>
            )}
          </span>
        </td>
        <td role="cell" className={styles.cLegal}>
          {legalCellAsTyped(row, now, thresholds)}
        </td>
        <td role="cell" className={styles.cUpd} data-ward-type-floor="delays-since">
          {isPhone ? phoneUpdate(row) : updateCell(row, now)}
        </td>
      </tr>,
      isSelected ? (
        <tr role="row" key={`${movement.id}-timeline`} className={styles.xrow}>
          <td role="cell" colSpan={6}>
            <RowTimeline row={row} units={units} now={now} />
          </td>
        </tr>
      ) : null,
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
          data-tone={list[0].severe ? "danger" : owner === "yours" ? "accent" : undefined}
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
              <span className={polish.ownerTag} data-owner={owner}>
                {moveWord(owner)}
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
      const open = bandOpen[band.id] ?? band.limit > 0;
      const limit = bandMore[band.id] ? list.length : band.limit;
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
              aria-label={`${band.title}, ${list.length} ${list.length === 1 ? "person" : "people"}${includes ? `, ${includes}` : ", all in an ED"}, ${open ? band.note : "folded"}`}
              onClick={() => setBandOpen((current) => ({ ...current, [band.id]: !open }))}
              data-testid={`delays-band-${band.id}`}
            >
              <ChevronDown size={14} aria-hidden="true" className={open ? undefined : styles.folded} />
              <Glyph tone={band.tone} />
              <span className={styles.gTitle}>{band.title}</span>
              <span className={styles.k}>{list.length}</span>
              {includes && !isPhone ? <span className={styles.mut}>{includes}</span> : null}
              <span className={styles.sp} />
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
        sub: [patient.umrn, transitNote(row.movement, now), originCode(row.movement)].filter(Boolean).join(" · "),
        figure: splitDuration(row.waited),
        figureNote: phoneUpdate(row),
        tone: waitTone(row.waited),
        next: flat ? causeTitle(row.cause) : ward.text,
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
            rows: list.map(portraitRow),
          };
        }).filter((group) => group.rows.length > 0)
      : groups.map((group) => {
          const list = shown.filter((row) => row.cause === group.cause).sort(byWait);
          return {
            id: group.cause,
            title: group.title,
            tone: list[0]?.severe ? ("danger" as const) : undefined,
            note: list[0] ? `${ownerName(list[0].owner)} to clear` : undefined,
            rows: list.map(portraitRow),
          };
        });
  }, [portrait, flat, shown, groups, units, now, selectedId, patientOf]);
  const portraitRail = portrait ? (
    <PortraitRail
      title="Registers"
      summary={`Escalated ${escalated.length} · Attention ${attention.length}`}
      description="Escalations, attention, resolved today and the longest quiet"
      open={railOpen}
      onOpenChange={setRailOpen}
    >
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
          setRailOpen(false);
        }}
        onPick={(id) => {
          setRailOpen(false);
          reveal(id);
        }}
      />
    </PortraitRail>
  ) : null;
  const tiles = ownerTiles(rows);
  // C1: the filters that are on, for the phone Filter button. The 12h step and No update 2h+ are
  // already in `chips`; the hero's 8h and 24h figures count once here. The search box is separate.
  const filterCount =
    chips.length +
    (filters.threshold === 1 || filters.threshold === 3 ? 1 : 0) +
    (filters.locked ? 1 : 0) +
    (filters.view !== null ? 1 : 0);
  /** The quick filter chips: inline above the list, or in the phone Filter sheet (C1). */
  /* B4 saved views: each narrows the list and keeps its order. One view at a time. */
  const viewChips = (
    <>
      {WAITING_VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          className={styles.chip}
          aria-pressed={filters.view === view}
          title={tightHours(waitingViewHint(view, thresholds))}
          onClick={() => {
            set({ view: filters.view === view ? null : view });
          }}
          data-testid={`delays-view-${view}`}
        >
          {/* Josh, 30 Oct 2026: no "(as written)" on form labels. */}
          {tightHours(waitingViewLabel(view, thresholds).replace(" (as written)", ""))}{" "}
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
      placeholder="Name, UMRN or ED"
      label="Find a person or ED"
    />
  );
  // Round 4 header tiles (`waiting-hero-bar.tsx`): the daily check, the longest wait and who passes 8h next.
  const heroBar = <WaitingHeroBar rows={rows} now={now} check={heroCheck} onOpen={reveal} />;
  const filterRow = (inSheet: boolean) => (
    <div className={`${styles.chead} ${styles.fRow}${inSheet ? ` ${styles.fRowSheet}` : ` ${polish.filterRow}`}`}>
      {/* Design review (22 Oct 2026, Josh approved): in the phone Filter sheet the views sit under
          a Views label in a two by two grid lined up with the sheet title, not a ragged wrap. */}
      {inSheet ? (
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
    </div>
  );

  return (
    <>
      <Hero
        level={1}
        eyebrow={isPhone ? `Waiting · ${service ?? "Statewide"}` : "Waiting"}
        title={heroTitle}
        titleMeta={
          isPhone ? (
            <>
              Prototype data, invented records · <b>{breached}</b> {formsPast}
            </>
          ) : (
            <>
              <b>{breached}</b> {formsPast}
            </>
          )
        }
        testId="delays-hero"
        className={styles.delaysHero}
        // C1 (phone simplification, 19 Oct 2026): the card shrinks to this one line as the list scrolls.
        condensed={`${heroTitle} · ${breached} ${formsPast}`}
        stats={
          <div className={styles.stats} role="group" aria-label="Filter by the headline counts">
            {heroStat(
              over8,
              `Over ${H8}`,
              "warning",
              filters.threshold === 1,
              over8 > 0 || filters.threshold === 1
                ? () => {
                    toggle("threshold", 1);
                  }
                : undefined,
              "delays-stat-over8",
            )}
            {heroStat(
              over24,
              `Over ${H24}`,
              "danger",
              filters.threshold === 3,
              over24 > 0 || filters.threshold === 3
                ? () => {
                    toggle("threshold", 3);
                  }
                : undefined,
              "delays-stat-over24",
            )}
            {heroStat(
              dueSoon,
              isPhone ? `Form due ${windowText(urgentMinutes)}` : dueSoonLabel,
              "danger",
              filters.dueSoon,
              dueSoon > 0 || filters.dueSoon
                ? () => {
                    toggle("dueSoon", true);
                    if (!filters.dueSoon) setFlat(true);
                  }
                : undefined,
              "delays-stat-due",
            )}
            {isPhone
              ? null
              : // Josh, 30 Oct 2026: a filter like its neighbours, as Longest quiet's "Show all quiet" is.
                heroStat(
                  silentCount,
                  `No update for ${SILENT_MINUTES / 60}h and over`,
                  "warning",
                  filters.silent,
                  silentCount > 0 || filters.silent ? () => toggle("silent", true) : undefined,
                  "delays-stat-silent",
                )}
          </div>
        }
        aside={<LiveChip state="live" onHero />}
        // Round 4 (Josh, 31 Oct 2026): a fuller header. Under the counts, one row of high-yield
        // tiles: the daily check, the longest wait and who passes 8h next. Laptop only.
        bar={isPhone ? undefined : heroBar}
        foot={
          // This page watches conditions, so it says what it checked. Counts only, never "All clear".
          // Redesign: on desktop the count is a header figure; the phone keeps the line.
          isPhone ? (
            <CheckingFoot
              items={[
                {
                  id: "silent",
                  label: `No update for ${SILENT_MINUTES / 60}h and over`,
                  value: silentCount,
                  tone: silentCount > 0 ? "warning" : "neutral",
                },
              ]}
              notChecked={["system delays, no feed"]}
            />
          ) : undefined
        }
      />
      {banner}
      {empty !== undefined ? (
        <div className={styles.split}>
          <section className={`${styles.card} ${styles.emptyCard}`} aria-label="Waiting">
            {empty}
            {referralsLine}
          </section>
          {registers}
        </div>
      ) : (
        <>
          <section
            // Phone (Josh, 31 Oct 2026): one sliding row with Home's fade, in place of two by two.
            className={`${styles.card} ${styles.owners} ${phoneRows.chipRow}`}
            aria-label="Whose move"
            data-ward-primitive="panel"
          >
            {tiles.map((tile) => (
              <button
                key={tile.owner}
                type="button"
                className={`${styles.own} ${phoneRows.chip} ${tile.rows.length === 0 ? phoneRows.zero : ""}`}
                aria-pressed={filters.owner === tile.owner}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    owner: current.owner === tile.owner ? null : tile.owner,
                    cause: null,
                  }))
                }
                data-testid={`delays-owner-${tile.owner}`}
              >
                <span className={`${styles.ownTop} ${waitingKeys.countFirst}`}>
                  <b className={styles.num}>{tile.rows.length}</b>
                  <span className={styles.ownName}>{tile.name}</span>
                </span>
                <BandBar bands={tile.bands} />
                {/* Audit 11 Oct 2026, phone: one count per chip; the glyph alone flags the sub fact. */}
                {isPhone ? (
                  tile.sub.count > 0 ? (
                    <small>
                      <Glyph tone={tile.sub.tone} />
                      <span className="sr-only">{`${tile.sub.count} ${tile.sub.text}`}</span>
                    </small>
                  ) : null
                ) : (
                  <small>
                    <Glyph tone={tile.sub.count > 0 ? tile.sub.tone : undefined} />
                    <span>
                      <b className={styles.ownSubCount}>{tile.sub.count}</b>
                      <span className={styles.ownSubText}>{` ${tile.sub.text}`}</span>
                    </span>
                  </small>
                )}
              </button>
            ))}
          </section>

          <div
            className={styles.split}
            data-person-open={selected !== null || undefined}
            data-portrait={portrait ? "slide" : undefined}
          >
            <section
              ref={tableRef}
              id="delays-table"
              className={`${styles.card} ${styles.tableCard}`}
              aria-label="Waiting"
              data-ward-primitive="panel"
              tabIndex={-1}
            >
              <div className={`${styles.chead} ${wardPin.pinnedSwitch} ${polish.tableHead}`}>
                <h2>{flat ? "Waiting" : "Waiting by blocker"}</h2>
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
                <div className={styles.seg} role="group" aria-label="Order the table">
                  <button
                    type="button"
                    aria-pressed={!flat}
                    onClick={() => {
                      setFlat(false);
                    }}
                  >
                    By blocker
                  </button>
                  <button
                    type="button"
                    aria-pressed={flat}
                    onClick={() => {
                      setFlat(true);
                    }}
                  >
                    Longest wait
                  </button>
                </div>
                {isPhone ? (
                  <PhoneFilterFold
                    count={filterCount}
                    title="Filter the list"
                    description="Filters narrow the list. The list says how many they hide."
                    className={styles.phoneFold}
                    data-testid="delays-filter-fold"
                  >
                    {filterRow(true)}
                  </PhoneFilterFold>
                ) : null}
              </div>
              {/* C1 (phone simplification, 19 Oct 2026): on a phone this row folds into the Filter
                  button in the pinned row above. */}
              {isPhone ? null : filterRow(false)}
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
                <table className={styles.tbl} data-testid="delays-waiting-list" role="table">
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
                        {flat ? "Blocker" : "Wards"}
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

            {selected !== null ? (
              <>
                <div
                  className={styles.backdrop}
                  onClick={close}
                  aria-hidden="true"
                  data-testid="delays-detail-backdrop"
                />
                <PersonPanel
                  row={selected}
                  units={units}
                  now={now}
                  onClose={close}
                  onEscalate={onEscalate}
                  panelRef={panelRef}
                />
              </>
            ) : isPhone || portrait ? null : (
              registers
            )}
          </div>

          {isPhone ? (
            <div className={styles.phCards} data-testid="delays-phone-cards">
              <button type="button" className={styles.phCard} onClick={() => setPhoneSheet("registers")}>
                <Flag size={16} aria-hidden="true" className={styles.phCardIcon} />
                <span className={styles.phCardText}>
                  <span className={styles.phCardTitle}>Registers</span>
                  <span className={styles.phCardMeta}>
                    Escalated <b>{escalated.length}</b> · Attention <b>{attention.length}</b> · Resolved{" "}
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
                  <span className={styles.phCardMeta}>None recorded statewide</span>
                </span>
              </div>
              <PhoneSheet
                open={phoneSheet === "registers" || phoneSheet === "quiet"}
                onClose={() => setPhoneSheet(null)}
                title={phoneSheet === "quiet" ? "Longest quiet" : "Registers"}
                description={
                  phoneSheet === "quiet"
                    ? "Who has gone longest with nothing recorded"
                    : "Escalations, attention and resolved today"
                }
                height="tall"
              >
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
                description="Dots and columns follow the same filters as the list"
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

          {isPhone ? null : (
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

/**
 * v10 phone group trend mark: a small bar glyph and "+N", the people in this group whose wait
 * opened recently (the board's own quiet threshold). A count of recorded arrivals, never a forecast.
 */
function GroupTrend({ rows }: { rows: readonly BoardRow[] }) {
  const joined = rows.filter((row) => row.waited < SILENT_MINUTES).length;
  return (
    <span className={styles.phTrend} title={`${joined} joined recently`}>
      <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
        <rect x="0" y="6" width="3" height="6" fill="currentColor" opacity="0.45" />
        <rect x="5" y="1" width="3" height="11" fill="currentColor" />
      </svg>
      <span aria-hidden="true">+{joined}</span>
      <span className="sr-only">{joined} joined recently</span>
    </span>
  );
}
