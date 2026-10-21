"use client";

import { useEffect, useState, type ComponentProps } from "react";

import { Button } from "@/components/wf";

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
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (Panel || failed) return;
    let live = true;
    void loadReferralHistory()
      .then((panel) => {
        if (live) setPanel(() => panel);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [Panel, failed]);
  if (Panel) return <Panel {...props} />;
  // A failed fetch (patchy Wi-Fi, or a new deploy) must not hide the history without a word.
  return failed ? (
    <p role="status" data-testid="ward-referral-history-load-failed">
      The written history and corrections did not load.{" "}
      <Button variant="sec" onClick={() => setFailed(false)}>
        Try again
      </Button>
    </p>
  ) : null;
}

preloadWhenIdle(loadReferralHistory);
