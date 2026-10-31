"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * The 48 hour timeline, code split (Movements redesign, 31 Oct 2026: the phone page was at its
 * script budget). A phone opens Movements without it on screen (it draws only inside the Arrivals
 * ahead sheet, after "Show the timeline"), so its first load skips this code. A tablet or laptop
 * still draws it on the server, and the code is fetched once the browser is idle so a phone tap
 * normally finds it already there.
 *
 * No `loading` option, so no Suspense boundary of its own. With one, the server streamed the
 * timeline as a separate part that the browser could show a moment after the page, and the
 * worklist under it jumped down (a 0.5 layout shift on the release gate, 31 Oct 2026). Now it
 * arrives with the rest of the page. The phone sheet, which mounts it after a tap, wraps it in
 * its own Suspense.
 */
// The import sits inside `dynamic()` so the build links this call to the timeline's code and
// stylesheet; the server then sends that stylesheet with the page, and the page waits for it.
export const MovementHorizonGantt = dynamic(() =>
  import("./movement-horizon-gantt").then((m) => m.MovementHorizonGantt),
);

preloadWhenIdle(() => import("./movement-horizon-gantt"));
