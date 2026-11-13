"use client";

import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";

import { useDemoRoleSession } from "@/components/ward-management/tools/ward-demo-role-session";

/**
 * Shared design parts item 8 (13 Nov 2026): while See it as shows another desk, every page says so
 * in one slim bar under the app bar, with the way back. The layout carries only this gate on every
 * page (phone size limits); the bar's code loads the first time a role demo starts.
 */
const Body = dynamic(
  withLoadRetry(() => import("./ward-viewing-as-bar-body").then((m) => m.WardViewingAsBarBody)),
  {
    ssr: false,
  },
);

export function WardViewingAsBar() {
  return useDemoRoleSession() ? <Body /> : null;
}
