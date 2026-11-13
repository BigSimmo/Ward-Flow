"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

/**
 * Phone size (13 Nov 2026): the stand-in Unlock's host (`tv-lock-fallback-host.tsx`) does nothing
 * until a browser locked as a TV has waited two seconds for its own Unlock, so its code arrives just
 * after the page draws instead of with every page's first load. The two-second wait starts once it
 * has arrived, so a locked TV still always gets a way out.
 */
export const TvLockFallbackHost = dynamic(
  withLoadRetry(() => import("./tv-lock-fallback-host").then((m) => m.TvLockFallbackHost)),
  {
    ssr: false,
    loading: () => null,
  },
);
