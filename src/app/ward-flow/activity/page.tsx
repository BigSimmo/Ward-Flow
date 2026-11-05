"use client";

/**
 * WF-42: `/ward-flow/activity` is not a page — Activity is a shell panel. An old or typed URL
 * opens that panel on the desk home instead of 404.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { openActivityPanel } from "@/components/ward-management/shell/ward-activity-panel-store";

export default function WardActivityRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    // Replace the typed URL before the bar pushes a drawer history entry, so closing Activity
    // does not Back onto this page and reopen the panel (CodeRabbit on PR #1471).
    const home = "/ward-flow";
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", home);
    }
    openActivityPanel({ tab: "notices" });
    router.replace(home);
  }, [router]);
  return (
    <main>
      <p role="status">Opening Activity</p>
    </main>
  );
}
