"use client";

// New for the site bed manager's Capacity (Josh, 30 Oct): the site's own ED as counts only, because
// Places does not list the ED for this desk. Read with the same derivation the All EDs page uses
// (`edHomeSummaries`), so the figures agree with it; never a name.

import { useMemo } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import { edHomeSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Site } from "@/components/ward-management/ward-model";

/** Only the ED matters here, so any site shape that names one will do (the model holds a `SiteIdentity`). */
type WithEd = Pick<Site, "emergencyDepartment">;

/** `short` is the road-time list's own form ("RPH ED"), so the hero names which ED it counts. */
export type SiteEdWaiting = { short: string; waiting: number; pastTarget: number };

/** The desk site's ED: people waiting there for an inpatient bed, and how many are past target. */
export function useSiteEdWaiting(site: WithEd | undefined, now: Instant): SiteEdWaiting | null {
  const { movements, configuration } = useWardFlowSelect("movements", "configuration");
  const edId = site?.emergencyDepartment?.id;
  return useMemo(() => {
    if (edId === undefined) return null;
    const summary = edHomeSummaries(movements, now, configuration.edAccessTargetMinutes).find(
      (candidate) => candidate.ed.id === edId,
    );
    return summary
      ? {
          short: `${summary.ed.siteCode} ED`,
          waiting: summary.waiting,
          pastTarget: summary.pastAccessTarget,
        }
      : null;
  }, [edId, movements, now, configuration.edAccessTargetMinutes]);
}
