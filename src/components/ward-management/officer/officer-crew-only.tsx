import type { ReactNode } from "react";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * Q154 (Josh, 1 Nov 2026): the ED, ward and community desks open Transport to follow their own
 * journeys (`ROLE_SCREENS`). The crew's work stays the transport officer's, so a desk sees each
 * step disabled with this reason. The officer and the coordinator act as before.
 */
export function crewLimitFor(access: WardAccess): string | undefined {
  return access.role === "ed" || access.role === "ward" || access.role === "community"
    ? "Transport officer only"
    : undefined;
}

/** The crew's own write controls (form upload, CAD number), left out on a desk following along. */
export function OfficerOnly({ children }: { children: ReactNode }) {
  return crewLimitFor(useEffectiveWardAccess()) ? null : children;
}
