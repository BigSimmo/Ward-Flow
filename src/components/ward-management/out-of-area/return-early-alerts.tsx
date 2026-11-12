"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

/**
 * Out of area "Flag early" alerts, loaded after the page so the ward, community and Transport
 * screens keep their phone script budget. Renders nothing while loading, as the card itself does
 * when this desk has no flagged return.
 */
export const ReturnEarlyAlerts = dynamic(
  withLoadRetry(() => import("./return-early-alerts-card").then((m) => m.ReturnEarlyAlerts)),
  {
    loading: () => null,
  },
);
