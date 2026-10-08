"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Menu,
  PanelLeftOpen,
  Plus,
  RotateCcwClock,
  Settings,
  SunMoon,
  Wrench,
} from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { Dot, durMinutes } from "@/components/wf";
import { createBrowserStore } from "@/lib/client-store-factory";
import { formatInstant, minuteOfDay } from "@/components/ward-management/ward-clock";
import { OPERATIONAL_DEFAULT_LABEL, SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { wardNavCountLabel } from "@/components/ward-management/ward-nav-counts";
import { type HealthService } from "@/components/ward-management/ward-model";
import {
  WARD_HOME_HREF,
  WARD_NAV,
  WARD_VIEWS,
  WARD_CAPACITY_HREF,
  WARD_COMMAND_HREF,
  WARD_ED_HREF,
  type WardNavItem,
  type WardViewItem,
} from "@/components/ward-management/ward-nav";
import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "@/components/ward-management/ward-nav-icons";
import { wardNavRoleRank } from "@/components/ward-management/ward-nav-role-order";

import { announceToWardShell } from "./ward-live-region";
import { applyAppearance, useAppearanceStore } from "./ward-bar";
import { edHref, handoverHref, patientHref, settingsHref } from "./ward-facade";
import {
  BED_ALERT_THRESHOLD_PERCENT,
  bedAlertSiteLabel,
  deriveServiceBedAlerts,
  formatOccupancyPercent,
  isBedAlert,
  type ServiceBedAlert,
} from "./ward-service-bed-alerts";
import { useServiceScope } from "./ward-service-store";
import { openWardDrawer, closeWardDrawer, subscribeWardMenu } from "./ward-drawer-bus";
import styles from "./ward-rail.module.css";

export type { ServiceBedAlert } from "./ward-service-bed-alerts";

/**
 * Ward Flow's rail, restyled to the v6 shell (boards 02, 03 and 03b of the header and sidebar
 * mockups, 7 October 2026). The layout and element placement are the third edition's; only the
 * skin changed. Josh's decisions for this pass:
 *
 * - The occupancy card is now "Bed alerts": an alert count, Metro and the hottest health service,
 *   each with a meter and an 85% tick. Its dropdown lists every health service. Every figure comes
 *   from `deriveServiceBedAlerts`, never typed here.
 * - The "Reconciliation not published" line is removed from the rail. `ward-reconciliation-line.tsx`
 *   stays (the Search hub still imports its sentence composer) but is no longer mounted here.
 * - The rail's New referral is a secondary button; the header keeps the only primary.
 * - Selection is a slate tint with a fine edge. No bar or stripe on any edge (owner ruling Q-11).
 * - Status markers are round: a filled amber circle at or over 85%, a neutral ring under it.
 *
 * The chosen service still shows as a dot next to a WORD, never a bar (owner answer 52): open, it
 * reads "Service: South Metro"; closed, the dot keeps the short form ("South"). Under All services
 * it renders nothing at all, because there is no state to echo.
 */

const RAIL_OPEN_STORAGE_KEY = "ward-flow-rail";

// Item 52's swatch key, mirroring `ed.module.css`'s own `data-svc` attribute-selector convention
// rather than an inline colour, so the CSS stays the one place that names a token.
const SERVICE_SWATCH_KEY: Record<HealthService, "north" | "south" | "east" | "wachs" | "cahs" | "private"> = {
  "North Metro": "north",
  "South Metro": "south",
  "East Metro": "east",
  WACHS: "wachs",
  CAHS: "cahs",
  Private: "private",
};

// The closed rail's short form. Metro is the only word ever dropped.
const SERVICE_SHORT_LABEL: Record<HealthService, string> = {
  "North Metro": "North",
  "South Metro": "South",
  "East Metro": "East",
  WACHS: "WACHS",
  CAHS: "CAHS",
  Private: "Private",
};

function readRailOpenPreference(storedValue: string | null | undefined): boolean {
  // Standard §7.7: "A browser that refuses storage still gets the page, open." Absent or any
  // value other than the literal "closed" reads as open.
  return storedValue !== "closed";
}

let inMemoryFallback: boolean | null = null;

function getRailOpenSnapshot(): boolean {
  if (inMemoryFallback !== null) return inMemoryFallback;
  try {
    return readRailOpenPreference(window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY));
  } catch {
    return true;
  }
}

const railOpenChangeEvent = "ward-flow-rail-change";

function subscribeRailOpen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(railOpenChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(railOpenChangeEvent, onChange);
  };
}

/**
 * Exported for the Settings rail control, together with `setRailOpenPreference` below. These two
 * are the ONLY writers of the rail preference, which is why they are shared rather than copied:
 * `setRailOpenPreference` dispatches `ward-flow-rail-change`, and a duplicate writer that omitted
 * that dispatch would leave the rail stale until a reload.
 *
 * `RAIL_OPEN_STORAGE_KEY` stays private, deliberately, so a two-keys catcher can still fail.
 */
export const useRailOpenStore = createBrowserStore(subscribeRailOpen, getRailOpenSnapshot, true);

export function setRailOpenPreference(open: boolean) {
  try {
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, open ? "open" : "closed");
    inMemoryFallback = null;
  } catch {
    inMemoryFallback = open;
  }
  window.dispatchEvent(new Event(railOpenChangeEvent));
}

type RailEntry = {
  id: string;
  href: string;
  label: string;
  icon: (typeof WARD_VIEW_ICONS)[keyof typeof WARD_VIEW_ICONS];
};

// Owner-requested navigation, 2026-09-13. Select presentation entries only;
// the complete route registry and contextual links remain available to the product.
const RAIL_GROUPS = [
  {
    label: "Today",
    entries: [
      ["command", "Home"],
      ["movements", "Movements"],
      ["capacity", "Capacity"],
      ["delays", "Delays"],
      ["network", "Network"],
    ],
  },
  {
    label: "Where",
    entries: [
      ["hub", "Places"],
      ["ed", "Emergency"],
      ["wards", "Wards"],
      ["community", "Community"],
      ["officer", "Transport"],
    ],
  },
  {
    label: "Work",
    entries: [
      ["search", "Patients"],
      ["referral-intake", "New referral"],
      ["referrals", "Referrals"],
      ["handover", "Handover"],
      ["discharges", "Discharges"],
    ],
  },
  {
    label: "Checks",
    entries: [
      ["governance", "Governance"],
      ["statistics", "Statistics"],
      ["legal-forms", "Legal"],
      ["out-of-area", "Out of area"],
      ["alerts", "Alerts"],
      ["on-call", "On-call"],
    ],
  },
] as const;
const COMPACT_CORE_ENTRY_IDS = new Set<string>(RAIL_GROUPS.flatMap((group) => group.entries.map(([id]) => id)));
const NARROW_CORE_ENTRY_IDS = new Set(["command", "movements", "capacity"]);

const CLOSED_RAIL_CARD_MEDIA_QUERY = "(min-width: 1001px)";
const GOVERNANCE_HREF = WARD_VIEWS.find((view) => view.id === "governance")?.href ?? WARD_HOME_HREF;

// Visual abbreviations for the tablet row. Full registry names and live counts remain on the
// accessible link and its hover card; these never define destinations.
const COMPACT_LABELS: Record<string, string> = {
  hub: "Places",
  ed: "ED",
  wards: "Wards",
  community: "Community",
  officer: "Transport",
  "referral-intake": "Refer",
  referrals: "Referrals",
  "out-of-area": "Out of area",
};

function subscribeToClosedRailCards(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(CLOSED_RAIL_CARD_MEDIA_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getClosedRailCardsSnapshot() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(CLOSED_RAIL_CARD_MEDIA_QUERY).matches
  );
}

function railEntries(): RailEntry[] {
  const views: RailEntry[] = WARD_VIEWS.map((item: WardViewItem) => ({
    id: item.id,
    href: item.href,
    label: item.label,
    icon: WARD_VIEW_ICONS[item.id],
  }));
  const nav: RailEntry[] = WARD_NAV.map((item: WardNavItem) => ({
    id: item.id,
    href: item.href,
    label: item.label,
    icon: WARD_NAV_ICONS[item.id],
  }));
  const registry = new Map([...views, ...nav].map((entry) => [entry.id, entry]));
  return RAIL_GROUPS.flatMap((group) => group.entries.map(([id, label]) => ({ ...registry.get(id)!, label })));
}

function normalizePath(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function isActiveRailEntry(pathname: string, entry: RailEntry): boolean {
  const norm = normalizePath(pathname);
  const entryHref = normalizePath(entry.href);
  if (norm === entryHref) return true;
  // Detail routes belong to their hub instead of restoring removed example links.
  if (entry.id === "command") return norm === WARD_HOME_HREF || norm === WARD_COMMAND_HREF;
  if (entry.id === "wards") return new RegExp(`^${WARD_HOME_HREF}/(ward|board)/`).test(norm);
  if (entry.id === "ed") return norm === WARD_ED_HREF || norm.startsWith(edHref(""));
  if (entry.id === "community") return norm.startsWith(`${entryHref}/`);
  if (entry.id === "movements" || entry.id === "statistics") return norm.startsWith(`${entryHref}/`);
  if (entry.id === "search") return norm.startsWith(patientHref(""));
  return false;
}

/** "at a time limit…" → "At a time limit…", for the closed rail's hover card. */
function sentenceStart(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

const CLINICAL_PERSONAS = [
  {
    id: "chen",
    name: "Dr S. Chen",
    initials: "SC",
    role: "Bed coordinator",
  },
  {
    id: "gallagher",
    name: "Sr M. Gallagher",
    initials: "MG",
    role: "Triage liaison nurse",
  },
  {
    id: "vance",
    name: "K. Vance RN",
    initials: "KV",
    role: "Ward 4W bed coordinator",
  },
  {
    id: "robinson",
    name: "Dr J. Robinson",
    initials: "JR",
    role: "Consultant psychiatrist",
  },
] as const;

const APPEARANCE_CHOICES = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

/**
 * Retained for the layout's existing call shape. The reconciliation line this used to feed is no
 * longer mounted in the rail (Josh, 7 October 2026), so the rail takes no props today.
 */
export type WardRailProps = Record<string, never>;

/** One meter row: a label, a 5px track with the 85% tick, and the mono percentage. */
function BedAlertMeter({ percent }: { percent: number }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <span className={styles.meter} aria-hidden="true">
      <span
        className={styles.meterFill}
        data-alert={isBedAlert(percent) ? "true" : undefined}
        style={{ width: `${width}%` }}
      />
      <span className={styles.meterTick} style={{ left: `${BED_ALERT_THRESHOLD_PERCENT}%` }} />
    </span>
  );
}

export function WardRail() {
  const pathname = usePathname() ?? "";
  const { units, bedReleases, movements, configuration } = useWardFlow();
  const now = useWardFlowClock();
  const accessTargetMinutes = configuration.edAccessTargetMinutes;
  const bedAlerts = deriveServiceBedAlerts(units, bedReleases, undefined, movements, now, accessTargetMinutes);
  const open = useRailOpenStore();
  const { counts, role } = useWardNavCounts();
  const appearance = useAppearanceStore();
  const service = useServiceScope();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const firstMoreLinkRef = useRef<HTMLAnchorElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [activePersona, setActivePersona] = useState<string>("chen");
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState<boolean>(false);
  const [capacityToast, setCapacityToast] = useState<string | null>(null);
  const capacityToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userCardRef = useRef<HTMLDivElement>(null);
  const isClosedRailCardViewport = useSyncExternalStore(
    subscribeToClosedRailCards,
    getClosedRailCardsSnapshot,
    () => false,
  );
  const entries = railEntries();
  const currentPersona = CLINICAL_PERSONAS.find((p) => p.id === activePersona) ?? CLINICAL_PERSONAS[0];
  const boardMinute = minuteOfDay(now);
  const boardClock = formatInstant(now);
  const shiftProgress = computeShiftProgress(boardMinute);
  const [appearanceOpen, setAppearanceOpen] = useState<boolean>(false);
  const [alertsOpen, setAlertsOpen] = useState<boolean>(false);
  const appearanceRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Every figure below comes from the derivation; nothing is typed here.
  const servicesByOccupancy = bedAlerts.services.toSorted((a, b) => b.occupancyPercent - a.occupancyPercent);
  const hottest: ServiceBedAlert | null = servicesByOccupancy[0] ?? null;
  const alertCount = bedAlerts.services.filter((svc) => isBedAlert(svc.occupancyPercent)).length;
  const alertCountLabel = alertCount === 0 ? "No alerts" : `${alertCount} ${alertCount === 1 ? "alert" : "alerts"}`;
  const metroPercent = bedAlerts.metroOccupancyPercent;
  const metroLabel = metroPercent === null ? "Metro —" : `Metro ${formatOccupancyPercent(metroPercent)}`;
  const hottestLabel = hottest ? `${hottest.shortName} ${formatOccupancyPercent(hottest.occupancyPercent)}` : "";
  const handoverText = shiftProgress.handoverDue ? null : durMinutes(shiftProgress.remainingMinutes);

  const setOpen = useCallback((next: boolean) => {
    setRailOpenPreference(next);
    document.documentElement.setAttribute("data-rail", next ? "open" : "closed");
    announceToWardShell(next ? "The rail, open." : "The rail, closed.");
    // Standard §7.7: "moves focus to the new control". The toggle stays the same element in both
    // shapes, so this keeps it focused rather than handing off to a different node.
    toggleRef.current?.focus();
  }, []);

  // Phone bar (8 Oct 2026): the rail row is hidden under 48rem and the bar's own Menu button opens
  // this same sheet, so the navigation has one home.
  useEffect(
    () =>
      subscribeWardMenu((trigger) => {
        moreTriggerRef.current = trigger;
        setMoreOpen(true);
      }),
    [],
  );

  // Keeps the root attribute in sync with the remembered preference on every mount and whenever
  // it changes elsewhere (another tab, the toggle below, Settings).
  useEffect(() => {
    document.documentElement.setAttribute("data-rail", open ? "open" : "closed");
  }, [open]);

  useLayoutEffect(() => {
    if (appearance === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", appearance);
  }, [appearance]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (roleSwitcherOpen) {
          setRoleSwitcherOpen(false);
        }
        if (appearanceOpen) {
          setAppearanceOpen(false);
        }
        if (alertsOpen) {
          setAlertsOpen(false);
        }
        closeWardDrawer();
        return;
      }
      const target = event.target;
      const tag = target instanceof HTMLElement ? target.tagName : "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;

      if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key === "T" || event.key === "t") {
          event.preventDefault();
          openWardDrawer("tasks");
          return;
        }
        if (event.key === "R" || event.key === "r") {
          event.preventDefault();
          openWardDrawer("referral");
          return;
        }
        if (event.key === "A" || event.key === "a") {
          event.preventDefault();
          openWardDrawer("activity");
          return;
        }
      }

      if (event.key !== "[") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      setOpen(!open);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen, roleSwitcherOpen, appearanceOpen, alertsOpen]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (userCardRef.current && !userCardRef.current.contains(event.target as Node)) {
        setRoleSwitcherOpen(false);
      }
      if (appearanceRef.current && !appearanceRef.current.contains(event.target as Node)) {
        setAppearanceOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  if (entries.length === 0) {
    // Never render an empty landmark: a rail with nothing in it is a defect, not a smaller rail.
    return null;
  }

  // Role-aware ordering: each entry is ranked by whichever role-order list names it. An id no list
  // names, and the whole `coordinator` role, keeps its curated `RAIL_GROUPS` position.
  const roleRank = new Map<string, number>();
  for (const entry of entries) {
    const rank = wardNavRoleRank(role, entry.id);
    if (rank !== null) roleRank.set(entry.id, rank);
  }
  const groups = RAIL_GROUPS.map((group) => ({
    label: group.label,
    entries: entries
      .filter((entry) => group.entries.some(([id]) => id === entry.id))
      .toSorted(
        (left, right) =>
          (roleRank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (roleRank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      ),
  }));
  const activeEntry = entries.find((entry) => isActiveRailEntry(pathname, entry));
  // Narrow navigation keeps the operational entry points plus the current route; the same Sheet
  // holds the rest.
  const compactPrimaryIds = new Set(isClosedRailCardViewport ? COMPACT_CORE_ENTRY_IDS : NARROW_CORE_ENTRY_IDS);
  if (activeEntry) compactPrimaryIds.add(activeEntry.id);

  function openMore(trigger: HTMLButtonElement) {
    moreTriggerRef.current = trigger;
    setMoreOpen(true);
  }

  function renderEntry(
    entry: RailEntry,
    options: { compactExtra?: boolean; sheet?: boolean; firstInSheet?: boolean } = {},
  ) {
    const Icon = entry.icon;
    const active = isActiveRailEntry(pathname, entry);
    const count = counts[entry.id as keyof typeof counts];
    const label = wardNavCountLabel(entry.label, count);
    const compactLabel = COMPACT_LABELS[entry.id] ?? entry.label;
    const abbreviated = compactLabel !== entry.label;
    const showClosedRailCard = !options.sheet && !open && isClosedRailCardViewport;
    const hoverCard = count ? `${entry.label} · ${count.value}\n${sentenceStart(count.noun)}` : entry.label;
    const link = (
      <Link
        ref={options.firstInSheet ? firstMoreLinkRef : undefined}
        href={entry.href}
        className={styles.railLink}
        data-active={active ? "true" : undefined}
        data-two-line={count ? "true" : undefined}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        title={showClosedRailCard ? undefined : label}
        data-testid="ward-rail-link"
        onClick={() => {
          announceToWardShell(active ? `${entry.label}. This is the screen you are on.` : `${entry.label}.`);
          if (options.sheet) setMoreOpen(false);
        }}
      >
        <Icon aria-hidden="true" className={styles.railGlyph} strokeWidth={1.75} />
        <span className={styles.railText}>
          <span className={styles.railLine}>
            <span className={styles.railLabel}>
              <span className={abbreviated ? styles.expandedLabel : undefined}>{entry.label}</span>
              {abbreviated ? (
                <span className={styles.compactLabel} aria-hidden="true">
                  {compactLabel}
                </span>
              ) : null}
            </span>
            {count ? (
              <span className={styles.tag} data-tone={count.urgent ? "warning" : undefined}>
                {count.urgent ? <Dot tone="warning" className={styles.tagDot} /> : null}
                {count.value}
              </span>
            ) : null}
          </span>
          {count ? <small className={styles.railState}>{count.noun}</small> : null}
        </span>
        {options.sheet ? <ChevronRight aria-hidden="true" className={styles.sheetChevron} /> : null}
      </Link>
    );
    return (
      <li key={entry.id} className={options.compactExtra ? styles.compactExtra : undefined}>
        <Tooltip
          content={hoverCard}
          placement="right"
          presentationOnly
          disabled={!showClosedRailCard}
          wrapperClassName={styles.railTooltipTrigger}
          className={styles.railFlyCard}
        >
          {link}
        </Tooltip>
      </li>
    );
  }

  function renderBedAlertRows(variant: "card" | "sheet") {
    return (
      <>
        <span className={styles.alertRow}>
          <span className={styles.alertRowName}>Metro</span>{" "}
          {metroPercent === null ? (
            <span className={styles.meter} aria-hidden="true" />
          ) : (
            <BedAlertMeter percent={metroPercent} />
          )}
          <span className={styles.alertRowPercent}>
            {variant === "sheet" && metroPercent !== null ? (
              <Dot tone={isBedAlert(metroPercent) ? "warning" : "neutral"} />
            ) : null}
            {metroPercent === null ? "—" : formatOccupancyPercent(metroPercent)}
          </span>
        </span>
        {hottest ? (
          <span className={styles.alertRow}>
            <span className={styles.alertRowName}>{hottest.shortName}</span>{" "}
            <BedAlertMeter percent={hottest.occupancyPercent} />
            <span className={styles.alertRowPercent}>
              {variant === "sheet" ? <Dot tone={isBedAlert(hottest.occupancyPercent) ? "warning" : "neutral"} /> : null}
              {formatOccupancyPercent(hottest.occupancyPercent)}
            </span>
          </span>
        ) : null}
      </>
    );
  }

  return (
    <nav
      className={styles.rail}
      data-rail={open ? "open" : "closed"}
      aria-label="Ward Flow sections"
      data-testid="ward-rail"
    >
      <div className={styles.brand}>
        <Link
          href={WARD_HOME_HREF}
          className={styles.brandLink}
          aria-label="Ward Flow home"
          title="Ward Flow Western Australia"
        >
          <span className={styles.brandEmblem} aria-hidden="true">
            <Plus className={styles.emblemGlyph} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className={styles.brandTitle}>Ward Flow</span>
          <span className={styles.brandStateText}>WA</span>
        </Link>
        <button
          type="button"
          className={`${styles.moreTrigger} ${styles.mobileMenu}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="ward-rail-more-pages"
          onClick={(event) => openMore(event.currentTarget)}
        >
          <Menu aria-hidden="true" size={18} strokeWidth={1.75} />
          Menu
        </button>
        <button
          type="button"
          ref={toggleRef}
          className={styles.railToggle}
          aria-label={open ? "Close" : "Open"}
          data-testid="ward-rail-toggle"
          onClick={() => setOpen(!open)}
          title={
            open
              ? "Close the rail to a strip. The bracket key [ does the same."
              : "Open the rail. The bracket key [ does the same."
          }
        >
          {open ? (
            <ChevronLeft aria-hidden="true" className={styles.toggleIcon} strokeWidth={1.75} />
          ) : (
            <PanelLeftOpen aria-hidden="true" className={styles.toggleIcon} strokeWidth={1.75} />
          )}
          <span className={styles.toggleText}>
            {open ? "Close" : "Open"}
            <span aria-hidden="true"> the rail</span>
          </span>
          <kbd aria-hidden="true" className={styles.toggleKey}>
            [
          </kbd>
        </button>
      </div>

      {service ? (
        <p className={styles.serviceLine} data-testid="ward-rail-service">
          <span
            className={styles.serviceDot}
            data-service={SERVICE_SWATCH_KEY[service]}
            data-testid="ward-rail-service-dot"
            aria-hidden="true"
          />
          {open ? `Service: ${service}` : SERVICE_SHORT_LABEL[service]}
        </p>
      ) : null}

      <div className={styles.shiftCockpit}>
        <div
          className={styles.shiftCockpitTop}
          title={`Board time ${boardClock} AWST. Shift ${shiftProgress.percent}% through. Shift times are ${OPERATIONAL_DEFAULT_LABEL}`}
        >
          <span className={styles.shiftAvatar} aria-hidden="true">
            BC
          </span>
          <span className={styles.shiftMeta}>
            <span className={styles.shiftTitle}>
              {shiftProgress.shiftName}
              <span className={styles.shiftHours}>{shiftProgress.shiftHours}</span>
            </span>
            <span className={styles.shiftSub} title="Dr S. Chen · Bed coordinator">
              Dr S. Chen · Bed coordinator
            </span>
          </span>
        </div>
        <div
          className={styles.shiftLiveClockRow}
          title={`Board time ${boardClock} AWST`}
          aria-label={`Board time ${boardClock} AWST`}
        >
          <span className={styles.liveClockDot} aria-hidden="true" />
          <span className={styles.shiftLiveClockLabel}>Board time</span>
          <span className={styles.shiftLiveClockTime}>{boardClock}</span>
          <span className={styles.shiftLiveTz}>AWST</span>
        </div>
        <Link
          href={handoverHref()}
          className={styles.shiftTimerLink}
          title="Open shift handover board"
          aria-label={`Handover countdown: ${shiftProgress.countdownStr}. Open shift handover board.`}
        >
          <ClipboardList aria-hidden="true" className={styles.shiftClockIcon} strokeWidth={1.75} />
          <span className={styles.shiftTimerLabel}>Handover</span>
          <span className={styles.shiftTimeBadge}>
            {handoverText === null ? (
              "due now"
            ) : (
              <>
                <span className={styles.shiftTimeUnit}>in</span> {handoverText}
              </>
            )}
          </span>
        </Link>
      </div>

      {hottest ? (
        <div className={styles.alertsContainer} ref={alertsRef}>
          {/* Closed-rail capacity control: the Metro figure in a small tile; click opens the list. */}
          <button
            type="button"
            className={styles.compactAlertPip}
            data-alert={alertCount > 0 ? "true" : undefined}
            data-testid="ward-rail-compact-alert-pip"
            title={`Bed alerts: ${alertCountLabel}. ${metroLabel}. ${hottestLabel}`}
            aria-label={`Bed alerts: ${alertCountLabel}. ${metroLabel}. ${hottestLabel}`}
            aria-expanded={alertsOpen}
            aria-haspopup="dialog"
            onClick={() => {
              const nextOpen = !alertsOpen;
              setAlertsOpen(nextOpen);
              if (nextOpen) {
                const message = `Bed alerts: ${alertCountLabel}. ${metroLabel}. ${hottestLabel}.`;
                setCapacityToast(message);
                announceToWardShell(message);
                if (capacityToastTimerRef.current) clearTimeout(capacityToastTimerRef.current);
                capacityToastTimerRef.current = setTimeout(() => setCapacityToast(null), 2600);
              }
            }}
          >
            {alertCount > 0 ? <Dot tone="warning" /> : null}
            <span className={styles.compactAlertVal}>
              {metroPercent === null ? "—" : `${Math.round(metroPercent)}%`}
            </span>
          </button>

          <button
            type="button"
            className={styles.capacityPulseStrip}
            data-open={alertsOpen ? "true" : undefined}
            data-testid="ward-rail-capacity-alerts-trigger"
            title={`Bed alerts. Metro and ${hottest.shortName} occupancy against ${BED_ALERT_THRESHOLD_PERCENT}%.`}
            aria-expanded={alertsOpen}
            aria-haspopup="dialog"
            onClick={() => setAlertsOpen((prev) => !prev)}
          >
            <span className={styles.alertsHead}>
              <span className={styles.alertsEyebrow}>Bed alerts</span>{" "}
              <span className={styles.alertsChip} data-alert={alertCount > 0 ? "true" : undefined}>
                {alertCount > 0 ? <Dot tone="warning" /> : null}
                {alertCountLabel}
              </span>{" "}
              <span className={styles.capacityChevron} data-open={alertsOpen ? "true" : undefined}>
                <ChevronDown aria-hidden="true" strokeWidth={1.75} />
              </span>
            </span>
            {renderBedAlertRows("card")}
          </button>

          {alertsOpen ? (
            <div className={styles.capacityAlertsDropdown} role="dialog" aria-label="Bed alerts">
              <div className={styles.alertsDropdownHeader}>
                <div>
                  <strong className={styles.alertsDropdownTitle}>Bed alerts</strong>
                  <p className={styles.alertsDropdownSub}>
                    {bedAlerts.services.length} health {bedAlerts.services.length === 1 ? "service" : "services"}
                  </p>
                </div>
                <span className={styles.alertsTotalBadge} data-testid="ward-rail-bed-alerts-free">
                  <span className={styles.alertsTotalValue}>{bedAlerts.totalFreeBeds}</span> unoccupied beds
                </span>
              </div>

              <div className={styles.alertsList}>
                {servicesByOccupancy.map((svc, index) => {
                  const atRisk = isBedAlert(svc.occupancyPercent);
                  const waiting = svc.edSummary?.totalWaiting ?? 0;
                  return (
                    <Link
                      key={svc.id}
                      href={WARD_CAPACITY_HREF}
                      className={styles.alertCard}
                      data-hot={index === 0 && atRisk ? "true" : undefined}
                      data-testid="ward-rail-bed-alert-row"
                      onClick={() => setAlertsOpen(false)}
                    >
                      <span className={styles.alertServiceName}>{svc.shortName}</span>
                      <span className={styles.alertMetrics}>
                        <BedAlertMeter percent={svc.occupancyPercent} />
                        <span className={styles.alertPercent}>
                          <Dot tone={atRisk ? "warning" : "neutral"} />
                          {formatOccupancyPercent(svc.occupancyPercent)}
                        </span>
                      </span>
                      <span className={styles.alertFacts}>
                        <span
                          className={styles.alertHospitalCodes}
                          aria-label={
                            svc.hospitalCodes && svc.hospitalCodes.length > 0
                              ? `Hospital codes: ${svc.hospitalCodes.join(", ")}`
                              : undefined
                          }
                        >
                          {bedAlertSiteLabel(svc)}
                        </span>
                        <span className={styles.alertBeds}>
                          {svc.freeBeds} of {svc.totalBeds} free
                          {waiting > 0 ? ` · ED ${waiting} waiting` : ""}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className={styles.alertsDropdownFoot}>
                <span className={styles.alertsLegend}>
                  <Dot tone="warning" />
                  {BED_ALERT_THRESHOLD_PERCENT}% and over
                </span>
                <Link href={WARD_CAPACITY_HREF} className={styles.alertsOpenLink} onClick={() => setAlertsOpen(false)}>
                  Open Capacity
                  <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.railScroll}>
        <div className={styles.railActionBox}>
          <button
            type="button"
            data-testid="ward-rail-referral-trigger"
            className={styles.btnRailReferral}
            title="Start a new referral"
            onClick={() => {
              openWardDrawer("referral");
              announceToWardShell("Opening the new referral drawer.");
            }}
          >
            <Plus aria-hidden="true" className={styles.btnRailReferralIcon} strokeWidth={1.75} />
            <span>New referral</span>
          </button>
        </div>

        <nav aria-label="Ward Flow views" className={styles.railNav}>
          {groups.map((group, groupIndex) => (
            <section key={group.label} aria-label={group.label} className={styles.railGroup}>
              <div className={styles.groupHead}>
                <p className={styles.eyebrow}>{group.label}</p>
                {groupIndex === 0 ? (
                  <button
                    type="button"
                    className={styles.allPagesTrigger}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                    aria-controls="ward-rail-more-pages"
                    onClick={(event) => openMore(event.currentTarget)}
                  >
                    <LayoutGrid aria-hidden="true" strokeWidth={1.75} />
                    All pages
                  </button>
                ) : null}
              </div>
              <ul className={styles.railList}>
                {group.entries.map((entry) => renderEntry(entry, { compactExtra: !compactPrimaryIds.has(entry.id) }))}
              </ul>
            </section>
          ))}
        </nav>
      </div>

      {capacityToast ? (
        <div className={styles.capacityToast} role="status" data-testid="ward-rail-capacity-toast">
          {capacityToast}
        </div>
      ) : null}

      <div className={styles.railFoot}>
        <div className={styles.utilityLinks}>
          <div className={styles.appearanceWrap} ref={appearanceRef}>
            <div
              className={`night ${styles.appearancePopover}`}
              role="group"
              aria-label="Appearance"
              data-open={appearanceOpen ? "true" : undefined}
            >
              <div className={styles.appearancePopoverHead}>
                <SunMoon aria-hidden="true" className={styles.appearancePopoverIcon} strokeWidth={1.75} />
                <span>Theme</span>
              </div>
              <div className={styles.appearancePills}>
                {APPEARANCE_CHOICES.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    aria-pressed={appearance === choice.id}
                    onClick={() => {
                      applyAppearance(choice.id);
                      announceToWardShell(`Appearance set to ${choice.id}.`);
                    }}
                    className={styles.appearancePillBtn}
                  >
                    <span className={styles.appearancePreview} aria-hidden="true">
                      {choice.id === "auto" ? (
                        <>
                          <span className={`day ${styles.previewPane}`} />
                          <span className={`night ${styles.previewPane}`} />
                        </>
                      ) : (
                        <span className={`${choice.id === "dark" ? "night" : "day"} ${styles.previewPane}`} />
                      )}
                    </span>
                    <span className={styles.appearanceChoice}>
                      <span className={styles.appearanceRadio} aria-hidden="true" />
                      {choice.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={styles.utilityLink}
              aria-label="Appearance"
              title="Appearance"
              aria-expanded={appearanceOpen}
              onClick={() => setAppearanceOpen((prev) => !prev)}
              data-testid="ward-rail-appearance-toggle"
            >
              <SunMoon aria-hidden="true" strokeWidth={1.75} />
              <span>Appearance</span>
            </button>
          </div>

          <Link
            href={settingsHref()}
            className={styles.utilityLink}
            aria-label="Settings"
            title="Settings"
            data-testid="ward-rail-settings-link"
          >
            <Settings aria-hidden="true" strokeWidth={1.75} />
            <span>Settings</span>
          </Link>
        </div>

        <div ref={userCardRef} className={styles.userCardWrap}>
          <button
            type="button"
            data-testid="ward-rail-persona-trigger"
            className={`${styles.userProfileCard} ${styles.userProfileCardBtn}`}
            onClick={() => setRoleSwitcherOpen((prev) => !prev)}
            aria-expanded={roleSwitcherOpen}
            aria-haspopup="listbox"
            aria-label={`${currentPersona.name}, ${currentPersona.role}. Switch persona.`}
            title={`${currentPersona.name} · ${currentPersona.role}`}
          >
            <span className={styles.userAvatar}>{currentPersona.initials}</span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{currentPersona.name}</span>
              <span className={styles.userRole}>{currentPersona.role}</span>
            </span>
            <ChevronDown aria-hidden="true" className={styles.userChevron} strokeWidth={1.75} />
          </button>
          <div
            className={styles.roleSwitcherPopover}
            data-testid="ward-rail-persona-popover"
            data-show={roleSwitcherOpen ? "true" : undefined}
          >
            <p className={styles.roleSwitcherHead}>Switch persona</p>
            <div role="listbox" aria-label="Switch clinical persona" className={styles.roleSwitcherList}>
              {CLINICAL_PERSONAS.map((p) => {
                const selected = p.id === activePersona;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={styles.roleOption}
                    onClick={() => {
                      setActivePersona(p.id);
                      setRoleSwitcherOpen(false);
                      announceToWardShell(`Switched persona to ${p.name}, ${p.role}.`);
                    }}
                  >
                    <span className={styles.roleOptAvatar}>{p.initials}</span>
                    <span className={styles.roleOptInfo}>
                      <span className={styles.roleOptName}>{p.name}</span>
                      <span className={styles.roleOptTitle}>{p.role}</span>
                    </span>
                    {selected ? <Check aria-hidden="true" className={styles.roleOptCheck} strokeWidth={2} /> : null}
                  </button>
                );
              })}
            </div>
            <p className={styles.roleSwitcherFoot}>
              <span>Demo personas, synthetic</span>
              <kbd aria-hidden="true">Esc</kbd>
            </p>
          </div>
        </div>

        <div className={styles.railPolicyFoot}>
          <Link href={GOVERNANCE_HREF} className={styles.railPolicyLink} title="Clinical governance and policy">
            Policy 2026.3
          </Link>
        </div>
      </div>
      <Sheet
        id="ward-rail-more-pages"
        testId="ward-rail-more-pages"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Ward Flow navigation"
        description="Every workspace and your shift"
        placement="right"
        initialFocusRef={firstMoreLinkRef}
        returnFocusRef={moreTriggerRef}
        headerLeading={
          <span className={styles.sheetMark} aria-hidden="true">
            <LayoutGrid strokeWidth={1.75} aria-hidden="true" />
          </span>
        }
        headerClassName={styles.moreSheetHeader}
        contentClassName={styles.moreSheet}
        bodyClassName={styles.moreSheetBody}
        footerClassName={styles.moreSheetFoot}
        footer={
          <>
            <span>Synthetic prototype</span>
            <Link href={GOVERNANCE_HREF} className={styles.moreSheetPolicy} onClick={() => setMoreOpen(false)}>
              Policy 2026.3
            </Link>
          </>
        }
      >
        <div className={styles.menuContext}>
          <p className={styles.menuContextCell}>
            <span className={styles.menuContextLabel}>Board time</span>
            <span className={styles.menuContextValue}>
              <strong>{boardClock}</strong> AWST
            </span>
          </p>
          <Link
            href={handoverHref()}
            className={`${styles.menuContextCell} ${styles.menuContextLink}`}
            onClick={() => setMoreOpen(false)}
          >
            <span className={styles.menuContextLabel}>Handover</span>
            <span className={styles.menuContextValue}>
              {handoverText === null ? (
                <strong>due now</strong>
              ) : (
                <>
                  in <strong>{handoverText}</strong>
                </>
              )}
            </span>
            <ChevronRight aria-hidden="true" className={styles.sheetChevron} />
          </Link>
        </div>
        {hottest ? (
          <Link href={WARD_CAPACITY_HREF} className={styles.sheetAlerts} onClick={() => setMoreOpen(false)}>
            <span className={styles.alertsHead}>
              <span className={styles.alertsEyebrow}>Bed alerts</span>{" "}
              <span className={styles.alertsChip} data-alert={alertCount > 0 ? "true" : undefined}>
                {alertCount > 0 ? <Dot tone="warning" /> : null}
                {alertCountLabel}
              </span>
            </span>
            {renderBedAlertRows("sheet")}
          </Link>
        ) : null}
        {groups.map((group) => {
          const remaining = group.entries;
          return remaining.length ? (
            <section key={group.label} aria-label={group.label}>
              <p className={styles.eyebrow}>{group.label}</p>
              <ul className={styles.moreList}>
                {remaining.map((entry) =>
                  renderEntry(entry, { sheet: true, firstInSheet: entry.id === groups[0]?.entries[0]?.id }),
                )}
              </ul>
            </section>
          ) : null;
        })}
        <div className={styles.sheetUtility}>
          {/* Phone only: the bar drops Activity and Tools under 48rem, so they live here. */}
          <button
            type="button"
            className={`${styles.sheetUtilityLink} ${styles.sheetPhoneOnly}`}
            data-testid="ward-rail-sheet-activity"
            onClick={() => {
              setMoreOpen(false);
              openWardDrawer("activity");
            }}
          >
            <RotateCcwClock aria-hidden="true" strokeWidth={1.75} />
            <span>Activity</span>
            <ChevronRight aria-hidden="true" className={styles.sheetChevron} />
          </button>
          <button
            type="button"
            className={`${styles.sheetUtilityLink} ${styles.sheetPhoneOnly}`}
            data-testid="ward-rail-sheet-tools"
            onClick={() => {
              setMoreOpen(false);
              openWardDrawer("tools");
            }}
          >
            <Wrench aria-hidden="true" strokeWidth={1.75} />
            <span>Tools</span>
            <ChevronRight aria-hidden="true" className={styles.sheetChevron} />
          </button>
          <Link href={settingsHref()} className={styles.sheetUtilityLink} onClick={() => setMoreOpen(false)}>
            <Settings aria-hidden="true" strokeWidth={1.75} />
            <span>Settings</span>
            <ChevronRight aria-hidden="true" className={styles.sheetChevron} />
          </Link>
        </div>
      </Sheet>
    </nav>
  );
}

export interface ShiftProgress {
  shiftTitle: string;
  /** "Day shift": the pattern's name in sentence case. */
  shiftName: string;
  /** "07:00–15:00": clock times, so colons are right here. */
  shiftHours: string;
  elapsedHours: number;
  elapsedMins: number;
  percent: number;
  /** Minutes until the shift ends. */
  remainingMinutes: number;
  /** True inside the last 15 minutes of the shift. */
  handoverDue: boolean;
  countdownStr: string;
  dashOffset: number;
}

/** "07:00" from a minute-of-day figure — used only to word `SHIFT_PATTERN`'s own entries. */
function formatMinuteOfDay(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Minutes from `from` to `to`, wrapping through midnight when `to` is earlier in the day. */
function minutesFrom(from: number, to: number): number {
  return (((to - from) % 1440) + 1440) % 1440;
}

export function computeShiftProgress(nowInput?: number | Date): ShiftProgress {
  const CIRCUMFERENCE = 81.68;

  let currentMinute: number;
  if (typeof nowInput === "number") {
    // Normalise minute of day 0..1439
    currentMinute = ((nowInput % 1440) + 1440) % 1440;
  } else {
    const d = nowInput instanceof Date ? nowInput : new Date();
    // AWST is UTC+8
    const awstHours = (d.getUTCHours() + 8) % 24;
    const awstMins = d.getUTCMinutes();
    currentMinute = awstHours * 60 + awstMins;
  }

  // The shift pattern itself (07:00/15:00/23:00) is a labelled default, not a legal roster rule —
  // owner ruling 26 September 2026 (decisions.md D-22) — read from `SHIFT_PATTERN`, never
  // hand-typed here, so the one figure and its three titles cannot drift apart.
  const shift =
    SHIFT_PATTERN.find(({ startMinute, endMinute }) =>
      endMinute <= startMinute
        ? currentMinute >= startMinute || currentMinute < endMinute
        : currentMinute >= startMinute && currentMinute < endMinute,
    ) ?? SHIFT_PATTERN[SHIFT_PATTERN.length - 1];

  const shiftHours = `${formatMinuteOfDay(shift.startMinute)}–${formatMinuteOfDay(shift.endMinute)}`;
  const shiftTitle = `${shift.name} (${shiftHours})`;
  const shiftName = shift.name.charAt(0) + shift.name.slice(1).toLowerCase();
  const shiftDuration = minutesFrom(shift.startMinute, shift.endMinute);
  const elapsedTotal = minutesFrom(shift.startMinute, currentMinute);
  const remainingTotal = shiftDuration - elapsedTotal;

  const elapsedHours = Math.floor(elapsedTotal / 60);
  const elapsedMins = elapsedTotal % 60;
  const percent = Math.min(100, Math.max(0, Math.round((elapsedTotal / shiftDuration) * 100)));
  const dashOffset = Number((CIRCUMFERENCE * (1 - percent / 100)).toFixed(2));
  const handoverDue = remainingTotal <= 15;

  let countdownStr: string;
  if (handoverDue) {
    countdownStr = "Handover Due";
  } else {
    const remainingHours = Math.floor(remainingTotal / 60);
    const remainingRemMins = remainingTotal % 60;
    countdownStr = remainingHours > 0 ? `${remainingHours}h ${remainingRemMins}m` : `${remainingRemMins}m`;
  }

  return {
    shiftTitle,
    shiftName,
    shiftHours,
    elapsedHours,
    elapsedMins,
    percent,
    remainingMinutes: remainingTotal,
    handoverDue,
    countdownStr,
    dashOffset,
  };
}
