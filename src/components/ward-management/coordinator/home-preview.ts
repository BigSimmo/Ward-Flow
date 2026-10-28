"use client";

import { useSyncExternalStore } from "react";

/**
 * Home polish mock-up (design review, 28 Oct 2026). `/ward-flow?preview=home-polish` switches on
 * the proposed Home and tour changes so Josh can compare them with the accepted design on the same
 * synthetic records (D-74: nothing changes on the real page until he approves the mock-up). Off in
 * a production build and on the server, so the hosted site and the hydrated tree are unchanged.
 * On approval the changes become the default and this switch is removed.
 */
export const HOME_POLISH_PREVIEW = "home-polish";

const noSubscribe = () => () => undefined;

function readPreview(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return new URLSearchParams(window.location.search).get("preview") === HOME_POLISH_PREVIEW;
}

export function useHomePolishPreview(): boolean {
  return useSyncExternalStore(noSubscribe, readPreview, () => false);
}
