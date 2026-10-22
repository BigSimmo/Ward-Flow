"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { subscribeWardHelp, type HelpView } from "./ward-help-events";

// The sheet and its content load only when Help is first opened, so every page's first load stays
// the same size.
const WardHelpSheet = dynamic(() => import("./ward-help-sheet").then((m) => m.WardHelpSheet));

/** Mounted once by the header. Draws nothing until something calls `openWardHelp`. */
export function WardHelpHost() {
  const [view, setView] = useState<HelpView | null>(null);
  useEffect(() => subscribeWardHelp(setView), []);
  if (view === null) return null;
  return <WardHelpSheet view={view} onView={setView} onClose={() => setView(null)} />;
}
