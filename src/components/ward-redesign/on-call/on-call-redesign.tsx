"use client";

import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";

import styles from "./on-call-redesign.module.css";

/**
 * On-call, redesigned. The review found the page the right shape and its problems density, so it
 * draws today's screen (cover times, My list, Copy who is on, the downtime card and every mock
 * number work as now) and applies the redesign with one scoped stylesheet: the seven service
 * lines become a compact two-line strip, and the directory's filters sit closer together.
 */
export function OnCallRedesign() {
  return (
    <div className={styles.onCall}>
      <OnCallScreen />
    </div>
  );
}
