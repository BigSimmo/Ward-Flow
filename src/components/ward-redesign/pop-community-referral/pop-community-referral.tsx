"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";

import { COMMUNITY_TEAM_PAGES, communityTeamById } from "@/components/ward-management/community/community-derivations";
import { referralsWaitingOnTeam } from "@/components/ward-management/community/community-screen-helpers";
import { useCommunityScopedReferrals, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { CommunityScopedReferral } from "@/components/ward-management/ward-referral-visibility";
import {
  patientIdentityLine,
  resolveSubjectPatient,
  type PatientResolutionSubject,
} from "@/components/ward-management/ward-patient-resolver";

import { CommunityReferralDialog } from "./community-referral-dialog";

/** The team the page draws (`community-team-page.tsx`). */
const TEAM_ID = "midland";

/** No page hook holds the scrim here: the kit Dialog keeps focus and Escape itself. */
const NO_PAGE_SCRIM = () => {};

/**
 * The Community referral (Assign) mock-up, drawn over the Midland team page. No referral waits on any
 * community team's answer in the sample (all ten community referrals are already accepted), so the
 * page never draws its Assign button. The dialog is drawn on its own instead: for the first referral
 * waiting on Midland or another team if the sample ever holds one, else Midland's own oldest referral.
 * Take for this team records `ASSIGN_REFERRAL` as the page does.
 */
export function PopCommunityReferral({ page }: { page: ReactNode }) {
  const { patients, movements } = useWardFlowSelect("patients", "movements");
  const referrals = useCommunityScopedReferrals();
  const [target] = useState<CommunityScopedReferral | undefined>(() => {
    const midland = communityTeamById(TEAM_ID);
    if (!midland) return undefined;
    const oldestFirst = (list: CommunityScopedReferral[]) => [...list].sort((a, b) => a.raisedAt - b.raisedAt);
    for (const team of [midland, ...COMMUNITY_TEAM_PAGES.filter((candidate) => candidate.id !== midland.id)]) {
      const waiting = oldestFirst(referralsWaitingOnTeam(referrals, team));
      if (waiting[0]) return waiting[0];
    }
    return oldestFirst(referrals.filter((referral) => referral.addressing.destination.teamName === midland.name))[0];
  });
  const [activeModal, setActiveModal] = useState<{ referral: CommunityScopedReferral } | null>(
    target ? { referral: target } : null,
  );
  const referralModalRef = useRef<HTMLDivElement | null>(null);
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const identityOf = (subject: PatientResolutionSubject) =>
    patientIdentityLine(resolveSubjectPatient(subject, umrnLookup));

  return (
    <>
      {page}
      <CommunityReferralDialog
        view={{
          identityOf,
          activeModal,
          setActiveModal,
          referralModalRef,
          referralModalBackdropRef: NO_PAGE_SCRIM,
        }}
      />
    </>
  );
}
