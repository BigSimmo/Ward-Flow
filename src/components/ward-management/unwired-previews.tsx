import type { ReactNode } from "react";

import { wardEnvironment, type WardEnvironment } from "@/components/ward-management/ward-feature-flags";

/**
 * Controls and notes the prototype does not connect yet ("Not wired in this prototype.", D4).
 *
 * Overall review, 20 Oct 2026 (Josh accepted the recommendation): "hide every not-wired button in
 * the pilot build, so nothing on screen pretends to work." They show only in a local development
 * build, the same rule the feature flag registry applies to unfinished work (on in development,
 * off in demo and production), so a builder still sees where a future feature belongs. Demo and
 * production builds, including a deployed build that names no environment, leave them out.
 *
 * The environment is read from the build (`NEXT_PUBLIC_WARD_ENVIRONMENT`, else the Node build mode),
 * so the server and browser renders agree and nothing here can be switched on a device.
 */
export function showsUnwiredPreviews(environment: WardEnvironment = wardEnvironment()): boolean {
  return environment === "development";
}

/** Renders its children only where `showsUnwiredPreviews()` is true. */
export function UnwiredPreview({ children }: { children: ReactNode }) {
  return showsUnwiredPreviews() ? <>{children}</> : null;
}
