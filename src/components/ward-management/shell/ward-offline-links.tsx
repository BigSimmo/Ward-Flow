"use client";

import { useEffect } from "react";
import { useOptionalToast } from "@/components/wf";

/** What an in-app link says while the device is offline, instead of leaving the app. */
export const WARD_OFFLINE_LINK_NOTICE = "Offline. Other pages open again when the connection returns.";

/**
 * A1-18 (audit 13 Oct 2026): offline, a tap on an in-app link to another page made the router
 * fetch that page, fail, and fall back to a full load, which landed on the browser's own "No
 * internet" page and left the app. While the browser reports no connection, such a tap stays on
 * this page and says why; this page keeps working from the session. Links within the same page,
 * new-tab links and modified clicks are left alone. Renders nothing.
 */
export function WardOfflineLinks() {
  const toast = useOptionalToast();
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (navigator.onLine !== false) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      toast?.push({
        tone: "info",
        title: WARD_OFFLINE_LINK_NOTICE,
        body: "This page keeps working.",
        skipOfflineNote: true,
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [toast]);
  return null;
}
