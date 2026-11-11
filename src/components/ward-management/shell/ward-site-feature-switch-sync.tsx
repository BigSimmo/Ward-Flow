"use client";

import { useEffect, useMemo } from "react";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setSiteSwitchedOffFeatures } from "@/components/ward-management/shell/ward-feature-flag-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { deskSiteCodes, featuresOffForDesk } from "@/components/ward-management/ward-site-feature-switches";

/**
 * Batch 4 item 20 (10 Nov 2026): hands the features switched off at this desk's site, as the shared
 * workspace records them, to the feature flag store, so a switched-off feature is off on every
 * screen for everyone at that site. Renders nothing. Mounted once in the ward layout, inside the
 * workspace, so it reads the site's switches as soon as the app loads the workspace.
 */
export function WardSiteFeatureSwitchSync() {
  const records = useOptionalWardFlowSelect("siteFeatureSwitches", "units");
  const access = useEffectiveWardAccess();
  const units = records?.units;
  const switches = records?.siteFeatureSwitches;
  const off = useMemo(
    () => (units ? featuresOffForDesk(switches, deskSiteCodes(access, wardPlaceLookup(units))) : []),
    [access, units, switches],
  );
  const key = off.join(",");
  useEffect(() => {
    setSiteSwitchedOffFeatures(key === "" ? [] : key.split(","));
  }, [key]);
  useEffect(() => () => setSiteSwitchedOffFeatures([]), []);
  return null;
}
