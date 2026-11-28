"use client";

// The Alerts screen's top. Page tops (Josh, 9 Nov 2026): one hero at every width, as on Home: the
// act now, waiting and oldest figures, the next alert as the act row with Broadcast at its end
// and one slim Today band. On a desktop the Today timeline sits above that band. Moved out of
// `alerts-screen.tsx` for the line cap.
import type { ReactNode } from "react";
import { Bell, BellRing, ChevronDown, Copy, Radio } from "lucide-react";

import {
  Button,
  cx,
  folderTabClasses,
  Hero,
  HeroAct,
  HeroBand,
  heroChipClassName,
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
  // Simplification R4 (mock-up, 26 Nov 2026): with nothing to copy the menu held one item, so that
  // item stands as a plain button with its own label.
  if (!canCopy)
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={notifyOn ? BellRing : Bell}
        aria-pressed={notifyOn}
        title="No patient detail"
        className={folderTabClasses.more}
        onClick={onNotify}
        data-testid="alerts-notify-toggle"
      >
        Notify me in this tab
      </Button>
    );
  return (
    <Menu
      label="More"
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
        // Audit four item 39: the dots menu is named More, as on every other page; its two items stay.
        <Button
          {...props}
          variant="ghost"
          size="sm"
          iconEnd={ChevronDown}
          // Audit four item 25: the tab row's own ink, so More reads on the band in light and dark.
          className={`${folderTabClasses.more} ${folderTabClasses.moreOutlined}`}
          aria-label="More alert tools"
        >
          More
        </Button>
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

  // #48: Yours moved into the Open filter chips; Broadcast is the only hero chip left.
  // The composer returns focus to the button that opened it.
  const onBroadcast = (event: { currentTarget: HTMLButtonElement }) => openComposer(event.currentTarget);
  const chips: HeroChipItem[] = [
    ...(canBroadcast
      ? [
          isPhone
            ? {
                // Review (390): the label does not fit beside Next, so the phone's chip is icon only.
                id: "broadcast",
                label: "Broadcast alert",
                node: (
                  <button
                    type="button"
                    className={heroChipClassName}
                    aria-label="Broadcast alert"
                    title="Broadcast alert"
                    data-testid="ward-alerts-broadcast"
                    data-wf-hero-chip=""
                    onClick={onBroadcast}
                  >
                    <Radio {...ICON} />
                  </button>
                ),
              }
            : {
                id: "broadcast",
                label: "Broadcast alert",
                icon: <Radio {...ICON} />,
                testId: "ward-alerts-broadcast",
                onClick: () => {
                  const trigger = document.querySelector<HTMLButtonElement>('[data-testid="ward-alerts-broadcast"]');
                  if (trigger) openComposer(trigger);
                },
              },
        ]
      : []),
  ];

  // A single chip never gets a row of its own: it sits at the act row's right end at every width.
  const chipsNode = chips.length > 0 ? <HeroQuickChips label="Alert actions" items={chips} /> : undefined;
  const chipBesideAct = chipsNode !== undefined;
  const wrapAct = (node: ReactNode) =>
    chipBesideAct ? (
      <div className={styles.actWithChip}>
        {node}
        {chipsNode}
      </div>
    ) : (
      node
    );

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
      // 16 Nov walk: how fresh the list is, in the hero's quiet meta line.
      titleMeta={`Updated ${formatInstant(now)}`}
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
                // The Act now chip in the Open filter row does the same filter, so the figure is a plain number.
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
        act={wrapAct(
          next ? (
            <HeroAct
              tone={next.group === "act" ? "danger" : "warning"}
              testId="ward-alerts-next"
              title={
                <>
                  {next.item.title}
                  {nextFrom !== undefined ? (
                    <span className={`${titles.soft} ${styles.actAge}`}>
                      <span className={styles.actAgeSep} aria-hidden="true">
                        {" "}
                        ·{" "}
                      </span>
                      {minutesText(Math.max(0, now - nextFrom))}
                    </span>
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
          ),
        )}
      >
        {isPhone ? null : todayBand}
        <div className={isPhone ? styles.todayReserve : styles.bandShare}>
          <HeroBand
            // On a desktop the timeline above already heads it "Today".
            title={isPhone ? "Today" : <SrOnly>Today</SrOnly>}
            testId="ward-alerts-today"
            cells={[
              {
                id: "raised",
                // Audit three #26: says what it counts, so it is not read as the 9 waiting.
                label: isPhone ? "Raised" : "Raised today",
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
                : undefined,
            ].filter((cell): cell is NonNullable<typeof cell> => cell !== undefined)}
          />
        </div>
      </HeroTop>
    </Hero>
  );
}
