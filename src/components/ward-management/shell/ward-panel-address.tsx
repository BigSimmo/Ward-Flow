"use client";

/**
 * WF-42 (Josh, 5 Nov 2026): `/ward-flow/activity` and `/ward-flow/help` are not pages. Activity and
 * Help are shell panels, so a typed or old address lands on the desk's own home (`homeHrefFor`)
 * with that panel open, for every desk, never on the closed screen.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useDeskHomeHref } from "@/components/ward-management/shell/ward-access";

export function WardPanelAddress({ label, open }: { label: string; open: () => void }) {
  const router = useRouter();
  const home = useDeskHomeHref();
  useEffect(() => {
    // Replace the typed address before the panel pushes a drawer history entry, so closing the
    // panel does not go Back onto this address and open it again (CodeRabbit on PR #1471).
    window.history.replaceState(window.history.state, "", home);
    router.replace(home);
    // A macrotask later every chrome on the page has subscribed, including one that wraps this
    // page (the executive chrome's effects run after its children's).
    const timer = window.setTimeout(open, 0);
    return () => window.clearTimeout(timer);
  }, [home, open, router]);
  return (
    <main>
      <p role="status">Opening {label}</p>
    </main>
  );
}
