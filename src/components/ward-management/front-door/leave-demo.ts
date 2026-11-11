"use client";

import { useSyncExternalStore } from "react";

/**
 * Live audit item 22 (11 Nov 2026): the public demo had no way to leave. Only a site with the front
 * door on has its readable marker cookie (`wf_door=1`), so "Leave the demo" shows only there, and
 * only in the local demo; a signed-in desk has Sign out. Leaving ends the demo the way a sign-out
 * ends a session (D-88): this browser's demo state and drafts are cleared, the front door's pass
 * ends through the existing `DELETE /api/session`, and the sign-in page opens.
 */
const noChange = () => () => {};

function markerPresent(): boolean {
  try {
    return document.cookie.split(/;\s*/).includes("wf_door=1");
  } catch {
    return false;
  }
}

/** True on a front-door site in the browser. False while the page is drawn on the server. */
export function useCanLeaveDemo(): boolean {
  return useSyncExternalStore(noChange, markerPresent, () => false);
}

export async function leaveDemo(): Promise<void> {
  try {
    // Loaded on use: the shell does not carry the session-end sweep on every page.
    const { endWardFlowBrowserSession } = await import("../ward-browser-data");
    endWardFlowBrowserSession();
  } catch {
    // Keep going: the pass below is what keeps this browser out.
  }
  // The front door's own call, awaited (the sweep above started it), so the sign-in page never opens
  // while the pass is still good. Loaded on use too, like the sweep.
  await import("./front-door-pass-client").then(
    ({ endFrontDoorPass }) => endFrontDoorPass(),
    () => {},
  );
  // A full load, not a client navigation: the sign-in page must be drawn fresh, and Back must not
  // return to the demo.
  window.location.replace("/sign-in");
}
