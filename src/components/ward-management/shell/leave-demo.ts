"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import { useOptionalToast } from "@/components/wf/toast-provider";
import { endWardFlowBrowserSessionAndPass } from "../ward-browser-data";
import { SharedSessionContext } from "./ward-shared-session-context";

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

/**
 * True on a front-door site in the browser, in the local demo only. False while the page is drawn on
 * the server, and always false in a signed-in session, which has Sign out (it revokes the account's
 * session on the server; leaving the demo would not).
 */
export function useCanLeaveDemo(): boolean {
  const session = useContext(SharedSessionContext);
  const marker = useSyncExternalStore(noChange, markerPresent, () => false);
  return marker && !session;
}

/**
 * Leave the demo. Resolves false, without leaving, when the server did not confirm the pass ended
 * (an error reply, no connection or the deadline): opening the sign-in page then would only show
 * the demo again, because the pass still opens the site.
 */
async function leaveDemo(): Promise<boolean> {
  // The sweep a sign-out runs (D-88). It ends the front door's pass too, awaited here so the sign-in
  // page never opens while the pass is still good.
  let ended = false;
  try {
    ended = await endWardFlowBrowserSessionAndPass();
  } catch {
    ended = false;
  }
  if (!ended) return false;
  // A full load, not a client navigation: the sign-in page must be drawn fresh, and Back must not
  // return to the demo.
  window.location.replace("/sign-in");
  return true;
}

/** Leave the demo from a button, saying so on a toast when it could not end (try again). */
export function useLeaveDemo(): () => void {
  const toast = useOptionalToast();
  return useCallback(() => {
    void leaveDemo().then((left) => {
      if (left) return;
      toast?.push({
        tone: "warning",
        title: "The demo could not end",
        body: "This browser's demo data was cleared, but the sign-in did not end. Check the connection and try again.",
        skipOfflineNote: true,
      });
    });
  }, [toast]);
}
