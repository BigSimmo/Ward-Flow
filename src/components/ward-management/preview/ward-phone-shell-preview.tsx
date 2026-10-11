"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { WardPreviewOption } from "./ward-preview-routes";

/**
 * Preview-only switch for the phone shell mockups (device audit, 11 Oct 2026). Live pages never set
 * it, so the shell reads null and draws exactly what it draws today. A phone shell preview route
 * mounts `WardPhoneShellPreviewFlag` beside the page it shows, and the shell then draws that option.
 */

let current: WardPreviewOption | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setWardPhoneShellPreview(option: WardPreviewOption | null) {
  current = option;
  listeners.forEach((listener) => listener());
}

/** The phone shell option being previewed, or null on every live page. */
export function useWardPhoneShellPreview(): WardPreviewOption | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

export function WardPhoneShellPreviewFlag({ option }: { option: WardPreviewOption }) {
  useEffect(() => {
    setWardPhoneShellPreview(option);
    return () => setWardPhoneShellPreview(null);
  }, [option]);
  return null;
}
