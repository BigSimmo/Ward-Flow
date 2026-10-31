"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";

import { subscribeWardHelp, type HelpRequest, type HelpView } from "./ward-help-events";
import { subscribeShortcutsKey } from "./ward-shortcuts-key";

// The sheet, the tour and their content load only when first needed, so every page's first load
// stays the same size.
const WardHelpSheet = dynamic(() => import("./ward-help-sheet").then((m) => m.WardHelpSheet));
const WardTour = dynamic(() => import("./ward-tour").then((m) => m.WardTour));
const WardShowMe = dynamic(() => import("./ward-show-me").then((m) => m.WardShowMe));
const WardTourAutoStart = dynamic(() => import("./ward-tour-auto-start").then((m) => m.WardTourAutoStart));
const WardShortcutsSheet = dynamic(() => import("./ward-shortcuts-sheet").then((m) => m.WardShortcutsSheet));
const WardHelpHints = dynamic(() => import("../help-content/ward-help-hints").then((m) => m.WardHelpHints));
const WardWhatsNew = dynamic(() => import("./ward-whats-new").then((m) => m.WardWhatsNew));

type Open = { view: HelpView; ask?: string } | { showMe: string };

/**
 * Mounted once by the header. Draws nothing until something calls `openWardHelp`, `askWardHelp` or
 * `showWardHowTo`, except that a signed-in desk (role access on) checks whether its tour should
 * start on its own, and whether this device has a what's new note to read.
 */
export function WardHelpHost() {
  const [open, setOpen] = useState<Open | null>(null);
  const signedIn = useWardFeatureFlag("role-access");
  const askOn = useWardFeatureFlag("help-ask");
  useEffect(
    () =>
      subscribeWardHelp((request: HelpRequest) => {
        if (request.kind === "view") setOpen({ view: request.view });
        else if (request.kind === "ask") setOpen({ view: "screen", ask: request.question });
        else setOpen({ showMe: request.id });
      }),
    [],
  );
  // "?" anywhere opens the keyboard shortcuts sheet (P120), unless Help or the tour is open.
  const [shortcuts, setShortcuts] = useState(false);
  useEffect(() => subscribeShortcutsKey(() => setShortcuts(true)), []);
  const closeShortcuts = useCallback(() => setShortcuts(false), []);
  const startTour = useCallback(() => setOpen({ view: "tour" }), []);
  const setView = useCallback((view: HelpView) => setOpen({ view }), []);
  const close = useCallback(() => setOpen(null), []);
  if (open && "showMe" in open) {
    return askOn ? <WardShowMe id={open.showMe} onClose={close} onBack={() => setOpen({ view: "screen" })} /> : null;
  }
  if (open?.view === "tour") return <WardTour onClose={close} />;
  if (open)
    return (
      <WardHelpSheet view={open.view} ask={askOn ? (open.ask ?? "") : undefined} onView={setView} onClose={close} />
    );
  if (shortcuts) return <WardShortcutsSheet onClose={closeShortcuts} />;
  return signedIn ? (
    <>
      <WardTourAutoStart onStart={startTour} />
      <WardWhatsNew />
      <WardHelpHints />
    </>
  ) : null;
}
