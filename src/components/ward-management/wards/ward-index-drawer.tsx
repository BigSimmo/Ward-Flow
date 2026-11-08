"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import { DrawerFootRow, PanelDrawer, StatusPill, buttonClass } from "@/components/wf";
import { CapacityWardSidebar, useCapacityWardTabs } from "@/components/ward-management/capacity/capacity-ward-drawer";
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
  const { bedReleases, admissions, leaveBeds, movements, referrals } = useWardFlowSelect(
    "bedReleases",
    "admissions",
    "leaveBeds",
    "movements",
    "referrals",
  );
  const canOpen = useCanOpenHref();
  // WF-FIG-017: a bed held by name is held, not Ready, as on the Capacity network table.
  const row = useMemo(
    () =>
      unit
        ? networkWardRows([unit], now, bedReleases, admissions, leaveBeds, [...movements, ...referrals])[0]
        : undefined,
    [unit, now, bedReleases, admissions, leaveBeds, movements, referrals],
  );
  const wardHref = unit ? `/ward-flow/ward/${unit.id}` : "";
  const boardHref = unit ? `/ward-flow/board/${unit.id}` : "";
  const showWard = !countsOnly && unit !== undefined && canOpen(wardHref);
  const showBoard = !countsOnly && unit !== undefined && canOpen(boardHref);
  const wardTabs = useCapacityWardTabs(row ? unit?.id : undefined);
  return (
    <PanelDrawer
      open={row !== undefined}
      onClose={onClose}
      title={unit?.name ?? "Ward"}
      subtitle={place}
      tag={row ? <StatusPill tone={row.ready > 0 ? "success" : "warning"}>{row.ready} ready</StatusPill> : undefined}
      tabs={wardTabs.tabs}
      tab={wardTabs.tab}
      onTabChange={wardTabs.onTabChange}
      tabsLabel="Ward panel view"
      testId="ward-index-ward-drawer"
      foot={
        showWard || showBoard ? (
          <DrawerFootRow>
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
          </DrawerFootRow>
        ) : undefined
      }
    >
      {row ? (
        <>
          <CapacityWardSidebar row={row} onBack={onClose} now={now} tab={wardTabs.tab} showPlace={false} footInDrawer />
          {wardTabs.tab === "ward" ? (
            <section className={styles.drawerProfile} aria-label="Ward profile">
              <h3 className={styles.drawerProfileTitle}>Ward profile</h3>
              {profile}
            </section>
          ) : null}
        </>
      ) : null}
    </PanelDrawer>
  );
}
