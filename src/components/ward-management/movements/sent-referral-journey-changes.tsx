"use client";

import type { ReactNode } from "react";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import type { CommunitySentReferral } from "@/components/ward-management/ward-referral-visibility";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { journeyIsMine, SentJourneyChanges } from "./sent-journey-changes";

/**
 * D-80: the community team's urgency and legal status controls on its Sent list. The row it sits on
 * is already the team's own sent referral (`communitySentView`), so the sender check is asked of that
 * row alone, never of the full referral list FD-23 keeps from the team's screen
 * (`tests/ward-referral-screen-boundary.test.ts`).
 */

/** The open journey started from a referral (a community team's, D-76), never one leaving a stay. */
function openJourneyForReferral(movements: readonly Movement[], referralId: string): Movement | undefined {
  return movements.find(
    (movement) => movement.referralId === referralId && movement.sourceAdmissionId === undefined && !movement.closure,
  );
}

/** The community team's Sent list: the controls for the open journey a sent referral started. */
export function SentReferralJourneyChanges({
  referral,
  patientWho,
  wrap = (controls) => controls,
}: {
  referral: Pick<CommunitySentReferral, "id" | "sendingTeamName">;
  patientWho: string;
  /** Places the controls (a table row of their own), only when there are controls to place. */
  wrap?: (controls: ReactNode) => ReactNode;
}) {
  const routeRole = useRouteRole();
  const { movements, admissions, units } = useWardFlowSelect("movements", "admissions", "units");
  const access = useEffectiveWardAccess();
  const movement = openJourneyForReferral(movements, referral.id);
  // A Sent row is a community referral by construction (`communitySentView` keeps no other), and a
  // team's referral is matched on its team, never on a site, so it carries no site code.
  const sender = {
    id: referral.id,
    source: "community" as const,
    sendingTeamName: referral.sendingTeamName,
    originSiteCode: "",
  };
  return journeyIsMine({ referrals: [sender], admissions }, movement, routeRole, access, wardPlaceLookup(units))
    ? wrap(<SentJourneyChanges key={movement.id} movement={movement} patientWho={patientWho} />)
    : null;
}
