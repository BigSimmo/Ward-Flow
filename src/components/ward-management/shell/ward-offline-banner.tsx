"use client";

import { useOnlineStatus } from "@/components/ward-management/use-online-status";
import styles from "./ward-offline-banner.module.css";

/**
 * A quiet notice when the device loses its network connection. The prototype keeps its state in
 * this tab's memory, so screens keep working; the notice says so, and that nothing is syncing, so
 * nobody reads "Live" as current while Wi-Fi is down. Renders nothing while online.
 */
export function WardOfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p className={styles.banner} role="status" data-testid="ward-offline-banner">
      Offline. This screen keeps working from this session, but nothing is updating until the connection returns.
    </p>
  );
}
