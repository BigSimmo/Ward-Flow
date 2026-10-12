import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { DEVELOPER_AREA_HEADER } from "@/lib/developer-area/headers";
import { PRIVATE_APP_ROBOTS_METADATA } from "@/lib/crawler-policy";

import "./mockups.css";

// Design-exploration prototypes: shipped for shareability, but never indexed.
export const metadata: Metadata = {
  robots: PRIVATE_APP_ROBOTS_METADATA,
};

/**
 * Mockup routes are a development surface: reachable in dev and test builds, 404 in a production
 * build unless explicitly opted in. Read here rather than through `@/lib/env`, whose full server
 * contract (database, provider and upload settings) belonged to the former clinical app and went with it.
 */
function mockupsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MOCKUPS_ENABLED === "true";
}

export default async function MockupsLayout({ children }: { children: ReactNode }) {
  // src/proxy.ts already blocks every /mockups/** path in production (the real
  // block). This is defense-in-depth for direct/dev-server access — except the
  // subtrees listed in DEVELOPER_GATED_PATH_PREFIXES, which proxy marks via this
  // header. Those subtrees are deliberately public in production: the owner removed
  // the developer key, and the sign-in gate with it, on 28 September 2026, so the
  // synthetic Ward Flow prototype opens without one (see ward-flow/layout.tsx). No
  // other check runs after this one. The count is deliberately not stated: this
  // comment kept naming a smaller set for months after a fourth prefix was added
  // (2026-09-02 audit, L76/L82). The header is proxy-only: any client-supplied copy
  // of it is stripped before this point, so it cannot be spoofed.
  const isDeveloperGatedArea = (await headers()).get(DEVELOPER_AREA_HEADER) === "1";
  if (!mockupsEnabled() && !isDeveloperGatedArea) {
    notFound();
  }
  return children;
}
