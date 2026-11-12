"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

import { preloadWhenIdle } from "./preload-when-idle";

/**
 * Phone budget: the "on behalf of the ward" picker draws only when a coordinator opens a ward's
 * discharge record, so its code stays out of the first load and is fetched when the browser is idle.
 */
const loadOnBehalfReasonForm = () => import("./on-behalf-reason-form");

export const OnBehalfReasonForm = dynamic(
  withLoadRetry(() => loadOnBehalfReasonForm().then((m) => m.OnBehalfReasonForm)),
  {
    loading: () => null,
  },
);

preloadWhenIdle(loadOnBehalfReasonForm);
