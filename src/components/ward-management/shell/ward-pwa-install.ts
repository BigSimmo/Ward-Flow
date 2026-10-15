/**
 * INSTALL PROMPT — PWA plan item 11, Oct 2026.
 *
 * Chromium browsers fire `beforeinstallprompt` once, soon after a page loads, and the page can show
 * the install sheet later only if it kept that event. Settings is rarely the first page opened, so
 * `listenForInstallPrompt` runs from the shell on every Ward Flow load (`ward-pwa-registration.tsx`)
 * and keeps the event here; the Settings install hint reads it with `useInstallPrompt`. Safari has
 * no such event: the hint shows the Add to Home Screen steps there instead.
 */
import { useSyncExternalStore } from "react";

/** The browser's install event. Not in TypeScript's DOM types yet. */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

let deferred: InstallPromptEvent | null = null;
let listening = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Keeps the browser's install event for the Settings hint. Safe to call more than once. */
export function listenForInstallPrompt(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keeps the event for the Install button rather than the browser's own banner mid-task.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The kept install event, or null when the browser has not offered one (or it was used). */
export function useInstallPrompt(): InstallPromptEvent | null {
  return useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );
}

/**
 * Shows the browser's install sheet. The event works once, so it is dropped whatever the answer.
 * Returns whether the person installed. Never throws.
 */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  notify();
  try {
    await event.prompt();
    return (await event.userChoice).outcome === "accepted";
  } catch {
    return false;
  }
}
