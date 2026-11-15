"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  ArrowUpRight,
  ChartColumn,
  BedSingle,
  BellRing,
  CalendarCheck,
  ClipboardCheck,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileClock,
  FileText,
  FlaskConical,
  Gauge,
  Inbox,
  Map as MapIcon,
  MapPinned,
  MessageSquareText,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  Plus,
  Printer,
  Scale,
  SearchCheck,
  Ambulance,
  Megaphone,
  Send,
  Zap,
  ListChecks,
  Tv,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import { QuickActionsPanel, useUnconfirmedWards, WardUpdatesRequest, type QuickTile } from "./ward-tools-quick-actions";

import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { legalFormPopulation } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { clockStanding, isActNow } from "@/components/ward-management/legal-forms/legal-forms-view";
import { WardRoleSwitcher } from "@/components/ward-management/ward-public-role-switcher";
import { contactForTeam } from "@/components/ward-management/community/community-team-contact-mapping";
import { DOWNTIME_PACK_HREF, PATIENT_CHRONOLOGY_HREF } from "@/components/ward-management/reports/report-routes";
import { handoverHref } from "@/components/ward-management/shell/ward-facade";
import { useAccessNavFilter, useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { homeHrefFor, seesNetworkBedFigures, type WardAccessRole } from "@/components/ward-management/ward-role-access";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import {
  WardDemoConfirmHold,
  WardDemoPanel,
  useDemoConfirmHold,
} from "@/components/ward-management/tools/ward-demo-panel";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { useExecutiveStatisticsControl } from "@/components/ward-management/statistics/executive-statistics-context";
// D-91: the one suburb lookup card, shared with Community and the ward's Discharges tab.
import { SuburbLookupCard } from "@/components/ward-management/community/community-suburb-lookup-card";
import { buttonClass, Count, SearchField, SrOnly } from "@/components/wf";
import { openWardHelp } from "@/components/ward-management/help/ward-help-events";

import { ToolFeed, ReceiveNextFeedMessage, useFeedWaitingCount } from "./ward-tool-feed";
import { ToolFigures } from "./ward-tool-figures";
import { ToolFindBed } from "./ward-tool-find-bed";
import { ToolFormTimes } from "./ward-tool-form-times";
import { ToolLeaveDue, useLeaveDueCount } from "./ward-tool-leave-due";
import { ToolMessages } from "./ward-tool-messages";
import { ToolOnCall } from "./ward-tool-on-call";
import { ToolRemindMe, useReminderCount } from "./ward-tool-remind-me";
import { ToolCallLog } from "./ward-tool-call-log";
import styles from "./ward-tools-sheet-v3.module.css";

// Log a delay loads when it is first opened, so the shell's first download does not grow.
const ToolLogDelay = dynamic(
  withLoadRetry(() => import("./ward-tool-log-delay").then((m) => m.ToolLogDelay)),
  {
    loading: () => <p role="status">Loading…</p>,
  },
);

const root = "/ward-flow";

export type ToolsSheetToolId =
  | "update-bed"
  | "remind"
  | "call-log"
  | "book-transport"
  | "feed"
  | "bed-finder"
  | "figures"
  | "leave-due"
  | "catchment"
  | "contacts"
  | "form-times"
  | "messages"
  | "quick-actions"
  | "log-delay"
  | "demo";

type EntryKey =
  | ToolsSheetToolId
  | "new-referral"
  | "legal-forms"
  | "out-of-area"
  | "handover"
  | "downtime"
  | "chronology"
  | "find-patient"
  | "bed-meeting"
  | "tv-board";

type GroupId = "do" | "look" | "share";

/** Kit rule: a long group shows its first rows, then Show more. */
const GROUP_SHOWN = 5;

export type WardToolsSheetProps = {
  isPhone: boolean;
  /** Two panes (Q311): the list on the left, the open tool on the right. Wide desktops only. */
  twoPane?: boolean;
  /** Who the screen is showing, in words ("Bed coordinator"). */
  roleLabel: string;
  /** Close the sheet; every link calls it as it navigates. */
  onNavigate: () => void;
  /** Opens the referral slide-out; the suburb result asks for the community destination. */
  onNewReferral: (destination?: "ward" | "community") => void;
  /** A tool to open on arrival, and a counter so the same request can be made again. */
  openRequest?: { tool: ToolsSheetToolId; seq: number };
  onRequestHandled?: () => void;
};

/**
 * Each desk's own order (Josh, 2 Nov 2026: "improve all the different modes"), so the tool a desk
 * reaches for most leads its group. A desk's gates below still drop what it may not use: this list
 * only orders, it never grants.
 */
const ROLE_ORDER: Record<WardAccessRole, Record<GroupId, readonly EntryKey[]>> = {
  coordinator: {
    do: ["call-log", "quick-actions", "new-referral", "update-bed", "remind", "book-transport", "log-delay", "feed"],
    look: [
      "bed-finder",
      "find-patient",
      "figures",
      "leave-due",
      "catchment",
      "contacts",
      "form-times",
      "legal-forms",
      "out-of-area",
    ],
    share: ["messages", "bed-meeting", "tv-board", "handover", "downtime", "chronology"],
  },
  bed_manager: {
    do: ["quick-actions", "update-bed", "remind", "log-delay", "book-transport", "feed"],
    look: ["bed-finder", "find-patient", "leave-due", "figures", "contacts", "form-times", "catchment", "legal-forms"],
    share: ["messages", "bed-meeting", "tv-board", "handover", "downtime"],
  },
  ward: {
    do: ["quick-actions", "update-bed", "remind", "log-delay", "book-transport", "feed"],
    look: ["leave-due", "find-patient", "form-times", "contacts", "bed-finder", "catchment", "legal-forms"],
    share: ["handover", "messages", "tv-board", "downtime"],
  },
  ed: {
    do: ["quick-actions", "new-referral", "book-transport", "remind", "log-delay"],
    look: ["bed-finder", "find-patient", "form-times", "contacts", "catchment", "legal-forms"],
    share: ["handover", "tv-board", "downtime"],
  },
  community: {
    do: ["quick-actions", "new-referral", "remind", "log-delay"],
    look: ["catchment", "contacts", "form-times", "legal-forms", "bed-finder"],
    share: ["downtime"],
  },
  officer: { do: ["quick-actions", "remind"], look: ["contacts", "catchment"], share: [] },
  // The executive desk reads released reports only, so it has no tool that writes to or reads the live World.
  executive: {
    do: ["quick-actions"],
    look: ["figures", "bed-finder", "contacts", "catchment", "form-times"],
    share: ["messages", "bed-meeting", "downtime"],
  },
  admin: { do: [], look: ["contacts", "catchment"], share: [] },
};

/** A desk's Quick actions tile: a Tools row by key (keeps its gate), or a page link of its own. */
type QuickSpec = EntryKey | (QuickTile & { href: string });

/** Each desk's most used controls, most used first (Josh, 4 Nov 2026). The coordinator's are built inline. */
const ROLE_QUICK: Partial<Record<WardAccessRole, readonly QuickSpec[]>> = {
  bed_manager: [
    "bed-finder",
    "update-bed",
    "leave-due",
    "log-delay",
    "book-transport",
    { key: "broadcast", icon: Megaphone, name: "Broadcast", detail: "To your wards", href: `${root}/alerts` },
  ],
  ward: [
    { key: "my-ward", icon: ClipboardCheck, name: "Confirm beds", detail: "Morning numbers", href: `${root}/wards` },
    "leave-due",
    "update-bed",
    "log-delay",
    "book-transport",
    "remind",
  ],
  ed: [
    { key: "refer", icon: Plus, name: "New referral", detail: "Start one", href: WARD_REFERRAL_INTAKE_HREF },
    "bed-finder",
    "book-transport",
    "log-delay",
    "form-times",
    "contacts",
  ],
  community: [
    { key: "inbox", icon: Inbox, name: "Referrals in", detail: "Accept or assign", href: `${root}/community` },
    { key: "refer", icon: Plus, name: "New referral", detail: "Start one", href: WARD_REFERRAL_INTAKE_HREF },
    "catchment",
    "contacts",
    "log-delay",
    "remind",
  ],
  officer: [
    { key: "jobs", icon: Ambulance, name: "My jobs", detail: "Steps and check-in", href: `${root}/transport/officer` },
    { key: "alerts", icon: BellRing, name: "Alerts", detail: "Notices", href: `${root}/alerts` },
    "contacts",
    "remind",
  ],
  executive: [
    "figures",
    { key: "capacity", icon: Gauge, name: "Capacity", detail: "By service", href: `${root}/capacity` },
    { key: "statistics", icon: ChartColumn, name: "Statistics", detail: "Reports", href: `${root}/statistics` },
    "messages",
    "contacts",
  ],
};

/** Tiles that open the desk's own home page, wherever that desk sits. */
const DESK_HOME_TILES = new Set(["my-ward", "inbox", "jobs"]);

/** Tiles are narrow on a phone, so each borrowed row gets a two or three word line (Josh, 4 Nov 2026). */
const TILE_DETAIL: Partial<Record<EntryKey, string>> = {
  "leave-due": "Back today",
  "update-bed": "Open or close",
  "log-delay": "Why it waits",
  "book-transport": "Log a transfer",
  remind: "Set a nudge",
  "bed-finder": "Ready beds",
  "form-times": "Form expiry",
  contacts: "Who is on",
  catchment: "Team by suburb",
  figures: "Beds and flow",
  messages: "Copy text",
};

const QUICK_DETAIL: Partial<Record<WardAccessRole, string>> = {
  bed_manager: "Beds, due back and more",
  ward: "Confirm beds, due back and more",
  ed: "Refer, find a bed and more",
  community: "Referrals in, suburbs and more",
  officer: "My jobs, alerts and on-call",
  executive: "Figures, capacity and reports",
};

/** Q309: until a desk has used a tool, the row offers its three most likely ones. */
const ROLE_SUGGESTED: Record<WardAccessRole, readonly ToolsSheetToolId[]> = {
  coordinator: ["quick-actions", "bed-finder", "update-bed"],
  bed_manager: ["quick-actions", "update-bed", "bed-finder"],
  ward: ["quick-actions", "update-bed", "leave-due"],
  ed: ["quick-actions", "bed-finder", "form-times"],
  community: ["quick-actions", "catchment", "contacts"],
  officer: ["quick-actions", "contacts", "catchment"],
  executive: ["quick-actions", "figures", "messages"],
  admin: ["contacts", "catchment"],
};

/** The groups, in order. Each tints its row icons (Q315). */
const GROUPS: readonly { id: GroupId; title: string }[] = [
  { id: "do", title: "Do now" },
  { id: "look", title: "Look up" },
  { id: "share", title: "Print and share" },
];

// Q309: the last four tools opened, in this browser only (a convenience, never a record).
const RECENT_KEY = "ward-flow:tools-recent";
const recentListeners = new Set<() => void>();
const NO_RECENT: readonly ToolsSheetToolId[] = [];
let recentCache: readonly ToolsSheetToolId[] | null = null;
function readRecent(): readonly ToolsSheetToolId[] {
  if (recentCache) return recentCache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    recentCache = Array.isArray(parsed)
      ? (parsed.filter((item) => typeof item === "string") as ToolsSheetToolId[])
      : NO_RECENT;
  } catch {
    recentCache = NO_RECENT;
  }
  return recentCache;
}
function pushRecent(id: ToolsSheetToolId) {
  if (id === "demo") return;
  recentCache = [id, ...readRecent().filter((item) => item !== id)].slice(0, 4);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentCache));
  } catch {
    // Blocked storage: the row still works for this visit.
  }
  recentListeners.forEach((listener) => listener());
}
function useRecent(): readonly ToolsSheetToolId[] {
  return useSyncExternalStore(
    (listener) => {
      recentListeners.add(listener);
      return () => recentListeners.delete(listener);
    },
    readRecent,
    () => NO_RECENT,
  );
}

type Entry = {
  key: EntryKey;
  icon: LucideIcon;
  name: string;
  /** Q313: two to four words. */
  detail: string;
  /** Q312: a live count, in the kit's count badge. */
  count?: { n: number; label: string; act?: boolean };
  /** A link row opens a page; a tool row opens here. */
  href?: string;
  onClick?: () => void;
  body?: ReactNode;
};

/** WF-29 (live test, 4 Nov 2026): every Tools row carries its own accessible name. */

type Suggestion = {
  key: string;
  title: string;
  detail: string;
  n: number;
  tone: "danger" | "warning" | "info";
  tool?: ToolsSheetToolId;
  href?: string;
};

function rowName(entry: Entry, end: string): string {
  const count = entry.count && entry.count.n > 0 ? `, ${entry.count.n} ${entry.count.label}` : "";
  return `${entry.name}, ${entry.detail}${count}${end}`;
}

function RowText({ entry, group }: { entry: Entry; group: GroupId }) {
  const Icon = entry.icon;
  return (
    <>
      <span className={styles.rowIcon} data-group={group} aria-hidden="true">
        <Icon aria-hidden="true" strokeWidth={1.75} />
      </span>
      {/* axe 4.14 joins a row's visible words with no gap, so a space keeps "Find a bed" and its detail
          two words; the row and its text are flex and grid, where a space takes no room. */}
      <span className={styles.rowText}>
        <strong>{entry.name}</strong> <em>{entry.detail}</em>
      </span>{" "}
      {entry.count && entry.count.n > 0 ? (
        <Count
          n={entry.count.n}
          label={entry.count.label}
          className={entry.count.act ? styles.countAct : styles.count}
        />
      ) : null}
    </>
  );
}

/** P023: the wards a network desk may open, each to its own page. */
function UpdateBedWards({ onNavigate }: { onNavigate: () => void }) {
  const { units } = useWardFlowSelect("units");
  const canOpen = useCanOpenHref();
  const [query, setQuery] = useState("");
  const words = query.trim();
  // Search audit, 8 Nov 2026: every word, folded, across the ward, its hospital and its site code.
  const wards = units
    .filter((unit) => canOpen(`${root}/ward/${unit.id}`))
    .filter(
      (unit) => !words || fieldsMatchEveryWord(words, [unit.name, siteByCode(unit.siteCode)?.name, unit.siteCode]),
    );
  return (
    <div className={styles.toolBody}>
      <SearchField label="Find a ward" placeholder="Find a ward" value={query} onValueChange={setQuery} />
      <ul className={styles.wardList} aria-label="Choose a ward">
        {wards.slice(0, 8).map((unit) => (
          <li key={unit.id}>
            <Link href={`${root}/ward/${unit.id}`} className={styles.wardRow} onClick={onNavigate}>
              <span>{unit.name}</span>
              <ChevronRight aria-hidden="true" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ul>
      {wards.length > 8 ? <p className={styles.quiet}>Type to find the other {wards.length - 8} wards.</p> : null}
      {words && wards.length === 0 ? <p className={styles.quiet}>No ward matches that search.</p> : null}
    </div>
  );
}

/** Q316: hands the typed words to the header's Search Ward Flow box. The words stay in the app. */
/**
 * Q316: hand the words to the header search. The Patients page has no header search (it is the
 * search), so its own field takes them. With neither, the sheet stays open and says so.
 */
function searchWardFlow(words: string, close: () => void): boolean {
  const input =
    document.querySelector<HTMLInputElement>('input[placeholder="Search Ward Flow"]') ??
    document.querySelector<HTMLInputElement>('input[data-testid="ward-patient-typeahead-input"]');
  if (!input) return false;
  close();
  window.requestAnimationFrame(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, words);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });
  return true;
}

/**
 * The Tools sheet, overhauled (Q308-Q326, approved by Josh 2 Nov 2026). Search and a Recent row lead;
 * then Do now, Look up and Print and share in each desk's own order, with live counts and short lines.
 * One tool opens at a time and scrolls into view; from 1280 wide the open tool sits in its own pane.
 * Viewing as and the Demo controls sit together at the foot.
 */
/** Live counts on the rows. The executive desk has none: it never reads the operational World. */
type SheetCounts = {
  bedsReady?: number;
  feed?: number;
  reminders?: number;
  leave?: number;
  unconfirmed?: number;
  /** Open legal forms whose typed end time has passed or is close (the Legal forms "act now"). */
  formsActNow?: number;
};

/** Open forms at "act now" on the Legal forms page: the same rule, read from the typed time only. */
function useFormsActNow(): number {
  const { movements } = useWardFlowSelect("movements");
  const now = useWardFlowClock();
  const thresholds = useDueSoonThresholds();
  return legalFormPopulation(movements).filter((movement) => isActNow(clockStanding(movement, now, thresholds))).length;
}

const DEMO_MOVED_KEY = "wf-demo-moved-seen";

/** R-STRUCT-48: a one-word, once-per-device label that says the Demo panel moved here. */
function DemoMovedLabel() {
  // The sheet only draws in the browser after it opens, so reading the flag here cannot mismatch.
  const [seen, setSeen] = useState(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem(DEMO_MOVED_KEY) === "1";
    } catch {
      return true;
    }
  });
  if (seen) return null;
  return (
    <button
      type="button"
      className={styles.groupCount}
      data-testid="ward-tools-demo-moved"
      aria-label="Moved here. Dismiss"
      onClick={() => {
        setSeen(true);
        try {
          window.localStorage.setItem(DEMO_MOVED_KEY, "1");
        } catch {
          // Storage blocked: the label returns next visit.
        }
      }}
    >
      Moved ×
    </button>
  );
}

export function WardToolsSheet(props: WardToolsSheetProps) {
  return useExecutiveStatisticsControl().executive ? (
    <ToolsSheetView {...props} executive counts={{}} />
  ) : (
    <OperationalToolsSheet {...props} />
  );
}

function OperationalToolsSheet(props: WardToolsSheetProps) {
  const { counts } = useWardNavCounts();
  const feed = useFeedWaitingCount();
  const reminders = useReminderCount();
  const leave = useLeaveDueCount();
  const unconfirmed = useUnconfirmedWards().waiting.length;
  const formsActNow = useFormsActNow();
  return (
    <ToolsSheetView
      {...props}
      executive={false}
      counts={{ bedsReady: counts.capacity?.value, feed, reminders, leave, unconfirmed, formsActNow }}
    />
  );
}

function ToolsSheetView({
  executive,
  counts,
  isPhone,
  twoPane = false,
  roleLabel,
  onNavigate,
  onNewReferral,
  openRequest,
  onRequestHandled,
}: WardToolsSheetProps & { executive: boolean; counts: SheetCounts }) {
  const accessNav = useAccessNavFilter();
  const updateBedHref = accessNav([{ id: "wards", href: `${root}/wards`, label: "Update a bed" }])[0]?.href;
  const canOpen = useCanOpenHref();
  const access = useEffectiveWardAccess();
  const role: WardAccessRole = access.role;
  const networkFigures = seesNetworkBedFigures(role);
  const gate = useRoleGate();
  const canLogDelay = gate("RECORD_MOVEMENT_BLOCKER").allowed;
  const canRefer = canOpen(WARD_REFERRAL_INTAKE_HREF);
  const recent = useRecent();
  const unconfirmed = counts.unconfirmed ?? 0;

  const [open, setOpen] = useState<ToolsSheetToolId | null>(null);
  // Review E-14 (F-142): the demo panel's pending confirm lives here, above the two-pane switch, so
  // a window crossing 1280 wide (which redraws the panel elsewhere) keeps it. Closing Tools drops it.
  const demoConfirm = useDemoConfirmHold();
  // A pending confirm always keeps its panel on screen below two panes, so it can never sit unseen
  // while Escape closes Tools. Adjusted during render, not in an effect.
  if (!twoPane && open === null && demoConfirm[0] !== null) setOpen("demo");
  const [query, setQuery] = useState("");
  const [noSearch, setNoSearch] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<GroupId>>(new Set());
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Phone and tablet (Josh, 6 Nov 2026): a tool opens as its own page inside the sheet, with a Back
  // control, like iOS Settings. Nothing expands in the list, so the list never jumps.
  const [listScroll, setListScroll] = useState(0);
  const sheetScroller = (): HTMLElement | null => {
    let node = document.querySelector<HTMLElement>('[data-testid="ward-tools-sheet-v3"]')?.parentElement ?? null;
    while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node = node.parentElement;
    return node;
  };

  const openTool = (id: ToolsSheetToolId) => {
    // Q310: one tool at a time; opening another closes the first.
    setOpen((current) => (current === id && !twoPane ? current : id));
    pushRecent(id);
    // A tool opened from a Recent chip may sit under Show more: keep its group open, so the row
    // (and keyboard focus on it) stays when the person comes back.
    const home = groups.find((group) => group.entries.findIndex((entry) => entry.key === id) >= GROUP_SHOWN);
    if (home) setExpanded((current) => new Set(current).add(home.id));
    if (twoPane) return;
    const scroller = sheetScroller();
    setListScroll(scroller?.scrollTop ?? 0);
    window.requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = 0;
      document.getElementById(`ward-tools-page-${id}`)?.focus({ preventScroll: true });
    });
  };

  const closeTool = () => {
    const id = open;
    setOpen(null);
    window.requestAnimationFrame(() => {
      const scroller = sheetScroller();
      if (scroller) scroller.scrollTop = listScroll;
      document.querySelector<HTMLElement>(`[data-testid="ward-tools-toggle-${id}"]`)?.focus({ preventScroll: true });
    });
  };

  // Escape on a tool page goes back to the list first; a second Escape closes the sheet. The listener
  // is on document in the bubble phase: after React's handlers, so a menu or field inside the tool that
  // handles Escape keeps it, and before the Sheet's own window listener. Only an Escape from inside the
  // page counts, so a dialog stacked above the sheet keeps its own.
  const pageOpen = !twoPane && open !== null;
  const onEscape = useEffectEvent(() => closeTool());
  useEffect(() => {
    if (!pageOpen) return;
    const page = document.getElementById(`ward-tools-page-${open}`);
    if (!page) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!(event.target instanceof Node) || !page.contains(event.target)) return;
      if (event.target instanceof HTMLElement && event.target.tagName === "SELECT") return;
      event.preventDefault();
      onEscape();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pageOpen, open]);

  useEffect(() => {
    if (!openRequest) return;
    queueMicrotask(() => {
      setQuery("");
      setOpen(openRequest.tool);
      onRequestHandled?.();
    });
  }, [openRequest, onRequestHandled]);

  // Q316: "/" jumps to the search box while Tools is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const all: Record<EntryKey, Entry | null> = {
    "quick-actions":
      role === "coordinator"
        ? {
            key: "quick-actions",
            icon: Zap,
            name: "Quick actions",
            detail: "Ward updates, beds and more",
            count: { n: unconfirmed, label: "wards not confirmed this shift", act: true },
            body: (
              <QuickActionsPanel
                onNavigate={onNavigate}
                tiles={[
                  {
                    key: "ward-updates",
                    icon: BellRing,
                    name: "Ward updates",
                    detail: "not confirmed",
                    count: unconfirmed,
                    title: "Ward updates",
                    body: <WardUpdatesRequest />,
                  },
                  {
                    key: "bed-finder",
                    icon: SearchCheck,
                    name: "Find a bed",
                    detail: "ready now",
                    count: counts.bedsReady,
                    title: "Find a bed",
                    body: <ToolFindBed onNavigate={onNavigate} />,
                  },
                  {
                    key: "messages",
                    icon: MessageSquareText,
                    name: "Bed summary",
                    detail: "Copy for email",
                    title: "Bed summary",
                    body: <ToolMessages onNavigate={onNavigate} />,
                  },
                  { key: "chase", icon: PhoneCall, name: "Chase wards", detail: "Ward calls", href: root },
                  { key: "ask", icon: Send, name: "Ask wards", detail: "For a patient", href: `${root}/waiting` },
                  {
                    key: "broadcast",
                    icon: Megaphone,
                    name: "Broadcast",
                    detail: "To chosen units",
                    href: `${root}/alerts`,
                  },
                ]}
              />
            ),
          }
        : null,
    "new-referral":
      isPhone && canRefer
        ? {
            key: "new-referral",
            icon: Plus,
            name: "New referral",
            detail: "Details and destination",
            onClick: () => onNewReferral(),
          }
        : null,
    "update-bed":
      updateBedHref === `${root}/wards`
        ? {
            key: "update-bed",
            icon: BedSingle,
            name: "Update a bed",
            detail: "Open or close",
            body: <UpdateBedWards onNavigate={onNavigate} />,
          }
        : updateBedHref
          ? {
              key: "update-bed",
              icon: BedSingle,
              name: "Update a bed",
              detail: "Open or close",
              href: updateBedHref,
            }
          : null,
    remind: executive
      ? null
      : {
          key: "remind",
          icon: BellRing,
          name: "Remind me",
          detail: "A nudge at a set time",
          count: { n: counts.reminders ?? 0, label: "reminders set" },
          body: <ToolRemindMe onNavigate={onNavigate} />,
        },
    // Josh, 8 Nov 2026: the coordinator's phone work is ringing wards, so logging the call leads Do now.
    "call-log":
      role === "coordinator" && !executive
        ? {
            key: "call-log",
            icon: PhoneOutgoing,
            name: "Call and log",
            detail: "What a ward told you",
            body: <ToolCallLog />,
          }
        : null,
    // QA 2 Nov: Book transport opens the Transport desk, so it is a link row, like Log a delay.
    "book-transport":
      role === "officer" || role === "admin" || role === "executive"
        ? null
        : {
            key: "book-transport",
            icon: Ambulance,
            name: "Book transport",
            detail: "Log a transfer",
            href: canOpen(`${root}/transport/officer`) ? `${root}/transport/officer` : `${root}/movements`,
          },
    // Friction pass item 6c (Josh, 9 Nov 2026): a short form here in place of the Waiting page.
    "log-delay": canLogDelay
      ? { key: "log-delay", icon: Clock3, name: "Log a delay", detail: "Patient and reason", body: <ToolLogDelay /> }
      : null,
    feed:
      !executive && (role === "coordinator" || role === "bed_manager" || role === "ward")
        ? {
            key: "feed",
            icon: Inbox,
            name: "Hospital feed",
            detail: "Messages to confirm",
            count: { n: counts.feed ?? 0, label: "messages to confirm", act: true },
            body: <ToolFeed onNavigate={onNavigate} />,
          }
        : null,
    "bed-finder": networkFigures
      ? {
          key: "bed-finder",
          icon: SearchCheck,
          name: "Find a bed",
          detail: "Ready beds by ward",
          // The sidebar's count follows the desk's own place, so only a network-wide desk shows it here.
          count:
            counts.bedsReady !== undefined && role === "coordinator"
              ? { n: counts.bedsReady, label: "beds ready now" }
              : undefined,
          body: <ToolFindBed onNavigate={onNavigate} />,
        }
      : null,
    figures: networkFigures
      ? {
          key: "figures",
          icon: ChartColumn,
          name: "Key figures",
          detail: "Beds, flow and waits",
          body: <ToolFigures onNavigate={onNavigate} />,
        }
      : null,
    "leave-due":
      executive || role === "officer" || role === "admin" || role === "community"
        ? null
        : {
            key: "leave-due",
            icon: CalendarCheck,
            name: "Due back",
            detail: "Leave ending today",
            count: { n: counts.leave ?? 0, label: "due back today" },
            body: <ToolLeaveDue onNavigate={onNavigate} />,
          },
    catchment: {
      key: "catchment",
      icon: MapIcon,
      name: "Suburb lookup",
      detail: "Team by suburb or postcode",
      body: (
        <SuburbLookupCard
          className={styles.suburbCard}
          teamMeta={(team) => {
            const clinic = contactForTeam(team);
            return (
              <span className={styles.clinicLine}>
                <Phone aria-hidden="true" strokeWidth={1.75} />
                {clinic?.publishedPhone
                  ? `Clinic ${clinic.publishedPhone}, invented demo number`
                  : "Clinic number not recorded"}
              </span>
            );
          }}
          teamActions={
            canRefer
              ? () => (
                  <button
                    type="button"
                    className={buttonClass({ variant: "sec", size: "sm" })}
                    onClick={() => onNewReferral("community")}
                  >
                    Refer to this team
                  </button>
                )
              : undefined
          }
        />
      ),
    },
    contacts: {
      key: "contacts",
      icon: PhoneCall,
      name: "On-call",
      detail: "Who is on now",
      body: <ToolOnCall onNavigate={onNavigate} />,
    },
    "form-times": {
      key: "form-times",
      icon: CalendarClock,
      name: "Form times",
      detail: "When a form runs out",
      body: <ToolFormTimes onNavigate={onNavigate} />,
    },
    "legal-forms": {
      key: "legal-forms",
      icon: Scale,
      name: "Legal forms",
      detail: "Every open form",
      href: `${root}/legal-forms`,
    },
    "out-of-area": isPhone
      ? {
          key: "out-of-area",
          icon: MapPinned,
          name: "Out of area",
          detail: "Beds far from home",
          href: `${root}/out-of-area`,
        }
      : null,
    messages: networkFigures
      ? {
          key: "messages",
          icon: MessageSquareText,
          name: "Messages",
          detail: "Email or Teams text",
          body: <ToolMessages onNavigate={onNavigate} />,
        }
      : null,
    handover: isPhone
      ? { key: "handover", icon: FileText, name: "Handover sheet", detail: "Review and print", href: handoverHref() }
      : null,
    downtime: {
      key: "downtime",
      icon: Printer,
      name: "Downtime pack",
      detail: "Print a snapshot",
      href: DOWNTIME_PACK_HREF,
    },
    chronology: {
      key: "chronology",
      icon: FileClock,
      name: "Patient chronology",
      detail: "PIR export",
      href: PATIENT_CHRONOLOGY_HREF,
    },
    // New rows (Josh, 6 Nov 2026: "add all other useful features to tools"). Each is a page this desk
    // may already open; canOpen drops any it may not.
    "find-patient": {
      key: "find-patient",
      icon: UserSearch,
      name: "Find a patient",
      detail: "By name, UMRN or place",
      href: `${root}/search`,
    },
    "bed-meeting": {
      key: "bed-meeting",
      icon: ListChecks,
      name: "Bed meeting agenda",
      detail: "Run the meeting",
      href: `${root}/bed-meeting/agenda`,
    },
    "tv-board": {
      key: "tv-board",
      icon: Tv,
      name: "TV board",
      detail: "Large type, read only",
      href: `${root}/bed-meeting`,
    },
    demo: null,
  };

  // Quick actions for every desk (Josh approved the mock-up, 4 Nov 2026): the coordinator keeps its
  // own tiles above; every other desk gets its most used controls, built from the rows below so each
  // tile keeps that row's gate. A tile this desk may not open simply drops out. The rows stay below
  // too, so search and Recent still find them.
  const deskSpecs = role === "coordinator" ? [] : (ROLE_QUICK[role] ?? []);
  const deskTiles: QuickTile[] = deskSpecs.flatMap((spec): QuickTile[] => {
    if (typeof spec !== "string") {
      // A desk-home tile (the ward's Confirm beds, the team's Referrals in) opens this desk's own place.
      const href = DESK_HOME_TILES.has(spec.key) ? homeHrefFor(access, communityTeamSlug) : spec.href;
      return canOpen(href) ? [{ ...spec, href }] : [];
    }
    const entry = all[spec];
    if (!entry || (entry.href && !canOpen(entry.href)) || (!entry.href && !entry.body)) return [];
    return [
      {
        key: entry.key,
        icon: entry.icon,
        name: entry.name,
        detail: TILE_DETAIL[entry.key] ?? entry.detail,
        count: entry.count?.n,
        title: entry.name,
        body: entry.body,
        href: entry.href,
      },
    ];
  });
  if (deskTiles.length > 0) {
    all["quick-actions"] = {
      key: "quick-actions",
      icon: Zap,
      name: "Quick actions",
      detail: QUICK_DETAIL[role] ?? "Your most used controls",
      body: <QuickActionsPanel onNavigate={onNavigate} tiles={deskTiles} />,
    };
  }

  const words = query.trim();
  const order = ROLE_ORDER[role] ?? ROLE_ORDER.coordinator;
  const usable = (key: EntryKey): Entry | null => {
    const entry = all[key];
    if (!entry) return null;
    if (entry.href && !canOpen(entry.href)) return null;
    return entry;
  };
  const groups = GROUPS.map((group) => ({
    ...group,
    entries: order[group.id]
      .map(usable)
      .filter((entry): entry is Entry => entry !== null)
      .filter((entry) => !words || fieldsMatchEveryWord(words, [entry.name, entry.detail])),
  })).filter((group) => group.entries.length > 0);
  // On wide desktops a group folds after five rows unless searching, opened, short, or holding the open tool
  // (a Recent chip can open a tool whose row sits under Show more).
  // Phone and tablet show every row (Josh, 6 Nov 2026): tools open as pages, so the list stays calm.
  const groupShowsAll = (group: (typeof groups)[number]) =>
    !twoPane ||
    Boolean(words) ||
    expanded.has(group.id) ||
    group.entries.length <= GROUP_SHOWN + 1 ||
    group.entries.findIndex((entry) => entry.key === open) >= GROUP_SHOWN;
  const groupOf = (key: EntryKey): GroupId => GROUPS.find((group) => order[group.id].includes(key))?.id ?? "look";
  const matches = groups.reduce((total, group) => total + group.entries.length, 0);

  // Q309: recent tools first; until there are any, the desk's likely three.
  // Only tools this desk lists, so a chip remembered from another desk never opens here.
  const listed = (id: ToolsSheetToolId) => GROUPS.some((group) => order[group.id].includes(id));
  const toolIds = (ids: readonly ToolsSheetToolId[]) =>
    ids.filter((id) => listed(id) && usable(id)?.body !== undefined);
  const recentIds = toolIds(recent);
  const quickIds = recentIds.length > 0 ? recentIds : toolIds(ROLE_SUGGESTED[role] ?? []);
  const quickTitle = recentIds.length > 0 ? "Recent" : "Suggested";

  // Q311: two panes always show a tool, never an empty pane; the first quick pick opens with the sheet.
  // The demo controls open like any tool: in the pane here, as their own page below two panes.
  const shown: ToolsSheetToolId | null = twoPane ? (open ?? quickIds[0] ?? null) : open;
  // A search with no match empties the pane too, so an old tool never sits beside "No tool matches".

  const demoEntry: Entry = {
    key: "demo",
    icon: FlaskConical,
    name: "Demo",
    detail: "Synthetic data only",
    body: (
      <div className={styles.toolBody}>
        <WardDemoPanel oneList={!isPhone} grow />
        {/* Q320: the feed's demo button moves here from Do now. */}
        {/* The executive desk has no live World, so the feed's demo button is not offered there. */}
        {executive ? null : <ReceiveNextFeedMessage />}
      </div>
    ),
  };

  const paneEntry = shown && matches > 0 ? (shown === "demo" ? demoEntry : usable(shown)) : null;

  const suggestions: Suggestion[] = executive
    ? []
    : [
        {
          key: "forms",
          title: "Forms to act on",
          detail: "Typed end time passed or close",
          n: counts.formsActNow ?? 0,
          tone: "danger" as const,
          href: `${root}/legal-forms`,
        },
        {
          key: "wards",
          title: "Wards to call",
          detail: "Beds not confirmed this shift",
          n: unconfirmed,
          tone: "warning" as const,
          tool: all["call-log"] ? ("call-log" as const) : ("quick-actions" as const),
        },
        {
          key: "leave",
          title: "Due back from leave",
          detail: "Today, by ward",
          n: counts.leave ?? 0,
          tone: "info" as const,
          tool: "leave-due" as const,
        },
      ].filter((item) => item.n > 0);

  const renderRow = (entry: Entry, group: GroupId) => {
    if (entry.href) {
      return (
        <Link
          key={entry.key}
          href={entry.href}
          className={styles.row}
          onClick={onNavigate}
          aria-label={rowName(entry, ", opens its page")}
        >
          <RowText entry={entry} group={group} />
          <ArrowUpRight className={styles.rowEnd} aria-hidden="true" strokeWidth={1.75} />
          <span className="sr-only">, opens its page</span>
        </Link>
      );
    }
    if (entry.onClick) {
      return (
        <button
          key={entry.key}
          type="button"
          className={styles.row}
          onClick={entry.onClick}
          aria-label={rowName(entry, ", opens the form")}
        >
          <RowText entry={entry} group={group} />
          <ArrowUpRight className={styles.rowEnd} aria-hidden="true" strokeWidth={1.75} />
          <span className="sr-only">, opens the form</span>
        </button>
      );
    }
    const id = entry.key as ToolsSheetToolId;
    const isOpen = shown === id;
    return (
      <div key={entry.key} className={styles.tool} data-open={(twoPane && isOpen) || undefined} data-tool-row={id}>
        <button
          type="button"
          className={styles.row}
          aria-current={twoPane && isOpen ? "true" : undefined}
          data-testid={`ward-tools-toggle-${id}`}
          aria-label={rowName(entry, "")}
          onClick={() => openTool(id)}
        >
          <RowText entry={entry} group={group} />
          <ChevronRight className={styles.rowEnd} aria-hidden="true" strokeWidth={1.75} />
        </button>
      </div>
    );
  };

  // The open tool's page on phone and tablet: Back to Tools, the tool's name, then the tool.
  const pageEntry = !twoPane && open ? (open === "demo" ? demoEntry : usable(open)) : null;
  const toolPage = pageEntry ? (
    <section
      id={`ward-tools-page-${pageEntry.key}`}
      className={styles.page}
      aria-label={pageEntry.key === "demo" ? "Scenario and clock" : pageEntry.name}
      tabIndex={-1}
      data-testid="ward-tools-page"
    >
      <header className={styles.pageHead}>
        <button type="button" className={styles.back} onClick={closeTool} data-testid="ward-tools-back">
          <ChevronLeft aria-hidden="true" strokeWidth={2} />
          All tools
        </button>
        <span className={styles.pageTitle}>
          {(() => {
            const Icon = pageEntry.icon;
            return (
              <span
                className={styles.rowIcon}
                data-group={pageEntry.key === "demo" ? "share" : groupOf(pageEntry.key)}
                aria-hidden="true"
              >
                <Icon aria-hidden="true" strokeWidth={1.75} />
              </span>
            );
          })()}
          <span className={styles.rowText}>
            <strong>{pageEntry.name}</strong>
            <em>{pageEntry.detail}</em>
          </span>
        </span>
      </header>
      <div className={styles.pageBody} id={`ward-tools-${pageEntry.key}`}>
        {pageEntry.body}
      </div>
    </section>
  ) : null;

  return (
    <WardDemoConfirmHold value={demoConfirm}>
      <div className={styles.sheet} data-two-pane={twoPane || undefined} data-testid="ward-tools-sheet-v3">
        {toolPage}
        <div className={styles.list} hidden={Boolean(toolPage)}>
          <SearchField
            className={styles.search}
            label="Search tools"
            placeholder="Search tools"
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              setNoSearch(false);
            }}
            inputRef={searchRef}
            shortcut={!isPhone}
            onKeyDown={(event) => {
              // Escape with words typed clears the box; only an empty box lets Escape close the sheet.
              if (event.key === "Escape" && query) {
                // The shared Sheet leaves an Escape a field has already handled (defaultPrevented).
                event.preventDefault();
                setQuery("");
                setNoSearch(false);
              }
            }}
          />

          {/* Shared design parts item 8 (13 Nov 2026): on a phone, Help is a row here too, so a page with
            Back (no header Menu) still reaches it. It opens the header Menu's Help, this screen first. */}
          {!words && isPhone ? (
            <section className={styles.quick} aria-label="Help">
              <div className={styles.card}>
                <button
                  type="button"
                  className={styles.row}
                  data-testid="ward-tools-help"
                  onClick={() => {
                    onNavigate();
                    openWardHelp("tasks");
                  }}
                >
                  <span className={styles.rowIcon} data-group="look" aria-hidden="true">
                    <CircleHelp aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  <span className={styles.rowText}>
                    <strong>How this screen works</strong> <em>Help for this page</em>
                  </span>{" "}
                  <ChevronRight className={styles.rowEnd} aria-hidden="true" strokeWidth={1.75} />
                </button>
              </div>
            </section>
          ) : null}

          {/* Needs you (Josh, 8 Nov 2026; words from shared design parts item 11, 13 Nov 2026, the same
            as Home's Needs you tab): the coordinator's few things that need them, each one tap from
            its tool. Only what is due shows; with nothing due, the section is gone. */}
          {/* Q308: Viewing as joins the Demo controls at the head (R-STRUCT-23: Demo is the first row of Tools). */}
          {!words ? (
            <section className={styles.group} aria-label="Demo">
              <h3 className={styles.groupHeading}>
                Demo
                <DemoMovedLabel />
              </h3>
              <div className={styles.card}>
                <div className={styles.viewingAs}>
                  <span className={styles.viewingText}>
                    <span>Viewing as</span>
                    <strong>{roleLabel}</strong>
                  </span>
                  <WardRoleSwitcher withWords />
                </div>
                {/* The executive desktop keeps its own scenario controls, so the demo row shows there on phone only. */}
                {isPhone || !executive ? renderRow(demoEntry, "share") : null}
              </div>
            </section>
          ) : null}

          {!words && role === "coordinator" && suggestions.length > 0 ? (
            <section className={styles.quick} aria-label="Needs you">
              <h3 className={styles.groupHeading}>Needs you</h3>
              <div className={styles.card}>
                {suggestions.map((item) => {
                  const face = (
                    <>
                      <span className={styles.suggestDot} data-tone={item.tone} aria-hidden="true" />
                      <span className={styles.suggestText}>
                        <strong>{item.title}</strong>
                        <em>{item.detail}</em>
                      </span>
                      <span className={styles.suggestValue} data-tone={item.tone}>
                        {item.n}
                      </span>
                      {item.href ? <SrOnly>, opens its page</SrOnly> : null}
                      {item.href ? (
                        <ArrowUpRight className={styles.rowEnd} aria-hidden="true" strokeWidth={1.75} />
                      ) : (
                        <ChevronRight className={styles.rowEnd} aria-hidden="true" strokeWidth={1.75} />
                      )}
                    </>
                  );
                  return item.href ? (
                    <Link key={item.key} href={item.href} className={styles.row} onClick={onNavigate}>
                      {face}
                    </Link>
                  ) : (
                    <button
                      key={item.key}
                      type="button"
                      className={styles.row}
                      onClick={() => openTool(item.tool!)}
                      data-testid={`ward-tools-suggest-${item.key}`}
                    >
                      {face}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Polish (3 Nov): chips show only tools this person has used; the desk order already leads with the likely ones. */}
          {!words && recentIds.length > 0 ? (
            <section className={styles.quick} aria-label={quickTitle}>
              <h3 className={styles.groupHeading}>{quickTitle}</h3>
              <div className={styles.chips}>
                {quickIds.map((id) => {
                  const entry = usable(id);
                  if (!entry) return null;
                  const Icon = entry.icon;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={styles.chip}
                      aria-pressed={shown === id}
                      onClick={() => openTool(id)}
                    >
                      <Icon aria-hidden="true" strokeWidth={1.75} />
                      {entry.name}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {matches === 0 ? (
            <div className={styles.none} role="status">
              <p>No tool matches “{query.trim()}”.</p>
              {noSearch ? <p>Search is not on this page. Open Patients to search.</p> : null}
              <div className={styles.noneActions}>
                <button
                  type="button"
                  className={buttonClass({ variant: "pri", size: "sm" })}
                  onClick={() => setNoSearch(!searchWardFlow(query.trim(), onNavigate))}
                >
                  Search Ward Flow
                </button>
                <button
                  type="button"
                  className={buttonClass({ variant: "sec", size: "sm" })}
                  onClick={() => setQuery("")}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.id} className={styles.group} aria-label={group.title}>
                <h3 className={styles.groupHeading}>
                  {group.title}
                  <span className={styles.groupCount}>{group.entries.length}</span>
                </h3>
                <div className={styles.card} data-tool-group={group.id}>
                  {(groupShowsAll(group) ? group.entries : group.entries.slice(0, GROUP_SHOWN)).map((entry) =>
                    renderRow(entry, group.id),
                  )}
                  {!groupShowsAll(group) ? (
                    <button
                      type="button"
                      className={styles.showMore}
                      onClick={() => {
                        setExpanded((current) => new Set(current).add(group.id));
                        // The button leaves with the fold, so focus moves to the first row it revealed.
                        window.requestAnimationFrame(() => {
                          const row = document.querySelector(`[data-tool-group="${group.id}"]`)?.children[GROUP_SHOWN];
                          const target = row?.matches("a, button") ? row : row?.querySelector("a, button");
                          if (target instanceof HTMLElement) target.focus();
                        });
                      }}
                    >
                      Show {group.entries.length - GROUP_SHOWN} more
                      <ChevronDown aria-hidden="true" strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>
              </section>
            ))
          )}
        </div>

        {twoPane ? (
          <section
            className={styles.pane}
            aria-label={(paneEntry?.key === "demo" ? "Scenario and clock" : paneEntry?.name) ?? "Tool"}
            id={shown ? `ward-tools-${shown}` : undefined}
          >
            {paneEntry ? (
              <>
                <header className={styles.paneHead}>
                  {(() => {
                    const entry = paneEntry;
                    const Icon = entry.icon;
                    return (
                      <>
                        <span className={styles.rowIcon} data-group={groupOf(entry.key)} aria-hidden="true">
                          <Icon aria-hidden="true" strokeWidth={1.75} />
                        </span>
                        <span className={styles.rowText}>
                          <strong>{entry.name}</strong>
                          <em>{entry.detail}</em>
                        </span>
                      </>
                    );
                  })()}
                </header>
                <div className={styles.paneBody}>{paneEntry.body}</div>
              </>
            ) : (
              <p className={styles.quiet}>Choose a tool.</p>
            )}
          </section>
        ) : null}
      </div>
    </WardDemoConfirmHold>
  );
}
