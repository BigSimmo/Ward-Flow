"use client";

// The app's sidebar mount (Josh, 2 Nov 2026): the rail's code loads on demand, and a phone keeps only
// the page-wide preferences and drawer shortcuts. It replaced the old shell's lazy rail.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useIsPhone } from "@/components/wf";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { useCanOpenHref, useDeskHomeHref } from "@/components/ward-management/shell/ward-access";
import { goToPageForShortcut } from "@/components/ward-management/shell/ward-goto-shortcuts";
import { navigateWithDirtyGuard } from "@/components/ward-management/use-dirty-state-guard";
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
  import("@/components/ward-management/shell-next/next-rail-body").then((m) => m.NextRailBody),
);

function PhonePreferences() {
  useWardDocumentPreferences();
  const canOpen = useCanOpenHref();
  const canRefer = canOpen(WARD_REFERRAL_INTAKE_HREF);
  const deskHome = useDeskHomeHref();
  const router = useRouter();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeWardDrawer();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (openDrawerForShortcut(event, canRefer)) return;
      goToPageForShortcut(event, canOpen, (href) => navigateWithDirtyGuard(() => router.push(href)), deskHome);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canRefer, canOpen, deskHome, router]);
  return null;
}

/** Drop-in for the real `WardRail` (same props: none). */
export function NextRail() {
  return useIsPhone() ? <PhonePreferences /> : <RailLoaded />;
}
