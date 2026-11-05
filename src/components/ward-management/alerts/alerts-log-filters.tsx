"use client";

// AL2 (Josh, 3 Nov 2026): "Alerts becomes the full log for your desk (including cleared and earlier,
// with filters and broadcasts). Home's Needs you stays where you act, and the drawer stays the quick
// view." The three views (Open, Cleared, Broadcasts), the address that opens one, and the Open
// view's filters. Kept out of `alerts-screen.tsx` so the screen stays under its line cap; the screen
// keeps the state and the acts. Presentation only: the engine and reducer are untouched.
import { ChevronRight, Clock, X } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { Button, ChipGroup, Count, FilterChip, PillTabs, SrOnly, StatusGlyph, Tabs } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

import type { AlertsTab as HeroAlertsTab } from "./alerts-hero";
import { copiedAge } from "./alerts-model";
import type { QueueEntry } from "./alerts-queue";
import type { BroadcastAlert } from "./ward-broadcast-model";
import styles from "./alerts.module.css";
import parts from "./alerts-screen-parts.module.css";
import log from "./alerts-log.module.css";

/**
 * The three views. The ids stay "now" and "earlier" so `alerts-tab-now`, which the shell's Alerts
 * shortcut clicks (`focusAlertsQueue`), still names the Open tab.
 */
export type AlertsTab = HeroAlertsTab | "broadcasts";

/** `#open`, `#cleared` (or the older `#earlier`) and `#broadcasts` open that view. */
const HASH_TABS: Record<string, AlertsTab> = {
  open: "now",
  now: "now",
  cleared: "earlier",
  earlier: "earlier",
  broadcasts: "broadcasts",
};

export function alertsTabFromHash(hash: string): AlertsTab | undefined {
  const key = hash.replace(/^#/u, "").toLowerCase();
  return Object.hasOwn(HASH_TABS, key) ? HASH_TABS[key] : undefined;
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Opens the view the address names, once for each new hash, as the screen reads `?alert=`. */
export function useAlertsHashTab(setTab: (tab: AlertsTab) => void) {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => "",
  );
  const [hashUsed, setHashUsed] = useState("");
  if (hash !== hashUsed) {
    setHashUsed(hash);
    const tab = alertsTabFromHash(hash);
    if (tab) setTab(tab);
  }
}

/** The kinds the Open view already groups by. "All" shows every group, as before. */
type OpenFilter = "all" | "act" | "wait" | "forecast" | "reminders" | "notices" | "snoozed" | "yours";

const FILTER_LABEL: Record<OpenFilter, string> = {
  all: "All",
  act: "Act now",
  wait: "Waiting",
  forecast: "Forecast",
  reminders: "Reminders",
  notices: "Notices",
  snoozed: "Snoozed",
  yours: "Yours",
};

/** The groups each filter shows. Yours keeps the queue's groups, with only your rows in them. */
const FILTER_SECTIONS: Record<Exclude<OpenFilter, "all">, readonly string[]> = {
  act: ["act"],
  wait: ["wait", "running"],
  forecast: ["forecast"],
  reminders: ["reminders"],
  notices: ["notices"],
  snoozed: ["snoozed"],
  yours: ["act", "wait", "running", "snoozed"],
};

/** Whether a queue row belongs under the filter. A snoozed act-now row stays under Act now (safety rule 4). */
function keepsEntry(filter: OpenFilter, entry: QueueEntry): boolean {
  switch (filter) {
    case "all":
      return true;
    case "act":
      return entry.group === "act";
    case "wait":
      return entry.group !== "act" && entry.snooze === undefined;
    case "snoozed":
      return entry.snooze !== undefined;
    case "yours":
      return entry.mine;
    default:
      return false;
  }
}

type OpenFilterCounts = Partial<Record<Exclude<OpenFilter, "all">, number>>;

/** The figures behind the chips; undefined means this desk has no such group. */
type OpenFilterFigures = {
  act: number;
  wait: number;
  forecast: number | undefined;
  reminders: number;
  notices: number;
  snoozed: number;
  yours: number | undefined;
};

/**
 * The Open view's filter. Each chip shows the same figure as its group's heading. Act now and
 * Waiting always have a chip; Forecast and Yours only on a desk with them; Reminders, Notices and
 * Snoozed only while there are some. A quiet ward has no chips. A chosen filter whose chip goes
 * (its last reminder done, say) falls back to All.
 */
export function useOpenFilter(quiet: boolean, figures: OpenFilterFigures) {
  const counts: OpenFilterCounts = {};
  if (!quiet) {
    counts.act = figures.act;
    counts.wait = figures.wait;
    if (figures.forecast !== undefined) counts.forecast = figures.forecast;
    if (figures.reminders > 0) counts.reminders = figures.reminders;
    if (figures.notices > 0) counts.notices = figures.notices;
    if (figures.snoozed > 0) counts.snoozed = figures.snoozed;
    if (figures.yours !== undefined) counts.yours = figures.yours;
  }
  const [chosen, setFilter] = useState<OpenFilter>("all");
  const filter: OpenFilter = chosen === "all" || counts[chosen] !== undefined ? chosen : "all";
  return {
    filter,
    setFilter,
    counts,
    label: FILTER_LABEL[filter],
    /** Whether the group with this key shows under the filter. */
    shows: (section: string) => filter === "all" || FILTER_SECTIONS[filter].includes(section),
    /** The rows of a list that stay under the filter, in their order. */
    pick: (list: readonly QueueEntry[]) => (filter === "all" ? [...list] : list.filter((e) => keepsEntry(filter, e))),
  };
}

type OpenFilterLens = ReturnType<typeof useOpenFilter>;

/** The row of filter chips over the Open view: one pressed at a time, All when none is. */
/** `end` sits at the row's end, after the chips (the phone's owner menu). */
export function OpenFilters({ lens, end }: { lens: OpenFilterLens; end?: ReactNode }) {
  const ids = ["all" as const, ...(Object.keys(FILTER_LABEL) as OpenFilter[]).filter((id) => id !== "all")].filter(
    (id) => id === "all" || lens.counts[id] !== undefined,
  );
  return (
    <div className={log.filterRow} data-testid="ward-alerts-filters">
      <ChipGroup label="Show open alerts" className={log.filterChips}>
        {ids.map((id) => (
          <FilterChip
            key={id}
            pressed={lens.filter === id}
            onPressedChange={(pressed) => lens.setFilter(pressed ? id : "all")}
            count={id === "all" ? undefined : lens.counts[id]}
          >
            {FILTER_LABEL[id]}
          </FilterChip>
        ))}
      </ChipGroup>
      {end ? <span className={log.filterEnd}>{end}</span> : null}
    </div>
  );
}

/** One line when the chosen filter has nothing open, never a claim about the rest of the queue. */
export function FilteredEmpty({ lens }: { lens: OpenFilterLens }) {
  return (
    <p className={log.filteredEmpty} data-testid="ward-alerts-filtered-empty">
      Nothing open under {lens.label}.{" "}
      <button type="button" className={log.linkButton} onClick={() => lens.setFilter("all")}>
        Show all
      </button>
    </p>
  );
}

/** The handover text Copy writes: each group with its rows, then the live broadcast. */
export function handoverText(
  sections: readonly [string, readonly QueueEntry[]][],
  activeBroadcast: BroadcastAlert | undefined,
  now: Instant,
): string {
  const line = (entry: QueueEntry) =>
    `- ${entry.item.title}. ${entry.subject.displayName}. ${entry.subject.to ? `${entry.subject.from} to ${entry.subject.to}` : entry.subject.from}. Owner ${entry.owner}.${copiedAge(entry.item, entry.raised, now)}`;
  return [
    `Alerts at ${formatInstantWithDay(now, now)} (synthetic data)`,
    ...sections.flatMap(([label, list]) => (list.length > 0 ? [`${label} ${list.length}`, ...list.map(line)] : [])),
    activeBroadcast
      ? `Broadcast live: ${activeBroadcast.title}, ends ${formatInstantWithDay(activeBroadcast.expiresAt, now)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Phone: the Today card under the queue, opening the Today sheet. */
export function TodayPhoneCard({
  raised,
  acted,
  broadcast,
  onOpen,
}: {
  raised: number;
  acted: number;
  broadcast: number;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={styles.phoneCard} onClick={onOpen}>
      <Clock size={18} aria-hidden="true" />
      <span className={styles.phoneCardText}>
        <span className={styles.phoneCardTitle}>Today</span>
        <span className={styles.phoneCardMeta}>
          <b className={styles.mono}>{raised}</b> raised · <b className={styles.mono}>{acted}</b> acted on ·{" "}
          <b className={styles.mono}>{broadcast}</b> broadcast
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

/**
 * The view tabs over the queue. Phone (v10): pill tabs that stay under the header. Desktop: tabs
 * with the Arrange by switch sharing the row (Alerts redesign). A count shows only above zero.
 */
export function AlertsViewTabs({
  isPhone,
  tabs,
  value,
  onChange,
  arrange,
}: {
  isPhone: boolean;
  tabs: { id: AlertsTab; label: string; count: number }[];
  value: AlertsTab;
  onChange: (tab: AlertsTab) => void;
  arrange: ReactNode;
}) {
  const items = tabs.map((item) => (item.count ? item : { ...item, count: undefined }));
  return isPhone ? (
    <div className={styles.tabsBar}>
      <PillTabs<AlertsTab>
        items={items}
        value={value}
        onChange={onChange}
        label="Alerts views"
        idPrefix="alerts"
        fill
      />
    </div>
  ) : (
    <div className={`${styles.tabsBar} ${parts.tabsRow}`}>
      <Tabs items={items} value={value} onChange={onChange} label="Alerts views" idPrefix="alerts" />
      {arrange}
    </div>
  );
}

/** How many rows a hero highlight marks, with Clear. Highlights never hide a row. */
export function HighlightNote({ count, of, onClear }: { count: number; of: number; onClear: () => void }) {
  return (
    <div className={styles.toolbar}>
      <span className={styles.highlightNote} role="status">
        {count} of {of} <SrOnly>synthetic rows</SrOnly> highlighted, all rows stay
      </span>
      <Button
        size="sm"
        variant="ghost"
        className={styles.btnSm}
        aria-label={`Clear highlights, ${count} highlighted`}
        onClick={onClear}
      >
        Clear <Count n={count} />
      </Button>
    </div>
  );
}

/** The line after a broadcast or an act on a row: the reducer's verdict, dismissable. */
export function FeedbackLine({ refused, text, onDismiss }: { refused: boolean; text: string; onDismiss: () => void }) {
  return (
    <div className={styles.feedbackLine} role={refused ? "alert" : "status"} aria-label="Broadcast feedback">
      <StatusGlyph tone={refused ? "danger" : "success"} />
      <span className={styles.feedbackText}>{text}</span>
      <Button
        iconOnly
        icon={X}
        size="sm"
        variant="ghost"
        className={styles.btnSm}
        onClick={onDismiss}
        aria-label="Dismiss notice"
      />
    </div>
  );
}
