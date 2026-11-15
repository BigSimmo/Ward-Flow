"use client";

// The Alerts screen's top. Page tops (Josh, 9 Nov 2026): one hero at every width, as on Home: the
// act now, waiting and oldest figures, the next alert as the act row, Yours and Broadcast as chips
// and one slim Today band. On a desktop the Today timeline sits above that band. Moved out of
// `alerts-screen.tsx` for the line cap.
import type { ReactNode } from "react";
import { Bell, BellRing, Copy, Ellipsis, Radio, User } from "lucide-react";

import {
  Button,
  cx,
  folderTabClasses,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  Menu,
  SrOnly,
  type HeroChipItem,
} from "@/components/wf";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { usePageLive } from "@/components/ward-management/ward-page-live";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";

import type { getActiveBroadcastAlert } from "./ward-broadcast-model";
import { minutesText, shownAgeFrom } from "./alerts-model";
import type { QueueEntry } from "./alerts-queue";
import titles from "@/components/ward-management/page-top-title.module.css";
import styles from "./alerts.module.css";

export type AlertsTab = "now" | "earlier";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

type TopFilter = { count: number; on: boolean; toggle: () => void };

/**
 * The top's filters: the Yours chip and the Act now figure, for a desk that has each filter at all.
 * Choosing one opens Open; choosing it again shows everything. A phone has no other Act now filter.
 */
export function topFilters(
  lens: {
    counts: { yours?: number; act?: number };
    filter: string;
    setFilter: (filter: "all" | "yours" | "act") => void;
  },
  openNow: () => void,
): { yours?: TopFilter; act?: TopFilter } {
  const toggle = (id: "yours" | "act"): TopFilter | undefined => {
    const count = lens.counts[id];
    if (count === undefined) return undefined;
    return {
      count,
      on: lens.filter === id,
      toggle: () => {
        openNow();
        lens.setFilter(lens.filter === id ? "all" : id);
      },
    };
  };
  return { yours: toggle("yours"), act: toggle("act") };
}

/** The rarer tools, at the end of the tab row: copy for handover and tab notifications. */
export function AlertsToolsMenu({
  canCopy,
  onCopy,
  notifyOn,
  onNotify,
}: {
  canCopy: boolean;
  onCopy: () => void;
  notifyOn: boolean;
  onNotify: () => void;
}) {
  return (
    <Menu
      label="More alert tools"
      align="end"
      items={[
        ...(canCopy ? [{ id: "copy", label: "Copy for handover", icon: Copy, onSelect: onCopy }] : []),
        {
          id: "notify",
          label: "Notify me in this tab",
          icon: notifyOn ? BellRing : Bell,
          checked: notifyOn,
          meta: "No patient detail",
          onSelect: onNotify,
        },
      ]}
      trigger={(props) => (
        <Button {...props} variant="ghost" size="sm" iconOnly icon={Ellipsis} aria-label="More alert tools" />
      )}
    />
  );
}

export function AlertsHero({
  isPhone,
  wardName,
  oldestRaised,
  now,
  live,
  actCount,
  waitEntries,
  filters: { yours, act } = {},
  handleNext,
  openComposer,
  broadcastDisabledReason,
  activeBroadcast,
  onOpenBroadcast,
  broadcastAcks,
  nextQueue,
  today,
  checks,
  onChecking,
  onToday,
  todayBand,
}: {
  isPhone: boolean;
  /** The desk's own ward, for "No alert for <ward>". */
  wardName: string | undefined;
  oldestRaised: Instant | undefined;
  now: Instant;
  live: ReturnType<typeof usePageLive>;
  /** Act now: the act-now alerts plus accepted referrals with no bed pulled (Q111). */
  actCount: number;
  waitEntries: QueueEntry[];
  /** The Yours and Act now filters: each count and whether it is on. Each is absent for a desk without it. */
  filters?: { yours?: TopFilter; act?: TopFilter };
  handleNext: () => void;
  openComposer: (trigger: HTMLButtonElement) => void;
  /** Why this desk cannot broadcast, or undefined when it may. */
  broadcastDisabledReason?: string;
  activeBroadcast: ReturnType<typeof getActiveBroadcastAlert>;
  /** Opens Broadcasts at the live broadcast (Q181). */
  onOpenBroadcast: () => void;
  broadcastAcks: { acknowledged: number; of: number } | undefined;
  nextQueue: QueueEntry[];
  /** Today's raised and acted-on counts, as the timeline draws them. */
  today: { raised: number; acted: number };
  /** The Checking conditions; a tap opens the Checking sheet. Absent for a quiet ward. */
  checks?: readonly { n: number }[];
  onChecking: () => void;
  /** Phone: Raised opens the Today sheet with the timeline. */
  onToday: () => void;
  /** Desktop: the Today timeline, drawn above the Today band. */
  todayBand?: ReactNode;
}) {
  const deskRole = useEffectiveWardAccess().role;
  // Transport officer: only the coordinator takes an alert and only the coordinator or a bed manager
  // broadcasts, so Broadcast is left out. Nurse in charge: a ward desk never broadcasts either.
  const canBroadcast = deskRole !== "officer" && deskRole !== "ward" && broadcastDisabledReason === undefined;
  const next = nextQueue[0];
  const nextFrom = next ? shownAgeFrom(next.item, next.raised) : undefined;
  const flagged = checks?.filter((check) => check.n > 0).length ?? 0;

  const chips: HeroChipItem[] = [
    ...(yours
      ? [
          {
            id: "yours",
            label: "Yours",
            icon: <User {...ICON} />,
            count: yours.count,
            countTone: "quiet" as const,
            pressed: yours.on,
            onClick: yours.toggle,
            testId: "ward-alerts-yours",
          },
        ]
      : []),
    ...(canBroadcast
      ? [
          {
            id: "broadcast",
            label: "Broadcast alert",
            icon: <Radio {...ICON} />,
            testId: "ward-alerts-broadcast",
            onClick: () => {
              // The composer returns focus to the button that opened it.
              const trigger = document.querySelector<HTMLButtonElement>('[data-testid="ward-alerts-broadcast"]');
              if (trigger) openComposer(trigger);
            },
          },
        ]
      : []),
  ];

  return (
    <Hero
      level={1}
      className={cx(titles.hero, folderTabClasses.hero)}
      testId="ward-alerts-hero"
      title={
        <>
          Alerts <span className={titles.soft}>needing a person</span>
        </>
      }
      aside={
        <LiveChip
          state={live.paused ? "paused" : "live"}
          onHero
          age={formatInstant(now)}
          onTogglePause={live.togglePause}
        />
      }
    >
      <HeroTop
        testId="ward-alerts-top"
        figures={
          <HeroFigures
            items={[
              {
                id: "act",
                value: actCount,
                label: "act now",
                tone: actCount > 0 ? "danger" : undefined,
                ...(act ? { onClick: act.toggle, pressed: act.on } : {}),
                testId: "ward-alerts-figure-act",
              },
              { id: "wait", value: waitEntries.length, label: "waiting", testId: "ward-alerts-figure-wait" },
              ...(oldestRaised !== undefined
                ? [
                    {
                      id: "oldest",
                      value: minutesText(Math.max(0, now - oldestRaised)),
                      label: "oldest",
                      testId: "ward-alerts-figure-oldest",
                    },
                  ]
                : []),
            ]}
          />
        }
        act={
          next ? (
            <HeroAct
              tone={next.group === "act" ? "danger" : "warning"}
              testId="ward-alerts-next"
              title={
                <>
                  {next.item.title}
                  {nextFrom !== undefined ? (
                    <span className={titles.soft}> · {minutesText(Math.max(0, now - nextFrom))}</span>
                  ) : null}
                </>
              }
              action={{
                label: "Next alert",
                phoneLabel: "Next",
                onClick: handleNext,
                testId: "ward-alerts-next-action",
              }}
            />
          ) : (
            <HeroAct
              tone="calm"
              testId="ward-alerts-next"
              titleTestId="ward-alerts-calm"
              title={wardName ? `No alert for ${wardName}` : "No alert needs you"}
            />
          )
        }
        chips={chips.length > 0 ? <HeroQuickChips label="Alert actions" items={chips} /> : undefined}
      >
        {isPhone ? null : todayBand}
        <div className={isPhone ? styles.todayReserve : undefined}>
          <HeroBand
            // On a desktop the timeline above already heads it "Today".
            title={isPhone ? "Today" : <SrOnly>Today</SrOnly>}
            testId="ward-alerts-today"
            cells={[
              {
                id: "raised",
                label: "Raised",
                value: today.raised,
                onClick: isPhone ? onToday : undefined,
                ariaLabel: isPhone ? `Raised ${today.raised}, open the Today timeline` : undefined,
              },
              { id: "acted", label: "Acted on", value: today.acted },
              ...(checks
                ? [
                    {
                      id: "checking",
                      label: "Checking",
                      value: (
                        <>
                          {flagged}{" "}
                          <span className={styles.bandWords}>
                            flagged · <b>{checks.length - flagged}</b> clear
                          </span>
                        </>
                      ),
                      onClick: onChecking,
                      ariaLabel: `Checking ${flagged} flagged · ${checks.length - flagged} clear`,
                      testId: "ward-alerts-checking",
                    },
                  ]
                : []),
              activeBroadcast
                ? {
                    id: "broadcast",
                    label: "Broadcast",
                    value: "live",
                    quiet: true,
                    sub: broadcastAcks
                      ? `${broadcastAcks.acknowledged} of ${broadcastAcks.of} answered · ${minutesText(Math.max(0, activeBroadcast.expiresAt - now))} left`
                      : `${minutesText(Math.max(0, activeBroadcast.expiresAt - now))} left`,
                    onClick: onOpenBroadcast,
                    testId: "ward-alerts-broadcast-live",
                  }
                : { id: "broadcast", label: "Broadcast", value: "none live", quiet: true },
            ]}
          />
        </div>
      </HeroTop>
    </Hero>
  );
}
