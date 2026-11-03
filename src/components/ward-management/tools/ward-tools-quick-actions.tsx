"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { Button, Meter, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { ASK_CONFIRM_BEDS, askWardsFields, askedLine, splitAsk } from "../alerts/ask-wards";
import { formatInstantWithDay } from "../ward-clock";
import { shiftConfirmations } from "../capacity/shift-confirmations";
import styles from "./ward-tools-quick-actions.module.css";

/**
 * COORDINATOR QUICK ACTIONS (Josh locked in the mock-up, 3 Nov 2026). One Tools row opens the
 * coordinator's most used actions. Ward updates lists the wards not confirmed since the shift
 * began (the Capacity check); sending the request is phase 2 and is not wired yet.
 */
export type QuickTile = {
  key: string;
  icon: LucideIcon;
  name: string;
  detail: string;
  count?: number;
  /** A tile either opens its tool under the grid (`body`) or goes to a page (`href`). */
  title?: string;
  body?: ReactNode;
  href?: string;
};

/**
 * Quick actions opens from one Tools row (Josh, 3 Nov: room to grow without cluttering Tools).
 * The grid sits on top; the chosen action opens beneath it, so the coordinator never leaves Tools.
 */
export function QuickActionsPanel({ tiles, onNavigate }: { tiles: readonly QuickTile[]; onNavigate: () => void }) {
  const [chosen, setChosen] = useState<string | null>(tiles.find((tile) => tile.body)?.key ?? null);
  const active = tiles.find((tile) => tile.key === chosen && tile.body);
  // Polish (3 Nov, design brief): actions that work here lead as tiles with their live figure;
  // shortcuts that leave Tools sit apart as a quiet row, so it is clear which tap leaves the drawer.
  const here = tiles.filter((tile) => !tile.href);
  const away = tiles.filter((tile) => tile.href);
  return (
    <div className={styles.panel}>
      <div className={styles.set} role="group" aria-label="Quick actions">
        <div className={styles.grid}>
          {here.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.key}
                type="button"
                className={styles.tile}
                aria-pressed={chosen === tile.key}
                onClick={() => setChosen(tile.key)}
              >
                <span className={styles.tileTop}>
                  <span className={styles.icon} aria-hidden="true">
                    <Icon aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  {tile.count !== undefined ? (
                    <b className={tile.key === "ward-updates" && tile.count > 0 ? styles.figureWarn : styles.figure}>
                      {tile.count}
                    </b>
                  ) : null}
                </span>
                <strong>{tile.name}</strong>
                <em>{tile.detail}</em>
              </button>
            );
          })}
        </div>
        <div className={styles.away}>
          {away.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link key={tile.key} href={tile.href!} className={styles.awayLink} onClick={onNavigate}>
                <Icon aria-hidden="true" strokeWidth={1.75} />
                <span>{tile.name}</span>
                <ArrowUpRight className={styles.end} aria-hidden="true" strokeWidth={1.75} />
                <span className="sr-only">, {tile.detail}, opens its page</span>
              </Link>
            );
          })}
        </div>
      </div>
      {active ? (
        <section className={styles.chosen} aria-label={active.title ?? active.name}>
          {active.body}
        </section>
      ) : null}
    </div>
  );
}

export function useUnconfirmedWards() {
  const { units, now } = useWardFlowSelect("units", "now");
  return shiftConfirmations(units, now);
}

/** Request ward updates: the wards not confirmed since this shift began. Nothing pre-selected. */
export function WardUpdatesRequest() {
  const status = useUnconfirmedWards();
  const { now, broadcastAlerts } = useWardFlowSelect("now", "broadcastAlerts");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [all, setAll] = useState(false);
  const [sending, setSending] = useState(false);
  // A second tap while the first is in flight must not send twice.
  const inFlight = useRef(false);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const raise = useWardRaise("coordinator");
  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (status.waiting.length === 0) {
    return <p className={styles.quiet}>Every ward has confirmed its beds this shift.</p>;
  }
  const asking = chosen.size > 0 ? chosen.size : status.waiting.length;
  const askWards = async () => {
    if (inFlight.current) return;
    const picked = chosen.size > 0 ? [...chosen] : status.waiting.map((unit) => unit.id);
    // One shared path with the Discharges chase (M6): skip wards asked in the last four hours.
    const { send, skipped } = splitAsk(picked, broadcastAlerts, ASK_CONFIRM_BEDS, now);
    setSent(null);
    if (send.length === 0) {
      setSent({ ok: true, text: askedLine(0, skipped.length) });
      return;
    }
    inFlight.current = true;
    setSending(true);
    try {
      const outcome = await raise("DISPATCH_BROADCAST_ALERT", askWardsFields(ASK_CONFIRM_BEDS, send));
      if (outcome && outcome.status !== "accepted") {
        setSent({ ok: false, text: outcome.message || "Not sent. Try again." });
      } else {
        setSent({ ok: true, text: askedLine(send.length, skipped.length) });
        setChosen(new Set());
      }
    } catch {
      setSent({ ok: false, text: "Not sent. Check the connection and try again." });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  return (
    <div className={styles.request}>
      <div className={styles.progress}>
        <p className={styles.lead}>
          <b>{status.confirmed}</b> of <b>{status.total}</b> wards confirmed since{" "}
          {formatInstantWithDay(status.since, now)}
        </p>
        <Meter
          value={status.confirmed}
          max={status.total}
          fill="ready"
          label="Wards confirmed this shift"
          valueText={null}
        />
      </div>
      <div className={styles.listHead}>
        <span>Not confirmed</span>
        {status.waiting.length > 1 ? (
          <button
            type="button"
            className={styles.link}
            onClick={() =>
              setChosen((current) =>
                current.size === status.waiting.length ? new Set() : new Set(status.waiting.map((unit) => unit.id)),
              )
            }
          >
            {chosen.size === status.waiting.length ? "Clear" : `Select all ${status.waiting.length}`}
          </button>
        ) : null}
      </div>
      <ul className={styles.list} id="ward-updates-list">
        {status.waiting.slice(0, all ? undefined : foldLimit(status.waiting.length, 8)).map((unit) => (
          <li key={unit.id}>
            <label className={styles.ward}>
              <input type="checkbox" checked={chosen.has(unit.id)} onChange={() => toggle(unit.id)} />
              <span className={styles.wardName}>{unit.name}</span>
              <span className={styles.when}>Last {formatInstantWithDay(unit.allocatable.confirmedAt, now)}</span>
            </label>
          </li>
        ))}
      </ul>
      {foldHidden(status.waiting.length, 8) > 0 ? (
        <ShowMoreRow onClick={() => setAll((open) => !open)} expanded={all} controls="ward-updates-list">
          {all ? "Show fewer" : `Show ${foldHidden(status.waiting.length, 8)} more`}
        </ShowMoreRow>
      ) : null}
      <div className={styles.actions}>
        <p className={styles.quiet}>Each ward sees it on screen and answers with Beds still correct.</p>
        <Button variant="pri" onClick={askWards} disabledReason={sending ? "Sending…" : undefined}>
          {chosen.size === 0 && asking > 1
            ? `Ask all ${asking} wards to confirm`
            : `Ask ${asking} ${asking === 1 ? "ward" : "wards"} to confirm`}
        </Button>
      </div>
      <p role="status" className={sent && !sent.ok ? styles.sentBad : styles.sent}>
        {sent ? (
          <>
            {sent.text}{" "}
            {sent.ok ? (
              <Link href="/ward-flow/alerts" className={styles.link}>
                Open Alerts
              </Link>
            ) : null}
          </>
        ) : null}
      </p>
    </div>
  );
}
