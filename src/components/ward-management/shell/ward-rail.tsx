"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Menu, Plus, Settings, SunMoon } from "lucide-react";

import { Sheet } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
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
import { useWardChecks } from "./ward-checks";
import { edHref, handoverHref, patientHref, settingsHref } from "./ward-facade";
import { WardReconciliationLine } from "./ward-reconciliation-line";
import { deriveServiceBedAlerts } from "./ward-service-bed-alerts";
import { useServiceScope } from "./ward-service-store";
import { openWardDrawer, closeWardDrawer } from "./ward-drawer-bus";
import styles from "./ward-rail.module.css";

export type { ServiceBedAlert } from "./ward-service-bed-alerts";

/**
 * Ward Flow's third-edition rail (`docs/ward-flow/plans/2026-09-10-third-edition-build-master-
 * plan.md` §1.3, item 1.1). Ported from `docs/ward-flow/mockups/command-third-edition.html`'s
 * shell script (`renderRail`, `railLink`, `setRail`) and the standard's §7.7 and §8.1–§8.7 — see
 * that file's own header for what markup and behaviour every one of the sixteen mockups shares.
 *
 * **MOUNTED, Task 8, 2026-09-11.** `src/app/mockups/ward-flow/layout.tsx` mounts this once, inside
 * a flex row it composes for the purpose (`ward-flow-layout.module.css`'s `.shellRow`), in place
 * of the per-screen navigation mounts this component supersedes — that layout's own doc comment
 * carries the rest of the reasoning. This component still assumes no particular host beyond
 * `WardFlowProvider` (for `useWardNavCounts`) and a Next.js router context (for
 * `usePathname`/`Link`), which is what let it be built and tested (`tests/ward-shell-third-
 * edition.dom.test.tsx`) before that mount existed.
 *
 * ⚠️ **THE RAIL'S BRASS "YOU ARE HERE" BAR IS DELIBERATELY ABSENT** — owner ruling Q-11
 * (2026-09-10), under the no-edge-bars standard already in force elsewhere in this project
 * (`docs/ward-flow/owner-decisions-2026-09-1x.md`, "no edge bars, no top highlight"). The
 * drawing's own `.railLink[aria-current="page"]::before` draws a brass bar down the active item's
 * leading edge; this build marks the active item with the standard's "selection is a ring" rule
 * instead (§7.1's Selected row: "Accent-soft fill, accent-ink text... and the accent ring on a
 * card") — a fill plus a focus-weight ring, no bar on any edge. The brand stripe survives (it is
 * a mark, not a state, per the same ruling) but is page-level chrome (a `body::before` in the
 * drawing, `z-index: 45`, above every layer) rather than part of THIS component's own box — see
 * this file's closing comment for why it is left to the mounting task.
 *
 * ⚠️ **THE MOCKUP'S `.svcStripe` (A THIRD BAR, UNDER THE BRAND, TINTED BY THE CHOSEN SERVICE) IS
 * STILL OMITTED, but the fact it carried is not, since owner answer 52** (build plan
 * `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §3 "Rail (52)", task A3). The drawing's
 * own comment beside `.svcStripe` said exactly what a colour-only bar would lose: "One service
 * chosen is easy to forget" — true, and worth carrying, but not as a bar. `.svcStripe` was a
 * colour reflecting STATE (which service `ward-service-store.ts`'s `useServiceScope()` currently
 * holds), `aria-hidden` with no accompanying word of its own — exactly the shape the no-edge-bars
 * ruling and this project's "words before colour" rule (standard §8.1) both argue against.
 *
 * ✅ **So this build carries the SAME fact as a dot next to a WORD, never a bar on any edge.** Open,
 * it reads "Service: South Metro" in full; closed, the dot survives alone with the short form
 * ("North", "East", "South", "WACHS" or "Private") beside it — see `SERVICE_SWATCH_KEY` and
 * `SERVICE_SHORT_LABEL` below. **Under All services it renders nothing at all — no dot, no word —**
 * because there is no state to echo; a dot with no service behind it would be exactly the kind of
 * colour-only signal this file has already argued against once.
 */

const RAIL_OPEN_STORAGE_KEY = "ward-flow-rail";

// Item 52's swatch key, mirroring `ed.module.css`'s own `data-svc` attribute-selector convention
// (`.edWhere .svc[data-svc="east"]`) rather than an inline colour — the CSS stays the one place
// that names a token, so `tests/ward-css-token-references-resolve.test.ts` can still prove every
// `var()` this file paints with actually resolves. Private has no `--svc-private` token (build
// plan §1 "Item 52" notes this): `.serviceDot`'s own base rule is `var(--muted)`, and Private is
// simply the one key with no override rule beneath it, rather than a fifth token invented to fill
// a gap the build plan already named and left open.
const SERVICE_SWATCH_KEY: Record<HealthService, "north" | "south" | "east" | "wachs" | "cahs" | "private"> = {
  "North Metro": "north",
  "South Metro": "south",
  "East Metro": "east",
  WACHS: "wachs",
  CAHS: "cahs",
  Private: "private",
};

// The closed rail's short form (build plan §3 "Rail (52)": "North, East, South, WACHS or
// Private"). Metro is the only word ever dropped — WACHS and Private already are one word.
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
  // value other than the literal "closed" reads as open — never collapsed by default, the
  // opposite default from `useWardSidebarCollapsed` (the second-edition sidebar), which starts
  // collapsed. The two controls are unrelated and deliberately do not share a key or a default.
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
 * Exported for Lane D's Settings rail control (2026-09-12), together with `setRailOpenPreference`
 * below. These two are the ONLY writers of the rail preference, and that is the reason they are
 * shared rather than copied.
 *
 * 🔴 **HAVING THE RIGHT KEY IS NOT HAVING THE WRITER.** `setRailOpenPreference` dispatches
 * `ward-flow-rail-change`; a duplicate writer on the correct key that omits that dispatch moves the
 * rail on its own screen and leaves the rail itself stale until a reload — two controls disagreeing
 * inside one session, with the stored value correct underneath, and invisible to every gate this
 * repository has.
 *
 * ⚠️ **`RAIL_OPEN_STORAGE_KEY` STAYS PRIVATE, deliberately**, exactly as the appearance key does in
 * `ward-bar.tsx`. A two-keys catcher can only fail while the two sides spell the key independently;
 * exporting it would make that guard pass BY CONSTRUCTION. **The thing that makes the guard possible
 * is the thing not exported.**
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

// Visual abbreviations for the drawing's compact strip. Full registry names and live counts
// remain on the accessible link and its focus card; these never define destinations.
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
    role: "Triage Liaison Nurse",
  },
  {
    id: "vance",
    name: "K. Vance RN",
    initials: "KV",
    role: "Ward 4W Bed Coordinator",
  },
  {
    id: "robinson",
    name: "Dr J. Robinson",
    initials: "JR",
    role: "Consultant Psychiatrist",
  },
] as const;

export type WardRailProps = {
  /** An already-formatted clock reading, passed straight to `WardReconciliationLine`. */
  asAt?: string;
};

/**
 * 🔴 **THE `checks` PROP IS GONE — O-9, 2026-09-12.** It was required and `layout.tsx` passed `[]`
 * on every ward route, because a screen cannot hand anything to this component — it is rendered as
 * its SIBLING, not its child (see `ward-checks.ts`: the first version of that reasoning said
 * descendant and was wrong about the tree while right about the conclusion).
 * **The rail now reads the publication store directly**, so the screen currently on view is
 * the one whose checks it shows. ⚠️ **One source, not a prop the layout has to guess at.**
 */
export function WardRail({ asAt }: WardRailProps) {
  const publication = useWardChecks();
  const pathname = usePathname() ?? "";
  const { units, bedReleases, leaveBeds, movements, configuration } = useWardFlow();
  const now = useWardFlowClock();
  // The ">4h" count used a fixed 240 minutes until 25 Sept 2026; it now uses the configured target.
  const accessTargetMinutes = configuration.edAccessTargetMinutes;
  const accessTargetLabel = accessTargetMinutes % 60 === 0 ? `${accessTargetMinutes / 60}h` : `${accessTargetMinutes}m`;
  const bedAlerts = deriveServiceBedAlerts(units, bedReleases, undefined, movements, now, accessTargetMinutes);
  // leaveBeds is live capacity state; free-bed math uses openBedsNow (unit empty/allocatable + releases).
  void leaveBeds;
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

  const mostPressingAlert = bedAlerts.mostPressing;
  const metroLabel = bedAlerts.metroOccupancyPercent === null ? "Metro —" : `Metro ${bedAlerts.metroOccupancyPercent}%`;
  const metroPipLabel =
    bedAlerts.metroOccupancyPercent === null ? "—" : `${Math.round(bedAlerts.metroOccupancyPercent)}%`;
  const hottestOccupancyLabel = mostPressingAlert
    ? `${mostPressingAlert.shortName} ${mostPressingAlert.occupancyPercent}%`
    : "";

  const setOpen = useCallback((next: boolean) => {
    setRailOpenPreference(next);
    document.documentElement.setAttribute("data-rail", next ? "open" : "closed");
    announceToWardShell(next ? "The rail, open." : "The rail, closed.");
    // Standard §7.7: "moves focus to the new control" — the toggle stays the same element in
    // both shapes here (an icon-only button at every width), so this simply keeps it focused
    // rather than needing to hand off to a different node.
    toggleRef.current?.focus();
  }, []);

  // Keeps the root attribute in sync with the remembered preference on every mount and whenever
  // it changes elsewhere (another tab, the toggle below) — see the file header on why the
  // pre-paint head-script stamp itself (avoiding a first-paint width jump) is the mounting task's
  // job, not this component's: a component effect can only run after React has already committed
  // a DOM in the DEFAULT (open) shape.
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
    // Never render an empty landmark — see this file's own catcher (assertion 7, the anti-vacuity
    // floor): a rail with nothing in it is a defect, not a smaller rail.
    return null;
  }

  // Role-aware ordering (fix for "per-role nav ordering is dead"): the rail's four groups mix
  // views, role screens and boards inside one group, so each entry is ranked by whichever of the
  // three role-order lists names it (`wardNavRoleRank`). An id no list names — and the whole
  // `coordinator` role — keeps its curated `RAIL_GROUPS` position, because `toSorted` is stable and
  // a `null` rank sorts last. Coordinator returns `null` for every id so its owner-approved curated
  // order is left untouched rather than re-sorted against `WARD_MODES`.
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
  // The existing viewport store has the same server and hydration snapshot. Narrow navigation
  // keeps the operational entry points plus the current route; the same Sheet holds the rest.
  const compactPrimaryIds = new Set(isClosedRailCardViewport ? COMPACT_CORE_ENTRY_IDS : NARROW_CORE_ENTRY_IDS);
  if (activeEntry) compactPrimaryIds.add(activeEntry.id);

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
    const link = (
      <Link
        ref={options.firstInSheet ? firstMoreLinkRef : undefined}
        href={entry.href}
        className={styles.railLink}
        data-active={active ? "true" : undefined}
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
          <span>
            <span className={abbreviated ? styles.expandedLabel : undefined}>{entry.label}</span>
            {abbreviated ? (
              <span className={styles.compactLabel} aria-hidden="true">
                {compactLabel}
              </span>
            ) : null}
          </span>
          {count ? <small className={styles.railState}>{count.noun}</small> : null}
          {count ? <span className={styles.tag}>{count.value}</span> : null}
        </span>
      </Link>
    );
    return (
      <li key={entry.id} className={options.compactExtra ? styles.compactExtra : undefined}>
        <Tooltip
          content={label}
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
          <div className={styles.brandEmblem} title="Ward Flow Western Australia">
            <svg viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="8" fill="var(--accent)" />
              <path d="M14 8.25v11.5M8.25 14h11.5" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className={styles.brandTitle}>
            <b>Ward Flow</b> <span className={styles.brandStateText}>WA</span>
          </span>
        </Link>
        <span className={styles.brandBadge}>2026.3</span>
        <button
          type="button"
          className={`${styles.moreTrigger} ${styles.mobileMenu}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="ward-rail-more-pages"
          onClick={(event) => {
            moreTriggerRef.current = event.currentTarget;
            setMoreOpen(true);
          }}
        >
          <Menu aria-hidden="true" size={18} />
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
            <ChevronLeft aria-hidden="true" className={styles.toggleIcon} />
          ) : (
            <ChevronRight aria-hidden="true" className={styles.toggleIcon} />
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
        <div className={styles.shiftCockpitTop}>
          <div
            className={styles.shiftRingWrap}
            title={`Board time: ${boardClock} AWST · Shift completion: ${shiftProgress.percent}% (${shiftProgress.elapsedHours}h ${shiftProgress.elapsedMins}m elapsed) · Shift times are ${OPERATIONAL_DEFAULT_LABEL}`}
          >
            <svg viewBox="0 0 32 32" className={styles.shiftRingSvg}>
              <circle className={styles.shiftRingBg} cx="16" cy="16" r="13" />
              <circle
                className={styles.shiftRingVal}
                cx="16"
                cy="16"
                r="13"
                style={{ strokeDashoffset: shiftProgress.dashOffset }}
              />
            </svg>
            <div className={styles.shiftRingIcon}>BC</div>
          </div>
          <div className={styles.shiftMeta}>
            <span className={styles.shiftTitle}>{shiftProgress.shiftTitle}</span>
            <span className={styles.shiftSub} title="Dr S. Chen · Bed coordinator">
              Dr S. Chen · Bed coordinator
            </span>
          </div>
        </div>
        <div
          className={styles.shiftLiveClockRow}
          title={`Board time ${boardClock} AWST`}
          aria-label={`Board time ${boardClock} AWST`}
        >
          <span className={styles.shiftLiveClockLabel}>
            <span className={styles.liveClockDot} aria-hidden="true" />
            <span>Board time</span>
          </span>
          <span className={styles.shiftLiveClockTime}>
            {boardClock} <span className={styles.shiftLiveTz}>AWST</span>
          </span>
        </div>
        <Link
          href={handoverHref()}
          className={styles.shiftTimerLink}
          title="Open shift handover board"
          aria-label={`Handover countdown: ${shiftProgress.countdownStr}. Open shift handover board.`}
        >
          <span className={styles.shiftTimerLabel}>Handover</span>
          <span className={styles.shiftTimeBadge}>
            <Clock aria-hidden="true" className={styles.shiftClockIcon} />
            <span>{shiftProgress.countdownStr}</span>
          </span>
        </Link>
      </div>

      {mostPressingAlert ? (
        <div className={styles.alertsContainer} ref={alertsRef}>
          {/* Antigravity compactAlertPip (2664b44ea9): closed-rail capacity control; click → dropdown/toast. */}
          <button
            type="button"
            className={styles.compactAlertPip}
            data-code={mostPressingAlert.code}
            data-testid="ward-rail-compact-alert-pip"
            title={`Bed alerts: ${metroLabel}. ${hottestOccupancyLabel} · ${mostPressingAlert.freeBeds} unoccupied`}
            aria-label={`Bed alerts: ${metroLabel}. ${hottestOccupancyLabel} · ${mostPressingAlert.freeBeds} unoccupied`}
            aria-expanded={alertsOpen}
            aria-haspopup="dialog"
            onClick={() => {
              const nextOpen = !alertsOpen;
              setAlertsOpen(nextOpen);
              if (nextOpen) {
                const message = `Metro occupancy ${
                  bedAlerts.metroOccupancyPercent === null ? "—" : `${bedAlerts.metroOccupancyPercent}%`
                }. ${hottestOccupancyLabel} · ${mostPressingAlert.freeBeds} unoccupied.`;
                setCapacityToast(message);
                announceToWardShell(message);
                if (capacityToastTimerRef.current) clearTimeout(capacityToastTimerRef.current);
                capacityToastTimerRef.current = setTimeout(() => setCapacityToast(null), 2600);
              }
            }}
          >
            <span className={styles.pulseDot} data-code={mostPressingAlert.code} aria-hidden="true" />
            <span className={styles.compactAlertVal}>{metroPipLabel}</span>
          </button>

          <button
            type="button"
            className={styles.capacityPulseStrip}
            data-code={mostPressingAlert.code}
            data-testid="ward-rail-capacity-alerts-trigger"
            title={`Bed alerts. Metro occupancy vs ${mostPressingAlert.shortName} occupancy.`}
            aria-expanded={alertsOpen}
            aria-haspopup="dialog"
            onClick={() => setAlertsOpen((prev) => !prev)}
          >
            <div className={styles.capacityPulseLeft}>
              <span className={styles.pulseDot} data-code={mostPressingAlert.code} aria-hidden="true" />
              <span className={styles.capacityPulsePair}>
                <span className={styles.capacityPulseLabel}>
                  <span className={styles.capacityPulseKind}>Metro </span>
                  {bedAlerts.metroOccupancyPercent === null ? "—" : `${bedAlerts.metroOccupancyPercent}%`}
                </span>
                <span className={styles.capacityPulseLabel}>
                  <span className={styles.capacityPulseKind}>{mostPressingAlert.shortName} </span>
                  {mostPressingAlert.occupancyPercent}%
                </span>
              </span>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={styles.capacityChevron}
              data-open={alertsOpen ? "true" : undefined}
            />
          </button>

          {alertsOpen ? (
            <div className={styles.capacityAlertsDropdown} role="dialog" aria-label="Bed alerts">
              <div className={styles.alertsDropdownHeader}>
                <div>
                  <strong className={styles.alertsDropdownTitle}>Bed alerts</strong>
                  <p className={styles.alertsDropdownSub}>Health services (demo)</p>
                </div>
                <span className={styles.alertsTotalBadge}>{bedAlerts.totalFreeBeds} Unoccupied Beds</span>
              </div>

              <div className={styles.alertsList}>
                {bedAlerts.services.map((svc) => (
                  <Link
                    key={svc.id}
                    href={WARD_CAPACITY_HREF}
                    className={styles.alertCard}
                    data-code={svc.code}
                    onClick={() => setAlertsOpen(false)}
                  >
                    <div className={styles.alertCardTop}>
                      <div>
                        <div className={styles.alertServiceNameRow}>
                          <strong className={styles.alertServiceName}>{svc.shortName}</strong>
                          {svc.hospitalCodes && svc.hospitalCodes.length > 0 ? (
                            <span
                              className={styles.alertHospitalCodes}
                              aria-label={`Hospital codes: ${svc.hospitalCodes.join(", ")}`}
                            >
                              {svc.hospitalCodes.join(" · ")}
                            </span>
                          ) : null}
                        </div>
                        <span className={styles.alertFacilities}>{svc.facilities}</span>
                      </div>
                      <span className={styles.alertCodeBadge} data-code={svc.code}>
                        {svc.codeLabel}
                      </span>
                    </div>
                    <div className={styles.alertWarningRow}>
                      <span className={styles.alertOccupancy}>
                        Occupancy <strong>{svc.occupancyPercent}%</strong>
                      </span>
                      <span className={styles.alertBeds}>
                        {svc.freeBeds} unoccupied ({svc.occupiedBeds}/{svc.totalBeds})
                      </span>
                      {svc.edSummary && svc.edSummary.totalWaiting > 0 ? (
                        <span
                          className={styles.alertEdTag}
                          data-code={svc.edSummary.warningLevel}
                          title={svc.edSummary.clinicalAdvisory}
                        >
                          ED wait: {svc.edSummary.totalWaiting}
                          {svc.edSummary.totalPastAccessTarget > 0
                            ? ` (${svc.edSummary.totalPastAccessTarget} >${accessTargetLabel})`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.alertEscalation}>{svc.escalation}</div>
                  </Link>
                ))}
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
            title="Raise an urgent clinical referral"
            onClick={() => {
              openWardDrawer("referral");
              announceToWardShell("Opening Urgent Clinical Referral Drawer.");
            }}
          >
            <Plus aria-hidden="true" className={styles.btnRailReferralIcon} />
            <span>New referral</span>
          </button>
        </div>

        <nav aria-label="Ward Flow views">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className={styles.railGroup}>
              <p className={styles.eyebrow}>{group.label}</p>
              <ul className={styles.railList}>
                {group.entries.map((entry) => renderEntry(entry, { compactExtra: !compactPrimaryIds.has(entry.id) }))}
              </ul>
            </section>
          ))}
        </nav>
        <div className={styles.mobileMore}>
          <button
            type="button"
            className={`${styles.moreTrigger} ${styles.allPagesTrigger}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls="ward-rail-more-pages"
            onClick={(event) => {
              moreTriggerRef.current = event.currentTarget;
              setMoreOpen(true);
            }}
          >
            All Pages
          </button>
        </div>
      </div>

      {capacityToast ? (
        <div className={styles.capacityToast} role="status" data-testid="ward-rail-capacity-toast">
          {capacityToast}
        </div>
      ) : null}

      {!moreOpen ? (
        <WardReconciliationLine publication={publication} asAt={asAt} compact={!open} className={styles.railCheck} />
      ) : null}

      <div className={styles.railFoot}>
        <div className={styles.utilityLinks}>
          <div className={styles.appearanceWrap} ref={appearanceRef}>
            <div
              className={styles.appearancePopover}
              role="group"
              aria-label="Appearance"
              data-open={appearanceOpen ? "true" : undefined}
            >
              <div className={styles.appearancePopoverHead}>
                <SunMoon aria-hidden="true" className={styles.appearancePopoverIcon} />
                <span>Theme</span>
              </div>
              <div className={styles.appearancePills}>
                {(["auto", "light", "dark"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={appearance === choice}
                    onClick={() => {
                      applyAppearance(choice);
                      announceToWardShell(`Appearance set to ${choice}.`);
                    }}
                    className={styles.appearancePillBtn}
                  >
                    {choice === "dark" ? "Dark" : choice === "light" ? "Light" : "Auto"}
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
            aria-label={`${currentPersona.name}, ${currentPersona.role}. Click to switch clinical persona.`}
            title={`${currentPersona.name} · ${currentPersona.role}`}
          >
            <div className={styles.userAvatar}>{currentPersona.initials}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{currentPersona.name}</span>
              <span className={styles.userRole}>{currentPersona.role}</span>
            </div>
            <ChevronDown aria-hidden="true" className={styles.userChevron} />
          </button>
          <div
            className={styles.roleSwitcherPopover}
            data-testid="ward-rail-persona-popover"
            data-show={roleSwitcherOpen ? "true" : undefined}
            role="listbox"
            aria-label="Switch clinical persona"
          >
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
                  <div className={styles.roleOptAvatar}>{p.initials}</div>
                  <div className={styles.roleOptInfo}>
                    <span className={styles.roleOptName}>{p.name}</span>
                    <span className={styles.roleOptTitle}>{p.role}</span>
                  </div>
                  {selected ? <Check aria-hidden="true" className={styles.roleOptCheck} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.railPolicyFoot}>
          <Link href={GOVERNANCE_HREF} className={styles.railPolicyLink} title="Clinical Governance & Policy">
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
        description="Choose a workspace or view your shift context."
        placement="right"
        initialFocusRef={firstMoreLinkRef}
        returnFocusRef={moreTriggerRef}
        contentClassName={styles.moreSheet}
        bodyClassName={styles.moreSheetBody}
      >
        <div className={styles.menuContext}>
          <p>
            Board time <strong>{boardClock} AWST</strong>
          </p>
          <Link href={handoverHref()} onClick={() => setMoreOpen(false)}>
            Handover · {shiftProgress.countdownStr}
          </Link>
          <WardReconciliationLine publication={publication} asAt={asAt} />
        </div>
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
      </Sheet>
    </nav>
  );
}

export interface ShiftProgress {
  shiftTitle: string;
  elapsedHours: number;
  elapsedMins: number;
  percent: number;
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

  const shiftTitle = `${shift.name} (${formatMinuteOfDay(shift.startMinute)}–${formatMinuteOfDay(shift.endMinute)})`;
  const shiftDuration = minutesFrom(shift.startMinute, shift.endMinute);
  const elapsedTotal = minutesFrom(shift.startMinute, currentMinute);
  const remainingTotal = shiftDuration - elapsedTotal;

  const elapsedHours = Math.floor(elapsedTotal / 60);
  const elapsedMins = elapsedTotal % 60;
  const percent = Math.min(100, Math.max(0, Math.round((elapsedTotal / shiftDuration) * 100)));
  const dashOffset = Number((CIRCUMFERENCE * (1 - percent / 100)).toFixed(2));

  let countdownStr: string;
  if (remainingTotal <= 15) {
    countdownStr = "Handover Due";
  } else {
    const remainingHours = Math.floor(remainingTotal / 60);
    const remainingRemMins = remainingTotal % 60;
    countdownStr = remainingHours > 0 ? `${remainingHours}h ${remainingRemMins}m` : `${remainingRemMins}m`;
  }

  return {
    shiftTitle,
    elapsedHours,
    elapsedMins,
    percent,
    countdownStr,
    dashOffset,
  };
}
