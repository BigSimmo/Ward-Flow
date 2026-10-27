"use client";

import { useSyncExternalStore, type ReactNode } from "react";

import { useWardFeatureFlag } from "./ward-feature-flag-store";

const never = () => () => {};

/**
 * H-0111 (Josh, 27 Oct 2026): the server cannot know which desk a device has taken, because the desk
 * is kept on the device. So the first page sent, and the browser's first pass over it, were drawn
 * for the whole network, and a desk could briefly see a page that is not part of its role. With
 * role access on, the page area waits for the device's own desk: `fallback` is sent and drawn first,
 * and the page follows straight after. Pages opened later in the app are drawn at once.
 */
export function WardAccessFirstPaintHold({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const on = useWardFeatureFlag("role-access");
  // False on the server and in the browser's first pass over the server's page, true after that.
  const deskKnown = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  return <>{on && !deskKnown ? fallback : children}</>;
}
