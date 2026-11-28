"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { Button, Meter, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";
import { useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { ASK_CONFIRM_BEDS, askWardsFields, askedLine, splitAsk } from "../alerts/ask-wards";
import { ASK_WARDS_WINDOW_TEXT } from "../ward-operational-defaults";
import { formatInstantWithDay } from "../ward-clock";
import { shiftConfirmations } from "../capacity/shift-confirmations";
import styles from "./ward-tools-quick-actions.module.css";

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
  const picked = chosen.size > 0 ? [...chosen] : status.waiting.map((unit) => unit.id);
  // One shared path with the Discharges chase (M6): skip wards asked in the last four hours.
  const { send, skipped } = splitAsk(picked, broadcastAlerts, ASK_CONFIRM_BEDS, now);
  const asking = send.length;
  const askWards = async () => {
    if (inFlight.current) return;
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
        <Button
          variant="pri"
          onClick={askWards}
          disabledReason={
            sending ? "Sending…" : asking === 0 ? `Already asked in the last ${ASK_WARDS_WINDOW_TEXT}.` : undefined
          }
        >
          {asking === 0
            ? "Ask wards to confirm"
            : chosen.size === 0 && asking > 1 && skipped.length === 0
              ? `Ask all ${asking} wards to confirm`
              : `Ask ${asking} ${asking === 1 ? "ward" : "wards"} to confirm`}
        </Button>
      </div>
      <p role="status" className={sent && !sent.ok ? styles.sentBad : styles.sent}>
        {sent ? (
          <>
            {sent.text}{" "}
            {sent.ok ? (
              <Link href="/bedchart/alerts" className={styles.link}>
                Open Alerts
              </Link>
            ) : null}
          </>
        ) : null}
      </p>
    </div>
  );
}
