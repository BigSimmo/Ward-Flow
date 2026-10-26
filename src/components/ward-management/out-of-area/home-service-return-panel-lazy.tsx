"use client";

import dynamic from "next/dynamic";

import { preloadWhenIdle } from "../preload-when-idle";

/**
 * Phone budget: the home service steps draw only inside an opened return plan, so their code stays
 * out of the first load and is fetched when the browser is idle (closing-the-loop, package E).
 */
const loadHomeServiceReturnPanel = () => import("./home-service-return-panel");

export const HomeServiceReturnPanel = dynamic(
  () => loadHomeServiceReturnPanel().then((m) => m.HomeServiceReturnPanel),
  { loading: () => null },
);

preloadWhenIdle(loadHomeServiceReturnPanel);
