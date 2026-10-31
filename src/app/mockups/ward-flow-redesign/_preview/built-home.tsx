"use client";

import { useEffect, useState } from "react";

import { ActivityPanel } from "@/components/ward-management/coordinator/activity-panel";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

/**
 * Preview only. Home is built into the app (lane H, 31 Oct 2026), so the preview draws the real
 * coordinator screen on the preview world. Pop-ups are still drawn over it, so the slug stays.
 * Until the frame's Activity button opens Home's panel in the app (lane C), the preview opens it
 * here: on load for the Activity pop-up, and when the bar's Activity button is pressed (the shell
 * sends `wf-mockup:open-activity` to a page marked `data-mockup-activity-panel`).
 */
export function BuiltHome({ openOnLoad }: { openOnLoad?: string }) {
  const now = useWardFlowClock();
  const [open, setOpen] = useState(openOnLoad === "activity-panel");
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("wf-mockup:open-activity", show);
    return () => window.removeEventListener("wf-mockup:open-activity", show);
  }, []);
  return (
    <div data-mockup-activity-panel="">
      <CoordinatorScreen />
      <ActivityPanel id="preview-home-activity-panel" open={open} onClose={() => setOpen(false)} now={now} />
    </div>
  );
}
