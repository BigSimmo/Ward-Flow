"use client";

// The desk Places is drawn for, split out of hub-screen.tsx to keep that file under the line cap.
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { siteByCode, type SiteIdentity } from "@/components/ward-management/ward-sites";

export type HubDesk = {
  /** ROLE BRANCH (bed_manager, D-80): the site a site bed manager works for; undefined on every other desk. */
  site: SiteIdentity | undefined;
  /** Whether this desk may open an address, by the same table the menu reads. */
  canOpen: (href: string) => boolean;
  /** The closed page's own sentence, shown beside a greyed Open. */
  closedSentence: string;
};

/**
 * ROLE BRANCH (bed_manager, D-80): a site bed manager's Places opens on its own site's wards, the
 * places it may open. Every other place stays listed as place information (finding a ward, its
 * cohort and security), with Open greyed, no Ask to confirm and no statistics it cannot read.
 */
export function useHubDesk(): HubDesk {
  const access = useEffectiveWardAccess();
  const canOpen = useCanOpenHref();
  const siteCode = access.role === "bed_manager" && access.scope.kind === "site" ? access.scope.siteCode : undefined;
  return {
    site: siteCode === undefined ? undefined : siteByCode(siteCode),
    canOpen,
    closedSentence: `This screen is not part of the ${ACCESS_ROLE_LABELS[access.role]} desk.`,
  };
}
