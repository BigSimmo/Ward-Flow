"use client";

import { useEffect, useState, type ComponentProps } from "react";

import { preloadWhenIdle } from "../preload-when-idle";

type HistoryPanel = typeof import("./referral-history-corrections").ReferralHistoryAndCorrections;

/**
 * Phone script budget (21 October 2026): the referral history and corrections list only draws on
 * the Timeline tab, or after a phone taps Show timeline, so `ReferralBoard` imports it from here and
 * the Referrals first load skips its code. It is fetched once the browser is idle.
 *
 * Not `next/dynamic`: a lazy component suspends on its first draw even when its code is already
 * fetched, and React then holds it back for about 300 ms, so the list popped in under the timeline.
 * Keeping the loaded component here lets the timeline and the list draw in the same frame.
 */
let loadedPanel: HistoryPanel | undefined;
const loadReferralHistory = () =>
  import("./referral-history-corrections").then((m) => (loadedPanel = m.ReferralHistoryAndCorrections));

export function ReferralHistoryAndCorrections(props: ComponentProps<HistoryPanel>) {
  const [Panel, setPanel] = useState(() => loadedPanel);
  useEffect(() => {
    if (Panel) return;
    let live = true;
    void loadReferralHistory()
      .then((panel) => {
        if (live) setPanel(() => panel);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [Panel]);
  return Panel ? <Panel {...props} /> : null;
}

preloadWhenIdle(loadReferralHistory);
