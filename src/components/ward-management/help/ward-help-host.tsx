"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";

import { subscribeWardHelp, type HelpView } from "./ward-help-events";

// The sheet, the tour and their content load only when first needed, so every page's first load
// stays the same size.
const WardHelpSheet = dynamic(() => import("./ward-help-sheet").then((m) => m.WardHelpSheet));
const WardTour = dynamic(() => import("./ward-tour").then((m) => m.WardTour));
const WardTourAutoStart = dynamic(() => import("./ward-tour-auto-start").then((m) => m.WardTourAutoStart));
const WardWhatsNew = dynamic(() => import("./ward-whats-new").then((m) => m.WardWhatsNew));

/**
 * Mounted once by the header. Draws nothing until something calls `openWardHelp`, except that a
 * signed-in desk (role access on) checks whether its tour should start on its own, and whether this
 * device has a what's new note to read.
 */
export function WardHelpHost() {
  const [view, setView] = useState<HelpView | null>(null);
  const signedIn = useWardFeatureFlag("role-access");
  useEffect(() => subscribeWardHelp(setView), []);
  const startTour = useCallback(() => setView("tour"), []);
  const close = useCallback(() => setView(null), []);
  if (view === "tour") return <WardTour onClose={close} />;
  if (view !== null) return <WardHelpSheet view={view} onView={setView} onClose={close} />;
  return signedIn ? (
    <>
      <WardTourAutoStart onStart={startTour} />
      <WardWhatsNew />
    </>
  ) : null;
}
