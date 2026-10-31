"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon,
  ArrowLeftRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftOpen,
  RotateCcwClock,
  Settings,
  SunMoon,
  Wrench,
} from "lucide-react";
import { Dot, Sheet, useIsPhone, useMediaQuery, useWfBandActive } from "@/components/wf";
import { formatInstantWithDay } from "../ward-clock";
import { useExecutiveStatistics } from "../statistics/executive-statistics-context";
import { releasedCountText, ExecutiveStatisticsUnavailable } from "../statistics/statistics-small-numbers";
import { WardHelpHost } from "../help/ward-help-host";
import { WARD_CAPACITY_HREF } from "../ward-nav";
import { useWardHelpRow } from "../help/ward-help-link";
import { applyAppearance, applyGlare } from "./ward-bar";
import { WardBarBack } from "./ward-bar-controls";
import { wardBarRouteTitle, SERVICE_SWATCH_KEY } from "./ward-bar-model";
import { WardBarFrame, WardRailFrame } from "./ward-chrome-frame";
import { WardAccountActions } from "./ward-account-actions";
import { SharedSessionContext } from "./ward-shared-session-context";
import { useEffectiveWardAccess } from "./ward-access-store";
import {
  WardAccessBanner,
  WardAccessGate,
  WardIdleLock,
  WardPrintFooter,
  useAccessNavFilter,
  useCanOpenHref,
  useDeskHomeHref,
} from "./ward-access";
import { WardDeskPendingClear } from "./ward-access-hold";
import { WardOfflineBanner } from "./ward-offline-banner";
import { WardGround } from "../ward-shell";
import { WardDemoClockPopover } from "../ward-demo-controls";
import { WardDemoPanel } from "../tools/ward-demo-panel";
import { WardToolsSheet } from "../tools/ward-tools-sheet";
import { railEntries, roleMenu, isActiveRailEntry, type RailEntry } from "./ward-rail-entries";
import { useWardFeatureFlagCheck } from "./ward-feature-flag-store";
import { useWardShellPublic } from "./ward-shell-public-context";
import { settingsHref } from "./ward-facade";
import {
  setRailOpenPreference,
  useWardDocumentPreferences,
  isTypingTarget,
  openDrawerForShortcut,
} from "./ward-rail-preferences";
import { subscribeWardDrawer, subscribeWardMenu } from "./ward-drawer-bus";
import { subscribeToolsTool } from "../tools/ward-tools-open";
import { wardBackParent, noteWardRoute } from "./ward-back";
import { replayEarlyHeaderTap } from "./ward-early-tap";
import { WARD_BAR_PAGE_TOOLS_ID } from "./ward-bar-page-tools";
import { useMobileKeyboard } from "./use-mobile-keyboard";
import { useRevealFocusedInRow } from "./use-reveal-focused-in-row";
import { useOnlineStatus } from "../use-online-status";
import { useServiceScope, setServiceScope } from "./ward-service-store";
import { BedAlertMeter, capacityRowsSpoken, overLineLabel, type CapacityRow } from "./ward-rail-parts";
import { useBarScrolled, useBandScrolled } from "./ward-bar-scroll";
import {
  BED_ALERT_THRESHOLD_PERCENT,
  formatOccupancyPercent,
  isBedAlert,
  METRO_HEALTH_SERVICES,
} from "./ward-service-bed-alerts";
import type { ExecutiveReportingFoundation } from "../statistics/executive-statistics-contract";
import { publishLiveClock } from "@/components/wf";
import bar from "./ward-bar.module.css";
import rail from "./ward-rail.module.css";
import phone from "./ward-phone-menu.module.css";
import pageDock from "./ward-phone-page-dock.module.css";
import layout from "@/app/ward-flow/ward-flow-layout.module.css";

const WardPublicSearch = dynamic(() => import("../ward-public-search").then((module) => module.WardPublicSearch));
function ExecutiveSignOutRow() {
  const session = useContext(SharedSessionContext);
  if (!session) return null;
  return (
    <li>
      <button
        type="button"
        className={phone.row}
        data-testid="ward-phone-menu-sign-out"
        onClick={() => session.signOut()}
      >
        <LogOut aria-hidden="true" className={phone.rowIcon} strokeWidth={1.75} />
        <span className={phone.rowText}>
          <span className={phone.rowLabel}>Sign out</span>
          {session.accountEmail ? <span className={phone.rowMeta}>{session.accountEmail}</span> : null}
        </span>
      </button>
    </li>
  );
}
function ExecutiveMark() {
  return (
    <span className={rail.brandEmblem} aria-hidden="true">
      <svg
        viewBox="0 0 20 20"
        className={rail.emblemGlyph}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 3.5v13M3 10h13.5" />
        <path d="M13 6.5 16.5 10 13 13.5" />
      </svg>
    </span>
  );
}
function ExecutiveDemoMenu({ onClose }: { onClose: (refocus?: boolean) => void }) {
  return (
    <Sheet id="ward-executive-demo" open onClose={() => onClose()} title="Demo" testId="ward-executive-demo-sheet">
      <WardDemoPanel oneList />
    </Sheet>
  );
}
type Panel = "menu" | "activity" | "tasks" | "tools" | "scope" | "appearance" | "demo" | null;

type ExecutiveService = ExecutiveReportingFoundation["services"][number];

function servicePercent(service: ExecutiveService) {
  return service.beds.total > 0 ? Math.round((service.beds.inUse / service.beds.total) * 1000) / 10 : 0;
}

/**
 * The capacity card's figures for this desk, from the public report only (the new frame, Josh,
 * 30-31 Oct 2026): occupancy rows first, as the other desks' rail card shows them (Metro and the
 * fullest service statewide; a service desk reads its own service), then the beds ready now.
 */
function executiveCapacity(report: ExecutiveReportingFoundation) {
  const scope = report.network.scope;
  const services = report.services
    .filter((service) => scope.kind === "statewide" || service.service === scope.service)
    .toSorted((a, b) => servicePercent(b) - servicePercent(a) || a.service.localeCompare(b.service));
  const hottest = services[0];
  const metro =
    scope.kind === "service"
      ? services
      : services.filter((service) => (METRO_HEALTH_SERVICES as readonly string[]).includes(service.service));
  const metroBeds = metro.reduce((sum, service) => sum + service.beds.total, 0);
  const metroInUse = metro.reduce((sum, service) => sum + service.beds.inUse, 0);
  const metroPercent = metroBeds > 0 ? Math.round((metroInUse / metroBeds) * 1000) / 10 : null;
  const rows: CapacityRow[] =
    scope.kind === "service"
      ? [{ key: "own", name: scope.service, counts: `${scope.service}'s beds`, percent: metroPercent }]
      : [
          { key: "metro", name: "Metro", counts: "the metropolitan health services' wards", percent: metroPercent },
          ...(hottest
            ? [
                {
                  key: hottest.service,
                  name: hottest.service,
                  counts: `${hottest.service}, the fullest health service`,
                  percent: servicePercent(hottest),
                },
              ]
            : []),
        ];
  const readyBeds = report.network.beds.ready;
  return {
    services,
    hottest,
    rows,
    overLine: overLineLabel(rows),
    readyBeds,
    readyLabel: `${readyBeds} ${readyBeds === 1 ? "bed" : "beds"} ready now`,
    note: scope.kind === "service" ? `for ${scope.service}` : "across the whole network",
  };
}

function CapacityRowLine({ row, title }: { row: CapacityRow; title?: string }) {
  return (
    <span className={rail.alertRow} title={title}>
      <span className={rail.alertRowName}>{row.name}</span>
      {row.percent === null ? (
        <span className={rail.meter} aria-hidden="true" />
      ) : (
        <BedAlertMeter percent={row.percent} />
      )}
      <span className={rail.alertRowPercent}>
        {row.percent !== null && isBedAlert(row.percent) ? <Dot tone="warning" /> : null}
        {row.percent === null ? "—" : formatOccupancyPercent(row.percent)}
      </span>
    </span>
  );
}

/** The phone and tablet Menu opens on the same capacity card as the other desks' Menu. */
function ExecutiveMenuCapacityCard({
  report,
  canOpen,
  onGo,
}: {
  report: ExecutiveReportingFoundation;
  canOpen: (href: string) => boolean;
  onGo: () => void;
}) {
  const { rows, overLine, readyBeds, note } = executiveCapacity(report);
  const body = (
    <>
      <span className={rail.alertsHead}>
        <span className={rail.alertsEyebrow}>Bed alerts</span>{" "}
        <span className={rail.alertsChip} data-alert={overLine.over > 0 ? "true" : undefined}>
          {overLine.over > 0 ? <Dot tone="warning" /> : null}
          {overLine.label}
        </span>
      </span>
      {rows.map((row) => (
        <CapacityRowLine key={row.key} row={row} />
      ))}
      <span className={rail.capacityReady}>
        <b>{readyBeds}</b> {readyBeds === 1 ? "bed" : "beds"} ready now, {note}
      </span>
    </>
  );
  return (
    <div className={rail.phoneTop} data-testid="ward-phone-menu-top">
      {canOpen(WARD_CAPACITY_HREF) ? (
        <Link href={WARD_CAPACITY_HREF} className={rail.phoneCard} onClick={onGo}>
          {body}
        </Link>
      ) : (
        <div className={rail.phoneCard}>{body}</div>
      )}
    </div>
  );
}

function ExecutiveBedAlerts({ report }: { report: ExecutiveReportingFoundation }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  const { services, hottest, rows, overLine, readyLabel, readyBeds, note } = executiveCapacity(report);
  if (!hottest) return null;
  const firstRow = rows[0];
  // Bed alerts stay about capacity (Josh, 30 Oct 2026), as on the other desks' rail: occupancy rows
  // with their meters and the 85% tick, the count over the line in words, then the ready beds.
  const spoken = `Bed alerts: ${overLine.label}. ${capacityRowsSpoken(rows)}. ${readyLabel}, ${note}.`;
  return (
    <div className={rail.alertsContainer} ref={container}>
      <button
        type="button"
        className={rail.compactAlertPip}
        data-alert={overLine.over > 0 ? "true" : undefined}
        data-testid="ward-rail-compact-alert-pip"
        aria-label={spoken}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        {overLine.over > 0 ? <Dot tone="warning" /> : null}
        <span className={rail.compactAlertVal}>
          {firstRow?.percent == null ? "—" : `${Math.round(firstRow.percent)}%`}
        </span>
      </button>
      <button
        type="button"
        className={`${rail.capacityPulseStrip} ${rail.capacityCard}`}
        data-open={open ? "true" : undefined}
        data-alert={overLine.over > 0 ? "true" : undefined}
        data-testid="ward-rail-capacity-alerts-trigger"
        aria-label={spoken}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <span className={rail.capacityHead} aria-hidden="true">
          <span className={rail.alertsEyebrow}>Bed alerts</span>
          <span className={rail.alertsChip} data-alert={overLine.over > 0 ? "true" : undefined}>
            {overLine.over > 0 ? <Dot tone="warning" /> : null}
            {overLine.label}
          </span>
          <span className={rail.capacityChevron} data-open={open ? "true" : undefined}>
            <ChevronDown aria-hidden="true" strokeWidth={1.75} />
          </span>
        </span>
        <span className={rail.capacityRows} aria-hidden="true">
          {rows.map((row) => (
            <CapacityRowLine key={row.key} row={row} title={`${row.counts}, beds in use`} />
          ))}
        </span>
        <span className={rail.capacityReady} aria-hidden="true">
          <b>{readyBeds}</b> {readyBeds === 1 ? "bed" : "beds"} ready now
        </span>
      </button>
      {open && (
        <div className={rail.capacityAlertsDropdown} role="dialog" aria-label="Bed alerts">
          <div className={rail.alertsDropdownHeader}>
            <div>
              <strong className={rail.alertsDropdownTitle}>Bed alerts</strong>
              <p className={rail.alertsDropdownSub}>{services.length} health services</p>
            </div>
            <span className={rail.alertsTotalBadge} data-testid="ward-rail-bed-alerts-free">
              <span className={rail.alertsTotalValue}>{report.network.beds.ready}</span> beds ready
            </span>
          </div>
          <div className={rail.alertsList}>
            {services.map((service) => (
              <div key={service.service} className={rail.alertCard} data-testid="ward-rail-bed-alert-row">
                <span className={rail.alertServiceName}>{service.service}</span>
                <span className={rail.alertMetrics}>
                  <span className={rail.alertPercent}>{formatOccupancyPercent(servicePercent(service))}</span>
                </span>
                <span className={rail.alertFacts}>
                  <span className={rail.alertHospitalCodes}>
                    {report.catalogue.sites
                      .filter((site) => site.service === service.service)
                      .map((site) => site.code)
                      .join(" · ")}
                  </span>
                  <span className={rail.alertBeds}>
                    {service.beds.ready} of {service.beds.total} ready · ED {releasedCountText(service.waiting)} waiting
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className={rail.alertsDropdownFoot}>
            <span className={rail.alertsLegend}>{BED_ALERT_THRESHOLD_PERCENT}% and over</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** The authenticated reporting desk has no operational provider. These are the existing chrome
 * elements, classes and sheet conventions, fed only by the public reporting contract. */
export function WardExecutiveChrome({ children }: { children: ReactNode }) {
  const report = useExecutiveStatistics();
  const shell = useWardShellPublic();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isPhone = useIsPhone();
  const tabletLandscape = useMediaQuery("(min-width: 1001px) and (max-width: 1200px)");
  const closedRailCards = useMediaQuery("(min-width: 1001px)");
  const canOpen = useCanOpenHref();
  const accessNav = useAccessNavFilter();
  const flagOn = useWardFeatureFlagCheck();
  const home = useDeskHomeHref();
  const preferences = useWardDocumentPreferences();
  const online = useOnlineStatus();
  const selectedService = useServiceScope();
  // The access admin borrows this desk's menu, with Governance leading it (Josh, 30 Oct 2026).
  const accessAdmin = useEffectiveWardAccess().role === "admin";
  // Help opens as the shared rail's and phone Menu's does: the desk's tour until it has been seen,
  // then help for this screen.
  const help = useWardHelpRow();
  const [panel, setPanel] = useState<Panel>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuReturnFocus = useRef<HTMLElement | null>(null);
  const activityTrigger = useRef<HTMLButtonElement>(null);
  const tasksTrigger = useRef<HTMLButtonElement>(null);
  const toolsTrigger = useRef<HTMLButtonElement>(null);
  const scopeTrigger = useRef<HTMLButtonElement>(null);
  const appearanceTrigger = useRef<HTMLButtonElement>(null);
  const phoneActivityOpener = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const barScrolled = useBarScrolled(barRef, isPhone);
  const bandHero = useWfBandActive();
  const bandScrolled = useBandScrolled(barRef, bandHero && !isPhone);
  const bandState = !bandHero
    ? undefined
    : isPhone
      ? barScrolled
        ? undefined
        : "ink"
      : bandScrolled
        ? "light"
        : "ink";
  useMobileKeyboard({ trackState: false });
  useRevealFocusedInRow();
  useEffect(() => noteWardRoute(pathname), [pathname]);
  useEffect(() => replayEarlyHeaderTap(), []);
  useEffect(
    () =>
      subscribeWardMenu((opener) => {
        menuReturnFocus.current = opener ?? menuTrigger.current;
        setPanel("menu");
      }),
    [],
  );
  useEffect(
    () =>
      subscribeWardDrawer((drawer) => {
        if (drawer === "activity" || drawer === "tasks" || drawer === "tools") setPanel(drawer);
      }),
    [],
  );
  useEffect(() => subscribeToolsTool((tool) => setPanel(tool === "demo" ? "demo" : "tools")), []);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
      else if (!isTypingTarget(event.target)) {
        if (event.key === "[" && !event.ctrlKey && !event.metaKey && !event.altKey)
          setRailOpenPreference(!preferences.open);
        else openDrawerForShortcut(event);
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [preferences.open]);
  const clock = shell ? formatInstantWithDay(shell.now, shell.now) : "";
  useEffect(() => {
    publishLiveClock(clock || undefined);
    return () => publishLiveClock(undefined);
  }, [clock]);
  if (!report || !shell) return <ExecutiveStatisticsUnavailable />;
  const entries = accessNav(railEntries(flagOn));
  const resolvedMenu = roleMenu(entries, "executive", accessAdmin);
  const menu = { ...resolvedMenu, main: resolvedMenu.main.filter((entry): entry is RailEntry => "href" in entry) };
  const scope = report.network.scope;
  const services = report.services.filter((service) => scope.kind === "statewide" || service.service === scope.service);
  const activeService =
    scope.kind === "service" ? scope.service : services.find((service) => service.service === selectedService)?.service;
  const displayedScope = activeService ?? "Statewide";
  const displayedWaiting = activeService
    ? report.services.find((service) => service.service === activeService)!.waiting
    : report.network.people.waitingInEd;
  // The phone dock (the new frame): Statistics, then Capacity and Activity. Each page shows only
  // where this desk may open it.
  const dockPages = ["statistics", "capacity"]
    .map((id) => entries.find((entry): entry is RailEntry => "href" in entry && entry.id === id))
    .filter((entry): entry is RailEntry => entry !== undefined);
  // The phone and tablet Menu (no full rail on screen) opens on the capacity card; the desktop
  // rail's own More does not repeat it.
  const menuShowsCapacity = isPhone || tabletLandscape || !closedRailCards;
  const back = wardBackParent(pathname, home);
  const title = wardBarRouteTitle(pathname, undefined, isPhone);
  const close = () => setPanel(null);
  const switchRole = () => {
    close();
    shell.switchRole?.();
  };
  const openActivity = (opener?: HTMLElement) => {
    phoneActivityOpener.current = opener ?? activityTrigger.current;
    setPanel("activity");
  };
  const navLink = (entry: RailEntry, inMenu = false) => (
    <Link
      key={entry.id}
      href={entry.href}
      className={inMenu ? phone.row : rail.railLink}
      aria-current={isActiveRailEntry(pathname, entry) ? "page" : undefined}
      onClick={close}
    >
      <entry.icon aria-hidden="true" className={inMenu ? phone.rowIcon : rail.railGlyph} strokeWidth={1.75} />
      <span className={inMenu ? phone.rowText : rail.railText}>
        <span className={inMenu ? phone.rowLabel : rail.railLine}>
          <span className={inMenu ? undefined : rail.railLabel}>{entry.label}</span>
        </span>
      </span>
    </Link>
  );
  const utility = (kind: "help" | "appearance" | "settings") =>
    kind === "settings" ? (
      <Link href={settingsHref()} className={rail.utilityLink} onClick={close} data-testid="ward-rail-settings-link">
        <Settings aria-hidden="true" /> <span>Settings</span>
      </Link>
    ) : (
      <button
        type="button"
        className={rail.utilityLink}
        ref={kind === "appearance" ? appearanceTrigger : undefined}
        data-testid={kind === "help" ? "ward-rail-help" : "ward-rail-appearance-toggle"}
        aria-label={kind === "help" ? help.label : undefined}
        onClick={() => {
          if (kind === "help") {
            close();
            help.open();
          } else setPanel("appearance");
        }}
      >
        {kind === "help" ? <CircleHelp aria-hidden="true" /> : <SunMoon aria-hidden="true" />}
        <span>{kind === "help" ? "Help" : "Appearance"}</span>
      </button>
    );
  return (
    <>
      <div className={layout.shellRow}>
        {!isPhone && (
          <WardRailFrame
            className={rail.rail}
            data-rail={preferences.open && !tabletLandscape ? "open" : "closed"}
            data-tablet={tabletLandscape ? "landscape" : undefined}
            aria-label="Ward Flow sections"
            data-testid="ward-rail"
          >
            <div className={rail.brand}>
              {(!preferences.open || tabletLandscape) && closedRailCards ? (
                <button
                  type="button"
                  className={rail.brandLink}
                  aria-label="Ward Flow, open the menu"
                  title="Open the menu"
                  data-testid="ward-rail-brand-open"
                  onClick={(event) => {
                    if (tabletLandscape) {
                      menuReturnFocus.current = event.currentTarget;
                      setPanel("menu");
                    } else setRailOpenPreference(true);
                  }}
                >
                  <ExecutiveMark />
                </button>
              ) : (
                <Link href={home} className={rail.brandLink} aria-label="Ward Flow WA — home">
                  <ExecutiveMark />
                  <span className={rail.brandTitle}>Ward Flow</span>
                  <span className={rail.brandStateText}>WA</span>
                </Link>
              )}
              <button
                type="button"
                className={rail.railToggle}
                onClick={() => setRailOpenPreference(!preferences.open)}
                aria-label={preferences.open ? "Collapse menu" : "Expand menu"}
                data-testid="ward-rail-toggle"
              >
                {preferences.open ? <ChevronLeft aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
                <span className={rail.toggleText}>{preferences.open ? "Collapse" : "Expand"} menu</span>
              </button>
              <button
                type="button"
                className={`${rail.moreTrigger} ${rail.mobileMenu}`}
                onClick={(event) => {
                  menuReturnFocus.current = event.currentTarget;
                  setPanel("menu");
                }}
                aria-haspopup="dialog"
              >
                <Menu aria-hidden="true" />
                Menu
              </button>
            </div>
            {/* Josh, 31 Oct 2026: the executive and access admin desks hold no shift, so no shift card. */}
            <ExecutiveBedAlerts report={report} />
            <div className={rail.railScroll}>
              <nav className={rail.railNav} aria-label="Ward Flow views">
                <section className={rail.railGroup} aria-label="Executive menu" data-testid="ward-rail-role-menu">
                  <div className={rail.groupHead}>
                    <p className={rail.eyebrow}>Executive</p>
                  </div>
                  <ul className={rail.railList}>
                    {menu.main.map((entry) => (
                      <li key={entry.id}>{navLink(entry)}</li>
                    ))}
                  </ul>
                </section>
                {menu.more.length > 0 && (
                  <button
                    type="button"
                    className={`${rail.railLink} ${rail.railButton} ${rail.railMore}`}
                    data-testid="ward-rail-more"
                    onClick={(event) => {
                      menuReturnFocus.current = event.currentTarget;
                      setPanel("menu");
                    }}
                    aria-haspopup="dialog"
                  >
                    <LayoutGrid aria-hidden="true" className={rail.railGlyph} />
                    <span className={rail.railText}>More</span>
                  </button>
                )}
                {utility("help")}
              </nav>
            </div>
            <div className={rail.railFoot}>
              <div className={rail.utilityLinks}>
                {utility("appearance")}
                {utility("settings")}
              </div>
              <WardAccountActions className={rail.utilityLink} wrapClassName={rail.utilityLinks} />
              <div className={rail.userCardWrap}>
                <button
                  type="button"
                  className={`${rail.userProfileCard} ${rail.userProfileCardBtn}`}
                  onClick={switchRole}
                  data-testid="ward-rail-persona-trigger"
                  aria-haspopup="dialog"
                  aria-label="Executive. Go to a desk."
                >
                  <span className={rail.userAvatar} aria-hidden="true">
                    EX
                  </span>
                  <span className={rail.userMeta}>
                    <span className={rail.userName}>Executive</span>
                    <span className={rail.userRole}>Go to a desk</span>
                  </span>
                  <ArrowLeftRight aria-hidden="true" className={rail.userChevron} />
                </button>
              </div>
            </div>
          </WardRailFrame>
        )}
        <div className={layout.shellContent} data-wf-scroller="">
          <WardBarFrame
            ref={barRef}
            className={bar.bar}
            aria-label="Header"
            data-testid="ward-bar"
            data-wf-bar=""
            data-band={bandState}
            data-scrolled={barScrolled || undefined}
            data-long-title={title.length > 17 || undefined}
          >
            {back && <WardBarBack parentHref={back} phone={isPhone} buttonRef={menuTrigger} />}
            <button
              type="button"
              ref={back ? undefined : menuTrigger}
              className={bar.phoneOnly}
              data-testid="ward-bar-phone-menu"
              data-back-replaced={back ? "" : undefined}
              aria-label="Menu"
              aria-haspopup="dialog"
              aria-controls="ward-phone-menu"
              onClick={(event) => {
                menuReturnFocus.current = event.currentTarget;
                setPanel("menu");
              }}
            >
              <Menu aria-hidden="true" />
            </button>
            <div className={bar.title}>
              <div className={bar.titleGroup}>
                <span className={bar.place} data-testid="ward-bar-route-title" title={title}>
                  {title}
                </span>
              </div>
              <div className={bar.scopeBadgeContainer}>
                <button
                  type="button"
                  ref={scopeTrigger}
                  className={bar.scopeBadgeBtn}
                  data-testid="ward-bar-service-trigger"
                  data-service={activeService ? SERVICE_SWATCH_KEY[activeService] : "statewide"}
                  data-band={isPhone ? bandState : undefined}
                  aria-haspopup="dialog"
                  aria-expanded={panel === "scope"}
                  onClick={() => setPanel("scope")}
                >
                  <span className={bar.scopeDot} aria-hidden="true" />
                  <span className={bar.scopeBadgeLabel}>{displayedScope}</span>
                  <ChevronDown className={bar.scopeCaret} aria-hidden="true" />
                </button>
                {isPhone && (
                  <span className={bar.scopeLive}>
                    {releasedCountText(displayedWaiting)} waiting · {displayedScope}
                  </span>
                )}
              </div>
              <div id={WARD_BAR_PAGE_TOOLS_ID} className={bar.pageTools} data-testid="ward-bar-page-tools" />
              {/* Josh, 30-31 Oct 2026: no "Synthetic prototype" pill in the header. The footer's
                  synthetic-data notice stays, and the board clock and Tools open the Demo menu. */}
              <WardDemoClockPopover
                className={bar.demoClock}
                testId="ward-bar-demo-clock"
                title={`Board time ${clock} AWST${online ? "" : ". Offline"}`}
              >
                <span className={bar.demoClockDot} data-offline={online ? undefined : "true"} aria-hidden="true" />
                <span className={bar.demoClockLabel}>Board time</span>
                <span className={bar.demoClockTime}>{clock}</span>
                <span className={bar.demoClockTz}>AWST</span>
              </WardDemoClockPopover>
              {/* The shell's synthetic-data marker for screen readers (visually hidden, so no pill shows). */}
              <span
                className={bar.mark}
                title="Patient and flow data are synthetic; service names depend on the selected demonstration scenario. Not approved for clinical use."
              >
                <span className={bar.markLong}>Synthetic </span>prototype
              </span>
            </div>
            <div className={bar.centerGroup}>
              <div className={bar.searchWrap}>
                <WardPublicSearch
                  catalogue={report}
                  accessLifetime={shell.accessLifetime ?? ""}
                  canOpenHref={canOpen}
                  placeholder="Search Ward Flow"
                />
              </div>
            </div>
            <div className={bar.drawerTriggers}>
              <button
                type="button"
                ref={activityTrigger}
                className={bar.drawerTrigger}
                data-bar-mode="activity"
                data-testid="ward-bar-activity-trigger"
                aria-haspopup="dialog"
                aria-controls="ward-bar-activity-drawer"
                aria-expanded={panel === "activity"}
                onClick={() => openActivity()}
              >
                <RotateCcwClock className={bar.triggerIcon} aria-hidden="true" />
                <span className={bar.triggerLabel}>Activity</span>
                <span className="sr-only">, individual activity unavailable</span>
              </button>
              <button
                type="button"
                ref={tasksTrigger}
                className={bar.drawerTrigger}
                data-bar-mode="tasks"
                data-testid="ward-bar-tasks-trigger"
                aria-haspopup="dialog"
                aria-expanded={panel === "tasks"}
                aria-controls="ward-bar-tasks-drawer"
                onClick={() => setPanel("tasks")}
              >
                {/* Josh, 31 Oct 2026: one name and one icon on every desk, the bell and "Alerts". This
                    desk's list is the bed coordinator's, so it opens empty under the same name. */}
                <Bell className={bar.triggerIcon} aria-hidden="true" strokeWidth={1.75} />
                <span className={bar.triggerLabel}>Alerts</span>
                <span className={bar.badge} data-zero="true">
                  0
                </span>
              </button>
              <button
                type="button"
                ref={toolsTrigger}
                className={bar.drawerTrigger}
                data-bar-mode="tools"
                data-testid="ward-bar-tools-trigger"
                aria-haspopup="dialog"
                aria-expanded={panel === "tools"}
                onClick={() => setPanel("tools")}
              >
                <Wrench className={bar.triggerIcon} aria-hidden="true" />
                <span className={bar.triggerLabel}>Tools</span>
                <ChevronDown className={bar.triggerCaret} aria-hidden="true" />
              </button>
            </div>
          </WardBarFrame>
          <div className={layout.bannerHolder} data-wf-bar-notes="">
            <WardOfflineBanner />
            <WardAccessBanner />
          </div>
          <WardAccessGate>
            <WardGround>{children}</WardGround>
          </WardAccessGate>
          <WardDeskPendingClear />
          <WardPrintFooter />
          <WardIdleLock />
        </div>
      </div>
      {isPhone && (
        <div className={`${pageDock.pageDock} ${pageDock.rise}`} data-wf-page-dock="rise" data-wf-create="none">
          {/* The new frame's dock for a desk with nothing to start: no + and no hump, so the tabs
              share the width evenly (Statistics, Capacity, Activity). */}
          <nav
            className={phone.dock}
            aria-label="Quick open"
            data-testid="ward-phone-dock"
            style={{ gridTemplateColumns: `repeat(${dockPages.length + 1}, minmax(0, 1fr))` }}
          >
            {dockPages.map((entry) => (
              <Link
                key={entry.id}
                href={entry.href}
                className={phone.dockItem}
                aria-current={isActiveRailEntry(pathname, entry) ? "page" : undefined}
                data-testid="ward-phone-dock-link"
              >
                <span className={phone.dockIcon} aria-hidden="true">
                  <entry.icon aria-hidden="true" strokeWidth={1.75} />
                </span>
                <span className={phone.dockLabel}>{entry.label}</span>
              </Link>
            ))}
            <button
              type="button"
              className={phone.dockItem}
              data-testid="ward-phone-menu-activity"
              aria-haspopup="dialog"
              onClick={(event) => openActivity(event.currentTarget)}
            >
              <span className={phone.dockIcon} aria-hidden="true">
                <ActivityIcon aria-hidden="true" strokeWidth={1.75} />
              </span>
              <span className={phone.dockLabel}>Activity</span>
            </button>
          </nav>
        </div>
      )}
      <Sheet
        id="ward-phone-menu"
        testId={isPhone ? "ward-phone-menu" : "ward-rail-more-pages"}
        open={panel === "menu"}
        onClose={close}
        title="Menu"
        placement={isPhone ? "default" : "left"}
        mobilePlacement="bottom"
        mobileBreakpoint="phone"
        returnFocusRef={menuReturnFocus}
        contentClassName={phone.sheet}
        headerClassName={phone.head}
        closeButtonClassName={phone.close}
        bodyClassName={phone.body}
      >
        <button
          type="button"
          className={phone.who}
          onClick={switchRole}
          data-testid="ward-phone-menu-switch-workstation"
        >
          <span className={`${phone.avatar} ${phone.avatarInitials}`} aria-hidden="true">
            EX
          </span>
          <span className={phone.whoText}>
            <span className={phone.whoName}>Executive</span>
            <span className={phone.whoMeta}>Go to a desk</span>
          </span>
        </button>
        {/* One search: it already finds every page below, so the separate "Filter pages" box went in the
            search and forms review (Josh, 30 Oct 2026). */}
        <WardPublicSearch
          catalogue={report}
          accessLifetime={shell.accessLifetime ?? ""}
          canOpenHref={canOpen}
          onNavigate={(href) => {
            close();
            router.push(href);
          }}
        />
        {menuShowsCapacity ? <ExecutiveMenuCapacityCard report={report} canOpen={canOpen} onGo={close} /> : null}
        {[{ label: "Executive", entries: menu.main }, ...menu.more].map((group) => (
          <section key={group.label}>
            <h2 className={phone.heading}>{group.label}</h2>
            <ul className={phone.list}>
              {group.entries.map((entry) => (
                <li key={entry.id}>{navLink(entry, true)}</li>
              ))}
            </ul>
          </section>
        ))}
        <button
          type="button"
          className={phone.row}
          data-testid="ward-phone-menu-tools"
          onClick={() => setPanel("tools")}
        >
          <Wrench aria-hidden="true" className={phone.rowIcon} />
          <span className={phone.rowText}>
            <span className={phone.rowLabel}>Tools</span>
          </span>
        </button>
        <div>
          {utility("help")}
          {utility("appearance")}
          {utility("settings")}
        </div>
        <ul className={phone.list}>
          <ExecutiveSignOutRow />
        </ul>
      </Sheet>
      <Sheet
        id="ward-bar-activity-drawer"
        testId="ward-bar-activity-sheet"
        open={panel === "activity"}
        onClose={close}
        title="Activity"
        placement="right"
        returnFocusRef={phoneActivityOpener}
        bodyTabIndex={isPhone ? 0 : undefined}
        bodyLabel={isPhone ? "Activity list" : undefined}
        contentClassName={bar.drawerSheet}
        headerClassName={bar.drawerHeader}
        titleClassName={bar.drawerTitle}
        closeButtonClassName={bar.drawerClose}
        bodyClassName={bar.drawerBody}
      >
        <h2>Individual activity unavailable</h2>
        <p>Individual activity, unread counts and record changes are unavailable for this desk.</p>
      </Sheet>
      <Sheet
        id="ward-bar-tasks-drawer"
        testId="ward-bar-tasks-sheet"
        open={panel === "tasks"}
        onClose={close}
        title="Alerts"
        returnFocusRef={tasksTrigger}
        contentClassName={bar.drawerSheet}
        bodyClassName={bar.drawerBody}
      >
        <p>This is the bed coordinator&apos;s list. Individual alerts are unavailable for this desk.</p>
      </Sheet>
      <Sheet
        id="ward-bar-tools-drawer"
        testId="ward-bar-tools-sheet"
        open={panel === "tools"}
        onClose={close}
        title="Tools"
        returnFocusRef={isPhone ? menuTrigger : toolsTrigger}
        contentClassName={bar.drawerSheet}
        bodyClassName={bar.drawerBody}
      >
        {panel === "tools" && (
          <WardToolsSheet isPhone={isPhone} roleLabel="Executive" onNavigate={close} onNewReferral={() => {}} />
        )}
      </Sheet>
      <Sheet
        id="ward-bar-service-panel"
        testId="ward-bar-service-panel"
        open={panel === "scope"}
        onClose={close}
        title="Service"
        returnFocusRef={scopeTrigger}
      >
        <p className={bar.serviceSheetNote}>Reports show only the places this desk covers.</p>
        {scope.kind === "statewide" && (
          <button
            type="button"
            className={bar.serviceOption}
            aria-pressed={!activeService}
            onClick={() => {
              setServiceScope(null);
              close();
            }}
          >
            All services · {releasedCountText(report.network.people.waitingInEd)} waiting
          </button>
        )}
        {services.map((service) => (
          <button
            type="button"
            key={service.service}
            className={bar.serviceOption}
            aria-pressed={activeService === service.service}
            onClick={() => {
              if (scope.kind === "statewide") setServiceScope(service.service);
              close();
            }}
          >
            {service.service}: {service.beds.ready} beds ready · {releasedCountText(service.waiting)} waiting
          </button>
        ))}
      </Sheet>
      <Sheet
        id="ward-executive-appearance"
        testId="ward-executive-appearance"
        open={panel === "appearance"}
        onClose={close}
        title="Appearance"
        returnFocusRef={appearanceTrigger}
      >
        <div className={rail.appearancePills}>
          {(["auto", "light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={rail.appearancePillBtn}
              aria-pressed={!preferences.glare && preferences.appearance === value}
              onClick={() => {
                applyGlare(false);
                applyAppearance(value);
              }}
            >
              {value === "auto" ? "Auto" : value === "light" ? "Light" : "Dark"}
            </button>
          ))}
          <button
            type="button"
            className={rail.appearancePillBtn}
            aria-pressed={preferences.glare}
            onClick={() => applyGlare(true)}
          >
            Bright light
          </button>
        </div>
      </Sheet>
      {panel === "demo" && <ExecutiveDemoMenu onClose={close} />}
      <WardHelpHost />
    </>
  );
}
