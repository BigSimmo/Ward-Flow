"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/wf/button";
import { useWardFlowSelect } from "../ward-flow-provider";
import { formatInstant } from "../ward-clock";
import { shiftConfirmations } from "../capacity/shift-confirmations";
import styles from "./ward-tools-quick-actions.module.css";

/**
 * MOCK-UP ONLY (3 Nov 2026, "Plan quick actions for the coordinator"): the coordinator's Quick
 * actions at the top of Tools. Local preview for Josh's approval; not wired, not pushed.
 */
export type QuickTile = {
  key: string;
  icon: LucideIcon;
  name: string;
  detail: string;
  count?: number;
  pressed?: boolean;
  href?: string;
  onClick?: () => void;
};

export function QuickActions({ tiles, onNavigate }: { tiles: readonly QuickTile[]; onNavigate: () => void }) {
  return (
    <section className={styles.quick} aria-label="Quick actions">
      <h3 className={styles.heading}>Quick actions</h3>
      <div className={styles.grid}>
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
            </Link>
          ) : (
            <button
              key={tile.key}
              type="button"
              className={styles.tile}
              aria-pressed={tile.pressed}
              onClick={tile.onClick}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function useUnconfirmedWards() {
  const { units, now } = useWardFlowSelect("units", "now");
  return shiftConfirmations(units, now);
}

/** Request ward updates: the wards not confirmed since this shift began. Nothing pre-selected. */
export function WardUpdatesRequest() {
  const status = useUnconfirmedWards();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
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
        {status.confirmed} of {status.total} wards confirmed since {formatInstant(status.since)}. Ask the rest to
        confirm their beds.
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
      <ul className={styles.list}>
        {status.waiting.slice(0, 8).map((unit) => (
          <li key={unit.id}>
            <label className={styles.ward}>
              <input type="checkbox" checked={chosen.has(unit.id)} onChange={() => toggle(unit.id)} />
              <span className={styles.wardName}>{unit.name}</span>
              <span className={styles.when}>Last {formatInstant(unit.allocatable.confirmedAt)}</span>
            </label>
          </li>
        ))}
      </ul>
      {status.waiting.length > 8 ? <p className={styles.quiet}>Show {status.waiting.length - 8} more</p> : null}
      <p className={styles.quiet}>Wards answer with Beds still correct on their home page. Replies show here.</p>
      <div className={styles.actions}>
        <Button variant="pri" disabledReason="Not wired in this prototype.">
          {chosen.size > 0 ? `Send to ${chosen.size} ${chosen.size === 1 ? "ward" : "wards"}` : "Send request"}
        </Button>
      </div>
    </div>
  );
}
