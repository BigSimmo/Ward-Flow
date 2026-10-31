"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  admissionBelongsToTeam,
  communityTeamById,
} from "@/components/ward-management/community/community-derivations";
import { bookTransportBlockedReason } from "@/components/ward-management/ed/ed-blocked-reasons";
import { useCommunityScreenTransport } from "@/components/ward-management/community/use-community-screen-overlays";
import {
  useCommunityScopedReferrals,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";

import { CommunityTransportBookDialog } from "./community-transport-book-dialog";

/** The team the page draws (`community-team-page.tsx`). */
const TEAM_ID = "midland";

/**
 * The Community transport booking mock-up, drawn over the Midland team page. No community team's
 * person holds a pulled bed linked to a movement in the sample, so no team page ever draws its Log
 * transport booking button. The dialog is drawn on its own instead, with the page's own transport
 * state and save (`useCommunityScreenTransport`, acting as Midland): for one of Midland's people if
 * the sample ever holds one, else the first open movement whose bed is pulled and not yet booked
 * (the person the ED board's Log transport mock-up would also find).
 */
export function PopCommunityTransportBook({ page }: { page: ReactNode }) {
  const { admissions, movements, patients } = useWardFlowSelect("admissions", "movements", "patients");
  const referrals = useCommunityScopedReferrals();
  const now = useWardFlowClock();
  const raise = useWardRaise("community");
  const transport = useCommunityScreenTransport({ raise, now, teamId: TEAM_ID });
  const [targetId] = useState<string | undefined>(() => {
    const team = communityTeamById(TEAM_ID);
    // The page's own test for a Log transport booking button (`community-team-in-bed.tsx`).
    const bookable = admissions.filter((admission) => {
      if (admission.state !== "pulled" || admission.movementId === null) return false;
      const movement = movements.find((candidate) => candidate.id === admission.movementId);
      return movement !== undefined && movement.transport === undefined;
    });
    const own = team ? bookable.find((admission) => admissionBelongsToTeam(admission, team, referrals)) : undefined;
    if (own?.movementId) return own.movementId;
    return movements.find(
      (movement) => movement.closure === undefined && bookTransportBlockedReason(movement) === undefined,
    )?.id;
  });
  const { openTransportBook } = transport;
  useEffect(() => {
    if (targetId !== undefined) openTransportBook(targetId);
    // Opens once, on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);

  return (
    <>
      {page}
      <CommunityTransportBookDialog view={{ ...transport, now, movements, umrnLookup }} />
    </>
  );
}
