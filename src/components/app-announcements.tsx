"use client";

import { LiveAnnouncer, RouteAnnouncer } from "@/components/wf/live-announcer";

/** Narrow client boundary for the application-wide announcement infrastructure. */
export function AppAnnouncements() {
  return (
    <>
      <LiveAnnouncer />
      <RouteAnnouncer />
    </>
  );
}
