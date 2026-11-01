"use client";

/*
 * The five team sections for the Midland demo team (locked design, design/community-team-2026-11;
 * Q126 and Q132: seeded demo data, Midland only). Each panel keeps the page's tab panel wiring;
 * the case manager picked on Team home carries into Caseload.
 */

import { useState, type HTMLAttributes } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import { minuteOfDay } from "@/components/ward-management/ward-clock";
import type { CommunityTeamSection } from "../community-screen-hero";
import { TeamCaseload, TeamHospital } from "./team-caseload";
import { TeamClinicians } from "./team-clinicians";
import { TeamHome } from "./team-home";
import { TeamReferrals } from "./team-referrals";

const clockOf = (now: Instant) => {
  const m = minuteOfDay(now);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function MidlandTeamSections({
  panel,
  open,
  now,
}: {
  panel: (section: CommunityTeamSection) => HTMLAttributes<HTMLDivElement>;
  open: (section: CommunityTeamSection) => void;
  now: Instant;
}) {
  const [caseManager, setCaseManager] = useState("");
  const go = (section: CommunityTeamSection, cm?: string) => {
    if (cm !== undefined) setCaseManager(cm);
    open(section);
  };
  return (
    <>
      <div {...panel("home")}>
        <TeamHome go={go} now={clockOf(now)} />
      </div>
      <div {...panel("caseload")}>
        <TeamCaseload caseManager={caseManager} setCaseManager={setCaseManager} />
      </div>
      <div {...panel("hospital")}>
        <TeamHospital />
      </div>
      <div {...panel("referrals")}>
        <TeamReferrals />
      </div>
      <div {...panel("clinicians")}>
        <TeamClinicians />
      </div>
    </>
  );
}
