"use client";

// The bed drawer is closed at first paint, so it stays off the ward's first load
// (PR #1626 phone budget). Lives in its own file so it does not form a cycle with
// ward-screen-overlays.tsx, which already imports WardBedDossierDrawer from
// ward-screen-lazy.tsx.

import dynamic from "next/dynamic";
import { preloadWhenIdle } from "../preload-when-idle";

const loadBedDrawer = () => import("./ward-screen-overlays");
export const WardScreenBedDrawer = dynamic(() => loadBedDrawer().then((m) => m.WardScreenBedDrawer), {
  ssr: false,
});
preloadWhenIdle(loadBedDrawer);
