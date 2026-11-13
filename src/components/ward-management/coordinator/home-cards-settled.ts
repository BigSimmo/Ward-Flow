"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { bedsGapCard } from "./home-list-lazy";
import { sinceBanner } from "./home-since-banner-lazy";

/** Home never stays hidden longer than this for a card that is slow or fails to load. */
const HOME_CARDS_WAIT_MS = 1500;

/**
 * Layout shift on Home (11 Nov 2026): Home draws on the client, and the two cards it shows at rest
 * from split code (the "since you were last here" line, and Beds that fit off a phone) landed a
 * moment after My list and Later today and pushed them down (0.106 on a desktop, 0.064 on a phone).
 * Home's columns now stay invisible (opacity 0), still taking their space, until those cards have
 * arrived, then appear whole. They stay in the accessibility tree and reachable by the keyboard
 * (#1631), and show as soon as focus moves inside them. Both are fetched as soon as Home's code runs, so the wait is normally nothing.
 * After `HOME_CARDS_WAIT_MS` Home shows anyway and the late card drops in, as before.
 */
export function useHomeCardsSettled(needBeds: boolean): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const stopBanner = sinceBanner.subscribe(listener);
      const stopBeds = needBeds ? bedsGapCard.subscribe(listener) : () => undefined;
      return () => {
        stopBanner();
        stopBeds();
      };
    },
    [needBeds],
  );
  const loaded = useSyncExternalStore(
    subscribe,
    () => sinceBanner.ready() && (!needBeds || bedsGapCard.ready()),
    () => false,
  );
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    if (loaded || waitedOut) return;
    const timer = window.setTimeout(() => setWaitedOut(true), HOME_CARDS_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [loaded, waitedOut]);
  return loaded || waitedOut;
}
