"use client";

// Fork of src/components/ward-management/shell/ward-rail-lazy.tsx: mounts the mock-ups' rail copy.

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { useIsPhone } from "@/components/wf";
import { closeWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import {
  isTypingTarget,
  openDrawerForShortcut,
  useWardDocumentPreferences,
} from "@/components/ward-management/shell/ward-rail-preferences";
// The rail's styles stay in the shell's own stylesheet, in the same order as before, so the
// desktop page is drawn exactly as it was. Only the rail's script is split out.
import "@/components/ward-management/shell/ward-rail.module.css";

/**
 * Repo score follow-up (16 October 2026): a phone never draws the rail (it is hidden under 48rem
 * and the bar's Menu holds the navigation), yet every phone page loaded its code, about 11 KB
 * gzipped. The layout mounts the rail from here. Above phone width it is the same rail, drawn by
 * the server as before (`ssr` stays on and there is no `loading`, so there is no Suspense boundary
 * and the server waits for it). On a phone only the page-wide preferences and drawer shortcuts
 * the rail used to keep run, so its code is never fetched.
 */
const RailLoaded = dynamic(() =>
  import("@/components/ward-redesign/shell/preview-rail-body").then((m) => m.PreviewRailBody),
);

function PhonePreferences() {
  useWardDocumentPreferences();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeWardDrawer();
        return;
      }
      if (isTypingTarget(event.target)) return;
      openDrawerForShortcut(event);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}

/** Drop-in for the real `WardRail` (same props: none). */
export function PreviewRail() {
  return useIsPhone() ? <PhonePreferences /> : <RailLoaded />;
}
