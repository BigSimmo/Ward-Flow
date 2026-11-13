"use client";

import { useState } from "react";

import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { useOpenOnLoad } from "./open-on-load";

// A ready census bed opens the dialog; on a phone the census is not pressable, so the request's own
// Accept in principle opens its sheet instead.
const WARD_ANSWER_POPUPS = {
  "ward-accept": ["button[aria-label$=' READY'] || [data-testid^='ward-accept-WF-']"],
} as const;
const DEFAULT_WARD = "rph-adult-secure";

/**
 * Preview only: the Ward answer page. Its Accept in principle pop-up needs a request waiting on the
 * ward and a ready bed to press, and Dabakarn has no request at 10:42, so that pop-up draws the
 * answer page of the first ward with both (as the older mock-up did) and presses a ready bed in its
 * census, which opens the page's own dialog (Josh, 2 Nov 2026). Nothing is recorded.
 */
export function WardAnswerPreview({ openOnLoad }: { openOnLoad?: string }) {
  const world = useWardFlowSelect("movements", "units", "admissions", "bedReleases", "leaveBeds");
  // Chosen once, so accepting in the pop-up does not move the page to another ward.
  const [unitId] = useState(() => {
    if (openOnLoad !== "ward-accept") return DEFAULT_WARD;
    const answerable = world.units.find(
      (unit) =>
        bedStates(unit, world.admissions, world.bedReleases, world.leaveBeds, world.movements).ready > 0 &&
        world.movements.some(
          (movement) =>
            isOpen(movement) && movement.stage === "destination_review" && movement.referredUnitIds.includes(unit.id),
        ),
    );
    return answerable?.id ?? DEFAULT_WARD;
  });
  useOpenOnLoad(openOnLoad, WARD_ANSWER_POPUPS);
  return <WardScreen unitId={unitId} presentation="answer" />;
}
