"use client";

// The ward screen's ward card and top action bar. Split out of `ward-screen.tsx` (18 October 2026)
// to keep that file under the line cap.

import { Bell, FileText, Printer, Search, Send, Tv } from "lucide-react";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import Link from "next/link";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { buttonClass, Hero, LiveChip, PhoneSheet, Sheet, TextInput } from "@/components/wf";
import styles from "./ward.module.css";
import noticesSheet from "./ward-notices-sheet.module.css";
import { SinceLastLookPill } from "../since-last-look-pill";
import { WardNotificationCenter } from "./ward-screen-lazy";
import type { Dispatch, KeyboardEvent, ReactElement, RefObject, SetStateAction } from "react";
import type { CapacityRefreshRequest, Movement, Notice, Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
import type { SiteIdentity } from "@/components/ward-management/ward-sites";
import type { WardScreenBed } from "./ward-screen-derivations";

/** The ward card and top action bar, drawn from the ward screen's own state. */
/**
 * Design audit DA-36: the ward views follow the tabs pattern. Left and Right move to the next view and
 * open it, Home and End go to the first and last. Up and Down stay with the page, as the tabs run
 * across. Read from the list itself, so it
 * keeps the phone's order and the desktop's order without knowing either.
 */
export function moveBetweenWardTabs(event: KeyboardEvent<HTMLElement>): void {
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const current = tabs.findIndex((tab) => tab === document.activeElement);
  if (current === -1) return;
  let next: number | null = null;
  if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
  else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  if (next === null) return;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}

type WardScreenTopBarProps = {
  unit: Unit;
  isPhone: boolean;
  site: SiteIdentity | undefined;
  wardSwitchMenu: ReactElement | null;
  states: BedStateCounts;
  online: boolean;
  now: number;
  confirmTriggerRef: RefObject<HTMLButtonElement | null>;
  openCapacityModal: () => void;
  wardRibbon: ReactElement;
  wardHeroFoot: ReactElement;
  wardHeroFootAside: ReactElement;
  selectActiveTab: (next: "attn" | "board" | "coming" | "out" | "beds" | "return") => void;
  wardMoreMenu: (triggerClassName: string, tablet: boolean) => ReactElement;
  raiseReferralGate: RoleGate;
  wardRoleLockNote: ReactElement | null;
  notificationCenterOpen: boolean;
  movements: Movement[];
  notices: Notice[];
  refreshRequests: CapacityRefreshRequest[];
  isRollupConfirmedToday: boolean;
  morningRollupDeadlinePassed: boolean;
  morningRollupDeadlineMinutes: number;
  handleConfirmMorningRollup: () => void;
  handleAcknowledgeNotice: (noticeId: string) => void;
  handleDismissBuzz: (buzzKey: string) => void;
  setNotificationCenterOpen: Dispatch<SetStateAction<boolean>>;
  notificationTriggerRef: RefObject<HTMLButtonElement | null>;
  tabHome: ReactElement;
  tabDecisions: ReactElement;
  bedQuery: string;
  setBedQuery: Dispatch<SetStateAction<string>>;
  activeTab: "attn" | "board" | "coming" | "out" | "beds" | "return";
  unreadAlertsCount: number;
  setDailySheetOpen: Dispatch<SetStateAction<boolean>>;
  tvViewsOn: boolean;
  handoverHref: string;
  handleRaiseWardReferral: (bedOverride?: unknown) => void;
  raisedReferral: { href: string; message: string; bed: number | null } | null;
  selectedBed: number | null;
  fullWardReferralHref: (patientId?: string | undefined) => string;
  bedsList: WardScreenBed[];
};

export function WardScreenTopBar({
  unit,
  isPhone,
  site,
  wardSwitchMenu,
  states,
  online,
  now,
  confirmTriggerRef,
  openCapacityModal,
  wardRibbon,
  wardHeroFoot,
  wardHeroFootAside,
  selectActiveTab,
  wardMoreMenu,
  raiseReferralGate,
  wardRoleLockNote,
  notificationCenterOpen,
  movements,
  notices,
  refreshRequests,
  isRollupConfirmedToday,
  morningRollupDeadlinePassed,
  morningRollupDeadlineMinutes,
  handleConfirmMorningRollup,
  handleAcknowledgeNotice,
  handleDismissBuzz,
  setNotificationCenterOpen,
  notificationTriggerRef,
  tabHome,
  tabDecisions,
  bedQuery,
  setBedQuery,
  activeTab,
  unreadAlertsCount,
  setDailySheetOpen,
  tvViewsOn,
  handoverHref,
  handleRaiseWardReferral,
  raisedReferral,
  selectedBed,
  fullWardReferralHref,
  bedsList,
}: WardScreenTopBarProps) {
  // Opted out of the React Compiler: before the 18 Oct 2026 file split this code ran unmemoised
  // inside WardScreen, which the compiler skips. Memoising it changed nothing visible but added
  // several KB to the phone download (script-budget.json).
  "use no memo";
  const closePhoneNotices = () => {
    setNotificationCenterOpen(false);
  };
  const confirmButton = (
    <button
      ref={confirmTriggerRef}
      type="button"
      className={isPhone ? styles.phoneHeroAction : buttonClass({ variant: "light", size: "sm" })}
      onClick={() => {
        openCapacityModal();
      }}
    >
      Confirm numbers
    </button>
  );
  return (
    <section className={styles.topActionBarWrap} aria-label="This ward" data-testid={`ward-unit-card-${unit.id}`}>
      <h2 className={styles.srOnlyHeading}>This ward</h2>
      <Hero
        className={styles.wardHero}
        eyebrow={
          isPhone
            ? `${site ? site.name.replace(/\s+(Public Hospital|Hospital|Health Campus|Health Service)$/u, "") : unit.siteCode}${unitHealthService(unit) ? ` · ${unitHealthService(unit)}` : ""}`
            : `Ward · ${site ? site.name : unit.siteCode}${unitHealthService(unit) ? ` · ${unitHealthService(unit)}` : ""}`
        }
        title={
          isPhone ? (
            // Option B (20 Oct 2026): the ward name is the Switch ward button when there is a ward to
            // switch to, so the name shows once with no separate chevron box.
            <span className={styles.phoneHeroTitle}>
              {wardSwitchMenu ?? <span className={styles.phoneHeroName}>{unit.name}</span>}
            </span>
          ) : (
            unit.name
          )
        }
        titleMeta={isPhone ? `${unit.beds} beds · ${states.occupied} occupied` : wardSwitchMenu}
        aside={
          isPhone ? (
            <>
              <SinceLastLookPill scopeKey={`ward:${unit.id}`} />
              <LiveChip state={online ? "live" : "offline"} onHero age={formatInstant(now)} />
            </>
          ) : (
            <>
              <SinceLastLookPill scopeKey={`ward:${unit.id}`} />
              <LiveChip state={online ? "live" : "offline"} onHero age={formatInstant(now)} />
              {confirmButton}
            </>
          )
        }
        stats={isPhone ? wardRibbon : undefined}
        bar={isPhone ? undefined : wardRibbon}
        foot={
          isPhone ? (
            // Option B: the numbers' confirm time and a quieter Confirm numbers sit under them, with
            // Notices (the bell) and More beside it, where the chips above the tabs used to be.
            <span className={styles.phoneHeroFoot}>
              <span className={styles.phoneHeroConfirmed}>
                {unit.allocatable.source === "ward" ? "Capacity confirmed" : "Last capacity figure"}{" "}
                {formatInstant(unit.allocatable.confirmedAt)}
              </span>
              {confirmButton}
              <button
                ref={notificationTriggerRef}
                type="button"
                className={styles.phoneHeroIcon}
                onClick={() => {
                  setNotificationCenterOpen((prev) => !prev);
                }}
                aria-expanded={notificationCenterOpen}
                aria-label={unreadAlertsCount > 0 ? `Notices, ${unreadAlertsCount} new` : "Notices"}
                data-testid="ward-notifications-toggle-btn"
              >
                <Bell size={20} aria-hidden="true" />
                {unreadAlertsCount > 0 ? (
                  <span className={styles.phoneHeroBadge} data-testid="ward-notification-count-badge">
                    {unreadAlertsCount}
                  </span>
                ) : null}
              </button>
              {wardMoreMenu(styles.phoneHeroIcon, false)}
            </span>
          ) : (
            wardHeroFoot
          )
        }
        footAside={isPhone ? undefined : wardHeroFootAside}
      />

      {isPhone ? (
        <>
          {raiseReferralGate.note}
          {wardRoleLockNote}
          {/* Phone notices (20 Oct 2026): the bell opens a pop-up sheet rather than a panel pushed
              into the page, so the page stays put behind it and Close returns to the bell. */}
          <PhoneSheet
            open={notificationCenterOpen}
            onClose={closePhoneNotices}
            title="Notices"
            height="tall"
            returnFocusRef={notificationTriggerRef}
            data-testid="ward-notifications-sheet"
          >
            {/* The sheet closes from its own Close, scrim and Escape. */}
            <div data-testid="ward-notification-center-wrap">
              <WardNotificationCenter
                inSheet
                unitId={unit.id}
                unitName={unit.name}
                now={now}
                movements={movements}
                notices={notices}
                refreshRequests={refreshRequests}
                allocatable={unit.allocatable}
                morningRollupConfirmed={isRollupConfirmedToday}
                morningRollupDeadlinePassed={morningRollupDeadlinePassed}
                morningRollupDeadlineMinutes={morningRollupDeadlineMinutes}
                onConfirmMorningRollup={handleConfirmMorningRollup}
                onAcknowledgeNotice={handleAcknowledgeNotice}
                onDismissBuzz={handleDismissBuzz}
                onClose={closePhoneNotices}
              />
            </div>
          </PhoneSheet>
        </>
      ) : null}
      {isPhone ? null : (
        <nav className={styles.tabBarWrap} aria-label="Ward Operational Tabs">
          <ul
            className={styles.tabList}
            role="tablist"
            id="mainTabList"
            aria-label="Ward views"
            onKeyDown={moveBetweenWardTabs}
          >
            {tabHome}
            {tabDecisions}
          </ul>
          {isPhone ? null : (
            <div className={styles.tabTools} role="toolbar" aria-label="Ward actions">
              <TextInput
                type="search"
                icon={Search}
                boxClassName={styles.findBox}
                aria-label="Find a bed or person on this ward"
                placeholder="Find bed or person"
                value={bedQuery}
                onChange={(event) => {
                  setBedQuery(event.target.value);
                  if (activeTab !== "attn" && activeTab !== "board") selectActiveTab("attn");
                }}
                onClear={() => {
                  setBedQuery("");
                }}
                data-testid="ward-find-input"
              />
              <div className={styles.notificationTriggerWrap}>
                <button
                  ref={notificationTriggerRef}
                  type="button"
                  className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolSolo}`}
                  onClick={() => {
                    setNotificationCenterOpen((prev) => !prev);
                  }}
                  aria-expanded={notificationCenterOpen}
                  data-testid="ward-notifications-toggle-btn"
                  title="Buzzes, urgent tasks and notices"
                >
                  <Bell size={16} aria-hidden="true" />
                  <span>Notices</span>
                  {unreadAlertsCount > 0 ? (
                    <span className={styles.notificationCountBadge} data-testid="ward-notification-count-badge">
                      {unreadAlertsCount}
                    </span>
                  ) : null}
                </button>
                {/* Notices option A (22 Oct 2026): the desktop Notices open as the same right-hand drawer as
                    Alerts, rather than a popover over the bed board. The Sheet closes itself. */}
                <Sheet
                  open={notificationCenterOpen}
                  onClose={() => setNotificationCenterOpen(false)}
                  ariaLabel="Notices"
                  headerHidden
                  placement="right"
                  returnFocusRef={notificationTriggerRef}
                  contentClassName={noticesSheet.sheet}
                  bodyClassName={noticesSheet.body}
                >
                  {notificationCenterOpen ? (
                    <div>
                      <WardNotificationCenter
                        unitId={unit.id}
                        unitName={unit.name}
                        now={now}
                        movements={movements}
                        notices={notices}
                        refreshRequests={refreshRequests}
                        allocatable={unit.allocatable}
                        morningRollupConfirmed={isRollupConfirmedToday}
                        morningRollupDeadlinePassed={morningRollupDeadlinePassed}
                        morningRollupDeadlineMinutes={morningRollupDeadlineMinutes}
                        onConfirmMorningRollup={handleConfirmMorningRollup}
                        onAcknowledgeNotice={handleAcknowledgeNotice}
                        onDismissBuzz={handleDismissBuzz}
                        onClose={() => setNotificationCenterOpen(false)}
                      />
                    </div>
                  ) : null}
                </Sheet>
              </div>
              <button
                type="button"
                className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolSolo}`}
                onClick={() => {
                  setDailySheetOpen(true);
                }}
                title="Open this shift's brief."
                data-testid="ward-open-daily-sheet-btn"
              >
                <FileText size={16} aria-hidden="true" />
                Shift brief
              </button>
              {/* This ward's own TV screen, behind the `bed-meeting-tv` flag. Desktop only. */}
              {tvViewsOn && !isPhone ? (
                <Link
                  className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolSolo}`}
                  href={bedMeetingTvHref({ ward: unit.id })}
                  data-testid="ward-open-tv"
                >
                  <Tv size={16} aria-hidden="true" />
                  On TV
                </Link>
              ) : null}
              <Link
                className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolWide} ${styles.toolSolo}`}
                href={handoverHref}
              >
                <Printer size={16} aria-hidden="true" />
                Handover
              </Link>
              <span className={styles.toolMore}>
                {wardMoreMenu(buttonClass({ variant: "ghost", size: "sm" }), true)}
              </span>
              <button
                type="button"
                className={buttonClass({ variant: "sec", size: "sm" })}
                onClick={handleRaiseWardReferral}
                title="Record a ward-to-ward referral with this ward as the sending ward."
                {...raiseReferralGate.buttonProps}
              >
                <Send size={16} aria-hidden="true" />
                Raise referral
              </button>
              <Link
                className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolWide}`}
                href={
                  (raisedReferral && raisedReferral.bed === selectedBed ? raisedReferral.href : null) ??
                  fullWardReferralHref(
                    selectedBed !== null
                      ? bedsList.find((b) => b.bedNumber === selectedBed)?.patientInfo?.patient?.id
                      : undefined,
                  )
                }
                data-testid="ward-open-full-referral-form-link"
                aria-label="Open the full referral form"
              >
                {/* Usability audit 24 Oct 2026: the longer label was cut off at 1280 px. */}
                Referral form
              </Link>
              {raiseReferralGate.note}
              {wardRoleLockNote}
            </div>
          )}
        </nav>
      )}
    </section>
  );
}
