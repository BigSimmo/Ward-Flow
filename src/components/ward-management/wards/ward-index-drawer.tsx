"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import { Drawer, StatusGlyph, buttonClass } from "@/components/wf";
import { CapacityWardSidebar } from "@/components/ward-management/capacity/capacity-ward-drawer";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";

import styles from "./ward-index.module.css";

/**
 * WS1 (Josh, 3 Nov 2026): a ward card opens this side panel. It is Capacity's own ward panel
 * (`CapacityWardSidebar`), fed the same `networkWardRows` figures, so both pages say the same
 * thing about a ward: ready of beds, occupied, on leave, pulled, closed, when the count was
 * confirmed and the sex designation. The foot carries this page's two ways on: the ward and its
 * bed board. The ward's profile (what it admits, the forms it holds) sits under the panel.
 */
export function WardIndexDrawer({
  unit,
  place,
  now,
  countsOnly,
  onClose,
  profile,
}: {
  unit: Unit | undefined;
  /** "Site · Service", the drawer's quiet line under the ward name. */
  place: string;
  now: Instant;
  /** Site bed manager: another site's ward, shown as counts with no way in. */
  countsOnly: boolean;
  onClose: () => void;
  profile: ReactNode;
}) {
  const { bedReleases, admissions, leaveBeds } = useWardFlowSelect("bedReleases", "admissions", "leaveBeds");
  const canOpen = useCanOpenHref();
  const row = useMemo(
    () => (unit ? networkWardRows([unit], now, bedReleases, admissions, leaveBeds)[0] : undefined),
    [unit, now, bedReleases, admissions, leaveBeds],
  );
  const wardHref = unit ? `/ward-flow/ward/${unit.id}` : "";
  const boardHref = unit ? `/ward-flow/board/${unit.id}` : "";
  const showWard = !countsOnly && unit !== undefined && canOpen(wardHref);
  const showBoard = !countsOnly && unit !== undefined && canOpen(boardHref);
  return (
    <Drawer
      open={row !== undefined}
      onClose={onClose}
      title={unit?.name ?? "Ward"}
      description={place}
      titleAccessory={
        row ? (
          <span className={styles.drawerTag}>
            <StatusGlyph tone={row.ready > 0 ? "success" : "warning"} size={8} />
            {row.ready} ready
          </span>
        ) : undefined
      }
      testId="ward-index-ward-drawer"
      footer={
        showWard || showBoard ? (
          <div className={styles.drawerFoot}>
            {showWard ? (
              <Link href={wardHref} className={buttonClass({ variant: "pri", size: "sm" })}>
                Open ward
              </Link>
            ) : null}
            {showBoard ? (
              <Link href={boardHref} className={buttonClass({ variant: "sec", size: "sm" })}>
                Bed board
              </Link>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {row ? (
        <>
          <CapacityWardSidebar row={row} onBack={onClose} now={now} showPlace={false} footInDrawer />
          <section className={styles.drawerProfile} aria-label="Ward profile">
            <h3 className={styles.drawerProfileTitle}>Ward profile</h3>
            {profile}
          </section>
        </>
      ) : null}
    </Drawer>
  );
}
