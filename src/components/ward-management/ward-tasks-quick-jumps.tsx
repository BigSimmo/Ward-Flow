"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { WARD_ALERTS_HREF, WARD_NAV, WARD_VIEWS } from "@/components/ward-management/ward-nav";
import { useCanOpenHref, useDeskHomeHref } from "@/components/ward-management/shell/ward-access";
import styles from "./ward-tasks-drawer.module.css";

const WAITING_HREF = WARD_VIEWS.find((view) => view.id === "delays")?.href ?? "/ward-flow/waiting";
const ALERTS_JUMP_HREF = WARD_NAV.find((item) => item.id === "alerts")?.href ?? WARD_ALERTS_HREF;

/**
 * The Alerts drawer's quick jumps: Waiting list, Alerts & watches and Home, with a dot between each.
 * Audit 1 Nov 2026 (item 11, DA-09): each goes only where this desk may go. Home is the desk's own
 * home, and a page the desk cannot open is left out rather than ending at "Not part of your role".
 */
export function TasksQuickJumps({
  showAlerts,
  onNavigate,
}: {
  /** Alerts & watches shows only where the drawer is not already the Alerts queue. */
  showAlerts: boolean;
  /** The drawer's own link handler, which guards an unsaved draft and closes the drawer. */
  onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const canOpen = useCanOpenHref();
  const home = useDeskHomeHref();
  const jumps = [
    { id: "delays", href: WAITING_HREF, label: "Waiting list →", show: canOpen(WAITING_HREF) },
    { id: "alerts", href: ALERTS_JUMP_HREF, label: "Alerts & watches →", show: showAlerts },
    { id: "coordinator", href: home, label: "Home →", show: canOpen(home) },
  ].filter((jump) => jump.show);
  return (
    <>
      {jumps.flatMap((jump, index) => [
        index > 0 ? (
          <span key={`sep-${jump.id}`} aria-hidden="true" className={styles.quickJumpSep}>
            ·
          </span>
        ) : null,
        <Link
          key={jump.id}
          href={jump.href}
          onClick={onNavigate}
          data-testid={`ward-tasks-jump-${jump.id}`}
          className={styles.quickJump}
        >
          {jump.label}
        </Link>,
      ])}
    </>
  );
}
