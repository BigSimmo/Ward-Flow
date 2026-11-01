"use client";

// The Alerts screen's hero: the kit band hero on every screen size (Josh, 1 Nov 2026, Q180 to Q184).
// The role eyebrow and one purpose line say what this desk's Alerts is for, the title is one
// headline ("3 need you now"), and the hero keeps one action with the rest under More.
// Moved out of `alerts-screen.tsx` for the line cap.
import type { ReactNode, RefObject } from "react";
import { Bell, BellRing, ChevronRight, Copy, MoreHorizontal, Pause, Play, Radio } from "lucide-react";

import {
  Button,
  Hero,
  LiveChip,
  Menu,
  PhoneSheet,
  StatusGlyph,
  phoneRows,
  type MenuItem,
  type WfTone,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { PageLiveChip, type usePageLive } from "@/components/ward-management/ward-page-live";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "@/components/ward-management/ward-flow-roles";

import type { getActiveBroadcastAlert } from "./ward-broadcast-model";
import { minutesText } from "./alerts-model";
import type { QueueEntry } from "./alerts-queue";
import styles from "./alerts.module.css";

export type AlertsTab = "now" | "earlier";

/** Q182: one sentence per desk on what its Alerts page is for. */
const ALERTS_PURPOSE: Record<WardFlowRole, string> = {
  coordinator: "Late or blocked across the state. Your planned work is in Tasks.",
  demo: "Late or blocked across the state. Your planned work is in Tasks.",
  bed_manager: "Late or blocked across your site. Your planned work is in Tasks.",
  ward: "Late or blocked for your ward. Your planned work is in Tasks.",
  ed: "Your patients waiting on a bed, a reply or a form.",
  officer: "Your transport jobs that are due or late. Bookings are in My jobs.",
  community: "Your team's referrals and transfers that are stuck.",
  executive: "What is late or blocked across the state, to read.",
};

/** Q183: one headline for every desk, Transport included. */
export function alertsHeadline(count: number): string {
  if (count === 0) return "Nothing needs you";
  return `${count} need${count === 1 ? "s" : ""} you now`;
}

export function AlertsHero({
  isPhone,
  heroTitle,
  place,
  oldestRaised,
  now,
  live,
  yoursCount,
  handleNext,
  broadcastTriggerRef,
  openComposer,
  broadcastDisabledReason,
  activeBroadcast,
  onOpenBroadcast,
  directiveTone,
  broadcastAcks,
  phoneToday,
  setPhoneToday,
  todayChart,
  notifyOn,
  handleNotify,
  nextQueue,
  handleCopy,
  checkingFoot,
  todayBand,
}: {
  isPhone: boolean;
  heroTitle: string;
  /** Where the desk is, in words ("Statewide", the ward or ED name). */
  place: string;
  oldestRaised: Instant | undefined;
  now: Instant;
  live: ReturnType<typeof usePageLive>;
  yoursCount: number;
  handleNext: () => void;
  broadcastTriggerRef: RefObject<HTMLButtonElement | null>;
  openComposer: (trigger: HTMLButtonElement) => void;
  /** Why this desk cannot broadcast, or undefined when it may. */
  broadcastDisabledReason?: string;
  activeBroadcast: ReturnType<typeof getActiveBroadcastAlert>;
  /** Opens Now at the live broadcast (Q181). */
  onOpenBroadcast: () => void;
  directiveTone: WfTone;
  broadcastAcks: { acknowledged: number; of: number } | undefined;
  phoneToday: boolean;
  setPhoneToday: (open: boolean) => void;
  todayChart: ReactNode;
  notifyOn: boolean;
  handleNotify: () => void;
  nextQueue: QueueEntry[];
  handleCopy: () => void;
  checkingFoot: ReactNode;
  /** Desktop: the Today track and at-a-glance line, drawn in the band's foot. */
  todayBand?: ReactNode;
}) {
  const access = useEffectiveWardAccess();
  const deskRole: WardFlowRole = access.role === "admin" ? "executive" : access.role;
  // Transport officer: only the coordinator takes an alert and only the coordinator or a bed manager
  // broadcasts, so "Yours" is always 0 and Broadcast never works here. Both are left out.
  const officerDesk = deskRole === "officer";
  // Nurse in charge: a ward desk never broadcasts, so the greyed Broadcast is left out too.
  const wardDesk = deskRole === "ward";
  const canBroadcast = !officerDesk && !wardDesk;
  const showNext = nextQueue.length > 0;
  const roleLabel = WARD_FLOW_ROLE_LABELS[deskRole];
  const eyebrow = isPhone ? `${roleLabel} · ${place}` : `Alerts · ${roleLabel} · ${place}`;

  const meta: ReactNode[] = [];
  if (oldestRaised !== undefined) {
    meta.push(
      <>
        oldest <span className={styles.mono}>{minutesText(Math.max(0, now - oldestRaised))}</span>
      </>,
    );
  }
  if (!officerDesk && yoursCount > 0) {
    meta.push(
      <>
        <span className={styles.mono}>{yoursCount}</span> yours
      </>,
    );
  }
  const titleMeta =
    meta.length > 0 ? (
      <span className={styles.heroMeta}>
        {meta.map((part, index) => (
          <span key={index}>
            {index > 0 ? " · " : null}
            {part}
          </span>
        ))}
      </span>
    ) : undefined;

  // Q184: one action on the hero (the next alert in turn); Pause, Notify, Copy and Broadcast sit
  // under More. A statewide broadcast is never a single tap from the hero (P017).
  const moreItems: MenuItem[] = [
    ...(canBroadcast
      ? [
          {
            id: "broadcast",
            label: "Broadcast alert",
            icon: Radio,
            disabled: broadcastDisabledReason !== undefined,
            meta: broadcastDisabledReason,
            onSelect: () => {
              if (broadcastTriggerRef.current) openComposer(broadcastTriggerRef.current);
            },
          },
        ]
      : []),
    ...(officerDesk ? [] : [{ id: "copy", label: "Copy for handover", icon: Copy, onSelect: handleCopy }]),
    {
      id: "notify",
      label: "Notify me",
      icon: notifyOn ? BellRing : Bell,
      checked: notifyOn,
      closeOnSelect: true,
      meta: "No patient detail",
      onSelect: handleNotify,
    },
    {
      id: "pause",
      label: live.paused ? "Resume live updates" : "Hold the list still",
      icon: live.paused ? Play : Pause,
      onSelect: live.togglePause,
    },
  ];
  const more = (
    <Menu
      label="More alert actions"
      align="end"
      items={moreItems}
      trigger={(props) => (
        <Button
          {...props}
          ref={(element: HTMLButtonElement | null) => {
            props.ref.current = element;
            broadcastTriggerRef.current = element;
          }}
          className={isPhone ? phoneRows.heroPill : undefined}
          variant="onHero"
          size={isPhone ? undefined : "sm"}
          icon={MoreHorizontal}
          aria-label="More alert actions"
          data-testid="ward-alerts-more"
        />
      )}
    />
  );
  const next = showNext ? (
    // The one light (primary) face on the hero, as the approved mock-up draws it on every size.
    <Button
      variant="light"
      size={isPhone ? undefined : "sm"}
      icon={ChevronRight}
      aria-label={`Next alert, ${nextQueue.length} in turn`}
      count={nextQueue.length}
      onClick={handleNext}
      data-testid={isPhone ? "ward-alerts-phone-next" : "ward-alerts-next"}
    >
      Next alert
    </Button>
  ) : null;

  // Q181: a live broadcast shows in the hero, on every screen size.
  const directive = activeBroadcast ? (
    <button
      type="button"
      className={styles.heroDirective}
      onClick={onOpenBroadcast}
      data-testid="ward-alerts-hero-broadcast"
    >
      <StatusGlyph tone={directiveTone} />
      <span className={styles.phoneCardText}>
        <span className={styles.phoneCardTitle}>Broadcast live: {activeBroadcast.title}</span>
        <span className={styles.phoneCardMeta}>
          {broadcastAcks ? (
            <>
              <b className={styles.mono}>{broadcastAcks.acknowledged}</b> of{" "}
              <span className={styles.mono}>{broadcastAcks.of}</span> answered ·{" "}
            </>
          ) : null}
          ends <span className={styles.mono}>{formatInstantWithDay(activeBroadcast.expiresAt, now)}</span>
        </span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  ) : null;

  return (
    <>
      <Hero
        level={1}
        testId={isPhone ? "ward-alerts-phone-hero" : "ward-alerts-hero"}
        eyebrow={eyebrow}
        phoneEyebrow="show"
        purpose={ALERTS_PURPOSE[deskRole]}
        title={heroTitle}
        titleMeta={titleMeta}
        aside={
          isPhone ? (
            <LiveChip state={live.paused ? "paused" : "live"} onHero />
          ) : (
            <div className={styles.heroTools}>
              <PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />
              {next}
              {more}
            </div>
          )
        }
        bar={
          isPhone ? (
            <div className={styles.heroPhoneBar}>
              {directive}
              <div className={styles.heroPhoneActs}>
                {next}
                {more}
              </div>
            </div>
          ) : (
            (directive ?? undefined)
          )
        }
        // A quiet ward's checks sit in the side panel instead, so the screen may pass no foot.
        foot={
          isPhone
            ? undefined
            : (todayBand ?? (checkingFoot ? <div className={styles.checkingFootWide}>{checkingFoot}</div> : undefined))
        }
      />
      {isPhone ? (
        <PhoneSheet open={phoneToday} onClose={() => setPhoneToday(false)} title="Today" height="tall">
          <div className={styles.phoneChecks}>{todayChart}</div>
        </PhoneSheet>
      ) : null}
    </>
  );
}
