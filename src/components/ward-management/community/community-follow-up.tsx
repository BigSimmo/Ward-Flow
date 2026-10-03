"use client";
import { useState } from "react";
import { useWardFlow } from "../ward-flow-provider";
import type { DischargeOpenHandle } from "../ward-discharge-records";
import { DischargeCareJourney } from "../discharges/discharge-care-journey";
export function CommunityFollowUp({ admissionId, teamId }: { admissionId: string; teamId: string }) {
  const { openDischargeRecord, readDischargeRecord } = useWardFlow();
  const [handle, setHandle] = useState<DischargeOpenHandle | null>(null);
  const actor = { role: "community", actingTeamId: teamId } as const;
  const read = readDischargeRecord?.(actor, admissionId, handle);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (openDischargeRecord) setHandle(openDischargeRecord(actor, admissionId));
        }}
      >
        Open community follow-up
      </button>
      {handle && read?.status !== "allowed" && (
        <p role="alert">The current team cannot open this admission’s care record.</p>
      )}
      {read?.status === "allowed" && <DischargeCareJourney record={read.value} actor={actor} />}
    </>
  );
}
