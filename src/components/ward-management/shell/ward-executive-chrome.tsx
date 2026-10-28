"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftOpen,
  RotateCcwClock,
  Settings,
  SunMoon,
  Wrench,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { Sheet, useIsPhone, useMediaQuery, useWfBandActive } from "@/components/wf";
import { formatInstantWithDay } from "../ward-clock";
import { useExecutiveStatistics } from "../statistics/executive-statistics-context";
import { releasedCountText, ExecutiveStatisticsUnavailable } from "../statistics/statistics-small-numbers";
import { WardDataModeSlot } from "../ward-shared-access";
import { WardHelpHost, WardHelpScreenButton } from "../help/ward-help-host";
import { openWardHelp } from "../help/ward-help-events";
import { applyAppearance, applyGlare } from "./ward-bar";
import { WardBarBack } from "./ward-bar-controls";
import { wardBarRouteTitle, SERVICE_SWATCH_KEY } from "./ward-bar-model";
import { WardBarFrame, WardRailFrame } from "./ward-chrome-frame";
import { WardAccountActions } from "./ward-account-actions";
import { SharedSessionContext } from "./ward-shared-session-context";
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
import { computeShiftProgress } from "./ward-rail";
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
const loadExecutiveDemoMenu = async () => ExecutiveDemoMenu;
type Panel = "menu" | "activity" | "tasks" | "tools" | "scope" | "appearance" | "demo" | null;

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
  const percent = (service: ExecutiveReportingFoundation["services"][number]) =>
    service.beds.total > 0 ? Math.round((service.beds.inUse / service.beds.total) * 1000) / 10 : 0;
  const services = report.services
    .filter((service) => report.network.scope.kind === "statewide" || service.service === report.network.scope.service)
    .toSorted((a, b) => percent(b) - percent(a) || a.service.localeCompare(b.service));
  const hottest = services[0];
  if (!hottest) return null;
  const metro =
    report.network.scope.kind === "service"
      ? services
      : services.filter((service) => (METRO_HEALTH_SERVICES as readonly string[]).includes(service.service));
  const metroBeds = metro.reduce((sum, service) => sum + service.beds.total, 0);
  const metroInUse = metro.reduce((sum, service) => sum + service.beds.inUse, 0);
  const metroPercent = metroBeds > 0 ? Math.round((metroInUse / metroBeds) * 1000) / 10 : null;
  const alertCount = services.filter((service) => isBedAlert(percent(service))).length;
  const label = `${alertCount === 0 ? "None" : alertCount} over ${BED_ALERT_THRESHOLD_PERCENT}%`;
  const jurisdiction = report.network.scope.kind === "service" ? report.network.scope.service : "Metro";
  const metroLabel = `${jurisdiction} ${metroPercent === null ? "—" : formatOccupancyPercent(metroPercent)}`;
  return (
    <div className={rail.alertsContainer} ref={container}>
      <button
        type="button"
        className={rail.compactAlertPip}
        data-testid="ward-rail-compact-alert-pip"
        aria-label={`${metroLabel} occupied. Bed alerts: ${label}.`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <span className={rail.compactAlertVal}>{metroPercent === null ? "—" : `${Math.round(metroPercent)}%`}</span>
      </button>
      <button
        type="button"
        className={rail.capacityPulseStrip}
        data-open={open ? "true" : undefined}
        data-alert={alertCount > 0 ? "true" : undefined}
        data-testid="ward-rail-capacity-alerts-trigger"
        aria-label={`${metroLabel}. Bed alerts: ${label}.`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <span className={rail.alertFigure}>
          <span className={rail.alertFigureName}>{jurisdiction}</span>{" "}
          <span className={rail.alertFigureValue}>
            {metroPercent === null ? "—" : formatOccupancyPercent(metroPercent)}
          </span>
        </span>
        <span className={rail.alertFigure} data-flex="true">
          <span className={rail.alertFigureName}>{hottest.service}</span>{" "}
          <span className={rail.alertFigureValue}>{formatOccupancyPercent(percent(hottest))}</span>
        </span>
        <ChevronDown aria-hidden="true" className={rail.capacityChevron} />
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
                  <span className={rail.alertPercent}>{formatOccupancyPercent(percent(service))}</span>
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
  const [panel, setPanel] = useState<Panel>(null);
  const [menuQuery, setMenuQuery] = useState("");
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
        setMenuQuery("");
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
  const resolvedMenu = roleMenu(entries, "executive");
  const menu = { ...resolvedMenu, main: resolvedMenu.main.filter((entry): entry is RailEntry => "href" in entry) };
  const scope = report.network.scope;
  const services = report.services.filter((service) => scope.kind === "statewide" || service.service === scope.service);
  const activeService =
    scope.kind === "service" ? scope.service : services.find((service) => service.service === selectedService)?.service;
  const displayedScope = activeService ?? "Statewide";
  const displayedWaiting = activeService
    ? report.services.find((service) => service.service === activeService)!.waiting
    : report.network.people.waitingInEd;
  const shift = computeShiftProgress(shell.now);
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
        onClick={() => {
          if (kind === "help") {
            close();
            openWardHelp("screen");
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
            <div className={rail.shiftCockpit}>
              <div
                className={rail.shiftCockpitTop}
                title={`Board time ${clock} AWST. Shift ${shift.percent}% through.`}
              >
                <span className={rail.shiftAvatar} aria-hidden="true">
                  EX
                </span>
                <span className={rail.shiftMeta}>
                  <span className={rail.shiftTitle}>
                    {shift.shiftName}
                    <span className={rail.shiftHours}>{shift.shiftHours}</span>
                  </span>
                  <span className={rail.shiftSub}>Executive · Demo desk</span>
                </span>
              </div>
              <span className={rail.shiftTimerLink} data-static="true" data-testid="ward-rail-handover-countdown">
                <ClipboardList aria-hidden="true" className={rail.shiftClockIcon} />
                <span className={rail.shiftTimerLabel}>Handover</span>
                <span className={rail.shiftTimeBadge}>
                  {shift.handoverDue ? "due now" : `in ${shift.countdownStr}`}
                </span>
              </span>
            </div>
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
                {!isPhone && <WardHelpScreenButton title={title} className={bar.screenHelp} />}
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
              <WardDataModeSlot className={bar.dataMode} menu={loadExecutiveDemoMenu} />
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
              <span className={bar.mark}>
                <span className={bar.markLong}>Synthetic </span>prototype
              </span>
            </div>
            <div className={bar.centerGroup}>
              <div className={bar.searchWrap}>
                <WardPublicSearch
                  catalogue={report}
                  accessLifetime={shell.accessLifetime ?? ""}
                  canOpenHref={canOpen}
                  placeholder="Search"
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
                onClick={() => setPanel("tasks")}
              >
                <ListChecks className={bar.triggerIcon} aria-hidden="true" />
                <span className={bar.triggerLabel}>Tasks</span>
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
          <nav className={phone.dock} aria-label="Quick open" data-testid="ward-phone-dock">
            <span aria-hidden="true" />
            <Link href={home} className={phone.dockItem} data-testid="ward-phone-dock-link">
              <span className={phone.dockIcon} aria-hidden="true">
                <BarChart3 aria-hidden="true" strokeWidth={1.75} />
              </span>
              <span className={phone.dockLabel}>Statistics</span>
            </Link>
            <span className={phone.riseSlot} aria-hidden="true" />
            <button
              type="button"
              className={phone.dockItem}
              data-testid="ward-phone-menu-tasks"
              aria-haspopup="dialog"
              onClick={() => setPanel("tasks")}
            >
              <span className={phone.dockIcon} aria-hidden="true">
                <ListChecks aria-hidden="true" strokeWidth={1.75} />
              </span>
              <span className={phone.dockLabel}>Tasks</span>
            </button>
            <button
              type="button"
              className={phone.dockItem}
              data-testid="ward-phone-menu-activity"
              aria-haspopup="dialog"
              onClick={(event) => openActivity(event.currentTarget)}
            >
              <span className={phone.dockIcon} aria-hidden="true">
                <RotateCcwClock aria-hidden="true" strokeWidth={1.75} />
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
        <label className={bar.drawerSearch}>
          <span className="sr-only">Filter pages</span>
          <input value={menuQuery} onChange={(event) => setMenuQuery(event.target.value)} placeholder="Filter pages" />
        </label>
        <WardPublicSearch
          catalogue={report}
          accessLifetime={shell.accessLifetime ?? ""}
          canOpenHref={canOpen}
          onNavigate={(href) => {
            close();
            router.push(href);
          }}
        />
        {[{ label: "Executive", entries: menu.main }, ...menu.more].map((group) => (
          <section key={group.label}>
            <h2 className={phone.heading}>{group.label}</h2>
            <ul className={phone.list}>
              {group.entries
                .filter((entry) => entry.label.toLocaleLowerCase().includes(menuQuery.toLocaleLowerCase()))
                .map((entry) => (
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
        title="Tasks"
        returnFocusRef={tasksTrigger}
        contentClassName={bar.drawerSheet}
        bodyClassName={bar.drawerBody}
      >
        <p>This is the bed coordinator&apos;s list. Individual tasks are unavailable for this desk.</p>
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
            Glare
          </button>
        </div>
      </Sheet>
      {panel === "demo" && <ExecutiveDemoMenu onClose={close} />}
      <WardHelpHost />
    </>
  );
}
