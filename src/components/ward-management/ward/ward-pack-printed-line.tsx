"use client";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { lastPackPrintedAt } from "@/components/ward-management/reports/downtime-pack-prints";

/**
 * DOWNTIME PACK UP TO DATE (Batch 4 item 24, Josh approved the drawing 11 Nov 2026, D-142): My
 * ward's Checking line says when this ward's outage pack was last printed or saved. On a desktop it
 * follows the capacity time (`lead` " · "); on a phone it is its own line. Ids and times only, read
 * from the shared record; nothing is kept on the device.
 */
export function WardPackPrintedLine({ unitId, now, lead = "" }: { unitId: string; now: Instant; lead?: string }) {
  const records = useOptionalWardFlowSelect("downtimePackPrints");
  if (records === null) return null;
  const at = lastPackPrintedAt(records.downtimePackPrints, unitId);
  return (
    <span data-testid="ward-hero-pack-printed">
      {lead}
      {at === null ? (
        "Outage pack never printed"
      ) : (
        <>
          Outage pack last printed <b>{formatInstantWithDay(at, now)}</b>
        </>
      )}
    </span>
  );
}
