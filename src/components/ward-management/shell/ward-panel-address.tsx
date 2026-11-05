"use client";

/**
 * WF-42 (Josh, 5 Nov 2026): `/ward-flow/activity` and `/ward-flow/help` are not pages. Activity and
 * Help are shell panels, so a typed or old address lands on the desk's own home (`homeHrefFor`)
 * with that panel open, for every desk, never on the closed screen.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useDeskHomeHref } from "@/components/ward-management/shell/ward-access";

/**
 * The panel request waits here, at module level, not in the page's effect: `router.replace(home)`
 * unmounts this page, and an effect cleanup would cancel a timer it owned before the request ran
 * (CodeRabbit on PR #1471). The shell's bar and Help host live in the layout, so they are still
 * subscribed when it runs on the desk's home.
 */
let pendingOpen: (() => void) | null = null;
let pendingTimer: number | undefined;

function openPendingPanel() {
  pendingTimer = undefined;
  const open = pendingOpen;
  pendingOpen = null;
  open?.();
}

function requestPanelAfterRoute(open: () => void) {
  pendingOpen = open;
  // A macrotask later every chrome on the page has subscribed, including one that wraps this
  // page (the executive chrome's effects run after its children's).
  // A later request (the desk's home settling) replaces the earlier one, so the panel opens once.
  if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(openPendingPanel, 0);
}

export function WardPanelAddress({ label, open }: { label: string; open: () => void }) {
  const router = useRouter();
  const home = useDeskHomeHref();
  useEffect(() => {
    // Replace the typed address before the panel pushes a drawer history entry, so closing the
    // panel does not go Back onto this address and open it again (CodeRabbit on PR #1471).
    window.history.replaceState(window.history.state, "", home);
    router.replace(home);
    requestPanelAfterRoute(open);
  }, [home, open, router]);
  return (
    <main>
      <p role="status">Opening {label}</p>
    </main>
  );
}
