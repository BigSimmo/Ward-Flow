"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Feature 21 (9 Nov 2026): Expected occupancy stays out of the Capacity page's first load (the route
 * has about 1 KB of phone script headroom), fetched when the browser is idle. It sits at the foot of
 * the forecast card, so arriving late moves nothing above it.
 */
const loadTable = () => import("./capacity-expected-occupancy");

export const ExpectedOccupancyTable = dynamic(
  withLoadRetry(() => loadTable().then((m) => m.ExpectedOccupancyTable)),
  {
    loading: () => null,
  },
);

preloadWhenIdle(loadTable);
