"use client";

import { useEffect } from "react";
import { useOptionalToast } from "@/components/wf";

/** What an in-app link says while the device is offline, instead of leaving the app. */
export const WARD_OFFLINE_LINK_NOTICE = "You're offline. Tap again once you're back online.";

/**
 * Links whose page the router fetches in full ahead of the tap (`prefetch={true}`): the phone dock
 * and the phone menu's "needs you" rows (shell-next/next-phone-menu.tsx, next-phone-menu-sheet.tsx).
 * Other links only fetch the page frame, so their page still needs the network when tapped.
 */
const FULL_PREFETCH_LINKS = [
  '[data-testid="ward-phone-dock-link"]',
  '[data-testid="ward-phone-menu-alerts"]',
  '[data-testid="ward-phone-menu-tasks"]',
  '[data-testid="ward-phone-menu-need"]',
].join(",");

/** The router keeps a full prefetch for 5 minutes (Next `staleTimes.static`); stop short of that. */
export const OFFLINE_PREFETCH_FRESH_MS = 270_000;

type ResourceEntry = Pick<PerformanceEntry, "name" | "startTime" | "duration"> & { responseStatus?: number };

/**
 * Q273 (pre-launch review E1, 2 Nov 2026): true when the page behind a full-prefetch link was
 * fetched in the last few minutes, so the router can open it from memory without the network.
 * It counts when both of that page's router requests (`_rsc`) came back with a 200.
 */
export function offlineCanOpen(
  link: Element,
  url: URL,
  entries: readonly ResourceEntry[],
  now: number,
  freshMs: number = OFFLINE_PREFETCH_FRESH_MS,
): boolean {
  if (!link.matches(FULL_PREFETCH_LINKS)) return false;
  const want = url.origin + url.pathname + url.search;
  // The router fetches a page's route tree and its data as two `_rsc` requests to the same address,
  // so both must have come back. Only a reported 200 counts: a browser that gives no status (Safari)
  // keeps the tap here rather than risk leaving the app.
  const fetched = new Set<string>();
  for (const entry of entries) {
    const at = new URL(entry.name);
    const key = at.searchParams.get("_rsc");
    at.searchParams.delete("_rsc");
    if (
      key !== null &&
      entry.responseStatus === 200 &&
      at.origin + at.pathname + at.search === want &&
      now - entry.startTime - entry.duration <= freshMs
    )
      fetched.add(key);
  }
  return fetched.size > 1;
}

function pushOfflineNote(toast: ReturnType<typeof useOptionalToast>) {
  toast?.push({
    tone: "info",
    title: WARD_OFFLINE_LINK_NOTICE,
    body: "This page keeps working.",
    skipOfflineNote: true,
  });
}

/** How long the server check before a full page load may take before the server counts as away. */
const SERVER_CHECK_TIMEOUT_MS = 5_000;

/** True when the Ward Flow server answers its health check (`/api/health`, open without a sign-in). */
function serverAnswers(timeoutMs: number = SERVER_CHECK_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch("/api/health", { cache: "no-store", signal: controller.signal }).then(
    (response) => {
      clearTimeout(timer);
      return response.ok;
    },
    () => {
      clearTimeout(timer);
      return false;
    },
  );
}

/**
 * True after a server check failed, until one answers again. While it holds, an in-app link tap is
 * treated as offline (below), which also checks the server again for the next tap.
 */
let serverAway = false;

/** The parts of the browser's Navigation API `navigate` event read here. */
type NavigateEventLike = Event & {
  navigationType: string;
  cancelable: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  formData: FormData | null;
  destination: { url: string; sameDocument: boolean };
};

/**
 * Audit 4 A4-05 (13 Nov 2026): with the server away but the network up, the browser still reports a
 * connection, so the guard below lets a menu tap through. The router's page fetch then fails and it
 * falls back to a full page load, which lands on the browser's own error page and leaves the app.
 *
 * Where the browser has the Navigation API, a full page load to another Ward Flow page is held for a
 * quick server check first. If the server answers, the load goes ahead. If not, the page stays and
 * `onAway` shows the same note as offline. Router moves within the page, reloads, back and forward,
 * downloads and form posts are left alone. Returns the clean-up.
 */
export function watchServerAwayNavigations(onAway: () => void): () => void {
  const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
  if (!navigation) return () => {};
  let passing: string | undefined;
  let live = true;
  function onNavigate(raw: Event) {
    const event = raw as NavigateEventLike;
    if (!event.cancelable || event.hashChange || event.downloadRequest !== null || event.formData) return;
    if (event.navigationType !== "push" && event.navigationType !== "replace") return;
    if (event.destination.sameDocument) return;
    const url = new URL(event.destination.url);
    if (url.origin !== window.location.origin) return;
    if (passing === url.href) {
      passing = undefined;
      return;
    }
    event.preventDefault();
    const replace = event.navigationType === "replace";
    void serverAnswers().then((answers) => {
      serverAway = !answers;
      if (!live) return;
      if (!answers) return onAway();
      passing = url.href;
      if (replace) window.location.replace(url.href);
      else window.location.assign(url.href);
    });
  }
  navigation.addEventListener("navigate", onNavigate);
  return () => {
    live = false;
    navigation.removeEventListener("navigate", onNavigate);
  };
}

/**
 * A1-18 (audit 13 Oct 2026): offline, a tap on an in-app link to another page made the router
 * fetch that page, fail, and fall back to a full load, which landed on the browser's own "No
 * internet" page and left the app. While the browser reports no connection, such a tap stays on
 * this page and says why; this page keeps working from the session. Links within the same page,
 * new-tab links and modified clicks are left alone. Renders nothing.
 *
 * A4-05: the same applies while the server is known to be away (`watchServerAwayNavigations`).
 *
 * Q273: a page the router already holds in full (`offlineCanOpen`) opens as normal. For the rest
 * the note no longer promises the page will open later, because nothing remembers the tap.
 */
export function WardOfflineLinks() {
  const toast = useOptionalToast();
  useEffect(() => watchServerAwayNavigations(() => pushOfflineNote(toast)), [toast]);
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (navigator.onLine !== false && !serverAway) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (offlineCanOpen(target, url, performance.getEntriesByType("resource"), performance.now())) return;
      event.preventDefault();
      event.stopPropagation();
      pushOfflineNote(toast);
      // The server was away (A4-05): check again, so the next tap goes through once it answers.
      if (navigator.onLine !== false)
        void serverAnswers().then((answers) => {
          serverAway = !answers;
        });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [toast]);
  return null;
}
