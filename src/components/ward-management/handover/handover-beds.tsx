"use client";

/**
 * The Beds tab of the refined Handover page (9 Oct 2026): the beds-now tiles and the way across to
 * Capacity (the by-ward table was cut in audit four, r10). Values are the ward feed's, each with its
 * age. Patients are named by record and UMRN only, never the journey id.
 */
import Link from "next/link";
import { useId, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardBody, CardHead, CheckingFoot, Icon, buttonClass, cx } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  isWaitingForBed,
  wardIsStale,
  type HandoverRow,
  type HandoverWard,
  type HeldDischarge,
  isStoppedAwaitingRelease,
} from "./handover-model";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { accessIsWholeNetwork, unitInScope } from "@/components/ward-management/ward-role-access";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import styles from "./handover-beds.module.css";

export type HandoverBedsProps = {
  /** Open movements already in the handover scope. */
  rows: HandoverRow[];
  /** Wards already in scope. */
  wards: HandoverWard[];
  /** Held discharges already in scope, longest first. */
  held: HeldDischarge[];
  now: Instant;
  /**
   * The hero's "Finding a ward" figure (the meeting group), so this tile and the hero's
   * "beds ready for N finding a ward" read one number. Falls back to every row still finding a ward.
   */
  waitingForBed?: number;
  /** Switches to the Patients tab and selects the row. */
  onOpenPatient: (movementId: string) => void;
};

/** Incoming per ward: accepted journeys heading there and wards still reviewing a request. */
export function incomingCounts(rows: readonly HandoverRow[]): Map<string, { accepted: number; reviewing: number }> {
  const map = new Map<string, { accepted: number; reviewing: number }>();
  const bump = (unitId: string, key: "accepted" | "reviewing") => {
    const entry = map.get(unitId) ?? { accepted: 0, reviewing: 0 };
    entry[key] += 1;
    map.set(unitId, entry);
  };
  for (const row of rows) {
    // Owner ruling 2026-10-13 22:13 AWST (PR #279): a stopped journey is not coming; keep it out of incoming.
    if (row.to && !isStoppedAwaitingRelease(row)) bump(row.to.unitId, "accepted");
    for (const asked of row.asked) bump(asked.unitId, "reviewing");
  }
  return map;
}

/**
 * Batch 3 (one Handover): the Beds tab's one card, "Beds now". The five tiles cut to three equal
 * columns, as Capacity's figures for the same wards. Ready excludes being made ready (D-179 item 8).
 */
function BedsNowTiles({ rows, wards, waitingForBed }: Pick<HandoverBedsProps, "rows" | "wards" | "waitingForBed">) {
  const ready = wards.reduce((total, ward) => total + ward.ready, 0);
  const preparing = wards.reduce((total, ward) => total + ward.pendingPreparation, 0);
  const beds = wards.reduce((total, ward) => total + ward.beds, 0);
  const occupied = wards.reduce((total, ward) => total + ward.occupied, 0);
  const outToday = wards.reduce((total, ward) => total + ward.outToday, 0);
  const pastEdd = wards.reduce((total, ward) => total + ward.pastEdd, 0);
  const waiting = waitingForBed ?? rows.filter(isWaitingForBed).length;
  return (
    <div className={cx(styles.tiles, styles.tilesThree)} data-testid="ward-handover-beds-now-tiles">
      <div className={cx(styles.tile, ready > 0 && styles.tileOk)}>
        <b className={cx(styles.tileValue, ready > 0 && styles.inkSuccess)}>{ready}</b>
        <span className={styles.tileLabel}>Ready now</span>
        <span className={styles.tileSub}>
          for <b>{waiting}</b> finding a ward · occupied <b>{occupied}</b> of <b>{beds}</b>
        </span>
      </div>
      <div className={styles.tile}>
        <b className={styles.tileValue}>{preparing}</b>
        <span className={styles.tileLabel}>Being made ready</span>
        <span className={styles.tileSub}>Not offered yet</span>
      </div>
      <div className={styles.tile}>
        <b className={styles.tileValue}>{outToday}</b>
        <span className={styles.tileLabel}>Expected out today</span>
        <span className={styles.tileSub}>
          <b>{pastEdd}</b> past EDD
        </span>
      </div>
    </div>
  );
}

const CAPACITY_HREF = "/bedchart/capacity";

export function HandoverBeds({ rows, wards: allWards, now, waitingForBed }: HandoverBedsProps) {
  // A scoped desk totals its own wards only; another ward's empty count must not read as its own.
  const access = useEffectiveWardAccess();
  const canOpen = useCanOpenHref();
  const wards = useMemo(() => {
    if (accessIsWholeNetwork(access)) return allWards;
    const places = wardPlaceLookup(allWards.map((ward) => ward.unit));
    return allWards.filter((ward) => unitInScope(access.scope, ward.id, places));
  }, [allWards, access]);
  const baseId = useId();
  const stale = wards.filter((ward) => wardIsStale(ward, now)).length;
  // Batch 3: the Held up tile, list, column and chip, the beds table and its ward panel left this
  // tab; "Beds by ward" is Capacity's. The older parts above stay in this file, unused.
  return (
    <div data-testid="ward-handover-beds" className={styles.bedsNow}>
      <Card aria-labelledby={`${baseId}-handover-beds-now`}>
        <CardHead
          id={`${baseId}-handover-beds-now`}
          title="Beds now"
          meta={<span className={styles.sub}>{wards.length} wards</span>}
          aside={
            canOpen(CAPACITY_HREF) ? (
              <Link
                href={CAPACITY_HREF}
                className={buttonClass({ variant: "ghost", size: "sm" })}
                data-testid="ward-handover-beds-by-ward"
              >
                Beds by ward
                <Icon icon={ChevronRight} size={14} />
              </Link>
            ) : undefined
          }
          className={styles.cardHead}
        />
        <CardBody className={styles.bedsNowBody}>
          <BedsNowTiles rows={rows} wards={wards} waitingForBed={waitingForBed} />
          <CheckingFoot
            surface="page"
            items={[
              {
                id: "stale",
                label: "Wards' counts past their time limit",
                value: stale,
                tone: stale > 0 ? "warning" : undefined,
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
