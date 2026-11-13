"use client";

// The ward drawer's tabs, apart from the drawer's body (capacity-ward-drawer.tsx), so Capacity can
// draw the drawer's tab row at once and load the body only when a ward is opened (phone size limit,
// 9 Nov 2026).
import { useState } from "react";
import type { DrawerTab } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { openBedReleases } from "@/components/ward-management/ward-bed-availability";

export type CapacityWardTab = "ward" | "discharges";

/**
 * The ward panel's two tabs, shown by the kit drawer (`PanelDrawer`) that holds the panel, and the
 * selected one. Discharges counts the ward page's own window: releases not yet discharged
 * (`openBedReleases`). Each ward opens on Ward, as when the tabs lived inside the panel.
 */
export function useCapacityWardTabs(unitId: string | undefined): {
  tabs: DrawerTab<CapacityWardTab>[];
  tab: CapacityWardTab;
  onTabChange: (next: CapacityWardTab) => void;
} {
  const { bedReleases } = useWardFlowSelect("bedReleases");
  const [chosen, setChosen] = useState<{ unitId: string | undefined; tab: CapacityWardTab }>({
    unitId: undefined,
    tab: "ward",
  });
  if (unitId === undefined && chosen.unitId !== undefined) setChosen({ unitId: undefined, tab: "ward" });
  return {
    tabs: [
      { id: "ward", label: "Ward" },
      // Every open release, whatever its date, as on the ward page (shared design parts item 2).
      {
        id: "discharges",
        label: "Discharges",
        count: unitId ? openBedReleases(bedReleases, unitId).length : 0,
        window: "any date",
      },
    ],
    tab: chosen.unitId === unitId ? chosen.tab : "ward",
    onTabChange: (next) => setChosen({ unitId, tab: next }),
  };
}
