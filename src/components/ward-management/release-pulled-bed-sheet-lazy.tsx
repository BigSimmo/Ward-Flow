"use client";

import { useState, type ComponentProps } from "react";
import dynamic from "next/dynamic";

import { withLoadRetry } from "@/components/ward-management/load-retry";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";

import type { ReleasePulledBedSheet as Sheet } from "./release-pulled-bed-sheet";

/**
 * Phone script budget (PR #1742): "Release pulled bed" opens only on a press, so its code stays off
 * the first load of the Ward, ED and movement pages and is fetched when the browser is idle. Once a
 * target has been given the sheet stays mounted, as the parents expect, so the step's outcome is
 * still said after it closes.
 */
const loadSheet = () => import("./release-pulled-bed-sheet");

const LazySheet = dynamic(
  withLoadRetry(
    () => loadSheet().then((m) => m.ReleasePulledBedSheet),
    undefined,
    ({ target }) => !target,
  ),
  { ssr: false, loading: () => null },
);

export function ReleasePulledBedSheet(props: ComponentProps<typeof Sheet>) {
  const [opened, setOpened] = useState(false);
  if (props.target && !opened) setOpened(true);
  return opened || props.target ? <LazySheet {...props} /> : null;
}

preloadWhenIdle(loadSheet);
