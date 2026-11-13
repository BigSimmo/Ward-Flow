"use client";

// The ward screen's ward card and top action bar. Split out of `ward-screen.tsx` (18 October 2026)
// to keep that file under the line cap.

import { WardIntakeWindowControl } from "./ward-intake-window-control";
import { useEffect, useState } from "react";
import { type WardHeroTopInput, wardHeroTopParts } from "./ward-hero-top-parts";
import { Bed, Check, Presentation, Send, Zap } from "lucide-react";
import { plural } from "@/components/ward-management/ward-plural";
import { bedMeetingTvHref } from "@/components/ward-management/ward-nav";
import Link from "next/link";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  buttonClass,
  cx,
  FolderTabs,
  folderTabClasses,
  Hero,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  PhoneSheet,
  Sheet,
  SrOnly,
} from "@/components/wf";
import { WardPhoneFind } from "./ward-phone-find";
import styles from "./ward.module.css";
import pageTop from "../page-top-hero.module.css";
import noticesSheet from "./ward-notices-sheet.module.css";
import { useSinceLastLookReview } from "../since-last-look-pill";
import { WardNotificationCenter } from "./ward-screen-lazy";
import { WardSwitchPopover } from "./ward-switch-menu";
import { useWardStaffContact } from "../staffing/ward-staff-contact";
import type { Dispatch, KeyboardEvent, ReactElement, RefObject, SetStateAction } from "react";
import type { CapacityRefreshRequest, Movement, Notice, Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import type { RoleGate } from "@/components/ward-management/ward-role-gate";
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
  /** The other wards this desk may open, and how to go to one; `null` when there are none. */
  wardSwitch: { units: readonly Unit[]; onChoose: (unitId: string) => void } | null;
  states: BedStateCounts;
  online: boolean;
  now: number;
  confirmTriggerRef: RefObject<HTMLButtonElement | null>;
  openCapacityModal: () => void;
  /** "Day shift 07:00 to 15:00": the hero's title, the hours in the quieter weight. */
  heroTitle: string;
  wardHeroTop: WardHeroTopInput;
  wardHeroMeta: ReactElement | null;
  /** Decisions are due: its tab count is the red circle. */
  decisionsDue: boolean;
  selectActiveTab: (next: "attn" | "board" | "coming" | "out" | "beds" | "referrals" | "return") => void;
  wardMoreMenu: (
    triggerClassName: string,
    tablet: boolean,
    options?: { notices?: boolean; iconOnly?: boolean; testId?: string },
  ) => ReactElement;
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
  /** Buzzes acknowledged on this screen, so the panel lists what the button counts. */
  dismissedBuzzKeys?: readonly string[];
  setNotificationCenterOpen: Dispatch<SetStateAction<boolean>>;
  notificationTriggerRef: RefObject<HTMLButtonElement | null>;
  tabHome: ReactElement;
  tabReferrals: ReactElement;
  tabDecisions: ReactElement;
  bedQuery: string;
  setBedQuery: Dispatch<SetStateAction<string>>;
  activeTab: "attn" | "board" | "coming" | "out" | "beds" | "referrals" | "return";
  tvViewsOn: boolean;
  handleRaiseWardReferral: (bedOverride?: unknown) => void;
  raisedReferral: { href: string; message: string; bed: number | null } | null;
  selectedBed: number | null;
  fullWardReferralHref: (patientId?: string | undefined) => string;
  bedsList: WardScreenBed[];
};

/** The shift's name, then its hours in the quieter weight ("Day shift" "07:00 to 15:00"). */
function splitShift(line: string): { name: string; hours: string } {
  const match = /^(.*?)\s+(\d{1,2}:\d{2}\s+to\s+\d{1,2}:\d{2})$/u.exec(line);
  return match ? { name: match[1]!, hours: match[2]! } : { name: line, hours: "" };
}

export function WardScreenTopBar({
  unit,
  isPhone,
  wardSwitch,
  states,
  online,
  now,
  confirmTriggerRef,
  openCapacityModal,
  heroTitle,
  wardHeroTop,
  wardHeroMeta,
  decisionsDue,
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
  dismissedBuzzKeys,
  setNotificationCenterOpen,
  notificationTriggerRef,
  tabHome,
  tabReferrals,
  tabDecisions,
  bedQuery,
  setBedQuery,
  activeTab,
  tvViewsOn,
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
  // Josh, 1 Nov 2026: the ward's position (ready and occupied) is kept in the heading for screen
  // readers. Page tops (Josh approved, 9 Nov 2026): the header names the ward, so the hero's title is
  // the shift, as Home's names the moment; the ward's name leads the spoken heading.
  const position = `${plural(states.ready, "bed", "beds")} ready, ${states.occupied} occupied`;
  const shift = splitShift(heroTitle);
  const { wardFigures, wardAct, wardBand } = wardHeroTopParts(wardHeroTop);
  const updates = useSinceLastLookReview(`ward:${unit.id}`);
  // Feature 10 and 32 (9 Nov 2026): Staff needed and the ward's contact card, as quick chips; an open
  // staff request's tag sits under the band.
  const staffContact = useWardStaffContact({ unit, now, isPhone });
  const [switchOpen, setSwitchOpen] = useState(false);
  // The confirm dialog returns focus to its opener, and to the Confirm numbers chip when the opener
  // is gone. The chip is drawn by the shared hero parts, so it is found by its test id.
  useEffect(() => {
    const chip = document.querySelector(`[data-testid="ward-confirm-numbers"]`);
    confirmTriggerRef.current = chip instanceof HTMLButtonElement ? chip : null;
  });
  const findBed = (next: string) => {
    setBedQuery(next);
    if (activeTab !== "attn" && activeTab !== "board") selectActiveTab("attn");
  };
  const closeNotices = () => {
    setNotificationCenterOpen(false);
  };
  const tabValue = activeTab === "return" || activeTab === "referrals" ? activeTab : "attn";
  const noticesPanel = (inSheet: boolean) => (
    <WardNotificationCenter
      inSheet={inSheet || undefined}
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
      dismissedBuzzKeys={dismissedBuzzKeys}
      onClose={closeNotices}
    />
  );
  // Phone: the view tabs sit after the ward section, not inside it, so they can pin under the header
  // as the page scrolls (a sticky row only pins within its parent). Wider screens keep them inside.
  const viewTabs = (
    <FolderTabs
      className={isPhone ? styles.folderTabsPinned : undefined}
      label="Ward tabs"
      value={tabValue}
      act={decisionsDue ? 3 : undefined}
      testId="ward-tabs"
      more={
        isPhone ? (
          wardMoreMenu(folderTabClasses.more, true, { notices: true, iconOnly: true, testId: "ward-phone-chip-more" })
        ) : (
          <div className={styles.tabTools} role="toolbar" aria-label="Ward actions">
            {/* Josh, 4 Nov 2026: the find box is the search icon that opens in place, so the tab row
                  keeps its room (page tops: at every desktop width). */}
            <WardPhoneFind value={bedQuery} onChange={findBed} />
            {/* This ward's own TV screen, behind the `bed-meeting-tv` flag. Desktop only. */}
            {tvViewsOn ? (
              <Link
                className={`${buttonClass({ variant: "ghost", size: "sm" })} ${styles.toolSolo}`}
                href={bedMeetingTvHref({ ward: unit.id })}
                data-testid="ward-open-tv"
              >
                <Presentation strokeWidth={1.75} size={16} aria-hidden="true" />
                On TV
              </Link>
            ) : null}
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
            {/* Approved 31 Oct 2026: Notices, Shift brief and Handover sit in the More menu. */}
            {wardMoreMenu(cx(buttonClass({ variant: "ghost", size: "sm" }), folderTabClasses.more), true)}
          </div>
        )
      }
    >
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab */}
      <div
        className={cx(folderTabClasses.switch, styles.folderTabList)}
        role="tablist"
        id="mainTabList"
        aria-label="Ward views"
        onKeyDown={moveBetweenWardTabs}
      >
        {tabHome}
        {tabReferrals}
        {tabDecisions}
      </div>
    </FolderTabs>
  );
  return (
    <>
      <section className={styles.topActionBarWrap} aria-label="This ward" data-testid={`ward-unit-card-${unit.id}`}>
        <h2 className={styles.srOnlyHeading}>This ward</h2>
        <Hero
          className={cx(styles.wardHero, pageTop.hero, folderTabClasses.hero)}
          title={
            <>
              <SrOnly>{`${unit.name}, ${position}.`}</SrOnly> {shift.name}
              {shift.hours ? <span className={pageTop.titleSoft}> {shift.hours}</span> : null}
            </>
          }
          aside={<LiveChip state={online ? "live" : "offline"} onHero age={formatInstant(now)} />}
        >
          <HeroTop
            figures={wardFigures}
            act={wardAct}
            chips={
              <HeroQuickChips
                label="Ward actions"
                items={[
                  {
                    id: "confirm",
                    label: "Confirm numbers",
                    icon: <Check strokeWidth={1.75} aria-hidden="true" />,
                    onClick: openCapacityModal,
                    testId: "ward-confirm-numbers",
                  },
                  {
                    id: "updates",
                    // The since-you-last-looked review, as the old "1 update since 10:27" pill.
                    label: "Updates",
                    icon: <Zap strokeWidth={1.75} aria-hidden="true" />,
                    count: updates.count > 0 ? updates.count : undefined,
                    countLabel: `${updates.count === 1 ? "update" : "updates"} since ${formatInstantWithDay(updates.since, now)}`,
                    onClick: updates.open,
                    testId: "ward-updates",
                  },
                  ...staffContact.chips,
                  // D-116 and D-159: the New referral chip is phone-only. Off the phone the bar's New
                  // menu is the one way in, so the ward top does not repeat it.
                  ...(isPhone && raiseReferralGate.allowed
                    ? [
                        {
                          id: "referral",
                          label: "New referral",
                          icon: <Send strokeWidth={1.75} aria-hidden="true" />,
                          onClick: () => handleRaiseWardReferral(),
                          testId: "ward-new-referral",
                        },
                      ]
                    : []),
                  ...(wardSwitch
                    ? [
                        {
                          id: "switch",
                          label: "Switch ward",
                          ariaLabel: `Switch ward, now ${unit.name}`,
                          icon: <Bed strokeWidth={1.75} aria-hidden="true" />,
                          onClick: () => setSwitchOpen((was) => !was),
                          testId: "ward-switch-btn",
                        },
                      ]
                    : []),
                ]}
              />
            }
            band={wardBand}
          >
            {wardHeroMeta}
            {/* Feature item 13: tonight's intake hours, information only. */}
            {wardHeroMeta ? <WardIntakeWindowControl unit={unit} now={now} /> : null}
            {staffContact.tag}
          </HeroTop>
        </Hero>
        {isPhone ? null : viewTabs}
        {raiseReferralGate.allowed ? null : raiseReferralGate.note}
        {wardRoleLockNote}
        {updates.sheet}
        {wardSwitch ? (
          <WardSwitchPopover
            unit={unit}
            switchUnits={wardSwitch.units}
            onChoose={wardSwitch.onChoose}
            open={switchOpen}
            onClose={() => setSwitchOpen(false)}
            anchorTestId="ward-switch-btn"
          />
        ) : null}
        {isPhone ? (
          // Phone notices (20 Oct 2026): a pop-up sheet, so the page stays put behind it and Close
          // returns to where it was opened.
          <PhoneSheet
            open={notificationCenterOpen}
            onClose={closeNotices}
            title="Notices"
            height="tall"
            returnFocusRef={notificationTriggerRef}
            data-testid="ward-notifications-sheet"
          >
            <div data-testid="ward-notification-center-wrap">{noticesPanel(true)}</div>
          </PhoneSheet>
        ) : (
          // Notices option A (22 Oct 2026): the desktop Notices open as the same right-hand drawer as Alerts.
          <Sheet
            open={notificationCenterOpen}
            onClose={closeNotices}
            ariaLabel="Notices"
            headerHidden
            placement="right"
            returnFocusRef={notificationTriggerRef}
            contentClassName={noticesSheet.sheet}
            bodyClassName={noticesSheet.body}
          >
            {notificationCenterOpen ? <div>{noticesPanel(false)}</div> : null}
          </Sheet>
        )}
        {staffContact.sheets}
      </section>
      {isPhone ? viewTabs : null}
    </>
  );
}
