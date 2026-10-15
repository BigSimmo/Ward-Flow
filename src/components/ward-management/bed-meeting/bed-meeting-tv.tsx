"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { bedMeetingSheet, type BedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { asAtStamp } from "@/components/ward-management/board/ward-daily-sheet";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useWardFeatureFlag, useWardFeatureFlags } from "@/components/ward-management/shell/ward-feature-flag-store";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { LONG_WAIT_MINUTES, LONG_WAIT_TEXT } from "@/components/ward-management/ward-operational-defaults";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";
import { scenarioLabels } from "@/components/ward-management/ward-scenarios";

import styles from "./bed-meeting-tv.module.css";

/**
 * THE BED MEETING TV VIEW (Josh, 15 Oct 2026, item 10): the meeting room screen.
 *
 * Read only. Every figure comes from `bedMeetingSheet`, the same selector the printed bed meeting
 * sheet on Capacity uses, so the TV, the paper and the screens cannot disagree. It re-renders with
 * the shared clock and the shared workspace, so it stays current without anyone touching it.
 *
 * A shared screen shows initials, never full names. Desktop only: a phone gets the "needs a larger
 * screen" card (`ward-phone-desktop-only.tsx`). Behind the `bed-meeting-tv` feature flag.
 */

/** The panel already says "Emergency departments", so the TV drops the repeated suffix. */
function edName(department: string): string {
  return department.replace(/ Emergency Department$/, "");
}

function Figure({ value }: { value: number }) {
  return <>{value === 0 ? "None" : value}</>;
}

function Tile({
  label,
  value,
  detail,
  tone,
  testId,
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "warning" | "danger";
  testId: string;
}) {
  return (
    <div className={styles.tile} data-tone={tone} data-testid={testId}>
      <dt className={styles.tileLabel}>{label}</dt>
      <dd className={styles.tileValue}>
        <Figure value={value} />
      </dd>
      <dd className={styles.tileDetail}>{detail}</dd>
    </div>
  );
}

function Panel({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  const id = `${testId}-title`;
  return (
    <section className={styles.panel} aria-labelledby={id} data-testid={testId}>
      <h2 id={id} className={styles.panelTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

function More({ count, noun }: { count: number; noun: string }) {
  if (count === 0) return null;
  return (
    <p className={styles.more}>
      and {count} more {noun}
    </p>
  );
}

export function BedMeetingTvView({ sheet, now, scenario }: { sheet: BedMeetingSheet; now: number; scenario: string }) {
  const { capacity, discharges, ed, delays } = sheet;
  const stamp = asAtStamp(now);
  const scope = sheet.service === null ? "All services" : sheet.service;
  const dischargingToday = discharges.confirmed + discharges.expected;

  return (
    <>
      <dl className={styles.tiles} aria-label="Today at a glance">
        <Tile
          label="Beds ready now"
          value={capacity.ready}
          detail={`of ${capacity.beds} beds in ${capacity.wards} wards`}
          tone={capacity.ready === 0 ? "danger" : undefined}
          testId="bed-meeting-tv-ready"
        />
        <Tile
          label="Locked beds ready"
          value={capacity.lockedReady}
          detail={`${capacity.pulled} held for someone on the way`}
          tone={capacity.lockedReady === 0 ? "warning" : undefined}
          testId="bed-meeting-tv-locked"
        />
        <Tile
          label="Waiting in ED"
          value={ed.waiting}
          detail={`${ed.overLongWait} waiting ${LONG_WAIT_TEXT}`}
          tone={ed.overLongWait > 0 ? "danger" : ed.waiting > 0 ? "warning" : undefined}
          testId="bed-meeting-tv-ed"
        />
        <Tile
          label="Discharges due"
          value={dischargingToday}
          detail={`Today and tomorrow. ${discharges.confirmed} confirmed, ${discharges.heldUp} held up`}
          tone={discharges.heldUp > 0 ? "warning" : undefined}
          testId="bed-meeting-tv-discharges"
        />
        <Tile
          label="Delayed"
          value={delays.total}
          detail={delays.groups[0] ? `Most urgent: ${delays.groups[0].title.toLowerCase()}` : "No delays"}
          tone={delays.total > 0 ? "warning" : undefined}
          testId="bed-meeting-tv-delays"
        />
      </dl>

      <div className={styles.panels}>
        <Panel title="Emergency departments" testId="bed-meeting-tv-ed-panel">
          {ed.departments.length === 0 ? (
            <Empty>Nobody waiting in an ED.</Empty>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Department</th>
                  <th scope="col" className={styles.num}>
                    Waiting
                  </th>
                  <th scope="col" className={styles.num}>
                    Longest
                  </th>
                </tr>
              </thead>
              <tbody>
                {ed.departments.map((row) => (
                  <tr key={row.id} data-long={row.longestWaitMinutes > LONG_WAIT_MINUTES || undefined}>
                    <th scope="row">{edName(row.department)}</th>
                    <td className={styles.num}>{row.waiting}</td>
                    <td className={styles.num}>{splitDuration(row.longestWaitMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Longest ED waits" testId="bed-meeting-tv-waits-panel">
          {ed.longestWaits.length === 0 ? (
            <Empty>Nobody waiting.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {ed.longestWaits.map((person) => (
                  <li key={person.id} data-long={person.waitMinutes > LONG_WAIT_MINUTES || undefined}>
                    <span className={styles.who}>{person.name}</span>
                    <span className={styles.where}>{edName(person.department)}</span>
                    <span className={styles.wait}>{splitDuration(person.waitMinutes)}</span>
                  </li>
                ))}
              </ol>
              <More count={ed.morePeople} noun="waiting" />
            </>
          )}
        </Panel>

        <Panel title="Expected discharges" testId="bed-meeting-tv-discharges-panel">
          {discharges.rows.length === 0 ? (
            <Empty>No discharges expected today or tomorrow.</Empty>
          ) : (
            <>
              <ol className={styles.list}>
                {discharges.rows.map((row) => (
                  <li key={row.id} data-status={row.status}>
                    <span className={styles.who}>{row.ward}</span>
                    <span className={styles.where}>{row.note ?? ""}</span>
                    <span className={styles.wait}>{row.status}</span>
                  </li>
                ))}
              </ol>
              <More count={discharges.moreRows} noun="discharges" />
            </>
          )}
        </Panel>

        <Panel title="Delays by cause" testId="bed-meeting-tv-delays-panel">
          {delays.groups.length === 0 ? (
            <Empty>No delays.</Empty>
          ) : (
            <ol className={styles.list}>
              {delays.groups.map((group) => (
                <li key={group.cause}>
                  <span className={styles.who}>{group.title}</span>
                  <span className={styles.where}>longest {splitDuration(group.longestWaitMinutes)}</span>
                  <span className={styles.wait}>{group.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <p className={styles.footer}>
        {scope} · Scenario: {scenario} · Synthetic prototype, {stamp.dayNote}. Read only. Not a medical device.
      </p>
    </>
  );
}

const noSubscription = () => () => {};

function useFullscreen(target: RefObject<HTMLElement | null>) {
  // False on the server and before hydration, then whatever this browser offers.
  const supported = useSyncExternalStore(
    noSubscription,
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === target.current && target.current !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [target]);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void target.current?.requestFullscreen?.();
  };
  return { supported, active, toggle };
}

export function BedMeetingTvScreen() {
  const { units, movements, bedReleases, admissions, leaveBeds, scenario } = useWardFlow();
  const now = useWardFlowClock();
  const service = useServiceScope();
  const patientOf = usePatientOf();
  const enabled = useWardFeatureFlag("bed-meeting-tv");
  const deviceCanChange = useWardFeatureFlags()[0]?.deviceCanChange ?? false;
  const root = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(root);

  const sheet = useMemo(
    () =>
      bedMeetingSheet({
        units,
        movements,
        bedReleases,
        admissions,
        leaveBeds,
        now,
        service,
        // A shared screen in a meeting room: initials only.
        nameOf: (movement) => patientOf(movement).initials,
      }),
    [units, movements, bedReleases, admissions, leaveBeds, now, service, patientOf],
  );
  const stamp = asAtStamp(now);
  const scope = service === null ? "All services" : service;

  if (!enabled) {
    return (
      <main id="main-content" className={styles.off} data-testid="bed-meeting-tv-off">
        <h1 className={styles.offTitle}>Bed meeting TV view is switched off</h1>
        <p>
          {deviceCanChange
            ? "Turn it on in Settings, under Data and about, Feature flags."
            : "It is switched off on this site."}
        </p>
        <Link href={WARD_CAPACITY_HREF} className={styles.offLink}>
          Open Capacity
        </Link>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      ref={root}
      className={styles.tv}
      data-testid="bed-meeting-tv"
      aria-labelledby="bed-meeting-tv-title"
    >
      <header className={styles.header}>
        <div>
          <h1 id="bed-meeting-tv-title" className={styles.title}>
            Bed meeting · {scope}
          </h1>
          <p className={styles.sub} aria-live="polite" data-testid="bed-meeting-tv-as-at">
            {stamp.time === null ? "Time not recorded" : `As at ${stamp.time}`} · updates on its own
          </p>
        </div>
        <div className={styles.actions}>
          {fullscreen.supported ? (
            <button
              type="button"
              className={styles.action}
              onClick={fullscreen.toggle}
              data-testid="bed-meeting-tv-fullscreen"
            >
              {fullscreen.active ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              {fullscreen.active ? "Leave full screen" : "Full screen"}
            </button>
          ) : null}
          <Link href={WARD_CAPACITY_HREF} className={styles.action}>
            Leave TV view
          </Link>
        </div>
      </header>
      <BedMeetingTvView sheet={sheet} now={now} scenario={scenarioLabels[scenario]} />
    </main>
  );
}
