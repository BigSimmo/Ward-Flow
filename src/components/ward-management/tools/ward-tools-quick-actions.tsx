"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { Button, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";
import { useWardFlowSelect } from "../ward-flow-provider";
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
  return (
    <div className={styles.panel}>
      <div className={styles.grid} role="group" aria-label="Quick actions">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          const inner = (
            <>
              <span className={styles.icon} aria-hidden="true">
                <Icon aria-hidden="true" strokeWidth={1.75} />
              </span>
              <span className={styles.text}>
                <strong>{tile.name}</strong>
                <em>
                  {tile.count !== undefined ? <b className={styles.n}>{tile.count}</b> : null}
                  {tile.count !== undefined ? " " : null}
                  {tile.detail}
                </em>
              </span>
            </>
          );
          return tile.href ? (
            <Link key={tile.key} href={tile.href} className={styles.tile} onClick={onNavigate}>
              {inner}
              <ArrowUpRight className={styles.end} aria-hidden="true" strokeWidth={1.75} />
              <span className="sr-only">, opens its page</span>
            </Link>
          ) : (
            <button
              key={tile.key}
              type="button"
              className={styles.tile}
              aria-pressed={chosen === tile.key}
              onClick={() => setChosen(tile.key)}
            >
              {inner}
            </button>
          );
        })}
      </div>
      {active ? (
        <section className={styles.chosen} aria-label={active.title ?? active.name}>
          <h4 className={styles.chosenTitle}>{active.title ?? active.name}</h4>
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
  const { now } = useWardFlowSelect("now");
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [all, setAll] = useState(false);
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
  return (
    <div className={styles.request}>
      <p className={styles.lead}>
        {status.confirmed} of {status.total} wards confirmed since {formatInstantWithDay(status.since, now)}. Ask the
        rest to confirm their beds.
      </p>
      <div className={styles.listHead}>
        <span>Not confirmed this shift</span>
        <button
          type="button"
          className={styles.link}
          onClick={() => setChosen(new Set(status.waiting.map((unit) => unit.id)))}
        >
          Select all {status.waiting.length}
        </button>
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
      <p className={styles.quiet}>Wards answer with Beds still correct on their home page. Replies show here.</p>
      <div className={styles.actions}>
        <Button variant="pri" disabledReason="Not wired in this prototype.">
          {chosen.size > 0 ? `Send to ${chosen.size} ${chosen.size === 1 ? "ward" : "wards"}` : "Send request"}
        </Button>
      </div>
    </div>
  );
}
