"use client";

/**
 * WF-42: bare `/ward-flow/statistics` is closed for desks held to their own place's Statistics
 * (ED, ward, community). Redirect to that scoped page instead of "Not part of your role".
 */
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { ownStatisticsHrefFor } from "@/components/ward-management/ward-role-access";

export function StatisticsOwnRedirect({ children }: { children: ReactNode }) {
  const access = useEffectiveWardAccess();
  const router = useRouter();
  const own = ownStatisticsHrefFor(access, communityTeamSlug);
  useEffect(() => {
    if (own) router.replace(own);
  }, [own, router]);
  if (own) {
    return (
      <main data-testid="ward-statistics-own-redirect">
        <p role="status">Opening your statistics</p>
      </main>
    );
  }
  return <>{children}</>;
}
