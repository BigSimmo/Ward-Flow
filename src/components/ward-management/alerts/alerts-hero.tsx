"use client";

// The Alerts screen's hero: the phone hero with its directive card and Today sheet, or the desktop
// hero with its figures, broadcast and tools. Moved out of `alerts-screen.tsx` for the line cap.
import type { ReactNode, RefObject } from "react";
import { Bell, BellRing, ChevronRight, Copy, Pause, Play, Radio } from "lucide-react";

import {
  Button,
  Hero,
  HeroStat,
  LiveChip,
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
import { TimeRing } from "./alerts-visuals";
import styles from "./alerts.module.css";

export type AlertsTab = "now" | "broadcast" | "notices" | "history";
export type HeroPill = "act" | "wait" | "mine";

export function AlertsHero({
  isPhone,
  heroTitle,
  openCount,
  runningText,
  oldestRaised,
  now,
  live,
  actCount,
  waitEntries,
  pill,
  togglePill,
  yoursCount,
  handleNext,
  broadcastTriggerRef,
  openComposer,
  broadcastDisabledReason,
  activeBroadcast,
  setTab,
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
}: {
  isPhone: boolean;
  heroTitle: string;
  openCount: number;
  runningText: string;
  oldestRaised: Instant | undefined;
  now: Instant;
  live: ReturnType<typeof usePageLive>;
  /** Act now: the act-now alerts plus accepted referrals with no bed pulled (Q111). */
  actCount: number;
  waitEntries: QueueEntry[];
  pill: HeroPill | null;
  togglePill: (next: HeroPill) => void;
  yoursCount: number;
  handleNext: () => void;
  broadcastTriggerRef: RefObject<HTMLButtonElement | null>;
  openComposer: (trigger: HTMLButtonElement) => void;
  /** Why this desk cannot broadcast, or undefined when it may. */
  broadcastDisabledReason?: string;
  activeBroadcast: ReturnType<typeof getActiveBroadcastAlert>;
  setTab: (tab: AlertsTab) => void;
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
}) {
  const deskRole = useEffectiveWardAccess().role;
  // Transport officer: only the coordinator takes an alert and only the coordinator or a bed manager
  // broadcasts, so "Yours" is always 0 and Broadcast never works here. Both are left out.
  const officerDesk = deskRole === "officer";
  // Nurse in charge: a ward desk never broadcasts, so the greyed Broadcast is left out too.
  const wardDesk = deskRole === "ward";
  const canBroadcast = !officerDesk && !wardDesk;
  return (
    <>
      {isPhone ? (
        <>
          <PhoneHero
            level={1}
            data-testid="ward-alerts-phone-hero"
            title={heroTitle}
            sub={
              openCount > 0
                ? `${openCount} open${runningText}${
                    oldestRaised !== undefined ? ` · oldest ${minutesText(Math.max(0, now - oldestRaised))}` : ""
                  }`
                : "Checking every condition below"
            }
            eyebrow="Alerts"
            // F-08: the standard Demo pill, as on every phone hero; Pause below holds the list.
            chip={<LiveChip state={live.paused ? "paused" : "live"} onHero />}
            figures={[
              {
                id: "act",
                value: actCount,
                label: "Act now",
                tone: "danger",
                pressed: pill === "act",
                onPress: () => togglePill("act"),
              },
              {
                id: "wait",
                value: waitEntries.length,
                label: "Waiting",
                tone: "warning",
                pressed: pill === "wait",
                onPress: () => togglePill("wait"),
              },
              ...(officerDesk
                ? []
                : [
                    {
                      id: "mine",
                      value: yoursCount,
                      // P018 (Josh, 27 Oct 2026): "Yours" on every screen, as the desktop hero says.
                      label: "Yours",
                      pressed: pill === "mine",
                      onPress: () => togglePill("mine"),
                    },
                  ]),
            ]}
            actions={
              <div className={phoneRows.heroPills}>
                {/* Phone (Josh, 31 Oct 2026): Home's hero pills, side by side. */}
                {/* Ops-14 (13 Oct 2026): working the next alert is the common action, so it is the
                      one primary; a statewide broadcast stays one tap away as a secondary, with Pause between
                      the two so a thumb aiming for Next cannot start a broadcast (P017, 27 Oct 2026). */}
                {/* Nurse in charge: a quiet ward has no next alert, so no filled button that does nothing. */}
                {wardDesk && nextQueue.length === 0 ? null : (
                  <Button
                    className={phoneRows.heroPill}
                    variant="light"
                    icon={ChevronRight}
                    onClick={handleNext}
                    data-testid="ward-alerts-phone-next"
                  >
                    Next alert
                  </Button>
                )}
                <Button
                  className={phoneRows.heroPill}
                  variant="onHero"
                  icon={live.paused ? Play : Pause}
                  aria-pressed={live.paused}
                  title={live.paused ? "Resume live updates" : "Hold the list still"}
                  onClick={live.togglePause}
                >
                  {live.paused ? "Resume" : "Pause"}
                </Button>
                {canBroadcast ? (
                  <Button
                    className={phoneRows.heroPill}
                    ref={broadcastTriggerRef}
                    variant="onHero"
                    icon={Radio}
                    disabledReason={broadcastDisabledReason}
                    onClick={(event) => openComposer(event.currentTarget)}
                  >
                    Broadcast
                  </Button>
                ) : null}
              </div>
            }
          />
          {activeBroadcast ? (
            <button type="button" className={styles.phoneDirective} onClick={() => setTab("broadcast")}>
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
            openCount > 0 ? (
              <span className={styles.heroMeta}>
                <span className={styles.mono}>{openCount}</span> open
                {runningText}
                {oldestRaised !== undefined ? (
                  <>
                    {" "}
                    · oldest <span className={styles.mono}>{minutesText(Math.max(0, now - oldestRaised))}</span>
                  </>
                ) : null}
              </span>
            ) : undefined
          }
          aside={
            // Nurse in charge: with no alert in turn, Next of 0 and an empty handover copy are left out.
            wardDesk && nextQueue.length === 0 ? undefined : (
              <div className={styles.heroTools}>
                <PageLiveChip paused={live.paused} onTogglePause={live.togglePause} />
                <Button
                  variant="onHero"
                  size="sm"
                  icon={notifyOn ? BellRing : Bell}
                  aria-pressed={notifyOn}
                  title="Act-now alerts notify in this open tab. No patient detail is shown."
                  onClick={handleNotify}
                >
                  Notify me
                </Button>
                {canBroadcast ? (
                  <Button
                    ref={broadcastTriggerRef}
                    variant="light"
                    size="sm"
                    icon={Radio}
                    disabledReason={broadcastDisabledReason}
                    onClick={(event) => openComposer(event.currentTarget)}
                  >
                    Broadcast alert
                  </Button>
                ) : null}
              </div>
            )
          }
          bar={
            <div className={styles.heroBar}>
              <div className={styles.heroStats} role="group" aria-label="Alert summary">
                <HeroStat
                  inline
                  value={actCount}
                  label="Act now"
                  tone="danger"
                  pressed={pill === "act"}
                  onToggle={() => togglePill("act")}
                />
                <HeroStat
                  inline
                  value={waitEntries.length}
                  label="Waiting"
                  tone="warning"
                  pressed={pill === "wait"}
                  onToggle={() => togglePill("wait")}
                />
                {officerDesk ? null : (
                  <HeroStat
                    inline
                    value={yoursCount}
                    label="Yours"
                    tone="neutral"
                    pressed={pill === "mine"}
                    onToggle={() => togglePill("mine")}
                  />
                )}
              </div>
              {activeBroadcast ? (
                <button
                  type="button"
                  className={styles.heroBroadcast}
                  title="Open the broadcast desk"
                  onClick={() => setTab("broadcast")}
                >
                  <TimeRing
                    from={activeBroadcast.dispatchedAt}
                    until={activeBroadcast.expiresAt}
                    now={now}
                    size={30}
                    onHero
                  />
                  <StatusGlyph tone={directiveTone} />
                  <span className={styles.heroBroadcastTitle}>{activeBroadcast.title}</span>
                  <span className={styles.heroBroadcastMeta}>
                    ends <span className={styles.mono}>{formatInstantWithDay(activeBroadcast.expiresAt, now)}</span>
                    {broadcastAcks ? (
                      <span className={styles.deskOnly}>
                        {" "}
                        · <span className={styles.mono}>{broadcastAcks.acknowledged}</span> acknowledged
                      </span>
                    ) : null}
                  </span>
                </button>
              ) : null}
            </div>
          }
          barAside={
            <div className={styles.heroTools}>
              <Button
                variant="onHero"
                size="sm"
                icon={ChevronRight}
                aria-label={`Next alert, ${nextQueue.length} in turn`}
                disabled={nextQueue.length === 0}
                onClick={handleNext}
              >
                {/* Next steps through the actionable queue only; running targets are listed, not counted. */}
                Next of <span className={styles.mono}>{nextQueue.length}</span>
              </Button>
              {/* Transport officer: the handover copy is on My jobs (Copy handover). */}
              {officerDesk ? null : (
                <Button variant="onHero" size="sm" icon={Copy} className={styles.deskOnly} onClick={handleCopy}>
                  Copy for handover
                </Button>
              )}
            </div>
          }
          // A quiet ward's checks sit in the side panel instead, so the screen may pass no foot.
          foot={checkingFoot ? <div className={styles.checkingFootWide}>{checkingFoot}</div> : undefined}
        />
      )}
    </>
  );
}
