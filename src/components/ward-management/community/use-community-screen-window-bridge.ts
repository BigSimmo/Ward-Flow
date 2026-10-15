/*
 * The community team screen's window bridge: the handful of global functions the page has always
 * exposed (switch a tab, open a drawer, accept or decline), kept in one effect.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import { useEffect } from "react";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { CommunityScopedReferral } from "@/components/ward-management/ward-referral-visibility";
import type { ActiveTabType, DrawerType, ModalType } from "./community-screen-helpers";

export function useCommunityScreenWindowBridge({
  referrals,
  liveReferrals,
  now,
  setActiveTab,
  setSelectedReferralId,
  setPendingAcceptance,
  setAcceptanceError,
  setActiveDrawer,
  setSelectedPatientId,
  setActiveModalType,
  handleConfirmAccept,
  handleConfirmDecline,
  handleCompleteContact,
  openNewReferral,
}: {
  referrals: readonly CommunityScopedReferral[] | undefined;
  liveReferrals: readonly CommunityScopedReferral[];
  now: Instant;
  setActiveTab: (tab: ActiveTabType) => void;
  setSelectedReferralId: (referralId: string) => void;
  setPendingAcceptance: (pending: null) => void;
  setAcceptanceError: (error: null) => void;
  setActiveDrawer: (drawer: DrawerType) => void;
  setSelectedPatientId: (patientId: string) => void;
  setActiveModalType: (modal: ModalType) => void;
  handleConfirmAccept: (referralId: string) => void;
  handleConfirmDecline: (referralId: string) => void;
  handleCompleteContact: (patientId: string) => void;
  openNewReferral: () => void;
}): void {
  // The state setters below are stable, so listing them (as the hooks lint asks, now that they arrive
  // as arguments) never re-runs this effect: it re-runs on exactly the inputs it always did.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as Record<string, unknown>;
    win.switchTab = (tabId: ActiveTabType) => {
      setActiveTab(tabId);
    };
    win.openReferralDrawer = (refId: string) => {
      setSelectedReferralId(refId);
      setPendingAcceptance(null);
      setAcceptanceError(null);
      setActiveDrawer("referralDrawer");
    };
    win.openPatientDrawer = (ptId: string) => {
      setSelectedPatientId(ptId);
      setActiveDrawer("pxDrawer");
    };
    win.acceptReferral = (refId: string) => {
      handleConfirmAccept(refId);
    };
    win.declineReferral = (refId: string) => {
      handleConfirmDecline(refId);
    };
    win.completeContact = (ptId: string) => {
      handleCompleteContact(ptId);
    };
    win.openCrisisModal = () => {
      setActiveModalType("crisis");
    };
    win.openModal = (modalId: string) => {
      if (modalId === "newReferralModal") openNewReferral();
      else if (modalId === "handoverModal") setActiveModalType("handover");
      else if (modalId === "contactModal") setActiveModalType("contact");
      else if (modalId === "crisisModal") setActiveModalType("crisis");
    };
    win.openDrawer = (drawerId: DrawerType) => {
      setActiveDrawer(drawerId);
    };
    win.selectTeam = (targetTeamId: string) => {
      const target = COMMUNITY_TEAM_PAGES.find((t) => t.id === targetTeamId);
      if (target) {
        window.location.href = communityTeamHref(target);
      }
    };
  }, [
    referrals,
    liveReferrals,
    handleCompleteContact,
    handleConfirmAccept,
    handleConfirmDecline,
    now,
    setActiveTab,
    openNewReferral,
    setSelectedReferralId,
    setPendingAcceptance,
    setAcceptanceError,
    setActiveDrawer,
    setSelectedPatientId,
    setActiveModalType,
  ]);
}
