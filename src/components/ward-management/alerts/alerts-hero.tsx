"use client";

// The Alerts screen's hero: the phone hero with its directive card and Today sheet, or the desktop
// hero with its figures, broadcast and tools. Moved out of `alerts-screen.tsx` for the line cap.
import type { ReactNode, RefObject } from "react";
import { Bell, BellRing, ChevronRight, Copy, MoreHorizontal, Pause, Play, Radio } from "lucide-react";

import {
  Button,
  Hero,
  HeroStat,
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
  todayBand,
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
                        icon={MoreHorizontal}
                        aria-label="More alert actions"
                      />
                    )}
                  />
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
                  pressed={pill === "wait"}
                  onToggle={() => togglePill("wait")}
                />
                {officerDesk ? null : (
                  <HeroStat
                    inline
                    value={yoursCount}
                    label="Yours"
                    pressed={pill === "mine"}
                    onToggle={() => togglePill("mine")}
                  />
                )}
              </div>
            </div>
          }
          barAside={
            <div className={styles.heroTools}>
              {/* Transport officer: the handover copy is on My jobs (Copy handover). */}
              {officerDesk ? null : (
                <Button variant="onHero" size="sm" icon={Copy} className={styles.deskOnly} onClick={handleCopy}>
                  Copy for handover
                </Button>
              )}
              <Button
                variant="onHero"
                size="sm"
                icon={ChevronRight}
                aria-label={`Next alert, ${nextQueue.length} in turn`}
                count={nextQueue.length}
                disabled={nextQueue.length === 0}
                onClick={handleNext}
              >
                {/* Next steps through the actionable queue only; running targets are listed, not counted. */}
                Next alert
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
          }
          // A quiet ward's checks sit in the side panel instead, so the screen may pass no foot.
          foot={todayBand ?? (checkingFoot ? <div className={styles.checkingFootWide}>{checkingFoot}</div> : undefined)}
        />
      )}
    </>
  );
}
