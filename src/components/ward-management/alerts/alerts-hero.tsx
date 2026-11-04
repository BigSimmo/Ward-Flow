"use client";

// The Alerts screen's hero: the phone hero with its directive card and Today sheet, or the desktop
// hero with its figures, broadcast and tools. Moved out of `alerts-screen.tsx` for the line cap.
import type { ReactNode, RefObject } from "react";
import { Bell, BellRing, ChevronRight, Copy, Ellipsis, Pause, Play, Radio } from "lucide-react";

import {
  Button,
  Hero,
  LiveChip,
  Menu,
  PhoneHero,
  PhoneSheet,
  StatusGlyph,
  phoneRows,
  type WfTone,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { PageLiveChip, type usePageLive } from "@/components/ward-management/ward-page-live";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";

import type { getActiveBroadcastAlert } from "./ward-broadcast-model";
import { minutesText } from "./alerts-model";
import type { QueueEntry } from "./alerts-queue";
import styles from "./alerts.module.css";

export type AlertsTab = "now" | "earlier";

// Alerts redesign (Q112, Josh 1 Nov 2026): the title is the Act now and Waiting figures, Home's
// count included. "New to you" is gone: nothing on the page explained it.
function alertsHeroTitle(actCount: number, waitCount: number, wardName: string | undefined): string {
  if (actCount > 0 || waitCount > 0) return `${actCount} act now, ${waitCount} waiting`;
  return wardName ? `No alert for ${wardName}` : "No alert needs you";
}

export function AlertsHero({
  isPhone,
  wardName,
  openCount,
  runningCount,
  oldestRaised,
  now,
  live,
  actCount,
  waitEntries,
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
  /** The desk's own ward, for "No alert for <ward>". */
  wardName: string | undefined;
  /** Ops-3: the one active list the Now tab and Tasks badge count, running targets included. */
  openCount: number;
  runningCount: number;
  oldestRaised: Instant | undefined;
  now: Instant;
  live: ReturnType<typeof usePageLive>;
  /** Act now: the act-now alerts plus accepted referrals with no bed pulled (Q111). */
  actCount: number;
  waitEntries: QueueEntry[];
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
  const deskRole = useEffectiveWardAccess().role;
  // Transport officer: only the coordinator takes an alert and only the coordinator or a bed manager
  // broadcasts, so "Yours" is always 0 and Broadcast never works here. Both are left out.
  const officerDesk = deskRole === "officer";
  // Nurse in charge: a ward desk never broadcasts, so the greyed Broadcast is left out too.
  const wardDesk = deskRole === "ward";
  const canBroadcast = !officerDesk && !wardDesk;
  const showNext = !(wardDesk && nextQueue.length === 0);
  const heroTitle = alertsHeroTitle(actCount, waitEntries.length, wardName);
  const runningText = runningCount > 0 ? ` · ${runningCount} running` : "";
  return (
    <>
      {isPhone ? (
        <>
          <PhoneHero
            level={1}
            data-testid="ward-alerts-phone-hero"
            title={heroTitle}
            // Alerts redesign (1 Nov 2026): "oldest 1h 12m · broadcast live"; the figures carry the counts.
            sub={
              oldestRaised !== undefined || activeBroadcast
                ? [
                    oldestRaised !== undefined ? `oldest ${minutesText(Math.max(0, now - oldestRaised))}` : "",
                    officerDesk ? "" : `${yoursCount} yours`,
                    activeBroadcast ? "broadcast live" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : openCount > 0
                  ? `${openCount} open${runningText}`
                  : "Checking every condition below"
            }
            eyebrow="Alerts"
            // F-08: the standard Demo pill, as on every phone hero; Pause below holds the list.
            chip={<LiveChip state={live.paused ? "paused" : "live"} onHero />}
            // Alerts overhaul (4 Nov 2026): the title already counts act now and waiting, and the
            // filter chips below filter by them, so the hero draws no figures of its own.
            actions={
              <div className={phoneRows.heroPills}>
                {/* Phone (Josh, Q153, 1 Nov 2026): one hero action, the rest under "…". Working the
                    next alert is the common action (Ops-14), so it is the one shown; a statewide
                    broadcast is never a single tap from it (P017). A quiet ward has no next alert. */}
                {showNext ? (
                  <Button
                    className={phoneRows.heroPill}
                    variant="light"
                    icon={ChevronRight}
                    onClick={handleNext}
                    data-testid="ward-alerts-phone-next"
                  >
                    Next alert
                  </Button>
                ) : (
                  <Button
                    className={phoneRows.heroPill}
                    variant="light"
                    icon={live.paused ? Play : Pause}
                    aria-pressed={live.paused}
                    title={live.paused ? "Resume live updates" : "Hold the list still"}
                    onClick={live.togglePause}
                  >
                    {live.paused ? "Resume" : "Pause"}
                  </Button>
                )}
                {showNext || canBroadcast ? (
                  <Menu
                    label="More alert actions"
                    align="end"
                    items={[
                      ...(showNext
                        ? [
                            {
                              id: "pause",
                              label: live.paused ? "Resume live updates" : "Hold the list still",
                              icon: live.paused ? Play : Pause,
                              onSelect: live.togglePause,
                            },
                          ]
                        : []),
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
                    ]}
                    trigger={(props) => (
                      <Button
                        {...props}
                        ref={(element: HTMLButtonElement | null) => {
                          props.ref.current = element;
                          broadcastTriggerRef.current = element;
                        }}
                        className={phoneRows.heroPill}
                        variant="onHero"
                        icon={Ellipsis}
                        aria-label="More alert actions"
                      />
                    )}
                  />
                ) : null}
              </div>
            }
          />
          {activeBroadcast ? (
            <button type="button" className={styles.phoneDirective} onClick={onOpenBroadcast}>
              <StatusGlyph tone={directiveTone} />
              <span className={styles.phoneCardText}>
                <span className={styles.phoneCardTitle}>{activeBroadcast.title}</span>
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
          ) : null}
          <PhoneSheet open={phoneToday} onClose={() => setPhoneToday(false)} title="Today" height="tall">
            <div className={styles.phoneChecks}>{todayChart}</div>
          </PhoneSheet>
        </>
      ) : (
        <Hero
          level={1}
          eyebrow="Alerts"
          title={heroTitle}
          titleMeta={
            // Alerts redesign (1 Nov 2026): "oldest 1h 12m · 2 yours".
            oldestRaised !== undefined || (!officerDesk && yoursCount > 0) ? (
              <span className={styles.heroMeta}>
                {oldestRaised !== undefined ? (
                  <>
                    oldest <span className={styles.mono}>{minutesText(Math.max(0, now - oldestRaised))}</span>
                  </>
                ) : null}
                {oldestRaised !== undefined && !officerDesk ? " · " : null}
                {officerDesk ? null : (
                  <>
                    <span className={styles.mono}>{yoursCount}</span> yours
                  </>
                )}
              </span>
            ) : undefined
          }
          // Alerts overhaul (4 Nov 2026): one line of tools. The counts live once, on the filter chips
          // under the band, so the band no longer repeats them. Next alert is the one filled action;
          // Broadcast stays in view for a coordinator, and the rarer tools sit under "…".
          aside={
            <div className={styles.heroTools}>
              <PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />
              {showNext ? (
                <Button
                  variant="light"
                  size="sm"
                  icon={ChevronRight}
                  disabled={nextQueue.length === 0}
                  onClick={handleNext}
                >
                  Next alert
                </Button>
              ) : null}
              {canBroadcast ? (
                <Button
                  ref={broadcastTriggerRef}
                  variant="onHero"
                  size="sm"
                  icon={Radio}
                  disabledReason={broadcastDisabledReason}
                  onClick={(event) => openComposer(event.currentTarget)}
                >
                  Broadcast alert
                </Button>
              ) : null}
              <Menu
                label="More alert tools"
                align="end"
                items={[
                  ...(officerDesk
                    ? []
                    : [{ id: "copy", label: "Copy for handover", icon: Copy, onSelect: handleCopy }]),
                  {
                    id: "notify",
                    label: "Notify me in this tab",
                    icon: notifyOn ? BellRing : Bell,
                    checked: notifyOn,
                    meta: "No patient detail",
                    onSelect: handleNotify,
                  },
                ]}
                trigger={(props) => (
                  <Button {...props} variant="onHero" size="sm" icon={Ellipsis} aria-label="More alert tools" />
                )}
              />
            </div>
          }
          // A quiet ward's checks sit in the side panel instead, so the screen may pass no foot.
          foot={todayBand ?? (checkingFoot ? <div className={styles.checkingFootWide}>{checkingFoot}</div> : undefined)}
        />
      )}
    </>
  );
}
