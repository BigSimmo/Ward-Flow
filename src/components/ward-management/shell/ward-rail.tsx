"use client";

import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Menu,
  PanelLeftOpen,
  Settings,
  SunMoon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Sheet } from "@/components/wf/sheet";
import { Tooltip } from "@/components/wf/tooltip";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal-lazy";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { useShellPersonaRole } from "@/components/ward-management/settings/persona-sync";
import { currentDeskId } from "@/components/ward-management/settings/workstation-desks";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { formatInstant, minuteOfDay } from "@/components/ward-management/ward-clock";
import { WardDemoClockPopover } from "@/components/ward-management/ward-demo-controls";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import { CHROME_ROLE_LABELS, wardChromeRole, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useWardFlowClock, useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import type { HealthService } from "@/components/ward-management/ward-model";
import { edById } from "@/components/ward-management/ward-sites";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";
import { wardNavCountLabel } from "@/components/ward-management/ward-nav-counts";
import { wardNavRoleRank } from "@/components/ward-management/ward-nav-role-order";
import { OPERATIONAL_DEFAULT_LABEL, SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import { Dot, SrOnly, durMinutes, useIsPhone } from "@/components/wf";
import { applyAppearance } from "./ward-bar";
import { closeWardDrawer, isPhoneViewport, subscribeWardMenu } from "./ward-drawer-bus";
import { handoverHref, settingsHref } from "./ward-facade";
import { announceToWardShell } from "./ward-live-region";
import styles from "./ward-rail.module.css";
import { readWardRailEarlyShape } from "./ward-rail-early";
import {
  isTypingTarget,
  openDrawerForShortcut,
  setRailOpenPreference,
  useWardDocumentPreferences,
} from "./ward-rail-preferences";
import {
  isActiveRailEntry,
  isRoleMenuAction,
  type RailEntry,
  railEntries,
  type RoleMenuAction,
  roleMenu,
} from "./ward-rail-entries";
import { useAccessNavFilter, useCanOpenHref, useDeskHomeHref } from "./ward-access";
import { useWardFeatureFlagCheck } from "./ward-feature-flag-store";
import {
  BED_ALERT_THRESHOLD_PERCENT,
  bedAlertSiteLabel,
  deriveServiceBedAlerts,
  formatOccupancyPercent,
  isBedAlert,
  type ServiceBedAlert,
  type ServiceBedAlertsSummary,
} from "./ward-service-bed-alerts";
import { useServiceScope } from "./ward-service-store";

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
 * - The rail carries no New referral (v10, Josh 10 Oct 2026): the header holds the one primary,
 *   and Shift+R still opens the referral slide-out from anywhere.
 * - Selection is a slate tint with a fine edge. No bar or stripe on any edge (owner ruling Q-11).
 * - Status markers are round: a filled amber circle at or over 85%, a neutral ring under it.
 *
 * The chosen service still shows as a dot next to a WORD, never a bar (owner answer 52): open, it
 * reads "Service: South Metro"; closed, the dot keeps the short form ("South"). Under All services
 * it renders nothing at all, because there is no state to echo.
 */

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

// The rail preference store moved to `./ward-rail-preferences` so a phone keeps it without the rail.
export { setRailOpenPreference, useRailOpenStore } from "./ward-rail-preferences";

/** At 1000px and below only the first few of the role's own menu stay in the row (plus the page you are on). */
const NARROW_CORE_ENTRY_COUNT = 3;
/** The role menu id of the handover board, which the countdown card also opens (A5). */
const HANDOVER_MENU_ID = "handover";

const CLOSED_RAIL_CARD_MEDIA_QUERY = "(min-width: 1001px)";
/**
 * Tablet landscape (v10 shell, "Landscape 1180"): the 64px icon rail whatever is stored, with the
 * role's own menu, then More, which opens the rest over the page (B1, 19 Oct 2026: every shape
 * shows the same short menu). Above 1200px the stored open or closed preference applies as before;
 * at 1000px and below the tablet portrait and phone shapes take over.
 */
export const TABLET_LANDSCAPE_RAIL_QUERY = "(min-width: 1001px) and (max-width: 1200px)";

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

const subscribeNever = () => () => {};
const hydratedSnapshot = () => true;
const notHydratedSnapshot = () => false;

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

function subscribeToTabletLandscape(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(TABLET_LANDSCAPE_RAIL_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getTabletLandscapeSnapshot() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(TABLET_LANDSCAPE_RAIL_QUERY).matches
  );
}

/** "at a time limit…" → "At a time limit…", for the closed rail's hover card. */
function sentenceStart(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

type DeskPersona = { readonly id: string; readonly name: string; readonly initials: string; readonly role: string };

/**
 * B6 (Josh, 19 Oct 2026): one switcher. The person on the rail follows the desk ("Go to a desk"
 * sets both the person and the place), so there is no separate persona list to fall out of step
 * with the menu. Demo personas, synthetic. A desk with no drawn persona shows its role alone.
 */
const DESK_PERSONAS: Record<WardChromeRole, DeskPersona> = {
  coordinator: { id: "chen", name: "Dr S. Chen", initials: "SC", role: "Bed coordinator" },
  ed: { id: "gallagher", name: "Sr M. Gallagher", initials: "MG", role: "Triage liaison nurse" },
  ward: { id: "vance", name: "K. Vance RN", initials: "KV", role: "Nurse in charge" },
  officer: { id: "okafor", name: "A. Okafor", initials: "AO", role: "Transport officer" },
  community: { id: "hart", name: "L. Hart", initials: "LH", role: "Community team clinician" },
  bed_manager: { id: "bed_manager", name: CHROME_ROLE_LABELS.bed_manager, initials: "BM", role: "Demo desk" },
  executive: { id: "executive", name: CHROME_ROLE_LABELS.executive, initials: "EX", role: "Demo desk" },
};

const APPEARANCE_CHOICES = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

/**
 * The desk a page belongs to, when it is not the person's own kind of desk: "Viewing RPH ED as Bed
 * coordinator". Null on the person's own kind of desk and on every network page. Place names only,
 * never a patient.
 */
function viewingDeskLine(
  pathname: string,
  personaRole: WardChromeRole,
  units: readonly { id: string; name: string }[],
  personaLabel: string,
): string | null {
  const pageRole = wardChromeRole(pathname);
  if (pageRole === "coordinator" || pageRole === personaRole) return null;
  const deskId = currentDeskId(pathname);
  const place =
    pageRole === "ed"
      ? `${(deskId ? edById(deskId)?.siteCode : undefined) ?? "this"} ED`
      : pageRole === "ward"
        ? (units.find((unit) => unit.id === deskId)?.name ?? "this ward")
        : pageRole === "officer"
          ? "the transport desk"
          : pageRole === "community"
            ? // PR #489 review: the team by name when its page names one; the index has none.
              ((deskId ? communityTeamById(deskId)?.name : undefined) ?? "a community team")
            : CHROME_ROLE_LABELS[pageRole];
  return `Viewing ${place} as ${personaLabel}`;
}

/**
 * Retained for the layout's existing call shape. The reconciliation line this used to feed is no
 * longer mounted in the rail (Josh, 7 October 2026), so the rail takes no props today.
 */
export type WardRailProps = {
  onOpenOperatorModal?: () => void;
};

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

/** The Ward Flow mark: a care cross whose right arm runs on as an arrow, for flow (8 October 2026). */
function WardFlowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3.5v13M3 10h13.5" />
      <path d="M13 6.5 16.5 10 13 13.5" />
    </svg>
  );
}

const NO_BED_ALERTS: ServiceBedAlertsSummary = {
  services: [],
  totalFreeBeds: 0,
  metroOccupancyPercent: null,
  statewideOccupancyPercent: null,
  mostPressing: null,
};

export function WardRail({ onOpenOperatorModal }: WardRailProps = {}) {
  const network = useWardNetwork();
  const pathname = usePathname() ?? "";
  const { units, bedReleases, movements, configuration, admissions } = useWardFlowSelect(
    "units",
    "bedReleases",
    "movements",
    "configuration",
    "admissions",
  );
  const now = useWardFlowClock();
  const accessTargetMinutes = configuration.edAccessTargetMinutes;
  const phone = useIsPhone();
  // A phone never draws the rail (below), so it skips the bed alert figures too.
  const bedAlerts = phone
    ? NO_BED_ALERTS
    : deriveServiceBedAlerts(units, bedReleases, network.sites, movements, now, accessTargetMinutes, admissions);
  // Nav order follows the signed-in person, not the route (device audit item 6).
  const { counts, shellRole: role } = useWardNavCounts();
  const { open, appearance } = useWardDocumentPreferences();
  const service = useServiceScope();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const firstMoreLinkRef = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // B1: the rail's More shows only the rest; the bar's Menu (tablet portrait, no rail) shows it all.
  const [sheetShowsMain, setSheetShowsMain] = useState(false);
  const [deskModalOpen, setDeskModalOpen] = useState(false);
  // The person using the shell: the desk a switch announced (persona sync), or with role access on,
  // the desk's own role. Shared with the desk picker so both name the same person.
  const personaRole = useShellPersonaRole();
  const [openOverlay, setOpenOverlay] = useState<"alerts" | "appearance" | null>(null);
  const appearanceOpen = openOverlay === "appearance";
  const alertsOpen = openOverlay === "alerts";
  const personaTriggerRef = useRef<HTMLButtonElement>(null);
  const appearanceTriggerRef = useRef<HTMLButtonElement>(null);
  const alertsTriggerRef = useRef<HTMLButtonElement>(null);
  const isClosedRailCardViewport = useSyncExternalStore(
    subscribeToClosedRailCards,
    getClosedRailCardsSnapshot,
    () => false,
  );
  const isTabletLandscape = useSyncExternalStore(subscribeToTabletLandscape, getTabletLandscapeSnapshot, () => false);
  // The shape drawn: the stored preference, except tablet landscape always draws the icon rail.
  const shownOpen = open && !isTabletLandscape;
  // Hydration only: the layout's early script may already have drawn the closed or tablet rail
  // (ward-rail-early.ts). Hydrating with its attributes keeps the page as painted; the render
  // after hydration uses the live values above, which agree with it.
  const hydrated = useSyncExternalStore(subscribeNever, hydratedSnapshot, notHydratedSnapshot);
  const earlyShape = hydrated ? null : readWardRailEarlyShape();
  const flagOn = useWardFeatureFlagCheck();
  // Role access plan: only the screens the desk's role may open, own place first.
  const accessNav = useAccessNavFilter();
  const entries = accessNav(railEntries(flagOn));
  // DA-09: chrome links outside the menu use the same role filter, and the brand opens this desk's home.
  const canOpen = useCanOpenHref();
  const deskHome = useDeskHomeHref();
  // B6: the person follows the desk. A non-coordinator desk (role access on) is its own role.
  const currentPersona = DESK_PERSONAS[personaRole];
  // Overall review (20 Oct 2026): a desk page opened by its link keeps the person, their menu and
  // their Home, so the card says plainly whose desk is on screen and as whom it is being viewed.
  const viewing = viewingDeskLine(pathname, personaRole, units, currentPersona.role);
  const boardMinute = minuteOfDay(now);
  const boardClock = formatInstant(now);
  const shiftProgress = computeShiftProgress(boardMinute);
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
        // Phone (Josh, 10 Oct 2026): the bar's own phone menu answers instead (`ward-phone-menu.tsx`).
        if (isPhoneViewport()) return;
        moreTriggerRef.current = trigger;
        setSheetShowsMain(true);
        setMoreOpen(true);
      }),
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (openOverlay !== null) {
          // An open sheet sits above this popover, so Escape closes the sheet only. The popover waits
          // for the next press instead of both closing on one.
          if (hasOpenSheet()) return;
          event.preventDefault();
          const trigger = openOverlay === "appearance" ? appearanceTriggerRef.current : alertsTriggerRef.current;
          setOpenOverlay(null);
          trigger?.focus();
          return;
        }
        closeWardDrawer();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (openDrawerForShortcut(event)) return;

      if (event.key !== "[" || !areCharacterShortcutsEnabled()) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTabletLandscape) {
        moreTriggerRef.current = null;
        setSheetShowsMain(false);
        setMoreOpen(true);
        return;
      }
      setOpen(!open);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen, openOverlay, isTabletLandscape]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      setOpenOverlay((current) => {
        if (current === "appearance" && appearanceRef.current && !appearanceRef.current.contains(target)) {
          return null;
        }
        if (current === "alerts" && alertsRef.current && !alertsRef.current.contains(target)) {
          return null;
        }
        return current;
      });
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  if (entries.length === 0) {
    // Never render an empty landmark: a rail with nothing in it is a defect, not a smaller rail.
    return null;
  }

  // A phone never shows the rail (it is hidden under 48rem and the bar's Menu holds the navigation),
  // so it skips drawing it. The effects above still keep the theme and rail attributes in sync.
  // Drawing every link and tooltip only to hide them was a visible part of a phone's first load
  // (fix list 7.6, October 2026).
  if (phone) return null;

  // Role-aware ordering: each entry is ranked by whichever role-order list names it. An id no list
  // names, and the whole `coordinator` role, keeps its curated `RAIL_GROUPS` position.
  // B1 (Josh, 19 Oct 2026): the role's own short menu on the rail, everything else under More.
  const menu = roleMenu(entries, role, (id) => wardNavRoleRank(role, id) ?? Number.MAX_SAFE_INTEGER);
  const menuLabel = CHROME_ROLE_LABELS[role];
  const activeEntry = entries.find((entry) => isActiveRailEntry(pathname, entry));
  // A5 (overall review, 20 Oct 2026): Handover shows once. Where the countdown card above the menu
  // opens the handover board, the menu does not repeat it. On the rail that is CSS (the open rail
  // over 1200px, where the card shows), so the server's page and the early script's closed rail
  // agree; the icon rail hides the card and keeps its Handover icon. The Menu sheet leads with the
  // same countdown, so its copy of the menu leaves Handover out.
  const handoverCardLinks = canOpen(handoverHref());
  const withoutHandover = (items: (RailEntry | RoleMenuAction)[]) =>
    handoverCardLinks ? items.filter((item) => item.id !== HANDOVER_MENU_ID) : items;
  // Narrow navigation keeps the first few of the role's menu plus the current route; the same Sheet
  // holds the rest. Only the narrow CSS (1000px and below) hides the extras. This is the same at
  // every width, so the server render matches the browser's and the desktop rail does not grow on
  // load (13 Oct 2026: it used to depend on a width the server cannot know).
  const compactPrimaryIds = new Set(menu.main.slice(0, NARROW_CORE_ENTRY_COUNT).map((item) => item.id));
  if (activeEntry) compactPrimaryIds.add(activeEntry.id);
  // The rail's More holds the rest; the sheet also leads with the role's menu when the rail is hidden.
  // Every group in the sheet leaves Handover out under the sheet's countdown, More's groups too
  // (an ED desk keeps Handover under More).
  const sheetGroups = (sheetShowsMain ? [{ label: menuLabel, entries: menu.main }, ...menu.more] : menu.more).map(
    (group: { label: string; entries: readonly (RailEntry | RoleMenuAction)[] }) => ({
      label: group.label,
      entries: withoutHandover([...group.entries]),
    }),
  );
  const firstSheetId = sheetGroups[0]?.entries[0]?.id;
  const capacityOpen = canOpen(WARD_CAPACITY_HREF);
  const handoverCountdown = (
    <>
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
    </>
  );

  function openMore(trigger: HTMLButtonElement, withMain = false) {
    moreTriggerRef.current = trigger;
    setSheetShowsMain(withMain);
    setMoreOpen(true);
  }

  /** B1: the ED's Find a bed opens the Tools bed finder, which is not a page. */
  function renderAction(
    action: RoleMenuAction,
    options: { compactExtra?: boolean; sheet?: boolean; firstInSheet?: boolean } = {},
  ) {
    const Icon = action.icon;
    const showClosedRailCard = !options.sheet && !shownOpen && isClosedRailCardViewport;
    return (
      <li key={action.id} className={options.compactExtra ? styles.compactExtra : undefined}>
        <Tooltip
          content={action.label}
          placement="right"
          presentationOnly
          disabled={!showClosedRailCard}
          wrapperClassName={styles.railTooltipTrigger}
          className={styles.railFlyCard}
        >
          <button
            ref={options.firstInSheet ? firstMoreLinkRef : undefined}
            type="button"
            className={`${styles.railLink} ${styles.railButton}`}
            aria-haspopup="dialog"
            aria-label={action.label}
            title={showClosedRailCard ? undefined : action.label}
            data-testid="ward-rail-bed-finder"
            onClick={(event) => {
              if (options.sheet) setMoreOpen(false);
              requestToolsTool("bed-finder", event.currentTarget);
              announceToWardShell(`${action.label}.`);
            }}
          >
            <Icon aria-hidden="true" className={styles.railGlyph} strokeWidth={1.75} />
            <span className={styles.railText}>
              <span className={styles.railLine}>
                <span className={styles.railLabel}>{action.label}</span>
              </span>
            </span>
            {options.sheet ? <ChevronRight aria-hidden="true" className={styles.sheetChevron} /> : null}
          </button>
        </Tooltip>
      </li>
    );
  }

  function renderItem(
    item: RailEntry | RoleMenuAction,
    options: { compactExtra?: boolean; countdownTwin?: boolean; sheet?: boolean; firstInSheet?: boolean } = {},
  ) {
    return isRoleMenuAction(item) ? renderAction(item, options) : renderEntry(item, options);
  }

  function renderEntry(
    entry: RailEntry,
    options: {
      compactExtra?: boolean;
      /** A5: the Handover item the open rail's countdown card stands in for. */
      countdownTwin?: boolean;
      sheet?: boolean;
      firstInSheet?: boolean;
    } = {},
  ) {
    const Icon = entry.icon;
    const active = isActiveRailEntry(pathname, entry);
    const count = counts[entry.id as keyof typeof counts];
    const label = wardNavCountLabel(entry.label, count);
    const compactLabel = COMPACT_LABELS[entry.id] ?? entry.label;
    const abbreviated = compactLabel !== entry.label;
    const showClosedRailCard = !options.sheet && !shownOpen && isClosedRailCardViewport;
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
    const itemClass = [
      options.compactExtra ? styles.compactExtra : "",
      options.countdownTwin ? styles.countdownTwin : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <li
        key={entry.id}
        className={itemClass || undefined}
        data-countdown-twin={options.countdownTwin ? "true" : undefined}
      >
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

  function renderBedAlertRows() {
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
            {metroPercent !== null ? <Dot tone={isBedAlert(metroPercent) ? "warning" : "neutral"} /> : null}
            {metroPercent === null ? "—" : formatOccupancyPercent(metroPercent)}
          </span>
        </span>
        {hottest ? (
          <span className={styles.alertRow}>
            <span className={styles.alertRowName}>{hottest.shortName}</span>{" "}
            <BedAlertMeter percent={hottest.occupancyPercent} />
            <span className={styles.alertRowPercent}>
              <Dot tone={isBedAlert(hottest.occupancyPercent) ? "warning" : "neutral"} />
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
      data-rail={earlyShape ? earlyShape.rail : shownOpen ? "open" : "closed"}
      data-tablet={earlyShape ? (earlyShape.tablet ?? undefined) : isTabletLandscape ? "landscape" : undefined}
      aria-label="Ward Flow sections"
      data-testid="ward-rail"
    >
      <div className={styles.brand}>
        {/* Closed desktop strip (Josh, 8 October 2026): the mark opens the full rail. Everywhere
            else it stays the home link. */}
        {!shownOpen && isClosedRailCardViewport ? (
          <button
            type="button"
            className={styles.brandLink}
            aria-label="Ward Flow, open the menu"
            title="Open the menu"
            data-testid="ward-rail-brand-open"
            onClick={(event) => (isTabletLandscape ? openMore(event.currentTarget) : setOpen(true))}
          >
            <span className={styles.brandEmblem} aria-hidden="true">
              <WardFlowMark className={styles.emblemGlyph} />
            </span>
          </button>
        ) : (
          <Link
            href={deskHome}
            className={styles.brandLink}
            aria-label="Ward Flow WA — home"
            title="Ward Flow Western Australia"
          >
            <span className={styles.brandEmblem} aria-hidden="true">
              <WardFlowMark className={styles.emblemGlyph} />
            </span>
            <span className={styles.brandTitle}>Ward Flow</span>
            <span className={styles.brandStateText}>WA</span>
          </Link>
        )}
        <button
          type="button"
          className={`${styles.moreTrigger} ${styles.mobileMenu}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="ward-rail-more-pages"
          // B1: the narrow strip shows only the first few menu items, so its Menu opens the whole
          // role menu with More below it.
          onClick={(event) => openMore(event.currentTarget, true)}
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
          {shownOpen ? `Service: ${service}` : SERVICE_SHORT_LABEL[service]}
        </p>
      ) : null}

      <div className={styles.shiftCockpit}>
        <div
          className={styles.shiftCockpitTop}
          title={`Board time ${boardClock} AWST. Shift ${shiftProgress.percent}% through. Shift times are ${OPERATIONAL_DEFAULT_LABEL}`}
        >
          <span className={styles.shiftAvatar} aria-hidden="true">
            {currentPersona.initials}
          </span>
          <span className={styles.shiftMeta}>
            <span className={styles.shiftTitle}>
              {shiftProgress.shiftName}
              <span className={styles.shiftHours}>{shiftProgress.shiftHours}</span>
            </span>
            <span className={styles.shiftSub} title={`${currentPersona.name} · ${currentPersona.role}`}>
              {currentPersona.name} · {currentPersona.role}
            </span>
            {viewing ? (
              <span className={styles.shiftViewing} data-testid="ward-rail-viewing-desk">
                {viewing}
              </span>
            ) : null}
          </span>
        </div>
        <WardDemoClockPopover
          className={styles.shiftLiveClockRow}
          title={`Board time ${boardClock} AWST`}
          aria-label={`Board time ${boardClock} AWST`}
        >
          <span className={styles.liveClockDot} aria-hidden="true" />
          <span className={styles.shiftLiveClockLabel}>Board time</span>
          <span className={styles.shiftLiveClockTime}>{boardClock}</span>
          <span className={styles.shiftLiveTz}>AWST</span>
        </WardDemoClockPopover>
        {handoverCardLinks ? (
          <Link
            href={handoverHref()}
            className={styles.shiftTimerLink}
            title="Open shift handover board"
            aria-label={
              handoverText === null
                ? `Handover due now. Handover countdown: ${shiftProgress.countdownStr}. Open shift handover board.`
                : `Handover in ${handoverText}. Handover countdown: ${shiftProgress.countdownStr}. Open shift handover board.`
            }
          >
            {handoverCountdown}
          </Link>
        ) : (
          // DA-09: a desk without the handover board still sees the countdown, as plain text.
          <span className={styles.shiftTimerLink} data-static="true" data-testid="ward-rail-handover-countdown">
            {handoverCountdown}
          </span>
        )}
      </div>

      {hottest ? (
        <div className={styles.alertsContainer} ref={alertsRef}>
          {/* Closed-rail capacity control: the Metro figure in a small tile; click opens the list.
              Device audit (11 Oct 2026): the bare "86%" was cryptic, so the accessible name and the
              tooltip both lead with what it counts — "Metro occupancy 85.9%". */}
          <Tooltip
            content={`${metroLabel} occupied\nBed alerts: ${alertCountLabel}${hottestLabel ? `. Fullest ${hottestLabel}` : ""}`}
            placement="right"
            presentationOnly
            disabled={shownOpen}
            wrapperClassName={styles.railTooltipTrigger}
            className={styles.railFlyCard}
          >
            <button
              type="button"
              className={styles.compactAlertPip}
              data-alert={alertCount > 0 ? "true" : undefined}
              data-testid="ward-rail-compact-alert-pip"
              aria-label={`${metroLabel} occupied. Bed alerts: ${alertCountLabel}. ${hottestLabel}`}
              aria-expanded={alertsOpen}
              aria-haspopup="dialog"
              onClick={(event) => {
                alertsTriggerRef.current = event.currentTarget;
                const nextOpen = !alertsOpen;
                setOpenOverlay(nextOpen ? "alerts" : null);
                if (nextOpen) announceToWardShell(`Bed alerts: ${alertCountLabel}. ${metroLabel}. ${hottestLabel}.`);
              }}
            >
              {alertCount > 0 ? <Dot tone="warning" /> : null}
              <span className={styles.compactAlertVal}>
                {metroPercent === null ? "—" : `${Math.round(metroPercent)}%`}
              </span>
            </button>
          </Tooltip>

          {/* One line (Josh, 8 October 2026): the Metro figure and the fullest service by its short
              name ("East"), with the dot only when a service is at or over the threshold. The full
              names are in the label and the list that opens below. */}
          <button
            type="button"
            className={styles.capacityPulseStrip}
            data-open={alertsOpen ? "true" : undefined}
            data-alert={alertCount > 0 ? "true" : undefined}
            data-testid="ward-rail-capacity-alerts-trigger"
            aria-label={`${metroLabel} ${SERVICE_SHORT_LABEL[hottest.shortName]} ${formatOccupancyPercent(hottest.occupancyPercent)}. Bed alerts: ${alertCountLabel}. ${hottestLabel}.`}
            title={`Bed alerts: ${alertCountLabel}. Occupancy against ${BED_ALERT_THRESHOLD_PERCENT}%.`}
            aria-expanded={alertsOpen}
            aria-haspopup="dialog"
            onClick={(event) => {
              alertsTriggerRef.current = event.currentTarget;
              setOpenOverlay((prev) => (prev === "alerts" ? null : "alerts"));
            }}
          >
            {alertCount > 0 ? <Dot tone="warning" className={styles.alertLineDot} /> : null}
            <span className={styles.alertFigure}>
              <span className={styles.alertFigureName}>Metro</span>{" "}
              <span className={styles.alertFigureValue}>
                {metroPercent === null ? "—" : formatOccupancyPercent(metroPercent)}
              </span>
            </span>
            <span className={styles.alertFigure} data-flex="true">
              <span className={styles.alertFigureName}>{SERVICE_SHORT_LABEL[hottest.shortName]}</span>{" "}
              <span className={styles.alertFigureValue}>{formatOccupancyPercent(hottest.occupancyPercent)}</span>
            </span>
            <span className={styles.capacityChevron} data-open={alertsOpen ? "true" : undefined}>
              <ChevronDown aria-hidden="true" strokeWidth={1.75} />
            </span>
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
                  const rowBody = (
                    <>
                      <span className={styles.alertServiceName}>{svc.shortName}</span>
                      <span className={styles.alertMetrics}>
                        <BedAlertMeter percent={svc.occupancyPercent} />
                        <span className={styles.alertPercent}>
                          <Dot tone={atRisk ? "warning" : "neutral"} />
                          {formatOccupancyPercent(svc.occupancyPercent)}
                        </span>
                      </span>
                      <span className={styles.alertFacts}>
                        <span className={styles.alertHospitalCodes}>
                          {svc.hospitalCodes && svc.hospitalCodes.length > 0 ? (
                            <>
                              <span aria-hidden="true">{bedAlertSiteLabel(svc)}</span>
                              <SrOnly>{`Hospital codes: ${svc.hospitalCodes.join(", ")}`}</SrOnly>
                            </>
                          ) : (
                            bedAlertSiteLabel(svc)
                          )}
                        </span>
                        <span className={styles.alertBeds}>
                          {svc.freeBeds} of {svc.totalBeds} free
                          {waiting > 0 ? ` · ED ${waiting} waiting` : ""}
                        </span>
                      </span>
                    </>
                  );
                  // DA-09: rows open Capacity only for a desk that may open it; otherwise they are figures.
                  return capacityOpen ? (
                    <Link
                      key={svc.id}
                      href={WARD_CAPACITY_HREF}
                      className={styles.alertCard}
                      data-hot={index === 0 && atRisk ? "true" : undefined}
                      data-testid="ward-rail-bed-alert-row"
                      onClick={() => setOpenOverlay(null)}
                    >
                      {rowBody}
                    </Link>
                  ) : (
                    <div
                      key={svc.id}
                      className={styles.alertCard}
                      data-hot={index === 0 && atRisk ? "true" : undefined}
                      data-testid="ward-rail-bed-alert-row"
                    >
                      {rowBody}
                    </div>
                  );
                })}
              </div>

              <div className={styles.alertsDropdownFoot}>
                <span className={styles.alertsLegend}>
                  <Dot tone="warning" />
                  {BED_ALERT_THRESHOLD_PERCENT}% and over
                </span>
                {capacityOpen ? (
                  <Link
                    href={WARD_CAPACITY_HREF}
                    className={styles.alertsOpenLink}
                    onClick={() => setOpenOverlay(null)}
                  >
                    Open Capacity
                    <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.railScroll}>
        <nav aria-label="Ward Flow views" className={styles.railNav}>
          <section aria-label={`${menuLabel} menu`} className={styles.railGroup} data-testid="ward-rail-role-menu">
            <div className={styles.groupHead}>
              <p className={styles.eyebrow}>{menuLabel}</p>
            </div>
            <ul className={styles.railList}>
              {menu.main.map((item) =>
                renderItem(item, {
                  compactExtra: !compactPrimaryIds.has(item.id),
                  // On the handover board itself the menu keeps Handover, so the active page shows.
                  countdownTwin:
                    handoverCardLinks && item.id === HANDOVER_MENU_ID && activeEntry?.id !== HANDOVER_MENU_ID,
                }),
              )}
            </ul>
          </section>
          {menu.more.length > 0 ? (
            // B1: everything else is one tap away. One More in every desktop shape (open, strip, tablet).
            <button
              type="button"
              className={`${styles.railLink} ${styles.railButton} ${styles.railMore}`}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-controls="ward-rail-more-pages"
              aria-label="More pages"
              title={!shownOpen && isClosedRailCardViewport ? "More pages" : undefined}
              data-testid={isTabletLandscape ? "ward-rail-tablet-more" : "ward-rail-more"}
              onClick={(event) => openMore(event.currentTarget)}
            >
              <LayoutGrid aria-hidden="true" className={styles.railGlyph} strokeWidth={1.75} />
              <span className={styles.railText}>
                <span className={styles.railLine}>
                  <span className={styles.railLabel}>More</span>
                </span>
              </span>
            </button>
          ) : null}
        </nav>
      </div>

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
              ref={appearanceTriggerRef}
              className={styles.utilityLink}
              aria-label="Appearance"
              title="Appearance"
              aria-expanded={appearanceOpen}
              onClick={() => setOpenOverlay((prev) => (prev === "appearance" ? null : "appearance"))}
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

        <div className={styles.userCardWrap}>
          {/* B6 (Josh, 19 Oct 2026): one switcher. The person opens Go to a desk, which sets both the
              person and the place and goes to that desk's home. The separate persona list (and its
              listbox of buttons, the DA-05 pattern) is gone, so the rail cannot show one person
              while the menu belongs to another. */}
          <button
            type="button"
            ref={personaTriggerRef}
            data-testid="ward-rail-persona-trigger"
            className={`${styles.userProfileCard} ${styles.userProfileCardBtn}`}
            onClick={() => {
              if (onOpenOperatorModal) {
                onOpenOperatorModal();
                return;
              }
              setOpenOverlay(null);
              setDeskModalOpen(true);
            }}
            aria-expanded={deskModalOpen}
            aria-haspopup="dialog"
            aria-label={`${currentPersona.name}, ${currentPersona.role}.${viewing ? ` ${viewing}.` : ""} Go to a desk.`}
            title={`${currentPersona.name} · ${currentPersona.role}. Go to a desk`}
          >
            <span className={styles.userAvatar} aria-hidden="true">
              {currentPersona.initials}
            </span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{currentPersona.name}</span>
              <span className={styles.userRole}>{currentPersona.role}</span>
            </span>
            <ArrowLeftRight aria-hidden="true" className={styles.userChevron} strokeWidth={1.75} />
          </button>
          {deskModalOpen ? (
            <OperatorSwitcherModal
              isOpen
              onClose={() => {
                setDeskModalOpen(false);
                personaTriggerRef.current?.focus();
              }}
            />
          ) : null}
        </div>
      </div>
      <Sheet
        id="ward-rail-more-pages"
        testId="ward-rail-more-pages"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={sheetShowsMain ? "Menu" : "More pages"}
        placement="left"
        contentStyle={{ maxWidth: "min(17.5rem, calc(100vw - 1rem))" }}
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
          // Device audit (11 Oct 2026): the list scrolls above a pinned foot that keeps the person,
          // Settings and Appearance in reach on iPad, where the sheet used to cut off at Governance.
          <>
            <div className={styles.moreFootPerson} title={`${currentPersona.name} · ${currentPersona.role}`}>
              <span className={styles.userAvatar} aria-hidden="true">
                {currentPersona.initials}
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{currentPersona.name}</span>
                <span className={styles.userRole}>{currentPersona.role}</span>
              </span>
            </div>
            <div className={styles.moreFootActions}>
              <Link
                href={settingsHref()}
                className={styles.sheetUtilityLink}
                data-testid="ward-rail-sheet-settings-link"
                onClick={() => setMoreOpen(false)}
              >
                <Settings aria-hidden="true" strokeWidth={1.75} />
                <span>Settings</span>
              </Link>
              <button
                type="button"
                className={styles.sheetUtilityLink}
                data-testid="ward-rail-sheet-appearance"
                onClick={() => {
                  const order = APPEARANCE_CHOICES.map((choice) => choice.id);
                  const next = order[(order.indexOf(appearance) + 1) % order.length] ?? "auto";
                  applyAppearance(next);
                  announceToWardShell(`Appearance set to ${next}.`);
                }}
              >
                <SunMoon aria-hidden="true" strokeWidth={1.75} />
                <span>
                  Appearance{" "}
                  <span className={styles.moreFootValue}>
                    {APPEARANCE_CHOICES.find((choice) => choice.id === appearance)?.label ?? "Auto"}
                  </span>
                </span>
              </button>
            </div>
            <div className={styles.moreFootLine}>
              {/* A7 (overall review, 20 Oct 2026): the policy version moved to Settings, Data and about. */}
              <span>Synthetic prototype</span>
            </div>
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
          {handoverCardLinks ? (
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
          ) : (
            <p className={styles.menuContextCell}>
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
            </p>
          )}
        </div>
        {hottest ? (
          capacityOpen ? (
            <Link href={WARD_CAPACITY_HREF} className={styles.sheetAlerts} onClick={() => setMoreOpen(false)}>
              <span className={styles.alertsHead}>
                <span className={styles.alertsEyebrow}>Bed alerts</span>{" "}
                <span className={styles.alertsChip} data-alert={alertCount > 0 ? "true" : undefined}>
                  {alertCount > 0 ? <Dot tone="warning" /> : null}
                  {alertCountLabel}
                </span>
              </span>
              {renderBedAlertRows()}
            </Link>
          ) : (
            <div className={styles.sheetAlerts}>
              <span className={styles.alertsHead}>
                <span className={styles.alertsEyebrow}>Bed alerts</span>{" "}
                <span className={styles.alertsChip} data-alert={alertCount > 0 ? "true" : undefined}>
                  {alertCount > 0 ? <Dot tone="warning" /> : null}
                  {alertCountLabel}
                </span>
              </span>
              {renderBedAlertRows()}
            </div>
          )
        ) : null}
        {sheetGroups.map((group) =>
          group.entries.length ? (
            <section key={group.label} aria-label={group.label}>
              <p className={styles.eyebrow}>{group.label}</p>
              <ul className={styles.moreList}>
                {group.entries.map((item) =>
                  renderItem(item, {
                    sheet: true,
                    firstInSheet: item.id === firstSheetId,
                  }),
                )}
              </ul>
            </section>
          ) : null,
        )}
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
