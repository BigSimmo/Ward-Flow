"use client";

import { HeroTrack } from "@/components/wf";

import { PLACES_CATCHMENTS_HREF, PLACES_HREF } from "./places-hrefs";

export type PlacesTab = "places" | "catchments";

/**
 * PL1 (Josh, 3 Nov 2026): Community folds into Places. The two jobs stay separate routes, so a link
 * or a back press lands on the right one, and this track on the hero band switches between them.
 * Each community team's own page stays where it is: it is the community desk's home.
 */
export function PlacesTrack({ value }: { value: PlacesTab }) {
  return (
    <HeroTrack<PlacesTab>
      label="Places views"
      value={value}
      items={[
        { id: "places", label: "Places", href: PLACES_HREF },
        { id: "catchments", label: "Catchments", href: PLACES_CATCHMENTS_HREF },
      ]}
    />
  );
}
