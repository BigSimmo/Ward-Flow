"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useCommunityScreenTransport } from "@/components/ward-management/community/use-community-screen-overlays";
import {
  useCommunityScopedReferrals,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";

import { CommunityTransportCancelDialog } from "./community-transport-cancel-dialog";

/** The team the page draws (`community-team-page.tsx`). */
const TEAM_ID = "midland";

/**
 * The Cancel community transport mock-up, drawn over the Midland team page. Midland holds no booking
 * of its own in the sample (nobody on its In a bed list has a pulled bed), so its Cancel this team's
 * booking button is never drawn. The dialog is drawn on its own instead, with the page's own transport
 * state and save (`useCommunityScreenTransport`, acting as Midland), for the first open booking not yet
 * collected: Midland's own if there is one, else another community team's, else any.
 */
export function PopCommunityTransportCancel({ page }: { page: ReactNode }) {
  const { movements, patients } = useWardFlowSelect("movements", "patients");
  const referrals = useCommunityScopedReferrals();
  const now = useWardFlowClock();
  const raise = useWardRaise("community");
  const transport = useCommunityScreenTransport({ raise, now, teamId: TEAM_ID });
  const [targetId] = useState<string | undefined>(() => {
    const booked = movements.filter(
      (movement) =>
        movement.closure === undefined &&
        movement.transport !== undefined &&
        movement.transport.collectedAt === undefined,
    );
    const byCommunity = booked.filter((movement) => movement.transport?.bookedBy?.role === "community");
    return (
      byCommunity.find((movement) => movement.transport?.bookedBy?.placeId === TEAM_ID) ??
      byCommunity[0] ??
      booked[0]
    )?.id;
  });
  const { openTransportCancel } = transport;
  useEffect(() => {
    if (targetId !== undefined) openTransportCancel(targetId);
    // Opens once, on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);

  return (
    <>
      {page}
      <CommunityTransportCancelDialog view={{ ...transport, movements, umrnLookup }} />
    </>
  );
}
