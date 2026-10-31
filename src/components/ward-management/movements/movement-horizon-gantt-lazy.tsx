"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * The 48 hour timeline, code split (Movements redesign, 31 Oct 2026: the phone page was at its
 * script budget). A phone opens Movements without it on screen (it draws only inside the Arrivals
 * ahead sheet, after "Show the timeline"), so its first load skips this code. A tablet or laptop
 * still draws it on the server, and the code is fetched once the browser is idle so a phone tap
 * normally finds it already there. `loading` keeps a Suspense boundary on the timeline alone.
 */
const loadMovementHorizonGantt = () => import("./movement-horizon-gantt");

export const MovementHorizonGantt = dynamic(() => loadMovementHorizonGantt().then((m) => m.MovementHorizonGantt), {
  loading: () => null,
});

preloadWhenIdle(loadMovementHorizonGantt);
